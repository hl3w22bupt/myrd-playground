#!/usr/bin/env node
// build-spec-v1.mjs — 麦浪小队 spec v1（可玩基线版）建版器（沿 g2-blocks build-spec-vN 判例）
//
// 输入：.myrd/spec/wheat-squad/design-spec.json（链上 approved v0.1 导出件，唯一基座）
// 输出：.myrd/spec/wheat-squad/design-spec-v1-payload.json（POST /revisions 的 body.spec）
// 纪律：
//   - 只做增量 diff（七项任务书 ①-⑦），v0.1 已冻结结构（placement/seed/step/palette 色值）零改动；
//   - entities[].script 锚点逐条对齐骨架真实符号（编译期可证：符号在源文件整词出现）；
//   - 埋点字段名三方同名（策划定名=本文件=程序接线=冒烟断言）。
// 用法：node tools/build-spec-v1.mjs（repo 内相对路径，工作区根或工程根均可）
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const candidates = [
  join(here, "../../../.myrd/spec/wheat-squad/design-spec.json"),
  join(here, "../../.myrd/spec/wheat-squad/design-spec.json"),
];
let base = null;
for (const p of candidates) {
  try { base = JSON.parse(readFileSync(p, "utf8")); break; } catch { /* try next */ }
}
if (!base) { console.error("读不到 v0.1 导出件 design-spec.json"); process.exit(1); }
const v0 = base.spec ?? base; // 兼容包裹/裸两种形状

const G = "games/wheat-squad";
const spec = JSON.parse(JSON.stringify(v0));

// ---- ①⑤⑥⑦ meta：版本号 / 总则冻结规则 / check 命名范式 / 反馈接入协议 / 埋点定名 ----
spec.meta.version = "1.0";
spec.meta.revision_note =
  "v1.0（可玩基线版 2026-10-12）：好玩判据四件套 A1–A4 条目化（fv-1..4 退役，映射 A1←fv-1 / A2←fv-2 / A3←fv-3 / A4←fv-4，旧 id 不再入 acceptance）；" +
  "埋点字段名三方同名定名（first_core_action_at / run_duration_ms / feedback_latency_ms）；entities[].script 符号锚与骨架实符逐条对齐" +
  "（v0.1 三处漂移修正：e-wheat-pickup→sim.ts#pickups、e-wave-manager→sim.ts#waveTimerMs、e-placement-bank→settlement.ts#bankGain）；" +
  "总则冻结规则 + check 命名范式 + 反馈接入协议写入 meta；world.styleRef 换风格卡 v1；美术资产四条款入 acceptance。数值面新增 runDuration 胜利波次带与 perf 机型档/artCaps，" +
  "placement 结构与 palette 色值逐字节不动。";
spec.meta.baselineProtocol = {
  起点: "可玩基线轮（2026-10-12 本版起算）",
  达标口径: "A1–A4 四件套全达才算达标（任一 manual 项缺真人结论 = 本轮未达标，不得虚报）",
  冻结条款: "连续 3 轮四件套全不达 → 冻结转新题（主策划发起，spec 本条即触发依据）",
  计数器: "第 0/3 轮（可玩基线轮为第 1 轮的上一轮起点，本轮收口时置第 1/3）",
};
spec.meta.checkNaming = {
  paradigm: "tests/contract/ac-*.spec.mjs",
  rule: "acceptance[].check = 仓库根相对真实文件路径，与文件名逐字一致（统一契约门禁逐条解析，悬空即红）",
};
spec.meta.feedbackProtocol = [
  "反馈进入（试玩量表/数据回流）→ 主策划整理为修订项清单并标注来源",
  "游戏策划经 POST /api/v1/game-design-specs/:id/revisions 入链新版（revision_note 必须标 diff 摘要）→ 链上旧版自动 superseded",
  "QA 四要素联审（id/auto-manual/check 可跑/可判定）→ approve；程序只按 approved 版改码，禁改 draft",
  "改码后契约+冒烟全绿 → 部署复证 → 主人试玩终裁（好不好玩始终归主人，机器不替判）",
];
spec.meta.telemetryFields = {
  first_core_action_at: "首次核心操作（首次拖动队长）发生的局内毫秒时刻（tick×FIXED_STEP_MS）",
  run_duration_ms: "单局从 run_start 到结算（victory/timeout/defeat）的毫秒时长",
  feedback_latency_ms: "单次操作到反馈呈现的毫秒延迟（内核同 tick 记 0，视觉层按 hitFlashMs 记）",
  run_start: "局开始事件（v0.1 既有，保留）",
  first_kill: "首次击杀事件（v0.1 既有，保留）",
};

// ---- ② world：风格卡 v1 派生源 ----
spec.world.styleRef =
  ".myrd/blackboard/wheat-squad/style-card-v1.md（四要素：调色板白名单 / 光照 / 线条 / 比例；色值唯一真源 = 本 spec numeric.palette，风格卡与 theme.ts 均为派生镜像；v0 参考卡退役归档）";
