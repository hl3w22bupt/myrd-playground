/**
 * wx 装配体（B0 · spec v1.3 content.platform wx-runtime 条目落点）。
 *
 * 纪律：
 *  - 只实现 platform/index.ts 的 Platform 接口（新平台 = 新增一份装配体，内核零改动）；
 *    接口平台无关 → 抖音小游戏日后零改复用（新增 dy.ts 即可）。
 *  - web 回归零行为变化：本文件与 bgm.ts 均不被 browser/main 链路 import（仅 wx/game.js 入口经
 *    boot-wx.ts 引用），web 契约面字节不动。
 *  - 生命周期（验收口径原文）：wx.onShow 恢复 / wx.onHide 暂停（BGM 环与帧循环）；首触手势内完成
 *    音频解锁（acc-a7 同口径）；静音持久与 web 同源键 st.settings.muted；InnerAudioContext
 *    obeyMuteSwitch=true 跟随系统静音键。
 *  - wx 全局面用最小结构接口声明（项目规范：避免 any）。
 */
import type { Platform, InputSource, ClockSource, AssetHost } from './index.js';
import type { AudioBufferLike, AudioContextLike, AudioManager } from '../audio/audio-manager.js';
import { createAudioManager, type StorageLike } from '../audio/audio-manager.js';
import { createBgmLoop, type BgmLoop, type BgmLoopSink } from '../audio/bgm.js';
import { installShareMenu, type ShareRegistrar } from './share.js';

// ---------- wx 全局最小结构面 ----------
export interface WxTouch { x: number; y: number }
export interface WxTouchEvent { touches: WxTouch[] }
export interface WxSystemInfo { windowWidth: number; windowHeight: number; pixelRatio: number }
export interface WxShareMessage { title: string; imageUrl: string; query?: string }
export interface WxCanvas { width: number; height: number; getContext(kind: '2d'): CanvasRenderingContext2D }
export interface WxImage { src: string; width: number; height: number; onload: (() => void) | null; onerror: (() => void) | null }
export interface WxInnerAudioContext {
  src: string; loop: boolean; autoplay: boolean; volume: number; obeyMuteSwitch: boolean;
  play(): void; pause(): void; stop(): void; destroy(): void;
  onError(cb: (e: { errCode: number; errMsg: string }) => void): void;
}
export interface WxLike {
  getSystemInfoSync(): WxSystemInfo;
  createCanvas(): WxCanvas;
  createImage(): WxImage;
  onTouchStart(cb: (e: WxTouchEvent) => void): void;
  onShow(cb: () => void): void;
  onHide(cb: () => void): void;
  onShareAppMessage(cb: () => WxShareMessage): void;
  onShareTimeline(cb: () => WxShareMessage): void;
  showShareMenu(o: { withShareTicket?: boolean }): void;
  createInnerAudioContext(): WxInnerAudioContext;
  createWebAudioContext?(): AudioContextLike;
  getStorageSync(key: string): unknown;
  setStorageSync(key: string, value: unknown): void;
}

/** wx 环境声明：仅小游戏运行时存在（boot-wx.ts 动态 import 前由 game.js 注入 typeof wx 判定） */
declare const wx: WxLike;

export interface WxPlatformHandles {
  platform: Platform;
  bgm: BgmLoop;
  /** 帧循环暂停/恢复（onHide/onShow） */
  setPaused(paused: boolean): void;
}

/** wx Storage → StorageLike（同键 st.settings.muted，与 web 静音态同源） */
function wxStorage(): StorageLike {
  return {
    getItem: (key: string) => {
      try {
        const v = wx.getStorageSync(key);
        return typeof v === 'string' ? v : v == null ? null : String(v);
      } catch { return null; }
    },
    setItem: (key: string, value: string) => {
      try { wx.setStorageSync(key, value); } catch { /* 存储满/隐私态：静音态降级为会话内，不抛错 */ }
    },
  };
}

/** sfx-pack 文件 → WebAudio buffer（包内文件系统直读 + decode；失败返回 null → 程序化合成降级） */
async function loadWxBuffer(ctx: AudioContextLike, eventIdFile: string): Promise<AudioBufferLike | null> {
  try {
    // 包内相对路径直读（sfx-pack 双格式：m4a 优先）
    const fs = (wx as unknown as { getFileSystemManager?: () => { readFileSync(p: string): ArrayBuffer } }).getFileSystemManager?.();
    if (!fs) return null;
    const data = fs.readFileSync(`assets/sfx/${eventIdFile}.m4a`);
    return await ctx.decodeAudioData(data);
  } catch {
    return null;
  }
}

