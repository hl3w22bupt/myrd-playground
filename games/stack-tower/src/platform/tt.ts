/**
 * tt 装配体（C 抖音小游戏移植轮 · spec v1.5 content.platform dy-runtime 条目落点）。
 *
 * 纪律（wx B0 判例同构）：
 *  - 只实现 platform/index.ts 的 Platform 接口（新平台 = 新增一份装配体，内核零改动）；
 *    接口平台无关 → 逻辑层零裸调用（tt 全局面仅本文件与 boot-tt.ts 消费）。
 *  - web 回归零行为变化：本文件不被 browser/main 链路 import（仅 tt/game.js 入口经
 *    boot-tt.ts 引用），web 契约面字节不动；web 契约与四判据全量重跑零漂移。
 *  - 生命周期（dy-runtime 验收口径原文）：tt.onShow 恢复 / tt.onHide 暂停 BGM 环；
 *    首触手势内完成音频解锁（acc-a7 同口径，不设豁免条款）；静音持久与 web 同源键
 *    st.settings.muted（常量单源 import，禁止字符串重抄）。
 *  - 存储（dy-runtime 验收口径原文）：tt.getStorage/setStorage 与 web 存档同源
 *    （st.settings.muted + st.meta.save.v2 带 schemaVersion），键名与读写路径零分叉——
 *    两个键名常量均单源 import（audio-manager / meta-save），本文件零字面键名。
 *  - 系统信息（dy-runtime 验收口径原文）：tt.getSystemInfoSync 取视口与安全区，
 *    仅作表现层布局输入，禁止触碰 numeric 冻结段（本文件零 import kernel/）。
 *  - 好友榜（dy-runtime 验收口径原文①，落死）：tt 云存储单通道（tt.setUserCloudStorage 写 /
 *    tt.getFriendCloudStorage 读）接入或显式降级且门禁输出可见；降级原因三选一
 *    （缺 API / 缺授权 / 非抖音容器）；本条款无「视情况」表述。主包零好友数据落点：
 *    读取行只回传分数，不写任何存储键。
 *  - tt 全局面用最小结构接口声明（项目规范：避免 any）。
 */
import type { Platform, InputSource, ClockSource, AssetHost } from './index.js';
import type { AudioBufferLike, AudioContextLike, AudioManager } from '../audio/audio-manager.js';
import { createAudioManager, MUTED_STORAGE_KEY, type StorageLike } from '../audio/audio-manager.js';
import { createBgmLoop, type BgmLoop, type BgmLoopSink } from '../audio/bgm.js';
import { META_SAVE_KEY } from '../meta/save.js';
import { installShareMenuWith, TT_SHARE_CARDS, type ShareRegistrar } from './share.js';

// ---------- tt 全局最小结构面 ----------
export interface TtTouch { x: number; y: number }
export interface TtTouchEvent { touches: TtTouch[] }
/** 安全区：仅表现层布局输入（刘海/手势条避让），零进内核零进数值面 */
export interface TtSafeArea { top: number; bottom: number; left: number; right: number; width: number; height: number }
export interface TtSystemInfo {
  windowWidth: number;
  windowHeight: number;
  pixelRatio: number;
  safeArea?: TtSafeArea;
}
export interface TtShareMessage { title: string; desc?: string; imageUrl: string; query?: string }
export interface TtCanvas { width: number; height: number; getContext(kind: '2d'): CanvasRenderingContext2D }
export interface TtImage { src: string; width: number; height: number; onload: (() => void) | null; onerror: (() => void) | null }
export interface TtInnerAudioContext {
  src: string; loop: boolean; autoplay: boolean; volume: number; obeyMuteSwitch?: boolean;
  play(): void; pause(): void; stop(): void; destroy(): void;
  onError(cb: (e: { errCode: number; errMsg: string }) => void): void;
}
export interface TtCloudKvData { key: string; value: string }
export interface TtLike {
  getSystemInfoSync(): TtSystemInfo;
  createCanvas(): TtCanvas;
  createImage(): TtImage;
  onTouchStart(cb: (e: TtTouchEvent) => void): void;
  onShow(cb: () => void): void;
  onHide(cb: () => void): void;
  /** 被动分享注册（菜单/右上角）；宿主不支持时缺省（静默降级，不抛错） */
  onShareAppMessage?(cb: () => TtShareMessage): void;
  /** 主动分享（dy-share-loop 最小闭环主判据）；宿主不支持时缺省（静默降级，保留入口） */
  shareAppMessage?(o: TtShareMessage & { success?: () => void; fail?: (e: { errMsg: string }) => void }): void;
  showShareMenu?(o: { withShareTicket?: boolean }): void;
  createInnerAudioContext(): TtInnerAudioContext;
  createWebAudioContext?(): AudioContextLike;
  getStorageSync(key: string): unknown;
  setStorageSync(key: string, value: unknown): void;
  /** spec 口径 tt.getStorage/setStorage（异步形态）：同步变体缺失时的降级通道 */
  getStorage?(o: { key: string; success: (res: { data: unknown }) => void; fail: (e: { errMsg: string }) => void }): void;
  setStorage?(o: { key: string; value: unknown; success?: () => void; fail?: (e: { errMsg: string }) => void }): void;
  /** 好友榜 tt 云存储单通道（dy-runtime 验收口径原文①）；宿主不支持时缺省 → 显式降级 */
  setUserCloudStorage?(o: { KVDataList: TtCloudKvData[]; success?: () => void; fail?: (e: { errMsg: string }) => void }): void;
  getFriendCloudStorage?(o: {
    keyList: string[];
    success?: (res: { data?: { value?: { KVDataList?: TtCloudKvData[] } }[] }) => void;
    fail?: (e: { errMsg: string }) => void;
  }): void;
}