spec.world.styleDerivation =
  "派生规则：world 主题词（麦田/治愈/萌系）→ 风格卡四要素 → theme.ts token 单源 → 渲染层只读 token；色值改动必须走 spec revision（palette 块），禁止两头各改各的。";

// ---- ③ entities：符号锚逐条对齐骨架实符（统一门禁 #锚断言可证） ----
const anchors = {
  "e-kernel-loop": `${G}/src/kernel/loop.ts#seededRng`,
  "e-kernel-sim": `${G}/src/kernel/sim.ts#stepSim`,
  "e-captain": `${G}/src/kernel/sim.ts#captain`,
  "e-squadmate": `${G}/src/kernel/sim.ts#Squadmate`,
  "e-pest": `${G}/src/kernel/sim.ts#pests`,
  "e-bullet": `${G}/src/kernel/sim.ts#bullets`,
  "e-wheat-pickup": `${G}/src/kernel/sim.ts#pickups`,
  "e-wave-manager": `${G}/src/kernel/sim.ts#waveTimerMs`,
  "e-upgrade-picker": `${G}/src/kernel/sim.ts#offerUpgrades`,
  "e-settlement": `${G}/src/settlement.ts#settlementFacts`,
  "e-placement-bank": `${G}/src/settlement.ts#bankGain`,
  "e-renderer": `{${G}/src/render/renderer.ts#drawField,${G}/src/render/theme.ts#THEME}`,
  "e-telemetry": `${G}/src/game.ts#telemetry`,
};
let anchorFixes = 0;
for (const e of spec.entities) {
  if (anchors[e.id] && e.script !== anchors[e.id]) { e.script = anchors[e.id]; anchorFixes += 1; }
  if (e.id === "e-telemetry") e.note = "埋点字段名以 meta.telemetryFields 为唯一命名源（三方同名：策划=本 spec=程序接线=冒烟断言）";
}

// ---- numeric：A1/A2/A4 判据数值 + 机型档 + 资产上限（placement/palette 逐字节不动） ----
spec.numeric.runDuration = {
  victoryWaves: 6,        // 通关波次：waveIndex 越过即 victory 结算（替代 v0.1 固定 300s 超时主结局）
  p50MinSec: 90,          // A2：20 种子样本 P50 下界
  p50MaxSec: 180,         // A2：P50 上界
  p90MaxSec: 300,         // A2：P90 上界
  hardTimeoutSec: 300,    // 硬超时保底（ reason=timeout 仍存在，但不再是主结局）
  sampleSeeds: 20,        // A2 机判样本量（确定性仿真，样本即真值）
};
spec.numeric.firstCore = {
  maxLatencySec: 10,      // A1：首次核心操作 → 首杀 ≤10s
  mustReachBySec: 30,     // A1：首 30 秒内必达首次核心正反馈（任一种子）
  sampleSeeds: 5,
};
spec.numeric.feedback = {
  hitFlashMs: 90,         // 不变（视觉层反馈时长，≤100ms 预算内）
  latencyBudgetMs: 100,   // 150 → 100（A4 收紧）
  minChannelsPerOp: 2,    // 新增（A4：每操作 ≥2 通道）
};
spec.numeric.perf = {
  frameBudgetMs: 16,                    // 不变（node 仿真单步预算）
  maxOnScreenEntities: 220,             // 不变
  midTierFrameP95Ms: 33,                // 机型档：中端安卓帧时间 P95 ≤33ms（≈30fps）
  firstInteractiveMaxMs: 3000,          // 机型档：首屏可交互 ≤3s
  lowEndFrameP95Ms: 50,                 // 机型档：2GB 老机 P95 ≤50ms（≈20fps 可玩不崩）
};
spec.numeric.artCaps = {
  firstPackageMaxMB: 4,                 // 首包 ≤4MB（任务书机型档反推）
  singleAssetMaxKB: 300,                // 单资产 ≤300KB（4MB 预算 − 引擎/代码 ≈2.5MB ÷ ≥13 实体件）
  atlasMaxKB: 1024,                     // 图集 ≤1MB
  shotMaxKB: 500,                       // 提审截图单张 ≤500KB
};

