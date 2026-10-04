/**
 * Stack Tower 降级落地页（伺服于 / 与 /gw 的兜底形态）。
 *
 * 正常路径：壳从资产通道懒加载 games/stack-tower/export/web 的 index.html 原文直出。
 * 仅当资产通道未配置 / 清单缺失（APPHOST_ASSET_* env 未注入、对象丢失）时展示本页，
 * 用于把「部署串线 / 静态产物缺失」和正常游戏页面区分开——本页出现即属部署异常。
 */
export const FALLBACK_PAGE_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>Stack Tower（叠塔）</title>
<style>
  html, body { margin: 0; height: 100%; background: #1d2733; color: #dfe7ef;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    display: flex; align-items: center; justify-content: center; text-align: center; }
  .card { max-width: 30rem; padding: 2rem; line-height: 1.7; }
  h1 { font-size: 1.4rem; margin: 0 0 .6rem; }
  code { color: #7ae0c3; }
</style>
</head>
<body>
  <div class="card">
    <h1>Stack Tower（叠塔）</h1>
    <p>游戏静态产物未能从资产通道加载（资产清单缺失或未注入）。</p>
    <p>请重新发起部署，确认 <code>apphost.toml</code> 的 <code>assets_dir</code> 指向
    <code>games/stack-tower/export/web</code> 后重试。</p>
  </div>
</body>
</html>
`;
