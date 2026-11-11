#!/usr/bin/env node
// switch-sim.mjs — 打磨轮机判仪器（非门禁判定器）：确定性内核全集对局模拟，
// 量化「控制权切换抖振 / 射门 / 进球 / 持球权易主」，跨轮（改前 vs 改后）同种子可比。
// 用法：node qa/playtest/switch-sim.mjs --label before --out qa/playtest/switch-sim-before.json
// 口径：固定种子集 [333,7,42,2026,11]，每种子 1 场 90s 净比赛（autopilot=footballIntent），
// 逐固定步长 tick 统计：switches（controlledId 变化次数，与 selection-ring.switchCount 同口径）、
// maxHoldSec（单次控制权最长持有时长）、shots/goals/score/possessionChanges。
// 注：本脚本只读内核，不做任何写副作用；不触碰门禁判定脚本（红线）。
import { createGame } from "../../src/kernel/loop.js";
import { footballIntent } from "../../src/kernel/autopilot.js";
import { FIXED_STEP } from "../../src/numeric.js";
import { writeFileSync } from "node:fs";

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const label = arg("--label", "unlabeled");
const out = arg("--out", "");

const SEEDS = [333, 7, 42, 2026, 11];
const MAX_STEPS = Math.round(150 / FIXED_STEP); // 上限 150s 净步数（90s 比赛 + 庆祝冻结窗冗余）

const rows = [];
for (const seed of SEEDS) {
  const g = createGame({ seed });
  g.start();
  let switches = 0, cur = g.world.controlledId, holdSteps = 0, maxHoldSteps = 0;
  let firstShotStep = -1, firstGoalStep = -1, steps = 0;
  let homeShots = 0, awayShots = 0;
  const shotsBefore = g.world.shots, goalsBefore = g.world.goals;
  while (steps < MAX_STEPS && g.state === "playing") {
    const r = g.tick(FIXED_STEP, footballIntent(g.world));
    steps += 1;
    for (const e of r.events) {
      if (e.type === "shot") { if (e.team === 0) homeShots += 1; else awayShots += 1; }
    }
    if (g.world.controlledId !== cur) {
      switches += 1;
      maxHoldSteps = Math.max(maxHoldSteps, holdSteps);
      holdSteps = 0;
      cur = g.world.controlledId;
    } else {
      holdSteps += 1;
    }
    if (firstShotStep < 0 && g.world.shots > shotsBefore) firstShotStep = steps;
    if (firstGoalStep < 0 && g.world.goals > goalsBefore) firstGoalStep = steps;
  }
  maxHoldSteps = Math.max(maxHoldSteps, holdSteps);
  const w = g.world;
  rows.push({
    seed,
    steps,
    gameOver: w.over,
    score: { ...w.score },
    shots: w.shots, goals: w.goals,
    homeShots, awayShots,
    possessionChanges: w.possessionChanges,
    switches,
    switchesPer10s: Math.round((switches / (steps * FIXED_STEP)) * 100) / 10,
    maxHoldSec: Math.round(maxHoldSteps * FIXED_STEP * 10) / 10,
    firstShotSec: firstShotStep < 0 ? null : Math.round(firstShotStep * FIXED_STEP * 10) / 10,
    firstGoalSec: firstGoalStep < 0 ? null : Math.round(firstGoalStep * FIXED_STEP * 10) / 10,
  });
}

const agg = (k) => rows.reduce((a, r) => a + r[k], 0) / rows.length;
const result = {
  label, simulatedAt: new Date().toISOString(), seeds: SEEDS,
  rows,
  aggregate: {
    switchesMean: Math.round(agg("switches") * 10) / 10,
    switchesPer10sMean: Math.round(agg("switchesPer10s") * 10) / 10,
    maxHoldSecMean: Math.round(agg("maxHoldSec") * 10) / 10,
    shotsMean: Math.round(agg("shots") * 10) / 10,
    goalsMean: Math.round(agg("goals") * 10) / 10,
    homeGoals: rows.reduce((a, r) => a + r.score.home, 0),
    awayGoals: rows.reduce((a, r) => a + r.score.away, 0),
    awayShots: rows.reduce((a, r) => a + r.awayShots, 0),
    homeShots: rows.reduce((a, r) => a + r.homeShots, 0),
    firstShotSecMean: (() => { const v = rows.filter((r) => r.firstShotSec != null).map((r) => r.firstShotSec); return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null; })(),
  },
};
console.log(JSON.stringify(result, null, 1));
if (out) writeFileSync(out, JSON.stringify(result, null, 1) + "\n");
