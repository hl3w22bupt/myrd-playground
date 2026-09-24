#!/usr/bin/env node
// contract-check.mjs — 游戏契约测试门禁（routine id: game-contract）· 统一版（第三轮驳回修复）
//
// ★ 路径契约：routine 以【工作区根】为 cwd 执行 `node scripts/contract-check.mjs ...`，
//   故本文件必须位于 <工作区根>/scripts/。games/game/scripts/contract-check.mjs 是同内容镜像
//   ——两份必须同步修改（第三轮驳回根因即并行会话只更新了工程内副本、根副本被清）。
//   改动本门禁的会话：两处一起改，并在 blockers.md B-1 记一行。
//
// 「实现是否符合策划案」的机器层验收：断言 approved 版 GameDesignSpec 声明的
// 实体/关卡/数值/验收检查在工程里真实存在、关卡元素编号稳定唯一。
// 与 godot-smoke 分工：smoke 管「能不能跑」，本脚本管「跑的是不是策划案里那个游戏」。
//
// 退出码：0 全过；1 契约失败（含 SPEC_NOT_APPROVED / spec 缺失 / 路径悬空）。
// 零依赖（仅 node 内置模块），可在 CI / preHook 直接运行。

import fs from "node:fs";
import path from "node:path";

// ---- 参数解析（--spec <path> --project <dir>，默认与 routines.yaml game-contract params 一致）----
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

// spec 声明路径 → 磁盘文件。前提：本进程 cwd = 工作区根（routine 以根为 cwd 执行）。
// p 有两种历史口径：工作区根相对（games/game/...、std-skills/...）与工程内相对（autoload/...）。
// 三条候选（命中即返）：
//   c1) p 原样                        —— p 为根相对口径
//   c2) <projectDir>/<p>              —— p 为工程内相对 × projectDir=工程（games/game）
//   c3) <projectDir>/games/game/<p>   —— p 为工程内相对 × projectDir=工作区根（.）
// （实测坑两连：① path.join("games/game","..","games/game/x") 的 .. 只抵消一层 game 段，
//  得 games/games/game/x；② path.join("games/game","..") 规范化为 "games" 而非 "."——
//  所以禁止任何「先归一父目录再拼接」的写法，直接列候选最可靠。）
function resolveAgainstProject(p) {
  const candidates = [
    p,
    path.join(projectDir, p),
    path.join(projectDir, "games", "game", p),
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
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
  if (level.scene) {
    const hit = resolveAgainstProject(level.scene);
    if (hit) pass(`关卡 ${level.id} scene 存在: ${level.scene}`);
    else fail(`关卡 ${level.id} scene 悬空: ${level.scene}`);
  }
  for (const element of level.elements ?? []) {
    if (elementIds.has(element.id)) fail(`关卡元素编号重复: ${element.id}（编号必须稳定唯一）`);
    else elementIds.add(element.id);
  }
}
pass(`关卡元素编号唯一性核对完成（${elementIds.size} 个）`);

// ---- ⑥ 数值契约：numeric 键在工程代码中有对应常量 ----
// 扫描源三层（2026-09-20 统一版，兼容 projectDir=. 与 games/game 两种口径）：
//   ① spec.entities[].script —— 数值只认 spec：声明实体脚本即数值唯一候选地（含
//      INVALID_MSG_HOLD_SEC→main.gd / COMBO_*→audio_manager.gd，吸收程序批次修订意图）；
//   ② 工程内常量区清单（程序批次修订集）逐条三向解析，作为显式兜底；
//   ③ ①② 全空时 projectDir 下递归 .gd 扫描（排除 VCS/引擎缓存/导出产物，上限 200 文件）。
function collectNumericSources() {
  const sources = new Map();
  // webgame 加法式泛化（2026-09-23）：除 .gd 外，同时认 spec.entities[].script 声明文件的
  // 自身后缀（.js/.mjs/.ts）。既有 .gd 口径零改动：.gd 糖果线行为不变，仅对声明了 JS
  // 实体脚本的 spec（webgame 线）多收集候选源。
  const declaredExts = new Set();
  for (const entity of spec.entities ?? []) {
    if (typeof entity.script === "string" && entity.script.includes(".")) {
      declaredExts.add(entity.script.slice(entity.script.lastIndexOf(".")));
    }
  }
  const collectable = (p) => p.endsWith(".gd") || declaredExts.has(path.extname(p));
  for (const entity of spec.entities ?? []) {
    if (!entity.script) continue;
    const hit = resolveAgainstProject(entity.script);
    if (hit && collectable(hit)) sources.set(fs.realpathSync(hit), fs.readFileSync(hit, "utf8"));
  }
  const fallbackList = [
    "autoload/game_state.gd",
    "autoload/audio_manager.gd",
    "scripts/board.gd",
    "scripts/player.gd",
    "scripts/candy.gd",
    "scripts/main.gd",
  ];
  for (const rel of fallbackList) {
    const hit = resolveAgainstProject(rel);
    if (hit && collectable(hit)) sources.set(fs.realpathSync(hit), fs.readFileSync(hit, "utf8"));
  }
  if (sources.size > 0) return sources;
  const EXCLUDE = new Set([".git", ".godot", "node_modules", "export", "qa", ".myrd", ".myrd-platform", "dist", "build"]);
  const wantedExts = new Set([...declaredExts, ".gd"]);
  const found = [];
  const walk = (dir, depth) => {
    if (depth > 6 || found.length >= 200) return;
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (found.length >= 200) return;
      if (entry.name.startsWith(".") || EXCLUDE.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, depth + 1);
      else if (wantedExts.has(path.extname(entry.name))) found.push(full);
    }
  };
  walk(projectDir, 0);
  for (const file of found) sources.set(fs.realpathSync(file), fs.readFileSync(file, "utf8"));
  return sources;
}
const numericSources = collectNumericSources();
if (numericSources.size > 0) pass(`数值扫描源就绪（${numericSources.size} 个脚本，三层解析）`);
else fail("数值扫描源为空：spec.entities 与工程内清单均未解析到任何 .gd（检查 --project 口径）");
for (const key of Object.keys(spec.numeric ?? {})) {
  const pattern = new RegExp(`\\b${key}\\b`);
  const found = [...numericSources.values()].some((text) => pattern.test(text));
  if (found) pass(`数值 ${key} 在工程常量区有对应`);
  else fail(`数值 ${key} 在工程代码中无对应（数值只认 spec.numeric，禁止两头各改各的）`);
}

// ---- ⑦ 验收检查：acceptance[].check 提到的工程文件必须存在 ----
for (const ac of spec.acceptance ?? []) {
  if (!ac.check) { fail(`验收项 ${ac.id ?? "?"} 缺少 check`); continue; }
  // 提取 check 里出现的工程内文件路径（带扩展名者）逐一断言存在。
  const pathMatches = String(ac.check).match(/[\w./-]+\.(?:gd|tscn|mjs|sh|json|py)/g) ?? [];
  if (pathMatches.length === 0) { pass(`验收项 ${ac.id} check 为命令型（无文件断言）`); continue; }
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
