// v1.1 修订载荷构建器（P0-3 · 只补真人面可测表述，已达阈值一字不动）
// 断言面：numeric/world/entities/levels 深等冻结 + a1/a2 既有阈值子串逐字保留 + 其余 acceptance 条目零改动
import { readFileSync, writeFileSync } from "node:fs";

const EXPORT = ".myrd/spec/line3-tower-defense/design-spec.json";
const base = JSON.parse(readFileSync(EXPORT, "utf8")).spec;
const sort = (o) => JSON.stringify(o, Object.keys(o ?? {}).sort?.() === undefined ? undefined : Object.keys(o ?? {}).sort(), 1);
const canon = (o) => JSON.stringify(o, (_, v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]])) : v));

const frozenSegments = {};
for (const seg of ["numeric", "world", "entities", "levels"]) frozenSegments[seg] = canon(base[seg]);

const spec = JSON.parse(JSON.stringify(base));
if (spec.meta.version !== "1.0") throw new Error(`baseline meta.version=${spec.meta.version}，预期 1.0`);

const A1_APPEND = "真人局对应面（v1.1 增补，不改上述机面阈值）：真人首 30 秒流失=会话内 run_start 后 30000ms 内无 first_placement_at 且无 run_end（含中途离开，经本地埋点持久化面回捞）计为流失；测量方法=本地埋点方案 v1（.myrd/blackboard/line3-tower-defense/telemetry-plan-v1.md，零平台 API 依赖）；阈值=观测型初始锚定（窗=30s、目标行为=完成首次布防），真人样本回流后 revision 校准。";
const A2_APPEND = "真人局对应面（v1.1 增补，不改上述模拟局阈值带）：真人单局时长取 run_end.run_duration_ms 本地埋点字段（零平台 API 依赖），逐局分布 P50/P90，与模拟局口径分开统计不混算；阈值=观测型初始锚定，真人样本 ≥5 局回流后 revision 校准。";

const a1 = spec.acceptance.find((a) => a.id === "a1-td-first-placement-feedback");
const a2 = spec.acceptance.find((a) => a.id === "a2-td-wave-duration-band");
if (!a1 || !a2) throw new Error("a1/a2 未找到");

// 既有阈值逐字保留断言（追加句拼接，原文不动）
const a1Before = a1.statement, a2Before = a2.statement;
a1.statement = a1Before + A1_APPEND;
a2.statement = a2Before + A2_APPEND;
if (!a1.statement.startsWith(a1Before) || !a2.statement.startsWith(a2Before)) throw new Error("原文未逐字保留");

spec.meta.revision_note = [
  ...(Array.isArray(spec.meta.revision_note) ? spec.meta.revision_note : [spec.meta.revision_note].filter(Boolean)),
  "v1.1（2026-10-23 P0-3 组合推进轮）：acceptance 可测性三问预审出 1 项不可测（首 30 秒流失真人面）+1 项条件可测（真人口径单局时长），按任务口径出本修订——只补 a1/a2 真人面对应面可测表述与测量方法（telemetry-plan-v1 附件），numeric/world/entities/levels 逐段冻结深等，acceptance id 与 check 命令零改动，既有阈值一字不动；本修订不计打磨轮 R1、不受「等反馈」约束（主策划裁定口径）。",
];

const payload = {
  spec,
  detail:
    "v1.1 可测性补强（2026-10-23 P0-3 组合推进轮）：a1 追加真人面首 30 秒流失判据表述（测量方法=本地埋点方案 v1，零平台 API；观测型初始锚定），a2 追加真人口径单局时长测量表述（run_duration_ms，与模拟局分开统计）；其余 13 条 acceptance、numeric/world/entities/levels 逐段深等零改动，acceptance id 与 check 命令零改动，既有阈值一字不动。",
};

// 冻结断言
for (const seg of ["numeric", "world", "entities", "levels"]) {
  if (canon(spec[seg]) !== frozenSegments[seg]) throw new Error(`冻结段 ${seg} 被改动`);
}
// 其余 acceptance 条目零改动断言
const baseAcc = JSON.parse(JSON.stringify(base.acceptance));
for (const a of spec.acceptance) {
  const b = baseAcc.find((x) => x.id === a.id);
  if (!b) throw new Error(`新增条目 ${a.id}（本修订禁止）`);
  if (a.id !== "a1-td-first-placement-feedback" && a.id !== "a2-td-wave-duration-band") {
    if (canon(a) !== canon(b)) throw new Error(`非目标条目被改动: ${a.id}`);
  } else if ((a.check !== b.check) || (a.mode !== b.mode)) {
    throw new Error(`a1/a2 check/mode 被改动`);
  }
}

writeFileSync(".myrd/spec/line3-tower-defense/spec-v1.1-payload.json", JSON.stringify(payload, null, 2) + "\n");
console.log("payload written; acc=", spec.acceptance.length, "meta.version=", spec.meta.version);
console.log("frozen segments deep-equal: numeric/world/entities/levels OK");
console.log("a1/a2 thresholds preserved verbatim OK; ids & checks unchanged OK");
