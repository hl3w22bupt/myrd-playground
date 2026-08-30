/**
 * perf/sampler —— 帧率/帧时间/内存采样（AC1 性能数据来源）。
 * 纯 TS，无 three 依赖；供调试 HUD 与画质自动降档消费。
 */

export interface PerfSample {
  fps: number;
  /** 1% 最低帧率（帧时间 99 分位的倒数） */
  low1Fps: number;
  /** p95 帧时间（ms） */
  p95FrameMs: number;
  /** JS Heap（MB），不可用时为 null */
  heapMb: number | null;
  /** 平均帧时间（ms） */
  avgFrameMs: number;
}

const WINDOW = 300; // 约 5s @60fps

export class PerfSampler {
  private frames: number[] = [];
  private lastNow = 0;
  private heapBaseline: number | null = null;

  /** 每帧调用一次，t 为 performance.now() */
  frame(t: number): void {
    if (this.lastNow !== 0) {
      const dt = t - this.lastNow;
      if (dt > 0 && dt < 1000) {
        this.frames.push(dt);
        if (this.frames.length > WINDOW) this.frames.shift();
      }
    }
    this.lastNow = t;
  }

  sample(): PerfSample {
    const frames = this.frames;
    if (frames.length === 0) {
      return { fps: 0, low1Fps: 0, p95FrameMs: 0, heapMb: this.readHeap(), avgFrameMs: 0 };
    }
    const sorted = [...frames].sort((a, b) => a - b);
    const avg = frames.reduce((s, v) => s + v, 0) / frames.length;
    const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
    const p99 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99))];
    const heap = this.readHeap();
    if (heap !== null && this.heapBaseline === null) this.heapBaseline = heap;
    return {
      fps: 1000 / avg,
      low1Fps: p99 > 0 ? 1000 / p99 : 0,
      p95FrameMs: p95,
      avgFrameMs: avg,
      heapMb: heap,
    };
  }

  get heapGrowthRatio(): number | null {
    const heap = this.readHeap();
    if (heap === null || this.heapBaseline === null || this.heapBaseline === 0) return null;
    return heap / this.heapBaseline;
  }

  private readHeap(): number | null {
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    if (!mem) return null;
    return mem.usedJSHeapSize / (1024 * 1024);
  }
}
