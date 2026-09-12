/**
 * acc-03 + acc-04：bot-sim 门禁与报告契约（spec §5.1，R-08 冻结）。
 * 零依赖：node pixel-fives/tests/qa/bot-sim-contract.test.mjs → JSON 摘要 + exit 0/1。
 *
 * acc-03：runner（tools/bot-sim.mjs --seeds 42..141 --json）exit 0 ⇔ errors 空 ∧ 两比率 ==1.0；
 *         errors 非空 ⇒ exit ≠ 0（用纯函数 decideExitCode 注入验证）。
 * acc-04：报告含 meta + per_game[]（逐场 seed/比分/时长/errors）+ summary（两拆分比率字段）；
 *         同 seed 复跑 stdout 逐字节一致（meta.generated_at 取构建提交时间，无墙钟字段）。
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseSeeds, computeSummary, decideExitCode } from '../../tools/bot-sim.mjs';
import { BOT_SIM_SEEDS } from '../../src/core/constants.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const RUNNER = path.join(ROOT, 'tools', 'bot-sim.mjs');

const results = [];
let failures = 0;
function check(name, cond, detail) {
  if (!cond) failures += 1;
  results.push({ name, pass: !!cond, detail: detail ?? null });
}

function run(seedsSpec) {
  const r = spawnSync(process.execPath, [RUNNER, '--seeds', seedsSpec, '--json'], {
    cwd: ROOT, encoding: 'utf8', timeout: 120000, maxBuffer: 64 * 1024 * 1024,
  });
  return r;
}

// ---------- acc-03：门禁全量跑（seeds 42..141，双方同一套） ----------
const full = run('42..141');
check('A1 runner 正常结束（无信号/超时）', !full.error && full.status !== null, full.error ? String(full.error) : null);
check('A2 全量 100 场 exit 0', full.status === 0, `status=${full.status}`);

let report = null;
try {
  report = JSON.parse(full.stdout);
} catch (e) {
  check('A3 报告可解析为 JSON', false, String(e));
}
if (report) {
  check('A3 报告可解析为 JSON', true);

  // ---------- acc-04：报告契约（字段名与 §5.1 逐字一致） ----------
  const m = report.meta || {};
  check('B1 meta.seeds_start=42', m.seeds_start === BOT_SIM_SEEDS.start);
  check('B2 meta.seeds_end=141', m.seeds_end === BOT_SIM_SEEDS.end);
  check('B3 meta.game_count=100', m.game_count === 100);
  check('B4 meta.spec_version=v1.2', m.spec_version === 'v1.2');
  check('B5 meta.built_from 可追溯（git sha 或 build id）', typeof m.built_from === 'string' && m.built_from.length > 0, m.built_from);
  check('B6 meta.generated_at 为 ISO8601', typeof m.generated_at === 'string' && !Number.isNaN(Date.parse(m.generated_at)), m.generated_at);
  check('B7 meta.deterministic=true', m.deterministic === true);

  const pg = Array.isArray(report.per_game) ? report.per_game : [];
  check('C1 per_game 共 100 场', pg.length === 100, String(pg.length));
  const seedSet = new Set(pg.map((g) => g.seed));
  check('C2 seeds 恰为 42..141 无重复', seedSet.size === 100 && pg.every((g) => g.seed >= 42 && g.seed <= 141));
  check('C3 per_game 字段齐备（seed/goals_total/goals_red/goals_blue/duration_s/shots/touches/errors）',
    pg.every((g) => typeof g.seed === 'number'
      && typeof g.goals_total === 'number'
      && typeof g.goals_red === 'number'
      && typeof g.goals_blue === 'number'
      && typeof g.duration_s === 'number'
      && typeof g.shots === 'number'
      && typeof g.touches === 'number'
      && Array.isArray(g.errors)));
  check('C4 goals_total = goals_red + goals_blue（逐场）', pg.every((g) => g.goals_total === g.goals_red + g.goals_blue));

  const s = report.summary || {};
  check('D1 summary.goal_range_ratio 存在且为数值', typeof s.goal_range_ratio === 'number');
  check('D2 summary.duration_in_range_ratio 存在且为数值', typeof s.duration_in_range_ratio === 'number');
  check('D3 summary.games_with_errors 存在', typeof s.games_with_errors === 'number');
  check('D4 summary.errors 为数组', Array.isArray(s.errors));
  check('D5 指标拆分未被合并（两字段独立存在）', 'goal_range_ratio' in s && 'duration_in_range_ratio' in s && !('ratio' in s));

  // ---------- 门禁语义：比率 == 1.0 且 errors 空 ----------
  check('E1 goal_range_ratio == 1.0', s.goal_range_ratio === 1.0, String(s.goal_range_ratio));
  check('E2 duration_in_range_ratio == 1.0', s.duration_in_range_ratio === 1.0, String(s.duration_in_range_ratio));
  check('E3 games_with_errors == 0', s.games_with_errors === 0, JSON.stringify(s.errors));

  // ---------- 退出码规则（冻结）：errors 非空 ⇒ exit ≠ 0（纯函数注入验证） ----------
  const faulty = computeSummary(pg.map((g, i) => (i === 0 ? { ...g, errors: ['注入：验证 errors⇒exit≠0（R-08）'] } : g)));
  check('F1 errors 非空 ⇒ exit ≠ 0', decideExitCode(faulty) !== 0);
  const outOfRange = computeSummary(pg.map((g, i) => (i === 0 ? { ...g, goals_total: 0 } : g)));
  check('F2 比率 < 1.0 ⇒ exit ≠ 0', decideExitCode(outOfRange) !== 0);
}

// ---------- acc-04：同 seed 复跑逐字节一致（子集，控制时长） ----------
const r1 = run('42..51');
const r2 = run('42..51');
check('G1 复跑两次均 exit 0', r1.status === 0 && r2.status === 0);
check('G2 同 seed 复跑 stdout 逐字节一致', r1.stdout === r2.stdout && r1.stdout.length > 0,
  r1.stdout === r2.stdout ? `${r1.stdout.length}B` : 'diff detected');

// ---------- seeds 解析器契约 ----------
check('H1 parseSeeds("42..141") = 100 个', parseSeeds('42..141').length === 100 && parseSeeds('42..141')[0] === 42 && parseSeeds('42..141')[99] === 141);
check('H2 parseSeeds 单值/混写', parseSeeds('42').length === 1 && JSON.stringify(parseSeeds('40,42..43')) === JSON.stringify([40, 42, 43]));
check('H3 parseSeeds 缺省 = BOT_SIM_SEEDS 全集', parseSeeds('').length === 100);

// ---------- 摘要 ----------
const summary = { test: 'qa/bot-sim-contract', total: results.length, failures, results };
process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
process.exit(failures === 0 ? 0 : 1);
