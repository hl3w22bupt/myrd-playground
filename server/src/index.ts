import { Hono } from "hono";
import { ctx } from "#apphost";
import { ASSET_MAP, type InlineAsset } from "./generated/assets.generated";
import { GAME_PAGE_HTML } from "./game-page";

const app = new Hono();

// 基线 §七 契约：健康自检 → 200 + {status:"ok",version}（QA BUG-7 修复项）。
// 基线路径为静态 /healthz，但平台部署护栏强制业务路由必须位于 /api/*（仅 /health 豁免），
// 故落位 /api/healthz —— 语义不变（200 + {status,version}），基线文档偏差待回填。
const APP_VERSION = "2.2.0-touch-viewport";
app.get("/api/healthz", (c) => c.json({ status: "ok", version: APP_VERSION }));

// 平台契约：健康检查（编排健康探针依据，部署后 30s 内必须 200）
app.get("/health", (c) =>
  c.json({
    ok: true,
    app: "ai-girlfriend-siege",
    game: "我被ai女友包围了",
    env: ctx.environment,
    assets: Object.keys(ASSET_MAP).length,
    version: APP_VERSION,
  }),
);

// 游戏落地页（/ 是唯一豁免 /api 前缀护栏的业务路径）。
// 页面内所有资源走相对路径 api/public/assets/*：公网入口 /apps/ai 下相对路径
// 会解析到网关子路径，绝对路径会 404/被登录墙拦下（见任务契约）。
app.get("/", (c) => c.html(GAME_PAGE_HTML));

/**
 * 游戏静态资产（构建期内联进 bundle，运行时纯内存伺服）。
 * - encoding=raw：文本资产（Godot 引导 js / audio worklet），以 text/javascript 伺服；
 * - encoding=gzipB64：二进制资产（wasm / pck）经 gzip+base64 后的 ASCII 文本。
 *   M1 网关只透传文本：octet-stream 会被 502 UNSUPPORTED_BINARY 拒绝，
 *   二进制走文本通道又会被 UTF-8 转码破坏 —— 所以二进制必须 base64 化，
 *   由浏览器端 base64 → Uint8Array → DecompressionStream('gzip') 还原后喂给引擎。
 */
app.get("/api/public/assets/:name", (c) => {
  const name = c.req.param("name");
  const asset: InlineAsset | undefined = ASSET_MAP[name];
  if (!asset) {
    return c.text(`asset not found: ${name}`, 404);
  }
  const contentType = asset.encoding === "raw" ? asset.contentType : "text/plain; charset=utf-8";
  return c.body(asset.data, 200, {
    "Content-Type": contentType,
    "Cache-Control": "public, max-age=300",
  });
});

export default app;
