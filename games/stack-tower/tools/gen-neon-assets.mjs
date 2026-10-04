#!/usr/bin/env node
/**
 * 霓虹夜塔 P0 资产生成器（T3 美术线 · r4 · N3）— 复现：
 *   node games/stack-tower/tools/gen-neon-assets.mjs
 *
 * 纪律：
 *  - 色值唯一真源 = src/render/theme.ts（NEON 表；本脚本解析取值，解析失败即失败，禁止私设色值）；
 *  - 风格卡 A1「霓虹夜塔」v1.0（docs/style-card-neon-night-v1.md）为构图与光照真源；
 *  - spec v1.2 assets a08..a20 逐项对应（13 件）；逐件 manifest 记 sha256（acc-a8 查表输入）；
 *  - 查表判据：hex±5 / 禁描边 / 渐变方向二值 / 几何 ±10% 拒收（tests/assets-neon-check.mjs 执行）。
 */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Raster, encodePng, hexToRgb, shadeRgb } from './pnglib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets', 'neon');
mkdirSync(OUT, { recursive: true });

// ---------- 色源：解析 theme.ts（NEON 表 + LIGHT/JUICE/RIPPLE 参数），禁止私设 ----------
const THEME = readFileSync(join(ROOT, 'src', 'render', 'theme.ts'), 'utf8');
function pickColor(name) {
  const m = new RegExp(`${name}:\\s*'(#[0-9a-fA-F]{6})'`).exec(THEME);
  if (!m) {
    console.error(`FAIL theme.ts 缺少 ${name}（真源被破坏，禁止生成器私设色值）`);
    process.exit(1);
  }
  return m[1];
}
function pickNumber(name) {
  const m = new RegExp(`${name}:\\s*([0-9.]+)`).exec(THEME);
  if (!m) {
    console.error(`FAIL theme.ts 缺少数值 ${name}`);
    process.exit(1);
  }
  return Number(m[1]);
}

const N = {
  SKY_TOP: pickColor('NIGHT_SKY_TOP'),
  SKY_BOTTOM: pickColor('NIGHT_SKY_BOTTOM'),
  BLOCK: [1, 2, 3, 4, 5, 6].map((i) => pickColor(`BLOCK_NEON_0${i}`)),
  CUT_FACE: pickColor('CUT_FACE'),
  RIPPLE_RING: pickColor('RIPPLE_RING'),
  PERFECT_GLOW: pickColor('PERFECT_GLOW'),
  UI_BTN: pickColor('UI_BTN_PRIMARY'),
  UI_PANEL: pickColor('UI_PANEL_HUD'),
  UI_ICON: pickColor('UI_ICON_SOUND'),
  PANEL_ALPHA: pickNumber('UI_PANEL_HUD_ALPHA'),
};
const LIGHT_MID = Number((/MID:\s*([0-9.]+)/.exec(THEME) ?? [])[1] ?? 0.88);
const LIGHT_BOTTOM = Number((/BOTTOM:\s*([0-9.]+)/.exec(THEME) ?? [])[1] ?? 0.76);
if (LIGHT_MID !== 0.88 || LIGHT_BOTTOM !== 0.76) {
  console.error(`FAIL LIGHT 三面读数异常（${LIGHT_MID}/${LIGHT_BOTTOM}）——theme.ts 是唯一真源，先改卡再改 theme`);
  process.exit(1);
}

const manifest = { specRange: 'a08..a20 (v1.2 P0 13 项)', generatedBy: 'tools/gen-neon-assets.mjs', items: [] };
const jobs = [];

/** 落一件：文件 + manifest 条目（含 sha256 与期望值，查表输入） */
function emit(id, file, raster, expect) {
  const png = encodePng(raster);
  const sha256 = createHash('sha256').update(png).digest('hex');
  jobs.push({ file: join(OUT, file), png });
  manifest.items.push({ id, file: `assets/neon/${file}`, sha256, width: raster.width, height: raster.height, ...expect });
}

