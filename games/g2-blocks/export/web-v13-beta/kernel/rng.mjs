// rng.ts — seeded RNG 钩子骨架（e-rng · 零冻结值硬编码）
//
// spec 口径（numeric.rng）：algorithm=mulberry32 / testHook="seededRng" /
// forbidMathRandom=true / forbidDateNow=true，seed 真源 = numeric.DEFAULT_SEED（经 spec 导出件注入）。
// 本骨架只实现「可注入 seed 的确定性随机源」这一个零冻结值依赖面；
// spawn 取类型（uniform_random）等玩法实现等 approve 后再写。
import { numeric } from '../generated/spec-data.mjs';

                               

/** mulberry32（spec numeric.rng.algorithm 声明的算法） */
export function mulberry32(seed        )      {
  if (!Number.isInteger(seed) || seed < 0) throw new TypeError(`seed 必须是非负整数: ${seed}`);
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 默认 seed（真源 = spec numeric.DEFAULT_SEED；禁止在调用方写死数字） */
export function defaultSeed()         {
  const v = numeric().DEFAULT_SEED;
  if (typeof v !== 'number') throw new TypeError(`spec numeric.DEFAULT_SEED 非数值: ${v}`);
  return v;
}

/** seeded RNG 测试钩子：不传 seed → 用 spec 默认 seed；传 seed → 强制复现（契约测试口径） */
export function seededRng(seed         )      {
  return mulberry32(seed ?? defaultSeed());
}

/** [0, n) 均匀整数（spawn.orientation=uniform_random 的取数原语；玩法接线在 approve 后） */
export function uniformInt(rng     , n        )         {
  if (!Number.isInteger(n) || n <= 0) throw new TypeError(`n 必须为正整数: ${n}`);
  return Math.floor(rng() * n);
}

// 内核纯净巡检（ac-14 机判）由 spec 声明落点 tests/kernel-purity.spec.mjs 承担：
// 模式字面量若写在本目录会被自扫描命中，故巡检只存在于测试件一侧。


//# sourceURL=kernel/rng.ts