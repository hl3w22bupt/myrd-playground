#!/usr/bin/env node
// style-sketch-audit.mjs — 方向稿独立审计（美术线自检，ac-art-1/2/3 转真前的等价口径预演）
// 独立性声明：色值白名单读 approved spec 导出件、派生色在本文件独立重算、hash 对文件字节实算——
// 不读生成器源码常量、不与生成器 stdout 互证（deterministic-asset-regen-zero-drift 判例）。
// 零 hex 字面量（ac-art-1 src+tools 扫描面自律）。
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = join(ROOT, "..", "..");
const failures = [];
const ok = (m) => console.log(`  PASS ${m}`);
const bad = (m) => { failures.push(m); console.log(`  FAIL ${m}`); };

// —— 1. 权威输入：approved spec（导出件）——
const spec = JSON.parse(readFileSync(join(REPO, ".myrd/spec/line3-tower-defense/design-spec.json"), "utf8")).spec;
const wl = spec.numeric.palette.whitelist;
const WL = new Map(Object.entries(wl).map(([k, v]) => [k, v.toUpperCase()]));
if (WL.size !== 8) bad(`白名单应为 8 色，实为 ${WL.size}`);

// —— 2. 派生色独立重算（混合函数独立实现，与生成器无共享代码）——
function mix(a, b, t) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return "#" + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, "0")).join("").toUpperCase();
}
const turretBase = WL.get("turret-green"), cream = WL.get("text-cream");

// —— 3. manifest hash 逐件实算对拍 ——
const manifest = JSON.parse(readFileSync(join(ROOT, "assets/style-sketch/manifest.json"), "utf8"));
if (manifest.items.length !== 3) bad(`方向稿应为 3 件，实为 ${manifest.items.length}`);
for (const it of manifest.items) {
  const actual = createHash("sha256").update(readFileSync(join(ROOT, it.file))).digest("hex");
  if (actual !== it.sha256) bad(`${it.file} manifest sha256 漂移：manifest=${it.sha256.slice(0, 8)} 实算=${actual.slice(0, 8)}`);
}
if (failures.length === 0) ok(`manifest 3 件 sha256 实算全等`);

