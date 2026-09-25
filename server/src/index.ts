import { Hono } from "hono";
import { gunzipSync } from "node:zlib";
import { ctx } from "#apphost";
import { getAsset, assetStoreConfigured } from "./lib/asset-store";
import { FALLBACK_PAGE_HTML } from "./game-page";

/**
 * Stack Tower（叠塔）AppHost 壳 —— games/stack-tower 专属（M2.1「有声可装」部署线）。
 *
 * 与糖果线壳的差异：本游戏是 TS + Canvas2D 静态产物（games/stack-tower/export/web），
 * assets_dir 由平台原样上传（清单 key = 目录内相对路径），壳按同形路径回源即可：
 *   - /            与 /gw             → index.html（落地页，相对路径资源自解析）
 *   - /build/*、/assets/*、/sw.js、/manifest.webmanifest … → 同名资产回源（通配兜底）
 *   - /api/public/assets/*                            → 兼容糖/足球线的显式资产路由
 * 二进制资产（png / m4a / ogg）平台以 gzip+b64 文本通道存储，壳在服务端解压还原真实字节，
 * 浏览器拿到原生二进制（Image / decodeAudioData 都无法走客户端 base64 补丁）。
 */

const EXT_CONTENT_TYPE: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".m4a": "audio/mp4",
  ".ogg": "audio/ogg",
};

const contentTypeFor = (name: string, fallback: string): string => {
  const dot = name.lastIndexOf(".");
  const ext = dot >= 0 ? name.slice(dot).toLowerCase() : "";
  return EXT_CONTENT_TYPE[ext] ?? fallback ?? "application/octet-stream";
};

/** 资产回源：raw 文本直出；gzip+b64 服务端解压为真实二进制。未命中 → 404。 */
async function serveAsset(c: any, name: string) {
  const asset = await getAsset(name);
  if (!asset) return c.text(`asset not found: ${name}`, 404);
  const contentType = contentTypeFor(name, asset.contentType);
  const headers = { "Content-Type": contentType, "Cache-Control": "public, max-age=300" };
  if (asset.encoding === "raw") return c.body(asset.body, 200, headers);
  const bytes = gunzipSync(Buffer.from(asset.body, "base64"));
  return c.body(new Uint8Array(bytes), 200, headers);
}

/** 路径 → 资产名：剥 /gw 前缀（网关会 308 掉尾斜杠，页面挂在无尾斜杠段上） */
const pathToAssetName = (path: string): string => {
  let p = path.split("?")[0];
  if (p === "/gw") return "index.html";
  if (p.startsWith("/gw/")) p = p.slice(3);
  if (p.startsWith("/api/public/assets/")) p = p.slice("/api/public/assets".length);
  return p.replace(/^\/+/, "");
};

const app = new Hono();

// 平台契约：健康检查（部署后 30s 内必须 200；资产懒加载，不等待就绪）。
app.get("/health", (c) =>
  c.json({ ok: true, app: "stack-tower", env: ctx.environment, assets: "lazy/object-storage" }),
);

// 落地页（网关会把 /apps/<slug>/ 与 /gw/ 归一成无尾斜杠，两条都收）。
const serveIndex = async (c: any) => {
  if (!assetStoreConfigured) return c.html(FALLBACK_PAGE_HTML);
  const asset = await getAsset("index.html");
  if (!asset || asset.encoding !== "raw") return c.html(FALLBACK_PAGE_HTML);
  return c.body(asset.body, 200, { "Content-Type": "text/html; charset=utf-8" });
};
app.get("/", serveIndex);
app.get("/gw", serveIndex);

// 其余一律按资产名回源（/build/*、/assets/*、/sw.js、/manifest.webmanifest、/api/public/assets/*）。
app.get("*", (c) => serveAsset(c, pathToAssetName(c.req.path)));

export default app;
