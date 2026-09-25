import { createDomInput } from './input.js';
import { createWebAudioSink } from '../audio/sfx.js';
export function createBrowserPlatform(canvas) {
    // —— 时钟 ——
    const frameHandlers = new Set();
    let running = true;
    const loop = (now) => {
        if (!running)
            return;
        for (const h of frameHandlers)
            h(now);
        requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    // —— 画布：DPR 归一（逻辑坐标 480×720 不随 DPR 变化） ——
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const logicalWidth = canvas.clientWidth || 480;
    const logicalHeight = canvas.clientHeight || 720;
    canvas.width = Math.round(logicalWidth * dpr);
    canvas.height = Math.round(logicalHeight * dpr);
    const ctx = canvas.getContext('2d');
    if (ctx)
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return {
        input: createDomInput(canvas),
        clock: {
            onNextFrame(handler) {
                frameHandlers.add(handler);
                return () => frameHandlers.delete(handler);
            },
            now: () => performance.now(),
        },
        audio: createWebAudioSink(),
        assets: {
            // 资产装载：失败（404/解码错误）→ null，由表现层回程序化绘制，不抛错不刷 console.error
            loadImage: (url) => new Promise((resolve) => {
                const img = new Image();
                img.onload = () => resolve(img.naturalWidth > 0 ? img : null);
                img.onerror = () => resolve(null);
                img.src = url;
            }),
        },
        canvas: {
            logicalWidth,
            logicalHeight,
            context2d: () => {
                if (!ctx)
                    throw new Error('Canvas2D 上下文不可用');
                return ctx;
            },
        },
    };
}
