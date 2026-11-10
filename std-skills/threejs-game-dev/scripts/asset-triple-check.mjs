#!/usr/bin/env node
// asset-triple-check.mjs —— 资产三核对（R1 / M1-A · 技术设计 D2 的判定器实现）。
//
// 门禁独立性红线：本脚本是**判定器**，只能来自仓库 std-skills/godot-game-dev/scripts/
//（模板仓预置），被检方绝不自造/改写 —— 缺失属环境缺陷，走 blocked 上报。
//
// 三向核对 + 两个外加维度（全部机械可复现，不依赖 agent 自觉）：
//   S1 清单存在性：spec 无 assets 段 → 存量宽容 SKIP；但资产目录里有「无清单图像」→ FAIL
//                 （验收 2：无清单资产触发 preflight FAIL；存量 run 只要不塞图就不拦）
//   S2 清单结构：  assetKey 唯一 kebab / source 枚举 / programmatic 必填 reason（验收 3）
//                 / generated 缺 spec、缺 runtimeUse —— 与 lib/workshop-assets.ts 同一口径
//   S3 清单→文件： generated/curated 项必须在 assets/ 下按白名单扩展名找到 >0 字节的文件
//   S4 文件→清单： assets/ 下的图像文件（扩展名白名单）必须被清单覆盖；模板/引擎自有目录
//                 豁免（fonts/sfx/music/audio/particles/cc0 + .myrd/asset-exemptions.json）
//   S5 清单→运行时引用：显式静态扫描 —— 扫描范围必须覆盖 Godot 场景与资源文件
//                 （.tscn/.tres 的 res:// 资源引用），不只源码字符串常量（D2；只扫源码会
//                 大量漏报「零引用」）。动态拼接引用首版不覆盖（§4 边界），清单备注人工确认。
//   S6 台账→文件： generated 项必须有台账行（v2 机器表），repoPath/bytes/license 齐全且
//                 与仓库实际一致；台账行指向的文件必须存在
//   S7 预算：     generated+curated 计数 ≤ maxImages；总字节 ≤ maxTotalBytes（>0 才拦）；
//                 degraded=true 必须 degradeReason（禁止静默裁剪）
//   S8 firstColorCount：标准风格卡（未豁免）抽样口径见 lib/workshop-assets.ts 常量组 ——
//                 每张 generated PNG 10×10 网格采样 100 像素，与风格卡 palette 最近邻色
//                 距离 ≤60 记命中；run 级取 generated 资产最小值，要求 ≥60。
//                 palette 解析不到 / 图解码不了 → NOTE 降级跳过，不误报也不冒充通过。
//
// 豁免（§4 边界「极简风格卡」）：风格卡 .myrd/style-card.md 里写一行机器可读声明
//   `asset-gate-exempt: <理由>` —— 整段三核对跳过（EXEMPT），理由进报告留痕。
//   声明约定见 std-skills/style-card-library/SKILL.md。
//
// 用法：
//   node std-skills/godot-game-dev/scripts/asset-triple-check.mjs --game <gamePath> [--spec <path>] [--out <report.json>]
//   # spec 缺省按序探测：<game>/.myrd/spec/design-spec.json → .myrd/spec/design-spec.json
//   #                    → <game>/.myrd/asset-manifest.json（无策划案导出时的清单落点）
// 退出码：0 = PASS / SKIP（存量宽容）/ EXEMPT（风格卡豁免）；1 = FAIL（差异明细见输出）；
//         2 = 用法/环境错误（--game 缺失等）。

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { decodePng, PngError } from "./lib-png.mjs";

