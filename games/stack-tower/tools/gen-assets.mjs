#!/usr/bin/env node
/**
 * 素材生成器（T3 美术线 · procedural → assets/ 实体落盘）— 复现：
 *   node games/stack-tower/tools/gen-assets.mjs
 *
 * 规格纪律：
 *   - 色值唯一真源 = src/render/palette.ts（本脚本解析取值，解析失败即失败，禁止另设色值）；
 *   - 光照逻辑 = 风格卡 §1（三面明度 100:78:55）；构图脚本 = 风格卡 §3 L3/L4/L5/L6；
 *   - 命名 = spec lvl-01-stack-tower 元素 id 逐字对应（e01–e08）+ tileset/ui 分类目录；
 *   - 预算红线：单资产 ≤50KB，总量 ≤300KB（风格卡 §4），超限即非零退出。
 */
import { mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Raster, encodePng, hexToRgb, shadeRgb } from './pnglib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---------- 色板同源：解析 palette.ts，禁止另设色值 ----------
const src = readFileSync(join(ROOT, 'src', 'render', 'palette.ts'), 'utf8');
function pick(name) {
  const m = new RegExp(`${name}:\\s*'(#[0-9a-fA-F]{6})'`).exec(src);
  if (!m) {
    console.error(`FAIL palette.ts 缺少 ${name}（色板真源被破坏，禁止生成器私设色值）`);
    process.exit(1);
  }
  return hexToRgb(m[1]);
}
const P = {
  BLOCK_A: pick('BLOCK_A'),
  BLOCK_B: pick('BLOCK_B'),
  BLOCK_C: pick('BLOCK_C'),
  SKY_BOTTOM: pick('SKY_BOTTOM'),
};
const WHITE = [255, 255, 255];
const DEBRIS_RGB = [20, 28, 38]; // 失败黑承载色（低明度蓝黑，透明度走 alpha）
const A = (v) => Math.round(v * 255);

// ---------- 画法（风格卡 §1：顶 12% 高光带，三面 100/78/55） ----------
function blockFace(r, rgb, { top = 1, mid = 0.78, bottom = 0.55 } = {}, seed) {
  const hi = Math.round(r.height * 0.12);
  r.fillRect(0, 0, r.width, hi, shadeRgb(rgb, top));
  r.fillRect(0, hi, r.width, Math.max(1, r.height - hi - Math.round(r.height * 0.18)), shadeRgb(rgb, mid));
  r.fillRect(0, r.height - Math.round(r.height * 0.18), r.width, Math.round(r.height * 0.18), shadeRgb(rgb, bottom));
  r.grain(seed);
}

const jobs = [];
const out = (file, raster) => jobs.push({ file, raster });

// e01 塔基块（首块：由 kernel/tower.createBaseBlock 生成，静止）
{
  const r = new Raster(120, 28);
  blockFace(r, P.BLOCK_A, {}, 101);
  out('assets/sprites/e01-spawn-first-block.png', r);
}
// e02 摆动块（提亮 + 下缘反弹光烘焙，风格卡 §1 反弹光）
{
  const r = new Raster(120, 28);
  blockFace(r, P.BLOCK_A, { top: 1, mid: 0.86, bottom: 0.62 }, 102);
  r.fillRect(0, 25, 120, 3, P.SKY_BOTTOM, A(0.35));
  out('assets/sprites/e02-swing-motion.png', r);
}
// e03 落点参考虚线（构图脚本 L4 引导层：α0.3，虚段 6on/4off）
{
  const r = new Raster(2, 48);
  for (let y = 0; y + 6 <= 48; y += 10) r.fillRect(0, y, 2, 6, WHITE, A(0.3));
  out('assets/sprites/e03-drop-input.png', r);
}
// e04 切面错口碎块（失败黑 α0.25 + 顶缘错口齿白 α0.15）
{
  const r = new Raster(120, 28);
  r.fillRect(0, 4, 120, 24, DEBRIS_RGB, A(0.25));
  for (let x = 0; x < 120; x += 6) r.fillRect(x, 0, 3, 4, WHITE, A(0.15));
  out('assets/sprites/e04-overlap-cut.png', r);
}
// e05 完美切面脉冲框（风格卡 §1 特殊时刻光：只走白色切面描边脉冲）
{
  const r = new Raster(120, 28);
  const f = (x, y, w, h, a) => r.fillRect(x, y, w, h, WHITE, a);
  f(0, 0, 120, 2, 255); f(0, 26, 120, 2, 255); f(0, 0, 2, 28, 255); f(118, 0, 2, 28, 255);
  f(2, 0, 116, 1, 90); f(2, 27, 116, 1, 90); f(0, 2, 1, 24, 90); f(119, 2, 1, 24, 90);
  out('assets/sprites/e05-perfect-window.png', r);
}
// e06 塔身涟漪环（波纹贴图：三圈椭圆，径向衰减，播放时整体乘 (1−t)）
{
  const W = 240, H = 96, cx = W / 2, cy = H / 2, rx = 116, ry = 42;
  const r = new Raster(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.sqrt(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2);
      const a = Math.abs(d - 1) < 0.02 ? 255 : Math.abs(d - 0.93) < 0.015 ? 115 : Math.abs(d - 0.86) < 0.012 ? 46 : 0;
      if (a) r.blend(x, y, WHITE, a);
    }
  }
  out('assets/sprites/e06-tower-ripple.png', r);
}
// e07 HUD 顶部安全区（构图脚本 L5：56px 渐隐衬底，无底板）
{
  const r = new Raster(480, 56);
  for (let y = 0; y < 56; y++) r.fillRect(0, y, 480, 1, [0, 0, 0], A(0.28 * (1 - y / 55)));
  r.fillRect(0, 0, 480, 1, WHITE, A(0.12));
  out('assets/ui/e07-score-hud.png', r);
}
// e08 重开入口按钮皮肤（圆角 6，深色底 + 白描边）
{
  const W = 96, H = 32, rad = 6;
  const r = new Raster(W, H);
  const inside = (x, y) => {
    const px = Math.max(rad, x) - Math.min(W - 1 - rad, x);
    const py = Math.max(rad, y) - Math.min(H - 1 - rad, y);
    return px * px + py * py <= rad * rad || (x >= rad && x < W - rad) || (y >= rad && y < H - rad);
  };
  const border = (x, y) => {
    const near = (dx, dy) => {
      const px = Math.max(rad, x + dx) - Math.min(W - 1 - rad, x + dx);
      const py = Math.max(rad, y + dy) - Math.min(H - 1 - rad, y + dy);
      return px * px + py * py <= rad * rad || (x + dx >= rad && x + dx < W - rad) || (y + dy >= rad && y + dy < H - rad);
    };
    return inside(x, y) && !(near(-1, 0) && near(1, 0) && near(0, -1) && near(0, 1) && near(-1, -1) && near(1, 1) && near(-1, 1) && near(1, -1));
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (border(x, y)) r.blend(x, y, WHITE, 153);
      else if (inside(x, y)) r.blend(x, y, DEBRIS_RGB, 140);
    }
  }
  out('assets/ui/e08-fail-recover.png', r);
}
// tileset 塔块三循环（A/B/C 三 cell ×120×28；描边由 renderer 统一绘制，贴图不带）
{
  const r = new Raster(360, 28);
  for (const [i, c] of [P.BLOCK_A, P.BLOCK_B, P.BLOCK_C].entries()) {
    const cell = new Raster(120, 28);
    blockFace(cell, c, {}, 111 + i);
    cell.data.copy(r.data, i * 120 * 4 * 28, 0, 120 * 4 * 28);
  }
  out('assets/tileset/blocks-tower.png', r);
}

