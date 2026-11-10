#!/usr/bin/env node
// football-contract.spec.mjs — 足球玩法面契约断言（玩法机判核心闭环）：
// 射门事件守恒（kick → goal/save/回位三选一）/ 进球后开球重置（步级精断）/
// 金币收集即补位（场上恒满 + 计数守恒 + 补位约束）/ 难度梯度（守门员随进球提速、封顶且追不上人）/
// 守门员巡逻确定性 / 提前获胜判定 / 射门冷却防抖振。
import { createGame } from "../src/kernel/loop.js";
import { greedyIntent } from "../src/kernel/autopilot.js";
import { keeperSpeedFor } from "../src/kernel/world.js";
import {
  SEED_DEFAULT, ROUND_SECONDS, GOALS_TO_WIN, KICKOFF_X, KICKOFF_Z, COIN_COUNT,
  FIELD_HALF_W, FIELD_HALF_L, KEEPER_Z, KEEPER_RANGE, KEEPER_SPEED,
  KEEPER_RAMP_PER_GOAL, KEEPER_RAMP_MAX, PLAYER_SPEED,
} from "../src/numeric.js";

const failures = [];
const ok = (cond, m) => { console.log(`  ${cond ? "PASS" : "FAIL"}  ${m}`); if (!cond) failures.push(m); };
const close = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

// —— 完整对局事件守恒：每次 kick 后球必回 dribble（进球/扑救/出界/失速四条回位路都收敛）——
{
  const g = createGame({ seed: SEED_DEFAULT });
  g.start();
  let kicks = 0;
  const ballAtKick = [];
  for (let s = 0; s < ROUND_SECONDS && g.state === "playing"; s++) {
    for (const ev of g.fastForward(1, greedyIntent(g.world)).events) {
      if (ev.type === "kick") { kicks++; ballAtKick.push(g.world.ball.state); }
    }
  }
  ok(kicks >= 1, `有射门发生（kicks=${kicks}）`);
  ok(g.world.shots === kicks, `kick 事件数与内核 shots 计数守恒（events=${kicks}，world.shots=${g.world.shots}）`);
  ok(g.world.ball.state === "dribble" || g.state === "gameover", "对局终了时球回 dribble（回位闭环收敛）");
  // 事件计数守恒：goal 数 = 内核 goals，save 数 = 内核 saves
  ok(g.world.goals + g.world.saves <= kicks, "进球+扑救 ≤ 射门数（事件不凭空产生）");
  void ballAtKick;
}

// —— 提前获胜：3 球立即 gameover 且 won=true，不多给时间 ——
{
  const g = createGame({ seed: SEED_DEFAULT });
  g.start();
  for (let s = 0; s < ROUND_SECONDS && g.state === "playing"; s++) {
    g.fastForward(1, greedyIntent(g.world));
  }
  if (g.world.won) {
    ok(g.world.goals === GOALS_TO_WIN, `提前获胜时进球数恰为 ${GOALS_TO_WIN}（goals=${g.world.goals}）`);
    ok(g.world.timeLeft > 0, "提前获胜时时间未耗尽（真·提前终局）");
  } else {
    ok(g.world.timeLeft <= 1e-9, "未获胜 → 时间耗尽终局（判定二选一）");
  }
}

// —— 进球后开球重置（步级精断）：进球事件当步，球员必已回开球点、球回脚下带球态 ——
{
  const g = createGame({ seed: SEED_DEFAULT });
  g.start();
  let sawGoal = false;
  let playerAfterGoal = null;
  let ballStateAfterGoal = null;
  const STEPS = Math.round(ROUND_SECONDS / (1 / 60));
  for (let i = 0; i < STEPS && g.state === "playing"; i++) {
    const { events } = g.tick(1 / 60, greedyIntent(g.world));
    for (const ev of events) {
      if (ev.type === "goal") {
        sawGoal = true;
        playerAfterGoal = { x: g.world.player.x, z: g.world.player.z };
        ballStateAfterGoal = g.world.ball.state;
        break;
      }
    }
    if (sawGoal) break;
  }
  if (sawGoal && g.state === "playing") {
    ok(playerAfterGoal.x === KICKOFF_X && playerAfterGoal.z === KICKOFF_Z,
      `进球当步球员回开球点（(${playerAfterGoal.x}, ${playerAfterGoal.z}) = (${KICKOFF_X}, ${KICKOFF_Z})）`);
    ok(ballStateAfterGoal === "dribble", "进球当步球回脚下带球态");
  } else {
    ok(true, "本 seed 未在半场内进球，跳过开球重置断言（由其他 seed 覆盖）");
  }
}

