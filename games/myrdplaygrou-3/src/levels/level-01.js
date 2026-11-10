// level-01.js — 关卡布局数据：内核碰撞与表现层拼装共享同一份真源（webgame-prototype 目录语义）。
// 训练桩为固定布局；金币出生点由种子驱动的拒绝采样生成 —— 纯 rng 函数，同 seed 同布局（E-05）。
// 金币补位（收集即补）与初始布局共用同一套约束与采样风格：两条路都确定性、都不依赖系统随机。
import {
  COIN_COUNT, COIN_RADIUS, FIELD_HALF_W, FIELD_HALF_L, KEEPER_Z,
  COIN_RESPAWN_MIN_PLAYER_DIST, COIN_RESPAWN_GUARD,
} from "../numeric.js";

/** 固定障碍（训练桩）：内核碰撞与渲染都用这一份。休闲难度只放两根中前场桩。 */
export const OBSTACLES = Object.freeze([
  { x: -3.5, z: -2, r: 0.8 },
  { x: 3.5, z: 2, r: 0.8 },
]);

const Z_MIN = -11;                 // 采样带下缘（避开开球区纵深，开局不白给）
const Z_MAX = 12;                  // 采样带上缘（守门员活动带之外）
const MIN_COIN_DIST = 2.5;         // 金币彼此最小间距：强制跑动收集
const RELAX_AT = Math.round(COIN_RESPAWN_GUARD * 2 / 3); // 采样后段放宽阈值（防极端拥挤死循环）

/** 拒绝采样一个合法点位：避守门员带/训练桩/已有金币/玩家近身；全部阈值来自 numeric.js */
function sampleSpot(rng, { playerX = 0, playerZ = 0, coins = [], relaxed = false } = {}) {
  const x = (rng() * 2 - 1) * (FIELD_HALF_W - 1.5);
  const z = Z_MIN + rng() * (Z_MAX - Z_MIN);
  if (z > KEEPER_Z - 2) return null;                                            // 守门员活动带不放
  const minPlayer = relaxed ? COIN_RESPAWN_MIN_PLAYER_DIST * 0.6 : COIN_RESPAWN_MIN_PLAYER_DIST;
  const minCoin = relaxed ? MIN_COIN_DIST * 0.55 : MIN_COIN_DIST;
  if (Math.hypot(x - playerX, z - playerZ) < minPlayer) return null;            // 不白给：离开玩家
  if (OBSTACLES.some((o) => Math.hypot(x - o.x, z - o.z) < o.r + COIN_RADIUS + 0.3)) return null;
  if (coins.some((c) => c.alive !== false && Math.hypot(x - c.x, z - c.z) < minCoin)) return null;
  return { x, z };
}

/** 金币布局：拒绝采样避开出生区/训练桩/守门员带/已有金币；极端情况回退固定环 —— 两条路都确定性 */
export function coinLayout(rng) {
  const coins = [];
  let guard = 0;
  while (coins.length < COIN_COUNT && guard++ < COIN_RESPAWN_GUARD) {
    const p = sampleSpot(rng, { coins, relaxed: guard > RELAX_AT });
    if (p) coins.push(p);
  }
  while (coins.length < COIN_COUNT) {
    const a = (coins.length / COIN_COUNT) * Math.PI * 2;
    coins.push({ x: Math.cos(a) * (FIELD_HALF_W - 3), z: Math.sin(a) * (FIELD_HALF_L - 6) });
  }
  return coins;
}

/** 金币补位点：收集即补（场上恒 COIN_COUNT 枚）。同 seed 同世界轨迹 → 同补位序列（确定性）。
 *  复用初始布局的约束（守门员带/训练桩/同伴间距），额外要求离开玩家 COIN_RESPAWN_MIN_PLAYER_DIST；
 *  guard 耗尽后放宽阈值重试，最终兜底确定性环带 —— 任何路径都不依赖系统随机。 */
export function coinRespawnSpot(rng, { playerX, playerZ, coins }) {
  let guard = 0;
  while (guard++ < COIN_RESPAWN_GUARD) {
    const p = sampleSpot(rng, { playerX, playerZ, coins, relaxed: guard > RELAX_AT });
    if (p) return p;
  }
  const a = rng() * Math.PI * 2;
  return { x: Math.cos(a) * (FIELD_HALF_W - 3), z: Math.sin(a) * (FIELD_HALF_L - 6) };
}
