#!/usr/bin/env node
// gen-spec-data.mjs — spec 单源数据生成器（line4-unblock-jam）
//
// 从机读契约件 .myrd/spec/line4-unblock-jam/design-spec.json 生成 src/generated/spec-data.mjs：
// telemetry 三列（key/target/sampling）+ numeric 冻结锚。纪律：数值一律 spec 单源，零手抄第二份；
// spec 改版（revision）后重跑本生成器 + 重生成 hash 不变校验。
// 运行：node tools/gen-spec-data.mjs（仓根或本目录均可）
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const candidates = [
  resolve(here, '../../../.myrd/spec/line4-unblock-jam/design-spec.json'),
  resolve(here, '.myrd/spec/line4-unblock-jam/design-spec.json'),
];
const specPath = candidates.find((p) => { try { readFileSync(p); return true; } catch { return false; } });
if (!specPath) {
  console.error('[gen-spec-data] FATAL: 契约件不存在（.myrd/spec/line4-unblock-jam/design-spec.json）');
  process.exit(1);
}
const doc = JSON.parse(readFileSync(specPath, 'utf8'));
const spec = doc.spec ?? doc;
const platform = doc._platform ?? {};
const num = spec.numeric;

const telemetry = (num.telemetry ?? []).map((t) => ({ key: t.key, target: t.target, sampling: t.sampling }));
if (telemetry.length === 0) { console.error('[gen-spec-data] FATAL: numeric.telemetry 三列为空'); process.exit(1); }

const banner = `// 由 tools/gen-spec-data.mjs 生成 —— 零手抄；单源=${specPath}
// spec 锚：${platform.id ?? 'local'}@v${platform.version ?? spec.meta?.version ?? '?'}:${platform.status ?? 'n/a'}
// 重生成请跑：node tools/gen-spec-data.mjs
`;

const out = `${banner}export const SPEC_ANCHOR = ${JSON.stringify({ id: platform.id ?? null, version: platform.version ?? null, status: platform.status ?? null, slug: spec.meta?.slug ?? null })};\n\nexport const NUMERIC = ${JSON.stringify({
  DEFAULT_SEED: num.DEFAULT_SEED,
  FIXED_STEP_MS: num.FIXED_STEP_MS,
  firstGuideWindowSec: num.firstGuideWindowSec,
  redRoundStepBudget: num.redRoundStepBudget,
  redRoundFailDowngrade: num.redRoundFailDowngrade,
  smokeN: num.measurement?.smokeN ?? null,
  smokeSeeds: '42..61',
  entityCap: num.perf?.entityCap ?? null,
  stepBudgetMs: num.perf?.stepBudgetMs ?? null,
  clockSource: num.measurement?.clockSource ?? null,
  deviceTier: num.perf?.deviceTier ?? null,
}, null, 2)};\n\nexport const TELEMETRY_COLUMNS = ${JSON.stringify(telemetry, null, 2)};\n\nexport const TELEMETRY_KEYS = TELEMETRY_COLUMNS.map((c) => c.key);\n`;

const outPath = resolve(here, '../src/generated/spec-data.mjs');
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, out);
console.log(`[gen-spec-data] OK -> ${outPath}（telemetry ${telemetry.length} 键 · spec 锚 v${platform.version ?? '?'} ${platform.status ?? ''}）`);
