#!/usr/bin/env node
/**
 * wx 包体积分列断言（B0 · spec v1.3 content.platform wx-submission-kit check 面）。
 * 判据：主包 ≤ mainPackageMaxBytes 与开放数据域 ≤ openDataContextMaxBytes **分列**断言，禁止合并口径。
 * 预算唯一来源 = approved spec 导出件 content.platform.budgets；体积来源 = export/wx/manifest.json
 * （tools/build-wx.mjs 产出，逐件 sha256）；manifest 缺失或与磁盘不符 → FAIL。
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GAME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXPORT = path.join(GAME, 'export/wx');
const specPath = path.join(GAME, '../../.myrd/spec/stack-tower-spec.json');
const manifestPath = path.join(EXPORT, 'manifest.json');

const failures = [];
if (!existsSync(manifestPath)) {
  console.log('RESULT: FAIL (0/3) — export/wx/manifest.json 缺失（先跑 node tools/build-wx.mjs）');
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const spec = JSON.parse(readFileSync(specPath, 'utf8')).spec;
const budgets = spec.content.platform.budgets;

// 0) 预算来源校验（spec 必须带分列预算）
if (!(budgets.mainPackageMaxBytes > 0) || !(budgets.openDataContextMaxBytes > 0)) {
  failures.push('spec content.platform.budgets 缺分列预算（main/openData）');
}
// 1) manifest 与磁盘一致性（逐件 sha256）
let drift = 0;
for (const f of manifest.files) {
  const p = path.join(EXPORT, f.path);
  if (!existsSync(p)) { drift += 1; continue; }
  const disk = createHash('sha256').update(readFileSync(p)).digest('hex');
  if (disk !== f.sha256 || statSync(p).size !== f.bytes) drift += 1;
}
if (drift > 0) failures.push(`manifest 与磁盘不符：${drift} 件漂移`);
// 2) 主包分列
const mainOk = manifest.sizes.mainBytes <= budgets.mainPackageMaxBytes;
if (!mainOk) failures.push(`主包超预算：${manifest.sizes.mainBytes} > ${budgets.mainPackageMaxBytes}`);
// 3) 开放数据域分列（禁合并口径）
const odOk = manifest.sizes.openDataBytes <= budgets.openDataContextMaxBytes;
if (!odOk) failures.push(`开放数据域超预算：${manifest.sizes.openDataBytes} > ${budgets.openDataContextMaxBytes}`);

console.log(`[size] 主包 ${(manifest.sizes.mainBytes / 1024).toFixed(1)}KB / ${(budgets.mainPackageMaxBytes / 1024 / 1024).toFixed(0)}MB —— ${mainOk ? 'PASS' : 'FAIL'}`);
console.log(`[size] 开放数据域 ${(manifest.sizes.openDataBytes / 1024).toFixed(1)}KB / ${(budgets.openDataContextMaxBytes / 1024).toFixed(0)}KB —— ${odOk ? 'PASS' : 'FAIL'}（分列口径）`);
console.log(`[size] manifest 一致性：${manifest.files.length} 件，漂移 ${drift}`);
if (failures.length) {
  console.log(`RESULT: FAIL (${failures.length}/3)`);
  failures.forEach((f) => console.log(`  ↳ ${f}`));
  process.exit(1);
}
console.log('RESULT: PASS');
