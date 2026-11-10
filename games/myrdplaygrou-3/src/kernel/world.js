// world.js — 纯内核世界：球员/足球/金币/守门员/计时/比分。
// 零 three / 零 DOM / 零系统随机 / 零系统时钟 —— Node 可直接 import 跑（preflight P3 口径）。
import { createRng } from "./rng.js";
import { OBSTACLES, coinLayout } from "../levels/level-01.js";
import {
  FIELD_HALF_W, FIELD_HALF_L, GOAL_WIDTH, GOAL_LINE,
  PLAYER_RADIUS, PLAYER_SPEED, KICKOFF_X, KICKOFF_Z,
  BALL_RADIUS, BALL_LEAD, BALL_FRICTION, SHOT_SPEED, AIM_GAIN, AIM_MAX,
  SHOOT_MIN_Z, AUTO_SHOOT_Z, SHOT_LIVE_SECONDS,
  KEEPER_RADIUS, KEEPER_RANGE, KEEPER_SPEED, KEEPER_Z,
  COIN_RADIUS, COIN_SCORE, GOAL_SCORE, GOALS_TO_WIN, ROUND_SECONDS, SHOOT_COOLDOWN,
} from "../numeric.js";

/** 边界加固（E-09）：非有限数值一律回退默认 —— 注入值不得进内核 */
export const finiteOr = (v, d = 0) => (Number.isFinite(v) ? v : d);

/** 三角波（值域 [-1,1]）：守门员巡逻的确定性相位函数 —— 分段线性，无浮点周期歧义 */
export function triangleWave(phase) {
  const p = phase - Math.floor(phase);
  return 4 * Math.abs(p - 0.5) - 1;
}

