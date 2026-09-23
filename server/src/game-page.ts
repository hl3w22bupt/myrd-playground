/**
 * 自定义游戏落地页 —— 《运输船 3D · 单文件 Three.js FPS 复刻原型》（伺服于 /）。
 *
 * 与 Godot 壳（candy-crush / soccer 线）的差异：本游戏本身就是单 HTML 文件 ——
 * Three.js 引擎与全部程序化资产（Canvas 贴图 / WebAudio 合成音效）都内联在产物里，
 * 零外部资源引用（tests/singlefile.contract.mjs 契约硬断言），所以：
 *   - 没有 index.wasm / index.pck，不需要 base64 中转与 fetch monkeypatch；
 *   - 不需要引擎引导脚本注入；/ 直接把 assets_dir 里的 index.html 当响应体回出去；
 *   - 指针锁定（FPS 视角）依赖顶层文档，直出形态天然可用，无需 iframe 包裹。
 *
 * 资产仍走底座 A（apphost.toml assets_dir → 对象存储 → asset-store 懒加载）：
 *   平台侧只对 .wasm/.pck 做 gzip，.html 以 raw + text/html 上传 —— asset-store 回
 *   { encoding: "raw", body: 原文 }；这里仍保留 gzip+b64 兼容分支，防平台口径变化时
 *   把 base64 密文当页面回出去（宁可显式降级也不回坏页）。
 *
 * 降级口径：清单/资产不可得（没声明 assets_dir、资产未上传、内容异常）→ 503 + 诊断页。
 *   /health 不经过本模块，不受资产就绪度影响（平台契约：部署后 30s 内必须 200）。
 *
 * 注意：响应体是游戏自包含 HTML，无相对子资源请求 —— 不存在 Godot 壳的
 * BASE_PATH 相对路径问题；资产端点 /api/public/assets/:name 保留（自查/调试用）。
 */
import { gunzipSync } from "node:zlib";
import { getAsset } from "./lib/asset-store";

/** 落地页拉取的资产名（相对 assets_dir 的 POSIX 路径） */
const GAME_ASSET_NAME = "index.html";

export interface GamePage {
  /** HTTP 状态码：200 = 游戏页面；503 = 资产不可得（降级诊断页）。字面量联合以满足 Hono 的 StatusCode 约束 */
  status: 200 | 503;
  /** 响应 HTML */
  html: string;
}

/** 降级诊断页：不伪装成游戏，把「为什么打不开」写清楚（实例侧无 stdout 给用户看）。 */
export function fallbackPage(reason: string): string {
  const safeReason = reason.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch] ?? ch);
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>运输船 3D · 暂不可用</title>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #10181f; color: #c9d6de;
         font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  .panel { max-width: 560px; padding: 28px 32px; border: 1px solid #2f4a5a; border-radius: 10px; background: #16222b; }
  h1 { margin: 0 0 10px; font-size: 1.25rem; color: #e8b06a; letter-spacing: .06em; }
  p { margin: 6px 0; font-size: .9rem; line-height: 1.6; }
  code { color: #7fd1c0; }
</style>
</head>
<body>
<div class="panel">
  <h1>运输船 3D 暂不可用</h1>
  <p>游戏资产加载失败：${safeReason}</p>
  <p>本游戏为单文件形态，落地页直接回出 <code>assets_dir</code> 内的 <code>index.html</code>；
     请核对部署分支的 <code>apphost.toml</code> 与 <code>games/transport-ship-3d/export/web/</code> 导出产物。</p>
</div>
</body>
</html>
`;
}

/**
 * 装配落地页：从 asset-store 懒加载游戏 HTML（进程内缓存 + 并发去重由 asset-store 负责）。
 * 永不抛异常 —— 资产层故障一律落成 503 诊断页，壳进程保持可伺服 /health。
 */
export async function loadGamePage(): Promise<GamePage> {
  let asset: Awaited<ReturnType<typeof getAsset>> = null;
  try {
    asset = await getAsset(GAME_ASSET_NAME);
  } catch (err) {
    return { status: 503, html: fallbackPage(`资产读取异常：${err instanceof Error ? err.message : String(err)}`) };
  }
  if (!asset) {
    return { status: 503, html: fallbackPage(`资产清单里没有 ${GAME_ASSET_NAME}（未声明 assets_dir、清单缺失或对象丢失）`) };
  }

  let html = asset.body;
  if (asset.encoding === "gzip+b64") {
    try {
      html = gunzipSync(Buffer.from(asset.body, "base64")).toString("utf8");
    } catch {
      return { status: 503, html: fallbackPage(`${GAME_ASSET_NAME} 为 gzip+b64 形态但解压失败（传输可能被破坏）`) };
    }
  }

  const head = html.trimStart().slice(0, 64).toLowerCase();
  if (!head.startsWith("<!doctype html") && !head.startsWith("<html")) {
    return { status: 503, html: fallbackPage(`${GAME_ASSET_NAME} 内容不是 HTML 文档（encoding=${asset.encoding}）`) };
  }
  return { status: 200, html };
}
