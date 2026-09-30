#!/usr/bin/env node
/**
 * tt 包体积分列断言（C · spec v1.5 content.platform dy-submission-kit check 面）。
 * 判据（验收口径原文）：主包 ≤4MB 分列断言 PASS；numeric 零漂移（见 check-numeric-freeze，另门）。
 * 分列口径：主包 / 子包两列独立读数——抖音无开放数据域独立子包机制，子包分列恒 0
 * （好友榜数据通道收敛为 tt 云存储单通道，dy-runtime 验收口径原文①），禁止合并口径。
 * 预算唯一来源 = approved spec 导出件 content.platform.budgets；体积来源 = export/tt/manifest.json
 * （tools/build-tt.mjs 产出，逐件 sha256）；manifest 缺失或与磁盘不符 → FAIL。
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GAME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXPORT = path.join(GAME, 'export/tt');
const specPath = path.join(GAME, '../../.myrd/spec/stack-tower-spec.json');
const manifestPath = path.join(EXPORT, 'manifest.json');

const failures = [];
if (!existsSync(manifestPath)) {
  console.log('RESULT: FAIL (0/3) — export/tt/manifest.json 缺失（先跑 node tools/build-tt.mjs）');
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const spec = JSON.parse(readFileSync(specPath, 'utf8')).spec;
const budgets = spec.content.platform.budgets;

// 0) 预算来源校验（spec 必须带主包预算）
if (!(budgets.mainPackageMaxBytes > 0)) failures.push('spec content.platform.budgets 缺主包预算');

// 1) manifest 与磁盘一致性（逐件 sha256）
let drift = 0;
for (const f of manifest.files) {
  const p = path.join(EXPORT, f.path);
  if (!existsSync(p)) { drift += 1; continue; }
  const disk = createHash('sha256').update(readFileSync(p)).digest('hex');
  if (disk !== f.sha256 || statSync(p).size !== f.bytes) drift += 1;
}
if (drift > 0) failures.push(`manifest 与磁盘不符：${drift} 件漂移`);

// 2) 主包分列（≤4MB，验收口径原文）
const mainOk = manifest.sizes.mainBytes <= budgets.mainPackageMaxBytes;
if (!mainOk) failures.push(`主包超预算：${manifest.sizes.mainBytes} > ${budgets.mainPackageMaxBytes}`);

// 3) 子包分列（恒 0 = 无开放数据域/分包；出现分包读数即与 tt 单包结构面失配）
const subOk = manifest.sizes.subpackageBytes === 0;
if (!subOk) failures.push(`子包分列非 0（抖音无开放数据域独立子包机制）：${manifest.sizes.subpackageBytes}`);

console.log(`[size] 主包 ${(manifest.sizes.mainBytes / 1024).toFixed(1)}KB / ${(budgets.mainPackageMaxBytes / 1024 / 1024).toFixed(0)}MB —— ${mainOk ? 'PASS' : 'FAIL'}`);
console.log(`[size] 子包 ${manifest.sizes.subpackageBytes}B —— ${subOk ? 'PASS' : 'FAIL'}（分列口径：抖音无开放数据域独立子包机制）`);
console.log(`[size] manifest 一致性：${manifest.files.length} 件，漂移 ${drift}`);
if (failures.length) {
  console.log(`RESULT: FAIL (${failures.length}/3)`);
  failures.forEach((f) => console.log(`  ↳ ${f}`));
  process.exit(1);
}
console.log('RESULT: PASS');