export function createWorld(seed) {
  const rng = createRng(seed >>> 0);
  return {
    seed: seed >>> 0,
    player: { x: KICKOFF_X, z: KICKOFF_Z, angle: 0 },
    ball: { x: KICKOFF_X, z: KICKOFF_Z, vx: 0, vz: 0, state: "dribble", live: 0 },
    keeper: { x: 0, phase: 0 },
    shootCooldown: 0,
    coins: coinLayout(rng).map((p, i) => ({ id: i, x: p.x, z: p.z, alive: true })),
    obstacles: OBSTACLES,
    score: 0,
    coinsCollected: 0,
    goals: 0,
    shots: 0,
    saves: 0,
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

/** 射门：球从带球位朝门线直飞，vx 自动瞄准门中心收敛（平缓辅助）；起脚后进冷却 */
function shoot(w) {
  const b = w.ball;
  b.state = "shot";
  b.live = 0;
  b.vz = SHOT_SPEED;
  b.vx = Math.max(-AIM_MAX, Math.min(AIM_MAX, -b.x * AIM_GAIN));
  w.shootCooldown = SHOOT_COOLDOWN;
  w.shots += 1;
  return { type: "kick", shots: w.shots };
}

/** 球回到球员脚下（进球/扑救/出界/失速统一回位） */
function resetBallToPlayer(w) {
  const b = w.ball, p = w.player;
  const ax = Math.sin(p.angle), az = Math.cos(p.angle);
  b.x = p.x + ax * BALL_LEAD;
  b.z = p.z + az * BALL_LEAD;
  b.vx = 0; b.vz = 0;
  b.state = "dribble";
  b.live = 0;
}

/** 开球重置：球员回中圈附近，球回脚下（进球后重新组织进攻） */
function kickoffReset(w) {
  w.player.x = KICKOFF_X;
  w.player.z = KICKOFF_Z;
  w.player.angle = 0;
  resetBallToPlayer(w);
}

/** 推进一个物理步：返回本步事件（kick/collect/goal/save/gameover）。over 后零推进 */
export function stepWorld(w, intent, dt) {
  const events = [];
  if (w.over || !(dt > 0)) return events;

  // 意图归一：非有限回退 0，模长 >1 归一（对角线不加速）；shoot 为一次性脉冲位
  let mx = finiteOr(intent?.moveX);
  let mz = finiteOr(intent?.moveZ);
  const mag = Math.hypot(mx, mz);
  if (mag > 1) { mx /= mag; mz /= mag; }
  const shootRequested = intent?.shoot === true;

  // —— 守门员巡逻（确定性相位推进）+ 射门冷却计时 ——
  w.keeper.phase += KEEPER_SPEED * dt;
  w.keeper.x = KEEPER_RANGE * triangleWave(w.keeper.phase);
  w.shootCooldown = Math.max(0, w.shootCooldown - dt);

  // —— 球员移动 + 障碍/守门员推出 + 场地围栏钳制 ——
  const p = w.player;
  p.x += mx * PLAYER_SPEED * dt;
  p.z += mz * PLAYER_SPEED * dt;
  if (mag > 0.01) p.angle = Math.atan2(mx, mz);
  for (const o of w.obstacles) [p.x, p.z] = pushOutOfCircle(p.x, p.z, o.x, o.z, o.r, PLAYER_RADIUS);
  [p.x, p.z] = pushOutOfCircle(p.x, p.z, w.keeper.x, KEEPER_Z, KEEPER_RADIUS, PLAYER_RADIUS);
  p.x = Math.max(-FIELD_HALF_W + PLAYER_RADIUS, Math.min(FIELD_HALF_W - PLAYER_RADIUS, p.x));
  p.z = Math.max(-FIELD_HALF_L + PLAYER_RADIUS, Math.min(FIELD_HALF_L - PLAYER_RADIUS, p.z));

  // —— 球运动 ——
  const b = w.ball;
  if (b.state === "dribble") {
    // 带球吸附：球贴在球员朝向前方，钳制场内（球不穿墙）
    const ax = Math.sin(p.angle), az = Math.cos(p.angle);
    b.x = Math.max(-FIELD_HALF_W + BALL_RADIUS, Math.min(FIELD_HALF_W - BALL_RADIUS, p.x + ax * BALL_LEAD));
    b.z = Math.max(-FIELD_HALF_L + BALL_RADIUS, Math.min(FIELD_HALF_L - BALL_RADIUS, p.z + az * BALL_LEAD));
    // 射门请求：冷却结束才可起脚；进入射程可手动射，拖到自动线强制起脚（平缓兜底）
    if (w.shootCooldown <= 0) {
      const inRange = p.z >= SHOOT_MIN_Z;
      const forced = p.z >= AUTO_SHOOT_Z;
      if ((shootRequested && inRange) || forced) events.push(shoot(w));
    }
  } else {
    // 射出飞行：指数摩擦（帧率无关）+ 围栏反弹 + 门线判定
    b.live += dt;
    const damp = Math.exp(-BALL_FRICTION * dt);
    b.vx *= damp; b.vz *= damp;
    b.x += b.vx * dt;
    b.z += b.vz * dt;
    const wall = FIELD_HALF_W - BALL_RADIUS;
    if (b.x < -wall || b.x > wall) { b.x = Math.max(-wall, Math.min(wall, b.x)); b.vx *= -0.5; }
    // 守门员扑救：圆-圆碰撞（站位在门线前，先于门线判定）
    const kd = Math.hypot(b.x - w.keeper.x, b.z - KEEPER_Z);
    if (kd < KEEPER_RADIUS + BALL_RADIUS && b.vz > 0) {
      const kb = b.vz;                       // 反弹：向场内回弹 + 按扑救点横向弹开
      b.vz = -kb * 0.35;
      b.vx += (b.x - w.keeper.x > 0 ? 2 : -2);
      w.saves += 1;
      events.push({ type: "save", saves: w.saves });
    }
    // 进球判定：过门线且在门柱之间（守门员没碰到）
    if (b.z >= GOAL_LINE - BALL_RADIUS) {
      if (Math.abs(b.x) <= GOAL_WIDTH / 2) {
        w.goals += 1;
        w.score += GOAL_SCORE;
        events.push({ type: "goal", goals: w.goals, score: w.score });
        if (w.goals >= GOALS_TO_WIN) {
          w.over = true; w.won = true;
          events.push({ type: "gameover", won: true });
          return events;
        }
        kickoffReset(w);                     // 进球后重新开球
      } else {
        resetBallToPlayer(w);                // 打偏/中柱出界：球回脚下，不惩罚（休闲）
      }
    } else if (b.live > SHOT_LIVE_SECONDS || Math.hypot(b.vx, b.vz) < 1.5) {
      resetBallToPlayer(w);                  // 飞行超时/失速：球回脚下
    }
  }

  // —— 金币收集判定 ——
  for (const c of w.coins) {
    if (!c.alive) continue;
    if (Math.hypot(p.x - c.x, p.z - c.z) < COIN_RADIUS + PLAYER_RADIUS) {
      c.alive = false;
      w.coinsCollected += 1;
      w.score += COIN_SCORE;
      events.push({ type: "collect", id: c.id, score: w.score });
    }
  }

  // —— 计时与终局（1e-9 容差：浮点步进累加后恰好 90s 时不得因残差漏判）——
  w.timeLeft = Math.max(0, w.timeLeft - dt);
  if (w.timeLeft <= 1e-9) {
    w.over = true;
    w.won = w.goals > 0;                     // 时间到：进过球即算获胜（平缓判定）
    events.push({ type: "gameover", won: w.won });
  }
  return events;
}
