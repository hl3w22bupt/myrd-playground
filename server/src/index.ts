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
    app: "light-path-labyrinth",
    env: ctx.environment,
    assets: "lazy/object-storage",
  }),
);

// 游戏落地页（/ 是唯一豁免 /api 前缀护栏的业务路径）。
// 页面内所有资源走相对路径 api/public/assets/*：公网入口 /apps/game-4 下相对路径
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
  const wantsRawName = !name.endsWith(".gz.b64");
  const asset = await getAsset(name.replace(/\.gz\.b64$/, ""));
  if (!asset) {
    return c.text(`asset not found: ${name}`, 404);
  }
  // raw 名直取（验收/直连口径）：gzip 资产以清单真实 contentType 伺服，满足「.wasm 的
  // Content-Type 必须为 application/wasm」部署硬约束 —— M1 网关二进制黑名单只拦
  // octet-stream/pdf/zip/gzip 等，application/wasm 可透传。body 仍为 base64 文本
  // （网关 res.text() 文本通道会破坏原始二进制），浏览器消费路径不变（.gz.b64 + 端内解压）。
  // 其余 gzip 资产（pck = octet-stream，会被网关 502）维持 text/plain 形态。
  const GATEWAY_PASSABLE_GZIP_CT = /^application\/wasm$/;
  const contentType =
    asset.encoding === "raw"
      ? asset.contentType
      : wantsRawName && GATEWAY_PASSABLE_GZIP_CT.test(asset.contentType)
        ? asset.contentType
        : "text/plain; charset=utf-8";
  return c.body(asset.body, 200, {
    "Content-Type": contentType,
    "Cache-Control": "public, max-age=300",
  });
});

export default app;
