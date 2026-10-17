#!/usr/bin/env node
// style-sketch.mjs — 风格方向稿确定性生成器（B4 · 风格卡 v1 token 单源驱动）
// 输入：src/render/theme.ts 的 PALETTE/SCALE 口径（此处常量镜像，实现轮改为 import 单源）
// 输出：assets/style-sketch/direction-{1,2,3}.svg（重跑逐字节一致——deterministic-asset-pipeline 判例）
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "assets/style-sketch");
mkdirSync(OUT, { recursive: true });

// token（与 src/render/theme.ts 逐值镜像；漂移由 ac-art-3 扫描拦截）
const P = {
  bgDeep: "#202A38", field: "#2F4156", pathSand: "#E9D8A6", gridLine: "#47617C",
  coreCoral: "#E76F51", enemyBerry: "#B75D69", turretGreen: "#81B29A", textCream: "#F4F1DE",
};
const CELL = 32, COLS = 20, ROWS = 12, W = COLS * CELL, H = ROWS * CELL;

function mix(hexA, hexB, t) {
  const a = [1, 3, 5].map((i) => parseInt(hexA.slice(i, i + 2), 16));
  const b = [1, 3, 5].map((i) => parseInt(hexB.slice(i, i + 2), 16));
  return "#" + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, "0")).join("");
}
// 确定性路径（mulberry32 同族；固定 seed → 逐字节一致）
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const PATH_ROW = 6; // 路径横穿第 6 行

function scene(seed, turretMixT, label) {
  const r = rng(seed);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H + 40}" viewBox="0 0 ${W} ${H + 40}">\n`;
  s += `<rect width="${W}" height="${H + 40}" fill="${P.bgDeep}"/>\n<rect y="0" width="${W}" height="${H}" fill="${P.field}"/>\n`;
  for (let c = 0; c <= COLS; c++) s += `<line x1="${c * CELL}" y1="0" x2="${c * CELL}" y2="${H}" stroke="${P.gridLine}" stroke-width="1"/>\n`;
  for (let row = 0; row <= ROWS; row++) s += `<line x1="0" y1="${row * CELL}" x2="${W}" y2="${row * CELL}" stroke="${P.gridLine}" stroke-width="1"/>\n`;
  // 敌军路径（第 6 行横穿 + 路径箭头虚线）
  s += `<rect y="${PATH_ROW * CELL}" width="${W}" height="${CELL}" fill="${P.pathSand}"/>\n`;
  s += `<line x1="0" y1="${PATH_ROW * CELL + CELL / 2}" x2="${W}" y2="${PATH_ROW * CELL + CELL / 2}" stroke="${P.bgDeep}" stroke-width="4" stroke-dasharray="10 8" opacity="0.6"/>\n`;
  // 敌军 3 型（编成确定性摆位）
  const kinds = [["grunt", 16, 1.0], ["runner", 14, 1.6], ["brute", 20, 0.7]];
  kinds.forEach(([k, size], i) => {
    const x = 120 + i * 180 + Math.floor(r() * 40), y = PATH_ROW * CELL + CELL / 2;
    s += `<rect x="${x - size / 2}" y="${y - size / 2}" width="${size}" height="${size}" rx="3" fill="${P.enemyBerry}" stroke="${P.bgDeep}" stroke-width="2"/>\n`;
  });
  // 炮塔 3 阶（混合派生色）+ 射程圈
  for (let i = 0; i < 3; i++) {
    const cx = 240 + i * 224, cy = (PATH_ROW - 2) * CELL + CELL / 2, size = 24 + i * 2;
    const tcol = mix(P.turretGreen, P.textCream, turretMixT[i]);
    s += `<circle cx="${cx}" cy="${cy}" r="56" fill="none" stroke="${P.textCream}" stroke-width="2" stroke-dasharray="6 6" opacity="0.5"/>\n`;
    s += `<rect x="${cx - size / 2}" y="${cy - size / 2}" width="${size}" height="${size}" rx="4" fill="${tcol}" stroke="${P.bgDeep}" stroke-width="2"/>\n`;
    s += `<circle cx="${cx}" cy="${cy}" r="4" fill="${P.textCream}"/>\n`;
  }
  // 核心 2×2
  s += `<rect x="${W - 3 * CELL}" y="${(PATH_ROW - 1) * CELL}" width="${2 * CELL}" height="${2 * CELL}" rx="4" fill="${P.coreCoral}" stroke="${P.bgDeep}" stroke-width="2"/>\n`;
  // HUD 条（文案逐字来自 spec.world.firstScreenCopy）
  s += `<rect y="${H}" width="${W}" height="40" fill="${P.bgDeep}"/>\n`;
  s += `<text x="16" y="${H + 26}" font-family="sans-serif" font-size="16" fill="${P.textCream}">核心 10 · 军费 120 · 波次 1/8</text>\n`;
  s += `<text x="${W - 16}" y="${H + 26}" text-anchor="end" font-family="sans-serif" font-size="16" fill="${P.textCream}">${label}</text>\n`;
  s += `</svg>\n`;
  return s;
}

const dirs = [
  [1, 20261016, [0, 0.2, 0.4], "方向1 · 治愈绿阶（基线）"],
  [2, 20261017, [0.1, 0.3, 0.5], "方向2 · 亮阶轻快"],
  [3, 20261018, [0, 0.15, 0.35], "方向3 · 沉稳原阶"],
];
for (const [n, seed, mixT, label] of dirs) {
  const f = join(OUT, `direction-${n}.svg`);
  writeFileSync(f, scene(seed, mixT, label));
  console.log(`SKETCH ${f} sha256前8=${createHash("sha256").update(readFileSync(f)).digest("hex").slice(0, 8)}`);
}
console.log("SKETCH PASS 3 张方向稿生成（确定性：同输入重跑逐字节一致）");
