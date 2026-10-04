import { createAudioManager } from '../audio/audio-manager.js';
import { createDomInput, installMobileInputGuards } from './input.js';
import { sharedAudioContext } from '../audio/sfx.js';
import { SFX_EVENT_IDS, sfxFileStem } from '../audio/voices.js';
/** localStorage 不可用（隐私模式/无头）时的空实现 */
const nullStorage = { getItem: () => null, setItem: () => { } };
function browserStorage() {
    try {
        if (typeof localStorage !== 'undefined')
            return localStorage;
    }
    catch {
        /* 继续走空实现 */
    }
    return nullStorage;
}
/** sfx-pack 双格式择优：m4a 优先，浏览器不支持时回 ogg（详见 assets/sfx/manifest.json） */
function preferredExt() {
    try {
        const probe = document.createElement('audio');
        if (probe.canPlayType('audio/mp4') !== '')
            return 'm4a';
    }
    catch {
        /* 探测失败回 ogg */
    }
    return 'ogg';
}
/** 浏览器级 AudioManager：decodeAudioData 预解码 + localStorage 静音持久 */
export function createBrowserAudioManager() {
    const audioCtx = sharedAudioContext();
    const ext = preferredExt();
    return createAudioManager({
        ctx: audioCtx,
        storage: browserStorage(),
        now: () => performance.now(),
        loadBuffer: async (eventId) => {
            if (!audioCtx)
                return null;
            const res = await fetch(`assets/sfx/${sfxFileStem(eventId)}.${ext}`);
            if (!res.ok)
                return null; // 404/离线缺失 → 程序化合成降级，不抛错
            const data = await res.arrayBuffer();
            return await audioCtx.decodeAudioData(data);
        },
    });
}
/** 首手势解锁挂载：首个 pointerdown 内 resume（iOS 解锁纪律），一次性 */
export function mountAudioUnlock(getManager) {
    const handler = () => {
        const m = getManager();
        if (m)
            void m.unlock();
    };
    document.addEventListener('pointerdown', handler, { passive: true });
    return () => document.removeEventListener('pointerdown', handler);
}
export function createBrowserPlatform(canvas) {
    // —— M2.1 移动端输入守卫（禁长按菜单/双指缩放；CSS 面在 ui/style.ts）——
    installMobileInputGuards(document);
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
        audio: { play: () => { } }, // 旧通道保留（AudioSink 兼容）；出声一律走 audioManager
        audioManager: createBrowserAudioManager(),
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
/** sfx 事件 id 清单再导出（sw precache 生成器复用） */
export const SFX_PACK_EVENT_IDS = SFX_EVENT_IDS;
