// world.js — 纯内核世界：玩家/宝石/障碍/计时/得分。
// 零 three / 零 DOM / 零系统随机 / 零系统时钟 —— Node 可直接 import 跑（preflight P3 口径）。
import { createRng } from "./rng.js";
import { OBSTACLES, gemLayout } from "../levels/level-01.js";
import { ARENA_HALF, PLAYER_RADIUS, PLAYER_SPEED, GEM_RADIUS, ROUND_SECONDS } from "../numeric.js";

/** 边界加固（E-09）：非有限数值一律回退默认 —— 注入值不得进内核 */
export const finiteOr = (v, d = 0) => (Number.isFinite(v) ? v : d);

export function createWorld(seed) {
  const rng = createRng(seed >>> 0);
  return {
    seed: seed >>> 0,
    player: { x: 0, z: 0, angle: 0 },
    gems: gemLayout(rng).map((p, i) => ({ id: i, x: p.x, z: p.z, alive: true })),
    obstacles: OBSTACLES,
    score: 0,
    collected: 0,
    timeLeft: ROUND_SECONDS,
    over: false,
    won: false,
  };
}

/** 圆-圆推出：把 (x,z) 推出障碍圆外，返回修正后坐标 */
function pushOutOfCircle(x, z, cx, cz, cr, pr) {
  const dx = x - cx, dz = z - cz;
  const d = Math.hypot(dx, dz) || 1e-9;
  const min = cr + pr;
  if (d >= min) return [x, z];
  return [cx + (dx / d) * min, cz + (dz / d) * min];
}

/** 推进一个物理步：返回本步事件（collect / gameover）。over 后零推进 */
export function stepWorld(w, intent, dt) {
  const events = [];
  if (w.over || !(dt > 0)) return events;

  // 意图归一：非有限回退 0，模长 >1 归一（对角线不加速）
  let mx = finiteOr(intent?.moveX);
  let mz = finiteOr(intent?.moveZ);
  const mag = Math.hypot(mx, mz);
  if (mag > 1) { mx /= mag; mz /= mag; }

  const p = w.player;
  p.x += mx * PLAYER_SPEED * dt;
  p.z += mz * PLAYER_SPEED * dt;
  if (mag > 0.01) p.angle = Math.atan2(mx, mz);

  // 障碍推出 + 场地围栏钳制
  for (const o of w.obstacles) [p.x, p.z] = pushOutOfCircle(p.x, p.z, o.x, o.z, o.r, PLAYER_RADIUS);
  p.x = Math.max(-ARENA_HALF + PLAYER_RADIUS, Math.min(ARENA_HALF - PLAYER_RADIUS, p.x));
  p.z = Math.max(-ARENA_HALF + PLAYER_RADIUS, Math.min(ARENA_HALF - PLAYER_RADIUS, p.z));

  // 收集判定
  for (const g of w.gems) {
    if (!g.alive) continue;
    if (Math.hypot(p.x - g.x, p.z - g.z) < GEM_RADIUS + PLAYER_RADIUS) {
      g.alive = false;
      w.collected += 1;
      w.score += 10;
      events.push({ type: "collect", id: g.id, score: w.score });
    }
  }

  // 计时与终局（1e-9 容差：浮点步进累加后恰好 60s 时不得因 2e-13 残差漏判）
  w.timeLeft = Math.max(0, w.timeLeft - dt);
  if (w.collected >= w.gems.length) { w.over = true; w.won = true; events.push({ type: "gameover", won: true }); }
  else if (w.timeLeft <= 1e-9) { w.over = true; w.won = false; events.push({ type: "gameover", won: false }); }
  return events;
}
