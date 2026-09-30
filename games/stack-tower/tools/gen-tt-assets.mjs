#!/usr/bin/env node
/**
 * C 平台素材生成器（抖音小游戏移植轮 · spec v1.5 content.platform dy-* 素材 id 5 项）。
 * 复现：node games/stack-tower/tools/gen-tt-assets.mjs
 *
 * 纪律（wx B0 判例 gen-wx-assets.mjs 同构 · 风格四要素零漂移，仅规格裁切）：
 *  - 全部素材从「霓虹夜塔」参考卡派生：色值唯一真源 = src/render/theme.ts NEON 表（解析取值，
 *    解析失败即失败，禁止私设色值）；构图 = 参考卡面板同构（开局首屏 / perfect 涟漪 / 竖屏对局）；
 *    零新编风格；无文字（抽象条代替文案，免字体依赖）；
 *  - 确定性：无随机数、无时间戳，重跑逐字节一致；逐件 manifest 记 sha256（N4 提审材料按 id 对照输入）；
 *  - 规格：dy-share-card 500×400（5:4）/ dy-store-screenshot-01..03 1242×2208（9:16）/
 *    dy-icon 512×512（1:1）——尺寸一律取自 approved spec items[].assets.size，生成器不自定规格；
 *  - optional 不产件：录屏分享（tt.getGameRecorder 系）与高光封面卡为能力级 optional，
 *    本生成器不产出对应素材（缺失不构成打回项，spec 口径原文③）。
 */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Raster, encodePng, hexToRgb, shadeRgb } from './pnglib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets', 'tt');
mkdirSync(OUT, { recursive: true });

// ---------- 规格唯一来源：approved spec items[].assets（id/size 逐项读取，生成器不自定规格） ----------
const SPEC = JSON.parse(readFileSync(join(ROOT, '../../.myrd/spec/stack-tower-spec.json'), 'utf8')).spec;
const specAssets = SPEC.content.platform.items.flatMap((i) => i.assets).filter((a) => a.id.startsWith('dy-'));
const specSize = (id) => {
  const a = specAssets.find((x) => x.id === id);
  if (!a) { console.error(`FAIL spec 缺素材 id ${id}（规格唯一来源被破坏）`); process.exit(1); }
  const [w, h] = String(a.size).split('x').map(Number);
  if (!(w > 0) || !(h > 0)) { console.error(`FAIL spec 素材 ${id} size 非法：${a.size}`); process.exit(1); }
  return { w, h };
};

// ---------- 色源：解析 theme.ts（NEON 表），禁止私设 ----------
const THEME = readFileSync(join(ROOT, 'src', 'render', 'theme.ts'), 'utf8');
const pickColor = (name) => {
  const m = new RegExp(`${name}:\\s*'(#[0-9a-fA-F]{6})'`).exec(THEME);
  if (!m) { console.error(`FAIL theme.ts 缺少 ${name}（真源被破坏，禁止生成器私设色值）`); process.exit(1); }
  return m[1];
};
const N = {
  SKY_TOP: pickColor('NIGHT_SKY_TOP'),
  SKY_BOTTOM: pickColor('NIGHT_SKY_BOTTOM'),
  BLOCK: [1, 2, 3, 4, 5, 6].map((i) => pickColor(`BLOCK_NEON_0${i}`)),
  CUT_FACE: pickColor('CUT_FACE'),
  RIPPLE: pickColor('RIPPLE_RING'),
  GLOW: pickColor('PERFECT_GLOW'),
  BTN: pickColor('UI_BTN_PRIMARY'),
  PANEL: pickColor('UI_PANEL_HUD'),
  ICON: pickColor('UI_ICON_SOUND'),
  HORIZON: pickColor('HORIZON'),
};
const PANEL_ALPHA = Math.round(Number((/UI_PANEL_HUD_ALPHA:\s*([0-9.]+)/.exec(THEME) ?? [])[1] ?? 0.72) * 255);

const manifest = {
  specSource: 'spec v1.5 content.platform items[].assets（dy 素材 id 5 项）',
  derivedFrom: '霓虹夜塔参考卡 v1.0（docs/style-card-neon-night-v1.md）· 色源 theme.ts NEON 表',
  generator: 'tools/gen-tt-assets.mjs（确定性，重跑逐字节一致；风格四要素零漂移，仅规格裁切）',
  items: [],
};

