/**
 * app/frame —— 渲染主循环唯一驱动器（FrameDriver）。
 *
 * 目标（性能小步：渲染统一为单循环）：
 * - 全部逐帧工作收敛到同一个 rAF 循环：输入 → 50Hz 固定逻辑 → 零分配快照 → 3D 渲染 →
 *   HUD → 小地图 → 背包 → 性能采样/画质自适应 → 结算；模块内部只做节流，不另起定时器/循环。
 * - 每帧恰好注册一次 rAF（rafCount === frameCount），循环可注入（Node 测试/基准无需浏览器）。
 * - 驱动器自身零逐帧分配（意图缓冲复用，不展开新数组）。
 *
 * 依赖边界：本文件不 import three（引擎边界 lint 红线），视图以结构化接口注入。
 */

import type { GameEvent, MatchHandle, PlayerIntent, WorldSnapshot } from '../core/types';
import type { FixedLoop } from '../core/loop';
import type { PerfSampler } from '../perf/sampler';
import { hzToIntervalMs, RateLimiter } from '../perf/rate';
import { DEBUG_TEXT_HZ } from '../content/render';

/** 表现层视图的结构化最小接口（避免 app 层依赖 three 类型） */
export interface FrameViewLike {
  render(snap: WorldSnapshot, events: GameEvent[], alpha: number, dtSec: number): void;
  autoTune(fps: number, nowMs: number): string | null;
  readonly drawCalls: number;
  readonly qualityLevel: string;
}

export interface FrameHudLike {
  update(snap: WorldSnapshot): void;
  consumeEvents(events: GameEvent[], match: MatchHandle): void;
  setDebug(text: string): void;
}

export interface FrameMinimapLike {
  update(snap: WorldSnapshot, nowMs: number): boolean;
}

export interface FrameInventoryLike {
  readonly visible: boolean;
  render(): void;
}

export interface FrameInputLike {
  consume(): PlayerIntent[];
}

export type FrameRequestFn = (cb: (t: number) => void) => number;
export type FrameCancelFn = (id: number) => void;

export interface FrameDriverDeps {
  match: MatchHandle;
  loop: FixedLoop;
  sampler: PerfSampler;
  input: FrameInputLike;
  hud: FrameHudLike;
  minimap: FrameMinimapLike;
  inventory: FrameInventoryLike;
  /** WebGL 不可用降级时为 null（仿真与 HUD 仍运行） */
  view: FrameViewLike | null;
  /** 对局结束（仅触发一次） */
  onEnded?: (match: MatchHandle) => void;
  raf: FrameRequestFn;
  caf: FrameCancelFn;
}

const FIRST_FRAME_DT_MS = 1000 / 60;

export class FrameDriver {
  private rafId = 0;
  private running = false;
  private lastT = 0;
  private frames = 0;
  private rafCount = 0;
  private endedSent = false;

  private readonly pendingIntents: PlayerIntent[] = [];
  private readonly frameIntents: PlayerIntent[] = [];
  private readonly debugLimiter = new RateLimiter(hzToIntervalMs(DEBUG_TEXT_HZ));

  constructor(private readonly deps: FrameDriverDeps) {}

  get isRunning(): boolean {
    return this.running;
  }

  /** 已渲染帧数 */
  get frameCount(): number {
    return this.frames;
  }

  /** rAF 注册次数（单循环断言：每帧恰好一次） */
  get rafSubscriptionCount(): number {
    return this.rafCount;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastT = 0;
    this.schedule();
  }

  stop(): void {
    this.running = false;
    if (this.rafId !== 0) {
      this.deps.caf(this.rafId);
      this.rafId = 0;
    }
  }

  /** 推进一帧（真实 rAF 与测试/基准共用同一路径） */
  stepFrame(t: number): void {
    const d = this.deps;
    const dt = this.lastT === 0 ? FIRST_FRAME_DT_MS : Math.min(100, t - this.lastT);
    this.lastT = t;
    d.sampler.frame(t);

    // 1) 输入 → 意图（复用缓冲，逐帧零分配）
    const frameIntents = this.frameIntents;
    frameIntents.length = 0;
    const pending = this.pendingIntents;
    for (let i = 0; i < pending.length; i++) frameIntents.push(pending[i]);
    pending.length = 0;
    const consumed = d.input.consume();
    for (let i = 0; i < consumed.length; i++) frameIntents.push(consumed[i]);

    // 2) 固定步进推进仿真（意图只在第一个逻辑 tick 消费）
    const alpha = d.loop.advance(dt, frameIntents);

    // 3) 事件与零分配快照（快照对象恒定，仅本帧内有效）
    const events = d.match.drainEvents();
    const snap = d.match.snapshotReusable ? d.match.snapshotReusable() : d.match.snapshot();

    // 4) 表现层（渲染统一在本循环内完成；低频 UI 由各模块按配置 Hz 节流）
    if (d.view) d.view.render(snap, events, alpha, dt / 1000);
    d.hud.update(snap);
    d.hud.consumeEvents(events, d.match);
    d.minimap.update(snap, t);
    if (d.inventory.visible) d.inventory.render();

    // 5) 性能采样 + 画质自适应（统计与调试文案降频）
    const sample = d.sampler.sample();
    if (d.view) {
      const changed = d.view.autoTune(sample.fps, t);
      if (changed) d.hud.setDebug(`画质自动调整为 ${changed}`);
      else if (this.debugLimiter.due(t)) {
        d.hud.setDebug(
          `FPS ${sample.fps.toFixed(0)} · 1%低 ${sample.low1Fps.toFixed(0)} · p95 ${sample.p95FrameMs.toFixed(1)}ms · ` +
          `draw ${d.view.drawCalls} · 画质 ${d.view.qualityLevel}` +
          (sample.heapMb !== null ? ` · heap ${sample.heapMb.toFixed(0)}MB` : ''),
        );
      }
    }

    this.frames += 1;

    // 6) 结算（只触发一次）
    if (!this.endedSent && d.match.status() === 'ended') {
      this.endedSent = true;
      d.onEnded?.(d.match);
    }
  }

  private schedule(): void {
    this.rafCount += 1;
    this.rafId = this.deps.raf(this.onFrame);
  }

  private onFrame = (t: number): void => {
    if (!this.running) return;
    this.stepFrame(t);
    this.schedule();
  };
}
