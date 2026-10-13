#!/usr/bin/env node
// build-spec-v1_2.mjs — spec v1.2 修订生成器（任务书「已拍板标准」增量 · 2026-10-13）
//
// diff 清单（守卫：仅允许触碰以下段，其余逐字节冻结）：
//   ① meta.version 0.1→1.2 / checkNaming 三态 paradigm → checks/<acceptance-id>.mjs
//      / telemetryFields +4 键（first_tap/first_loop_complete/restart_clicked/hint_shown）
//      / baselineProtocol.计数器措辞澄清（W-5：0/3 全不达才计数）/ revision_note
//   ② e-telemetry.expect 升级：v0 残留三事件 → 9 键结构化埋点片段（事件名→字段名→类型）
//   ③ numeric +guidance 段（hintSec=4，实现消费真源；a5 判定窗 5000ms 属判定参数，写死 ac-a5 statement）
//   ④ acceptance：15 条既有 check 路径改写 checks/<id>.mjs；新增 ac-a5-guidance-first-action（auto）、
//      ac-a4b-restart-click-counter（auto · a4 v1 写死「已埋点 + 真实点击本地计数 +1」）
//   ⑤ world +uxExisting（既有交互登记 5 条 · 主策划当天逐条裁决 = 全部收进）
//   ⑥ assets +guidance-hint-banner（a5 存在性 check 素材 · 文案逐字三方同名）
// 输入：.myrd/spec/wheat-squad/design-spec.json（链 v3 approved 导出件，_platform.version 必须 = 3）
// 输出：.myrd/spec/wheat-squad/design-spec-v1_2-payload.json（POST /revisions 载荷 {spec, detail}）
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url));
const base = JSON.parse(readFileSync(join(here, '../../../.myrd/spec/wheat-squad/design-spec.json'), 'utf8'));
const spec = JSON.parse(JSON.stringify(base.spec ?? base));
const plat = base._platform ?? {};

// 前置守卫：基线必须是链 v3 approved（meta 1.1）
if (spec.meta.version !== '1.1' || plat.version !== 3 || plat.status !== 'approved') {
  console.error(`前置不符：基线 meta.version=${spec.meta.version} _platform.v${plat.version}/${plat.status}（期望 1.1 / v3 / approved）`);
  process.exit(1);
}
const FROZEN = JSON.stringify({ w: spec.world, e: spec.entities.map((x) => x.id), l: spec.levels });

// ① meta
spec.meta.version = '1.2';
spec.meta.checkNaming = {
  paradigm: 'tests/contract/checks/<acceptance-id>.mjs',
  rule: 'acceptance[].check = node games/wheat-squad/tests/contract/checks/<acceptance-id>.mjs（checks 薄壳由 tools/build-checks-shims.mjs 从 spec 单源生成，断言零复制真实转发实体件；统一契约门禁逐条解析依赖存在，悬空即红）',
};
Object.assign(spec.meta.telemetryFields, {
  first_tap: '会话首次点按事件；字段 atMs:number=局内相对毫秒（tick×FIXED_STEP_MS），once',
  first_loop_complete: '首次核心循环闭环事件（首次升级三选一选择完成=拖动→击杀→掉落→拾取→升级）；字段 atMs:number=firstUpgradeTick×stepMs，once',
  restart_clicked: '结算页重开点按事件（a4 v1 写死面：真实点击本地计数）；字段 count:number=第几次点按（从 1 递增）+ atMs:number',
  hint_shown: '首屏引导浮层展示事件（a5 判据锚）；字段 atMs:number=展示时刻（首局 running 起始=0）+ text:string=文案逐字（=assets guidance-hint-banner.copy）',
});
spec.meta.baselineProtocol['计数器'] = '第 0/3 轮（可玩基线轮为第 1 轮的上一轮起点，本轮收口时置第 1/3）。计数口径：**连续 3 轮四件套全不达才计数前移**（任一轮部分达标即重置为 0/3——QA 口径 2026-10-12 D3 澄清，与本条统一）';
spec.meta.revision_note =
  'v1.2（2026-10-13 · 任务书「已拍板标准」增量修订）：① checkNaming 定死 checks/<acceptance-id>.mjs（15 条既有 check 改写薄壳转发，断言零复制）；' +
  '② 验收扩为 A1–A5：新增 ac-a5-guidance-first-action（hint_shown 后 5s 内首次有效操作，auto）与 ac-a4b-restart-click-counter（a4 v1 写死「已埋点 + 真实点击本地计数 +1」，auto）；' +
  '③ 埋点以结构化片段写死 entities（e-telemetry 9 键：事件名→字段名→类型）+ meta.telemetryFields 同步 +4；' +
  '④ numeric +guidance.hintSec=4（引导浮层窗，实现消费真源）；⑤ world +uxExisting 既有交互登记 5 条（主策划当天裁决=全部收进标「既有交互」）；' +
  '⑥ assets +guidance-hint-banner（a5 存在性 check 素材，文案逐字=「拖动队长移动 · 队员自动作战」三方同名）；' +
  '⑦ W-5 顺带：baselineProtocol.计数器措辞与 QA 口径统一（0/3 全不达才计数）。实现面（N1 已先行）：四事件接线 ac-16 先红后绿，门禁 53/0+16/0/1PEND+WS-SMOKE PASS。';

