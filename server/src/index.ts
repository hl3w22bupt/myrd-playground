import { Hono } from "hono";
import { ctx, vars } from "#apphost";
import { getAsset, assetStoreConfigured } from "./lib/asset-store.js";

const app = new Hono();

// 平台契约：健康检查（编排健康探针依据，部署后 30s 内必须 200）
app.get("/health", (c) => c.json({ ok: true, env: ctx.environment, assets: assetStoreConfigured }));

// 落地页 = 游戏本体（/ 是唯一豁免 /api 前缀护栏的业务路径）。
// 游戏为单文件构建产物（index.html，零外部资源），经平台资产通道懒加载后文本直出。
app.get("/", async (c) => {
  const a = await getAsset("index.html");
  if (!a) {
    return c.html(
      `<!DOCTYPE html><html lang="zh-CN"><meta charset="utf-8"><title>soho-ecom</title>
<p>游戏资产未就绪（未声明 assets_dir 或清单缺 index.html）。请从仓库根重新部署：
<code>node tools/build.mjs</code> 产出 export/web/index.html 后发起 apphost 部署。</p>`,
    );
  }
  // 资产为文本（text/html）→ raw 直出；gzip+b64 形态理论上只给 .wasm/.pck，若出现则回 base64 文本由前端解压
  if (a.encoding === "gzip+b64") {
    return new Response(a.body, { headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  return c.html(a.body);
});

// 公开诊断口：/api/public/* 无需登录
app.get("/api/public/info", (c) =>
  c.json({ app: "soho-ecom", title: "白手起家·跨境电商版 M1", assetStore: assetStoreConfigured, logLevel: vars.LOG_LEVEL ?? null }),
);

// 受保护接口：/api/* 由平台网关强制登录
app.get("/api/whoami", (c) => c.json({ user: c.req.header("x-myrd-user-id") ?? null }));

export default app;
