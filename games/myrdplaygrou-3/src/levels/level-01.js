// level-01.js — 关卡布局数据：内核碰撞与表现层拼装共享同一份真源（webgame-prototype 目录语义）。
// 训练桩为固定布局；金币出生点由种子驱动的拒绝采样生成 —— 纯 rng 函数，同 seed 同布局（E-05）。
import { COIN_COUNT, COIN_RADIUS, FIELD_HALF_W, FIELD_HALF_L, KEEPER_Z } from "../numeric.js";

/** 固定障碍（训练桩）：内核碰撞与渲染都用这一份。休闲难度只放两根中前场桩。 */
export const OBSTACLES = Object.freeze([
  { x: -3.5, z: -2, r: 0.8 },
  { x: 3.5, z: 2, r: 0.8 },
]);

/** 金币布局：拒绝采样避开出生区/训练桩/守门员带/已有金币；极端情况回退固定环 —— 两条路都确定性 */
export function coinLayout(rng) {
  const coinR = COIN_RADIUS;
  const coins = [];
  let guard = 0;
  while (coins.length < COIN_COUNT && guard++ < 1000) {
    const x = (rng() * 2 - 1) * (FIELD_HALF_W - 1.5);
    const z = -11 + rng() * (12 - -11); // z ∈ [-11, 12]：避开开球区与守门员带
    if (z > KEEPER_Z - 2) continue;                       // 守门员活动带不放
    if (OBSTACLES.some((o) => Math.hypot(x - o.x, z - o.z) < o.r + coinR + 0.3)) continue;
    if (coins.some((c) => Math.hypot(x - c.x, z - c.z) < 2.5)) continue; // 彼此留距，跑动收集
    coins.push({ x, z });
  }
  while (coins.length < COIN_COUNT) {
    const a = (coins.length / COIN_COUNT) * Math.PI * 2;
    coins.push({ x: Math.cos(a) * (FIELD_HALF_W - 3), z: Math.sin(a) * (FIELD_HALF_L - 6) });
  }
  return coins;
}
