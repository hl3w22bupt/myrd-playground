// autopilot.js — 内核级贪心自动驾驶：带球朝球门推进，顺路偏移吃金币，到射程就射门。
// 纯函数（零 three/零 DOM/零随机/零时钟）：冒烟协议与确定性测试共用 ——
// 有了它，快进不再是「直冲角落」的死路径，而是真的会推进、会射门、会终局的完整对局。
import { FIELD_HALF_L, GOAL_LINE, GOAL_WIDTH, SHOOT_MIN_Z } from "../numeric.js";

export function greedyIntent(world) {
  const p = world.player;
  const b = world.ball;

  // 球在飞：保持向前压上（跟球，准备补射/回抢）
  if (b.state === "shot") {
    const dx = b.x - p.x, dz = b.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.01) return { moveX: 0, moveZ: 0 };
    return { moveX: dx / d, moveZ: dz / d };
  }

  // 顺路金币：找一枚在球门方向（前方 z ≥ p.z）且横向偏移小的金币作为中途目标
  let way = null;
  let wayCost = Infinity;
  for (const c of world.coins) {
    if (!c.alive) continue;
    const dz = c.z - p.z;
    const dx = c.x - p.x;
    if (dz < 0.5) continue;                                  // 只捡前路金币
    const detour = Math.abs(dx) - Math.abs(dz) * 0.45;       // 绕路成本：横向偏移 - 纵向收益
    if (detour > 2.2) continue;                              // 太偏的不绕
    const cost = detour - dz * 0.1;
    if (cost < wayCost) { wayCost = cost; way = c; }
  }

  // 射门窗口：进射程后瞄门内空当（守门员相位是内核状态，可直接读 —— 同一真源）
  if (p.z >= SHOOT_MIN_Z - 0.5) {
    const kx = world.keeper.x;
    // 瞄远离守门员的一侧门柱内侧
    const aimX = kx > 0 ? -GOAL_WIDTH * 0.3 : GOAL_WIDTH * 0.3;
    const dx = aimX - b.x, dz = GOAL_LINE - b.z;
    const d = Math.hypot(dx, dz) || 1e-9;
    const intent = { moveX: dx / d, moveZ: dz / d };
    if (p.z >= SHOOT_MIN_Z && Math.abs(b.x - aimX) < 1.6) intent.shoot = true;
    return intent;
  }

  // 默认：朝（顺路金币或）球门方向推进
  const tx = way ? way.x : 0;
  const tz = way ? way.z : FIELD_HALF_L;
  const dx = tx - p.x, dz = tz - p.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.01) return { moveX: 0, moveZ: 0 };
  return { moveX: dx / d, moveZ: dz / d };
}
