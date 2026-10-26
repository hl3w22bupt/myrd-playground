#!/usr/bin/env node
// gen-assets.mjs — line4-unblock-jam 素材量产器（spec v0.2 assets a01..a06 · 审查通过版落地）
//
// 单源纪律（deterministic-asset-pipeline 判例）：色值唯一来源 = src/platform/theme.ts
// （≡ spec numeric.palette ≡ 风格卡 v1）；本文件零写死色值，取色全走 PALETTE 映射。
// 确定性纪律：零噪声零时钟零随机——同命令重跑逐字节一致（acc-05「重生成 hash 不变」机判根）。
// 产物：assets/<id>.png + assets/audio/*.wav（a06 派生件）+ assets/manifest.json（逐件 sha256）。
// 用法：node tools/gen-assets.mjs [--out <dir>]（默认 assets/；--out 供 check-assets 确定性对账）
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PALETTE, SHADOW_ALPHA, RADIUS_CAR_PX, RADIUS_UI_PX, GRID_CELL_PX, EXIT_GATE_CELLS } from '../src/platform/theme.ts';
import { Raster, encodePng, hexToRgb } from './pnglib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = (() => {
  const i = process.argv.indexOf('--out');
  return i > 0 ? process.argv[i + 1] : join(HERE, '..', 'assets');
})();
mkdirSync(OUT, { recursive: true });
mkdirSync(join(OUT, 'audio'), { recursive: true });

const C = {
  ground: hexToRgb(PALETTE.ground), grid: hexToRgb(PALETTE.gridLine), ink: hexToRgb(PALETTE.ink),
  shadow: hexToRgb(PALETTE.shadow), red: hexToRgb(PALETTE.target), orange: hexToRgb(PALETTE.carWarm),
  green: hexToRgb(PALETTE.carCool), blue: hexToRgb(PALETTE.carAlt),
};
const SHA256 = (buf) => createHash('sha256').update(buf).digest('hex');
const cell = GRID_CELL_PX; // 48 设计基准（spec world/比例四要素）

// —— a01-lot-tiles：地面底 + 网格 + 障碍块 平铺图集（3 帖 × 48px） ——
function a01() {
  const img = new Raster(cell * 3, cell);
  img.fillRect(0, 0, cell, cell, C.ground); // 帖1 地面底 + 网格线（右/下 1px）
  img.fillRect(cell - 1, 0, 1, cell, C.grid);
  img.fillRect(0, cell - 1, cell, 1, C.grid);
  img.fillRect(cell, 0, cell, cell, C.ground); // 帖2 纯网格单元（四边 1px 线）
  img.fillRect(cell, 0, 1, cell, C.grid);
  img.fillRect(cell * 2 - 1, 0, 1, cell, C.grid);
  img.fillRect(cell, 0, cell, 1, C.grid);
  img.fillRect(cell, cell - 1, cell, 1, C.grid);
  img.fillRoundRect(cell * 2 + 4, 4, cell - 8, cell - 8, RADIUS_UI_PX, C.grid); // 帖3 障碍块（4px 圆角）
  return img;
}

// —— a02-car-set：车块 4 色档 1×2 横放（96×48 · 圆角 8px · 12% 投影 offset2） ——
function a02() {
  const img = new Raster(cell * 2 * 4, cell);
  const colors = [C.red, C.orange, C.green, C.blue];
  colors.forEach((rgb, i) => {
    const ox = i * cell * 2;
    img.fillRoundRect(ox + 2, 2, cell * 2, cell, RADIUS_CAR_PX, C.shadow, Math.round(SHADOW_ALPHA * 255)); // 投影
    img.fillRoundRect(ox, 0, cell * 2, cell, RADIUS_CAR_PX, rgb);
  });
  return img;
}

// —— a03-exit-gate：出口门高亮条 2 格宽（96×48 · 绿=通 / 红=堵 双态） ——
function a03() {
  const img = new Raster(cell * 2 * 2, cell);
  const gate = (ox, rgb) => {
    img.fillRect(ox, 0, 2, cell, rgb);
    img.fillRect(ox + cell * EXIT_GATE_CELLS - 2, 0, 2, cell, rgb);
    img.fillRect(ox, 0, cell * EXIT_GATE_CELLS, 2, rgb);
    for (let k = 0; k < 3; k += 1) img.fillRect(ox + 8 + k * 16, cell / 2 - 1, 10, 2, rgb); // 3 道流向刻度
  };
  gate(0, C.green);
  gate(cell * 2, C.red);
  return img;
}

