#!/usr/bin/env node
// build-checks-shims.mjs — checks/<acceptance-id>.mjs 薄壳生成器（spec v1.2 checkNaming 落地面）
//
// 任务书「check 路径定死 checks/<acceptance-id>.mjs」：acceptance[].check 统一指向
// tests/contract/checks/<acceptance-id>.mjs；本工具从 spec 单源生成薄壳——**断言零复制**：
// 每件薄壳只做真实转发（import 实体件 = 原样执行其全部断言；loop-1 = spawn 冒烟 exit 透传）。
// 幂等可重跑；实体件发现映射变化时需同步本表（ac-XX ↔ acceptance id 单源 = 本文件 SHIM_MAP）。
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT = join(ROOT, 'tests', 'contract', 'checks');

// acceptance id → 实体件（相对 tests/contract/）；loop-1 特殊 = 冒烟转发
const SHIM_MAP = {
  'ac-a1-first-core-feedback': '../ac-02-first30s.spec.mjs',
  'ac-a2-run-duration-band': '../ac-03-run-duration.spec.mjs',
  'ac-a3-restart-willingness': '../ac-04-restart-loop.spec.mjs',
  'ac-a4-feedback-channels': '../ac-05-hit-feedback.spec.mjs',
  'ac-a5-guidance-first-action': '../ac-16-guidance-telemetry.spec.mjs',
  'ac-a4b-restart-click-counter': '../ac-16-guidance-telemetry.spec.mjs',
  'det-1-seeded-determinism': '../ac-01-seeded-determinism.spec.mjs',
  'perf-1-frame-budget': '../ac-06-perf-budget.spec.mjs',
  'tex-1-no-external-texture': '../ac-07-no-texture.spec.mjs',
  'anchor-1-entity-levels-files': '../ac-08-anchors.spec.mjs',
  'fv-pend-placement-calibration': '../ac-09-placement-structure.spec.mjs',
  'ac-art-1-palette-whitelist': '../ac-10-art-palette-whitelist.spec.mjs',
  'ac-art-2-naming-entity-ids': '../ac-11-art-naming-ids.spec.mjs',
  'ac-art-3-size-caps': '../ac-12-art-size-caps.spec.mjs',
  'ac-art-4-style-consistency': '../ac-13-art-style-consistency.spec.mjs',
};

// 前置守卫：spec 单源的 acceptance id 集合必须与 SHIM_MAP 完全一致（防薄壳/链漂移）
const spec = JSON.parse(readFileSync(join(ROOT, '..', '..', '.myrd', 'spec', 'wheat-squad', 'design-spec.json'), 'utf8'));
const doc = spec.spec ?? spec;
const ids = doc.acceptance.map((a) => a.id).sort();
const mapIds = [...Object.keys(SHIM_MAP), 'loop-1-settlement-closure'].sort();
if (JSON.stringify(ids) !== JSON.stringify(mapIds)) {
  console.error(`SHIM_MAP 与 spec acceptance 不一致：\n  spec 独有: ${ids.filter((i) => !mapIds.includes(i)).join(',') || '无'}\n  map 独有: ${mapIds.filter((i) => !ids.includes(i)).join(',') || '无'}`);
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });
let n = 0;
for (const [id, target] of Object.entries(SHIM_MAP)) {
  const body = `// checks/${id}.mjs — acceptance check 薄壳（断言零复制，真实转发实体件；由 tools/build-checks-shims.mjs 生成）\n` +
    `// acceptance: ${id} · 实体单源: ${target.replace('../', 'tests/contract/')}\n` +
    `await import(new URL('${target}', import.meta.url));\n`;
  writeFileSync(join(OUT, `${id}.mjs`), body);
  n += 1;
}
// loop-1：结算闭环 = 冒烟转发（exit 全透传）
writeFileSync(
  join(OUT, 'loop-1-settlement-closure.mjs'),
  `// checks/loop-1-settlement-closure.mjs — acceptance check 薄壳（spawn 冒烟实体件，exit 全透传；生成器同上）\n` +
  `import { spawnSync } from 'node:child_process';\n` +
  `import { join, dirname } from 'node:path';\n` +
  `import { fileURLToPath } from 'node:url';\n` +
  `const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');\n` +
  `const r = spawnSync(process.execPath, [join(ROOT, 'tools', 'smoke.mjs')], { stdio: 'inherit' });\n` +
  `process.exit(r.status ?? 1);\n`,
);
n += 1;
console.log(`CHECKS-SHIMS: ${n} 件生成于 tests/contract/checks/（ac-a5/ac-a4b 共享实体件 ac-16）`);
