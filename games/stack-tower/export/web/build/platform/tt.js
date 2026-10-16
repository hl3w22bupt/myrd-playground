import { createAudioManager, MUTED_STORAGE_KEY } from '../audio/audio-manager.js';
import { createBgmLoop } from '../audio/bgm.js';
import { META_SAVE_KEY } from '../meta/save.js';
import { TT_SHARE_CARDS } from './share.js';
/** 门禁可见输出行（验收口径：输出不可见即打回） */
export function describeDyFriendRank(ch) {
    return ch.mode === 'cloud' ? 'DY_FRIEND_RANK=cloud' : `DY_FRIEND_RANK=degraded reason=${ch.reason ?? 'unknown'}`;
}
/** 注入 tt 全局（null = 非抖音容器，如门禁 Node 环境）→ 可测、零真实容器依赖 */
export function resolveDyFriendRank(ttGlobal) {
    // 非抖音容器：显式降级（门禁 Node / web 调试环境）
    if (!ttGlobal) {
        return makeDegraded('no-tt-container');
    }
    // 缺 API：宿主基础库未提供 tt 云存储读写 → 显式降级
    if (typeof ttGlobal.setUserCloudStorage !== 'function' || typeof ttGlobal.getFriendCloudStorage !== 'function') {
        return makeDegraded('missing-api');
    }
    // 接入：写自己的分 / 读好友行（运行期授权失败 → 运行期显式降级并打印，门禁可见）
    const rank = {
        mode: 'cloud',
        reason: null,
        writeSelfScore(score) {
            try {
                ttGlobal.setUserCloudStorage?.({
                    KVDataList: [{ key: 'score', value: String(Math.max(0, Math.floor(score))) }],
                    fail: () => markRuntimeDegraded(rank, 'auth-denied'),
                });
            }
            catch {
                markRuntimeDegraded(rank, 'auth-denied');
            }
        },
        readFriendScores(cb) {
            try {
                ttGlobal.getFriendCloudStorage?.({
                    keyList: ['score'],
                    success: (res) => {
                        // 行只回传分数：不落点、不带好友身份数据（主包零好友数据落点）
                        const rows = (res.data ?? [])
                            .map((u) => Number(u.value?.KVDataList?.find((kv) => kv.key === 'score')?.value ?? '0'))
                            .map((score, index) => ({ index, score: Number.isFinite(score) ? score : 0 }))
                            .sort((a, b) => b.score - a.score);
                        cb(rows);
                    },
                    fail: () => markRuntimeDegraded(rank, 'auth-denied'),
                });
            }
            catch {
                markRuntimeDegraded(rank, 'auth-denied');
            }
        },
    };
    return rank;
}
/** 运行期显式降级：改写通道态 + 门禁可见输出（不抛错不阻塞对局） */
function markRuntimeDegraded(rank, reason) {
    rank.mode = 'degraded';
    rank.reason = reason;
    console.log(describeDyFriendRank(rank));
}
function makeDegraded(reason) {
    return {
        mode: 'degraded',
        reason,
        writeSelfScore: () => { },
        readFriendScores: (cb) => cb([]),
    };
}
// ---------- 存储桥：tt Storage → StorageLike（键名常量单源，读写路径零分叉） ----------
function ttStorage() {
    const read = (key) => {
        try {
            if (typeof tt.getStorageSync === 'function') {
                const v = tt.getStorageSync(key);
                return typeof v === 'string' ? v : v == null ? null : String(v);
            }
            return null; // 异步形态（tt.getStorage）在 boot-tt 预热层处理；同步缺失 → 读空（安全降级）
        }
        catch {
            return null;
        }
    };
    const write = (key, value) => {
        try {
            if (typeof tt.setStorageSync === 'function')
                tt.setStorageSync(key, value);
            else
                tt.setStorage?.({ key, value, fail: () => { } }); // 异步形态兜底；失败静默（存储满/隐私态）
        }
        catch {
            /* 存储满/隐私态：静音态降级为会话内，不抛错 */
        }
    };
    return { getItem: read, setItem: write };
}
// ---------- BGM 环出口：InnerAudioContext(loop) ----------
export function createTtBgmSink(mutedProvider) {
    const audio = tt.createInnerAudioContext();
    audio.src = 'assets/bgm/neon-loop.m4a';
    audio.loop = true;
    audio.autoplay = false;
    audio.obeyMuteSwitch = true; // 跟随系统静音键（宿主支持时生效；不支持时为无害赋值）
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
// ---------- 分享注册面（dy-share-loop）：被动注册 + 主动分享最小闭环 ----------
export function createTtShareRegistrar() {
    let lastSession = null;
    return {
        lastSessionShare: () => lastSession,
        onShareAppMessage(provider) {
            tt.onShareAppMessage?.(() => {
                const msg = provider();
                lastSession = msg;
                return msg;
            });
        },
        // 抖音无朋友圈形态：接口面保留（平台无关 ShareRegistrar），本侧零行为
        onShareTimeline() { },
        showShareMenu() {
            tt.showShareMenu?.({ withShareTicket: false });
        },
        shareNow() {
            if (typeof tt.shareAppMessage !== 'function')
                return; // 静默降级：入口保留（HUD/排行按钮仍在）
            try {
                tt.shareAppMessage({
                    ...(lastSession ?? { title: '', imageUrl: TT_SHARE_CARDS.session }),
                    fail: () => { },
                });
            }
            catch {
                /* 同上：静默降级 */
            }
        },
    };
}
// ---------- sfx-pack 文件 → WebAudio buffer（失败返回 null → 程序化合成降级） ----------
async function loadTtBuffer(ctx, eventIdFile) {
    try {
        const fs = tt.getFileSystemManager?.();
        if (!fs)
            return null;
        const data = fs.readFileSync(`assets/sfx/${eventIdFile}.m4a`);
        return await ctx.decodeAudioData(data);
    }
    catch {
        return null;
    }
}
/** tt 装配体：触摸→意图（按钮拦截经 interceptTouch）、rAF 时钟、WebAudio 音频、画布、资产 */
export function createTtPlatform(opts) {
    const info = tt.getSystemInfoSync();
    // —— 帧时钟：全局 requestAnimationFrame；onHide 置 paused（帧回调早退）——
    const frameHandlers = new Set();
    let paused = false;
    const loop = (now) => {
        if (!paused)
            for (const h of frameHandlers)
                h(now);
        requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    // —— 画布：逻辑坐标 480×720 letterbox 缩放（与 web/wx 渲染口径一致，内核零感知）——
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
    // —— 系统信息：视口 + 安全区，仅表现层布局输入（boot-tt HUD 避让），零进内核 ——
    const safeArea = info.safeArea ?? null;
    // —— 音频：WebAudio 桥；不可用 → 静音管理器（SFX 走程序化合成降级）——
    const audioCtx = tt.createWebAudioContext ? tt.createWebAudioContext() : null;
    const audioManager = createAudioManager({
        ctx: audioCtx,
        storage: ttStorage(),
        now: () => Date.now(),
        loadBuffer: async (eventId) => (audioCtx ? loadTtBuffer(audioCtx, eventId) : null),
    });
    // —— BGM 环（dy-runtime 验收面：onShow 恢复 / onHide 暂停 / 静音同源 / 首触解锁）——
    const bgm = createBgmLoop({
        sink: createTtBgmSink(() => audioManager.isMuted()),
        now: () => Date.now(),
        mutedProvider: () => audioManager.isMuted(),
    });
    // —— 好友榜通道（dy-runtime 口径①）：注入 tt 全局，宿主/门禁双档可断言 ——
    const friendRank = resolveDyFriendRank(opts.ttGlobal ?? null);
    // —— 输入：首触解锁 + 按钮拦截 + drop 意图；touchstart 即响应（与 web pointerdown 同口径）——
    let firstTouchDone = false;
    let intentHandler = null;
    tt.onTouchStart((e) => {
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
    tt.onShow(() => {
        paused = false;
        bgm.resume();
        bgm.syncMuted();
    });
    tt.onHide(() => {
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
            const img = tt.createImage();
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
        safeArea,
        friendRank,
    };
}
// ---------- 键名单源自证（防重抄漂移）：本文件零字面存档键名，全走 import 常量 ----------
export const TT_STORAGE_KEYS = { muted: MUTED_STORAGE_KEY, metaSave: META_SAVE_KEY };