// ---- 与 src/lib/workshop-assets.ts 固化的口径保持同源（改动必须两边同步，单测交叉锁定） ----
const ASSET_LEDGER_FIELDS = ["assetKey", "repoPath", "prompt", "provider", "license", "bytes", "size", "generatedAt", "runId", "status"];
const ASSET_LEDGER_V2_MARKER = "asset-ledger:v2";
const ASSET_LEDGER_STATUS = new Set(["active", "degraded", "removed"]);
const FIRST_COLOR_SAMPLE_GRID = 10;
const FIRST_COLOR_MAX_DISTANCE = 60;
const FIRST_COLOR_MIN_HITS = 60;
const ASSET_SOURCES = ["generated", "curated", "programmatic"];
const LEGACY_SOURCE_MAP = { generated: "generated", manual: "curated", licensed: "curated", curated: "curated", programmatic: "programmatic" };

/** 图像/纹理扩展名白名单（反向核对只扫这些；.import/.godot/icon.svg 等引擎自有文件不在扫描集） */
const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif", ".tga"];
/** 运行时引用扫描的文件集：Godot 场景与资源（.tscn/.tres/.scn）+ 源码（.gd/.cs/.gdshader）+ 工程配置 */
const REFERENCE_EXTENSIONS = [".gd", ".tscn", ".tres", ".scn", ".escn", ".gdshader", ".cs", ".cfg"];
/** 模板/引擎自有资产目录豁免（相对 assets/）：模板预置的粒子/字体/音效不是本 run 的清单产物 */
const ENGINE_OWNED_ASSET_DIRS = new Set(["fonts", "sfx", "music", "audio", "particles", "cc0"]);
/** 引用扫描排除目录（相对 gamePath）：证据/缓存/导出物不是运行时引用的载体 */
const REFERENCE_EXCLUDED_DIRS = new Set([".godot", "qa", "export", ".myrd", ".git", "node_modules"]);

// ---- CLI ----

const argv = process.argv.slice(2);
const argOf = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null;
};
const gameArg = argOf("--game");
if (!gameArg) {
  console.error("用法: node asset-triple-check.mjs --game <gamePath> [--spec <specPath>] [--out <report.json>]");
  process.exit(2);
}
// 仓库相对路径（台账 repoPath / 报告里的口径）：routine 以 {{gamePath}}（仓库相对）调用本脚本，
// 自测以相对路径 + cwd 调用 —— 统一在这里归一化，FS 操作仍用 resolve 后的绝对路径。
const gameArgRel = gameArg.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
const gameDir = path.resolve(gameArg);
if (!existsSync(gameDir) || !statSync(gameDir).isDirectory()) {
  console.error(`ASSET_TRIPLE_CHECK: FAIL(2) — 工程目录不存在: ${gameArg}`);
  process.exit(2);
}

const problems = [];
const notes = [];
const styleSamples = [];

// ---- 豁免判定（§4 极简风格卡）：风格卡 asset-gate-exempt 行 → 整段跳过并留痕 ----

const styleCardPath = path.join(gameDir, ".myrd", "style-card.md");
let styleCardText = "";
if (existsSync(styleCardPath)) styleCardText = readFileSync(styleCardPath, "utf-8");
const exemptMatch = styleCardText.match(/^\s*(?:[-*]\s*)?asset-gate-exempt:\s*(\S.*)$/m);

