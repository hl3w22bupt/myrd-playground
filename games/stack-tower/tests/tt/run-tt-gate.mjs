#!/usr/bin/env node
/**
 * tt 轨门禁聚合器（C · dy 三条目 check 面 + 分列体检 + numeric 冻结）。
 * 门单 = spec v1.5 content.platform dy-* 三条目 check + 包体积分列 + numeric 零漂移。
 * 口径：任一子门 FAIL → 聚合 FAIL（exit 1）；子门以「RESULT:」行判定（与 web/wx 契约同约定）。
 * 真机档（抖音开发者工具 IDE 打开工程/预览/上传）不在本聚合器——AppID + 类目/资质 + 工具到位后由主人侧执行（不造假数据）。
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GAME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const GATES = [
  ['dy-runtime（tt-runtime-surface 条目查）', 'tests/tt/tt-runtime-surface.spec.mjs'],
  ['dy-share-loop（tt-share-loop 条目查）', 'tests/tt/tt-share-loop.spec.mjs'],
  ['dy-submission-kit（tt-submission-kit 条目查）', 'tests/tt/tt-submission-kit.spec.mjs'],
  ['包体积分列（check-tt-bundle-size）', 'scripts/check-tt-bundle-size.mjs'],
  ['numeric 零漂移（check-numeric-freeze）', 'scripts/check-numeric-freeze.mjs'],
];

const results = [];
for (const [name, rel] of GATES) {
  try {
    const out = execFileSync('node', [path.join(GAME, rel)], { encoding: 'utf8', timeout: 120000 });
    // 子门 stdout 全量透传（QA 驳回②回流）：dy-runtime 口径①「接入或显式降级且门禁输出可见，
    // 输出不可见即打回」——聚合留档必须携带 DY_FRIEND_RANK=… 等原始输出行，不得只留 RESULT 行
    console.log(`----- [gate] ${name}（${rel}）stdout 开始 -----`);
    console.log(out.trimEnd());
    console.log(`----- [gate] ${name} stdout 结束 -----`);
    const last = out.trim().split('\n').filter((l) => l.startsWith('RESULT:')).pop() || '';
    results.push([name, last.includes('RESULT: PASS') ? 'PASS' : 'FAIL', last]);
  } catch (e) {
    const out = String(e.stdout || '');
    console.log(`----- [gate] ${name}（${rel}）stdout 开始（异常退出 exit=${e.status}）-----`);
    console.log(out.trimEnd());
    console.log(`----- [gate] ${name} stdout 结束 -----`);
    const last = out.trim().split('\n').filter((l) => l.startsWith('RESULT:')).pop() || `RESULT: FAIL (异常退出 exit=${e.status})`;
    results.push([name, last.includes('RESULT: PASS') ? 'PASS' : 'FAIL', last]);
  }
}
console.log('===== tt 轨门禁聚合（C 抖音移植轮 · 可机跑面）=====');
for (const [name, verdict, line] of results) console.log(`[${verdict}]  ${name}   ${line}`);
const failed = results.filter((r) => r[1] !== 'PASS');
if (failed.length) {
  console.log(`tt-GATE: FAIL (${results.length - failed.length}/${results.length})`);
  process.exit(1);
}
console.log(`tt-GATE: PASS (${results.length}/${results.length})`);