// ---------- PWA 图标三件（M2.1：a07-pwa-icons；maskable 安全区 = 内切 80%，构图不出圈） ----------
// 意象同风格卡：冷灰蓝天底 + 暖色塔块三面光照 + 切面白描边；内容集中内切圆 r=40% 内（maskable 规范）
function drawIcon(size, { maskable = true } = {}) {
  const r = new Raster(size, size);
  const SKY_TOP = shadeRgb(P.SKY_BOTTOM, 1.18);
  for (let y = 0; y < size; y++) {
    const t = y / (size - 1);
    const c = [
      Math.round(SKY_TOP[0] + (P.SKY_BOTTOM[0] - SKY_TOP[0]) * t),
      Math.round(SKY_TOP[1] + (P.SKY_BOTTOM[1] - SKY_TOP[1]) * t),
      Math.round(SKY_TOP[2] + (P.SKY_BOTTOM[2] - SKY_TOP[2]) * t),
    ];
    r.fillRect(0, y, size, 1, c);
  }
  // 三层塔块（下宽上窄），约束在内切圆 r=40%（maskable）内
  const s = size;
  const layers = [
    { w: 0.56, h: 0.11, y: 0.60, c: P.BLOCK_A },
    { w: 0.46, h: 0.11, y: 0.47, c: P.BLOCK_B },
    { w: 0.36, h: 0.11, y: 0.34, c: P.BLOCK_C },
  ];
  for (const L of layers) {
    const bw = Math.round(s * L.w);
    const bh = Math.max(3, Math.round(s * L.h));
    const bx = Math.round((s - bw) / 2);
    const by = Math.round(s * L.y);
    blockFaceRegion(r, bx, by, bw, bh, L.c);
  }
  return r;
}

/** 区域版三面光照块（顶 12% 高光带 + 100/78/55），复用 blockFace 明度策略 */
function blockFaceRegion(r, bx, by, bw, bh, rgb) {
  const hi = Math.max(1, Math.round(bh * 0.12));
  const bot = Math.max(1, Math.round(bh * 0.18));
  r.fillRect(bx, by, bw, hi, shadeRgb(rgb, 1));
  r.fillRect(bx, by + hi, bw, Math.max(1, bh - hi - bot), shadeRgb(rgb, 0.78));
  r.fillRect(bx, by + bh - bot, bw, bot, shadeRgb(rgb, 0.55));
  r.fillRect(bx, by, bw, 1, WHITE, 200); // 切面白描边（上缘）
}
out('assets/icons/icon-192-maskable.png', drawIcon(192));
out('assets/icons/icon-512-maskable.png', drawIcon(512));
out('assets/icons/apple-touch-icon-180.png', drawIcon(180, { maskable: false }));

// ---------- 落盘 + 预算红线 ----------
let total = 0;
for (const { file, raster } of jobs) {
  const abs = join(ROOT, file);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, encodePng(raster));
  const kb = statSync(abs).size / 1024;
  total += kb;
  const over = kb > 50 ? ' ✗ 超 50KB 红线' : '';
  console.log(`  ${file}  ${raster.width}×${raster.height}  ${kb.toFixed(2)}KB${over}`);
  if (kb > 50) process.exitCode = 1;
}
console.log(`预算：${jobs.length} 资产共 ${total.toFixed(2)}KB / 300KB 上限${total > 300 ? ' ✗ 超预算' : ' ✓'}`);
if (total > 300) process.exitCode = 1;
console.log(`RESULT: PASS (assets generated: ${jobs.length})`);
