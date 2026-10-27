#!/usr/bin/env node
/**
 * B0 平台素材生成器（T3 美术线 · 微信小游戏移植轮 · spec v1.3 content.platform 素材 id 定稿 7 项）。
 * 复现：node games/stack-tower/tools/gen-wx-assets.mjs
 *
 * 纪律（黑板 assets.md B0 段）：
 *  - 全部素材从「霓虹夜塔」参考卡派生：色值唯一真源 = src/render/theme.ts NEON 表（解析取值，
 *    解析失败即失败，禁止私设色值）；构图 = 参考卡四联图面板同构（开局首屏/perfect 涟漪/排行面板）；
 *    零新编风格；无文字（抽象条代替文案，免字体依赖）；
 *  - 确定性：无随机数，重跑逐字节一致；逐件 manifest 记 sha256（N4 提审材料按 id 对照输入）。
 */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Raster, encodePng, hexToRgb, shadeRgb } from './pnglib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets', 'wx');
mkdirSync(OUT, { recursive: true });

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
  specSource: 'spec v1.3 content.platform items[].assets（素材 id 一步定稿 7 项）',
  derivedFrom: '霓虹夜塔参考卡 v1.0（docs/style-card-neon-night-v1.md）· 色源 theme.ts NEON 表',
  generator: 'tools/gen-wx-assets.mjs（确定性，重跑逐字节一致）',
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