// —— 4. 逐张：色值白名单∪派生 / 无渐变滤镜 / 画布内 / 构成件尺寸 / 文案 ——
const TURRET_PX = [24, 26, 28], ENEMY_PX = [16, 14, 20], CORE_PX = 64;
const CANVAS_W = 640, CANVAS_H = 424;
for (const it of manifest.items) {
  const svg = readFileSync(join(ROOT, it.file), "utf8");
  const name = it.file.split("/").pop();
  console.log(`> ${name}（${it.label}）`);

  // 4a 色值：每个 hex ∈ 白名单 ∪ 本方向派生集
  const derived = new Set(it.turretMixT.map((t) => mix(turretBase, cream, t)));
  const hexes = [...svg.matchAll(/#[0-9A-Fa-f]{6}\b/g)].map((m) => m[0].toUpperCase());
  const wlValues = [...WL.values()];
  const illegal = [...new Set(hexes)].filter((h) => !wlValues.includes(h) && !derived.has(h));
  if (illegal.length > 0) bad(`色值违例：${illegal.join(",")}`);
  else ok(`色值全合法（白名单 ${[...new Set(hexes)].filter((h) => [...WL.values()].includes(h)).length} 色 + 派生 ${[...new Set(hexes)].filter((h) => derived.has(h)).length} 色）`);

  // 4b 光照②：禁渐变/滤镜/阴影模糊
  if (/<(linearGradient|radialGradient|filter|feGaussianBlur)/.test(svg)) bad("含渐变/滤镜（违反光照②禁令）");
  else ok("零渐变零滤镜（双层平涂口径）");

  // 4c 画布内：rect/circle 全元素坐标不出画（方向稿构图硬伤复检）
  let off = 0;
  for (const m of svg.matchAll(/<rect ([^/]*)\/>/g)) {
    const a = m[1], x = +/x="(-?\d+)"/.exec(a)?.[1], y = +/y="(-?\d+)"/.exec(a)?.[1] || 0,
      w = +/width="(\d+)"/.exec(a)?.[1], h = +/height="(\d+)"/.exec(a)?.[1];
    if (x < 0 || y < 0 || x + w > CANVAS_W || y + h > CANVAS_H) off++;
  }
  for (const m of svg.matchAll(/<circle ([^/]*)\/>/g)) {
    const a = m[1], cx = +/cx="(-?\d+)"/.exec(a)?.[1], cy = +/cy="(-?\d+)"/.exec(a)?.[1], r = +/r="(\d+)"/.exec(a)?.[1];
    if (cx - r < 0 || cy - r < 0 || cx + r > CANVAS_W || cy + r > CANVAS_H) off++;
  }
  if (off > 0) bad(`${off} 个元素出画`);
  else ok("全部元素画布内（640×424）");

  // 4d 构成件：炮塔三阶 24/26/28（fill=派生色）、敌军 16/14/20（fill=enemy-berry）、核心 64×64（fill=core-coral）
  const turretSizes = [], enemySizes = [];
  let core = false;
  for (const m of svg.matchAll(/<rect ([^>]*)\/>/g)) {
    const a = m[1], fill = /fill="(#[0-9A-Fa-f]{6})"/.exec(a)?.[1]?.toUpperCase(),
      w = +/width="(\d+)"/.exec(a)?.[1], h = +/height="(\d+)"/.exec(a)?.[1];
    if (!fill) continue;
    if (derived.has(fill)) turretSizes.push(w);
    if (fill === WL.get("enemy-berry")) enemySizes.push(w);
    if (fill === WL.get("core-coral") && w === CORE_PX && h === CORE_PX) core = true;
  }
  turretSizes.sort((a, b) => a - b); enemySizes.sort((a, b) => a - b);
  const TURRET_SORTED = [...TURRET_PX].sort((a, b) => a - b), ENEMY_SORTED = [...ENEMY_PX].sort((a, b) => a - b);
  if (JSON.stringify(turretSizes) !== JSON.stringify(TURRET_SORTED)) bad(`炮塔三阶尺寸异常：${turretSizes}`);
  else ok(`炮塔三阶 ${TURRET_SORTED.join("/")} 在位`);
  if (JSON.stringify(enemySizes) !== JSON.stringify(ENEMY_SORTED)) bad(`敌军三型尺寸异常：${enemySizes}`);
  else ok(`敌军三型 ${ENEMY_SORTED.join("/")} 在位`);
  if (!core) bad("核心 2×2（64×64）缺失");
  else ok("核心 64×64 在位");

  // 4e 文案：HUD 标签逐字（firstScreenCopy）+ 样例值 ≡ numeric
  const hud = /核心 (\d+) · 军费 (\d+) · 波次 \d+\/(\d+)/.exec(svg);
  if (!hud) bad("HUD 文案缺失或格式漂移");
  else {
    const [, coreHp, gold, waves] = hud.map(Number);
    if (coreHp !== spec.numeric.coreLives) bad(`HUD 核心 ${coreHp} ≠ numeric.coreLives ${spec.numeric.coreLives}`);
    if (gold !== spec.numeric.economy.startGold) bad(`HUD 军费 ${gold} ≠ numeric.economy.startGold ${spec.numeric.economy.startGold}`);
    if (waves !== spec.numeric.victoryWaves) bad(`HUD 波次分母 ${waves} ≠ numeric.victoryWaves ${spec.numeric.victoryWaves}`);
    if (failures.length === 0 || failures.every((f) => !f.includes("HUD"))) ok(`HUD 样例值 ≡ numeric（核心 ${coreHp}/军费 ${gold}/波次 1/${waves}）`);
  }
}

// —— 5. 收口 ——
console.log(failures.length === 0 ? "\nSKETCH-AUDIT PASS（3 张方向稿：色值/光照/画布/构成/文案五面全过）" : `\nSKETCH-AUDIT FAIL（${failures.length} 项）`);
process.exit(failures.length === 0 ? 0 : 1);
