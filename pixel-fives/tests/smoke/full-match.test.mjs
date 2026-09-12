/**
 * acc-01 完整对局冒烟（DoD#3 冒烟门禁）。
 * 零依赖：node pixel-fives/tests/smoke/full-match.test.mjs → JSON 指标 + exit 0/1。
 *
 * 内容：bot vs bot（seed 42）从开球踢到 90s 终局，全程零报错；
 *      输出结构化指标 fps_min ≥ 58、frame_time_p95_ms ≤ 18、errors = 0。
 *
 * 指标口径（headless 语义）：以 60Hz 固定步长连续推进 5400 tick，逐 tick 丈量
 * 墙钟耗时（只用于门禁，不进 sim）：frame_time_p95_ms = 单 tick 耗时 P95；
 * fps_min = 每 60-tick 窗口的可持续帧率最小值。模拟核远低于 16.7ms 帧预算即得高分；
 * 真实浏览器渲染帧率由 web build 的 FPS 覆盖层人核（渲染层不在本 headless 门禁内）。
 */
import { performance } from 'node:perf_hooks';
import { Match } from '../../src/core/match.js';
import { BotController } from '../../src/ai/bot.js';
import { TICK_DT_S, MATCH_DURATION_S, BOT_SIM_SEEDS, BOT_SIM_RANGES } from '../../src/core/constants.js';

const results = [];
let failures = 0;
function check(name, cond, detail) {
  if (!cond) failures += 1;
  results.push({ name, pass: !!cond, detail: detail ?? null });
}
function approx(a, b, eps = 1e-6) {
  return Math.abs(a - b) <= eps;
}

const SEED = BOT_SIM_SEEDS.start; // 42（QA 同一套种子的首 seed）
const match = new Match({ seed: SEED });
const botRed = new BotController('red', SEED, match.level);
const botBlue = new BotController('blue', SEED, match.level);

const totalTicks = Math.round(MATCH_DURATION_S / TICK_DT_S); // 5400
const tickMs = new Array(totalTicks);
const errors = [];

try {
  for (let t = 0; t < totalTicks; t++) {
    const t0 = performance.now();
    const iRed = botRed.decide(match.world);
    const iBlue = botBlue.decide(match.world);
    match.step(TICK_DT_S, iRed, iBlue);
    const t1 = performance.now();
    tickMs[t] = t1 - t0;
  }
} catch (err) {
  errors.push(`${err && err.stack ? err.stack : String(err)}`);
}

// ---------- 完整对局 ----------
check('S1 全程零报错（errors=0）', errors.length === 0, errors.join(' | ') || null);
check('S2 终局阶段 fulltime', match.phase === 'fulltime', match.phase);
check('S3 计时走满 90s', approx(match.timeS, MATCH_DURATION_S), String(match.timeS));

const goalsTotal = match.scores.red + match.scores.blue;
check('S4 总进球落在门禁区间 [1,12]（bot_sim.goal_range）',
  goalsTotal >= BOT_SIM_RANGES.GOALS[0] && goalsTotal <= BOT_SIM_RANGES.GOALS[1],
  `red ${match.scores.red} : blue ${match.scores.blue}`);
check('S5 duration_s 落在 [80,100]（bot_sim.duration_in_range_s）',
  match.timeS >= BOT_SIM_RANGES.DURATION_S[0] && match.timeS <= BOT_SIM_RANGES.DURATION_S[1],
  String(match.timeS));

// ---------- 结构化性能指标 ----------
function p95(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.floor(s.length * 0.95));
  return s[idx];
}
const frameTimeP95 = p95(tickMs);
let fpsMin = Infinity;
for (let w = 0; w + 60 <= tickMs.length; w += 60) {
  let sum = 0;
  for (let i = w; i < w + 60; i++) sum += tickMs[i];
  const winMs = Math.max(sum, 0.001); // 0ms 窗口（快于计时分辨率）按 0.001ms 计
  const fps = 60000 / winMs; // 60 tick / (winMs/1000)
  if (fps < fpsMin) fpsMin = fps;
}

check('S6 frame_time_p95_ms ≤ 18', frameTimeP95 <= 18, `${frameTimeP95.toFixed(4)}ms`);
check('S7 fps_min ≥ 58', fpsMin >= 58, `${fpsMin.toFixed(1)}fps`);

// ---------- 对局可玩性侧面证据 ----------
check('S8 有射门发生（shots > 0）', match.world.totalShots() > 0, String(match.world.totalShots()));
check('S9 有触球发生（touches > 0）', match.world.totalTouches() > 0, String(match.world.totalTouches()));

// ---------- 摘要（JSON 指标） ----------
const summary = {
  test: 'smoke/full-match',
  seed: SEED,
  ticks: totalTicks,
  score: { red: match.scores.red, blue: match.scores.blue },
  goals_total: goalsTotal,
  duration_s: match.timeS,
  fps_min: Number(fpsMin.toFixed(2)),
  frame_time_p95_ms: Number(frameTimeP95.toFixed(4)),
  shots: match.world.totalShots(),
  touches: match.world.totalTouches(),
  errors,
  failures,
  results,
};
process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
process.exit(failures === 0 && errors.length === 0 ? 0 : 1);
