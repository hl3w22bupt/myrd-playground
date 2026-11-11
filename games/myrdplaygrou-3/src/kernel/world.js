// world.js — 纯内核世界：5v5 两队小场实况（球员/球/抢断/传球/射门/进球/计时）。
// 零 three / 零 DOM / 零系统随机 / 零系统时钟 —— Node 可直接 import 跑（preflight P3 口径）。
// 随机唯一来源 = world.rng（mulberry32 注入，E-05）；时间只以 dt 参数进内核（E-06）。
import { createRng } from "./rng.js";
import { kickoffFormation, attackDir, goalMouthClampX } from "../levels/pitch.js";
import {
  PITCH_HALF_X, PITCH_HALF_Z, GOAL_HALF_WIDTH, BALL_RADIUS,
  PLAYER_RADIUS, PLAYER_SPEED, AI_SPEED, GK_SPEED, ANIM_PHASE_PER_M,
  CONTROL_RADIUS, DRIBBLE_LEAD, PASS_SPEED, SHOT_SPEED, SHOT_SCATTER, SHOT_SCATTER_AWAY,
  KICK_COOLDOWN, GK_HOLD_SECONDS, TACKLE_RADIUS, TACKLE_RATE, SHOT_RANGE_Z, AWAY_SHOT_RANGE_Z,
  GK_TRACK, AIM_CORNER_INSET, DRIBBLE_PENALTY,
  SUPPORT_OFFSET, SUPPORT_FW_WEIGHT, SUPPORT_OTHER_WEIGHT, PRESS_MARGIN,
  COVER_LANE_MIX, ROUND_SECONDS, GOAL_CELEBRATION_SEC,
} from "../numeric.js";

/** 边界加固（E-09）：非有限数值一律回退默认 —— 注入值不得进内核 */
export const finiteOr = (v, d = 0) => (Number.isFinite(v) ? v : d);

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** 创建对局世界（开球阵型 + 中场球）。rng 挂在 world 上供 stepWorld 确定性消费。 */
export function createWorld(seed) {
  const rng = createRng(seed >>> 0);
  const players = kickoffFormation().map((s, id) => ({
    id, team: s.team, role: s.role, num: s.num,
    baseX: s.x, baseZ: s.z,
    x: s.x, z: s.z, vx: 0, vz: 0,
    angle: s.team === 0 ? -Math.PI / 2 + Math.PI : Math.PI / 2, // 面朝本队进攻方向
    phase: 0, cooldown: 0, targetX: s.x, targetZ: s.z,
  }));
  return {
    seed: seed >>> 0,
    rng,
    players,
    ball: { x: 0, z: 0, vx: 0, vz: 0, owner: null, cooldown: 0, holdTimer: 0, lastTouchTeam: null },
    score: { home: 0, away: 0 },
    controlledId: nearestHomeFielder(players, 0, 0),
    possessionChanges: 0,
    shots: 0,
    goals: 0,
    timeLeft: ROUND_SECONDS,
    celebrationLeft: 0, // 进球庆祝冻结剩余秒数（>0 = 庆祝演出窗口：全员/球/倒计时全停）
    over: false,
    won: null, // "home" | "away" | "draw"
  };
}

/** 距 (x,z) 最近的主队非门将球员 id（受控球员缺省口径；id 升序破平局） */
export function nearestHomeFielder(players, x, z) {
  let best = -1, bestD = Infinity;
  for (const p of players) {
    if (p.team !== 0 || p.role === "GK") continue;
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < bestD - 1e-9) { bestD = d; best = p.id; }
  }
  return best;
}

/** 面朝方向单位向量（angle 约定 = atan2(dirX, dirZ)，与模板一致） */
const facing = (a) => [Math.sin(a), Math.cos(a)];

/** 踢球：球脱离持球人，朝 (tx,tz) 以 speed 射出（带角度散射 rng），冷却置位 */
function kickBall(w, kicker, tx, tz, speed, evType, scatter = SHOT_SCATTER) {
  const jitter = (w.rng() * 2 - 1) * scatter;
  const dx = tx - w.ball.x, dz = tz - w.ball.z;
  const d = Math.hypot(dx, dz) || 1e-9;
  const ang = Math.atan2(dx, dz) + jitter;
  w.ball.owner = null;
  w.ball.holdTimer = 0;
  w.ball.vx = Math.sin(ang) * speed;
  w.ball.vz = Math.cos(ang) * speed;
  w.ball.lastTouchTeam = kicker.team;
  kicker.cooldown = KICK_COOLDOWN;
  w.ball.cooldown = KICK_COOLDOWN * 0.75;
  return { type: evType, from: kicker.id, team: kicker.team };
}