// —— a08 夜空垂直渐变底（200×360；垂直单向：列内自上而下 SKY_TOP→SKY_BOTTOM）——
{
  const W = 200;
  const H = 360;
  const r = new Raster(W, H);
  const top = hexToRgb(N.SKY_TOP);
  const bot = hexToRgb(N.SKY_BOTTOM);
  for (let y = 0; y < H; y++) {
    const t = y / (H - 1);
    const rgb = [0, 1, 2].map((k) => Math.round(top[k] + (bot[k] - top[k]) * t));
    r.fillRect(0, y, W, 1, rgb);
  }
  emit('a08-bg-night-gradient', 'bg-night-gradient.png', r, {
    kind: '背景层',
    expectedHex: { top: N.SKY_TOP, bottom: N.SKY_BOTTOM },
    gradient: 'vertical-one-way',
  });
}

// —— a09..a14 塔块皮 6 色（120×28 基准几何；三面 100:88:76；禁描边：边缘 1px 与主面同源色）——
N.BLOCK.forEach((hex, i) => {
  const W = 120;
  const H = 28;
  const r = new Raster(W, H);
  const rgb = hexToRgb(hex);
  const hi = Math.round(H * 0.12);
  r.fillRect(0, 0, W, hi, shadeRgb(rgb, 1.0));
  r.fillRect(0, hi, W, H - hi - Math.round(H * 0.18), shadeRgb(rgb, LIGHT_MID));
  r.fillRect(0, H - Math.round(H * 0.18), W, Math.round(H * 0.18), shadeRgb(rgb, LIGHT_BOTTOM));
  emit(`a${String(9 + i).padStart(2, '0')}-block-skin-base-${String(i + 1).padStart(2, '0')}`, `block-skin-base-${String(i + 1).padStart(2, '0')}.png`, r, {
    kind: '贴图',
    expectedHex: { core: hex },
    bands: { top: 1.0, mid: 0.88, bottom: 0.76 },
    geometry: { width: W, height: H },
    outlineFree: true,
  });
});

// —— a15 切面高亮（120×6 白色发光填充带，中心亮两翼衰减；禁描边）——
{
  const W = 120;
  const H = 6;
  const r = new Raster(W, H);
  const white = hexToRgb(N.CUT_FACE);
  for (let x = 0; x < W; x++) {
    const t = 1 - Math.abs(x - (W - 1) / 2) / ((W - 1) / 2); // 中心 1 → 两翼 0
    const a = Math.round(140 + 115 * t);
    r.fillRect(x, 0, 1, H, white, a);
  }
  emit('a15-fx-cut-face', 'fx-cut-face.png', r, { kind: 'fx', expectedHex: { core: N.CUT_FACE }, outlineFree: true, geometry: { width: W, height: H } });
}

// —— a16 塔身涟漪环（80×24 中心对称椭圆环，青霓虹；线宽向心衰减）——
{
  const W = 80;
  const H = 24;
  const r = new Raster(W, H);
  const cyan = hexToRgb(N.RIPPLE_RING);
  const cx = (W - 1) / 2;
  const cy = (H - 1) / 2;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (x - cx) / ((W - 1) / 2);
      const dy = (y - cy) / ((H - 1) / 2);
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d >= 0.72 && d <= 1.0) {
        const t = 1 - (d - 0.72) / 0.28;
        r.blend(x, y, cyan, Math.round(30 + 200 * t));
      }
    }
  }
  emit('a16-fx-ripple-ring', 'fx-ripple-ring.png', r, { kind: 'fx', expectedHex: { core: N.RIPPLE_RING }, symmetric: 'center', geometry: { width: W, height: H } });
}

// —— a17 完美命中辉光（64×64 径向衰减辉光，琥珀白心；additive 形态）——
{
  const S = 64;
  const r = new Raster(S, S);
  const glow = hexToRgb(N.PERFECT_GLOW);
  const c = (S - 1) / 2;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const d = Math.sqrt((x - c) ** 2 + (y - c) ** 2) / c;
      const a = Math.round(235 * Math.max(0, 1 - d) ** 2);
      r.blend(x, y, glow, a);
    }
  }
  emit('a17-fx-perfect-glow', 'fx-perfect-glow.png', r, { kind: 'fx', expectedHex: { core: N.PERFECT_GLOW }, composite: 'additive-shape', geometry: { width: S, height: S } });
}

