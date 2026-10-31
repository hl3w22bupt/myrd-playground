// level-01.js — 关卡布局数据：内核碰撞与表现层拼装共享同一份真源（webgame-prototype 目录语义）。
// 障碍为固定布局；宝石出生点由种子驱动的拒绝采样生成 —— 纯 rng 函数，同 seed 同布局（E-05）。
import { GEM_COUNT, ARENA_HALF, GEM_RADIUS } from "../numeric.js";

/** 固定障碍（圆柱立柱）：内核碰撞与渲染都用这一份 */
export const OBSTACLES = Object.freeze([
  { x: -6, z: -6, r: 1.6 },
  { x: 6, z: -6, r: 1.6 },
  { x: -6, z: 6, r: 1.6 },
  { x: 6, z: 6, r: 1.6 },
  { x: 0, z: 0, r: 2.2 },
]);

/** 宝石布局：拒绝采样避开出生区/障碍/已有宝石；极端情况回退固定环 —— 两条路都确定性 */
export function gemLayout(rng) {
  const gems = [];
  let guard = 0;
  while (gems.length < GEM_COUNT && guard++ < 1000) {
    const x = (rng() * 2 - 1) * (ARENA_HALF - 1);
    const z = (rng() * 2 - 1) * (ARENA_HALF - 1);
    if (Math.hypot(x, z) < 2.5) continue; // 出生区留空
    if (OBSTACLES.some((o) => Math.hypot(x - o.x, z - o.z) < o.r + GEM_RADIUS + 0.3)) continue;
    if (gems.some((g) => Math.hypot(x - g.x, z - g.z) < 2.5)) continue;
    gems.push({ x, z });
  }
  while (gems.length < GEM_COUNT) {
    const a = (gems.length / GEM_COUNT) * Math.PI * 2;
    gems.push({ x: Math.cos(a) * (ARENA_HALF - 3), z: Math.sin(a) * (ARENA_HALF - 3) });
  }
  return gems;
}