function emit(id, file, raster, spec) {
  const png = encodePng(raster);
  const p = join(OUT, file);
  writeFileSync(p, png);
  manifest.items.push({
    id, file, bytes: png.length,
    sha256: createHash('sha256').update(png).digest('hex'),
    size: `${raster.width}x${raster.height}`,
    ...spec,
  });
  console.log(`[ok  ] ${id}  ${raster.width}x${raster.height}  ${(png.length / 1024).toFixed(1)}KB`);
}

/** 夜空垂直单向渐变（a08 同构） */
function sky(w, h) {
  const r = new Raster(w, h);
  const top = hexToRgb(N.SKY_TOP);
  const bot = hexToRgb(N.SKY_BOTTOM);
  for (let y = 0; y < h; y++) {
    const t = y / (h - 1);
    r.fillRect(0, y, w, 1, top.map((v, i) => Math.round(v + (bot[i] - v) * t)), 255);
  }
  // 地平线（夜色线）
  r.fillRect(0, Math.round(h * 0.78), w, 2, hexToRgb(N.HORIZON), 255);
  return r;
}

/** 霓虹塔块（三面明度 1/0.88/0.76，切面高亮线，禁描边——发光填充形态） */
function block(r, x, y, w, h, colorIdx) {
  const rgb = hexToRgb(N.BLOCK[colorIdx % 6]);
  const hi = Math.round(h * 0.34);
  r.fillRect(x, y, w, hi, shadeRgb(rgb, 1.0), 255);
  r.fillRect(x, y + hi, w, h - hi - Math.round(h * 0.18), shadeRgb(rgb, 0.88), 255);
  r.fillRect(x, y + h - Math.round(h * 0.18), w, Math.round(h * 0.18), shadeRgb(rgb, 0.76), 255);
  r.fillRect(x, y, w, Math.max(1, Math.round(h * 0.08)), hexToRgb(N.CUT_FACE), 200);
}

/** 塔身：居中堆叠 + 顶部摆动块（参考卡面板一/三同构） */
function tower(r, cx, baseY, blocks, bw, bh) {
  for (let i = 0; i < blocks; i++) {
    const shrink = i * Math.round(bw * 0.02);
    block(r, cx - bw / 2 + (i % 2 ? shrink : -shrink / 2), baseY - (i + 1) * (bh + 2), bw - shrink, bh, i);
  }
  return baseY - blocks * (bh + 2);
}

/** 涟漪环（中心对称，alpha 随半径衰减——a16 同构） */
function ripple(r, cx, cy, radius, rings = 3) {
  for (let k = 0; k < rings; k++) {
    const rr = radius * (0.55 + k * 0.35);
    const alpha = Math.round(160 * (1 - k / rings));
    const steps = Math.max(90, Math.round(rr * 4));
    for (let s = 0; s < steps; s++) {
      const a = (s / steps) * Math.PI * 2;
      r.blend(Math.round(cx + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr), hexToRgb(N.RIPPLE), alpha);
    }
  }
}

/** HUD 抽象条（无文字：面板底 + 霓虹短条模拟信息行——参考卡 HUD 同构） */
function hudBars(r, x, y, w, rows) {
  r.fillRect(x, y, w, Math.round(rows * 22 + 16), hexToRgb(N.PANEL), PANEL_ALPHA);
  for (let i = 0; i < rows; i++) {
    r.fillRect(x + 10, y + 12 + i * 22, Math.round(w * (0.5 - i * 0.08)), 6, hexToRgb(i === rows - 1 ? N.BTN : N.ICON), 230);
  }
}