// —— a18 主按钮（180×48 圆角矩形霓虹边 + 半透明夜底；圆角半径 10）——
{
  const W = 180;
  const H = 48;
  const R = 10;
  const r = new Raster(W, H);
  const btn = hexToRgb(N.UI_BTN);
  const panel = hexToRgb(N.UI_PANEL);
  const inside = (x, y) => {
    const dx = Math.min(x, W - 1 - x);
    const dy = Math.min(y, H - 1 - y);
    return dx >= 0 && dy >= 0 && (dx >= R || dy >= R || dx * dx + (R - dy) * (R - dy) <= 0 || dx * dx + dy * dy <= R * R);
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = Math.min(x, W - 1 - x);
      const dy = Math.min(y, H - 1 - y);
      const inCorner = dx < R && dy < R;
      const d = inCorner ? Math.sqrt((R - dx) ** 2 + (R - dy) ** 2) : 0;
      const within = !inCorner || d <= R;
      if (!within) continue;
      const onEdge = dx < 2 || dy < 2 || (inCorner && R - d < 2);
      if (onEdge) r.blend(x, y, btn, 235);
      else r.blend(x, y, panel, Math.round(255 * N.PANEL_ALPHA));
    }
  }
  emit('a18-ui-btn-primary', 'ui-btn-primary.png', r, { kind: 'ui', expectedHex: { border: N.UI_BTN, fill: N.UI_PANEL }, geometry: { width: W, height: H, cornerRadius: R, radiusTolerancePct: 10 } });
}

// —— a19 HUD 面板（240×64 半透明夜底；全幅均匀 alpha；禁描边）——
{
  const W = 240;
  const H = 64;
  const r = new Raster(W, H);
  r.fillRect(0, 0, W, H, hexToRgb(N.UI_PANEL), Math.round(255 * N.PANEL_ALPHA));
  emit('a19-ui-panel-hud', 'ui-panel-hud.png', r, { kind: 'ui', expectedHex: { core: N.UI_PANEL }, alpha: N.PANEL_ALPHA, outlineFree: true, geometry: { width: W, height: H } });
}

// —— a20 声音开关图标（36×36 喇叭几何：梯形腔体 + 双弧声波；几何 ±10% 查表）——
{
  const S = 36;
  const r = new Raster(S, S);
  const ic = hexToRgb(N.UI_ICON);
  // 腔体：矩形 6..14 × 13..23 + 三角锥 14..22 × 8..28（各顶点 ±10% 查表）
  r.fillRect(6, 13, 8, 10, ic);
  for (let x = 14; x <= 22; x++) {
    const t = (x - 14) / 8;
    const half = Math.round(2 + 8 * t);
    r.fillRect(x, 18 - half, 1, half * 2, ic);
  }
  // 双弧声波：x=26/30 两列弧段
  for (const [ax, a0, a1] of [[26, 12, 24], [30, 9, 27]]) {
    for (let y = a0; y <= a1; y++) {
      if (y >= 15 && y <= 21) continue; // 弧中段留白（读作弧线）
      r.fillRect(ax, y, 2, 1, ic);
    }
  }
  emit('a20-ui-icon-sound', 'ui-icon-sound.png', r, { kind: 'ui', expectedHex: { core: N.UI_ICON }, geometry: { width: S, height: S }, glyph: 'speaker-2-arc' });
}

// ---------- 落盘 + manifest ----------
for (const j of jobs) writeFileSync(j.file, j.png);
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`[gen] P0 资产 ${jobs.length} 件 + manifest.json → ${OUT.replace(ROOT + '/', '')}`);
for (const it of manifest.items) console.log(`  - ${it.id}  ${it.width}x${it.height}  ${it.sha256.slice(0, 12)}…`);
