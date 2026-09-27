/**
 * spec v1.2 建版载荷构建器（霓虹夜塔视觉与 juice 冲刺 r4 · 2026-09-27）
 *
 * 输入：.myrd/spec/stack-tower-spec-v1.1-payload.json（v3 + D1/D2/D3 纸面终稿，未单独登记）
 * 输出：.myrd/spec/stack-tower-spec-v1.2-payload.json（POST /revisions 载荷 {spec, detail}）
 *
 * 版本映射（blockers.md §E2）：平台 v4 ≡ 任务书口径 spec v1.2
 *   = v1.1 未登记增量完整折入（零丢失）+ 本轮 juice 冲刺增量
 *
 * 增量清单（只增不改，唯二显式修订 = e08 语句 + revision_note）：
 *   N1-1 acceptance 补四判据（acc-j1 首块≤3s / acc-j2 juice≤100ms / acc-j3 音画≤50ms QA 重定义 / acc-j4 重开≤1.5s）
 *   N1-2 acc-j5 首局无弹窗 + acc-e1 数据事件三要素 + acc-t1 theme 单一常量源 + acc-a8 P0 资产查表 + acc-num 冻结数值机械断言
 *   N1-3 levels 段写明开局 3–5 块初始摆位（落点文件+参数名）+ e08 口径同步修订（显式留痕）
 *   N1-4 统计三行（85%/3局/20%）标注 B 轮启动门槛，本轮验收范围=埋点完整性与字段合规（content.analytics）
 *   N1-5 entities 登记 theme.js 单一常量源为契约锚点（+ e-ripple-renderer / e-telemetry-emitter）
 *   N1-6 numeric 冻结七键与 v1 逐字节一致（机械断言）；新增 numeric.opening 组（镜像 numeric.ts）
 *   N1-7 assets 登记 P0 13 项（a08..a20）
 *
 * 冻结守卫：v1 冻结七键 vs v1.2 键序无关深比全等 + sha256 一致，违反即拒绝产出。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../');
const V1 = path.join(ROOT, '.myrd/spec/stack-tower-spec-v1.json');
const V11 = path.join(ROOT, '.myrd/spec/stack-tower-spec-v1.1-payload.json');
const OUT = path.join(ROOT, '.myrd/spec/stack-tower-spec-v1.2-payload.json');

const stable = (o) => JSON.stringify(o, Object.keys(o ?? {}).sort?.() ?? undefined);
const deepEq = (a, b) => JSON.stringify(a) === JSON.stringify(b); // 调用侧先 sortKeys
const sortKeys = (o) => {
  if (Array.isArray(o)) return o.map(sortKeys);
  if (o && typeof o === 'object') {
    return Object.fromEntries(Object.keys(o).sort().map((k) => [k, sortKeys(o[k])]));
  }
  return o;
};
const sha = (o) => createHash('sha256').update(JSON.stringify(sortKeys(o))).digest('hex');

const v1spec = JSON.parse(readFileSync(V1, 'utf8')).spec ?? JSON.parse(readFileSync(V1, 'utf8'));
const base = JSON.parse(readFileSync(V11, 'utf8'));
const spec = structuredClone(base.spec);

// —— N1-6 冻结守卫：v1 冻结七键逐字节一致（键序无关深比 + hash）——
const FROZEN_KEYS = ['DEFAULT_SEED', 'FIXED_STEP_MS', 'MAX_DT_MS', 'perfect_window', 'cut_width', 'scoring', 'difficulty'];
const frozen = {};
for (const k of FROZEN_KEYS) frozen[k] = spec.numeric[k];
const v1Frozen = {};
for (const k of FROZEN_KEYS) v1Frozen[k] = v1spec.numeric[k];
if (!deepEq(sortKeys(frozen), sortKeys(v1Frozen))) {
  console.error('FROZEN GUARD FAIL: v1 冻结七键漂移');
  process.exit(1);
}
console.log(`[guard] v1 冻结七键深比全等 ✓ sha256(v1)=${sha(v1Frozen).slice(0, 16)}… sha256(v1.2)=${sha(frozen).slice(0, 16)}…`);

// —— N1-6 numeric.opening 组（镜像 src/kernel/numeric.ts，N4 落码）——
if (spec.numeric.opening) throw new Error('numeric.opening 已存在：禁止重复登记');
spec.numeric.opening = { STACK_MIN_BLOCKS: 3, STACK_MAX_BLOCKS: 5, STACK_WIDTH_JITTER_PX: 6 };
console.log('[inc ] numeric.opening 组已登记（3–5 块初始摆位，确定性 seeded）');

// —— N1-3 levels：e09 开局摆位元素 + e08 语句修订（显式留痕）——
const lv = spec.levels[0];
if (lv.elements.some((e) => e.id.endsWith('e09-opening-stack'))) throw new Error('e09 已存在');
lv.elements.push({
  id: 'lvl-01-stack-tower/e09-opening-stack',
  kind: 'spawn',
  expect:
    '开局初始摆位（v1.2 特性）：塔基块之上预置 3–5 块（numeric.opening.STACK_MIN_BLOCKS=3 / STACK_MAX_BLOCKS=5，块数与宽度扰动由 seeded RNG 决定、同 seed 逐 tick 可复现，单块宽度扰动 ≤ STACK_WIDTH_JITTER_PX)；初始摆位块不计分不计 layers（layerCount 只数玩家落块），塔顶 = 初始摆位最顶块，摆动块在塔顶上方摆动。落点：games/stack-tower/src/kernel/tower.ts buildOpeningStack()，参数唯一来源 numeric.opening（镜像 spec.numeric.opening）',
});
const e08 = lv.elements.find((e) => e.id.endsWith('e08-fail-recover'));
e08.expect = e08.expect.replace(
  '重开输入后全量复位：塔回单块、分数连击清零、摆速窗口回 L1 值',
  '重开输入后全量复位：塔回开局初始摆位（v1.2 e09：3–5 块，同 seed 同摆位）、分数连击清零、摆速窗口回 L1 值'
);
console.log('[inc ] levels e09 已登记；e08 口径已修订（塔回初始摆位，留痕 revision_note）');

// —— acceptance：e08 对应条同步修订 ——
const aE08 = spec.acceptance.find((a) => a.id === 'ac-lvl01-e08-recover');
aE08.statement = aE08.statement.replace(
  '重开后塔回单块、分数/连击清零',
  '重开后塔回开局初始摆位（v1.2 e09：3–5 块，同 seed 同摆位）、分数/连击清零'
);

// —— N1-1/N1-2 acceptance 增量（四判据 + 门禁锚点）——
const NEW_ACCEPTANCE = [
  {
    id: 'acc-j1',
    statement:
      '首块 ≤3s（juice 判据一）：冷启动（serve 起、无缓存首访）到首块可见（开局初始摆位 + 首个摆动块渲染上屏）≤3000ms（theme.FIRST_BLOCK_BUDGET_MS）；实验口径 playwright chromium + 4x throttle（numeric.benchmark_device），真机单列按 content.benchmark 口径',
    check: 'node games/stack-tower/tests/contract/juice-acc-j1-first-block.spec.mjs',
  },
  {
    id: 'acc-j2',
    statement:
      'juice ≤100ms（juice 判据二）：perfect 判定成立 tick → 涟漪表现首帧上屏 ≤100ms（theme.JUICE_LATENCY_MS）；无头口径以「判定 tick 与表现层首绘 tick 差」计，禁止以感观估计替代',
    check: 'node games/stack-tower/tests/contract/juice-acc-j2-juice-latency.spec.mjs',
  },
  {
    id: 'acc-j3',
    statement:
      '音画 ≤50ms（juice 判据三，采纳 QA 重定义）：perfect_hit dispatch（内核事件上抛时刻）→ AudioContext 播放调用（play 调用点，非实际出声）≤50ms（theme.AUDIO_DISPATCH_BUDGET_MS）；spy 可测，闸门吞音/延后即违此条（与 acc-a7 首触口径衔接）',
    check: 'node games/stack-tower/tests/contract/juice-acc-j3-audio-dispatch.spec.mjs',
  },
  {
    id: 'acc-j4',
    statement:
      '重开 ≤1.5s（juice 判据四）：restart 输入 → 新局可交互（开局初始摆位渲染完成 + 首个摆动块可响应 drop）≤1500ms（theme.RESTART_BUDGET_MS）',
    check: 'node games/stack-tower/tests/contract/juice-acc-j4-restart.spec.mjs',
  },
  {
    id: 'acc-j5',
    statement:
      '首局无弹窗：安装态首访首局全程零非游戏内弹层（无引导遮罩/权限弹窗/更新提示/评分邀请）；rotate-overlay 仅横屏触发，不属竖屏首局路径；首局流程与 acc-j1/acc-e1 同轮冒烟取证',
    check: 'node games/stack-tower/tests/contract/juice-acc-j5-first-session-no-modal.spec.mjs',
  },
  {
    id: 'acc-e1',
    statement:
      '数据事件三要素定版（五钩子埋点契约）：事件名枚举封闭 = {session_start, session_end, block_place, perfect_hit, game_over, restart}（任务书口径五钩子，session_start/end 计一对）；每事件载荷必含双时间戳（client_ts ISO8601 + mono_ms 单调毫秒）+ anon_id（本地随机 UUID v4，零 PII：不含 IP/设备号/账号标识）+ schema_version + client_version；触发次数与字段类型进冒烟（session_start/end 每局各 1、block_place ≥1、perfect_hit ≥0、game_over 0..1、restart 0..N）',
    check: 'node games/stack-tower/tests/contract/telemetry-acc-e1-hooks.spec.mjs',
  },
  {
    id: 'acc-t1',
    statement:
      'theme.js 单一常量源契约（entity e-theme-constants 锚点）：render/audio/ui 全部视觉/音画/juice 常量（色值、时长、池上限、发光参数）仅从 games/stack-tower/src/render/theme.ts（导入形态 ./theme.js）具名常量 import；扫描断言 render/audio/ui 目录零散落十六进制色值与 juice 时限字面量（测试夹具/注释除外）；内核数值唯一来源仍为 src/kernel/numeric.ts（互不越界）',
    check: 'node games/stack-tower/tests/contract/theme-acc-t1-constants-source.spec.mjs',
  },
  {
    id: 'acc-a8',
    statement:
      'P0 资产 13 项逐件查表：a08-bg-night-gradient、a09..a14-block-skin-base-01..06、a15-fx-cut-face、a16-fx-ripple-ring、a17-fx-perfect-glow、a18-ui-btn-primary、a19-ui-panel-hud、a20-ui-icon-sound——逐件 PASS/FAIL，判据 hex±5 / 禁描边 / 渐变方向二值 / 几何 ±10% 拒收；asset-check 并入 contract-check 同门运行',
    check: 'node games/stack-tower/tests/contract/assets-acc-a8-p0-table.spec.mjs',
  },
  {
    id: 'acc-num',
    statement:
      'numeric 冻结机械断言（数值总闸加固）：v1 冻结七键（DEFAULT_SEED/FIXED_STEP_MS/MAX_DT_MS/perfect_window/cut_width/scoring/difficulty）v1 vs v1.2 键序无关深比全等 + sha256 相等，任一不满足即 FAIL；同时 numeric.opening 组与 src/kernel/numeric.ts 镜像一致（e07 数值总闸口径延续）',
    check: 'node games/stack-tower/tests/contract/numeric-acc-num-frozen-gate.spec.mjs',
  },
];
const have = new Set(spec.acceptance.map((a) => a.id));
for (const a of NEW_ACCEPTANCE) {
  if (have.has(a.id)) throw new Error(`acceptance id 冲突: ${a.id}`);
  spec.acceptance.push(a);
}
console.log(`[inc ] acceptance +9（acc-j1..j5 / acc-e1 / acc-t1 / acc-a8 / acc-num），总 ${spec.acceptance.length} 条`);

// —— N1-4 content.analytics（统计三行 = B 轮启动门槛）——
spec.content.analytics = {
  note: '统计三行均为「B 轮启动门槛」（业务目标），非本轮验收判据；本轮验收范围 = 埋点完整性与字段合规（acc-e1 三要素 + 触发次数 + 字段类型），业务值不在本轮判定',
  targets: {
    sessionCompletionRate: '85%（B 轮启动门槛：会话完成率，口径 = 到达 targetLayers(level) 或 game-over 前未中途流失）',
    avgSessionsPerUser: '3 局（B 轮启动门槛：人均局数）',
    restartRate: '20%（B 轮启动门槛：game-over 后重开率）',
  },
  hooks: {
    events: ['session_start', 'session_end', 'block_place', 'perfect_hit', 'game_over', 'restart'],
    payload: {
      timestamps: '双时间戳：client_ts（ISO8601）+ mono_ms（单调毫秒，perf.now 系）',
      anonId: 'anon_id：本地随机 UUID v4，设备/会话级，零 PII（不含 IP/设备号/账号标识）',
      versions: 'schema_version + client_version 必填',
      perfectHit: 'perfect_hit 额外携带 dispatch 时间戳（acc-j3 音画 ≤50ms 可测点）',
    },
  },
};
console.log('[inc ] content.analytics 已登记（统计三行标注 B 轮启动门槛）');

// —— N1-5 entities：theme 常量源 + ripple 渲染器 + 埋点发射器 ——
spec.entities.push(
  {
    id: 'e-theme-constants',
    kind: 'entity',
    expect:
      'theme.js 单一常量源（契约锚点）：games/stack-tower/src/render/theme.ts（导入形态 ./theme.js，任务书口径 theme.js）承载全部表现层常量——霓虹夜塔色板（夜空渐变/塔块霓虹 6 色/切面/辉光）+ juice 时限（FIRST_BLOCK_BUDGET_MS=3000 / JUICE_LATENCY_MS=100 / AUDIO_DISPATCH_BUDGET_MS=50 / RESTART_BUDGET_MS=1500）+ 涟漪池（RIPPLE_POOL_MAX=200）+ 发光与描边参数；render/audio/ui 只读此源，另设字面量即违契约（acc-t1 扫描断言）；内核数值唯一来源仍为 src/kernel/numeric.ts',
  },
  {
    id: 'e-ripple-renderer',
    kind: 'entity',
    expect:
      'tower-ripple 表现层订阅者：订阅内核 tower-ripple 事件，涟漪粒子对象池 ≤200 颗（theme.RIPPLE_POOL_MAX，超龄/超额复用禁新建），Canvas2D additive 合成（globalCompositeOperation lighter）；订阅侧异常必须隔离（表现层 catch，禁止反传内核/中断确定性 tick）；零内核改动（e-ripple-emitter 事件契约原文不变）',
  },
  {
    id: 'e-telemetry-emitter',
    kind: 'entity',
    expect:
      '五钩子埋点发射器（acc-e1 契约）：枚举事件 {session_start, session_end, block_place, perfect_hit, game_over, restart}，载荷含双时间戳 + anon_id（UUID v4 零 PII）+ schema_version + client_version；perfect_hit 携带 dispatch 时间戳（acc-j3 可测点）；异常隔离同 e-ripple-renderer 口径（埋点故障不得影响游戏逻辑）',
  }
);
console.log(`[inc ] entities +3（e-theme-constants / e-ripple-renderer / e-telemetry-emitter），总 ${spec.entities.length} 个`);

// —— N1-7 assets：P0 13 项（a08..a20）——
const criteria = (s) => `验收判据（acc-a8 查表）：${s}；逐件 PASS/FAIL`;
const asset = (id, kind, file, generator, expect) => ({
  id, kind, file, generator, expect,
  source: 'generated',
  license: '仓库内自产（procedural），无第三方素材',
});
spec.assets.push(
  asset('a08-bg-night-gradient', '背景层', 'games/stack-tower/src/render/theme.ts', 'procedural:canvas2d', '霓虹夜空垂直渐变底（深蓝紫→暗青，垂直单向）；' + criteria('渐变方向二值（垂直单向）/ hex±5')),
  ...Array.from({ length: 6 }, (_, i) =>
    asset(
      `a${String(9 + i).padStart(2, '0')}-block-skin-base-${String(i + 1).padStart(2, '0')}`,
      '贴图',
      'games/stack-tower/src/render/theme.ts',
      'procedural:canvas2d',
      `霓虹塔块皮 6 色循环之第 ${i + 1} 色（120×28 基准几何）；` + criteria('hex±5 / 禁描边 / 几何 ±10% 拒收'),
    )),
  asset('a15-fx-cut-face', 'fx', 'games/stack-tower/src/render/theme.ts', 'procedural:canvas2d', '切面高亮（发光填充形态）；' + criteria('禁描边 / 几何 ±10%')),
  asset('a16-fx-ripple-ring', 'fx', 'games/stack-tower/src/render/theme.ts', 'procedural:canvas2d', '塔身涟漪环（中心对称扩散）；' + criteria('中心对称 / hex±5')),
  asset('a17-fx-perfect-glow', 'fx', 'games/stack-tower/src/render/theme.ts', 'procedural:canvas2d', '完美命中辉光（additive 形态）；' + criteria('additive 形态 / hex±5')),
  asset('a18-ui-btn-primary', 'ui', 'games/stack-tower/src/render/theme.ts', 'procedural:canvas2d', '主按钮（霓虹描边圆角矩形）；' + criteria('圆角几何 ±10% / hex±5')),
  asset('a19-ui-panel-hud', 'ui', 'games/stack-tower/src/render/theme.ts', 'procedural:canvas2d', 'HUD 面板（半透明夜色底）；' + criteria('透明度规格 / 禁描边')),
  asset('a20-ui-icon-sound', 'ui', 'games/stack-tower/src/render/theme.ts', 'procedural:canvas2d', '声音开关图标；' + criteria('几何 ±10% / hex±5')),
);
console.log(`[inc ] assets +13（a08..a20），总 ${spec.assets.length} 项`);

// —— world 规则追加（既有规则逐字保留，只增）——
spec.world.architecture_rules.push(
  '表现层常量唯一来源 = games/stack-tower/src/render/theme.ts（导入形态 ./theme.js）：视觉/音画/juice 常量全部具名 import，render/audio/ui 另设字面量即违契约（acc-t1）；内核数值唯一来源不变（src/kernel/numeric.ts ↔ spec.numeric 一一对应），两源互不越界',
  'tower-ripple 表现层订阅：涟漪粒子对象池 ≤200 颗（theme.RIPPLE_POOL_MAX）+ Canvas2D additive 合成；订阅异常必须隔离（表现层 catch，不得反传内核或中断确定性 tick）；内核事件契约与 e-ripple-emitter 原文不变'
);
console.log(`[inc ] world 规则 +2，总 ${spec.world.architecture_rules.length} 条`);

// —— revision_note 追加 ——
spec.meta.revision_note +=
  ' ‖ v1.2（2026-09-27，霓虹夜塔视觉与 juice 冲刺）：换装「霓虹夜塔」+ juice 四判据。增量=acceptance +9（acc-j1 首块≤3s / acc-j2 juice≤100ms / acc-j3 音画≤50ms 采纳 QA 重定义 perfect_hit dispatch→AudioContext 播放调用 / acc-j4 重开≤1.5s / acc-j5 首局无弹窗 / acc-e1 数据事件三要素 / acc-t1 theme 单一常量源 / acc-a8 P0 资产 13 项查表 / acc-num 冻结数值机械断言）+ levels e09 开局 3–5 块初始摆位（落点 kernel/tower.ts buildOpeningStack() + numeric.opening）+ content.analytics（统计三行 85%/3局/20% 标注 B 轮启动门槛，本轮验收范围=埋点完整性与字段合规）+ entities +3 + assets +13（a08..a20）+ world 规则 +2 + numeric.opening 组。唯二显式修订：①e08 语句「塔回单块」→「塔回开局初始摆位」（与新特性互斥，spec 不留自相矛盾条款，其余语义逐字保留）；②本 note。版本映射：平台 v4 ≡ 任务书口径 v1.2，v1.1-ready（D1/D2/D3）未单独登记、其内容完整折入本版零丢失；v1 冻结七键机械断言（深比+sha256）随 acc-num 进门禁。P0 资产计数口径：bg(1)+block-skin(6)+cut-face fx 三件套(3)+UI(3)=13。';

const out = { spec, detail: base.detail.replace('v1.1 登记就绪版', 'v1.2 建版载荷（含 v1.1 未登记增量完整折入）') };
writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
console.log(`[out ] ${OUT}`);
console.log(`[done] acceptance=${spec.acceptance.length} entities=${spec.entities.length} assets=${spec.assets.length} numeric=${Object.keys(spec.numeric).length} 组`);
