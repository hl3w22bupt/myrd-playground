/**
 * asset-bytes —— 按清单 key 取原始字节（stack-tower 壳专用，只读旁路）。
 *
 * 为什么不复用 asset-store.getAsset：它对非 gzip 资产一律 TextDecoder 解码（encoding:'raw'），
 * PNG / m4a 等二进制字节会被 UTF-8 转码打碎。本模块直接按清单里的对象 key 拉**原始字节**，
 * 由壳自行决定回传形态（二进制资产 → base64 文本过 M1 网关，浏览器端还原）。
 *
 * 凭证 / 签名口径与 asset-store.ts 完全一致（SigV4 path-style，us-east-1）；绝不打印凭证。
 */
import { createHash, createHmac } from 'node:crypto';

export interface AssetEntry {
  key: string;
  bytes: number;
  gzip: boolean;
  contentType: string;
}

interface AssetManifest {
  assets: Record<string, AssetEntry>;
}

const sha256Hex = (data: string | Uint8Array): string => createHash('sha256').update(data).digest('hex');
const hmac = (key: string | Uint8Array, data: string): Buffer =>
  createHmac('sha256', key).update(data).digest();
/** S3 path-style 寻址的逐段编码（保留 /，与平台 s3-backend 同口径） */
const encodePath = (path: string): string => path.split('/').map(encodeURIComponent).join('/');

const env = {
  endpoint: process.env.APPHOST_ASSET_ENDPOINT?.replace(/\/+$/, '') ?? '',
  bucket: process.env.APPHOST_ASSET_BUCKET ?? '',
  manifestKey: process.env.APPHOST_ASSET_MANIFEST_KEY ?? '',
  accessKey: process.env.APPHOST_ASSET_ACCESS_KEY ?? '',
  secretKey: process.env.APPHOST_ASSET_SECRET_KEY ?? '',
};

export const assetBytesConfigured = Boolean(
  env.endpoint && env.bucket && env.manifestKey && env.accessKey && env.secretKey,
);

/** SigV4 GET（空体 payload），返回原始字节；404 → null；永不打印签名/凭证。 */
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
  if (!res.ok) throw new Error(`asset-bytes: GET ${key} failed with ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

let manifestPromise: Promise<AssetManifest | null> | null = null;
const entryCache = new Map<string, AssetEntry | null>();
const bytesInflight = new Map<string, Promise<Uint8Array | null>>();
const bytesCache = new Map<string, Uint8Array>();

/** 拉资产清单（进程内只拉一次；404 → null） */
export function loadManifest(): Promise<AssetManifest | null> {
  manifestPromise ??= s3GetBytes(env.manifestKey).then((bytes) => {
    if (!bytes) return null;
    return JSON.parse(new TextDecoder().decode(bytes)) as AssetManifest;
  });
  return manifestPromise;
}

/** 清单条目（未命中缓存 null） */
export async function getAssetEntry(name: string): Promise<AssetEntry | null> {
  if (entryCache.has(name)) return entryCache.get(name) ?? null;
  const manifest = await loadManifest();
  const entry = manifest?.assets[name] ?? null;
  entryCache.set(name, entry);
  return entry;
}

/** 原始字节（懒加载 + 内存缓存 + 并发去重；未命中 → null） */
export function getAssetBytes(name: string): Promise<Uint8Array | null> {
  const cached = bytesCache.get(name);
  if (cached) return Promise.resolve(cached);
  const pending = bytesInflight.get(name);
  if (pending) return pending;

  const task = (async (): Promise<Uint8Array | null> => {
    const entry = await getAssetEntry(name);
    if (!entry) return null;
    const bytes = await s3GetBytes(entry.key);
    if (bytes) bytesCache.set(name, bytes);
    return bytes;
  })();
  bytesInflight.set(name, task);
  task.finally(() => bytesInflight.delete(name)).catch(() => {});
  return task;
}
