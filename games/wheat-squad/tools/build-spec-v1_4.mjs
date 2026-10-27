#!/usr/bin/env node
// build-spec-v1_4.mjs — spec v1.4 判读纪律增补（R1 复测收口轮 · 2026-10-15 任务书三条款）
// 根因：任务书要求增补三条判读纪律，链上 approved v1.3 尚无明文——
//   ①「未绑新 HEAD sha 一律『未判定·待采』」；②「A2 口径澄清（模拟局计自动化可判定指标，真人局归 A3 不混算）」；
//   ③「判据连击清零 + 同一判据连续 2 轮红 → 升级查判据」（清零口径已在 meta.baselineProtocol，单源引用不重定义）。
// 落点：仅新增 meta.retestProtocol 段 + meta.version/revision_note；六段（numeric/entities/levels/world/acceptance/assets）零触碰。
// 红线：A1/A2/A4 阈值一律不动 = numeric 与 acceptance 逐字节冻结（守卫机判，违例即退出非零）。
// 输入：.myrd/spec/wheat-squad/design-spec.json（approved v1.3 导出件，链 v5）
// 输出：.myrd/spec/wheat-squad/design-spec-v1_4-payload.json（POST /revisions 载荷）
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const here = dirname(fileURLToPath(import.meta.url));
const base = JSON.parse(readFileSync(join(here, "../../../.myrd/spec/wheat-squad/design-spec.json"), "utf8"));
const spec = JSON.parse(JSON.stringify(base.spec ?? base));

// —— 前置锚：必须基于 approved v1.3 导出件 ——
if (spec.meta.version !== "1.3") {
  console.error(`前置不符：导出件 meta.version = ${spec.meta.version}（期望 1.3）`);
  process.exit(1);
}

// —— 零触碰守卫准备：快照六段 + meta 既有键 ——
const FROZEN = ["numeric", "entities", "levels", "world", "acceptance", "assets"];
const before = Object.fromEntries(FROZEN.map((k) => [k, JSON.stringify(spec[k])]));
const META_KEYS = Object.keys(spec.meta).sort();
const metaBefore = JSON.stringify(spec.meta);

// —— 判读纪律增补（唯一增量段）——
spec.meta.retestProtocol = {
  purpose:
    "R1 复测收口轮判读纪律（2026-10-15 任务书三条款）：仅增补，不改任何既有阈值/条款/数值；" +
    "与 meta.baselineProtocol（冻结计数器单源）、meta.feedbackProtocol（修订接入协议）并行不互斥。",
  shaBindingRule:
    "①未绑新 HEAD sha 一律「未判定·待采」：任何实测/复测报告的判定值，若未绑定产生该值的工作区 HEAD 全长 commit sha" +
    "（git rev-parse HEAD），则该判据本轮一律记「未判定·待采」——不得计绿、不得计红、不计入冻结计数器。" +
    "绑 sha 有效性复核（QA 面）= git diff <报告绑定 sha>..<当前 HEAD> -- <受测源面> 为空（源面零变更则绑定点数值仍有效）。",
  a2a3ScopeRule:
    "②A2 口径澄清（不混算）：A2 单局时长带 = 模拟局口径——自动化可判定指标，仅以 headless 种子局" +
    "（numeric.runDuration.sampleSeeds）机判 P50/P90，真人局样本不进 A2 分母；A3 自然重开意愿 = 真人局口径——" +
    "结论面仅以试玩记录卡真人回填判定，模拟局/机判数据不得替代或折算进 A3 结论面（A3 机制面机判仅证重开链路在位）。" +
    "两口径独立采样、独立判定、互不抵充。",
  streakRule:
    "③判据连击纪律：连击清零沿 meta.baselineProtocol 单源（连续 3 轮四件套全不达才计数前移，任一轮部分达标即重置——本条只引用不重定义）；" +
    "另立单判据连击：同一判据 id 连续 2 轮判红（「未判定」不计红）→ 下一轮开工自动升级「查判据」——先复核判据本体" +
    "（阈值/口径/check 脚本）是否失真，查实判据失真走 revision 修订、查实实现缺陷才走修复批；查判据期间该判据记「查判据中」，" +
    "禁止未查先修连烧轮次。",
};

// —— 版本与修订说明（diff 摘要，feedbackProtocol 要求）——
spec.meta.version = "1.4";
spec.meta.revision_note =
  "v1.4（2026-10-15 · R1 复测收口轮判读纪律增补）：仅新增 meta.retestProtocol 三条款——" +
  "①未绑 HEAD sha 一律「未判定·待采」（绑 sha 有效性 = 报告绑定点到当前 HEAD 受测源面 diff 为空）；" +
  "②A2 模拟局口径（headless 种子局机判）/ A3 真人局口径（记录卡真人回填）独立采样判定不混算；" +
  "③连击清零沿 baselineProtocol 单源 + 同一判据连续 2 轮红 → 升级查判据（先查判据本体失真再定修复，禁止连烧轮次）。" +
  "零改动段：numeric（逐字节冻结）/acceptance 16 条/world/entities/levels/assets；" +
  "A1/A2/A4 阈值一律不动（红线，守卫机判）。" +
  "任务书「v1.1→v1.2」口径偏差：链实况已在 v1.3 approved（2026-10-14），本修订为链 v6。";

// —— 零触碰守卫：六段逐字节不变 ——
for (const k of FROZEN) {
  if (JSON.stringify(spec[k]) !== before[k]) {
    console.error(`零触碰守卫违例：${k} 段被改动（本修订仅允许 meta.retestProtocol + meta.version/revision_note）`);
    process.exit(1);
  }
}
if (JSON.stringify(base.spec.numeric) !== JSON.stringify(spec.numeric)) {
  console.error("numeric 逐字节冻结违例（A1/A2/A4 阈值红线）");
  process.exit(1);
}
// meta 面仅允许：新增 retestProtocol + 改 version/revision_note，其余键零触碰
const metaAllowed = new Set(["retestProtocol", "version", "revision_note"]);
const metaAfter = JSON.parse(metaBefore);
for (const k of META_KEYS) {
  if (!metaAllowed.has(k) && JSON.stringify(metaAfter[k]) !== JSON.stringify(spec.meta[k])) {
    console.error(`meta 守卫违例：既有键 ${k} 被改动`);
    process.exit(1);
  }
}

writeFileSync(
  join(here, "../../../.myrd/spec/wheat-squad/design-spec-v1_4-payload.json"),
  JSON.stringify({ spec }, null, 2) + "\n"
);
console.log(`v1.4 payload ok：六段零触碰守卫 PASS · meta 仅 +retestProtocol/version/revision_note · acceptance ${spec.acceptance.length} 条零改动`);