/** 远角瞄准点：射向对方门将的异侧门柱内收点（确定性；射手得分效率不再被居中瞄点抵消） */
function aimFarCorner(w, shooter, goalZ) {
  const gk = w.players.find((p) => p.team !== shooter.team && p.role === "GK");
  const gkX = gk ? gk.x : 0;
  const corner = (gkX >= 0 ? -1 : 1) * (GOAL_HALF_WIDTH - AIM_CORNER_INSET);
  return [clamp(corner, -GOAL_HALF_WIDTH + 0.4, GOAL_HALF_WIDTH - 0.4), goalZ];
}

/** 传球目标评分：越近、越对齐进攻向、越少身边防守人 → 越优（纯几何，确定性）。
 *  openness = 3m 内防守人数：传「被盯防的人」等于送球权 —— open 才是合法出球点 */
function passScore(w, from, mate) {
  const dx = mate.x - from.x, dz = mate.z - from.z;
  const d = Math.hypot(dx, dz) || 1e-9;
  const adv = (attackDir(from.team) * dz) / d; // 沿进攻方向的分量 [-1,1]
  let pressure = 0;
  for (const o of w.players) {
    if (o.team === from.team) continue;
    const od = Math.hypot(o.x - mate.x, o.z - mate.z);
    if (od < 2.2) pressure += 1;
  }
  return d * -0.12 + adv * 2.2 - pressure * 1.4;
}
/** 队友是否「真开阔」：2.5m 内零防守人（盯防人贴 1.3m 即判不开阔，拦截风险高） */
function isOpen(w, mate) {
  for (const o of w.players) {
    if (o.team === mate.team) continue;
    if (Math.hypot(o.x - mate.x, o.z - mate.z) < 2.5) return false;
  }
  return true;
}

/** 最佳传球目标（不含自己/门将优先级低），无候选返回 null */
function bestPassTarget(w, from) {
  let best = null, bestS = -Infinity;
  for (const m of w.players) {
    if (m.team !== from.team || m.id === from.id) continue;
    const s = passScore(w, from, m) + (m.role === "GK" ? -3 : 0);
    if (s > bestS + 1e-9) { bestS = s; best = m; }
  }
  return best;
}

/** 防守阵型位：本方半场，随球横移（球在哪边阵型往哪边偏） */
function defendSpot(p, ball) {
  const shift = clamp(ball.x * 0.35, -4, 4);
  const back = attackDir(p.team) * -1; // 退向本方球门
  const depth = p.role === "DF" ? 0.45 : p.role === "MF" ? 0.15 : -0.2;
  return [
    clamp(p.baseX + shift, -PITCH_HALF_X + 1, PITCH_HALF_X - 1),
    clamp(p.baseZ + back * (2 + depth * 6), -PITCH_HALF_Z + 1.2, PITCH_HALF_Z - 1.2),
  ];
}

/** 盯人位：贴防距自己最近的对方非门将，站在其与本方球门之间（goal-side 1.3m）——
 *  消灭「无球自由人」：接应点必须先过盯防人这一关（v2 实况机制，攻守对称） */
function markSpot(w, p) {
  let best = null, bestD = Infinity;
  for (const o of w.players) {
    if (o.team === p.team || o.role === "GK") continue;
    const d = Math.hypot(o.x - p.x, o.z - p.z);
    if (d < bestD - 1e-9) { bestD = d; best = o; }
  }
  if (!best) return [p.baseX, p.baseZ];
  return [
    clamp(best.x, -PITCH_HALF_X + 1, PITCH_HALF_X - 1),
    clamp(best.z - attackDir(p.team) * 1.3, -PITCH_HALF_Z + 1.2, PITCH_HALF_Z - 1.2),
  ];
}

