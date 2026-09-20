#!/usr/bin/env node
// contract-check.mjs — 游戏契约测试门禁（routine id: game-contract）
// 「实现是否符合策划案」的机器层验收：断言 approved 版 GameDesignSpec 声明的
// 实体/关卡/数值/验收检查在工程里真实存在、关卡元素编号稳定唯一。
// 与 godot-smoke 分工：smoke 管「能不能跑」，本脚本管「跑的是不是策划案里那个游戏」。
//
// 用法（与 .myrd/routines.yaml game-contract 一致）：
//   node scripts/contract-check.mjs --spec .myrd/spec/design-spec.json --project .
//
// 退出码：0 全过；1 契约失败（含 SPEC_NOT_APPROVED / spec 缺失 / 路径悬空）。
// 零依赖（仅 node 内置模块），可在 CI / preHook 直接运行。

import fs from "node:fs";
import path from "node:path";

// ---- 参数解析（--spec <path> --project <dir>）----
const args = process.argv.slice(2);
function argOf(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}
const specPath = argOf("--spec") ?? ".myrd/spec/design-spec.json";
const projectDir = argOf("--project") ?? ".";

const failures = [];
const passes = [];
function pass(msg) { passes.push(msg); }
function fail(msg) { failures.push(msg); }

// spec 里声明的路径 → 工程根相对路径（spec 由工作区根起算，工程可能在其子目录）。
function resolveAgainstProject(p) {
  const asProjectRelative = path.join(projectDir, p);
  if (fs.existsSync(asProjectRelative)) return asProjectRelative;
  const asWorkspaceRelative = path.join(projectDir, "..", p);
  if (fs.existsSync(asWorkspaceRelative)) return asWorkspaceRelative;
  return null;
}

// ---- ① spec 存在且可解析 ----
if (!fs.existsSync(specPath)) {
  console.error(`CONTRACT: FAIL spec 文件不存在: ${specPath}（先走策划案流程并导出 approved 版）`);
  process.exit(1);
}
let spec;
try {
  spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
  pass(`spec 可解析: ${specPath}`);
} catch (err) {
  console.error(`CONTRACT: FAIL spec JSON 解析失败: ${err.message}`);
  process.exit(1);
}

// ---- ② 只认 approved 版（红线：契约测试与实现都只认 approved）----
const approved = spec?.meta?.approval?.approved === true || spec?.meta?.status === "approved";
if (!approved) {
  console.error("CONTRACT: FAIL SPEC_NOT_APPROVED — 策划案未处于 approved 状态，契约测试拒绝执行。");
  console.error(`  meta.status = ${JSON.stringify(spec?.meta?.status)}，approval = ${JSON.stringify(spec?.meta?.approval)}`);
  console.error("  恢复路径：POST /api/v1/game-design-specs 建版 → 主人拍板 POST /:id/approve → 重新导出本文件。");
  process.exit(1);
}
pass("spec 为 approved 版");

// ---- ③ 六段结构完整性 ----
for (const section of ["meta", "world", "entities", "levels", "numeric", "acceptance"]) {
  if (spec[section] === undefined) fail(`六段缺段: ${section}`);
  else pass(`六段完整: ${section}`);
}

// ---- ④ 实体落点：entities[].script / scene 必须真实存在 ----
for (const entity of spec.entities ?? []) {
  if (entity.script) {
    const hit = resolveAgainstProject(entity.script);
    if (hit) pass(`实体 ${entity.id} script 存在: ${entity.script}`);
    else fail(`实体 ${entity.id} script 悬空: ${entity.script}`);
  }
  if (entity.scene) {
    const hit = resolveAgainstProject(entity.scene);
    if (hit) pass(`实体 ${entity.id} scene 存在: ${entity.scene}`);
    else fail(`实体 ${entity.id} scene 悬空: ${entity.scene}`);
  }
}

// ---- ⑤ 关卡落点：levels[].scene 存在；元素编号稳定唯一 ----
const elementIds = new Set();
for (const level of spec.levels ?? []) {
  const hit = level.scene ? resolveAgainstProject(level.scene) : null;
  if (level.scene && hit) pass(`关卡 ${level.id} scene 存在: ${level.scene}`);
  else if (level.scene) fail(`关卡 ${level.id} scene 悬空: ${level.scene}`);
  for (const element of level.elements ?? []) {
    if (elementIds.has(element.id)) fail(`关卡元素编号重复: ${element.id}（编号必须稳定唯一）`);
    else elementIds.add(element.id);
  }
}
pass(`关卡元素编号唯一性核对完成（${elementIds.size} 个）`);

// ---- ⑥ 数值契约：numeric 键在工程代码中有对应常量 ----
// 扫描面 = 全部持有 numeric 常量的脚本（2026-09-20 程序侧修订：补 scripts/main.gd 与
// autoload/audio_manager.gd —— INVALID_MSG_HOLD_SEC / COMBO_PITCH_STEP / COMBO_MAX_PITCH
// 只在这两处定义，缺失会导致获批后本检查假阴性 FAIL）。
const numericSources = [
  "autoload/game_state.gd",
  "autoload/audio_manager.gd",
  "scripts/board.gd",
  "scripts/player.gd",
  "scripts/candy.gd",
  "scripts/main.gd",
];
const sourceTexts = {};
for (const rel of numericSources) {
  const abs = path.join(projectDir, rel);
  if (fs.existsSync(abs)) sourceTexts[rel] = fs.readFileSync(abs, "utf8");
}
for (const key of Object.keys(spec.numeric ?? {})) {
  const found = Object.values(sourceTexts).some((text) => new RegExp(`\\b${key}\\b`).test(text));
  if (found) pass(`数值 ${key} 在工程常量区有对应`);
  else fail(`数值 ${key} 在工程代码中无对应（数值只认 spec.numeric，禁止两头各改各的）`);
}

// ---- ⑦ 验收检查：acceptance[].check 提到的工程文件必须存在 ----
for (const ac of spec.acceptance ?? []) {
  if (!ac.check) { fail(`验收项 ${ac.id ?? "?"} 缺少 check`); continue; }
  // 提取 check 里出现的工程内路径（games/... 或 tests/... 等）逐一断言存在。
  const pathMatches = String(ac.check).match(/[\w./-]+\.(?:gd|tscn|mjs|sh|json|py)/g) ?? [];
  if (pathMatches.length === 0) { pass(`验收项 ${ac.id} check 为命令型（无数值文件断言）`); continue; }
  for (const p of pathMatches) {
    const hit = resolveAgainstProject(p);
    if (hit) pass(`验收项 ${ac.id} 依赖存在: ${p}`);
    else fail(`验收项 ${ac.id} 依赖悬空: ${p}`);
  }
}

// ---- 汇总 ----
console.log("—— 契约测试输出 ——");
for (const p of passes) console.log(`  PASS  ${p}`);
for (const f of failures) console.log(`  FAIL  ${f}`);
console.log(`—— 合计 ${passes.length} PASS / ${failures.length} FAIL ——`);
if (failures.length > 0) {
  console.error("CONTRACT: FAIL 契约不一致（见上方 FAIL 逐条）");
  process.exit(1);
}
console.log("CONTRACT: PASS 实现与 approved 策划案一致");
