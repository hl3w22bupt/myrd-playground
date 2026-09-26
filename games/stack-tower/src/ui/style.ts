/**
 * 样式真源（M2.1）— main 注入页面的唯一 CSS 模板；acc-m1 / acc-m2 的断言点。
 * 移动端纪律：
 *  - 安全区：env(safe-area-inset-*) 经 CSS 变量换算 #hud padding（真机清单另附，见 qa-m21）；
 *  - 触控：touch-action: manipulation 禁双击缩放；user-select/-webkit-touch-callout 禁长按选择；
 *  - 横屏遮罩：全屏居中文案。
 * 纯字符串常量：Node 可直接 import 断言（不触碰 document）。
 */

export const STAGE_STYLE = `
    :root{--st-safe-top:env(safe-area-inset-top,0px);--st-safe-right:env(safe-area-inset-right,0px);
          --st-safe-bottom:env(safe-area-inset-bottom,0px);--st-safe-left:env(safe-area-inset-left,0px)}
    html,body{margin:0;height:100%;background:#1d2733;display:flex;align-items:center;justify-content:center;
              font-family:system-ui,sans-serif;overflow:hidden;
              -webkit-user-select:none;user-select:none;-webkit-touch-callout:none;overscroll-behavior:none}
    #stage{position:relative;width:480px;height:720px;max-height:100vh;touch-action:manipulation}
    #stage canvas{width:100%;height:100%;display:block;touch-action:manipulation}
    #hud{position:absolute;inset:0;pointer-events:none;color:#fff;font-size:16px;font-weight:600;
         text-shadow:0 1px 2px rgba(0,0,0,.7);box-sizing:border-box;
         padding:calc(12px + var(--st-safe-top)) calc(14px + var(--st-safe-right))
                 calc(12px + var(--st-safe-bottom)) calc(14px + var(--st-safe-left))}
    .st-hud-line{margin-bottom:4px;font-variant-numeric:tabular-nums}
    .st-hud-actions{position:absolute;bottom:calc(12px + var(--st-safe-bottom));left:0;right:0;
         display:flex;gap:8px;justify-content:center;align-items:center}
    .st-hud-restart,.st-hud-mute{pointer-events:auto;background:rgba(0,0,0,.35);color:#fff;
         border:1px solid rgba(255,255,255,.5);border-radius:6px;padding:6px 14px;font-size:14px;cursor:pointer;
         touch-action:manipulation}
    .st-rotate-overlay{position:fixed;inset:0;z-index:50;display:none;align-items:center;justify-content:center;
         background:rgba(9,14,20,.92);color:#fff;font-size:20px;font-weight:700;letter-spacing:.1em;
         touch-action:manipulation}
    .st-fps-overlay{position:fixed;left:8px;bottom:8px;z-index:60;color:#7dff9b;background:rgba(0,0,0,.55);
         font:12px/1.5 ui-monospace,monospace;padding:4px 8px;border-radius:4px;white-space:pre;
         pointer-events:none}
  `;
