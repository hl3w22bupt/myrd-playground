#!/usr/bin/env node
// tools/duration-log.mjs — a3 本地时长日志（单局时长实测初值落档，任务书增量）
//
// 口径与 ac-03 同源（spec numeric.runDuration.sampleSeeds + DEFAULT_SEED+i），零 npm 依赖；
// 输出 qa/local-duration-log.json（逐种子时长 + P50/P90 + victory 面）——a3「用本地时长日志取实测初值」
// 的落档面：后续校准（revision）以本档为基线对照，不手改 spec 数值。
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const { assert, loadSpec, driveRun } = await import(join(ROOT, 'tests', 'contract', 'helpers.mjs'));

const spec = loadSpec();
const rd = spec.numeric.runDuration;
const stepMs = spec.numeric.FIXED_STEP_MS;

const rows = [];
for (let i = 0; i < rd.sampleSeeds; i += 1) {
  const seed = spec.numeric.DEFAULT_SEED + i;
  const st = await driveRun(spec, { seedOverride: seed });
  assert(st.phase === 'ended', `种子 ${seed} 未到结算`);
  rows.push({ seed, durationMs: st.tick * stepMs, durationSec: Math.round((st.tick * stepMs) / 100) / 10, reason: st.endedReason, kills: st.kills, waveIndex: st.waveIndex });
}
const ds = rows.map((r) => r.durationSec).sort((a, b) => a - b);
const p50 = ds[Math.floor(ds.length / 2)];
const p90 = ds[Math.ceil(ds.length * 0.9) - 1];
const victories = rows.filter((r) => r.reason === 'victory').length;

const doc = {
  generatedAt: new Date().toISOString(),
  purpose: 'a3 实测初值落档（本地时长日志）——校准基线，spec 数值面零改动（revision 走链）',
  method: `driveRun × ${rd.sampleSeeds} 种子（DEFAULT_SEED(${spec.numeric.DEFAULT_SEED})+i），口径同 ac-03/ac-a2`,
  band: { p50MinSec: rd.p50MinSec, p50MaxSec: rd.p50MaxSec, p90MaxSec: rd.p90MaxSec },
  result: { p50Sec: p50, p90Sec: p90, victoryCount: victories, total: rows.length, inBand: p50 >= rd.p50MinSec && p50 <= rd.p50MaxSec && p90 <= rd.p90MaxSec },
  rows,
};
const out = join(ROOT, 'qa', 'local-duration-log.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(doc, null, 2) + '\n');
console.log(`DURATION-LOG: ${rows.length} 种子 P50=${p50}s P90=${p90}s victory=${victories}/${rows.length} 带内=${doc.result.inBand} → ${out}`);