// ② e-telemetry 结构化
const et = spec.entities.find((x) => x.id === 'e-telemetry');
if (!et || !et.script.endsWith('game.ts#telemetry')) { console.error('前置不符：e-telemetry 锚'); process.exit(1); }
et.expect =
  '结构化埋点面（事件名→字段名→类型，命名冻结；三方同名：本条=meta.telemetryFields=程序接线，ac-14 剥注释机判）：' +
  'run_start{tick} · run_end{run_duration_ms:number, reason:victory|timeout|defeat} · first_kill{tick} · ' +
  'first_core_action_at{atMs:number} · feedback_latency_ms{latencyMs:number, channels:string[]} · ' +
  'first_tap{atMs:number, once} · first_loop_complete{atMs:number, once} · restart_clicked{count:number, atMs:number} · ' +
  'hint_shown{atMs:number, text:string}。v0 口径（三事件缓冲）由本条取代；只缓冲不外发（本地日志开关见 deployment 说明）';

// ③ numeric.guidance
spec.numeric.guidance = {
  hintSec: 4,
  note: '引导浮层展示窗（秒）；a5 判定窗 5000ms 属判定参数，写死于 ac-a5 statement（非仿真参数不入 numeric）。文案真源 = GUIDANCE_TEXT（game.ts）= assets.guidance-hint-banner.copy 三方同名',
};

// ④ acceptance
const CHECK = (id) => `node games/wheat-squad/tests/contract/checks/${id}.mjs`;
let rewritten = 0;
for (const ac of spec.acceptance) {
  if (ac.id === 'loop-1-settlement-closure') { ac.check = CHECK(ac.id); rewritten += 1; continue; }
  if (!CHECK(ac.id).endsWith(`${ac.id}.mjs`)) { console.error(`内部错误：id=${ac.id}`); process.exit(1); }
  ac.check = CHECK(ac.id);
  rewritten += 1;
}
const a4Idx = spec.acceptance.findIndex((a) => a.id === 'ac-a4-feedback-channels');
if (a4Idx < 0) { console.error('前置不符：缺 ac-a4'); process.exit(1); }
spec.acceptance.splice(a4Idx + 1, 0,
  {
    id: 'ac-a5-guidance-first-action',
    mode: 'auto',
    statement: '首分钟引导有效（auto）：hint_shown 引导浮层展示后 5000ms 内发生首次有效操作（first_core_action_at.atMs − hint_shown.atMs ≤ 5000ms）。判定窗 5000ms 为判定参数写死本条；hint_shown{atMs,text} 与 assets.guidance-hint-banner 文案逐字三方同名（「拖动队长移动 · 队员自动作战」）。',
    check: CHECK('ac-a5-guidance-first-action'),
  },
  {
    id: 'ac-a4b-restart-click-counter',
    mode: 'auto',
    statement: 'a4 v1 写死面（auto）：重开点击已埋点且本地计数真实——结算态每次点按产生一条 restart_clicked{count,atMs}，count 从 1 起逐次 +1（真实点击驱动，非自算替代）；与 ac-a3 机制面（重开复位）互为独立断言。',
    check: CHECK('ac-a4b-restart-click-counter'),
  },
);

