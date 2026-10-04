#!/usr/bin/env node
/**
 * 基准四联图生成器（T3 美术线 · r4 · N2，风格卡 A1「霓虹夜塔」v1.0 §3 四面板）— 复现：
 *   node games/stack-tower/tools/gen-neon-reference.mjs
 *
 * 产物：assets/reference/neon-night-quad-v1.png（2×2 拼图）+ 同名 .manifest.json（sha256 + 面板规格）
 * 真源：src/render/theme.ts（NEON/LIGHT）；构图规格 = docs/style-card-neon-night-v1.md §3；
 * 塔块摆位取自内核同源公式（buildOpeningStack 语义：3–5 块 seeded，基准图固定 4 块演示摆位）。
 */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Raster, encodePng, hexToRgb, shadeRgb } from './pnglib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets', 'reference');
mkdirSync(OUT, { recursive: true });

const THEME = readFileSync(join(ROOT, 'src', 'render', 'theme.ts'), 'utf8');
const pickColor = (name) => {
  const m = new RegExp(`${name}:\\s*'(#[0-9a-fA-F]{6})'`).exec(THEME);
  if (!m) {
    console.error(`FAIL theme.ts 缺少 ${name}`);
    process.exit(1);
  }
  return m[1];
};
const NEON = Object.fromEntries(
  ['NIGHT_SKY_TOP', 'NIGHT_SKY_BOTTOM', 'CUT_FACE', 'RIPPLE_RING', 'PERFECT_GLOW', 'UI_BTN_PRIMARY', 'UI_ICON_SOUND', 'HORIZON', 'DEBRIS'].map((k) => [
    k,
    pickColor(k),
  ]),
);
NEON.BLOCK = [1, 2, 3, 4, 5, 6].map((i) => pickColor(`BLOCK_NEON_0${i}`));

const W = 240; // 单面板宽（480 逻辑宽一半，保持 2:3 比例 → 高 360）
const H = 360;
const BLOCK_H = 14; // 面板内块高（28 逻辑高一半）
const HORIZON_Y = Math.round(H * 0.72);

/** 夜空背景（P1–P4 共用；a08 同源画法） */
function sky(r) {
  const top = hexToRgb(NEON.NIGHT_SKY_TOP);
  const bot = hexToRgb(NEON.NIGHT_SKY_BOTTOM);
  for (let y = 0; y < H; y++) {
    const t = y / (H - 1);
    r.fillRect(0, y, W, 1, [0, 1, 2].map((k) => Math.round(top[k] + (bot[k] - top[k]) * t)));
  }
  // 塔吊剪影 ×3（熄灭态；三道分布对齐 src/render/backdrop.ts L0：0.18/0.52/0.84）
  const sil = shadeRgb(hexToRgb(NEON.DEBRIS), 1.4);
  for (const [cx, h, arm] of [[W * 0.18, 90, 32], [W * 0.52, 108, 43], [W * 0.84, 76, 25]]) {
    for (let y = HORIZON_Y + 8; y > HORIZON_Y + 8 - h; y--) r.fillRect(Math.round(cx), y, 1, 1, sil, 90);
    r.fillRect(Math.round(cx) - Math.round(arm * 0.35), HORIZON_Y + 8 - h, Math.round(arm * 1.35), 1, sil, 90);
  }
  // 地平线
  for (let x = 0; x < W; x++) r.fillRect(x, HORIZON_Y, 1, 1, hexToRgb(NEON.HORIZON), 100);
}

/** 画一块（三面 100:88:76；yIndex0 = 底层） */
function block(r, x, yIndex, colorIdx, width = 54) {
  const rgb = hexToRgb(NEON.BLOCK[colorIdx % 6]);
  const y = H - (yIndex + 1) * BLOCK_H;
  const hi = Math.max(2, Math.round(BLOCK_H * 0.12));
  r.fillRect(x, y, width, hi, rgb);
  r.fillRect(x, y + hi, width, BLOCK_H - hi - 2, shadeRgb(rgb, 0.88));
  r.fillRect(x, y + BLOCK_H - 2, width, 2, shadeRgb(rgb, 0.76));
  return y;
}

const UI_PANEL = pickColor('UI_PANEL_HUD');

function panelBase() {
  const r = new Raster(W, H);
  sky(r);
  // HUD 衬底
  r.fillRect(0, 0, W, 24, hexToRgb(UI_PANEL), Math.round(255 * 0.72));
  // HUD 白字占位（分数/连击/目标）
  for (const [x, len] of [[8, 26], [70, 20], [W - 40, 30]]) r.fillRect(x, 8, len, 6, hexToRgb(NEON.CUT_FACE), 220);
  return r;
}

function drawMoving(r, x, yIndex, colorIdx) {
  const y = H - (yIndex + 1) * BLOCK_H;
  block(r, x, yIndex, colorIdx);
  // 引导虚线（首局）
  for (let yy = y + BLOCK_H + 4; yy < H - BLOCK_H * 1; yy += 8) r.fillRect(x + Math.round(54 / 2), yy, 2, 4, hexToRgb(NEON.CUT_FACE), 70);
}

// —— P1 开局首屏：塔基 + 初始摆位 4 块（e09 演示摆位）+ 摆动块 ——
const p1 = panelBase();
block(p1, W / 2 - 30, 0, 0, 60); // 塔基（120 逻辑宽 → 60）
for (let i = 1; i <= 4; i++) block(p1, W / 2 - 27 + (i % 2 ? 2 : -2), i, i);
drawMoving(p1, W / 2 - 18, 6, 5);

