#!/usr/bin/env node
/**
 * B1 meta 四件套生成器（美术线 · 上头循环轮 · spec v1.4 content.retention items[].assets 4 id）。
 * 复现：node games/stack-tower/tools/gen-meta-assets.mjs
 *
 * 纪律（黑板 assets.md B1 段）：
 *  - 全部素材从「霓虹夜塔」参考卡派生：色值唯一真源 = src/render/theme.ts NEON 表（解析取值，
 *    解析失败即失败，禁止私设色值）；零新编风格；无文字（抽象形代替文案，免字体依赖）；
 *  - 透明底：Raster 初始全透明，四角像素 alpha=0（查表器断言）；
 *  - 9-slice：两块面板卡四角 24px 安全区（manifest.slice=24，渲染层按此切分拉伸）；
 *  - 确定性：无随机数，重跑逐字节一致；逐件 manifest 记 sha256。
 */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Raster, encodePng, hexToRgb, shadeRgb } from './pnglib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets', 'meta');
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
  BLOCK: [1, 2, 3, 4, 5, 6].map((i) => pickColor(`BLOCK_NEON_0${i}`)),
  CUT_FACE: pickColor('CUT_FACE'),
  RIPPLE: pickColor('RIPPLE_RING'),
  GLOW: pickColor('PERFECT_GLOW'),
  BTN: pickColor('UI_BTN_PRIMARY'),
  PANEL: pickColor('UI_PANEL_HUD'),
};
const PANEL_ALPHA = Math.round(Number((/UI_PANEL_HUD_ALPHA:\s*([0-9.]+)/.exec(THEME) ?? [])[1] ?? 0.72) * 255);

const manifest = {
  specSource: 'spec v1.4 content.retention items[].assets（meta 四件套 4 id；mission-panel 为 missions-deferred 预留件）',
  derivedFrom: '霓虹夜塔参考卡 v1.0（docs/style-card-neon-night-v1.md）· 色源 theme.ts NEON 表',
  generator: 'tools/gen-meta-assets.mjs（确定性，重跑逐字节一致）',
  items: [],
};

function emit(id, file, raster, spec) {
  const png = encodePng(raster);
  writeFileSync(join(OUT, file), png);
  manifest.items.push({
    id, file, bytes: png.length,
    sha256: createHash('sha256').update(png).digest('hex'),
    size: `${raster.width}x${raster.height}`,
    ...spec,
  });
  console.log(`[ok  ] ${id}  ${raster.width}x${raster.height}  ${(png.length / 1024).toFixed(1)}KB`);
}

/** 9-slice 面板底：PANEL 半透明底 + BTN 外描边 2px + 内侧 RIPPLE 细线 1px（四角 24px 安全区） */
function panel(w, h, slice = 24) {
  const r = new Raster(w, h);
  const base = hexToRgb(N.PANEL);
  const edge = hexToRgb(N.BTN);
  const inner = hexToRgb(N.RIPPLE);
  r.fillRect(0, 0, w, h, base, PANEL_ALPHA); // 半透明面板底
  // 外描边 2px（四边）
  r.fillRect(0, 0, w, 2, edge, 255);
  r.fillRect(0, h - 2, w, 2, edge, 255);
  r.fillRect(0, 0, 2, h, edge, 255);
  r.fillRect(w - 2, 0, 2, h, edge, 255);
  // 内侧霓虹细线 1px（3px 内缩）
  r.fillRect(3, 3, w - 6, 1, inner, 200);
  r.fillRect(3, h - 4, w - 6, 1, inner, 200);
  r.fillRect(3, 3, 1, h - 6, inner, 200);
  r.fillRect(w - 4, 3, 1, h - 6, inner, 200);
  // 9-slice 角标：四角 6x6 实心角块（GLOW），标记切片安全区
  const g = hexToRgb(N.GLOW);
  for (const [cx, cy] of [[10, 10], [w - 16, 10], [10, h - 16], [w - 16, h - 16]]) {
    r.fillRect(cx, cy, 6, 6, g, 230);
  }
  // 四角斜切透明（切角 14px，霓虹切角面板形）：9-slice 角安全区内不含像素
  const cut = 14;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = Math.min(x, w - 1 - x);
      const dy = Math.min(y, h - 1 - y);
      if (dx + dy < cut) r.data[(y * w + x) * 4 + 3] = 0;
    }
  }
  return r;
}

/** 抽象日历图标（每日挑战隐喻：挂耳 + 页体 + 日期条），无文字 */
function calendarIcon(r, x, y) {
  const body = hexToRgb(N.BLOCK[0]);
  const ear = hexToRgb(N.CUT_FACE);
  r.fillRect(x + 3, y - 4, 4, 6, ear, 255); // 左挂耳
  r.fillRect(x + 17, y - 4, 4, 6, ear, 255); // 右挂耳
  r.fillRect(x, y, 24, 24, body, 255); // 页体
  r.fillRect(x, y, 24, 6, hexToRgb(N.BLOCK[3]), 255); // 页头横带
  r.fillRect(x + 4, y + 11, 7, 3, hexToRgb(N.SKY_TOP), 255); // 日期抽象条一
  r.fillRect(x + 4, y + 17, 12, 3, hexToRgb(N.SKY_TOP), 160); // 日期抽象条二
}

/** 抽象进度段（三段，完成段 GLOW 高亮） */
function progressSegments(r, x, y, w, done) {
  const seg = Math.floor((w - 8) / 3);
  for (let i = 0; i < 3; i++) {
    const c = i < done ? hexToRgb(N.GLOW) : shadeRgb(hexToRgb(N.RIPPLE), 0.55);
    r.fillRect(x + i * (seg + 4), y, seg, 8, c, i < done ? 255 : 120);
  }
}

