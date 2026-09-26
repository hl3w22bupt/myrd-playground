import { Hono } from "hono";
import type { Context } from "hono";
import { gunzipSync } from "node:zlib";
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
 * 试玩反馈中枢页（games/game-2/export/web/feedback.html，随 assets_dir 一起上传对象存储）。
 * 零门槛真机取证入口：扫码 → 玩 1 分钟 → 评分提交（壳页右上角「反馈」角标直达本页）。
 * 资产可能是 raw 文本或 gzip+b64（平台上传策略决定），两种形态都解成 text/html 直出 ——
 * M1 网关只透传文本，绝不把 base64 原样发给浏览器。链接入口建议带尾斜杠：
 * /apps/game-2/feedback → 页面内相对路径才能落回本应用子路径。
 */
const feedbackHandler = async (c: Context) => {
  const asset = await getAsset("feedback.html");
  let html: string | null = null;
  if (asset) {
    html =
      asset.encoding === "raw"
        ? asset.body
        : gunzipSync(Buffer.from(asset.body, "base64")).toString("utf-8");
  }
  if (html === null) {
    return c.text("feedback page missing: assets_dir 未包含 feedback.html（重导出后请从 git 恢复该文件）", 404);
  }
  return c.html(html);
};
app.get("/feedback", feedbackHandler);
app.get("/feedback.html", feedbackHandler);

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
