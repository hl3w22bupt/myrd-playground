/**
 * perf/rate —— 通用节流器：把低频 UI（小地图/调试文案/统计计算）从每帧执行降频到配置 Hz。
 * 纯逻辑、无 DOM 依赖（Node 可直接测试）；同一主循环内调用，不新增任何定时器/循环。
 */

/** 频率（Hz）→ 最小间隔（ms） */
export function hzToIntervalMs(hz: number): number {
  return 1000 / Math.max(0.001, hz);
}

export class RateLimiter {
  private lastAtMs = -Infinity;

  constructor(private readonly minIntervalMs: number) {}

  /** 到达执行时刻返回 true 并记账；否则返回 false（调用方跳过本次工作） */
  due(nowMs: number): boolean {
    if (nowMs - this.lastAtMs >= this.minIntervalMs) {
      this.lastAtMs = nowMs;
      return true;
    }
    return false;
  }

  reset(): void {
    this.lastAtMs = -Infinity;
  }
}
