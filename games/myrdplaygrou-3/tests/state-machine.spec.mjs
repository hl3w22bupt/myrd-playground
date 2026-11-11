#!/usr/bin/env node
// state-machine.spec.mjs — 状态机边界对抗断言（E-10 口径，常驻）：
// 非法转移 no-op + warning / 暂停连按 / 结算瞬间输入 / 重开连点 / 中途重开全复位 / 零 NaN 污染。
import { createGame } from "../src/kernel/loop.js";
import { SEED_DEFAULT, ROUND_SECONDS, TEAM_SIZE } from "../src/numeric.js";

const failures = [];
const ok = (cond, m) => { console.log(`  ${cond ? "PASS" : "FAIL"}  ${m}`); if (!cond) failures.push(m); };

// —— 非法转移全部拒绝 ——
{
  const g = createGame({ seed: SEED_DEFAULT });
  ok(g.pause() === false && g.state === "title", "title 态 pause 拒绝");
  ok(g.restart() === false && g.state === "title", "title 态 restart 拒绝");
  g.start();
  ok(g.start() === true && g.state === "playing", "playing 态 start 幂等");
  const w0 = JSON.stringify(g.world.players.map((p) => [p.x, p.z]));
  g.pause();
  g.tick(1, { moveX: 1, moveZ: 0, pass: false, shoot: false }); // paused 零推进
  ok(JSON.stringify(g.world.players.map((p) => [p.x, p.z])) === w0
    && Math.abs(g.world.timeLeft - ROUND_SECONDS) < 1e-9, "paused 态 tick 零推进（时间冻结）");
}

// —— 暂停连按 ≥5：状态始终合法，无幽灵态 ——
{
  const g = createGame({ seed: SEED_DEFAULT });
  g.start();
  for (let i = 0; i < 5; i++) { g.pause(); g.resume(); }
  ok(g.state === "playing", "暂停/恢复连按 5 轮 → 回到 playing");
  const r = g.tick(1 / 60, { moveX: 1, moveZ: 0, pass: false, shoot: false });
  ok(r.stepped === 1, "连按后 tick 正常推进（无残留冻结）");
}

// —— 结算瞬间继续输入：over 后内核零推进、事件不再产生 ——
{
  const g = createGame({ seed: SEED_DEFAULT });
  g.start();
  g.fastForward(ROUND_SECONDS + 1, { moveX: 1, moveZ: 0, pass: false, shoot: false });
  ok(g.state === "gameover", "超时快进 → gameover");
  const before = JSON.stringify(g.world.players.map((p) => [p.x, p.z]));
  const r = g.tick(0.5, { moveX: 1, moveZ: 1, pass: true, shoot: true });
  ok(JSON.stringify(g.world.players.map((p) => [p.x, p.z])) === before && r.stepped === 0,
    "gameover 后 tick 零推进（结算瞬间输入被冻结）");
}

// —— 重开连点 ≥5：每次都全复位（E-10：整 world 重建）——
{
  const g = createGame({ seed: SEED_DEFAULT });
  g.start();
  g.fastForward(20, { moveX: 1, moveZ: 0, pass: false, shoot: false });
  const dirtyState = g.world.possessionChanges > 0 || g.world.score.home > 0 || g.world.timeLeft < ROUND_SECONDS;
  for (let i = 0; i < 5; i++) ok(g.restart() === true, `重开 #${i + 1} 成功`);
  ok(g.state === "playing", "重开连点后仍在 playing");
  ok(g.world.score.home === 0 && g.world.score.away === 0 && g.world.possessionChanges === 0
    && g.world.timeLeft === ROUND_SECONDS && g.world.over === false && g.world.goals === 0,
    `重开后全复位（score/possession/timeLeft/goals${dirtyState ? "，此前确实有脏状态被清掉" : ""}）`);
  ok(g.world.players.length === TEAM_SIZE * 2, "重开后 5v5 阵伍完整重建");
  ok(g.warnings.length === 0, "重开连点零 warning（每次都是合法转移）");
}

// —— 中途重开 + 数值健康：极端意图不产生 NaN ——
{
  const g = createGame({ seed: SEED_DEFAULT });
  g.start();
  g.tick(1 / 60, { moveX: 1e9, moveZ: NaN, pass: "x", shoot: 42 });
  g.restart();
  ok(Number.isFinite(g.world.players[0].x) && Number.isFinite(g.world.players[0].z), "极端意图后重开 → 坐标有限（无 NaN 污染）");
  ok(Number.isFinite(g.world.timeLeft) && g.world.timeLeft === ROUND_SECONDS, "重开后计时器复位且有限");
  ok(Number.isFinite(g.world.ball.x) && Number.isFinite(g.world.ball.z), "球坐标有限");
}

console.log(failures.length ? `STATE-MACHINE: FAIL（${failures.length}）` : "STATE-MACHINE: PASS");
process.exit(failures.length ? 1 : 0);
