/**
 * asset-store —— AppHost 资产（出 bundle 形态）的运行时读取层（平台模板提供，禁止改签名）。
 *
 * 平台契约（builder 步骤 3.5）：apphost.toml 声明 `assets_dir` 后，部署时平台把目录内文件
 * 上传对象存储并生成资产清单对象（key 注入 APPHOST_ASSET_MANIFEST_KEY）。本模块：
 *   1. 懒加载清单 + 资产（首次访问才拉取，实例常驻只拉一次；/health 不必等待资产就绪）；
 *   2. 内存缓存 + 并发去重（同一资产只拉一次）；
 *   3. 统一回传形态 `{ body, encoding, contentType }`：gzip 资产给 base64（encoding="gzip+b64"），
 *      文本资产原样（encoding="raw"）——响应必须是 text/plain / 文本类（M1 网关拦截二进制）。
 *
 * 凭证来自平台注入的 APPHOST_ASSET_* env。⚠️ 安全纪律：本模块绝不打印 Authorization 头 /
 * 任何凭证 —— 实例 stdout 落 app.log 且无平台脱敏。清单拉不到（404）= 该部署没有声明
 * assets_dir（内联形态）或对象丢失：getAsset 返回 null，由调用方决定 404 或降级。
 */
import { createHash, createHmac } from 'node:crypto';

export interface AssetPayload {
  /** 响应体：gzip 资产 = base64(text/plain 回传)；raw 文本 = 原文 */
  body: string;
  /** "raw" = 原文直出；"gzip+b64" = base64(gzip 字节)，客户端 DecompressionStream 解压 */
  encoding: 'raw' | 'gzip+b64';
  /** 源文件的 contentType（raw 直出可用；gzip+b64 一律 text/plain） */
  contentType: string;
}

interface AssetManifestEntry {
  key: string;
  bytes: number;
  gzip: boolean;
  contentType: string;
}

interface AssetManifest {
  assets: Record<string, AssetManifestEntry>;
}

const sha256Hex = (data: string | Uint8Array): string => createHash('sha256').update(data).digest('hex');
const hmac = (key: string | Buffer, data: string): Buffer => createHmac('sha256', key).update(data).digest();
/** S3 path-style 寻址的逐段编码（保留 /，与平台 s3-backend 同口径） */
const encodePath = (path: string): string => path.split('/').map(encodeURIComponent).join('/');

const env = {
  endpoint: process.env.APPHOST_ASSET_ENDPOINT?.replace(/\/+$/, '') ?? '',
  bucket: process.env.APPHOST_ASSET_BUCKET ?? '',
  manifestKey: process.env.APPHOST_ASSET_MANIFEST_KEY ?? '',
  accessKey: process.env.APPHOST_ASSET_ACCESS_KEY ?? '',
  secretKey: process.env.APPHOST_ASSET_SECRET_KEY ?? '',
};

export const assetStoreConfigured = Boolean(env.endpoint && env.bucket && env.manifestKey && env.accessKey && env.secretKey);

/** SigV4 GET（payload 为空体），返回字节；404 → null。永不打印签名/凭证。 */
async function s3GetBytes(key: string): Promise<Uint8Array | null> {
  const url = new URL(`${env.endpoint}/${env.bucket}/${encodePath(key)}`);
  const dateStr = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateShort = dateStr.slice(0, 8);
  const region = 'us-east-1';
  const scope = `${dateShort}/${region}/s3/aws4_request`;
  const payloadHash = sha256Hex('');
  const canonical = {
    host: `${url.host}\n`,
    'x-amz-content-sha256': `${payloadHash}\n`,
    'x-amz-date': `${dateStr}\n`,
  };
  const signedNames = Object.keys(canonical).sort();
  const canonicalRequest = [
    'GET',
    url.pathname,
    '',
    signedNames.map((n) => `${n}:${canonical[n as keyof typeof canonical]}`).join(''),
    signedNames.join(';'),
    payloadHash,
  ].join('\n');
  const stringToSign = ['AWS4-HMAC-SHA256', dateStr, scope, sha256Hex(canonicalRequest)].join('\n');
  const kSigning = hmac(hmac(hmac(hmac(`AWS4${env.secretKey}`, dateShort), region), 's3'), 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  const res = await fetch(url, {
    headers: {
      Authorization: `AWS4-HMAC-SHA256 Credential=${env.accessKey}/${scope}, SignedHeaders=${signedNames.join(';')}, Signature=${signature}`,
      'x-amz-date': dateStr,
      'x-amz-content-sha256': payloadHash,
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`asset-store: GET ${key} failed with ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

let manifestPromise: Promise<AssetManifest | null> | null = null;
const cache = new Map<string, AssetPayload>();
const inflight = new Map<string, Promise<AssetPayload | null>>();

/**
 * 拉资产清单（进程内只拉一次；404 → null）。
 * 只缓存成功结果：失败即清空 manifestPromise，下一次请求重拉 —— 端点瞬断若被
 * 永久缓存，实例会从「暂时拉不到」劣化成「永远 500」（2026-09-23 糖果游戏事故，
 * 与平台模板 templates/apphost/myrd-app/server/src/lib/asset-store.ts 同步修复）。
 */
function loadManifest(): Promise<AssetManifest | null> {
  manifestPromise ??= s3GetBytes(env.manifestKey)
    .then((bytes) => {
      if (!bytes) return null;
      return JSON.parse(new TextDecoder().decode(bytes)) as AssetManifest;
    })
    .catch((e: unknown) => {
      manifestPromise = null;
      throw e;
    });
  return manifestPromise;
}

/**
 * 取单个资产（懒加载 + 内存缓存 + 并发去重）。返回 null = 未声明资产/清单里没有。
 */
export function getAsset(name: string): Promise<AssetPayload | null> {
  if (!assetStoreConfigured) return Promise.resolve(null);
  const hit = cache.get(name);
  if (hit) return Promise.resolve(hit);
  const pending = inflight.get(name);
  if (pending) return pending;

  const task = (async (): Promise<AssetPayload | null> => {
    const manifest = await loadManifest();
    const entry = manifest?.assets[name];
    if (!entry) return null;
    const bytes = await s3GetBytes(entry.key);
    if (!bytes) return null;
    const payload: AssetPayload = entry.gzip
      ? { body: Buffer.from(bytes).toString('base64'), encoding: 'gzip+b64', contentType: entry.contentType }
      : { body: new TextDecoder().decode(bytes), encoding: 'raw', contentType: entry.contentType };
    cache.set(name, payload);
    return payload;
  })();
  inflight.set(name, task);
  task.finally(() => inflight.delete(name)).catch(() => {});
  return task;
}
