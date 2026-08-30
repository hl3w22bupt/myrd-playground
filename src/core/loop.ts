/**
 * core/loop —— fixed timestep 双循环（ADR-003）：rAF 可变渲染 + 50Hz 固定逻辑 + 插值。
 * 浏览器与 Node 同实现；catchUp 超限丢弃积压（防死亡螺旋，宁降速不雪崩）。
 */

import { MAX_CATCH_UP_TICKS, TICK_MS } from '../content/constants';
import type { PlayerIntent } from './types';

export class FixedLoop {
  private accumulator = 0;
  private droppedTicks = 0;
  private pending: PlayerIntent[] = [];

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
    const intents = [...this.pending, ...frameIntents];
    this.pending = [];

    let steps = 0;
    while (this.accumulator >= this.tickMs) {
      if (steps >= MAX_CATCH_UP_TICKS) {
        this.droppedTicks += Math.floor(this.accumulator / this.tickMs) - steps;
        this.accumulator = 0;
        break;
      }
      this.tickFn(steps === 0 ? intents : []);
      this.accumulator -= this.tickMs;
      steps += 1;
    }

    if (steps === 0) this.pending = intents;
    return Math.min(0.999, Math.max(0, this.accumulator / this.tickMs));
  }

  /** 丢弃的积压 tick 数（调试 HUD 观测用） */
  get dropped(): number {
    return this.droppedTicks;
  }

  reset(): void {
    this.accumulator = 0;
    this.pending = [];
  }
}

export { TICK_MS };
