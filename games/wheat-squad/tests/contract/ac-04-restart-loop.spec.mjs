// ac-04-restart-loop — ac-a3-restart-willingness（A3 · manual+auto）
// 机制面（auto）：一键重开 ≤1s 全复位 + 结算页三信息 + 量表模板列 schema（含「重开理由原文」列）
// 结论面（manual）：5 名试玩 ≥3 人自然重开 ≥2 局且重开理由原文非空——记录未回填 = MANUAL-PENDING，不虚报
import { assert, loadSpec, driveRun, ROOT } from './helpers.mjs';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const spec = loadSpec();
const st = await driveRun(spec);
assert(st.phase === 'ended', '前置：需先到结算');

// 机制面1：重开链路（game 面 restart ≤1s + 全复位）
const { createGame } = await import(new URL('../../src/game.ts', import.meta.url).pathname);
const g = createGame(spec);
g.state.tick = 9999; g.state.kills = 50; g.state.phase = 'ended';
const t0 = Date.now();
g.restart();
const restartMs = Date.now() - t0;
assert(restartMs <= 1000, `重开耗时 ${restartMs}ms > 1000ms`);
assert(g.state.phase === 'running' && g.state.kills === 0 && g.state.tick === 0, '重开后状态未全复位');
assert(g.state.upgradesPicked.length === 0 && g.state.xp === 0, '重开后强化/经验未清零');

// 机制面2：结算页三信息齐
const { buildSettlement } = await import(new URL('../../src/settlement.ts', import.meta.url).pathname);
const { settlementFacts } = await import(new URL('../../src/kernel/sim.ts', import.meta.url).pathname);
const view = buildSettlement(settlementFacts(st), st.endedReason);
const joined = view.rows.join('|');
for (const kw of ['三强强化回顾', '难度预告', '麦仓收益']) assert(joined.includes(kw), `结算页缺「${kw}」信息`);

// 机制面3：试玩记录表模板在档 + 必备列 schema（A3 判定依据列 = 「重开理由原文」）
const templatePath = join(ROOT, 'qa', 'playtest-record-template.md');
assert(existsSync(templatePath), '缺试玩记录表模板 qa/playtest-record-template.md');
const tpl = readFileSync(templatePath, 'utf8');
for (const col of ['试玩人', '自然重开≥2局', '重开理由原文']) assert(tpl.includes(col), `模板缺必备列「${col}」`);

// 结论面：记录回填校验（未回填 = MANUAL-PENDING，exit 0 但明示未达）
const recDir = join(ROOT, 'qa', 'playtest-records');
const files = existsSync(recDir) ? readdirSync(recDir).filter((f) => f.endsWith('.md')) : [];
let pending = true;
if (files.length > 0) {
  let restarted = 0, withReason = 0, rows = 0;
  for (const f of files) {
    for (const line of readFileSync(join(recDir, f), 'utf8').split('\n')) {
      if (!/^\|[^|]*\|/.test(line) || /试玩人|---/.test(line)) continue;
      rows += 1;
      const cells = line.split('|').map((c) => c.trim());
      const yesRestart = cells.some((c) => /^是/.test(c));
      const reason = cells.find((c) => c.includes('「') || c.length >= 4) ?? '';
      if (yesRestart) restarted += 1;
      if (yesRestart && reason.length >= 4) withReason += 1;
    }
  }
  assert(rows >= 5, `试玩记录仅 ${rows} 行 < 5 名试玩（A3 样本不足）`);
  assert(restarted >= 3, `自然重开≥2局仅 ${restarted}/5 < 3（A3 结论面不达）`);
  assert(withReason >= 3, `重开理由原文合格仅 ${withReason}/5 < 3（A3 结论面不达）`);
  pending = false;
}
console.log(pending
  ? `PEND ac-a3(manual) 机制面 PASS（重开 ${restartMs}ms+全复位+结算三信息+模板 schema）· 结论面 MANUAL-PENDING（记录 0/5——5 名试玩回填后复跑本件）`
  : `PASS ac-a3 机制面+结论面全达（重开 ${restartMs}ms · 记录 ${files.length} 件 · 达标 ≥3/5）`);
// PEND 语义 v2（run-all 三态聚合）：挂起必须注册到聚合器——只 console.log 会被合计吞成 PASS（旧缺陷）
if (pending) {
  (globalThis.__WS_CONTRACT_PENDS__ ??= []).push(
    `ac-a3-restart-willingness 结论面：5 名试玩记录未回填（0/5）——manual 结论面待真人，回填后复跑本件转 PASS`,
  );
}