/** BGM 环出口：InnerAudioContext(loop) —— obeyMuteSwitch 跟随系统静音键（验收口径） */
export function createWxBgmSink(mutedProvider: () => boolean): BgmLoopSink & { context: WxInnerAudioContext } {
  const audio = wx.createInnerAudioContext();
  audio.src = 'assets/bgm/neon-loop.m4a';
  audio.loop = true;
  audio.autoplay = false;
  audio.obeyMuteSwitch = true;
  audio.volume = 0.6;
  audio.onError(() => { /* 缺文件/解码失败：静默降级，BGM 环调度器照常记账（冒烟可见） */ });
  return {
    context: audio,
    start() { audio.volume = mutedProvider() ? 0 : 0.6; audio.play(); },
    stop() { try { audio.stop(); } catch { /* stop 早于 ready：吞掉 */ } },
    isAudible() { return !mutedProvider(); },
  };
}

/** wx 分享注册面（onShareAppMessage 主判据 / onShareTimeline 附带项）；sessionId 只进 query（sid=），零 PII */
export function createWxShareRegistrar(): ShareRegistrar & { lastSessionShare: () => WxShareMessage | null } {
  let lastSession: WxShareMessage | null = null;
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
export function createWxPlatform(opts: {
  canvas: WxCanvas;
  sessionId: string;
  /** 触控拦截（HUD 按钮命中返回 true = 消费，不再产生 drop 意图） */
  interceptTouch?: (x: number, y: number) => boolean;
  /** 首触回调（解锁音频 + 起 BGM 环，boot-wx 注入） */
  onFirstTouch?: () => void;
}): WxPlatformHandles {
  const info = wx.getSystemInfoSync();

  // —— 帧时钟：wx 全局 requestAnimationFrame；onHide 置 paused（帧回调早退）——
  const frameHandlers = new Set<(nowMs: number) => void>();
  let paused = false;
  const loop = (now: number): void => {
    if (!paused) for (const h of frameHandlers) h(now);
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
  const audioCtx: AudioContextLike | null = wx.createWebAudioContext ? wx.createWebAudioContext() : null;
  const audioManager: AudioManager = createAudioManager({
    ctx: audioCtx,
    storage: wxStorage(),
    now: () => Date.now(),
    loadBuffer: async (eventId) => (audioCtx ? loadWxBuffer(audioCtx, eventId) : null),
  });

  // —— BGM 环（wx-runtime 验收面：onShow 恢复 / onHide 暂停 / 静音同源 / 首触解锁）——
  const bgm = createBgmLoop({
    sink: createWxBgmSink(() => audioManager.isMuted()),
    now: () => Date.now(),
    mutedProvider: () => audioManager.isMuted(),
  });

  // —— 输入：首触解锁 + 按钮拦截 + drop 意图；touchstart 即响应（与 web pointerdown 同口径）——
  let firstTouchDone = false;
  let intentHandler: ((intent: { type: 'drop' }) => void) | null = null;
  wx.onTouchStart((e) => {
    const t = e.touches[0];
    if (!t) return;
    if (!firstTouchDone) {
      firstTouchDone = true;
      void audioManager.unlock();
      bgm.unlock();
      bgm.start();
      opts.onFirstTouch?.();
    }
    if (opts.interceptTouch?.(t.x * dpr, t.y * dpr)) return; // HUD 按钮命中：不产生落块意图
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

  const input: InputSource = {
    onIntent(handler) {
      intentHandler = handler;
      return () => { if (intentHandler === handler) intentHandler = null; };
    },
  };
  const clock: ClockSource = {
    onNextFrame(handler) {
      frameHandlers.add(handler);
      return () => frameHandlers.delete(handler);
    },
    now: () => Date.now(),
  };
  const assets: AssetHost = {
    loadImage: (url: string) =>
      new Promise((resolve) => {
        const img = wx.createImage();
        img.onload = () => resolve(img.width > 0 ? (img as unknown as HTMLImageElement) : null);
        img.onerror = () => resolve(null);
        img.src = url;
      }),
  };

  return {
    platform: {
      input,
      clock,
      audio: { play: () => {} }, // 旧通道兼容；出声一律走 audioManager
      audioManager,
      canvas: {
        logicalWidth: LOGICAL_W,
        logicalHeight: LOGICAL_H,
        context2d: () => ctx,
      },
      assets,
    },
    bgm,
    setPaused(p: boolean) {
      paused = p;
    },
  };
}
