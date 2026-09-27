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
 *      （v1.2/平台 v4 起 id 在 _platform.platformSpecId，兼容旧顶层字段）
 *   B. acceptance.check 命令化 + 逐字可执行（实跑，exit 0 = PASS；非 node 命令走显式 not-runnable
 *      挂起通道——单列不计绿，且须有 spec 原文挂账条款背书，无据挂起即 FAIL）
 *   C. acceptance ↔ 工程双向映射（两族口径）：
 *        族1 level/element 级 ↔ levels[].elements（statement 携带 (level_id/element_id) 标注；
 *            v1.2 起折入核验元素可用 id 短记号追溯，如 e09 折入 e01/e03/e08）
 *        族2 横切验收 ↔ tests/contract/*.spec.mjs（双向防孤儿，泛化到全部契约族），
 *            且每个契约文件必须列入 run-all.mjs 门禁清单（聚合完整性，防文件在门禁不跑的假绿）
 *   D. entities[].script 全部落盘（支持 {a,b,c} 花括号多路径展开）；v1.2 锚点实体（kind:entity 无
 *      script）双闸核验：expect 非空 + expect 具名落点存在（repo/游戏工程双根）+ 契约文件可追溯；
 *      kernel/ 零 DOM 零平台 API 零非确定性源
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
// v1.2（平台 v4）导出件把登记 id 放在 _platform.platformSpecId；兼容更早的 _platform.id / 顶层 platformSpecId
const platformSpecId = platform.platformSpecId ?? platform.id ?? spec.platformSpecId;
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
  if (typeof a.check === 'string' && a.check.length > 0 && !a.check.startsWith('node ')) {
    // 非 node 命令 = 本门禁不可执行 → 显式挂起通道（单列、不计绿、不核销），与 run-all 退出码口径一致：
    // 「存在 FAIL → 1；全 PASS 或含 not-runnable → 0（not-runnable 单列不计绿）」。
    // 例：acc-a7（npx vitest tests/audio/events.test.ts）——spec revision_note 内置 D4 冻结条款，落盘待主人 D5 答复。
    notRunnable.push(`${id}（check=${a.check}）`);
    continue;
  }
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
// 挂起护栏：not-runnable 必须是 spec 自身声明过的挂账（id 或 check 指向的文件出现在挂账文本中），
// 否则视为门禁被静默豁免 → FAIL。spec 挂账文本 = 含「挂账」或「not-runnable 通道」的 spec 原文行。
if (notRunnable.length) {
  const raw = readFileSync(SPEC_PATH, 'utf8');
  const ledgerLines = raw.split('\n').filter((l) => /挂账|not-runnable 通道/.test(l)).join('\n');
  check(ledgerLines.length > 0, 'B. 存在 not-runnable 挂起项，但 spec 原文未声明任何挂账条款（无据挂起）');
  for (const item of notRunnable) {
    const id = item.split('（')[0];
    const fileRef = /(?:tests|games)\/[\w./-]+/.exec(item)?.[0] ?? '';
    check(
      (id !== '' && ledgerLines.includes(id)) || (fileRef !== '' && ledgerLines.includes(fileRef)),
      `B. ${id} 的 not-runnable 挂起无 spec 挂账条款背书（须在 spec 原文挂账/冻结条款中出现 id 或 ${fileRef || '目标文件'}）`,
    );
  }
}

// ---------- C. acceptance ↔ 工程双向映射（两族口径） ----------
// 族1（level/element 级）：id 前缀 ac-lvl*（spec 命名口径 ac-lvl01-e01…），statement 需携带 (level_id/element_id)
//   标注 ↔ levels[].elements 对应；
//   v1.2 起允许「折入核验」元素：spec revision_note 显式声明其断言折入其他元素契约的（如 e09 开局摆位
//   折入 e01/e03/e08），此类元素无独立 acceptance，但必须满足 id 可追溯——出现在 ≥1 条 acceptance 语句
//   或 ≥1 个契约测试文件中，杜绝真孤儿。
// 族2（横切验收）： ↔ tests/contract/*.spec.mjs 双向（防孤儿），并断言 run-all 聚合完整性
//   （acceptance 指向的契约文件必须进 run-all 门禁清单，防「文件在、门禁不跑」的假绿）。
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
// 契约目录盘点（族1 可追溯通道 + 族2 双向共用）
const contractDir = join(REPO_ROOT, 'games', 'stack-tower', 'tests', 'contract');
const contractFiles = readdirSync(contractDir).filter((f) => f.endsWith('.spec.mjs'));
const RUN_ALL_FILE = 'run-all.mjs';
const runAllSrc = readFileSync(join(contractDir, RUN_ALL_FILE), 'utf8');
const contractSrcs = new Map(
  contractFiles.map((f) => [f, readFileSync(join(contractDir, f), 'utf8')]),
);
const acceptanceBlob = acc.map((a) => `${a.id ?? ''}\n${a.statement ?? ''}`).join('\n');
// 族1 正向
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
// 族1 反向：元素必须有专属 acceptance 标注，或 id 在 acceptance/契约文件中被显式引用（折入核验通道）。
// 引用记号接受三种等价形态：复合 id（lvl-01…/e09-opening-stack）、元素短 id（e09-opening-stack）、
// 首段短记号（e09）——spec acceptance 与契约文件对 e09 的实际引用三种并存（v1.2 revision_note 折入口径）。
const foldedElements = [];
for (const elId of specElementIds) {
  if (accElementIds.has(elId)) continue;
  const elementId = elId.split('/').pop() ?? '';
  const shortToken = elementId.split('-')[0] ?? '';
  const tokens = [elId, elementId, shortToken.length >= 3 ? shortToken : ''].filter(Boolean);
  const referenced =
    tokens.some((t) => acceptanceBlob.includes(t)) ||
    [...contractSrcs.values()].some((s) => tokens.some((t) => s.includes(t)));
  if (referenced) foldedElements.push(elId);
  else check(false, `C. spec 元素 ${elId} 没有对应的 acceptance 条目，且未被任何 acceptance/契约文件引用（孤儿元素）`);
}
// 族2 双向：横切 acceptance 的 check ↔ 契约文件（孤儿条目/孤儿测试都算失败）
const crossFiles = new Set();
for (const a of crossScoped) {
  const isNode = typeof a.check === 'string' && a.check.startsWith('node ');
  const rel = isNode ? a.check.replace(/^node\s+/, '') : '';
  if (!isNode) continue; // not-runnable 通道（B 段已记并要求 spec 挂账背书），不在族2 重复计
  check(rel.startsWith('games/stack-tower/tests/contract/'), `C. ${a.id} 横切验收命令应指向 games/stack-tower/tests/contract/`);
  if (!rel.startsWith('games/stack-tower/tests/contract/')) continue;
  const file = rel.split('/').pop() ?? '';
  check(existsSync(join(contractDir, file)), `C. ${a.id} 指向的契约文件缺失: ${rel}`);
  check(contractFiles.includes(file), `C. ${a.id} 指向的 ${file} 不在契约目录清单里`);
  crossFiles.add(file);
}
for (const f of contractFiles) {
  const referencedByAcc = acc.some((a) => typeof a.check === 'string' && a.check.includes(f));
  check(referencedByAcc, `C. 契约文件 ${f} 没有对应的 acceptance 条目（孤儿测试，spec 契约面与测试面失配）`);
  check(runAllSrc.includes(`'${f}'`), `C. 契约文件 ${f} 未列入 ${RUN_ALL_FILE} 门禁清单（文件在、门禁不跑 = 假绿）`);
}
check(
  levelScoped.length + crossScoped.length === acc.length,
  `C. acceptance 分族计数失配：${levelScoped.length}+${crossScoped.length} ≠ ${acc.length}`,
);
console.log(`[C] 双向映射：level/element ${accElementIds.size} ↔ elements ${specElementIds.size}（折入核验 ${foldedElements.length}：${foldedElements.join(' , ') || '—'}）；横切 acceptance ${crossFiles.size} ↔ 契约文件 ${contractFiles.length}（run-all 聚合全量核对）`);

// ---------- D. entities 落盘 + kernel 纯净性 ----------
/** 实体落点展开：spec 允许 {a,b,c} 花括号多路径（如 e-pwa-shell 的 PWA 壳四落点），全部必须存在 */
function expandEntityScripts(script) {
  const m = /\{([^}]+)\}/.exec(script ?? '');
  if (!m) return [script];
  const prefix = (script ?? '').slice(0, m.index);
  const suffix = (script ?? '').slice(m.index + m[0].length);
  return m[1].split(',').map((alt) => prefix + alt.trim() + suffix);
}
let anchorEntities = 0;
for (const e of entities) {
  if (typeof e.script === 'string' && e.script.length > 0) {
    for (const p of expandEntityScripts(e.script)) {
      check(existsSync(join(REPO_ROOT, p)), `D. 实体 ${e.id} 落点缺失: ${p}`);
    }
    continue;
  }
  // v1.2 起新增锚点实体形态（kind:entity，无 script 落点声明）：契约锚点，双闸核验——
  // ① expect 契约描述非空，且 expect 具名的仓库落点真实存在；
  // ② id 被至少一个契约测试文件显式引用（无契约锚定 = 空悬锚点）。
  anchorEntities++;
  check(e.kind === 'entity', `D. 实体 ${e.id} 缺 script 落点声明（亦非 kind:entity 锚点形态）`);
  check(typeof e.expect === 'string' && e.expect.length > 0, `D. 锚点实体 ${e.id} 缺 expect 契约描述`);
  for (const p of e.expect?.match(/(?:games|src|assets)\/[\w./-]+/g) ?? []) {
    // expect 里的落点可能是 repo 根相对（games/…）或游戏工程根相对（src/…、assets/…），双根解析
    const gameRoot = join(REPO_ROOT, 'games', 'stack-tower');
    check(
      existsSync(join(REPO_ROOT, p)) || existsSync(join(gameRoot, p)),
      `D. 锚点实体 ${e.id} expect 具名落点缺失: ${p}（repo 根与 games/stack-tower 根均不存在）`,
    );
  }
  check(
    [...contractSrcs.values()].some((s) => s.includes(e.id)),
    `D. 锚点实体 ${e.id} 未被任何契约测试文件引用（空悬锚点）`,
  );
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
console.log(`[D] entities 落盘 ${entities.length}/${entities.length}（含锚点实体 ${anchorEntities}，契约可追溯）；kernel 纯净性 ${readdirSync(kernelDir).length} 文件扫描完成`);

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