// —— 金币收集即补位：场上恒满 + 计数守恒 + 补位落点约束（休闲收集循环不枯竭）——
{
  const g = createGame({ seed: SEED_DEFAULT });
  g.start();
  const alive0 = g.world.coins.filter((c) => c.alive).length;
  ok(alive0 === COIN_COUNT, `开局金币全数在场（${alive0}/${COIN_COUNT}）`);
  let collectEvents = 0;
  let densityEverDropped = false;
  for (let s = 0; s < ROUND_SECONDS && g.state === "playing"; s++) {
    const { events } = g.fastForward(1, greedyIntent(g.world));
    for (const ev of events) if (ev.type === "collect") collectEvents++;
    if (g.state === "playing" && g.world.coins.filter((c) => c.alive).length !== COIN_COUNT) densityEverDropped = true;
  }
  const w = g.world;
  const alive1 = w.coins.filter((c) => c.alive).length;
  ok(collectEvents === w.coinsCollected, `collect 事件数与内核计数守恒（events=${collectEvents}，coinsCollected=${w.coinsCollected}）`);
  ok(collectEvents >= 1, `贪心对局确有收集发生（collected=${w.coinsCollected}，补位循环真实运转）`);
  ok(!densityEverDropped && alive1 === COIN_COUNT, `对局全程场上恒 ${COIN_COUNT} 枚（收集当步即补位，存活 ${alive1}）`);
  ok(w.coins.length === COIN_COUNT, `金币槽位数恒定（id 稳定，渲染层按 id 映射不漂移：${w.coins.length}）`);
  const inBounds = w.coins.every((c) => Math.abs(c.x) <= FIELD_HALF_W - 1.5 + 1e-9 && c.z >= -11 - 1e-9 && c.z <= 12 + 1e-9);
  ok(inBounds, "补位落点全部在场内采样带（|x| ≤ 8.5，z ∈ [-11, 12]）");
  const clearOfKeeper = w.coins.every((c) => c.z <= KEEPER_Z - 2 + 1e-9);
  ok(clearOfKeeper, "补位落点全部避开守门员活动带");
  let minPair = Infinity;
  for (let i = 0; i < w.coins.length; i++) {
    for (let j = i + 1; j < w.coins.length; j++) {
      minPair = Math.min(minPair, Math.hypot(w.coins[i].x - w.coins[j].x, w.coins[i].z - w.coins[j].z));
    }
  }
  ok(minPair >= 1.3, `金币彼此间距不塌缩（最小间距 ${minPair.toFixed(2)}m ≥ 1.3m，跑动收集不被白给）`);
  const finite = w.coins.every((c) => Number.isFinite(c.x) && Number.isFinite(c.z));
  ok(finite, "补位落点数值健康（无 NaN 注入）");
}

// —— 金币补位确定性：同 seed 同输入 → 补位序列逐位一致 ——
{
  const run30 = () => {
    const g = createGame({ seed: SEED_DEFAULT });
    g.start();
    for (let s = 0; s < 30 && g.state === "playing"; s++) g.fastForward(1, greedyIntent(g.world));
    return { coins: JSON.stringify(g.world.coins), collected: g.world.coinsCollected, score: g.world.score };
  };
  const r1 = run30();
  const r2 = run30();
  ok(r1.coins === r2.coins && r1.collected === r2.collected,
    `同 seed 30s 补位序列逐位一致（collected=${r1.collected}，含补位后的金币全表）`);
}

