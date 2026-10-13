#!/usr/bin/env node
// asset-gate.mjs — 资产门禁：游戏工程里用的每一张位图资产都必须**可溯源**。
// 两件事：
//   1. 库完整性：assets/cc0/ 下所有文件都在 tags.json 登记、PNG 魔数正确、非库内文件不许出现；
//   2. 工程侧溯源：游戏 assets/ 目录（--game <dir>）里每个位图/字体文件，要么 sha256 命中
//      库 manifest（CC0 拷贝），要么在 .myrd/compliance/checklist.json 里给了许可证据
//      （platform-compliance 同口径）——防「来源不明的图直接进游戏」。
//
// 用法：
//   node asset-gate.mjs                # 校验库本身
//   node asset-gate.mjs --game <dir>   # 追加校验某游戏工程的资产溯源
// 退出码：0 = ASSET_GATE: PASS；1 = 有违规（清单见输出）；2 = 环境/用法错误。

import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LIB = path.resolve(HERE, "..", "assets", "cc0");

const args = process.argv.slice(2);
const gameDir = args.includes("--game") ? path.resolve(args[args.indexOf("--game") + 1]) : null;

const sha256 = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
const isPng = (p) => { try { return readFileSync(p).readUInt32BE(0) === 0x89504e47; } catch { return false; } };
const isTtf = (p) => { try { return readFileSync(p).readUInt32BE(0) === 0x00010000; } catch { return false; } };

const problems = [];

// ── 1. 库完整性 ──
const tags = existsSync(path.join(LIB, "tags.json"))
  ? JSON.parse(readFileSync(path.join(LIB, "tags.json"), "utf-8")) : null;
if (!tags) { console.error("ASSET_GATE: FAIL(2) — 库未就位（tags.json 缺失）"); process.exit(2); }
const registered = new Set(tags.entries.map((e) => e.file));

const walk = (dir, base = "") => {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    const rel = base ? `${base}/${name}` : name;
    if (statSync(p).isDirectory()) out.push(...walk(p, rel));
    else out.push(rel);
  }
  return out;
};
const libraryHashes = new Map(); // sha256 → file（工程溯源用）
for (const rel of walk(LIB)) {
  const p = path.join(LIB, rel);
  if (rel === "tags.json" || rel === "LICENSES.md" || rel === "manifest.json") continue;
  if (!registered.has(rel)) problems.push(`库内未登记文件：${rel}（在 tags.json 补条目或在 LICENSES.md 说明后删除）`);
  if (rel.endsWith(".png") && !isPng(p)) problems.push(`PNG 魔数错误：${rel}`);
  if (rel.endsWith(".ttf") && !isTtf(p)) problems.push(`TTF 魔数错误：${rel}`);
  if (statSync(p).size > 2 * 1024 * 1024) problems.push(`单文件超 2MB：${rel}（${statSync(p).size}B）——512×512 粒子不应这么大，检查是否拷错`);
  libraryHashes.set(sha256(p), rel);
}
for (const e of tags.entries) {
  if (!existsSync(path.join(LIB, e.file))) problems.push(`字典登记但文件缺失：${e.file}`);
}

// ── 2. 工程资产溯源（--game）──
if (gameDir) {
  const assetsDir = path.join(gameDir, "assets");
  if (existsSync(assetsDir)) {
    const checklistPath = path.join(gameDir, ".myrd", "compliance", "checklist.json");
    let customLicensed = new Set();
    if (existsSync(checklistPath)) {
      try {
        const cl = JSON.parse(readFileSync(checklistPath, "utf-8"));
        // platform-compliance 口径：数组项 {id, evidence|done} —— 凡 evidence 指到 assets/ 下文件的视为已给许可证据
        for (const item of cl.items ?? cl ?? []) {
          const ev = String(item?.evidence ?? "");
          const m = ev.match(/assets\/[\w./-]+\.(?:png|jpg|ttf|wav|ogg)/i);
          if (m) customLicensed.add(m[0].replace(/^.*assets\//, ""));
        }
      } catch { /* 坏清单交给 platform-compliance 报，这里不重复 */ }
    }
    for (const rel of walk(assetsDir)) {
      if (!/\.(png|jpg|ttf)$/i.test(rel)) continue;
      const p = path.join(assetsDir, rel);
      const h = sha256(p);
      if (libraryHashes.has(h)) continue; // CC0 库拷贝，天然合规
      if (customLicensed.has(rel)) continue; // 自备资产，已在合规清单给证据
      problems.push(`工程资产不可溯源：assets/${rel}（非 CC0 库拷贝，且合规清单未给许可证据）`);
    }
  }
}

if (problems.length > 0) {
  console.error(`ASSET_GATE: FAIL —— ${problems.length} 项违规`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(`ASSET_GATE: PASS —— 库 ${registered.size} 项登记一致${gameDir ? `，工程资产 ${gameDir} 全部可溯源` : ""}`);
process.exit(0);