function finish(verdict, exitCode) {
  const summary = {
    verdict,
    gamePath: gameArgRel,
    problems,
    notes,
    firstColor: styleSamples,
  };
  if (exemptMatch) summary.exemptReason = exemptMatch[1].trim();
  const outPath = argOf("--out");
  if (outPath) {
    try {
      writeFileSync(path.resolve(outPath), `${JSON.stringify(summary, null, 2)}\n`, "utf-8");
    } catch (e) {
      notes.push(`报告写盘失败（不改变判定）: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  // 差异明细统一在这里输出：任何分支的 FAIL 都必须带可读的差异清单（修复输入，不是只给一个退出码）
  for (const n of notes) console.log(`asset-triple-check: NOTE ${n}`);
  if (problems.length > 0) {
    console.log(`asset-triple-check: 发现 ${problems.length} 处不一致（FAIL）：`);
    for (const p of problems) console.log(`  - ${p}`);
  }
  console.log(`ASSET_TRIPLE_CHECK: ${verdict}`);
  process.exit(exitCode);
}

if (exemptMatch) {
  notes.push(`风格卡声明资产豁免（asset-gate-exempt）—— 三核对整段跳过，理由：${exemptMatch[1].trim()}`);
  finish("EXEMPT", 0);
}

// ---- spec 清单探测与解析 ----

const specCandidates = [
  argOf("--spec"),
  path.join(gameDir, ".myrd", "spec", "design-spec.json"),
  path.resolve(".myrd", "spec", "design-spec.json"),
  path.join(gameDir, ".myrd", "asset-manifest.json"),
].filter(Boolean);

let specPath = null;
let manifestRaw = null;
for (const candidate of specCandidates) {
  if (existsSync(candidate)) {
    try {
      const parsed = JSON.parse(readFileSync(candidate, "utf-8"));
      if (Array.isArray(parsed?.assets)) {
        specPath = candidate;
        manifestRaw = parsed;
        break;
      }
      // 设计 spec 导出件存在但还没有 assets 段：记住位置（供 S1 判「存量 spec」）
      if (specPath === null) specPath = candidate;
    } catch (e) {
      problems.push(`spec 解析失败 ${candidate}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

/** 归一化（与 lib/workshop-assets.ts normalizeAssetManifest 同口径的只读实现） */
function normalizeManifest(raw) {
  const probs = [];
  const assets = [];
  const rawAssets = Array.isArray(raw?.assets) ? raw.assets : [];
  rawAssets.forEach((item, index) => {
    if (typeof item !== "object" || item === null) {
      probs.push(`assets[${index}] 不是对象`);
      return;
    }
    const entry = item;
    const legacy = typeof entry.id === "string" && entry.assetKey === undefined;
    const assetKey = typeof entry.assetKey === "string" ? entry.assetKey.trim() : legacy ? String(entry.id).trim() : "";
    const role = typeof entry.role === "string" ? entry.role.trim() : typeof entry.kind === "string" ? String(entry.kind).trim() : "";
    const rawSource = typeof entry.source === "string" ? entry.source.trim() : "";
    const source = LEGACY_SOURCE_MAP[rawSource];
    const runtimeUse = typeof entry.runtimeUse === "string" ? entry.runtimeUse.trim() : "";
    const reason = typeof entry.reason === "string" && entry.reason.trim() ? entry.reason.trim() : null;
    const specText = typeof entry.spec === "string" ? entry.spec.trim() : "";
    if (!assetKey) probs.push(`assets[${index}] 缺 assetKey`);
    else if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(assetKey)) probs.push(`assetKey「${assetKey}」须为 kebab-case（小写字母/数字/中划线，≤64 字）`);
    if (!role) probs.push(`assets[${index}]（${assetKey || "未命名"}）缺 role`);
    if (!source) probs.push(`assets[${index}].source「${rawSource}」未知（可用：${ASSET_SOURCES.join("/")}）`);
    if (source === "programmatic" && !reason) probs.push(`资产「${assetKey || "未命名"}」source=programmatic 必填 reason（禁止静默兜底）`);
    if (!legacy && (source === "generated" || source === "curated") && !runtimeUse) {
      probs.push(`资产「${assetKey || "未命名"}」缺 runtimeUse（三核对要按它核对运行时引用）`);
    }
    if (!legacy && source === "generated" && !specText) {
      probs.push(`资产「${assetKey || "未命名"}」source=generated 缺 spec（生成 prompt 的规格说明）`);
    }
    assets.push({ assetKey: assetKey || `unnamed-${index}`, role, spec: specText, source, runtimeUse, reason, legacy });
  });
  const seen = new Set();
  for (const a of assets) {
    if (seen.has(a.assetKey)) probs.push(`assetKey「${a.assetKey}」重复（清单键必须全局唯一）`);
    seen.add(a.assetKey);
  }
  const budget = raw?.assetBudget ?? {};
  const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const normalizedBudget = {
    maxImages: num(budget.maxImages) ?? 8,
    maxTotalBytes: num(budget.maxTotalBytes) ?? 0,
    maxRetries: num(budget.maxRetries) ?? 2,
    degraded: budget.degraded === true,
    degradeReason: typeof budget.degradeReason === "string" && budget.degradeReason.trim() ? budget.degradeReason.trim() : null,
  };
  if (normalizedBudget.degraded && !normalizedBudget.degradeReason) {
    probs.push("assetBudget.degraded=true 时必须写 degradeReason（超预算必须显式降级并声明）");
  }
  return { assets, budget: normalizedBudget, probs };
}

// ---- 文件/引用扫描工具 ----

function walk(dir, base = "") {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const p = path.join(dir, name);
    const rel = base ? `${base}/${name}` : name;
    let st;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) out.push(...walk(p, rel));
    else out.push({ rel, abs: p, size: st.size });
  }
  return out;
}

const assetsDir = path.join(gameDir, "assets");
const imageFiles = existsSync(assetsDir) ? walk(assetsDir).filter((f) => IMAGE_EXTENSIONS.includes(path.extname(f.rel).toLowerCase())) : [];

/** 项目级额外豁免：.myrd/asset-exemptions.json = ["<gamePath> 下相对路径前缀", ...] */
function loadExtraExemptions() {
  const p = path.join(gameDir, ".myrd", "asset-exemptions.json");
  if (!existsSync(p)) return [];
  try {
    const parsed = JSON.parse(readFileSync(p, "utf-8"));
    if (!Array.isArray(parsed)) {
      problems.push(".myrd/asset-exemptions.json 必须是字符串数组（路径前缀）");
      return [];
    }
    return parsed.filter((x) => typeof x === "string").map((x) => x.replace(/^\/+|\/+$/g, ""));
  } catch (e) {
    problems.push(`.myrd/asset-exemptions.json 解析失败: ${e instanceof Error ? e.message : String(e)}`);
    return [];
  }
}

const extraExemptions = loadExtraExemptions();

/** 反向核对的豁免判定：引擎自有目录 + 项目级豁免前缀（.import 等不在图像白名单，天然不在扫描集）。
 *  项目级豁免前缀口径 = **工程目录相对路径**（如 `assets/engine-extra.png`、`assets/vendor/`），
 *  与清单 runtimeUse 描述的引用路径同域，避免「相对谁」的两义性。 */
function isExemptAssetFile(rel) {
  const top = rel.split("/")[0];
  if (ENGINE_OWNED_ASSET_DIRS.has(top)) return true;
  const relFromGame = `assets/${rel.split(path.sep).join("/")}`;
  return extraExemptions.some((prefix) => relFromGame === prefix || relFromGame.startsWith(`${prefix}/`));
}

/** 运行时引用扫描集：gameDir 下的源码/场景/资源文件（排除证据、缓存、导出与清单本身） */
function loadReferenceFiles() {
  const files = [];
  for (const f of walk(gameDir)) {
    const top = f.rel.split("/")[0];
    if (REFERENCE_EXCLUDED_DIRS.has(top)) continue;
    if (!REFERENCE_EXTENSIONS.includes(path.extname(f.rel).toLowerCase())) continue;
    try {
      files.push({ rel: f.rel, text: readFileSync(f.abs, "utf-8") });
    } catch {
      notes.push(`引用扫描跳过不可读文件: ${f.rel}`);
    }
  }
  return files;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 显式引用判定：资产路径（res:// 或裸路径，带/不带扩展名）或 assetKey 词边界命中任一即算引用 */
function isReferenced(assetKey, repoRelPath, referenceFiles) {
  const baseNoExt = repoRelPath.replace(/\.[^.]+$/, "");
  const patterns = [
    new RegExp(escapeRegExp(repoRelPath).replace(/\//g, "[/\\\\]")),
    new RegExp(escapeRegExp(baseNoExt).replace(/\//g, "[/\\\\]")),
    new RegExp(`(^|[^a-z0-9-])${escapeRegExp(assetKey)}([^a-z0-9-]|$)`),
  ];
  for (const f of referenceFiles) {
    for (const re of patterns) {
      if (re.test(f.text)) return f.rel;
    }
  }
  return null;
}

// ---- 台账解析（v2 机器表；口径与 src/lib/workshop-assets.ts 同源） ----

function parseLedgerRows(gamePathDir) {
  const ledgerPath = path.join(gamePathDir, "asset-ledger.md");
  if (!existsSync(ledgerPath)) return { rows: [], exists: false };
  const text = readFileSync(ledgerPath, "utf-8");
  const markerIdx = text.indexOf(ASSET_LEDGER_V2_MARKER);
  if (markerIdx < 0) return { rows: [], exists: true };
  const rows = [];
  for (const line of text.slice(markerIdx).split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) continue;
    if (trimmed.includes("---")) continue;
    const cells = trimmed.slice(1, trimmed.endsWith("|") ? -1 : undefined).split("|").map((c) => c.trim());
    if (cells.length < ASSET_LEDGER_FIELDS.length) continue;
    if (cells[0] === "assetKey") continue;
    const row = {};
    ASSET_LEDGER_FIELDS.forEach((f, i) => {
      row[f] = cells[i] ?? "";
    });
    rows.push(row);
  }
  return { rows, exists: true, path: ledgerPath };
}

// ---- firstColorCount（口径固化见 src/lib/workshop-assets.ts 常量组） ----

function paletteFromStyleCard(text) {
  const hexes = new Set();
  const re = /#[0-9a-fA-F]{6}\b/g;
  let m;
  while ((m = re.exec(text)) !== null) hexes.add(m[0].toLowerCase());
  return [...hexes].slice(0, 12).map((h) => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ]);
}

function firstColorCount(rgba, width, height, palette) {
  if (palette.length === 0) return null;
  const grid = FIRST_COLOR_SAMPLE_GRID;
  let hits = 0;
  for (let gy = 0; gy < grid; gy += 1) {
    for (let gx = 0; gx < grid; gx += 1) {
      const px = Math.min(width - 1, Math.floor(((gx + 0.5) * width) / grid));
      const py = Math.min(height - 1, Math.floor(((gy + 0.5) * height) / grid));
      const o = (py * width + px) * 4;
      const r = rgba[o], g = rgba[o + 1], b = rgba[o + 2];
      let best = Infinity;
      for (const [pr, pg, pb] of palette) {
        const d = Math.sqrt((r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2);
        if (d < best) best = d;
      }
      if (best <= FIRST_COLOR_MAX_DISTANCE) hits += 1;
    }
  }
  return hits;
}

// ============================================
// 主流程
// ============================================

const referenceFiles = loadReferenceFiles();
const ledger = parseLedgerRows(gameDir);
let ledgerEmptinessReported = false;

if (!manifestRaw) {
  // S1 存量宽容（§4 边界）：没有 assets 段 → 不拦存量 run；但塞了无清单图像就是验收 2 的 FAIL
  const unmanifested = imageFiles.filter((f) => !isExemptAssetFile(f.rel));
  if (unmanifested.length > 0) {
    for (const f of unmanifested) {
      problems.push(`无清单资产：${path.posix.join(gameArgRel, "assets", f.rel.split(path.sep).join("/"))}（spec 无 assets 段 —— 所有入包图像必须先进清单）`);
    }
    finish("FAIL", 1);
  }
  notes.push(`spec 无 assets 段且资产目录无未清单图像 —— 存量 run 宽容跳过（spec 探测顺序：${specPath ?? "未找到"}）`);
  finish("SKIP", 0);
}

const { assets, budget, probs: normalizeProblems } = normalizeManifest(manifestRaw);
problems.push(...normalizeProblems.map((p) => `[清单结构] ${p}`));

// S3 清单→文件 + S6 台账→文件 + S8 firstColor
const ledgerRowsByAssetKey = new Map(ledger.rows.map((r) => [r.assetKey, r]));
let totalBytes = 0;
let generatedCount = 0;
let firstColorMin = null;

for (const entry of assets) {
  if (entry.source === "programmatic") continue; // 程序化兜底不进台账、不需要文件（reason 已在 S2 查）
  if (entry.source === "generated") generatedCount += 1;

  // 找仓库文件：清单不写扩展名，按白名单探测（生成器换格式不撒谎）
  const candidates = IMAGE_EXTENSIONS.map((ext) => path.join("assets", `${entry.assetKey}${ext}`));
  const found = candidates
    .map((rel) => {
      const abs = path.join(gameDir, rel);
      return existsSync(abs) ? { rel, abs, size: statSync(abs).size } : null;
    })
    .find(Boolean);

  if (!found) {
    problems.push(`[清单→文件] 「${entry.assetKey}」（${entry.source}）在 assets/ 下找不到文件（${entry.assetKey}.<${IMAGE_EXTENSIONS.join("|")}>）；缺文件不得入包`);
    continue;
  }
  if (found.size <= 0) {
    problems.push(`[清单→文件] 「${entry.assetKey}」文件为空（0 字节）: assets/${found.rel}`);
    continue;
  }
  totalBytes += found.size;
  const repoRel = path.posix.join(gameArgRel, found.rel.split(path.sep).join("/"));

  if (entry.source === "generated") {
    const row = ledgerRowsByAssetKey.get(entry.assetKey);
    if (!ledger.exists) {
      problems.push(`[台账→文件] 台账文件缺失：${gameArgRel}/asset-ledger.md —— generated 资产必须逐条登记（assetKey | repoPath | prompt | provider | license | bytes | size | generatedAt | runId | status）`);
    } else if (ledger.rows.length === 0) {
      // 只报一次（表存在但零行 = 全部 generated 资产都没登记，逐资产重复报同一句没有信息量）
      if (!ledgerEmptinessReported) {
        problems.push(`[台账→文件] 台账 v2 表存在但零行：${gameArgRel}/asset-ledger.md —— generated 资产必须逐条登记`);
        ledgerEmptinessReported = true;
      }
    } else if (!row) {
      problems.push(`[台账→文件] 「${entry.assetKey}」无台账行（generated 资产必须登记；重试覆写同一路径只更新原行）`);
    } else {
      for (const field of ["repoPath", "provider", "license", "size", "generatedAt", "runId"]) {
        if (!row[field]) problems.push(`[台账→文件] 「${entry.assetKey}」台账缺字段 ${field}`);
      }
      if (row.repoPath && row.repoPath !== repoRel) {
        problems.push(`[台账→文件] 「${entry.assetKey}」台账 repoPath「${row.repoPath}」与仓库实际「${repoRel}」不一致`);
      }
      if (row.bytes && Number(row.bytes) !== found.size) {
        problems.push(`[台账→文件] 「${entry.assetKey}」台账 bytes=${row.bytes} 与实际 ${found.size} 不一致（重试覆写后必须更新台账原行）`);
      }
      if (row.status && !ASSET_LEDGER_STATUS.has(row.status)) {
        problems.push(`[台账→文件] 「${entry.assetKey}」台账 status「${row.status}」不在 active/degraded/removed`);
      }
      // 许可红线（§4 无许可资产）：license 缺失不得入包
      if (row.status && !row.license) {
        problems.push(`[台账→文件] 「${entry.assetKey}」缺 license（无许可信息不得入包 —— 重生成或走策展兜底）`);
      }
    }

    // S8 firstColorCount（PNG only；解码不了 → NOTE 跳过，不冒充通过也不误报）
    if (found.rel.toLowerCase().endsWith(".png")) {
      try {
        const { width, height, rgba } = decodePng(readFileSync(found.abs));
        const palette = paletteFromStyleCard(styleCardText);
        if (palette.length === 0) {
          notes.push(`「${entry.assetKey}」firstColorCount 跳过：风格卡解析不到 palette HEX`);
        } else {
          const count = firstColorCount(rgba, width, height, palette);
          styleSamples.push({ assetKey: entry.assetKey, firstColorCount: count, samples: FIRST_COLOR_SAMPLE_GRID * FIRST_COLOR_SAMPLE_GRID });
          if (count !== null && (firstColorMin === null || count < firstColorMin)) firstColorMin = count;
        }
      } catch (e) {
        notes.push(`「${entry.assetKey}」firstColorCount 跳过：PNG 解析失败（${e instanceof PngError ? e.message : String(e)}）`);
      }
    }
  }

  // S5 清单→运行时引用
  if (entry.source === "generated" || entry.source === "curated") {
    const where = isReferenced(entry.assetKey, path.posix.join("assets", found.rel.split(path.sep).join("/")), referenceFiles);
    if (!where) {
      problems.push(`[清单→运行时引用] 「${entry.assetKey}」零引用 —— 扫描了 .gd/.tscn/.tres/.scn/.gdshader/.cs/.cfg（${referenceFiles.length} 个文件），未命中资产路径或 assetKey；动态拼接引用需人工确认并在清单备注`);
    }
  }
}

// S4 文件→清单（反向核对：扩展名白名单 + 引擎自有目录/项目豁免）
const manifestKeys = new Set(assets.map((a) => a.assetKey));
for (const f of imageFiles) {
  if (isExemptAssetFile(f.rel)) continue;
  const base = path.basename(f.rel, path.extname(f.rel));
  if (!manifestKeys.has(base)) {
    problems.push(`[文件→清单] assets/${f.rel.split(path.sep).join("/")} 未被清单覆盖 —— 禁止绕过清单直接塞资产（模板/引擎自有文件放 .myrd/asset-exemptions.json 豁免）`);
  }
}

// S7 预算（维度固化、数值待定标；超限必须显式降级）
const packableCount = assets.filter((a) => a.source === "generated" || a.source === "curated").length;
if (budget.maxImages > 0 && packableCount > budget.maxImages) {
  if (!budget.degraded) {
    problems.push(`[预算] 入包资产 ${packableCount} 张超 maxImages=${budget.maxImages} 且未显式降级（degraded=true + degradeReason）—— 禁止静默裁剪`);
  }
}
if (budget.maxTotalBytes > 0 && totalBytes > budget.maxTotalBytes && !budget.degraded) {
  problems.push(`[预算] 资产总字节 ${totalBytes} 超 maxTotalBytes=${budget.maxTotalBytes} 且未显式降级（degraded=true + degradeReason）`);
}

// S8 run 级 firstColorCount（短板口径：generated 资产最小值）
if (styleSamples.length > 0 && firstColorMin !== null && firstColorMin < FIRST_COLOR_MIN_HITS) {
  const worst = [...styleSamples].sort((a, b) => a.firstColorCount - b.firstColorCount)[0];
  problems.push(`[firstColorCount] 「${worst.assetKey}」firstColorCount=${worst.firstColorCount} < ${FIRST_COLOR_MIN_HITS}（口径：10×10 网格采样 100 像素与风格卡 palette 最近邻距离 ≤60；run 级取 generated 最小值）—— 生成结果偏离风格卡配色，重生成或修 prompt`);
}

// ---- 汇总（明细统一由 finish 输出） ----
if (problems.length > 0) finish("FAIL", 1);
if (styleSamples.length > 0) {
  console.log(`asset-triple-check: firstColorCount run 级最小值 = ${firstColorMin}（阈值 ${FIRST_COLOR_MIN_HITS}，逐资产: ${styleSamples.map((s) => `${s.assetKey}=${s.firstColorCount}`).join(", ")}）`);
}
console.log(`asset-triple-check: 清单 ${assets.length} 项（generated ${generatedCount} / 入包 ${packableCount}），仓库文件 ${imageFiles.length} 张（豁免 ${imageFiles.filter((f) => isExemptAssetFile(f.rel)).length}），台账行 ${ledger.rows.length}，引用扫描文件 ${referenceFiles.length}`);
finish("PASS", 0);
