#!/usr/bin/env node
/**
 * bot-sim runner —— headless bot vs bot 对局入口（DoD#5 / acc-03）。
 *
 * 契约 = spec v1.2 §5.1（R-08 冻结，QA 与程序双方同一套）：
 *  - 报告含 meta + per_game[]（逐场 seed/比分/时长/shots/touches/errors）+ summary；
 *  - 指标拆分：goal_range_ratio 与 duration_in_range_ratio（不得合并/改名）；
 *  - 退出码：exit 0 ⇔ games_with_errors==0 ∧ goal_range_ratio==1.0 ∧ duration_in_range_ratio==1.0；
 *    errors 非空 ⇒ exit ≠ 0；
 *  - 种子：--seeds 42..141（含端点 100 场），双方控制器从同一 seed 确定性派生；
 *  - 确定性：同 build 同 seed 复跑 stdout 逐字节一致 —— meta.generated_at 取构建提交时间
 *    （git 提交日期 ISO8601），不取墙钟；无 git 时回退固定 spec 日期。报告内无任何墙钟字段。
 *
 * 用法：
 *   node pixel-fives/tools/bot-sim.mjs --seeds 42..141 --json
 *   node pixel-fives/tools/bot-sim.mjs --seeds 42,43,44
 * 进度与诊断走 stderr；stdout 只有报告 JSON。
 * 零 npm 依赖（node ≥16）。
 */
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Match } from '../src/core/match.js';
import { TICK_DT_S, MATCH_DURATION_S, BOT_SIM_SEEDS, BOT_SIM_RANGES } from '../src/core/constants.js';
import { BotController } from '../src/ai/bot.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SPEC_VERSION = 'v1.2';
const SPEC_DATE_FALLBACK = '2026-09-12T00:00:00Z'; // 无 git 时的确定性回退（spec 送审日）

/** 读 git 元数据；任何失败都回退到确定值（保证无 git 环境可跑且复跑一致）。 */
function gitMeta() {
  const opts = { cwd: ROOT };
  try {
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], { ...opts, encoding: 'utf8' }).trim();
    let committedAt = SPEC_DATE_FALLBACK;
    try {
      committedAt = execFileSync('git', ['log', '-1', '--format=%cI'], { ...opts, encoding: 'utf8' }).trim() || SPEC_DATE_FALLBACK;
    } catch { /* sha 拿到但日期失败：仍用回退日期 */ }
    return { built_from: sha, generated_at: committedAt };
  } catch {
    return { built_from: 'no-git', generated_at: SPEC_DATE_FALLBACK };
  }
}

/**
 * 解析 --seeds 参数：支持 "42..141"（含端点）、"42"、逗号混写 "42,44..46"。
 * 无参数时默认 BOT_SIM_SEEDS（42..141）。
 * @returns {number[]}
 */
export function parseSeeds(spec) {
  if (!spec || spec.trim() === '') {
    const out = [];
    for (let s = BOT_SIM_SEEDS.start; s <= BOT_SIM_SEEDS.end; s++) out.push(s);
    return out;
  }
  const out = [];
  for (const part of String(spec).split(',')) {
    const seg = part.trim();
    if (seg === '') continue;
    const m = seg.match(/^(\d+)\.\.(\d+)$/);
    if (m) {
      const a = Number(m[1]);
      const b = Number(m[2]);
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      for (let s = lo; s <= hi; s++) out.push(s);
    } else if (/^\d+$/.test(seg)) {
      out.push(Number(seg));
    } else {
      throw new Error(`无法解析 seeds 片段: "${seg}"（支持 42..141 / 42 / 逗号混写）`);
    }
  }
  if (out.length === 0) throw new Error('seeds 为空');
  return out;
}

/**
 * 跑一场 bot vs bot（同 seed 派生双方控制器，与人类同一套模拟入口）。
 * @returns {object} per_game 条目
 */
