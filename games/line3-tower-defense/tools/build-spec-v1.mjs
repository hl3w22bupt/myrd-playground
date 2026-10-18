#!/usr/bin/env node
// build-spec-v1.mjs — line3 spec v1.0 六件套组装 + 定稿前机校验（B2/B5/B6 共用校验口径）
// 用法：node games/line3-tower-defense/tools/build-spec-v1.mjs
// 输入：.myrd/spec/line3-tower-defense/frag-a-*.json + frag-b-*.json
// 输出：.myrd/spec/line3-tower-defense/spec-v1-payload.json  （POST /revisions 载荷 {spec, detail}）
// 校验失败即非零退出（fail-closed），不产出载荷。
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const DIR = join(ROOT, ".myrd/spec/line3-tower-defense");
const A = JSON.parse(readFileSync(join(DIR, "frag-a-meta-world-entities-levels.json"), "utf8"));
const B = JSON.parse(readFileSync(join(DIR, "frag-b-numeric-acceptance.json"), "utf8"));

const spec = {
  meta: A.meta,
  world: A.world,
  entities: A.entities,
  levels: A.levels,
  numeric: B.numeric,
  acceptance: B.acceptance,
};

const errors = [];
const sections = ["meta", "world", "entities", "levels", "numeric", "acceptance"];
for (const s of sections) if (spec[s] === undefined) errors.push(`缺段: ${s}`);
for (const s of ["entities", "levels", "acceptance"]) {
  if (!Array.isArray(spec[s]) || spec[s].length === 0) errors.push(`${s} 必须为非空数组`);
  else for (const el of spec[s]) if (!el.id || String(el.id).trim() === "") errors.push(`${s} 存在空 id 元素`);
}
// acceptance 四要素：id + mode + check + statement
const modes = new Set(["auto", "manual"]);
for (const a of spec.acceptance) {
  if (!modes.has(a.mode)) errors.push(`acceptance ${a.id} mode 非法: ${a.mode}`);
  if (!a.check || String(a.check).trim() === "") errors.push(`acceptance ${a.id} 缺 check`);
  if (!a.statement || String(a.statement).length < 20) errors.push(`acceptance ${a.id} statement 缺失或过短`);
}
// 禁词扫描（模糊评价词不得作为判定词）
const BANNED = ["流畅", "有趣", "丝滑", "爽快", "好玩的手感"];
for (const a of spec.acceptance) {
  for (const w of BANNED) if (a.statement.includes(w)) errors.push(`acceptance ${a.id} statement 含禁词: ${w}`);
}
// 埋点四件定名逐字符
const FOUR = ["first_tap", "first_loop_complete", "restart_clicked", "hint_shown"];
for (const k of FOUR) if (!(k in spec.meta.telemetryFields)) errors.push(`telemetryFields 缺四件定名: ${k}`);
// entities 落点路径在盘（inv-1 前置校验；骨架轮允许 check 文件未落，但 script 落点必须在盘）
for (const e of spec.entities) {
  if (e.script && e.script !== "-") {
    try { readFileSync(join(ROOT, e.script)); } catch { errors.push(`entities ${e.id} script 落点不存在: ${e.script}（须先落骨架文件）`); }
  }
}
// world 红线面：差异点三列 + 不同品类声明 + 首屏文案逐字 + 操作路径 path id
if (!Array.isArray(spec.world.differentiation?.三列) || spec.world.differentiation.三列.length !== 3) errors.push("world.differentiation.三列 必须=3 行");
if (!Array.isArray(spec.world.firstScreenCopy) || spec.world.firstScreenCopy.length < 10) errors.push("world.firstScreenCopy 逐字枚举 <10 条");
const pathIds = (spec.world.operationPaths || []).map((p) => p.id);
if (pathIds.length < 5 || pathIds.some((id) => !/^path-[a-z0-9-]+$/.test(id))) errors.push("world.operationPaths 须 ≥5 条且带规范 path id");
// a6 判据覆盖 5 条 path id
const a6 = spec.acceptance.find((a) => a.id === "a6-td-operation-paths");
for (const id of pathIds) if (a6 && !a6.statement.includes(id)) errors.push(`a6 statement 未列 path id: ${id}`);

if (errors.length) {
  console.error("BUILD-SPEC-V1 校验失败（fail-closed）：");
  for (const e of errors) console.error("  ✗ " + e);
  process.exit(1);
}

const detail =
  "v1.0 六件套完整版（2026-10-17 双轨轮 B2）：承 v0.1 骨架 id 连续性（a1/a2/a3/a4/det-1/tex-1/perf-1 不改名），" +
  "acceptance 7→15 条（新增 a5 四事件/a6 操作路径/ac-art-1..4/inv-1/fnd-1）；world 段新增差异点三列+不同品类声明+" +
  "首屏文案 12 条逐字枚举+操作路径 5 条带 path id；entities 6→12 条补 script/scene 落点；numeric PEND→初始锚定值" +
  "（waveBand P50∈[240,420]s/P90≤600s/20 种子；victoryWaves=8；turret/enemy/economy/feedback/perf 全量数值面）+" +
  "palette 8 色冻结（风格卡 v1 2026-10-17）；埋点四件定名 first_tap/first_loop_complete/restart_clicked/hint_shown 逐字符锁定。" +
  "数值校准条款：首批模拟局实测后走 revision 校准（numeric._calibrationNote）。a3 真人面未判定带负责人+采样计划。";

const payload = { spec, detail };
const out = join(DIR, "spec-v1-payload.json");
writeFileSync(out, JSON.stringify(payload, null, 2) + "\n");
console.log(`BUILD-SPEC-V1 PASS 六段校验全过 → ${out}`);
console.log(`  acceptance=${spec.acceptance.length} entities=${spec.entities.length} levels=${spec.levels.length} 首屏文案=${spec.world.firstScreenCopy.length} 操作路径=${pathIds.length}`);
console.log(`  四件定名: ${FOUR.join(" / ")}`);
