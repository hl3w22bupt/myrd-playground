import { Hono } from "hono";
import { gunzipSync } from "node:zlib";
import type { Context } from "hono";
import { ctx } from "#apphost";
import { assetBytesConfigured, getAssetBytes, getAssetEntry } from "./lib/asset-bytes";
import { BOOT_SCRIPT } from "./boot-script";
import { FALLBACK_PAGE_HTML } from "./game-page";

/**
 * Stack Tower（叠塔）AppHost 壳 —— games/stack-tower 专属（M2.1「有声可装」部署线）。
 *
 * 平台契约（apphost-public.ts / proxy.ts / builder.ts 事实源）：
 *  - 公网入口 /apps/<slug>/gw（/gw 段即页面目录根）；子路径经 rewrite 原样透传到实例；
 *  - 业务路由必须位于 /api/* 下（/ 与 /health 豁免）；公开资产必须在 api/public/*；
 *  - M1 网关只透传文本：image/*、audio/*、octet-stream 响应一律 502 ——
 *    二进制资产（png / m4a / ogg）由本壳以 base64 文本回传，浏览器端 boot 脚本还原；
 *  - 平台对非 .wasm/.pck 资产存原始字节，且 .m4a/.ogg/.webmanifest 的清单 contentType
 *    落到 octet-stream —— 必须按扩展名覆盖回真实类型，绝不能透传清单值。
 *
 * 正常路径：/ 返回 export/web 的 index.html 原文 + 注入 <base> 与 boot 脚本；
 * 其余请求按 /api/public/assets/<相对路径> 回源。资产通道未配置时降级 FALLBACK_PAGE_HTML。
 */

const TEXT_CONTENT_TYPE: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
};

const BINARY_NAME_RE = /\.(png|m4a|ogg|wav|mp3|jpg|jpeg|webp)$/i;

const extOf = (name: string): string => {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
};

/** manifest.webmanifest 的 start_url/scope 重写：相对清单 URL 指回正牌入口 /gw */
function rewriteManifest(json: string): string {
  try {
    const m = JSON.parse(json) as { start_url?: string; scope?: string };
    m.start_url = "../../../gw";
    m.scope = "../../../";
    return JSON.stringify(m);
  } catch {
    return json;
  }
}

/** 落地页注入：<base> 钉住公开资产路由 + boot 脚本（二进制还原 / 入口自愈） */
function injectBoot(html: string): string {
  const head = `<base href="api/public/assets/"><script>${BOOT_SCRIPT}</script>`;
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => `${m}${head}`);
  return `${head}${html}`;
}

async function serveLanding(c: Context) {
  if (!assetBytesConfigured) return c.html(FALLBACK_PAGE_HTML);
  const bytes = await getAssetBytes("index.html");
  if (!bytes) return c.html(FALLBACK_PAGE_HTML);
  return c.body(injectBoot(new TextDecoder().decode(bytes)), 200, {
    "Content-Type": "text/html; charset=utf-8",
  });
}

async function serveAsset(c: Context, name: string) {
  if (!name || name.endsWith("/")) return c.text(`asset not found: ${name}`, 404);
  const entry = await getAssetEntry(name);
  if (!entry) return c.text(`asset not found: ${name}`, 404);
  const bytes = await getAssetBytes(name);
  if (!bytes) return c.text(`asset not found: ${name}`, 404);
  const cache = { "Cache-Control": "public, max-age=300" };

  if (BINARY_NAME_RE.test(name)) {
    // 二进制：base64 文本过 M1 网关，浏览器端 boot 脚本还原真实字节
    return c.body(Buffer.from(bytes).toString("base64"), 200, {
      ...cache,
      "Content-Type": "text/plain; charset=utf-8",
    });
  }

  const text =
    entry.gzip === true
      ? new TextDecoder().decode(gunzipSync(bytes))
      : new TextDecoder().decode(bytes);
  const body = name === "manifest.webmanifest" ? rewriteManifest(text) : text;
  return c.body(body, 200, { ...cache, "Content-Type": TEXT_CONTENT_TYPE[extOf(name)] ?? entry.contentType });
}

const app = new Hono();

// 平台契约：健康检查（部署后 30s 内必须 200；资产懒加载，不等待就绪）。
app.get("/health", (c) =>
  c.json({ ok: true, app: "stack-tower", env: ctx.environment, assets: "lazy/object-storage" }),
);

// 游戏落地页（网关豁免路径；/apps/<slug>/gw 即落到这里）。
app.get("/", serveLanding);

// 静态产物回源（相对 assets_dir 的 POSIX 路径）：文本直出、二进制 base64 文本。
app.get("/api/public/assets/*", (c) => {
  const prefix = "/api/public/assets/";
  const path = c.req.path;
  const name = path.startsWith(prefix) ? path.slice(prefix.length) : path.replace(/^\/+/, "");
  return serveAsset(c, name);
});

export default app;
