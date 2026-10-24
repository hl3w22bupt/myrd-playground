#!/usr/bin/env node
/**
 * wx 轨门禁聚合器（B0 · N3 devtools 轨可机跑面）。
 * 门单 = spec v1.3 content.platform 四条目 check + 素材查表 + bgm-loop wx 冒烟。
 * 口径：任一子门 FAIL → 聚合 FAIL（exit 1）；子门以「RESULT:」行判定（与 web 契约同约定）。
 * devtools CLI 面（打开工程/预览/上传）与真机轨不在本聚合器——AppID + 工具到位后由 N3 升级执行。
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GAME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const GATES = [
  ['wx-runtime-surface（wx-runtime 条目）', 'tests/wx/wx-runtime-surface.spec.mjs'],
  ['wx-share-loop（wx-share-loop 条目）', 'tests/wx/wx-share-loop.spec.mjs'],
  ['wx-open-data-rank（wx-open-data-rank 条目）', 'tests/wx/wx-open-data-rank.spec.mjs'],
  ['wx-submission-kit（wx-submission-kit 条目）', 'tests/wx/wx-submission-kit.spec.mjs'],
  ['bgm-loop wx 冒烟（拒绝线正面闭环）', 'tests/wx/bgm-loop-wx.spec.mjs'],
  ['平台素材查表（7 id 定稿）', 'tests/wx/assets-wx-check.mjs'],
];

const results = [];
for (const [name, rel] of GATES) {
  try {
    const out = execFileSync('node', [path.join(GAME, rel)], { encoding: 'utf8', timeout: 120000 });
    const last = out.trim().split('\n').filter((l) => l.startsWith('RESULT:')).pop() || '';
    results.push([name, last.includes('RESULT: PASS') ? 'PASS' : 'FAIL', last]);
  } catch (e) {
    const out = String(e.stdout || '');
    const last = out.trim().split('\n').filter((l) => l.startsWith('RESULT:')).pop() || `RESULT: FAIL (异常退出 exit=${e.status})`;
    results.push([name, last.includes('RESULT: PASS') ? 'PASS' : 'FAIL', last]);
  }
}
console.log('===== wx 轨门禁聚合（可机跑面）=====');
for (const [name, verdict, line] of results) console.log(`[${verdict}]  ${name}   ${line}`);
const failed = results.filter((r) => r[1] !== 'PASS');
if (failed.length) {
  console.log(`wx-GATE: FAIL (${results.length - failed.length}/${results.length})`);
  process.exit(1);
}
console.log(`wx-GATE: PASS (${results.length}/${results.length})`);