// —— a04-guide-hand：引导手指 + 滑动箭头（96×96 · g-01 判据挂件） ——
function a04() {
  const img = new Raster(cell * 2, cell * 2);
  img.fillRect(8, 44, 60, 8, C.ink); // 箭杆 →
  for (let k = 0; k < 10; k += 1) img.fillRect(60 + k, 44 - k, 2, 8 + k * 2, C.ink); // 箭头
  img.fillRoundRect(44, 60, 14, 30, 6, C.ground); // 手指（三段）
  img.fillRoundRect(40, 74, 24, 16, 6, C.ground);
  img.fillRoundRect(36, 82, 34, 10, 4, C.ground);
  return img;
}

// —— a05-ui-hud：九宫底板（48×48 · 8px 九宫边距 · 步数计/弹字底/重开钮共用） ——
function a05() {
  const img = new Raster(cell, cell);
  img.fillRoundRect(0, 0, cell, cell, RADIUS_UI_PX + 4, C.ink, 230);
  return img;
}

// —— a06-sfx-pack：音效 3 档规格件 + wav 派生（拖动/驶出/通关；确定性正弦/方波合成） ——
const SFX_TIERS = [
  { id: 'drag', waveform: 'square', freqHz: 320, durationMs: 60, gain: 0.25 },
  { id: 'exit', waveform: 'sine', freqHz: 660, durationMs: 140, gain: 0.5 },
  { id: 'clear', waveform: 'sine', freqHz: 880, durationMs: 220, gain: 0.6 },
];
function wavOf(tier) {
  const rate = 22050, n = Math.round((rate * tier.durationMs) / 1000);
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i += 1) {
    const t = i / rate;
    const env = 1 - i / n; // 线性衰减包络（零随机）
    const v = tier.waveform === 'square' ? Math.sign(Math.sin(2 * Math.PI * tier.freqHz * t)) : Math.sin(2 * Math.PI * tier.freqHz * t);
    buf.writeInt16LE(Math.round(v * env * tier.gain * 32000), 44 + i * 2);
  }
  return buf;
}

// —— 量产 + manifest（逐件 sha256 · 单源色值留痕） ——
const PNGS = [
  { id: 'a01-lot-tiles', kind: 'image', draw: a01 },
  { id: 'a02-car-set', kind: 'sprite', draw: a02 },
  { id: 'a03-exit-gate', kind: 'sprite', draw: a03 },
  { id: 'a04-guide-hand', kind: 'sprite', draw: a04 },
  { id: 'a05-ui-hud', kind: 'image', draw: a05 },
];
const manifest = {
  generatedBy: 'games/line4-unblock-jam/tools/gen-assets.mjs',
  paletteSource: 'src/platform/theme.ts（≡ spec numeric.palette ≡ 风格卡 v1 · FROZEN-v1）',
  palette: Object.values(PALETTE),
  determinism: 'zero-noise / zero-clock / zero-random — 重生成 sha256 逐件不变',
  assets: [],
};
for (const a of PNGS) {
  const img = a.draw();
  const png = encodePng(img);
  const file = `assets/${a.id}.png`;
  writeFileSync(join(OUT, `${a.id}.png`), png);
  manifest.assets.push({ id: a.id, file, kind: a.kind, specFile: `games/line4-unblock-jam/${file}`, bytes: png.length, width: img.width, height: img.height, sha256: SHA256(png) });
  console.log(`[gen-assets] ${a.id}.png ${img.width}x${img.height} ${png.length}B sha=${SHA256(png).slice(0, 12)}`);
}
const audio = [];
for (const tier of SFX_TIERS) {
  const wav = wavOf(tier);
  const rel = `assets/audio/${tier.id}.wav`;
  writeFileSync(join(OUT, 'audio', `${tier.id}.wav`), wav);
  audio.push({ id: `${tier.id}`, file: rel, tier, bytes: wav.length, sha256: SHA256(wav) });
  console.log(`[gen-assets] audio/${tier.id}.wav ${tier.durationMs}ms ${wav.length}B sha=${SHA256(wav).slice(0, 12)}`);
}
const sfxSpec = { id: 'a06-sfx-pack', kind: 'sfx', specVersion: 'v0.2', source: 'generated', tiers: SFX_TIERS, derivatives: audio };
const sfxBody = JSON.stringify(sfxSpec, null, 2) + '\n';
writeFileSync(join(OUT, 'a06-sfx-pack.spec.json'), sfxBody);
manifest.assets.push({
  id: 'a06-sfx-pack', file: 'assets/a06-sfx-pack.spec.json', kind: 'sfx', specFile: 'games/line4-unblock-jam/assets/a06-sfx-pack.spec.json',
  bytes: Buffer.byteLength(sfxBody), sha256: SHA256(Buffer.from(sfxBody)),
  derivatives: audio.map((d) => ({ file: d.file, sha256: d.sha256, bytes: d.bytes })),
});
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`[gen-assets] manifest.json：${manifest.assets.length} 件 → ${OUT}`);