// —— P2 游戏中：叠至 11 层 ——
const p2 = panelBase();
block(p2, W / 2 - 30, 0, 0, 60);
for (let i = 1; i <= 10; i++) {
  const w = Math.max(18, 60 - i * 4);
  block(p2, W / 2 - w / 2 + ((i * 7) % 9) - 4, i, i, w);
}
drawMoving(p2, W / 2 - 12, 12, 3);

// —— P3 perfect 时刻：涟漪环（additive 叠加两圈）+ 切面高亮 + 完美辉光 ——
const p3 = panelBase();
block(p3, W / 2 - 30, 0, 0, 60);
for (let i = 1; i <= 5; i++) block(p3, W / 2 - 28 + ((i * 5) % 7) - 3, i, i, 56);
const topY3 = H - 7 * BLOCK_H;
const cx = Math.round(W / 2);
const cy = topY3 - BLOCK_H / 2;
for (const [rw, rh, a] of [[70, 20, 110], [46, 13, 160]]) {
  for (let y = -rh; y <= rh; y++) {
    for (let x = -rw; x <= rw; x++) {
      const d = Math.sqrt((x / rw) ** 2 + (y / rh) ** 2);
      if (d >= 0.82 && d <= 1.0) p3.blend(cx + x, cy + y, hexToRgb(NEON.RIPPLE_RING), Math.round(a * (1 - d) / 0.18 * 0.18 + a));
    }
  }
}
// 切面高亮（塔顶层上缘白光带）+ 完美辉光（径向）
for (let x = -28; x <= 28; x++) {
  const t = 1 - Math.abs(x) / 28;
  p3.blend(cx + x, topY3, hexToRgb(NEON.CUT_FACE), Math.round(120 + 135 * t));
}
{
  const g = hexToRgb(NEON.PERFECT_GLOW);
  for (let y = -14; y <= 14; y++) {
    for (let x = -14; x <= 14; x++) {
      const d = Math.sqrt(x * x + y * y) / 14;
      p3.blend(cx + x, cy + y, g, Math.round(200 * Math.max(0, 1 - d) ** 2));
    }
  }
}

// —— P4 失败与重开：坠落块（熄灭态）+ 重开按钮高亮 ——
const p4 = panelBase();
block(p4, W / 2 - 30, 0, 0, 60);
for (let i = 1; i <= 4; i++) block(p4, W / 2 - 27, i, i, 54);
// 坠落碎块：偏离塔身、倾斜姿态（熄灭态）
{
  const debris = hexToRgb(NEON.DEBRIS);
  for (let i = 0; i < 14; i++) p4.fillRect(W / 2 + 24 + i, H - 3 * BLOCK_H + Math.round(i * 0.6), 3, 3, shadeRgb(debris, 1.2), 220);
}
// 重开按钮（a18 同源：霓虹边圆角 + 半透明底）
{
  const bw = 84;
  const bh = 26;
  const bx = Math.round((W - bw) / 2);
  const by = H - bh - 10;
  const btn = hexToRgb(NEON.UI_BTN_PRIMARY);
  const panel = hexToRgb(UI_PANEL);
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const dx = Math.min(x, bw - 1 - x);
      const dy = Math.min(y, bh - 1 - y);
      const inCorner = dx < 6 && dy < 6;
      const d = inCorner ? Math.sqrt((6 - dx) ** 2 + (6 - dy) ** 2) : 0;
      if (inCorner && d > 6) continue;
      const onEdge = dx < 2 || dy < 2 || (inCorner && 6 - d < 2);
      p4.blend(bx + x, by + y, onEdge ? btn : panel, onEdge ? 235 : Math.round(255 * 0.72));
    }
  }
  for (let i = 0; i < 34; i++) p4.fillRect(bx + Math.round((bw - 34) / 2) + i, by + Math.round(bh / 2) - 2, 1, 4, hexToRgb(NEON.CUT_FACE), 230);
}

// ---------- 拼四联（2×2，面板间隔 4px 夜色分隔） ----------
const GAP = 4;
const quad = new Raster(W * 2 + GAP, H * 2 + GAP);
quad.fillRect(0, 0, quad.width, quad.height, hexToRgb(NEON.NIGHT_SKY_TOP));
const blit = (src, ox, oy) => {
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const i = (y * src.width + x) * 4;
      if (src.data[i + 3] > 0) quad.blend(ox + x, oy + y, [src.data[i], src.data[i + 1], src.data[i + 2]], src.data[i + 3]);
    }
  }
};
blit(p1, 0, 0);
blit(p2, W + GAP, 0);
blit(p3, 0, H + GAP);
blit(p4, W + GAP, H + GAP);

const png = encodePng(quad);
const sha256 = createHash('sha256').update(png).digest('hex');
writeFileSync(join(OUT, 'neon-night-quad-v1.png'), png);
const manifest = {
  asset: 'neon-night-quad-v1.png',
  styleCard: 'docs/style-card-neon-night-v1.md (v1.0 frozen 2026-09-27)',
  panels: ['P1 开局首屏（e09 初始摆位）', 'P2 游戏中（六色循环）', 'P3 perfect 时刻（additive 涟漪+辉光）', 'P4 失败与重开'],
  size: { width: quad.width, height: quad.height },
  sha256,
  generator: 'tools/gen-neon-reference.mjs',
  source: 'generated',
};
writeFileSync(join(OUT, 'neon-night-quad-v1.manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`[gen] 基准四联图 → assets/reference/neon-night-quad-v1.png  ${quad.width}x${quad.height}  sha256=${sha256.slice(0, 16)}…`);