/** tt 环境声明：仅抖音小游戏运行时存在（boot-tt.ts 动态 import 前由 game.js 注入 typeof tt 判定） */
declare const tt: TtLike;

export interface TtPlatformHandles {
  platform: Platform;
  bgm: BgmLoop;
  /** 帧循环暂停/恢复（onHide/onShow） */
  setPaused(paused: boolean): void;
  /** 安全区（仅表现层布局输入；宿主未返回 → null） */
  safeArea: TtSafeArea | null;
  /** 好友榜通道（dy-runtime 口径①）：cloud / degraded + 门禁可见输出 */
  friendRank: DyFriendRankChannel;
}

// ---------- 好友榜：tt 云存储单通道（dy-runtime 验收口径原文①） ----------
export type DyFriendRankMode = 'cloud' | 'degraded';
/** 降级原因三选一（口径落死，无第四种）：缺 API / 缺授权 / 非抖音容器 */
export type DyFriendRankReason = 'missing-api' | 'auth-denied' | 'no-tt-container';
export interface DyFriendRankChannel {
  mode: DyFriendRankMode;
  reason: DyFriendRankReason | null;
  /** 写自己的分（tt.setUserCloudStorage；宿主降级时静默 no-op，不抛错不阻塞对局） */
  writeSelfScore(score: number): void;
  /** 读好友分：行只含 index/score，零好友身份数据、零存储落点（主包零好友数据落点） */
  readFriendScores(cb: (rows: { index: number; score: number }[]) => void): void;
}

/** 门禁可见输出行（验收口径：输出不可见即打回） */
export function describeDyFriendRank(ch: Pick<DyFriendRankChannel, 'mode' | 'reason'>): string {
  return ch.mode === 'cloud' ? 'DY_FRIEND_RANK=cloud' : `DY_FRIEND_RANK=degraded reason=${ch.reason ?? 'unknown'}`;
}

/** 注入 tt 全局（null = 非抖音容器，如门禁 Node 环境）→ 可测、零真实容器依赖 */
export function resolveDyFriendRank(ttGlobal: TtLike | null): DyFriendRankChannel {
  // 非抖音容器：显式降级（门禁 Node / web 调试环境）
  if (!ttGlobal) {
    return makeDegraded('no-tt-container');
  }
  // 缺 API：宿主基础库未提供 tt 云存储读写 → 显式降级
  if (typeof ttGlobal.setUserCloudStorage !== 'function' || typeof ttGlobal.getFriendCloudStorage !== 'function') {
    return makeDegraded('missing-api');
  }
  // 接入：写自己的分 / 读好友行（运行期授权失败 → 运行期显式降级并打印，门禁可见）
  const rank: DyFriendRankChannel = {
    mode: 'cloud',
    reason: null,
    writeSelfScore(score: number): void {
      try {
        ttGlobal.setUserCloudStorage?.({
          KVDataList: [{ key: 'score', value: String(Math.max(0, Math.floor(score))) }],
          fail: () => markRuntimeDegraded(rank, 'auth-denied'),
        });
      } catch {
        markRuntimeDegraded(rank, 'auth-denied');
      }
    },
    readFriendScores(cb: (rows: { index: number; score: number }[]) => void): void {
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
      } catch {
        markRuntimeDegraded(rank, 'auth-denied');
      }
    },
  };
  return rank;
}

/** 运行期显式降级：改写通道态 + 门禁可见输出（不抛错不阻塞对局） */
function markRuntimeDegraded(rank: DyFriendRankChannel, reason: DyFriendRankReason): void {
  rank.mode = 'degraded';
  rank.reason = reason;
  console.log(describeDyFriendRank(rank));
}

function makeDegraded(reason: DyFriendRankReason): DyFriendRankChannel {
  return {
    mode: 'degraded',
    reason,
    writeSelfScore: () => {},
    readFriendScores: (cb) => cb([]),
  };
}