// 1) wx-share-card-5x4 —— 会话分享卡（主判据素材）：开局首屏派生（参考卡面板一）
{
  const W = 500, H = 400;
  const r = sky(W, H);
  const topY = tower(r, Math.round(W / 2), Math.round(H * 0.86), 7, 150, 26);
  block(r, Math.round(W / 2) - 75 + 18, topY - 30, 150, 26, 2); // 摆动块（偏置）
  ripple(r, Math.round(W / 2), Math.round(H * 0.86) - 60, 70, 2);
  hudBars(r, 14, 14, 128, 3);
  emit('wx-share-card-5x4', 'share-card-5x4.png', r, { use: '会话分享卡（主判据）', ratio: '5:4', panel: '参考卡面板一·开局首屏' });
}
// 2) wx-share-timeline-1x1 —— 朋友圈方图（附带项）：中心对称构图
{
  const W = 500, H = 500;
  const r = sky(W, H);
  const topY = tower(r, Math.round(W / 2), Math.round(H * 0.82), 9, 140, 24);
  ripple(r, Math.round(W / 2), topY + 10, 110, 4);
  r.fillRect(Math.round(W / 2) - 1, 0, 2, Math.round(H * 0.14), hexToRgb(N.RIPPLE), 120);
  emit('wx-share-timeline-1x1', 'share-timeline-1x1.png', r, { use: '朋友圈方图（附带项）', ratio: '1:1', panel: '参考卡面板三·perfect 中心对称' });
}
// 3-5) wx-store-screenshot-01..03 —— 商店截图（提审材料，不入包）
{
  const W = 1242, H = 2208;
  // 01 开局首屏
  {
    const r = sky(W, H);
    tower(r, Math.round(W / 2), Math.round(H * 0.86), 8, 420, 66);
    hudBars(r, 40, 60, 420, 4);
    r.fillRect(60, H - 260, W - 120, 120, hexToRgb(N.PANEL), PANEL_ALPHA);
    r.fillRect(84, H - 236, 300, 16, hexToRgb(N.BTN), 235);
    emit('wx-store-screenshot-01', 'store-screenshot-01.png', r, { use: '商店截图一', ratio: '9:16', panel: '参考卡面板一' });
  }
  // 02 perfect 涟漪时刻
  {
    const r = sky(W, H);
    const topY = tower(r, Math.round(W / 2), Math.round(H * 0.86), 10, 400, 62);
    ripple(r, Math.round(W / 2), topY - 20, 320, 5);
    r.fillRect(Math.round(W / 2) - 210, topY - 130, 420, 62, hexToRgb(N.GLOW), 90);
    emit('wx-store-screenshot-02', 'store-screenshot-02.png', r, { use: '商店截图二', ratio: '9:16', panel: '参考卡面板三·perfect' });
  }
  // 03 好友排行 UI（wx-friend-rank-ui 同构放大）
  {
    const r = sky(W, H);
    const pad = 120, pw = W - pad * 2, py = 360, ph = H - 720;
    r.fillRect(pad, py, pw, ph, hexToRgb(N.PANEL), PANEL_ALPHA);
    for (let i = 0; i < 8; i++) {
      const y = py + 120 + i * 150;
      r.beginPath?.();
      const c = hexToRgb(N.BLOCK[i % 6]);
      for (let dy = -28; dy <= 28; dy++) {
        const dx = Math.round(Math.sqrt(Math.max(0, 28 * 28 - dy * dy)));
        r.fillRect(pad + 90 - dx, y + dy, dx * 2, 1, c, 255);
      }
      r.fillRect(pad + 150, y - 14, 520, 12, hexToRgb(N.ICON), 225);
      r.fillRect(pad + 150, y + 14, 300, 12, hexToRgb(N.GLOW), 210);
      r.fillRect(pad + 60, y + 52, pw - 120, 2, hexToRgb(N.HORIZON), 160);
    }
    r.fillRect(pad + 60, py + 40, 640, 20, hexToRgb(N.BTN), 235);
    emit('wx-store-screenshot-03', 'store-screenshot-03.png', r, { use: '商店截图三', ratio: '9:16', panel: 'wx-friend-rank-ui 同构' });
  }
}
// 6) wx-friend-rank-ui —— 好友排行 UI（开放数据域渲染同构）
{
  const W = 460, H = 560;
  const r = sky(W, H);
  const pad = 26, pw = W - pad * 2, py = Math.round(H * 0.14), ph = H - py - pad;
  r.fillRect(pad, py, pw, ph, hexToRgb(N.PANEL), PANEL_ALPHA);
  r.fillRect(pad, py, pw, 2, hexToRgb(N.BTN), 255);
  r.fillRect(pad, py + ph - 2, pw, 2, hexToRgb(N.BTN), 255);
  r.fillRect(pad + 16, py + 18, 180, 10, hexToRgb(N.ICON), 235); // 标题条
  for (let i = 0; i < 6; i++) {
    const y = py + 56 + i * 78;
    const c = hexToRgb(N.BLOCK[i % 6]);
    for (let dy = -18; dy <= 18; dy++) {
      const dx = Math.round(Math.sqrt(Math.max(0, 18 * 18 - dy * dy)));
      r.fillRect(pad + 44 - dx, y + dy, dx * 2, 1, c, 255);
    }
    r.fillRect(pad + 80, y - 9, Math.round(pw * 0.42), 9, hexToRgb(N.ICON), 225);
    r.fillRect(pad + 80, y + 8, Math.round(pw * 0.26), 9, hexToRgb(N.GLOW), 210);
    r.fillRect(pad + 16, y + 34, pw - 32, 1, hexToRgb(N.HORIZON), 150);
  }
  emit('wx-friend-rank-ui', 'friend-rank-ui.png', r, { use: '好友排行 UI', ratio: '23:28', panel: '开放数据域渲染同构' });
}
// 7) wx-icon —— 应用图标：塔块霓虹剪影
{
  const S = 120;
  const r = new Raster(S, S);
  r.fillRect(0, 0, S, S, hexToRgb(N.SKY_TOP), 255);
  for (let y = 0; y < S; y++) r.fillRect(0, y, S, 1, hexToRgb(N.SKY_TOP).map((v, k) => Math.round(v + (hexToRgb(N.SKY_BOTTOM)[k] - v) * (y / S))), 255);
  const bw = 72, bh = 18;
  for (let i = 0; i < 3; i++) block(r, Math.round((S - bw) / 2) + (i % 2 ? 5 : -5), S - 24 - (i + 1) * (bh + 3), bw, bh, i);
  ripple(r, S / 2, S - 66, 26, 2);
  emit('wx-icon', 'icon.png', r, { use: '应用图标（塔块霓虹剪影）', ratio: '1:1', panel: '参考卡块皮同源' });
}

manifest.items.sort((a, b) => a.id.localeCompare(b.id));
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`[out ] ${OUT}/manifest.json（${manifest.items.length} 件，逐件 sha256）`);
console.log('[done] 平台素材 7 项生成完成（NEON 派生 · 零新编风格 · 确定性可复现）');
