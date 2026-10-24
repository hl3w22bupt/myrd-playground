"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWxBgmSink = createWxBgmSink;
exports.createWxShareRegistrar = createWxShareRegistrar;
exports.createWxPlatform = createWxPlatform;
const audio_manager_js_1 = require("../audio/audio-manager.js");
const bgm_js_1 = require("../audio/bgm.js");
/** wx Storage → StorageLike（同键 st.settings.muted，与 web 静音态同源） */
function wxStorage() {
    return {
        getItem: (key) => {
            try {
                const v = wx.getStorageSync(key);
                return typeof v === 'string' ? v : v == null ? null : String(v);
            }
            catch {
                return null;
            }
        },
        setItem: (key, value) => {
            try {
                wx.setStorageSync(key, value);
            }
            catch { /* 存储满/隐私态：静音态降级为会话内，不抛错 */ }
        },
    };
}
/** sfx-pack 文件 → WebAudio buffer（包内文件系统直读 + decode；失败返回 null → 程序化合成降级） */
async function loadWxBuffer(ctx, eventIdFile) {
    try {
        // 包内相对路径直读（sfx-pack 双格式：m4a 优先）
        const fs = wx.getFileSystemManager?.();
        if (!fs)
            return null;
        const data = fs.readFileSync(`assets/sfx/${eventIdFile}.m4a`);
        return await ctx.decodeAudioData(data);
    }
    catch {
        return null;
    }
}
/** BGM 环出口：InnerAudioContext(loop) —— obeyMuteSwitch 跟随系统静音键（验收口径） */
function createWxBgmSink(mutedProvider) {
    const audio = wx.createInnerAudioContext();
    audio.src = 'assets/bgm/neon-loop.m4a';
    audio.loop = true;
    audio.autoplay = false;
    audio.obeyMuteSwitch = true;
    audio.volume = 0.6;
    audio.onError(() => { });
    return {
        context: audio,
        start() { audio.volume = mutedProvider() ? 0 : 0.6; audio.play(); },
        stop() { try {
            audio.stop();
        }
        catch { /* stop 早于 ready：吞掉 */ } },
        isAudible() { return !mutedProvider(); },
    };
}
/** wx 分享注册面（onShareAppMessage 主判据 / onShareTimeline 附带项）；sessionId 只进 query（sid=），零 PII */
function createWxShareRegistrar() {
    let lastSession = null;
    return {
        lastSessionShare: () => lastSession,
        onShareAppMessage(provider) {
            wx.onShareAppMessage(() => {
                const msg = provider();
                lastSession = msg;
                return msg;
            });
        },
        onShareTimeline(provider) {
            wx.onShareTimeline(() => provider());
        },
        showShareMenu() {
            wx.showShareMenu({ withShareTicket: false });
        },
    };
}
/** wx 装配体：触摸→意图（按钮拦截经 interceptTouch）、rAF 时钟、WebAudio 音频、画布、资产 */
function createWxPlatform(opts) {
    const info = wx.getSystemInfoSync();
    // —— 帧时钟：wx 全局 requestAnimationFrame；onHide 置 paused（帧回调早退）——
    const frameHandlers = new Set();
    let paused = false;
    const loop = (now) => {
        if (!paused)
            for (const h of frameHandlers)
                h(now);
        requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    // —— 画布：逻辑坐标 480×720 letterbox 缩放（与 web 渲染口径一致，内核零感知）——
    const LOGICAL_W = 480;
    const LOGICAL_H = 720;
    const dpr = Math.min(info.pixelRatio || 1, 2);
    opts.canvas.width = Math.round(info.windowWidth * dpr);
    opts.canvas.height = Math.round(info.windowHeight * dpr);
    const ctx = opts.canvas.getContext('2d');
    const scale = Math.min((info.windowWidth * dpr) / LOGICAL_W, (info.windowHeight * dpr) / LOGICAL_H);
    const offX = (info.windowWidth * dpr - LOGICAL_W * scale) / 2;
    const offY = (info.windowHeight * dpr - LOGICAL_H * scale) / 2;
    ctx.setTransform(scale, 0, 0, scale, offX, offY);
    // —— 音频：WebAudio 桥（基础库 ≥2.19）；不可用 → 静音管理器（SFX 走程序化合成降级）——
    const audioCtx = wx.createWebAudioContext ? wx.createWebAudioContext() : null;
    const audioManager = (0, audio_manager_js_1.createAudioManager)({
        ctx: audioCtx,
        storage: wxStorage(),
        now: () => Date.now(),
        loadBuffer: async (eventId) => (audioCtx ? loadWxBuffer(audioCtx, eventId) : null),
    });
    // —— BGM 环（wx-runtime 验收面：onShow 恢复 / onHide 暂停 / 静音同源 / 首触解锁）——
    const bgm = (0, bgm_js_1.createBgmLoop)({
        sink: createWxBgmSink(() => audioManager.isMuted()),
        now: () => Date.now(),
        mutedProvider: () => audioManager.isMuted(),
    });
    // —— 输入：首触解锁 + 按钮拦截 + drop 意图；touchstart 即响应（与 web pointerdown 同口径）——
    let firstTouchDone = false;
    let intentHandler = null;
    wx.onTouchStart((e) => {
        const t = e.touches[0];
        if (!t)
            return;
        if (!firstTouchDone) {
            firstTouchDone = true;
            void audioManager.unlock();
            bgm.unlock();
            bgm.start();
            opts.onFirstTouch?.();
        }
        if (opts.interceptTouch?.(t.x * dpr, t.y * dpr))
            return; // HUD 按钮命中：不产生落块意图
        intentHandler?.({ type: 'drop' });
    });
    // —— 生命周期：onShow 恢复 / onHide 暂停（BGM 环同步，验收口径原文）——
    wx.onShow(() => {
        paused = false;
        bgm.resume();
        bgm.syncMuted();
    });
    wx.onHide(() => {
        paused = true;
        bgm.pause();
    });
    const input = {
        onIntent(handler) {
            intentHandler = handler;
            return () => { if (intentHandler === handler)
                intentHandler = null; };
        },
    };
    const clock = {
        onNextFrame(handler) {
            frameHandlers.add(handler);
            return () => frameHandlers.delete(handler);
        },
        now: () => Date.now(),
    };
    const assets = {
        loadImage: (url) => new Promise((resolve) => {
            const img = wx.createImage();
            img.onload = () => resolve(img.width > 0 ? img : null);
            img.onerror = () => resolve(null);
            img.src = url;
        }),
    };
    return {
        platform: {
            input,
            clock,
            audio: { play: () => { } }, // 旧通道兼容；出声一律走 audioManager
            audioManager,
            canvas: {
                logicalWidth: LOGICAL_W,
                logicalHeight: LOGICAL_H,
                context2d: () => ctx,
            },
            assets,
        },
        bgm,
        setPaused(p) {
            paused = p;
        },
    };
}
