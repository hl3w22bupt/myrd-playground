// fps.ts — 帧率/帧时间埋点（A 轮 N3-T2 · 零外部依赖 · 时刻由调用方注入）
//
// 口径（红线④）：性能口径（中端机 60fps / P95 ≤ 16.7ms）**只落发布就绪清单，不进 spec acceptance**。
// 本文件只负责采集与统计；口径判断由报告层（tools/perf-report.mjs）给出，不在内核断言。
// 采集面：requestAnimationFrame 相邻两次回调的时间差 = 帧时间（含掉帧），环形缓冲有界（默认 600 帧 ≈ 10s@60fps）。

                                
                  
              
                 
                
                
                
                
                     
                    
 

                              
                              
                             
                
                            
                                          
                         
 

const EMPTY                = {
  samples: 0, fps: 0, meanMs: 0, p50Ms: 0, p95Ms: 0, p99Ms: 0, maxMs: 0, jankFrames: 0, jankRatio: 0,
};

/** 线性插值分位数（输入须升序）；p ∈ [0,100] */
export function percentileAsc(sortedAsc                   , p        )         {
  if (!Number.isFinite(p) || p < 0 || p > 100) throw new RangeError(`p 越界 [0,100]: ${p}`);
  const n = sortedAsc.length;
  if (n === 0) return 0;
  if (n === 1) return sortedAsc[0];
  const rank = (p / 100) * (n - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sortedAsc[lo];
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (rank - lo);
}

export function createFpsRecorder(capacity = 600)              {
  if (!Number.isInteger(capacity) || capacity < 2) throw new TypeError(`capacity 必须 ≥2: ${capacity}`);
  let ring           = [];
  let last                = null;

  return {
    frame(nowMs        )       {
      if (!Number.isFinite(nowMs)) throw new TypeError(`nowMs 非有限数: ${nowMs}`);
      if (last !== null) {
        const dt = nowMs - last;
        if (dt >= 0) {
          ring.push(dt);
          if (ring.length > capacity) ring = ring.slice(ring.length - capacity);
        }
      }
      last = nowMs;
    },
    reset()       {
      ring = [];
      last = null;
    },
    samplesAsc()           {
      return ring.slice().sort((a, b) => a - b);
    },
    snapshot()                {
      const n = ring.length;
      if (n === 0) return { ...EMPTY };
      const asc = ring.slice().sort((a, b) => a - b);
      const sum = asc.reduce((acc, v) => acc + v, 0);
      const meanMs = sum / n;
      // fps 口径 = 平均帧时间的倒数（与样本数无关，避免首帧偏置）
      const fps = meanMs > 0 ? 1000 / meanMs : 0;
      // 掉帧口径：> 1.5 × 60fps 帧预算（20ms）即记一次卡顿（报告层口径，不在内核断言）
      const JANK_MS = 20;
      const jankFrames = asc.filter((v) => v > JANK_MS).length;
      return {
        samples: n,
        fps: Math.round(fps * 100) / 100,
        meanMs: Math.round(meanMs * 1000) / 1000,
        p50Ms: Math.round(percentileAsc(asc, 50) * 1000) / 1000,
        p95Ms: Math.round(percentileAsc(asc, 95) * 1000) / 1000,
        p99Ms: Math.round(percentileAsc(asc, 99) * 1000) / 1000,
        maxMs: Math.round(asc[asc.length - 1] * 1000) / 1000,
        jankFrames,
        jankRatio: Math.round((jankFrames / n) * 10000) / 10000,
      };
    },
  };
}


//# sourceURL=telemetry/fps.ts