// 1) dy-share-card —— 会话分享卡（dy-share-loop 主判据配图）：开局首屏派生（参考卡面板一）
{
  const { w: W, h: H } = specSize('dy-share-card');
  const r = sky(W, H);
  const topY = tower(r, Math.round(W / 2), Math.round(H * 0.86), 7, 150, 26);
  block(r, Math.round(W / 2) - 75 + 18, topY - 30, 150, 26, 2); // 摆动块（偏置）
  ripple(r, Math.round(W / 2), Math.round(H * 0.86) - 60, 70, 2);
  hudBars(r, 14, 14, 128, 3);
  emit('dy-share-card', 'share-card.png', r, { use: '会话分享卡（dy-share-loop 主判据配图）', ratio: '5:4', panel: '参考卡面板一·开局首屏' });
}
// 2-4) dy-store-screenshot-01..03 —— 商店截图（提审材料，不入包）
{
  const { w: W, h: H } = specSize('dy-store-screenshot-01');
  // 01 开局首屏（参考卡面板一派生）
  {
    const r = sky(W, H);
    tower(r, Math.round(W / 2), Math.round(H * 0.86), 8, 420, 66);
    hudBars(r, 40, 60, 420, 4);
    r.fillRect(60, H - 260, W - 120, 120, hexToRgb(N.PANEL), PANEL_ALPHA);
    r.fillRect(84, H - 236, 300, 16, hexToRgb(N.BTN), 235);
    emit('dy-store-screenshot-01', 'store-screenshot-01.png', r, { use: '商店截图一：开局首屏', ratio: '9:16', panel: '参考卡面板一' });
  }
  // 02 perfect 涟漪时刻（参考卡面板三派生）
  {
    const r = sky(W, H);
    const topY = tower(r, Math.round(W / 2), Math.round(H * 0.86), 10, 400, 62);
    ripple(r, Math.round(W / 2), topY - 20, 320, 5);
    r.fillRect(Math.round(W / 2) - 210, topY - 130, 420, 62, hexToRgb(N.GLOW), 90);
    emit('dy-store-screenshot-02', 'store-screenshot-02.png', r, { use: '商店截图二：perfect 涟漪时刻', ratio: '9:16', panel: '参考卡面板三·perfect' });
  }
  // 03 竖屏对局构图（安全区内：刘海/手势条避让框可见，参考卡派生）
  {
    const r = sky(W, H);
    const safeTop = 132, safeBottom = 96, side = 60; // 1242×2208 典型竖屏安全区（表现层布局输入）
    r.fillRect(side, safeTop, W - side * 2, H - safeTop - safeBottom, hexToRgb(N.PANEL), 26); // 安全区参考框（仅构图示意）
    tower(r, Math.round(W / 2), Math.round((H - safeBottom) * 0.88), 9, 380, 60);
    hudBars(r, side + 24, safeTop + 24, 400, 4);
    ripple(r, Math.round(W / 2), Math.round((H - safeBottom) * 0.88) - 260, 240, 3);
    emit('dy-store-screenshot-03', 'store-screenshot-03.png', r, { use: '商店截图三：竖屏对局构图（安全区内）', ratio: '9:16', panel: '参考卡派生·安全区' });
  }
}
// 5) dy-icon —— 应用图标：塔块霓虹剪影（参考卡派生，禁新编风格）
{
  const S = specSize('dy-icon').w;
  const r = new Raster(S, S);
  const top = hexToRgb(N.SKY_TOP);
  const bot = hexToRgb(N.SKY_BOTTOM);
  for (let y = 0; y < S; y++) {
    const t = y / (S - 1);
    r.fillRect(0, y, S, 1, top.map((v, k) => Math.round(v + (bot[k] - v) * t)), 255);
  }
  const bw = Math.round(S * 0.6), bh = Math.round(S * 0.15);
  for (let i = 0; i < 3; i++) block(r, Math.round((S - bw) / 2) + (i % 2 ? 5 : -5), S - Math.round(S * 0.2) - (i + 1) * (bh + 3), bw, bh, i);
  ripple(r, S / 2, S - Math.round(S * 0.55), Math.round(S * 0.22), 2);
  emit('dy-icon', 'icon.png', r, { use: '应用图标（塔块霓虹剪影）', ratio: '1:1', panel: '参考卡块皮同源' });
}

manifest.items.sort((a, b) => a.id.localeCompare(b.id));
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`[out ] ${OUT}/manifest.json（${manifest.items.length} 件，逐件 sha256）`);
console.log('[done] dy 素材 5 项生成完成（NEON 派生 · 风格四要素零漂移 · 仅规格裁切 · 确定性可复现）');
console.log('[opt ] 录屏分享（tt.getGameRecorder 系）+ 高光封面卡 = 能力级 optional，本生成器不产件（spec 口径原文③）');
