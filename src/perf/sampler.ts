/**
 * perf/sampler —— 帧率/帧时间/内存采样（AC1 性能数据来源）。
 * 纯 TS，无 three 依赖；供调试 HUD 与画质自动降档消费。
 *
 * 性能改造（本小步）：
 * - 帧时间窗口改环形缓冲：去掉每帧 Array.prototype.shift（O(n) 搬移）；
 * - 统计计算（排序/均值）按 PERF_SAMPLE_HZ 节流，并在复用缓冲上原地排序，
 *   去掉每帧 `[...frames].sort()` 的数组分配与 O(n log n) 重复计算；
 * - 帧间隔之外不产生任何分配。
 */

import { PERF_SAMPLE_HZ, PERF_WINDOW_FRAMES } from '../content/render';

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

const EMPTY_SAMPLE: PerfSample = { fps: 0, low1Fps: 0, p95FrameMs: 0, heapMb: null, avgFrameMs: 0 };

export class PerfSampler {
  /** 环形缓冲：固定容量，覆写最旧样本 */
  private readonly ring: Float64Array;
  private ringCount = 0;
  private ringHead = 0; // 下一写入位
  private framesSeen = 0;

  private lastNow = 0;
  private heapBaseline: number | null = null;

  /** 统计节流 */
  private readonly sampleIntervalMs: number;
  private lastSampleAtMs = -Infinity;
  private lastResult: PerfSample = { ...EMPTY_SAMPLE };

  /** 复用排序缓冲（原地排序，零分配） */
  private sortBuf: Float64Array;

  constructor(windowFrames: number = PERF_WINDOW_FRAMES, sampleHz: number = PERF_SAMPLE_HZ) {
    this.ring = new Float64Array(Math.max(1, windowFrames));
    this.sortBuf = new Float64Array(Math.max(1, windowFrames));
    this.sampleIntervalMs = 1000 / Math.max(0.1, sampleHz);
  }

  /** 每帧调用一次，t 为 performance.now() */
  frame(t: number): void {
    if (this.lastNow !== 0) {
      const dt = t - this.lastNow;
      if (dt > 0 && dt < 1000) {
        this.ring[this.ringHead] = dt;
        this.ringHead = (this.ringHead + 1) % this.ring.length;
        if (this.ringCount < this.ring.length) this.ringCount += 1;
        this.framesSeen += 1;
      }
    }
    this.lastNow = t;
  }

  /**
   * 取最近统计（按 PERF_SAMPLE_HZ 节流：窗口未刷新时直接返回上次结果）。
   * @param force 跳过节流强制重算（收尾/测试用）
   */
  sample(force = false): PerfSample {
    const now = this.lastNow;
    if (!force && now - this.lastSampleAtMs < this.sampleIntervalMs) return this.lastResult;
    this.lastSampleAtMs = now;

    const n = this.ringCount;
    if (n === 0) {
      this.lastResult = { ...EMPTY_SAMPLE, heapMb: this.readHeap() };
      return this.lastResult;
    }

    // 拷入复用缓冲并原地排序（升序）
    const buf = this.sortBuf;
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const v = this.ring[(this.ringHead - n + i + this.ring.length * 2) % this.ring.length];
      buf[i] = v;
      sum += v;
    }
    // 插入排序（窗口 ≤ 数百个样本，且逐帧增量有序性好，常优于快速排序的分配开销）
    for (let i = 1; i < n; i++) {
      const v = buf[i];
      let j = i - 1;
      while (j >= 0 && buf[j] > v) {
        buf[j + 1] = buf[j];
        j -= 1;
      }
      buf[j + 1] = v;
    }

    const avg = sum / n;
    const p95 = buf[Math.min(n - 1, Math.floor(n * 0.95))];
    const p99 = buf[Math.min(n - 1, Math.floor(n * 0.99))];
    const heap = this.readHeap();
    if (heap !== null && this.heapBaseline === null) this.heapBaseline = heap;

    this.lastResult = {
      fps: 1000 / avg,
      low1Fps: p99 > 0 ? 1000 / p99 : 0,
      p95FrameMs: p95,
      avgFrameMs: avg,
      heapMb: heap,
    };
    return this.lastResult;
  }

  /** 已采集帧数（基准/测试断言用） */
  get frameCount(): number {
    return this.framesSeen;
  }

  get heapGrowthRatio(): number | null {
    const heap = this.readHeap();
    if (heap === null || this.heapBaseline === null || this.heapBaseline === 0) return null;
    return heap / this.heapBaseline;
  }

  private readHeap(): number | null {
    const perf = globalThis.performance as (Performance & { memory?: { usedJSHeapSize: number } }) | undefined;
    const mem = perf?.memory;
    if (!mem) return null;
    return mem.usedJSHeapSize / (1024 * 1024);
  }
}
