#!/usr/bin/env node
// contract-check.mjs — 游戏契约测试门禁（routine id: game-contract）· 统一版（第四轮驳回修复）
//
// 第四轮（2026-09-25）：SPEC_NOT_APPROVED 根因 = 三层——① routine specPath 仍指已冻结撞车件
//   design-spec.json（B4 治理漏网，改指 stack-tower-spec.json）；② approved 判定只认糖果线
//   meta.status 形状（补 _platform.status / 顶层 status 兼容）；③ 业务段/数值扫描的 Godot
//   形状假设（补 spec.spec 六段解析 + .ts 双栈 + kernel/numeric.ts SSOT 恒并入 + 实体
//   花括号多路径展开）。
//
// ★ 路径契约：routine 以【工作区根】为 cwd 执行 `node scripts/contract-check.mjs ...`，
//   故本文件必须位于 <工作区根>/scripts/。games/game/scripts/contract-check.mjs 是同内容镜像
//   ——两份必须同步修改（第三轮驳回根因即并行会话只更新了工程内副本、根副本被清）。
//   改动本门禁的会话：两处一起改，并在 blockers.md 记一行。
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
const specPath = argOf("--spec") ?? ".myrd/spec/stack-tower-spec.json";
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
// 形状兼容（三代导出件，见 .myrd/spec/README.md「一游戏一文件」）：
//   平台登记导出件（stack-tower v3 起）：_platform.status（业务六段在 spec.spec 下）
//   旧顶层形状（design-spec.json 冻结残留）：status（业务六段在 spec.spec 下）
//   糖果线 Godot 旧形状：meta.status / meta.approval.approved（六段在顶层）
const platformStatus = spec?._platform?.status;
const topStatus = spec?.status;
const metaStatus = spec?.meta?.status;
const metaApproval = spec?.meta?.approval?.approved;
const approved =
  platformStatus === "approved" ||
  topStatus === "approved" ||
  metaStatus === "approved" ||
  metaApproval === true;
if (!approved) {
  console.error("CONTRACT: FAIL SPEC_NOT_APPROVED — 策划案未处于 approved 状态，契约测试拒绝执行。");
  console.error(`  _platform.status = ${JSON.stringify(platformStatus)}，status = ${JSON.stringify(topStatus)}，meta.status = ${JSON.stringify(metaStatus)}，approval = ${JSON.stringify(spec?.meta?.approval)}`);
  console.error("  恢复路径：POST /api/v1/game-design-specs 建版 → 主人拍板 POST /:id/approve → 重新导出 approved 版到 .myrd/spec/<game>-spec.json（一游戏一文件）。");
  process.exit(1);
}
pass(
  spec?._platform
    ? `spec 为 approved 版（平台登记 v${spec._platform.version} · ${spec._platform.id ?? "platformSpecId 缺失"}）`
    : "spec 为 approved 版（旧导出件形状）",
);

// ---- ③ 六段结构完整性 ----
// 形状兼容：平台登记导出件把业务六段收进 spec.spec（顶层另挂 schemaVersion/_platform）；旧导出件六段在顶层。
const doc = spec?.spec ?? spec;
for (const section of ["meta", "world", "entities", "levels", "numeric", "acceptance"]) {
  if (doc[section] === undefined) fail(`六段缺段: ${section}`);
  else pass(`六段完整: ${section}`);
}