/** 接应位：沿进攻方向前推球位（FW 权重高），横向上收拢阵型 —— v2「队友接应传球」机制。
 *  无球人限深（≤PZ-9，射区之外）：禁贴门线等饼（tap-in 位），纵深只有持球人本人可以进 */
function supportSpot(p, ball) {
  const w = p.role === "FW" ? SUPPORT_FW_WEIGHT : SUPPORT_OTHER_WEIGHT;
  const maxDepth = PITCH_HALF_Z - 9;
  const tz = clamp(ball.z + attackDir(p.team) * SUPPORT_OFFSET * w,
    -maxDepth, maxDepth);
  const tx = clamp(ball.x * 0.5 + p.baseX * 0.5, -PITCH_HALF_X + 1, PITCH_HALF_X - 1);
  return [tx, tz];
}

/** 逐步推进一个固定步长（dt=FIXED_STEP），返回本步事件数组 */
export function stepWorld(w, intent, dt) {
  const events = [];
  if (w.over || !(dt > 0)) return events;

  // —— 进球庆祝冻结（v3 打磨项：庆祝演出 ≥1s 且倒计时暂停）——
  // 冻结期间球/人/计时全部停止（确定性：冻结不消费 rng、不改任何状态位），只递减庆祝计时。
  if (w.celebrationLeft > 0) {
    w.celebrationLeft = Math.max(0, w.celebrationLeft - dt);
    return events;
  }

  // —— 意图归一（E-09）：非有限回退 0；模长 >1 归一（对角线不加速）——
  let mx = finiteOr(intent?.moveX);
  let mz = finiteOr(intent?.moveZ);
  const mag = Math.hypot(mx, mz);
  if (mag > 1) { mx /= mag; mz /= mag; }
  const wantPass = intent?.pass === true;
  const wantShoot = intent?.shoot === true;

  const c = w.players[w.controlledId];
  const ball = w.ball;
  const owner = ball.owner === null ? null : w.players[ball.owner];

  // —— 受控球员移动（持球带球有减速惩罚：攻守两侧同规则）——
  const cSpeed = PLAYER_SPEED * (ball.owner === c.id ? DRIBBLE_PENALTY : 1);
  c.vx = mx * cSpeed;
  c.vz = mz * cSpeed;
  // 休闲向助攻：玩家无输入 + 对方持球 → 受控人自动上抢（有输入时完全听玩家）
  if (mag < 0.05 && owner && owner.team === 1 && ball.owner !== c.id) {
    const dx = ball.x - c.x, dz = ball.z - c.z;
    const d = Math.hypot(dx, dz) || 1e-9;
    c.vx = (dx / d) * PLAYER_SPEED;
    c.vz = (dz / d) * PLAYER_SPEED;
    c.angle = Math.atan2(c.vx, c.vz);
  }
  c.x += c.vx * dt;
  c.z += c.vz * dt;
  if (mag > 0.01) c.angle = Math.atan2(c.vx, c.vz);
  c.phase += Math.hypot(c.vx, c.vz) * dt * ANIM_PHASE_PER_M;
  c.x = clamp(c.x, -PITCH_HALF_X + PLAYER_RADIUS, PITCH_HALF_X - PLAYER_RADIUS);
  c.z = clamp(c.z, -PITCH_HALF_Z + PLAYER_RADIUS, PITCH_HALF_Z - PLAYER_RADIUS);

  // —— 受控球员动作（必须持球；踢球后 owner=null 天然防同帧多次触发）——
  if (ball.owner === c.id && ball.cooldown <= 0) {
    if (wantShoot) {
      const goalZ = attackDir(0) < 0 ? -PITCH_HALF_Z : PITCH_HALF_Z;
      const [ax, az] = aimFarCorner(w, c, goalZ);
      events.push(kickBall(w, c, ax, az, SHOT_SPEED, "shot"));
      w.shots += 1;
    } else if (wantPass) {
      const mate = bestPassTarget(w, c);
      if (mate) {
        const lead = 0.35; // 传到队友身前一点
        events.push(kickBall(w, c, mate.x + Math.sin(mate.angle) * lead, mate.z + Math.cos(mate.angle) * lead, PASS_SPEED, "pass"));
      }
    }
  }

  // —— AI 目标位计算（每步重算，确定性）——
  const homeOwns = owner !== null && owner.team === 0;
  const awayOwns = owner !== null && owner.team === 1;
  const loose = owner === null;

  // 各队距球最近的非门将（逼抢/追球人选；id 升序破平局）
  const nearestBy = (team) => {
    let best = null, bestD = Infinity;
    for (const p of w.players) {
      if (p.team !== team || p.role === "GK") continue;
      const d = Math.hypot(p.x - ball.x, p.z - ball.z);
      if (d < bestD - 1e-9) { bestD = d; best = p; }
    }
    return best;
  };
  const homeChaser = nearestBy(0);
  const awayChaser = nearestBy(1);
  const homeSecond = nearestBy(0) === null ? null :
    w.players.filter((p) => p.team === 0 && p.role !== "GK").sort((a, b) =>
      Math.hypot(a.x - ball.x, a.z - ball.z) - Math.hypot(b.x - ball.x, b.z - ball.z))[1] || null;
  const awaySecond = w.players.filter((p) => p.team === 1 && p.role !== "GK").sort((a, b) =>
    Math.hypot(a.x - ball.x, a.z - ball.z) - Math.hypot(b.x - ball.x, b.z - ball.z))[1] || null;

  for (const p of w.players) {
    if (p.id === w.controlledId) continue; // 受控球员走意图
    let speed = ball.owner === p.id ? AI_SPEED * DRIBBLE_PENALTY : AI_SPEED; // 带球减速（攻守同规则）
    let tx = p.targetX, tz = p.targetZ;

    if (p.role === "GK") {
      // 门将：守在本方球门前；松球且球朝本方门飞 → 预判来球线上的截点（扑救，双侧对称）
      speed = GK_SPEED;
      const gz = attackDir(p.team) > 0 ? -PITCH_HALF_Z + 1.4 : PITCH_HALF_Z - 1.4;
      let diveX = ball.x * GK_TRACK;
      if (ball.owner === null && ball.vz !== 0) {
        const t = (gz - ball.z) / ball.vz;
        if (t > 0 && t < 1.5) {
          const predX = ball.x + ball.vx * t;
          if (Math.abs(predX) < GOAL_HALF_WIDTH + 1.5) diveX = predX;
        }
      }
      tx = clamp(goalMouthClampX(diveX), -GOAL_HALF_WIDTH + 0.5, GOAL_HALF_WIDTH - 0.5);
      tz = gz;
    } else if (awayOwns && p.team === 0) {
      // 主队防守（v2「对方逼抢」的镜像）：最近的上抢持球人，其余全员贴人盯防 —— 4v4 无自由人
      if (p.id === homeChaser.id) { tx = owner.x - Math.sin(owner.angle) * PRESS_MARGIN; tz = owner.z - Math.cos(owner.angle) * PRESS_MARGIN; speed = AI_SPEED * 0.95; }
      else [tx, tz] = markSpot(w, p);
    } else if (homeOwns && p.team === 1) {
      // 客队逼抢（v2「对方逼抢」机制）：最近贴持球人，其余全员贴人盯防
      if (p.id === awayChaser.id) { tx = owner.x + Math.sin(owner.angle) * PRESS_MARGIN; tz = owner.z + Math.cos(owner.angle) * PRESS_MARGIN; speed = AI_SPEED * 0.95; }
      else [tx, tz] = markSpot(w, p);
    } else if (loose) {
      // 松球：各队最近者追球预判点，其余贴人盯防（防无球套跑）
      if (p.id === homeChaser.id || p.id === awayChaser.id) {
        tx = ball.x + ball.vx * 0.3; tz = ball.z + ball.vz * 0.3;
      } else [tx, tz] = markSpot(w, p);
    } else {
      // 本方持球（含受控人持球）的无球队友：接应前推
      [tx, tz] = supportSpot(p, ball);
    }

    // 朝目标位移动（接近减速，帧率无关）
    p.targetX = clamp(tx, -PITCH_HALF_X + PLAYER_RADIUS, PITCH_HALF_X - PLAYER_RADIUS);
    p.targetZ = clamp(tz, -PITCH_HALF_Z + PLAYER_RADIUS, PITCH_HALF_Z - PLAYER_RADIUS);
    const ddx = p.targetX - p.x, ddz = p.targetZ - p.z;
    const dd = Math.hypot(ddx, ddz);
    const sp = dd > 0.05 ? Math.min(speed, dd * 4 + 0.2) : 0;
    if (dd > 1e-6) {
      p.vx = (ddx / dd) * sp;
      p.vz = (ddz / dd) * sp;
      p.angle = Math.atan2(p.vx, p.vz);
    } else { p.vx = 0; p.vz = 0; }
    p.x += p.vx * dt;
    p.z += p.vz * dt;
    p.phase += Math.hypot(p.vx, p.vz) * dt * ANIM_PHASE_PER_M;
  }

  // —— 球员互碰推出（id 升序两两处理；对称各退半穿透量，确定性）——
  for (let i = 0; i < w.players.length; i++) {
    for (let j = i + 1; j < w.players.length; j++) {
      const a = w.players[i], b = w.players[j];
      const dx = b.x - a.x, dz = b.z - a.z;
      const d = Math.hypot(dx, dz);
      const min = PLAYER_RADIUS * 2;
      if (d > 0 && d < min) {
        const pen = (min - d) / 2;
        const nx = dx / d, nz = dz / d;
        a.x = clamp(a.x - nx * pen, -PITCH_HALF_X + PLAYER_RADIUS, PITCH_HALF_X - PLAYER_RADIUS);
        a.z = clamp(a.z - nz * pen, -PITCH_HALF_Z + PLAYER_RADIUS, PITCH_HALF_Z - PLAYER_RADIUS);
        b.x = clamp(b.x + nx * pen, -PITCH_HALF_X + PLAYER_RADIUS, PITCH_HALF_X - PLAYER_RADIUS);
        b.z = clamp(b.z + nz * pen, -PITCH_HALF_Z + PLAYER_RADIUS, PITCH_HALF_Z - PLAYER_RADIUS);
      } else if (d === 0) {
        // 完全重合：按 id 顺序固定方向推开（避免 NaN/抖动）
        a.x = clamp(a.x - PLAYER_RADIUS, -PITCH_HALF_X + PLAYER_RADIUS, PITCH_HALF_X - PLAYER_RADIUS);
        b.x = clamp(b.x + PLAYER_RADIUS, -PITCH_HALF_X + PLAYER_RADIUS, PITCH_HALF_X - PLAYER_RADIUS);
      }
    }
  }

  // —— AI 持球人决策（客队前锋带球 / 门将持球开大脚）——
  if (owner && owner.id !== w.controlledId) {
    ball.holdTimer += dt;
    if (owner.role === "GK") {
      if (ball.holdTimer >= GK_HOLD_SECONDS) {
        // 门将开球：先找真开阔队友；没有就大脚往前场解围（禁传被盯防的人，否则中场白送）
        const mate = bestPassTarget(w, owner);
        if (mate && isOpen(w, mate)) {
          events.push(kickBall(w, owner, mate.x, mate.z, PASS_SPEED * 1.1, "clear"));
        } else {
          const dir = attackDir(owner.team);
          const hoofX = (w.rng() * 2 - 1) * 6;
          events.push(kickBall(w, owner, hoofX, dir * PITCH_HALF_Z * 0.6, SHOT_SPEED * 0.85, "clear", SHOT_SCATTER_AWAY));
        }
      }
    } else if (owner.team === 1) {
      const distPress = homeChaser ? Math.hypot(homeChaser.x - owner.x, homeChaser.z - owner.z) : 99;
      const inShotRange = owner.z > PITCH_HALF_Z - AWAY_SHOT_RANGE_Z && Math.abs(owner.x) < 5.5;
      const closeRange = owner.z > PITCH_HALF_Z - 6.5 && Math.abs(owner.x) < 4.5;
      if (inShotRange && (distPress > 1.8 || (closeRange && distPress > 0.5))) {
        // 起脚门槛（IP-P3 客队出手通道修复，polish 周期 v15）：甩开上抢人 1.8m 可远射；
        // 或小禁区内（closeRange）只要上抢人未贴到脚下（distPress>0.5）即转身起脚——
        // 修前 distPress 恒 ≈PRESS_MARGIN(0.4)+物理抖动 <1.2，门槛结构性不可达：
        // 5 种子全集对局客队 0 射门 0 进球（防守/GK 半场沦为摆设；switch-sim 逐队事件统计实证）。
        // AI 决策阈值属实现层（非 spec.numeric 定稿值）；AWAY_SHOT_RANGE_Z=8 出手距离语义不变。
        const [ax, az] = aimFarCorner(w, owner, PITCH_HALF_Z);
        events.push(kickBall(w, owner, ax, az, SHOT_SPEED, "shot", SHOT_SCATTER_AWAY));
        w.shots += 1;
      } else if (distPress < 1.6) {
        const mate = bestPassTarget(w, owner);
        if (mate && isOpen(w, mate)) {
          events.push(kickBall(w, owner, mate.x, mate.z, PASS_SPEED, "pass"));
        }
      }
    }
  }

  // —— 抢断（贴身泊松尝试；id 升序，命中即断 —— rng 流确定）——
  if (owner) {
    for (const d of w.players) {
      if (d.team === owner.team || d.cooldown > 0) continue;
      const dist = Math.hypot(d.x - owner.x, d.z - owner.z);
      if (dist < TACKLE_RADIUS + PLAYER_RADIUS && w.rng() < 1 - Math.exp(-TACKLE_RATE * dt)) {
        const dx = d.x - owner.x, dz = d.z - owner.z;
        const dd = Math.hypot(dx, dz) || 1e-9;
        ball.owner = null;
        ball.holdTimer = 0;
        ball.vx = (dx / dd) * 4.5;
        ball.vz = (dz / dd) * 4.5;
        ball.lastTouchTeam = d.team;
        ball.cooldown = KICK_COOLDOWN * 0.6;
        owner.cooldown = KICK_COOLDOWN;
        w.possessionChanges += 1;
        events.push({ type: "tackle", by: d.id, from: owner.id, team: d.team });
        break;
      }
    }
  }

  // —— 球运动 / 持球粘连 ——
  ball.cooldown = Math.max(0, ball.cooldown - dt);
  for (const p of w.players) p.cooldown = Math.max(0, p.cooldown - dt);
  if (ball.owner !== null) {
    const o = w.players[ball.owner];
    const [fx, fz] = facing(o.angle);
    ball.x = clamp(o.x + fx * DRIBBLE_LEAD, -PITCH_HALF_X + BALL_RADIUS, PITCH_HALF_X - BALL_RADIUS);
    ball.z = clamp(o.z + fz * DRIBBLE_LEAD, -PITCH_HALF_Z + BALL_RADIUS, PITCH_HALF_Z - BALL_RADIUS);
    ball.vx = 0; ball.vz = 0;
  } else {
    const drag = Math.exp(-1.4 * dt); // 帧率无关摩擦（E-06 配方）
    ball.vx *= drag;
    ball.vz *= drag;
    ball.x += ball.vx * dt;
    ball.z += ball.vz * dt;
    // 边线挡板反弹（笼式小场：无出界死球）
    if (Math.abs(ball.x) > PITCH_HALF_X - BALL_RADIUS) {
      ball.x = clamp(ball.x, -PITCH_HALF_X + BALL_RADIUS, PITCH_HALF_X - BALL_RADIUS);
      ball.vx = -ball.vx * 0.55;
    }
    // 底线：门内 = 进球判定，门外 = 挡板反弹
    for (const g of [{ z: -PITCH_HALF_Z, scoringTeam: 0 }, { z: PITCH_HALF_Z, scoringTeam: 1 }]) {
      if ((g.z < 0 && ball.z < g.z + BALL_RADIUS) || (g.z > 0 && ball.z > g.z - BALL_RADIUS)) {
        if (Math.abs(ball.x) < GOAL_HALF_WIDTH - BALL_RADIUS * 0.5) {
          if (g.scoringTeam === 0) w.score.home += 1; else w.score.away += 1;
          w.goals += 1;
          w.celebrationLeft = GOAL_CELEBRATION_SEC; // 庆祝窗口（冻结在下一步生效；倒计时暂停）
          events.push({ type: "goal", team: g.scoringTeam, score: { ...w.score } });
          kickoffReset(w);
          events.push({ type: "kickoff" });
        } else {
          ball.z = clamp(ball.z, -PITCH_HALF_Z + BALL_RADIUS, PITCH_HALF_Z - BALL_RADIUS);
          ball.vz = -ball.vz * 0.55;
        }
      }
    }
  }

  // —— 捡球（松球且双方冷却过：最近者得球；门将接球半径更大（扑救）；id 升序破平局）——
  if (ball.owner === null) {
    let best = null, bestD = Infinity;
    for (const p of w.players) {
      if (p.cooldown > 0) continue;
      const reach = CONTROL_RADIUS * (p.role === "GK" ? 1.35 : 1) + BALL_RADIUS;
      const d = Math.hypot(p.x - ball.x, p.z - ball.z);
      if (d < reach && d < bestD - 1e-9) { bestD = d; best = p; }
    }
    if (best) {
      ball.owner = best.id;
      ball.holdTimer = 0;
      ball.lastTouchTeam = best.team;
      w.possessionChanges += 1;
    }
  }

  // —— 受控人切换（IP-P1 切换抖振稳定化，polish 周期 v15）——
  // 症状（试玩证据）：线上实局 40s 内 switchCount=70（≈1.8 次/秒，qa/playtest/round-14）——
  // 每帧无条件重算「最近主队非门将」，挤抢/球在飞时受控人逐帧翻走，环脉冲+确认音连发。
  // 规范不变（spec v3 world.selectionHighlight / 教学卡「无球时自动切到离球最近的队友」），
  // 只把「最近」重算工程化成稳定语义，零新增数值（迟滞半径复用 CONTROL_RADIUS，冻结窗复用
  // 既有 ball.cooldown 飞行窗），不触碰 spec.numeric 定稿值：
  //   ① 我方非门将持球 → 立即切持球人（离散事件，契约测试「队友拿球 → 受控切持球人」不变）；
  //   ② 球在飞行窗（ball.cooldown>0，传球/射门/解围/抢断捅出后）→ 保持现受控人不重算
  //      （球速快时最近者逐帧翻转的根因窗口）；
  //   ③ 其余（球滚地无归属 / 对方持球）→ 最近重算加距离迟滞：候选须比现受控人近出
  //      一个 CONTROL_RADIUS 才接管（两名防守人并拢逼近不再乒乓）。
  {
    const owner = ball.owner !== null ? w.players[ball.owner] : null;
    if (owner && owner.team === 0 && owner.role !== "GK") {
      w.controlledId = owner.id;
    } else if (ball.cooldown > 0) {
      // 飞行窗：保持现受控人（离散事件沿才会改变控制权）
    } else {
      const cand = nearestHomeFielder(w.players, ball.x, ball.z);
      if (cand !== w.controlledId) {
        const cur = w.players[w.controlledId];
        const dCur = cur ? Math.hypot(cur.x - ball.x, cur.z - ball.z) : Infinity;
        const dCand = Math.hypot(w.players[cand].x - ball.x, w.players[cand].z - ball.z);
        if (dCand + CONTROL_RADIUS < dCur) w.controlledId = cand;
      }
    }
  }

  // —— 计时与终局（1e-9 容差：浮点步进累加后恰好 90s 不得漏判）——
  w.timeLeft = Math.max(0, w.timeLeft - dt);
  if (w.timeLeft <= 1e-9) {
    w.over = true;
    w.won = w.score.home > w.score.away ? "home" : w.score.home < w.score.away ? "away" : "draw";
    events.push({ type: "gameover", won: w.won, score: { ...w.score } });
  }
  return events;
}

/** 开球重置：全部球员回开球阵型、球回中点（进球/重开共用；E-10 全复位口径） */
export function kickoffReset(w) {
  const spots = kickoffFormation();
  for (const p of w.players) {
    const s = spots[p.id];
    p.x = s.x; p.z = s.z; p.vx = 0; p.vz = 0; p.cooldown = 0;
    p.targetX = s.x; p.targetZ = s.z;
    p.angle = p.team === 0 ? Math.PI / 2 : -Math.PI / 2;
  }
  w.ball.x = 0; w.ball.z = 0; w.ball.vx = 0; w.ball.vz = 0;
  w.ball.owner = null; w.ball.cooldown = 0.3; w.ball.holdTimer = 0;
  w.controlledId = nearestHomeFielder(w.players, 0, 0);
}
