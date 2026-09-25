#!/usr/bin/env node
/**
 * 契约检查（提交前置条件）— 读 approved 版策划案（.myrd/spec/design-spec.json），
 * 断言工程实现与 spec 一致。复现：
 *
 *   node scripts/contract-check.mjs
 *
 * 检查面（任一失败 → 汇总列出并以非零退出码结束，绝不静默）：
 *   A. spec 基线可达且 status=approved（候选版口径：approved）
 *   B. acceptance.check 100% 命令化，且命令逐字可执行（实跑，exit 0 = PASS）
 *   C. acceptance ↔ levels[].elements 双向映射（level_id/element_id 与契约文件名一致）
 *   D. entities[].script 全部落盘；kernel/ 零 DOM 零平台 API 零非确定性源
 *   E. assets[].file 全部落盘（程序化生成器 = 仓库内源文件）
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SPEC_PATH = join(REPO_ROOT, '.myrd', 'spec', 'design-spec.json');

const problems = [];
const notes = [];
const check = (cond, msg) => {
  if (!cond) problems.push(msg);
  return cond;
};

// ---------- A. spec 基线 ----------
if (!check(existsSync(SPEC_PATH), `A. spec 基线不可达: ${SPEC_PATH}`)) {
  console.log('RESULT: FAIL (0 项可继续)');
  process.exit(1);
}
const spec = JSON.parse(readFileSync(SPEC_PATH, 'utf8'));
check(spec.status === 'approved', `A. spec status=${spec.status}，应为 approved（候选版口径）`);
const acc = spec.spec?.acceptance ?? [];
const levels = spec.spec?.levels ?? [];
const entities = spec.spec?.entities ?? [];
const assets = spec.spec?.assets ?? [];
console.log(`[A] spec 基线：platformSpecId=${spec.platformSpecId} status=${spec.status} acceptance=${acc.length} levels=${levels.length} entities=${entities.length} assets=${assets.length}`);

// ---------- B. acceptance 100% 命令化 + 逐字可执行 ----------
let executed = 0;
for (const a of acc) {
  const id = a.id ?? '(无 id)';
  if (!check(typeof a.check === 'string' && a.check.startsWith('node '), `B. ${id} 的 check 不是可粘贴 node 命令`)) continue;
  const rel = a.check.replace(/^node\s+/, '');
  const abs = join(REPO_ROOT, rel);
  if (!check(existsSync(abs), `B. ${id} 的契约文件缺失: ${rel}`)) continue;
  const r = spawnSync(process.execPath, [abs], { cwd: REPO_ROOT, encoding: 'utf8', timeout: 60000 });
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  if (!check(r.status === 0, `B. ${id} 实跑失败（exit=${r.status}）\n${out.trim().split('\n').filter((l) => /FAIL|not-runnable|Error/i.test(l)).slice(0, 4).join('\n')}`)) {
    continue;
  }
  if (!check(/RESULT: PASS/.test(out), `B. ${id} 输出未含 RESULT: PASS`)) continue;
  executed++;
}
console.log(`[B] acceptance 命令化 + 实跑：${executed}/${acc.length} PASS`);

// ---------- C. acceptance ↔ levels[].elements 双向映射 ----------
const specElementIds = new Set(levels.flatMap((l) => (l.elements ?? []).map((e) => e.id)));
const accElementIds = new Set();
for (const a of acc) {
  const m = /[（(]([a-z0-9-]+)\/([a-z0-9-]+)[）)]/i.exec(a.statement ?? '');
  if (!check(m, `C. ${a.id} statement 未标注 (level_id/element_id)`)) continue;
  const [, levelId, elementId] = m;
  const composite = `${levelId}/${elementId}`;
  accElementIds.add(composite);
  const expectedFile = `games/stack-tower/tests/contract/${levelId}_${elementId}.spec.mjs`;
  check(a.check.includes(expectedFile), `C. ${a.id} 命令与编号不一致：期望包含 ${expectedFile}`);
  check(specElementIds.has(composite), `C. ${composite} 未在 spec.levels[].elements 声明`);
}
for (const elId of specElementIds) {
  check(accElementIds.has(elId), `C. spec 元素 ${elId} 没有对应的 acceptance 条目`);
}
console.log(`[C] 双向映射：acceptance ${accElementIds.size} ↔ elements ${specElementIds.size}`);

// ---------- D. entities 落盘 + kernel 纯净性 ----------
for (const e of entities) {
  const abs = join(REPO_ROOT, e.script ?? '');
  check(e.script && existsSync(abs), `D. 实体 ${e.id} 脚本缺失: ${e.script}`);
}
const kernelDir = join(REPO_ROOT, 'games', 'stack-tower', 'src', 'kernel');
const BANNED = ['Math.random', 'Date.now', 'performance.now', 'window.', 'document.', 'AudioContext', 'requestAnimationFrame'];
/** 剥离注释后扫描（内核文件头「禁用清单」说明文字不算引用） */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}
for (const f of readdirSync(kernelDir)) {
  const src = stripComments(readFileSync(join(kernelDir, f), 'utf8'));
  for (const b of BANNED) {
    check(!src.includes(b), `D. kernel/${f} 出现违禁引用 ${b}（确定性/零 DOM 红线）`);
  }
}
console.log(`[D] entities 落盘 ${entities.length}/${entities.length}；kernel 纯净性 ${readdirSync(kernelDir).length} 文件扫描完成`);

// ---------- E. assets 落盘 ----------
for (const a of assets) {
  check(a.file && existsSync(join(REPO_ROOT, a.file)), `E. 资产 ${a.id} 落点缺失: ${a.file}`);
  check(a.source === 'generated', `E. 资产 ${a.id} source 应为 generated（零外部资源红线）`);
}
console.log(`[E] assets 落盘 ${assets.length}/${assets.length}（全部 generated，零外部资源）`);

notes.push('说明：acceptance 实跑即「契约测试通过记录」（B 段逐条执行 tests/contract/*.spec.mjs）。');

if (problems.length) {
  console.log('\n—— 失败明细 ——');
  for (const p of problems) console.log('✗ ' + p);
  console.log(`RESULT: FAIL (${problems.length} 项)`);
  process.exit(1);
}
console.log('\n' + notes.join('\n'));
console.log('RESULT: PASS（spec ↔ 工程一致）');
