#!/usr/bin/env node
/**
 * 契约检查（提交前置条件）— 读 approved 版策划案，断言工程实现与 spec 一致。复现：
 *
 *   node scripts/contract-check.mjs
 *
 * spec 基线解析（版本链红线，见 .myrd/spec/README.md「一游戏一文件」）：
 *   stack-tower 的 approved 导出件 = .myrd/spec/stack-tower-spec.json（platformSpecId 登记版）；
 *   仅当其缺失时回退 .myrd/spec/design-spec.json（旧工作区口径；该文件在 2026-09-25 之后
 *   为糖果线撞车冻结件，内容是已被取代的 stack-tower v2，不得作为契约依据）。
 *
 * 检查面（任一失败 → 汇总列出并以非零退出码结束，绝不静默）：
 *   A. spec 基线可达且 status=approved（候选版口径：approved）+ platformSpecId 登记凭据在位
 *   B. acceptance.check 100% 命令化，且命令逐字可执行（实跑，exit 0 = PASS；not-runnable 单列不计绿）
 *   C. acceptance ↔ 工程双向映射（两族口径）：
 *        族1 level/element 级 ↔ levels[].elements（statement 携带 (level_id/element_id) 标注）
 *        族2 横切验收 ↔ tests/contract/m21-*.spec.mjs（双向，孤儿测试/孤儿条目都算失败）
 *   D. entities[].script 全部落盘（支持 {a,b,c} 花括号多路径展开）；kernel/ 零 DOM 零平台 API 零非确定性源
 *   E. assets[].file 全部落盘（程序化生成器 = 仓库内源文件）
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SPEC_CANDIDATES = [
  join(REPO_ROOT, '.myrd', 'spec', 'stack-tower-spec.json'),
  join(REPO_ROOT, '.myrd', 'spec', 'design-spec.json'),
];
const SPEC_PATH = SPEC_CANDIDATES.find((p) => existsSync(p));

const problems = [];
const notes = [];
const check = (cond, msg) => {
  if (!cond) problems.push(msg);
  return cond;
};

// ---------- A. spec 基线 ----------
if (!check(SPEC_PATH !== undefined, `A. spec 基线不可达（已尝试：${SPEC_CANDIDATES.join(' , ')}）`)) {
  console.log('RESULT: FAIL (0 项可继续)');
  process.exit(1);
}
const spec = JSON.parse(readFileSync(SPEC_PATH, 'utf8'));
// 形状兼容：平台登记导出件把 id/version/status 收进 _platform；旧导出件在顶层
const platform = spec._platform ?? {};
const specStatus = platform.status ?? spec.status;
const platformSpecId = platform.id ?? spec.platformSpecId;
const specVersion = platform.version ?? spec.version;
check(specStatus === 'approved', `A. spec status=${specStatus}，应为 approved（候选版口径）`);
check(typeof platformSpecId === 'string' && platformSpecId.length > 0, 'A. 缺 platformSpecId（平台登记凭据，全链唯一 approved 版）');
const acc = spec.spec?.acceptance ?? [];
const levels = spec.spec?.levels ?? [];
const entities = spec.spec?.entities ?? [];
const assets = spec.spec?.assets ?? [];
console.log(`[A] spec 基线：${SPEC_PATH.replace(`${REPO_ROOT}/`, '')} · platformSpecId=${platformSpecId} v${specVersion} status=${specStatus} acceptance=${acc.length} levels=${levels.length} entities=${entities.length} assets=${assets.length}`);

// ---------- B. acceptance 100% 命令化 + 逐字可执行 ----------
const notRunnable = [];
let executed = 0;
for (const a of acc) {
  const id = a.id ?? '(无 id)';
  if (!check(typeof a.check === 'string' && a.check.startsWith('node '), `B. ${id} 的 check 不是可粘贴 node 命令`)) continue;
  const rel = a.check.replace(/^node\s+/, '');
  const abs = join(REPO_ROOT, rel);
  if (!check(existsSync(abs), `B. ${id} 的契约文件缺失: ${rel}`)) continue;
  // 浏览器级契约（m1/m3/d2 冒烟族）拉起 Chromium，给足超时；env 原样透传（PLAYWRIGHT_MODULE_DIR）
  const r = spawnSync(process.execPath, [abs], { cwd: REPO_ROOT, encoding: 'utf8', timeout: 120000 });
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  const resultLine = out.trim().split('\n').reverse().find((l) => l.startsWith('RESULT:')) ?? '';
  if (resultLine.startsWith('RESULT: not-runnable')) {
    notRunnable.push(id);
    check(false, `B. ${id} not-runnable（不静默计绿）→ ${rel}；浏览器级契约需 PLAYWRIGHT_MODULE_DIR 指向全局 node_modules`);
    continue;
  }
  if (!check(r.status === 0, `B. ${id} 实跑失败（exit=${r.status}）\n${out.trim().split('\n').filter((l) => /FAIL|not-runnable|Error/i.test(l)).slice(0, 4).join('\n')}`)) {
    continue;
  }
  if (!check(/RESULT: PASS/.test(out), `B. ${id} 输出未含 RESULT: PASS`)) continue;
  executed++;
}
const notRunnableNote = notRunnable.length ? `（not-runnable ${notRunnable.length}：${notRunnable.join(' , ')}，单列不计绿）` : '';
console.log(`[B] acceptance 命令化 + 实跑：${executed}/${acc.length} PASS${notRunnableNote}`);

// ---------- C. acceptance ↔ 工程双向映射（两族口径） ----------
// 族1（level/element 级）：id 前缀 ac-lvl*（spec 命名口径 ac-lvl01-e01…），statement 需携带 (level_id/element_id)
//   标注 ↔ levels[].elements 一一对应；
// 族2（横切验收，M2.1 acc-a/m/d 族）： ↔ tests/contract/m21-*.spec.mjs 一一对应（双向，防孤儿）。
// 分族按 id 前缀判，不用 statement 正则猜——陈述里的 `2^(semitones/12)` 之类文本会污染括号标注匹配。
const specElementIds = new Set(levels.flatMap((l) => (l.elements ?? []).map((e) => e.id)));
const ELEMENT_MARKER = /[（(]([a-z0-9-]+)\/([a-z0-9-]+)[）)]/i;
const LEVEL_ID_PREFIX = 'ac-lvl';
const levelScoped = [];
const crossScoped = [];
for (const a of acc) {
  const isLevelScoped = typeof a.id === 'string' && a.id.startsWith(LEVEL_ID_PREFIX);
  (isLevelScoped ? levelScoped : crossScoped).push(a);
}
// 族1 双向
const accElementIds = new Set();
for (const a of levelScoped) {
  const m = ELEMENT_MARKER.exec(a.statement ?? '');
  if (!check(m !== null, `C. ${a.id}（level/element 族）statement 未标注 (level_id/element_id)`)) continue;
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
// 族2 双向：横切 acceptance 的 check ↔ m21 契约文件命名（孤儿条目/孤儿测试都算失败）
const contractDir = join(REPO_ROOT, 'games', 'stack-tower', 'tests', 'contract');
const m21Files = new Set(readdirSync(contractDir).filter((f) => /^m21-.*\.spec\.mjs$/.test(f)));
const crossFiles = new Set();
for (const a of crossScoped) {
  const rel = typeof a.check === 'string' ? a.check.replace(/^node\s+/, '') : '';
  check(rel.startsWith('games/stack-tower/tests/contract/'), `C. ${a.id} 横切验收命令应指向 games/stack-tower/tests/contract/`);
  const file = rel.split('/').pop() ?? '';
  check(file.startsWith('m21-'), `C. ${a.id} 横切验收文件命名应归入 m21 契约族: ${file}`);
  crossFiles.add(file);
}
for (const f of m21Files) {
  check(crossFiles.has(f), `C. 契约文件 ${f} 没有对应的横切 acceptance 条目（孤儿测试，spec 契约面与测试面失配）`);
}
for (const f of crossFiles) {
  if (f) check(m21Files.has(f), `C. acceptance 指向的 ${f} 不在 m21 契约族命名里`);
}
check(
  levelScoped.length + crossScoped.length === acc.length,
  `C. acceptance 分族计数失配：${levelScoped.length}+${crossScoped.length} ≠ ${acc.length}`,
);
console.log(`[C] 双向映射：level/element ${accElementIds.size} ↔ elements ${specElementIds.size}；横切 acceptance ${crossScoped.length} ↔ m21 契约 ${m21Files.size}`);

// ---------- D. entities 落盘 + kernel 纯净性 ----------
/** 实体落点展开：spec 允许 {a,b,c} 花括号多路径（如 e-pwa-shell 的 PWA 壳四落点），全部必须存在 */
function expandEntityScripts(script) {
  const m = /\{([^}]+)\}/.exec(script ?? '');
  if (!m) return [script];
  const prefix = (script ?? '').slice(0, m.index);
  const suffix = (script ?? '').slice(m.index + m[0].length);
  return m[1].split(',').map((alt) => prefix + alt.trim() + suffix);
}
for (const e of entities) {
  const paths = expandEntityScripts(e.script);
  check(typeof e.script === 'string' && e.script.length > 0, `D. 实体 ${e.id} 缺 script 落点声明`);
  for (const p of paths) {
    check(existsSync(join(REPO_ROOT, p)), `D. 实体 ${e.id} 落点缺失: ${p}`);
  }
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
