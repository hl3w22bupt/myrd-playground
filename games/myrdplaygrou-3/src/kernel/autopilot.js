// autopilot.js — 内核级足球自动驾驶（受控主队视角）：抢球 → 摆脱逼抢向对方球门推进 →
// 射程内起脚远角；仅当身前有开阔队友时才出球。纯函数（零 three/零 DOM/零随机/零时钟）：
// 冒烟协议与确定性测试共用 —— 快进是一场真的会抢断、推进、起脚、进球的完整对局。
import { PITCH_HALF_Z, SHOT_RANGE_Z } from "../numeric.js";
import { attackDir } from "../levels/pitch.js";

const norm = (dx, dz) => {
  const d = Math.hypot(dx, dz) || 1e-9;
  return [dx / d, dz / d];
};

/** 一步足球意图：受控球员追球/带球摆脱/射门/传球的贪心决策 */
export function footballIntent(world) {
  const w = world;
  const c = w.players[w.controlledId];
  const ball = w.ball;
  const owner = ball.owner === null ? null : w.players[ball.owner];

  // 无球：追球预判点
  if (owner === null || owner.team !== 0) {
    const [ux, uz] = norm(ball.x + ball.vx * 0.25 - c.x, ball.z + ball.vz * 0.25 - c.z);
    return { moveX: ux, moveZ: uz, pass: false, shoot: false };
  }

  const dir = attackDir(0); // -1（主队攻 -Z）
  // 最近客队防守人
  let press = null, pressD = Infinity;
  for (const p of w.players) {
    if (p.team !== 1) continue;
    const d = Math.hypot(p.x - c.x, p.z - c.z);
    if (d < pressD) { pressD = d; press = p; }
  }

  // 1) 射程内（距对方底线 ≤ SHOT_RANGE_Z+1 且角度不偏）→ 起脚（推进到近距离再打，门将对称扑救）
  const inRange = dir < 0
    ? c.z < -PITCH_HALF_Z + SHOT_RANGE_Z + 2
    : c.z > PITCH_HALF_Z - SHOT_RANGE_Z - 2;
  if (inRange && Math.abs(c.x) < 7) {
    return { moveX: 0, moveZ: dir, pass: false, shoot: true };
  }

  // 2) 被压迫时：身前有更靠前且开阔（1.8m 内无防守人）的队友 → 出球
  if (pressD < 2.2) {
    for (const m of w.players) {
      if (m.team !== 0 || m.id === c.id || m.role === "GK") continue;
      const ahead = dir * (c.z - m.z) > 1.5; // 队友在前（沿进攻向）
      let guarded = false;
      for (const o of w.players) {
        if (o.team !== 1) continue;
        if (Math.hypot(o.x - m.x, o.z - m.z) < 1.8) { guarded = true; break; }
      }
      if (ahead && !guarded) return { moveX: 0, moveZ: dir, pass: true };
    }
  }

  // 3) 被贴身：向自己所在一侧「绕过」防守人并保持向前推进（防守人挡在身前也不回撤）
  if (press && pressD < 2.0) {
    const side = (c.x >= press.x ? 1 : -1) * (dir < 0 ? 1 : -1);
    const [tx, tz] = norm(press.x - c.x + side * 2.2, (dir < 0 ? -PITCH_HALF_Z : PITCH_HALF_Z) - c.z);
    return { moveX: tx, moveZ: tz, pass: false, shoot: false };
  }

  // 4) 默认：带向对方球门（中路收拢）
  const [tx, tz] = norm(c.x * 0.85 - c.x, (dir < 0 ? -PITCH_HALF_Z : PITCH_HALF_Z) - c.z);
  return { moveX: tx, moveZ: tz, pass: false, shoot: false };
}
