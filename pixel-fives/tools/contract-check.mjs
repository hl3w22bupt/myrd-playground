#!/usr/bin/env node
/**
 * contract-check.mjs —— 像素街机足球 Pixel Fives · 契约测试门禁（acc-07 落点）。
 *
 * ★ 重建说明（2026-09-22）：本文件在 2026-09-21 晚合并（d0487cf，两段历史无共同祖先）中
 *   随 `.myrd/spec/design-spec.json` 路径撞车一并丢失（原稿从未入库）。本版按
 *   evidence-prog-m1.md §2 规格**重建**：双模式（spec approved → 全量强制；未批准 →
 *   结构契约强制，pending check 落点降级 warning）。规格依据见该文件 §2/§5，非原稿复原。
 *
 * 断言依据 = .myrd/spec/design-spec-pixel-fives.json（v1.2 approved 导出件，字节级还原自 d9f2f13）。
 * 与糖果线 `scripts/contract-check.mjs` 分工：本脚本只断言 pixel-fives 工程，路径互不重叠。
 *
 * 退出码：0 全过；1 契约失败。warning 不影响退出码（pending 落点由 QA 按打回）。
 * 零依赖（仅 node 内置模块），可在 CI / preHook 直接运行。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..'); // pixel-fives/tools → 仓库根
const args = process.argv.slice(2);
function argOf(name, dflt) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : dflt;
}
const specPath = path.resolve(REPO_ROOT, argOf('--spec', '.myrd/spec/design-spec-pixel-fives.json'));
const projectRoot = path.resolve(REPO_ROOT, argOf('--project', 'pixel-fives'));

const failures = [];
const passes = [];
const warnings = [];
const pass = (m) => passes.push(m);
const fail = (m) => failures.push(m);
const warn = (m) => warnings.push(m);
const rel = (p) => path.relative(REPO_ROOT, p) || '.';

// ---- ① spec 存在且可解析 ----
if (!fs.existsSync(specPath)) {
  console.error(`CONTRACT: FAIL spec 文件不存在: ${rel(specPath)}（先走策划案流程并导出 approved 版）`);
  process.exit(1);
}
let spec;
try {
  spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  pass(`spec 可解析: ${rel(specPath)}`);
} catch (e) {
  console.error(`CONTRACT: FAIL spec 不可解析: ${e.message}`);
  process.exit(1);
}

// ---- ② 模式判定：approved → 强制；否则 pending 模式（结构强制 + 落点 warning）----
const status = spec.meta && spec.meta.status;
const enforced = status === 'approved';
if (enforced) {
  pass(`spec 为 approved 版（v${spec.meta.spec_version}，${spec.meta.approved_at}）→ 强制模式`);
} else {
  warn(`spec 状态=${status ?? '未知'} → pending 模式：结构契约强制，check 落点降级 warning`);
}

function mustExist(p, label, kind = 'fail') {
  const full = path.resolve(REPO_ROOT, p);
  if (fs.existsSync(full)) {
    pass(`${label} 存在: ${p}`);
    return true;
  }
  if (kind === 'warn') warn(`${label} 落点未交付（pending，QA 按此打缺陷）: ${p}`);
  else fail(`${label} 路径悬空: ${p}`);
  return false;
}

// ---- ③ 实体落点（R-07：src/entities/<id>.js）----
const entList = (spec.entities && spec.entities.list) || [];
for (const e of entList) {
  const pending = e.script_status && e.script_status !== 'in-repo';
  mustExist(e.script, `实体 ${e.id} script`, enforced && !pending ? 'fail' : 'warn');
  if (pending) warn(`实体 ${e.id} script_status=${e.script_status}（落点声明，程序线 M1 内交付）`);
}

// ---- ④ 关卡落点 + 元素 id 稳定唯一 ----
const lvList = (spec.levels && spec.levels.list) || [];
const elIds = [];
for (const lv of lvList) {
  const pending = lv.script_status && lv.script_status !== 'in-repo';
  const ok = mustExist(lv.script, `关卡 ${lv.id} script`, enforced && !pending ? 'fail' : 'warn');
  if (ok) {
    const src = fs.readFileSync(path.resolve(REPO_ROOT, lv.script), 'utf8');
    for (const el of lv.elements || []) {
      elIds.push(el.id);
      if (src.includes(el.id)) pass(`关卡元素 ${el.id} 在 ${path.basename(lv.script)} 落位`);
      else fail(`关卡元素 ${el.id} 未在关卡 script 落位: ${lv.script}`);
    }
  }
}
const dup = elIds.filter((x, i) => elIds.indexOf(x) !== i);
if (elIds.length && dup.length === 0) pass(`关卡元素编号唯一性核对完成（${elIds.length} 个）`);
else if (dup.length) fail(`关卡元素编号重复: ${[...new Set(dup)].join(', ')}`);

// ---- ⑤ 实体-资产 id 对齐（A01..A08 须在 manifest 资产清单）----
const manifestPath = path.join(projectRoot, 'assets', 'manifest.json');
let manifestAssetIds = [];
if (fs.existsSync(manifestPath)) {
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    // manifest.assets 形状：数组（[{id:"A01",…},…]），兼容历史 dict 形状
    const raw = manifest.assets || [];
    manifestAssetIds = Array.isArray(raw)
      ? raw.map((x) => x && x.id).filter(Boolean)
      : Object.keys(raw);
    pass(`资产 manifest 可解析（${manifestAssetIds.length} 项资产：${manifestAssetIds.join(',')}）`);
  } catch (e) {
    fail(`资产 manifest 不可解析: ${e.message}`);
  }
} else {
  fail(`资产 manifest 缺失: ${rel(manifestPath)}`);
}
for (const e of entList) {
  for (const a of e.assets || []) {
    const aid = (a.match(/A0[1-9]/) || [])[0];
    if (!aid) continue;
    const hit = manifestAssetIds.find((k) => k.startsWith(aid) || (manifestAssetIds.some && k === aid));
    if (hit) pass(`实体 ${e.id} 资产 ${aid} 与 manifest 对齐（${hit}）`);
    else fail(`实体 ${e.id} 引用资产 ${aid} 不在 manifest 资产清单`);
  }
}

// ---- ⑥ 数值单源（numeric.single_source = constants.js；关键值断言）----
const singleSource = spec.numeric && spec.numeric.single_source;
if (singleSource && fs.existsSync(path.resolve(REPO_ROOT, singleSource))) {
  pass(`数值单源就绪: ${singleSource}`);
  const src = fs.readFileSync(path.resolve(REPO_ROOT, singleSource), 'utf8');
  const expect = [
    [/export const TICK_HZ = 60;/, 'tick_hz=60'],
    [/export const MATCH_DURATION_S = 90;/, 'match.duration_s=90'],
    [/export const GOAL_CELEBRATION_S = 1\.2;/, 'goal_celebration_s=1.2'],
    [/export const GOAL_SFX_AT_S = 0\.0;/, 'goal_sfx_at_s=0.0'],
    [/export const RED_LINE_INPUT_TO_SHOT_MS = 50;/, 'red_line.input_to_shot_latency_ms=50'],
    [/start: 42, end: 141/, 'bot_sim.seeds=42..141'],
    [/GOALS: \[1, 12\]/, 'bot_sim.goal_range=[1,12]'],
    [/DURATION_S: \[80, 100\]/, 'bot_sim.duration_in_range_s=[80,100]'],
    [/export const A06 = \{ frames: 9, fps: 12, duration_s: 0\.75, contact_frame: 3 \};/, 'a06 9帧/12fps/0.75s/contact3'],
  ];
  for (const [re, label] of expect) {
    if (re.test(src)) pass(`数值 ${label} 在单源有对应`);
    else fail(`数值 ${label} 未在数值单源找到（constants.js 漂移）`);
  }
  // acc-09 槽位翻转状态报告（翻转与否不构成契约失败，属流程项）
  warn(`acc-09 槽位状态: PENDING_APPROVED_SLOTS ${src.includes('PENDING_APPROVED_SLOTS') ? '尚未翻转（spec approved 后由程序线翻转并回报主策划）' : '已翻转'}`);
} else {
  fail(`数值单源缺失: ${singleSource}`);
}

// ---- ⑦ acceptance check 落点存在性（pending 机制：缺失 = warning，QA 按此打缺陷）----
const accItems = (spec.acceptance && spec.acceptance.items) || [];
for (const a of accItems) {
  // check 串里抽工程内路径（pixel-fives/… 或 tools/…）；「contract-check 例行任务」类自引用跳过
  const m = (a.check || '').match(/(pixel-fives\/[^\s（(]+)/);
  if (!m) {
    pass(`验收项 ${a.id} check 为例行任务口径（${(a.check || '').slice(0, 40)}…）`);
    continue;
  }
  mustExist(m[1], `验收项 ${a.id} check`, 'warn');
}

// ---- 汇总 ----
console.log('—— 契约测试输出 ——');
for (const p of passes) console.log(`  PASS  ${p}`);
for (const w of warnings) console.log(`  WARN  ${w}`);
for (const f of failures) console.log(`  FAIL  ${f}`);
console.log(`—— 合计 ${passes.length} PASS / ${warnings.length} WARN / ${failures.length} FAIL ——`);
if (!enforced && failures.length === 0) console.log('CONTRACT: PASS（pending 模式：结构契约通过，check 落点以 WARN 列出）');
else if (failures.length === 0) console.log('CONTRACT: PASS 实现与 approved 策划案一致');
else console.log('CONTRACT: FAIL 实现与策划案不一致（见 FAIL 明细）');
process.exit(failures.length === 0 ? 0 : 1);
