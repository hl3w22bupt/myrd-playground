/**
 * 浏览器入口：装配 DOM 骨架（画布 + HUD）→ boot(browserPlatform)。
 * M2.1：样式真源走 ui/style.ts（safe-area / touch-action）；首手势解锁音频；
 *       视口宽高比驱动横屏遮罩（激活即暂停）；R 键重开在 app/main 内带 source 载荷。
 */
import { boot } from './app/main.js';
import { createBrowserPlatform, mountAudioUnlock } from './platform/browser.js';
import { STAGE_STYLE } from './ui/style.js';
function ensureStyle() {
    if (document.getElementById('stack-tower-style'))
        return;
    const style = document.createElement('style');
    style.id = 'stack-tower-style';
    style.textContent = STAGE_STYLE;
    document.head.appendChild(style);
}
function main() {
    ensureStyle();
    let stage = document.getElementById('stage');
    if (!stage) {
        stage = document.createElement('div');
        stage.id = 'stage';
        document.body.appendChild(stage);
    }
    let canvas = document.getElementById('stack-tower-canvas');
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
    const platform = createBrowserPlatform(canvas);
    const session = boot(platform);
    // M2.1：iOS 首手势解锁（pointerdown 一次性）；R 键重开已在 app/main 挂 source 载荷
    mountAudioUnlock(() => platform.audioManager ?? null);
    // M2.1：视口宽高比 → 横屏遮罩（激活即暂停在 boot 内消费）
    const syncViewport = () => {
        session.setViewport(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', syncViewport);
    syncViewport();
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
}
else {
    main();
}