// ---- ①③ acceptance：fv-1..4 退役 → A1–A4；保留工程条目；新增美术四条款 ----
// 形状对齐 v0.1 schema 判例：{id, mode, statement(人工验收 checklist 原文，非空), check("node <仓库根相对路径>")}
const ac = (id, mode, statement, path) => ({ id, mode, statement, check: `node ${path}` });
spec.acceptance = [
  ac("ac-a1-first-core-feedback", "auto",
    "A1 首次核心正反馈：自 first_core_action_at 起首杀 ≤ firstCore.maxLatencySec(10s)；任一 firstCore.sampleSeeds(5) 种子局首杀必 ≤ mustReachBySec(30s)。数值可判，禁「流畅/有趣」类词。",
    `${G}/tests/contract/ac-02-first30s.spec.mjs`),
  ac("ac-a2-run-duration-band", "auto",
    "A2 单局时长带：runDuration.sampleSeeds(20) 种子局 run_duration_ms 的 P50 ∈ [p50MinSec(90), p50MaxSec(180)]s 且 P90 ≤ p90MaxSec(300)s；结局 ∈ {victory, timeout}。",
    `${G}/tests/contract/ac-03-run-duration.spec.mjs`),
  ac("ac-a3-restart-willingness", "manual+auto",
    "A3 自然重开意愿：结论面（人工）= 5 名试玩 ≥3 人自然重开 ≥2 局且能说重开理由（试玩量表『重开理由原文』列非空）；机制面（机判）= 重开链路 + 量表模板列 schema 在档。记录未回填 = 本条未达，不得虚报。任一面不达 = 条款不达。",
    `${G}/tests/contract/ac-04-restart-loop.spec.mjs`),
  ac("ac-a4-feedback-channels", "auto",
    "A4 反馈延迟与通道：采样操作 feedback_latency_ms ≤ latencyBudgetMs(100ms) 且每操作反馈通道 ≥ minChannelsPerOp(2)（视觉闪白/震屏/音效/HUD 行内提示任二）。",
    `${G}/tests/contract/ac-05-hit-feedback.spec.mjs`),
  ac("det-1-seeded-determinism", "auto",
    "同 seed 双局全状态序列逐字节一致（含 run_duration_ms 与三选一序列）。",
    `${G}/tests/contract/ac-01-seeded-determinism.spec.mjs`),
  ac("perf-1-frame-budget", "auto",
    "帧预算与机型档：node 仿真单步 ≤ frameBudgetMs(16ms)、实体峰值 ≤ maxOnScreenEntities(220)；机型档基准（中端安卓 P95≤midTierFrameP95Ms(33ms) / 首屏可交互≤firstInteractiveMaxMs(3s) / 2GB 老机 P95≤lowEndFrameP95Ms(50ms) 可玩不崩）以 headless 档位仿真 + 构建体积机判代证，真机走查归 QA 清单。",
    `${G}/tests/contract/ac-06-perf-budget.spec.mjs`),
  ac("tex-1-no-external-texture", "auto",
    "仓内零位图文件 + 渲染源零贴图构造（纯矢量/程序化绘制）。",
    `${G}/tests/contract/ac-07-no-texture.spec.mjs`),
  ac("anchor-1-entity-levels-files", "auto",
    "entities/levels 声明落点全部在盘非空，关卡元素编号稳定唯一。",
    `${G}/tests/contract/ac-08-anchors.spec.mjs`),
  ac("loop-1-settlement-closure", "auto",
    "headless 冒烟闭环：打开 → 首次核心操作（拖动） → 单局结束 → 重开 全链路零错误，并断言 A1/A4 埋点（first_core_action_at / feedback_latency_ms）真实产生。",
    `${G}/tools/smoke.mjs`),
  ac("fv-pend-placement-calibration", "PEND",
    "放置收益结构冻结机判在档；基准数值待内测样本（session 分布与回流率），数据不足不编数，校准走 revision。",
    `${G}/tests/contract/ac-09-placement-structure.spec.mjs`),
  ac("ac-art-1-palette-whitelist", "auto",
    "美术 AC-A1 色板白名单：源码/资产清单色值 ⊆ numeric.palette 白名单（thresholdDeltaE 内视为同色），违例逐件点名。",
    `${G}/tests/contract/ac-10-art-palette-whitelist.spec.mjs`),
  ac("ac-art-2-naming-entity-ids", "auto",
    "美术 AC-A2 命名↔id 一致：资产/素材清单逐件 id ∈ spec entities ids；清单外未登记资产 = 违例。",
    `${G}/tests/contract/ac-11-art-naming-ids.spec.mjs`),
  ac("ac-art-3-size-caps", "auto",
    "美术 AC-A3 体积上限：逐件 ≤ artCaps（单资产 300KB / 图集 1MB / 截图 500KB）且 build 首包 ≤ firstPackageMaxMB(4MB)。",
    `${G}/tests/contract/ac-12-art-size-caps.spec.mjs`),
  ac("ac-art-4-style-consistency", "manual+auto",
    "美术 AC-A4 风格一致：机制面（机判）= 风格卡 v1 四要素在档 + 素材走查清单在档；结论面（人工）= 主策划×美术互查对照风格卡逐件人判。任一面不达 = 条款不达。",
    `${G}/tests/contract/ac-13-art-style-consistency.spec.mjs`),
];

const payload = { spec };
const out = join(here, "../../../.myrd/spec/wheat-squad/design-spec-v1-payload.json");
writeFileSync(out, JSON.stringify(payload, null, 2) + "\n");
console.log(`v1 payload -> ${out}`);
console.log(`meta.version=${spec.meta.version} · entities=${spec.entities.length}(锚修正${anchorFixes}) · levels=${spec.levels.length} · acceptance=${spec.acceptance.length}(A1-A4+9 保留+4 美术)`);
console.log(`numeric 新增键: runDuration(重构)/firstCore/feedback(minChannelsPerOp)/perf(机型档×3)/artCaps`);
