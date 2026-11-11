#!/usr/bin/env node
// kernel-determinism.spec.mjs — 内核确定性门禁：同 seed 同输入序列 → 同最终状态；
// 异 seed → 对局轨迹不同。零 three 零 DOM，Node 直接跑（P3 口径的测试侧证明）。
import { createGame } from "../src/kernel/loop.js";
import { footballIntent } from "../src/kernel/autopilot.js";
import { SEED_DEFAULT, ROUND_SECONDS } from "../src/numeric.js";

const failures = [];
const ok = (cond, m) => { console.log(`  ${cond ? "PASS" : "FAIL"}  ${m}`); if (!cond) failures.push(m); };

// 同 seed 两次完整对局：全程意图序列一致 → 最终状态逐字段一致
// 循环上限 = 90s 净比赛 + 60s 余量（v3 进球庆祝冻结：庆祝暂停不计入比赛时间，
// 每球多冻结 1.2s —— gameover 以 timeLeft 归零为准，不按墙钟循环数）
const snapOf = (seed) => {
  const g = createGame({ seed });
  g.start();
  for (let s = 0; s < ROUND_SECONDS + 60 && g.state === "playing"; s++) {
    g.fastForward(1, footballIntent(g.world));
  }
  const w = g.world;
  return JSON.stringify({
    score: w.score, pc: w.possessionChanges, shots: w.shots, timeLeft: w.timeLeft, over: w.over, won: w.won,
    players: w.players.map((p) => [p.x.toFixed(3), p.z.toFixed(3), p.phase.toFixed(3)]),
    ball: [w.ball.x.toFixed(3), w.ball.z.toFixed(3)],
  });
};
const a = snapOf(SEED_DEFAULT);
const b = snapOf(SEED_DEFAULT);
ok(a === b, "同 seed 同意图序列 → 终局状态逐字段一致");

// 异 seed：对局轨迹必须不同（抢断/散射由 rng 驱动）
ok(snapOf(1) !== snapOf(2), "异 seed → 对局终态不同");

// 对局真实推进：自动驾驶完整对局（事件上抛 + 终局闭环 + 庆祝冻结语义）
const g = createGame({ seed: SEED_DEFAULT });
g.start();
let goals = 0;
let totalAdvanced = 0;
for (let s = 0; s < ROUND_SECONDS + 60 && g.state === "playing"; s++) {
  const r = g.fastForward(1, footballIntent(g.world));
  totalAdvanced += r.events.length >= 0 ? 1 : 0;
  for (const ev of r.events) {
    if (ev.type === "goal") goals++;
  }
}
ok(g.state === "gameover", "自动驾驶后终局（90s 净比赛 + 庆祝冻结余量闭环）");
ok(g.world.timeLeft <= 1e-9, "净比赛计时走完（timeLeft 归零；庆祝冻结不计入比赛时间）");
ok(Number.isFinite(g.world.score.home) && Number.isFinite(g.world.timeLeft), "终局数值健康（无 NaN）");
ok(g.world.possessionChanges >= 20, `球权易手 ≥20（实测 ${g.world.possessionChanges}，5v5 争抢闭环非摆设）`);
ok(goals === 0 || g.world.celebrationLeft === 0, "终局时庆祝窗已耗尽（celebrationLeft 归零）");

console.log(failures.length ? `KERNEL-DETERMINISM: FAIL（${failures.length}）` : "KERNEL-DETERMINISM: PASS");
process.exit(failures.length ? 1 : 0);
