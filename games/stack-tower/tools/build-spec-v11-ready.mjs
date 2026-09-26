#!/usr/bin/env node
/**
 * spec 版本链构建器：v3（approved，平台 cmugok2uz000xm9ilx42t8pnl）→ v1.1「登记就绪版」内容稿。
 * 复现：node games/stack-tower/tools/build-spec-v11-ready.mjs
 *
 * 版本口径（黑板 2026-09-25 判例沿袭）：任务书所称「v1 冻结数值 / v1.1 / 不产生 v1.2」=
 *  「v1 起冻结的数值七键零改动（diff 为空）+ 本轮仅此一版」；平台登记落点 =
 *  POST /api/v1/game-design-specs/cmugok2uz000xm9ilx42t8pnl/revisions（version+1 接在 v3 后，不覆盖任何旧版）。
 *
 * 纪律（主策划红线）：
 *  - 冻结段守卫：v1 冻结数值七键（DEFAULT_SEED/FIXED_STEP_MS/MAX_DT_MS/cut_width/difficulty/perfect_window/scoring）
 *    对 v1 原稿与 v3 导出件三方深比必须全等（diff 为空，否则非零退出拒绝产出）；
 *    v3 三组（audio/mobile/deploy）、world 既有 5 条规则、levels、entities、assets、既有 22 条 acceptance、
 *    content 既有段一律逐字保留；
 *  - 只做增量（QA 三处缺陷修复一次性折入）：
 *      D1 numeric 追加 benchmark_device 组 + content.benchmark 口径段；
 *      D2 acceptance 追加 acc-a7（冷启动首触即放置）+ world.architecture_rules 追加实现约束（不设 iOS 豁免）；
 *      D3 content.evidence 全局证据条款 + BGM 接缝双轨证据；
 *  - 输出：.myrd/spec/stack-tower-spec-v1.1-payload.json（POST /revisions 载荷 {spec, detail}，禁止覆盖 v3 导出件）。
 *  - 登记后注意（下一轮 D4 落盘时执行）：src/kernel/numeric.ts 需镜像追加 benchmark_device 组——
 *    契约 e07「数值总闸」对 spec.numeric 全量键序无关深比，缺镜像必红。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const V3 = JSON.parse(readFileSync(join(ROOT, '.myrd', 'spec', 'stack-tower-spec.json'), 'utf8')).spec;
const V1 = JSON.parse(readFileSync(join(ROOT, '.myrd', 'spec', 'stack-tower-spec-v1.json'), 'utf8')).spec;
const v11 = structuredClone(V3);

// ---------- 冻结段守卫 ----------
function die(msg) {
  console.error(`FAIL ${msg}`);
  process.exit(1);
}
const eq = (a, b, msg) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) die(`冻结段被改动: ${msg}`);
};
// 键序无关深比（沿契约 _runner.mjs stableStringify 同款：平台入库归一化键序，红线一律键序无关比数值）
const stableStringify = (value) => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
};
const eqStable = (a, b, msg) => {
  if (stableStringify(a) !== stableStringify(b)) die(`冻结段被改动: ${msg}`);
};
// v1 起冻结的数值七键：v1 原稿 / v3 导出件 / v1.1 三方键序无关深比全等 → 「v1 冻结数值 diff 为空」
const FROZEN_NUMERIC_SINCE_V1 = ['DEFAULT_SEED', 'FIXED_STEP_MS', 'MAX_DT_MS', 'cut_width', 'difficulty', 'perfect_window', 'scoring'];
for (const k of FROZEN_NUMERIC_SINCE_V1) {
  eqStable(v11.numeric[k], V3.numeric[k], `v1.1 vs v3 numeric.${k}`);
  eqStable(V3.numeric[k], V1.numeric[k], `v3 vs v1 numeric.${k}`);
}
// v3 三组（v3 冻结，本版不动）
for (const k of ['audio', 'mobile', 'deploy']) eqStable(v11.numeric[k], V3.numeric[k], `v3 冻结 numeric.${k}`);
// 结构冻结段
eq(v11.levels, V3.levels, 'levels');
eq(v11.entities, V3.entities, 'entities');
eq(v11.assets, V3.assets, 'assets');
eq(v11.world.architecture_rules, V3.world.architecture_rules, 'world.architecture_rules（前缀，约束见 D2 追加）');
eq(v11.acceptance, V3.acceptance, 'acceptance 既有 22 条（前缀，见 D2 追加）');
for (const k of Object.keys(V3.content)) eq(v11.content[k], V3.content[k], `content.${k}`);

// ---------- D1：numeric_add —— 中端基准机口径冻结 ----------
v11.numeric.benchmark_device = {
  LAB_RUNNER: 'playwright-chromium',
  LAB_CPU_THROTTLE_X: 4,
  LAB_VIEWPORTS_PX: [
    [390, 844],
    [360, 640],
  ],
};
v11.content.benchmark = {
  lab: '实验室自动化口径 = playwright chromium（numeric.benchmark_device.LAB_RUNNER）+ CPU throttle 4x（LAB_CPU_THROTTLE_X）+ 视口 390x844 / 360x640 两档（LAB_VIEWPORTS_PX）；acc-a5b 自动化判据（p95 ≤18.2ms、jank(>50ms)=0）在本口径下取证',
  realDevice: '真机口径单列：每台设备注明「设备型号 + UA」后单独成行列判据；禁止以「中端机」泛称合并口径，真机数据不与实验室口径混算、不互相替代',
  freeze: '本口径自 v1.1 起冻结：换浏览器内核/换节流档位/换视口/换基准设备，必须先升策划案版本（numeric.benchmark_device）再改测试',
};

// ---------- D3：全局证据条款 + BGM 接缝双轨证据 ----------
v11.content.evidence = {
  smokeLog:
    '全局证据条款：每条冒烟留文件名+日期+命令+输出摘要（落 .myrd/blackboard/gate-logs/<轮次>-<日期>-<主题>/）；四要素缺任一 = 该条冒烟无效，不得计绿、不得作为核销证据',
  bgmSeam:
    'BGM 接缝证据双轨，均不可省：①听测留档（录音或听测记录，按全局证据条款四要素入档）；' +
    '②tests/audio/bgm-loop.test.ts 调度连续性断言——循环点由调度器预排队（lookahead ≥ 0.2s），' +
    '接缝处下一循环起始时间与当前循环结束时间偏差 ≤ 16ms（1 tick）、无重叠、无静音留白。任缺其一 = 该条冒烟不通过',
};

// ---------- D2：acceptance_add —— 冷启动首触即放置 + 实现约束 ----------
v11.acceptance.push({
  id: 'acc-a7',
  statement:
    '冷启动首触即放置：冷启动（首帧渲染完成、零历史交互）后的第一次 pointerdown/tap 必须在同一首触手势内完成两件事——' +
    '①作为有效 drop 意图当 tick 落块（输入/音频闸门不得吞掉或延后到第二次手势）；' +
    '②完成 AudioContext 解锁并播出首个音效（place），首次出声不得被闸门吞掉或延后' +
    '（仍受 50ms 约束：有声局相对静音局零新增 >50ms 帧，acc-a5b 口径）。' +
    '不设 iOS 豁免条款：iOS Safari 与所有平台同口径验收（与 acc-a2 首手势解锁同手势取证，acc-a2 原文不变）。',
  check: 'npx vitest run tests/audio/events.test.ts',
});
v11.world.architecture_rules.push(
  '音频/输入闸门单向不可吞首触：AudioContext 解锁与首播必须在首触手势的事件处理同步链内完成；解锁等待、预解码 await、去抖等闸门不得吞掉或延后首次出声与首次落块；首次出声仍受 50ms 帧预算约束（acc-a5b 口径）；不设 iOS 豁免条款',
);

// ---------- meta ----------
v11.meta = {
  ...v11.meta,
  revision_note:
    'v1.1（登记就绪版）：将主策划已拍板的 QA 三处缺陷修复一次性折入，含 QA 三处缺陷修复——' +
    'D1 numeric 追加 benchmark_device 组，冻结中端基准机口径：实验室=playwright chromium + 4x CPU throttle + 390x844/360x640；真机单列注明设备型号与 UA（content.benchmark，禁止「中端机」泛称）；' +
    'D2 acceptance 追加 acc-a7「冷启动首触即放置」（tests/audio/events.test.ts）+ world 实现约束「首触手势内完成 AudioContext 解锁与播放，闸门不得吞掉或延后首次出声（仍受 50ms 约束）」，不设 iOS 豁免条款；' +
    'D3 content.evidence 增全局证据条款「每条冒烟留文件名+日期+命令+输出摘要」+ BGM 接缝双轨证据（听测留档 + tests/audio/bgm-loop.test.ts 调度连续性断言并行，均不可省）。' +
    'v1 起冻结数值七键 diff 为空，v3 三组/levels/entities/assets/既有 22 条 acceptance/world 既有规则逐字保留，本版只增不改。' +
    '版本链仅此一版：平台登记沿 v3 → POST revisions version+1 单版落账（任务书口径 v1.1 ≡ 平台链 v3 下一版），不产生 v1.2。' +
    '挂账：tests/audio/events.test.ts 与 tests/audio/bgm-loop.test.ts 落盘属 D4（主人答复 D5 前冻结），落账前由契约 not-runnable 通道显式挂起，不计绿不核销。',
};

// ---------- 校验 + 输出 ----------
const ids = v11.acceptance.map((a) => a.id);
if (new Set(ids).size !== ids.length) die('acceptance id 重复');
if (v11.acceptance.length !== 23) die(`acceptance 总数应为 23（22 既有 + acc-a7），实际 ${v11.acceptance.length}`);
if (!ids.includes('acc-a7')) die('锚点缺失：acc-a7 未入列');
if (!v11.content.evidence?.smokeLog?.includes('每条冒烟留文件名+日期+命令+输出摘要')) die('锚点缺失：全局证据条款');
if (!v11.numeric.benchmark_device?.LAB_RUNNER) die('锚点缺失：numeric.benchmark_device');

const detail =
  'v1.1 登记就绪版：含 QA 三处缺陷修复（D1/D2/D3 一次性折入）。' +
  'D1 numeric 追加 benchmark_device 组冻结中端基准机口径：实验室=playwright chromium + 4x CPU throttle + 390x844/360x640；真机单列注明设备型号与 UA（content.benchmark）。' +
  'D2 acceptance 追加 acc-a7「冷启动首触即放置」（tests/audio/events.test.ts）+ world 实现约束「首触手势内完成 AudioContext 解锁与播放，闸门不得吞掉或延后首次出声（仍受 50ms 约束）」，不设 iOS 豁免条款。' +
  'D3 content.evidence 增全局证据条款「每条冒烟留文件名+日期+命令+输出摘要」+ BGM 接缝双轨证据（听测留档 + tests/audio/bgm-loop.test.ts 调度连续性断言并行，均不可省）。' +
  'v1 起冻结数值七键 diff 为空；levels/entities/assets/既有 22 条 acceptance/world 既有规则逐字保留，本版只增不改。' +
  '版本链仅此一版：沿 v3 POST revisions version+1 单版落账，不产生 v1.2。' +
  '挂账：tests/audio/* 两用例落盘属 D4（主人答复 D5 前冻结），落账前走契约 not-runnable 通道显式挂起；' +
  '登记后 D4 落盘时需同步 src/kernel/numeric.ts 镜像 benchmark_device 组（契约 e07 数值总闸全量深比）。';

const out = join(ROOT, '.myrd', 'spec', 'stack-tower-spec-v1.1-payload.json');
writeFileSync(out, JSON.stringify({ spec: v11, detail }, null, 2) + '\n');
console.log(`OK v1.1 登记就绪载荷 → ${out}`);
console.log(`OK acceptance ${v11.acceptance.length} 条（+acc-a7）；numeric 组 ${Object.keys(v11.numeric).length} 个（+benchmark_device）；冻结数值七键三方深比全等（diff 为空）`);