// —— 1) daily-challenge-card 360x160（9-slice 24px）——
{
  const r = panel(360, 160);
  calendarIcon(r, 28, 60);
  // 标题抽象条 + 副条（无文字纪律）
  r.fillRect(68, 52, 150, 12, hexToRgb(N.BTN), 235);
  r.fillRect(68, 74, 96, 8, shadeRgb(hexToRgb(N.PANEL), 1.6), 200);
  // 完成进度段（右下）
  progressSegments(r, 68, 112, 200, 2);
  emit('daily-challenge-card', 'daily-challenge-card.png', r, {
    kind: 'ui-panel', slice: 24, alpha: 'transparent',
    expect: '每日挑战面板卡：日历隐喻 + 标题抽象条 + 三段进度；NEON 派生；透明底',
  });
}

// —— 2) mission-panel 360x200（9-slice 24px；missions 顺延预留件，N2 先行产出）——
{
  const r = panel(360, 200);
  // 三条目行（行高 48：点标 + 横条），任务抽象形态
  for (let i = 0; i < 3; i++) {
    const y = 44 + i * 48;
    r.fillRect(28, y + 8, 10, 10, hexToRgb(N.BLOCK[(i + 1) % 6]), 255); // 点标
    r.fillRect(52, y + 9, 150 - i * 24, 8, shadeRgb(hexToRgb(N.PANEL), 1.6), 210); // 任务条
    r.fillRect(286, y + 6, 46, 14, hexToRgb(i === 2 ? N.RIPPLE : N.GLOW), i === 2 ? 140 : 220); // 奖励角标位
  }
  emit('mission-panel', 'mission-panel.png', r, {
    kind: 'ui-panel', slice: 24, alpha: 'transparent',
    expect: '连击任务面板：三条目行（行高 48）+ 奖励角标位；NEON 派生；透明底（本轮预留，下一轮接线）',
  });
}

// —— 3) streak-badge 96x96（连胜徽章：星轨/火焰尾迹隐喻，透明底）——
{
  const r = new Raster(96, 96);
  const core = hexToRgb(N.GLOW);
  const rim = hexToRgb(N.BTN);
  const tail = hexToRgb(N.RIPPLE);
  // 外光晕（三层同心菱形，明度递减 → 发光填充形态，禁描边线）
  const cx = 48;
  for (let i = 0; i < 3; i++) {
    const half = 34 - i * 9;
    const a = 70 + i * 30;
    const c = i === 2 ? core : shadeRgb(core, 0.7 + i * 0.15);
    for (let dy = -half; dy <= half; dy++) {
      const span = half - Math.abs(dy);
      r.fillRect(cx - span, 40 + dy, span * 2 + 1, 1, c, a);
    }
  }
  // 菱形核心（实心）
  for (let dy = -16; dy <= 16; dy++) {
    const span = 16 - Math.abs(dy);
    r.fillRect(cx - span, 40 + dy, span * 2 + 1, 1, dy < 0 ? rim : shadeRgb(rim, 0.8), 255);
  }
  // 中心高光
  r.fillRect(cx - 4, 36, 8, 8, core, 255);
  // 双尾迹线（连胜跨局延续隐喻，向左下方延展）
  r.fillRect(6, 74, 30, 3, tail, 220);
  r.fillRect(14, 82, 18, 3, shadeRgb(tail, 0.7), 160);
  emit('streak-badge', 'streak-badge.png', r, {
    kind: 'icon', slice: null, alpha: 'transparent',
    expect: '连胜徽章：菱形核心 + 光晕 + 双尾迹；单色高亮可被主题重着色；透明底',
  });
}

// —— 4) icon-badge 64x64（meta 通用奖励角标：圆盘 + 对勾抽象，透明底）——
{
  const r = new Raster(64, 64);
  const disk = hexToRgb(N.CUT_FACE);
  const rim = hexToRgb(N.BTN);
  const check = hexToRgb(N.BLOCK[0]);
  // 圆盘（逐行扫描近似圆，半径 28）
  const R = 28;
  for (let y = 4; y < 60; y++) {
    const dy = y - 32;
    const span = Math.floor(Math.sqrt(Math.max(0, R * R - dy * dy)));
    if (span <= 0) continue;
    r.fillRect(32 - span, y, span * 2, 1, disk, 235);
  }
  // 外环描边（半径 28 圆周近似：外扩 2px 亮环）
  for (let y = 2; y < 62; y++) {
    const dy = y - 32;
    const outer = Math.sqrt(Math.max(0, R * R - dy * dy));
    if (outer <= 0) continue;
    const w = Math.abs(outer - Math.round(outer)) < 0.5 ? 2 : 0;
    if (w) {
      r.fillRect(32 - Math.round(outer) - 1, y, 2, 1, rim, 255);
      r.fillRect(32 + Math.round(outer) - 1, y, 2, 1, rim, 255);
    }
  }
  // 对勾抽象（三段折线，加粗）
  r.fillRect(20, 33, 5, 10, check, 255);
  r.fillRect(25, 40, 5, 5, check, 255);
  r.fillRect(30, 30, 5, 6, check, 255);
  r.fillRect(34, 24, 5, 8, check, 255);
  r.fillRect(38, 20, 4, 6, check, 255);
  emit('icon-badge', 'icon-badge.png', r, {
    kind: 'icon', slice: null, alpha: 'transparent',
    expect: '奖励角标：圆盘 + 对勾抽象；挑战完成/任务奖励共用；透明底',
  });
}

// ---------- manifest 落盘 ----------
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`[out ] ${join(OUT, 'manifest.json')}（${manifest.items.length} 件，逐件 sha256）`);
console.log(`[done] meta 四件套生成完毕（NEON 派生 / 透明底 / 确定性）`);