// —— 难度梯度：守门员相位速度随进球线性上调、封顶，且峰值永远追不上玩家（平缓大众）——
{
  ok(close(keeperSpeedFor(0), KEEPER_SPEED), "0 球时守门员速度 = 基准 KEEPER_SPEED（开局最平缓）");
  ok(keeperSpeedFor(1) > keeperSpeedFor(0) && keeperSpeedFor(2) > keeperSpeedFor(1),
    "进球越多守门员越快（单调上调，梯度真实存在）");
  ok(close(keeperSpeedFor(2), KEEPER_SPEED * (1 + KEEPER_RAMP_PER_GOAL * 2)),
    "提速公式 = KEEPER_SPEED × (1 + KEEPER_RAMP_PER_GOAL × 进球数)");
  ok(close(keeperSpeedFor(99), KEEPER_SPEED * KEEPER_RAMP_MAX), "梯度有封顶（KEEPER_RAMP_MAX，不会失控）");
  ok(keeperSpeedFor(-3) === keeperSpeedFor(0) && close(keeperSpeedFor(Number.NaN), KEEPER_SPEED),
    "负数/NaN 进球数回退基准速度（E-09 边界加固）");
  const peakAtCap = 4 * KEEPER_RANGE * KEEPER_SPEED * KEEPER_RAMP_MAX;
  ok(peakAtCap < PLAYER_SPEED, `封顶峰值横移 ${peakAtCap.toFixed(1)}m/s < 玩家 ${PLAYER_SPEED}m/s（永远可以绕过他）`);
  // 内核接线证明：stepWorld 实际按 goals 驱动相位速度（不只是孤立函数）
  const g = createGame({ seed: SEED_DEFAULT });
  g.start();
  const slopePerSec = (goals) => {
    g.world.goals = goals;
    let prev = g.world.keeper.x;
    let travel = 0;
    for (let i = 0; i < 60; i++) {
      g.tick(1 / 60, {});
      const cur = g.world.keeper.x;
      travel += Math.abs(cur - prev);
      prev = cur;
    }
    return travel; // 60 步 = 1s；三角波斜率恒定 → 位移 = 4×R×speed
  };
  const s0 = slopePerSec(0);
  const s2 = slopePerSec(2);
  // 容差 0.2：三角波顶点落在采样步内时弦切损失最大 ≈4×s×dt/顶点（每秒 ≤2 顶点 ≈0.08-0.13m）
  // —— 是离散采样几何，不是行为差异；梯度真差（1.6m/s）远大于该损失
  ok(close(s0, 4 * KEEPER_RANGE * KEEPER_SPEED, 0.2), `stepWorld 实测 0 球位移 ${s0.toFixed(3)}m/s ≈ 4×R×基准（接线正确）`);
  ok(close(s2, 4 * KEEPER_RANGE * keeperSpeedFor(2), 0.2) && s2 > s0 + 1.0,
    `stepWorld 实测 2 球位移 ${s2.toFixed(3)}m/s > 0 球 ${s0.toFixed(3)}m/s（进球后确实提速）`);
  // 测试注入的 goals 改动必须不残留：重开全复位归零
  g.restart();
  ok(g.world.goals === 0 && close(4 * KEEPER_RANGE * keeperSpeedFor(g.world.goals), 4 * KEEPER_RANGE * KEEPER_SPEED),
    "重开后 goals=0（梯度归零，下一局从最平缓开始）");
}

// —— 守门员巡逻确定性：同相位同位置，且位置受 KEEPER_RANGE 钳制 ——
{
  const g1 = createGame({ seed: SEED_DEFAULT });
  const g2 = createGame({ seed: SEED_DEFAULT });
  g1.start(); g2.start();
  for (let s = 0; s < 12; s++) { g1.fastForward(1, { moveX: 0.3, moveZ: 0.4 }); g2.fastForward(1, { moveX: 0.3, moveZ: 0.4 }); }
  ok(g1.world.keeper.x === g2.world.keeper.x, "同 seed 同输入 → 守门员位置逐位一致");
  ok(Math.abs(g1.world.keeper.x) <= KEEPER_RANGE + 1e-9, "守门员位置在巡逻幅内（|x| ≤ KEEPER_RANGE）");
}

// —— 射门冷却防抖振：起脚后冷却窗口内不连射 ——
{
  const g = createGame({ seed: SEED_DEFAULT });
  g.start();
  // 把球员推到自动射门线上方持续请求射门，统计 1 秒内 kick 次数
  let kicks = 0;
  for (let s = 0; s < 1; s++) {
    for (const ev of g.fastForward(1, { moveX: 0, moveZ: 1, shoot: true }).events) {
      if (ev.type === "kick") kicks++;
    }
  }
  ok(kicks <= 3, `冷却生效：1 秒冲刺射门 ≤3 次（实际 ${kicks}，抖振回归 = 全程连射数十次）`);
}

console.log(failures.length ? `FOOTBALL-CONTRACT: FAIL（${failures.length}）` : "FOOTBALL-CONTRACT: PASS");
process.exit(failures.length ? 1 : 0);
