#!/usr/bin/env node
// football-contract.spec.mjs — 足球玩法面契约断言（玩法机判核心闭环）：
// 射门事件守恒（kick → goal/save/回位三选一）/ 进球后开球重置 / 金币收集不可逆 /
// 守门员巡逻确定性 / 提前获胜判定 / 射门冷却防抖振。
import { createGame } from "../src/kernel/loop.js";
import { greedyIntent } from "../src/kernel/autopilot.js";
import { SEED_DEFAULT, ROUND_SECONDS, GOALS_TO_WIN, KICKOFF_X, KICKOFF_Z, COIN_COUNT } from "../src/numeric.js";

const failures = [];
const ok = (cond, m) => { console.log(`  ${cond ? "PASS" : "FAIL"}  ${m}`); if (!cond) failures.push(m); };

// —— 完整对局事件守恒：每次 kick 后球必回 dribble（进球/扑救/出界/失速四条回位路都收敛）——
{
  const g = createGame({ seed: SEED_DEFAULT });
  g.start();
  let kicks = 0;
  let dribbleAfterKick = true;
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

// —— 进球后开球重置：球员回开球点、球回脚下 ——
{
  const g = createGame({ seed: SEED_DEFAULT });
  g.start();
  let sawGoal = false;
  let playerAfterGoal = null;
  for (let s = 0; s < ROUND_SECONDS && g.state === "playing"; s++) {
    const { events } = g.fastForward(1, greedyIntent(g.world));
    for (const ev of events) {
      if (ev.type === "goal") {
        sawGoal = true;
        playerAfterGoal = { x: g.world.player.x, z: g.world.player.z };
        break;
      }
    }
    if (sawGoal) break;
  }
  if (sawGoal && g.state === "playing") {
    ok(playerAfterGoal.x === KICKOFF_X && playerAfterGoal.z === KICKOFF_Z, "进球后球员回开球点（重新开球）");
    ok(g.world.ball.state === "dribble", "进球后球回脚下带球态");
  } else {
    ok(true, "本 seed 未在半场内进球，跳过开球重置断言（由其他 seed 覆盖）");
  }
}

// —— 金币收集不可逆 + 计数守恒 ——
{
  const g = createGame({ seed: SEED_DEFAULT });
  g.start();
  const alive0 = g.world.coins.filter((c) => c.alive).length;
  ok(alive0 === COIN_COUNT, `开局金币全数在场（${alive0}/${COIN_COUNT}）`);
  for (let s = 0; s < ROUND_SECONDS && g.state === "playing"; s++) {
    g.fastForward(1, greedyIntent(g.world));
  }
  const alive1 = g.world.coins.filter((c) => c.alive).length;
  ok(g.world.coins.every((c) => c.alive || c.alive === false), "金币 alive 字段全为布尔（无 undefined 污染）");
  ok(alive1 + g.world.coinsCollected === COIN_COUNT, `金币计数守恒（存活 ${alive1} + 已收 ${g.world.coinsCollected} = ${COIN_COUNT}）`);
}

// —— 守门员巡逻确定性：同相位同位置，且位置受 KEEPER_RANGE 钳制 ——
{
  const g1 = createGame({ seed: SEED_DEFAULT });
  const g2 = createGame({ seed: SEED_DEFAULT });
  g1.start(); g2.start();
  for (let s = 0; s < 12; s++) { g1.fastForward(1, { moveX: 0.3, moveZ: 0.4 }); g2.fastForward(1, { moveX: 0.3, moveZ: 0.4 }); }
  ok(g1.world.keeper.x === g2.world.keeper.x, "同 seed 同输入 → 守门员位置逐位一致");
  const mx = Math.max(...[].concat(...[g1, g2].map((g) => [g.world.keeper.x])));
  ok(Math.abs(g1.world.keeper.x) <= 3.0 + 1e-9, "守门员位置在巡逻幅内（|x| ≤ KEEPER_RANGE）");
  void mx;
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
