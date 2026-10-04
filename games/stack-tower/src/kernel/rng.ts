/**
 * seeded RNG（实体 e-kernel-rng）— mulberry32。
 * 确定性红线：内核禁 Math.random / Date.now / performance.now；
 * 摆块初始方向等一切随机量都取自本流，同 seed 逐 tick 复现。
 */

/** 随机流：next() ∈ [0,1) */
export interface Rng {
  next(): number;
}

/** mulberry32（32 位状态，确定性、零依赖、可移植） */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return {
    next(): number {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}