// ⑤ world.uxExisting（既有交互登记 · 主策划裁决=全部收进）
spec.world.uxExisting = [
  { id: 'ux-ex-drag', summary: '单指/鼠标拖动移动队长（pointer 目标点，松指即停）——既有交互（v0 起 e-captain 面），v1.2 收进登记', verdict: '收进（主策划 2026-10-13 当天裁决）' },
  { id: 'ux-ex-tap-upgrade', summary: '三选一卡点选（触达 ≥48dp 等效，点选即生效并解除战局冻结）——既有交互（v0 起 e-upgrade-picker 面）', verdict: '收进（主策划 2026-10-13 当天裁决）' },
  { id: 'ux-ex-tap-restart', summary: '结算态任意点按重开（≤1s 全复位）——既有交互（ux-fv-restart 面）', verdict: '收进（主策划 2026-10-13 当天裁决）' },
  { id: 'ux-ex-freeze', summary: '三选一悬停冻结战局（选择即生效前置；遥测推进不受冻结影响）——既有交互（v0 起装配语义）', verdict: '收进（主策划 2026-10-13 当天裁决）' },
  { id: 'ux-ex-hint', summary: '首屏引导浮层（hint_shown 窗 4s，不阻断输入）——v1.2 新增交互，非「既有」，判据载体 ac-a5', verdict: '新增条款（不在既有登记内）' },
];

// ⑥ assets +guidance-hint-banner
if (!spec.assets.some((a) => a.id === 'guidance-hint-banner')) {
  spec.assets.push({
    id: 'guidance-hint-banner',
    kind: 'ui',
    file: 'games/wheat-squad/src/render/renderer.ts#drawGuidance',
    source: 'games/wheat-squad/src/game.ts#GUIDANCE_TEXT',
    copy: '拖动队长移动 · 队员自动作战',
    license: 'team-original',
    note: 'a5 存在性 check 素材：文案逐字三方同名（spec=manifest=实现）；视觉权重规则见 style-card-v1.md §v1.2 增量',
  });
}

// 终守卫：world 深值（summary/tone/themeZones/styleRef/uxCommitments）与 levels 逐字节不变
if (JSON.stringify({ w: { ...spec.world, uxExisting: undefined }, e: spec.entities.map((x) => x.id), l: spec.levels })
  !== JSON.stringify({ w: { ...JSON.parse(FROZEN).w, uxExisting: undefined }, e: JSON.parse(FROZEN).e, l: JSON.parse(FROZEN).l })) {
  console.error('守卫失败：world 冻结面（summary/tone/themeZones/styleRef/uxCommitments）或 levels 被意外改动');
  process.exit(1);
}
const out = join(here, '../../../.myrd/spec/wheat-squad/design-spec-v1_2-payload.json');
writeFileSync(out, JSON.stringify({
  spec,
  detail: {
    version: '1.2',
    basePlatformVersion: 3,
    diffSummary: spec.meta.revision_note,
    checkNaming: spec.meta.checkNaming.paradigm,
    acceptanceCount: spec.acceptance.length,
    newAcceptance: ['ac-a5-guidance-first-action', 'ac-a4b-restart-click-counter'],
  },
}, null, 2) + '\n');
console.log(`v1.2 payload ok：acceptance ${spec.acceptance.length} 条（${rewritten} 条 check 改写 + 2 新增）· telemetryFields ${Object.keys(spec.meta.telemetryFields).length} 键 · assets ${spec.assets.length} 件 → ${out}`);
