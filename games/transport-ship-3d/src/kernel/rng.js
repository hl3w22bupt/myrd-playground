// rng.js — 确定性随机数（mulberry32）。内核唯一随机源：任何随机必须经本模块（禁用系统随机源）。
export function createRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** rng 的可注入视图：内核函数只接收 rng，便于测试时替换成固定序列 */
export function rngRange(rng, min, max) {
  return min + rng() * (max - min);
}

/** [-1,1] 三角分布近似：两次均匀采样取均值，散布采样用 */
export function rngSymmetric(rng) {
  return (rng() + rng()) * 2 - 2;
}
