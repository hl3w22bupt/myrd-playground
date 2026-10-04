/**
 * 「局末 → 结算 → 重开」全链路冒烟（spec §levels.pitch.match_flow.fulltime：
 * 「终局：计时归零冻结对局，显示终局比分；平局合法；提供『再来一局』重开（比分清零）」）。
 *
 * 零依赖：node pixel-fives/tests/smoke/fulltime-restart.test.mjs → JSON 摘要 + exit 0/1。
 *
 * 断言链：
 *  A 局末（fulltime）：bot vs bot（seed 42，与 full-match 同种子同口径）踢满 90s →
 *    phase=fulltime、计时归零、终局比分可读；
 *  B 结算冻结：fulltime 后继续 step() 不再推进（比分/计时/球位置全冻结，timeLeftS=0）；
 *  C 重开（core Match.restart()）：比分清零、计时归零、阶段回 playing、庆祝/音效/触球
 *    痕迹清空、el-05/06/07 复位（速度清零）、onboarding 提示重新可见；
 *  D 重开可玩：restart() 后换新控制器能再踢完整一局到 fulltime（零报错、有射门有触球）；
 *  E 重开复现性（web 层 setup() 语义 = 全新 Match + 全新 BotController）：同 seed 从头
 *    再踢一局，逐 tick 采样与首局一致（R-08 确定性纪律在重开场景的体现）。
 *
 * 推进口径与 smoke/full-match 相同（DR-P3）：以 fulltime 为准推进，硬上限仅防挂死。
 */
import { performance } from 'node:perf_hooks';
import { Match } from '../../src/core/match.js';
import { BotController } from '../../src/ai/bot.js';
import { TICK_DT_S, MATCH_DURATION_S, BOT_SIM_SEEDS } from '../../src/core/constants.js';

const SEED = BOT_SIM_SEEDS.start; // 42（QA 同一套种子的首 seed）
const NO_INTENT = { moveX: 0, moveY: 0, kick: false };
const totalTicks = Math.round(MATCH_DURATION_S / TICK_DT_S); // 5400
const hardCapTicks = totalTicks * 2 + 60;

const results = [];
let failures = 0;
function check(name, cond, detail) {
  if (!cond) failures += 1;
  results.push({ name, pass: !!cond, detail: detail ?? null });
}
function approx(a, b, eps = 1e-9) {
  return Math.abs(a - b) <= eps;
}

/** 推进到 fulltime（或硬上限）。返回 {errors, ticks, samples}；每 SAMPLE_EVERY tick 采样一份快照。 */
const SAMPLE_EVERY = 10;
function playToFulltime(match, botRed, botBlue) {
  const errors = [];
  const samples = [];
  let ticks = 0;
  try {
    for (let t = 0; t < hardCapTicks; t++) {
      if (match.phase === 'fulltime') break;
      match.step(TICK_DT_S, botRed.decide(match.world), botBlue.decide(match.world));
      ticks = t + 1;
      if (ticks % SAMPLE_EVERY === 0) {
        samples.push([match.timeS, match.scores.red, match.scores.blue,
          match.world.ball.x, match.world.ball.y]);
      }
    }
    if (match.phase !== 'fulltime') {
      errors.push(`hardcap: ${hardCapTicks} tick 内未到 fulltime（phase=${match.phase} timeS=${match.timeS}）`);
    }
  } catch (err) {
    errors.push(`${err && err.stack ? err.stack : String(err)}`);
  }
  return { errors, ticks, samples };
}

// ---------- A 局末：踢满 90s 到 fulltime ----------
const m1 = new Match({ seed: SEED });
const botRed1 = new BotController('red', SEED, m1.level);
const botBlue1 = new BotController('blue', SEED, m1.level);
const t0 = performance.now();
const game1 = playToFulltime(m1, botRed1, botBlue1);
const wallMs = performance.now() - t0;

check('A1 全程零报错（errors=0）', game1.errors.length === 0, game1.errors.join(' | ') || null);
check('A2 局末阶段 fulltime', m1.phase === 'fulltime', m1.phase);
check('A3 计时归零（timeS=90）', approx(m1.timeS, MATCH_DURATION_S), String(m1.timeS));
check('A4 终局比分可读且落在门禁区间 [1,12]',
  m1.scores.red + m1.scores.blue >= 1 && m1.scores.red + m1.scores.blue <= 12,
  `red ${m1.scores.red} : blue ${m1.scores.blue}`);
check('A5 终局前有进球事件留痕（lastGoal/sfxEvents 供结算层消费）',
  m1.lastGoal !== null && m1.sfxEvents.length > 0,
  `sfx=${m1.sfxEvents.length}`);
check('A6 局内 tick 数 > 5400（庆祝期比赛钟双冻结，DR-P3 口径）', game1.ticks > totalTicks, String(game1.ticks));
const finalScore1 = { red: m1.scores.red, blue: m1.scores.blue }; // 首局终局比分（E3 复现性基准）