export function runOneGame(seed) {
  const match = new Match({ seed });
  const botRed = new BotController('red', seed, match.level);
  const botBlue = new BotController('blue', seed, match.level);
  const totalTicks = Math.round(MATCH_DURATION_S / TICK_DT_S);
  // DR-P3 语义对齐（2026-09-22 复验修复）：庆祝期比赛钟双冻结（match.js timeS 只在 playing 累加），
  // 满场所需墙钟 tick 必然 > 90s 预算（90 - 庆祝总时长）。推进以 fulltime 为准；
  // 硬上限仅防异常挂死：超限 = harness 异常态，记入 errors 由退出码规则兜底，不静默吞。
  const hardCapTicks = totalTicks * 2 + 60;
  try {
    const errors = [];
    for (let t = 0; t < hardCapTicks; t++) {
      if (match.phase === 'fulltime') break;
      const iRed = botRed.decide(match.world);
      const iBlue = botBlue.decide(match.world);
      match.step(TICK_DT_S, iRed, iBlue);
    }
    if (match.phase !== 'fulltime') {
      errors.push(`hardcap: ${hardCapTicks} tick 内未到 fulltime（phase=${match.phase} timeS=${match.timeS}）`);
    }
    const goalsRed = match.scores.red;
    const goalsBlue = match.scores.blue;
    return {
      seed,
      goals_total: goalsRed + goalsBlue,
      goals_red: goalsRed,
      goals_blue: goalsBlue,
      duration_s: match.timeS,
      shots: match.world.totalShots(),
      touches: match.world.totalTouches(),
      errors,
    };
  } catch (err) {
    // 单场异常不中断整套：按 seed 定位（R-08 no_relax 纪律），exit 规则兜底
    return {
      seed,
      goals_total: match.scores.red + match.scores.blue,
      goals_red: match.scores.red,
      goals_blue: match.scores.blue,
      duration_s: match.timeS,
      shots: match.world.totalShots(),
      touches: match.world.totalTouches(),
      errors: [`${err && err.message ? err.message : String(err)}`],
    };
  }
}

/** 汇总 summary（指标定义冻结，不得合并/改名）。 */
export function computeSummary(perGames) {
  const n = perGames.length;
  const inGoalRange = perGames.filter((g) => g.goals_total >= BOT_SIM_RANGES.GOALS[0] && g.goals_total <= BOT_SIM_RANGES.GOALS[1]).length;
  const inDurRange = perGames.filter((g) => g.duration_s >= BOT_SIM_RANGES.DURATION_S[0] && g.duration_s <= BOT_SIM_RANGES.DURATION_S[1]).length;
  const withErrors = perGames.filter((g) => Array.isArray(g.errors) && g.errors.length > 0);
  return {
    goal_range_ratio: n === 0 ? 0 : inGoalRange / n,
    duration_in_range_ratio: n === 0 ? 0 : inDurRange / n,
    games_with_errors: withErrors.length,
    errors: withErrors.map((g) => `seed ${g.seed}: ${g.errors.join('; ')}`),
  };
}

/** 退出码规则（冻结）：errors 非空 ⇒ exit≠0；比率断言取 ==1.0（套件确定性）。 */
export function decideExitCode(summary) {
  const pass = summary.games_with_errors === 0
    && summary.errors.length === 0
    && summary.goal_range_ratio === 1.0
    && summary.duration_in_range_ratio === 1.0;
  return pass ? 0 : 1;
}

/** 主入口：seeds → 报告（stdout JSON）。 */
function main(argv) {
  let seedsSpec = '';
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--seeds') seedsSpec = argv[i + 1] ?? '';
    // --json 为兼容声明的开关：stdout 本就只有 JSON，接受该 flag 但无需分支
  }
  const seeds = parseSeeds(seedsSpec);
  const t0 = Date.now(); // 墙钟只进 stderr 进度，不进报告
  const perGames = seeds.map((seed, idx) => {
    const g = runOneGame(seed);
    if ((idx + 1) % 20 === 0 || idx + 1 === seeds.length) {
      process.stderr.write(`[bot-sim] ${idx + 1}/${seeds.length} 场完成（${Date.now() - t0}ms）\n`);
    }
    return g;
  });
  const meta = gitMeta();
  const report = {
    meta: {
      seeds_start: seeds[0],
      seeds_end: seeds[seeds.length - 1],
      game_count: seeds.length,
      spec_version: SPEC_VERSION,
      built_from: meta.built_from,
      generated_at: meta.generated_at,
      deterministic: true,
    },
    per_game: perGames,
    summary: computeSummary(perGames),
  };
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  const code = decideExitCode(report.summary);
  process.stderr.write(`[bot-sim] goal_range_ratio=${report.summary.goal_range_ratio} duration_in_range_ratio=${report.summary.duration_in_range_ratio} games_with_errors=${report.summary.games_with_errors} → exit ${code}\n`);
  process.exit(code);
}

// 直接执行时才跑 CLI（被测试 import 时不跑）
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main(process.argv.slice(2));
}