// ---------- 存储桥：tt Storage → StorageLike（键名常量单源，读写路径零分叉） ----------
function ttStorage(): StorageLike {
  const read = (key: string): string | null => {
    try {
      if (typeof tt.getStorageSync === 'function') {
        const v = tt.getStorageSync(key);
        return typeof v === 'string' ? v : v == null ? null : String(v);
      }
      return null; // 异步形态（tt.getStorage）在 boot-tt 预热层处理；同步缺失 → 读空（安全降级）
    } catch {
      return null;
    }
  };
  const write = (key: string, value: string): void => {
    try {
      if (typeof tt.setStorageSync === 'function') tt.setStorageSync(key, value);
      else tt.setStorage?.({ key, value, fail: () => {} }); // 异步形态兜底；失败静默（存储满/隐私态）
    } catch {
      /* 存储满/隐私态：静音态降级为会话内，不抛错 */
    }
  };
  return { getItem: read, setItem: write };
}

// ---------- BGM 环出口：InnerAudioContext(loop) ----------
export function createTtBgmSink(mutedProvider: () => boolean): BgmLoopSink & { context: TtInnerAudioContext } {
  const audio = tt.createInnerAudioContext();
  audio.src = 'assets/bgm/neon-loop.m4a';
  audio.loop = true;
  audio.autoplay = false;
  audio.obeyMuteSwitch = true; // 跟随系统静音键（宿主支持时生效；不支持时为无害赋值）
  audio.volume = 0.6;
  audio.onError(() => { /* 缺文件/解码失败：静默降级，BGM 环调度器照常记账（冒烟可见） */ });
  return {
    context: audio,
    start() { audio.volume = mutedProvider() ? 0 : 0.6; audio.play(); },
    stop() { try { audio.stop(); } catch { /* stop 早于 ready：吞掉 */ } },
    isAudible() { return !mutedProvider(); },
  };
}

// ---------- 分享注册面（dy-share-loop）：被动注册 + 主动分享最小闭环 ----------
export function createTtShareRegistrar(): ShareRegistrar & {
  lastSessionShare: () => TtShareMessage | null;
  /** 主动分享入口（tt.shareAppMessage）；宿主不支持/失败 → 静默降级，保留入口不抛错 */
  shareNow(): void;
} {
  let lastSession: TtShareMessage | null = null;
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
    onShareTimeline() {},
    showShareMenu() {
      tt.showShareMenu?.({ withShareTicket: false });
    },
    shareNow() {
      if (typeof tt.shareAppMessage !== 'function') return; // 静默降级：入口保留（HUD/排行按钮仍在）
      try {
        tt.shareAppMessage({
          ...(lastSession ?? { title: '', imageUrl: TT_SHARE_CARDS.session }),
          fail: () => { /* 分享失败：静默降级，不抛错不阻塞对局 */ },
        });
      } catch {
        /* 同上：静默降级 */
      }
    },
  };
}

// ---------- sfx-pack 文件 → WebAudio buffer（失败返回 null → 程序化合成降级） ----------
async function loadTtBuffer(ctx: AudioContextLike, eventIdFile: string): Promise<AudioBufferLike | null> {
  try {
    const fs = (tt as unknown as { getFileSystemManager?: () => { readFileSync(p: string): ArrayBuffer } }).getFileSystemManager?.();
    if (!fs) return null;
    const data = fs.readFileSync(`assets/sfx/${eventIdFile}.m4a`);
    return await ctx.decodeAudioData(data);
  } catch {
    return null;
  }
}

/** tt 装配体：触摸→意图（按钮拦截经 interceptTouch）、rAF 时钟、WebAudio 音频、画布、资产 */
export function createTtPlatform(opts: {
  canvas: TtCanvas;
  sessionId: string;
  /** 触控拦截（HUD 按钮命中返回 true = 消费，不再产生 drop 意图） */
  interceptTouch?: (x: number, y: number) => boolean;
  /** 首触回调（解锁音频 + 起 BGM 环，boot-tt 注入） */
  onFirstTouch?: () => void;
  /** tt 全局注入点：宿主运行时传 tt，测试/门禁传 null（好友榜降级可断言） */
  ttGlobal?: TtLike;
}): TtPlatformHandles {
  const info = tt.getSystemInfoSync();

  // —— 帧时钟：全局 requestAnimationFrame；onHide 置 paused（帧回调早退）——
  const frameHandlers = new Set<(nowMs: number) => void>();
  let paused = false;
  const loop = (now: number): void => {
    if (!paused) for (const h of frameHandlers) h(now);
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
  const safeArea: TtSafeArea | null = info.safeArea ?? null;

  // —— 音频：WebAudio 桥；不可用 → 静音管理器（SFX 走程序化合成降级）——
  const audioCtx: AudioContextLike | null = tt.createWebAudioContext ? tt.createWebAudioContext() : null;
  const audioManager: AudioManager = createAudioManager({
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
  let intentHandler: ((intent: { type: 'drop' }) => void) | null = null;
  tt.onTouchStart((e) => {
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
  tt.onShow(() => {
    paused = false;
    bgm.resume();
    bgm.syncMuted();
  });
  tt.onHide(() => {
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
        const img = tt.createImage();
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
    safeArea,
    friendRank,
  };
}

// ---------- 键名单源自证（防重抄漂移）：本文件零字面存档键名，全走 import 常量 ----------
export const TT_STORAGE_KEYS = { muted: MUTED_STORAGE_KEY, metaSave: META_SAVE_KEY } as const;