// ---------- B 结算冻结：fulltime 是终态 ----------
{
  const frozen = {
    scores: JSON.stringify(m1.scores), timeS: m1.timeS,
    ball: [m1.world.ball.x, m1.world.ball.y], players: m1.world.players.map((p) => [p.x, p.y]),
  };
  for (let i = 0; i < 60; i++) m1.step(TICK_DT_S, NO_INTENT, NO_INTENT);
  check('B1 fulltime 后 step() 不推进：比分冻结', JSON.stringify(m1.scores) === frozen.scores);
  check('B2 fulltime 后 step() 不推进：计时冻结', approx(m1.timeS, frozen.timeS));
  check('B3 fulltime 后球位置冻结', m1.world.ball.x === frozen.ball[0] && m1.world.ball.y === frozen.ball[1]);
  check('B4 fulltime 后双方球员冻结',
    m1.world.players.every((p, i) => p.x === frozen.players[i][0] && p.y === frozen.players[i][1]));
  check('B5 HUD 剩余时间归零（timeLeftS=0）', m1.timeLeftS() === 0, String(m1.timeLeftS()));
}

// ---------- C 重开（core Match.restart()：比分清零、回开球） ----------
m1.restart();
check('C1 比分清零 0:0', m1.scores.red === 0 && m1.scores.blue === 0, JSON.stringify(m1.scores));
check('C2 计时归零（timeS=0）', m1.timeS === 0, String(m1.timeS));
check('C3 阶段回 playing', m1.phase === 'playing', m1.phase);
check('C4 庆祝计时/进球留痕清空', m1.celebrationT === 0 && m1.lastGoal === null);
check('C5 音效排程清空', m1.sfxEvents.length === 0, String(m1.sfxEvents.length));
check('C6 球回 el-07 (128,80) 速度清零',
  m1.world.ball.x === 128 && m1.world.ball.y === 80 && m1.world.ball.vx === 0 && m1.world.ball.vy === 0);
check('C7 赤焰回 el-05 (168,80)', m1.world.players[0].x === 168 && m1.world.players[0].y === 80 && m1.world.players[0].vx === 0);
check('C8 霜蓝回 el-06 (88,80)', m1.world.players[1].x === 88 && m1.world.players[1].y === 80 && m1.world.players[1].vx === 0);
check('C9 onboarding 提示重新可见（firstTouchS 复位 → alpha=1）',
  m1.firstTouchS === null && m1.onboardingAlpha() === 1, String(m1.onboardingAlpha()));

// ---------- D 重开可玩：restart() 后换新控制器再踢完整一局 ----------
const botRed2 = new BotController('red', SEED, m1.level);
const botBlue2 = new BotController('blue', SEED, m1.level);
const game2 = playToFulltime(m1, botRed2, botBlue2);
check('D1 重开局零报错（errors=0）', game2.errors.length === 0, game2.errors.join(' | ') || null);
check('D2 重开局踢到 fulltime', m1.phase === 'fulltime', m1.phase);
check('D3 重开局计时走满 90s', approx(m1.timeS, MATCH_DURATION_S), String(m1.timeS));
check('D4 重开局有射门有触球', m1.world.totalShots() > 0 && m1.world.totalTouches() > 0,
  `shots=${m1.world.totalShots()} touches=${m1.world.totalTouches()}`);

// ---------- E 重开复现性：setup() 语义（全新 Match + 新控制器）同 seed 逐 tick 一致 ----------
const m3 = new Match({ seed: SEED });
const botRed3 = new BotController('red', SEED, m3.level);
const botBlue3 = new BotController('blue', SEED, m3.level);
const game3 = playToFulltime(m3, botRed3, botBlue3);
const sameLen = game1.samples.length === game3.samples.length;
let firstDiff = -1;
if (sameLen) {
  for (let i = 0; i < game1.samples.length; i++) {
    if (JSON.stringify(game1.samples[i]) !== JSON.stringify(game3.samples[i])) { firstDiff = i; break; }
  }
}
check('E1 重开（全新对局）采样点数一致', sameLen,
  `${game1.samples.length} vs ${game3.samples.length}`);
check('E2 重开局与首局逐 tick 采样一致（同 seed 复现）', sameLen && firstDiff === -1,
  firstDiff === -1 ? 'all identical' : `first diff @ sample ${firstDiff}`);
check('E3 重开局终局比分与首局一致',
  m3.scores.red === finalScore1.red && m3.scores.blue === finalScore1.blue,
  `${m3.scores.red}:${m3.scores.blue} vs ${finalScore1.red}:${finalScore1.blue}`);

const summary = {
  test: 'smoke/fulltime-restart',
  seed: SEED,
  game1: { ticks: game1.ticks, score: { red: m1.scores.red, blue: m1.scores.blue }, wall_ms: Number(wallMs.toFixed(1)) },
  game2_restart_replay: { ticks: game2.ticks },
  game3_fresh_replay: { ticks: game3.ticks, score: { red: m3.scores.red, blue: m3.scores.blue } },
  errors: [...game1.errors, ...game2.errors, ...game3.errors],
  failures,
  results,
};
process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
process.exit(failures === 0 && summary.errors.length === 0 ? 0 : 1);