// ---- ④ 实体落点：entities[].script / scene 必须真实存在 ----
// script 允许 {a,b,c} 花括号多路径（如 stack-tower e-pwa-shell 的 PWA 壳四落点），逐条断言存在。
function expandBracePaths(p) {
  const m = /\{([^}]+)\}/.exec(p ?? "");
  if (!m) return [p];
  const prefix = p.slice(0, m.index);
  const suffix = p.slice(m.index + m[0].length);
  return m[1].split(",").map((alt) => prefix + alt.trim() + suffix);
}
for (const entity of doc.entities ?? []) {
  for (const scriptPath of expandBracePaths(entity.script)) {
    if (!scriptPath) continue;
    const hit = resolveAgainstProject(scriptPath);
    if (hit) pass(`实体 ${entity.id} script 存在: ${scriptPath}`);
    else fail(`实体 ${entity.id} script 悬空: ${scriptPath}`);
  }
  if (entity.scene) {
    const hit = resolveAgainstProject(entity.scene);
    if (hit) pass(`实体 ${entity.id} scene 存在: ${entity.scene}`);
    else fail(`实体 ${entity.id} scene 悬空: ${entity.scene}`);
  }
}

// ---- ⑤ 关卡落点：levels[].scene 存在；元素编号稳定唯一 ----
const elementIds = new Set();
for (const level of doc.levels ?? []) {
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
// 扫描源三层（2026-09-25 双栈版，兼容 Godot .gd 与 Web .ts 两条工程线）：
//   ① doc.entities[].script —— 数值只认 spec：声明实体脚本即数值候选地（.gd 与 .ts 都收；
//      花括号多路径展开后逐条解析）；
//   ② 工程内常量区清单恒并入（不是只在①为空时兜底）：stack-tower 数值 SSOT =
//      games/stack-tower/src/kernel/numeric.ts，它不在 entities[].script 清单里，
//      不恒并入则 numeric 组键（audio/cut_width/deploy/…）无处对号；
//   ③ ①② 全空时 projectDir 下递归 .gd/.ts 扫描（排除 VCS/引擎缓存/导出产物，上限 200 文件）。
function collectNumericSources() {
  const sources = new Map();
  const isScript = /\.(gd|ts)$/;
  for (const entity of doc.entities ?? []) {
    if (!entity.script) continue;
    for (const scriptPath of expandBracePaths(entity.script)) {
      if (!scriptPath) continue;
      const hit = resolveAgainstProject(scriptPath);
      if (hit && isScript.test(hit)) sources.set(fs.realpathSync(hit), fs.readFileSync(hit, "utf8"));
    }
  }
  const fallbackList = [
    "autoload/game_state.gd",
    "autoload/audio_manager.gd",
    "scripts/board.gd",
    "scripts/player.gd",
    "scripts/candy.gd",
    "scripts/main.gd",
    "games/stack-tower/src/kernel/numeric.ts",
  ];
  for (const rel of fallbackList) {
    const hit = resolveAgainstProject(rel);
    if (hit && isScript.test(hit)) sources.set(fs.realpathSync(hit), fs.readFileSync(hit, "utf8"));
  }
  if (sources.size > 0) return sources;
  const EXCLUDE = new Set([".git", ".godot", "node_modules", "export", "qa", ".myrd", ".myrd-platform", "build"]);
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
      else if (/\.(gd|ts)$/.test(entry.name)) found.push(full);
    }
  };
  walk(projectDir, 0);
  for (const file of found) sources.set(fs.realpathSync(file), fs.readFileSync(file, "utf8"));
  return sources;
}
const numericSources = collectNumericSources();
if (numericSources.size > 0) pass(`数值扫描源就绪（${numericSources.size} 个脚本，三层解析）`);
else fail("数值扫描源为空：spec.entities 与工程内清单均未解析到 .gd/.ts（检查 --project 口径）");
for (const key of Object.keys(doc.numeric ?? {})) {
  const pattern = new RegExp(`\\b${key}\\b`);
  const found = [...numericSources.values()].some((text) => pattern.test(text));
  if (found) pass(`数值 ${key} 在工程常量区有对应`);
  else fail(`数值 ${key} 在工程代码中无对应（数值只认 spec.numeric，禁止两头各改各的）`);
}

// ---- ⑦ 验收检查：acceptance[].check 提到的工程文件必须存在 ----
for (const ac of doc.acceptance ?? []) {
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
