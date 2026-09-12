import { Hono } from "hono";
import { ctx } from "#apphost";
import { getAsset, assetStoreConfigured } from "./lib/asset-store.js";
import { renderShellPage } from "./shell-page.js";

const app = new Hono();

// 平台契约：健康检查（编排健康探针依据，部署后 30s 内必须 200）
app.get("/health", (c) =>
  c.json({ ok: true, env: ctx.environment, app: "soccer" }),
);

// 游戏壳页面（/ 是唯一豁免 /api 前缀护栏的业务路径）
app.get("/", (c) => c.html(renderShellPage()));

// 公开元信息：壳页面用它探测资产通道是否就绪（assetStore=false 时给出可读降级提示）
app.get("/api/public/info", (c) =>
  c.json({
    app: "soccer",
    title: "Soccer · 11 人制足球",
    engine: "Godot 4.6 (Web, nothreads)",
    assetStore: assetStoreConfigured,
  }),
);

// 资产通道（平台模板 asset-store 懒加载）：
//   gzip+b64 资产（wasm/pck）→ text/plain 的 base64，壳端 DecompressionStream 解压；
//   raw 文本资产（js/html/…）→ 按 contentType 原文直出；
//   M1 网关只透传文本响应，二进制必须以 base64 文本回传。
app.get("/api/public/assets/:name", async (c) => {
  const name = c.req.param("name");
  const a = await getAsset(name);
  if (!a) return c.notFound();
  if (a.encoding === "gzip+b64") {
    return c.newResponse(a.body, 200, {
      "Content-Type": "text/plain; charset=utf-8",
    });
  }
  return c.newResponse(a.body, 200, { "Content-Type": a.contentType });
});

export default app;
