import { Hono } from "hono";
import { ctx } from "#apphost";
import { getAsset } from "./lib/asset-store";
import { GAME_PAGE_HTML } from "./game-page";

const app = new Hono();

// 平台契约：健康检查（编排健康探针依据，部署后 30s 内必须 200）。
// 资产走懒加载（首请求才拉取），/health 不等待资产就绪。
app.get("/health", (c) =>
  c.json({
    ok: true,
    app: "star-dust-collector",
    env: ctx.environment,
    assets: "lazy/object-storage",
  }),
);

// 游戏落地页（/ 是唯一豁免 /api 前缀护栏的业务路径）。
// 页面内所有资源走相对路径 api/public/assets/*：公网入口 /apps/game 下相对路径
// 会解析到网关子路径，绝对路径会 404/被登录墙拦下（见任务契约）。
app.get("/", (c) => c.html(GAME_PAGE_HTML));

/**
 * 游戏静态资产（底座 A：资产出 bundle，运行时从对象存储懒加载 + 内存缓存）。
 * - 壳页面请求的 `.gz.b64` 后缀是形态约定：gzip+base64 文本 → 映射回清单里的真实文件名；
 * - encoding=raw：文本资产（Godot 引导 js / audio worklet），按源 contentType 伺服；
 * - encoding=gzip+b64：二进制资产（wasm / pck）的 base64 文本。
 *   M1 网关只透传文本：octet-stream / gzip 会被 502 UNSUPPORTED_BINARY 拒绝，
 *   二进制走文本通道又会被 UTF-8 转码破坏 —— 所以二进制必须 base64 化，
 *   由浏览器端 base64 → Uint8Array → DecompressionStream('gzip') 还原后喂给引擎。
 */
app.get("/api/public/assets/:name", async (c) => {
  const name = c.req.param("name");
  const asset = await getAsset(name.replace(/\.gz\.b64$/, ""));
  if (!asset) {
    return c.text(`asset not found: ${name}`, 404);
  }
  const contentType = asset.encoding === "raw" ? asset.contentType : "text/plain; charset=utf-8";
  return c.body(asset.body, 200, {
    "Content-Type": contentType,
    "Cache-Control": "public, max-age=300",
  });
});

export default app;
