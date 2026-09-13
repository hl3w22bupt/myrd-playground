/**
 * core/loop —— fixed timestep 双循环（ADR-003）：rAF 可变渲染 + 50Hz 固定逻辑 + 插值。
 * 浏览器与 Node 同实现；catchUp 超限丢弃积压（防死亡螺旋，宁降速不雪崩）。
 */

import { MAX_CATCH_UP_TICKS, TICK_MS } from '../content/constants';
import type { PlayerIntent } from './types';

export class FixedLoop {
  private accumulator = 0;
  private droppedTicks = 0;
  /** 尚未被任何逻辑 tick 消费的意图（跨帧保留） */
  private pending: PlayerIntent[] = [];
  /** 合并缓冲：复用同一数组，避免每帧 [...] 展开 造成分配 */
  private merged: PlayerIntent[] = [];
  /** 空意图数组（传给 tickFn 的常量，避免每 tick 新建） */
  private static readonly EMPTY: PlayerIntent[] = [];

  constructor(
    private readonly tickFn: (intents: PlayerIntent[]) => void,
    private readonly tickMs: number = TICK_MS,
  ) {}

  /**
   * 推进一帧（dtMs 为真实耗时）。意图只在第一个逻辑 tick 消费一次，避免同帧输入重复生效。
   * @returns 渲染插值 alpha ∈ [0,1)
   */
  advance(dtMs: number, frameIntents: PlayerIntent[] = []): number {
    this.accumulator += Math.min(Math.max(dtMs, 0), 250);

    // 合并「上帧未消费 + 本帧」到复用缓冲（零分配）
    const merged = this.merged;
    const pending = this.pending;
    for (let i = 0; i < pending.length; i++) merged.push(pending[i]);
    for (let i = 0; i < frameIntents.length; i++) merged.push(frameIntents[i]);
    pending.length = 0;

    let steps = 0;
    while (this.accumulator >= this.tickMs) {
      if (steps >= MAX_CATCH_UP_TICKS) {
        this.droppedTicks += Math.floor(this.accumulator / this.tickMs) - steps;
        this.accumulator = 0;
        break;
      }
      this.tickFn(steps === 0 ? merged : FixedLoop.EMPTY);
      this.accumulator -= this.tickMs;
      steps += 1;
    }

    if (steps === 0) {
      // 本帧没有任何逻辑 tick：意图留待下帧（交换缓冲，零分配）
      this.pending = merged;
      this.merged = pending;
    } else {
      merged.length = 0;
    }
    return Math.min(0.999, Math.max(0, this.accumulator / this.tickMs));
  }

  /** 丢弃的积压 tick 数（调试 HUD 观测用） */
  get dropped(): number {
    return this.droppedTicks;
  }

  reset(): void {
    this.accumulator = 0;
    this.pending.length = 0;
    this.merged.length = 0;
  }
}

export { TICK_MS };
