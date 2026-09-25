/**
 * 浏览器入口：装配 DOM 骨架（画布 + HUD）→ boot(browserPlatform)。
 * 键盘 R = 重开（不作为落块意图，见 platform/browser.ts 输入过滤）。
 */
import { boot } from './app/main.js';
import { createBrowserPlatform } from './platform/browser.js';

function ensureStyle(): void {
  if (document.getElementById('stack-tower-style')) return;
  const style = document.createElement('style');
  style.id = 'stack-tower-style';
  style.textContent = `
    html,body{margin:0;height:100%;background:#1d2733;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif}
    #stage{position:relative;width:480px;height:720px;max-height:100vh}
    #stage canvas{width:100%;height:100%;display:block;touch-action:manipulation}
    #hud{position:absolute;inset:0;pointer-events:none;color:#fff;font-size:16px;font-weight:600;
         text-shadow:0 1px 2px rgba(0,0,0,.7);padding:12px 14px;box-sizing:border-box}
    .st-hud-line{margin-bottom:4px;font-variant-numeric:tabular-nums}
    .st-hud-restart{position:absolute;bottom:12px;left:50%;transform:translateX(-50%);
         pointer-events:auto;background:rgba(0,0,0,.35);color:#fff;border:1px solid rgba(255,255,255,.5);
         border-radius:6px;padding:6px 14px;font-size:14px;cursor:pointer}
  `;
  document.head.appendChild(style);
}

function main(): void {
  ensureStyle();
  let stage = document.getElementById('stage');
  if (!stage) {
    stage = document.createElement('div');
    stage.id = 'stage';
    document.body.appendChild(stage);
  }
  let canvas = document.getElementById('stack-tower-canvas') as HTMLCanvasElement | null;
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'stack-tower-canvas';
    stage.appendChild(canvas);
  }
  let hud = document.getElementById('hud');
  if (!hud) {
    hud = document.createElement('div');
    hud.id = 'hud';
    stage.appendChild(hud);
  }

  const session = boot(createBrowserPlatform(canvas));
  window.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') session.restart();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
