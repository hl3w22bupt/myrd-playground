#!/usr/bin/env node
/**
 * B0 平台素材查表器（美术线交付面 · N3 wx 轨输入）。
 * 判据（spec v1.3 content.platform 素材 7 id + 黑板 assets.md B0 派生纪律）：
 *   逐件 ①文件存在 ②PNG 头 ③尺寸 = spec 定稿尺寸 ④sha256 = manifest ⑤色板派生（≥1 像素精确命中
 *   theme.ts NEON 表色，零私设色值的正向证据）。
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GAME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIR = path.join(GAME, 'assets/wx');
const manifest = JSON.parse(readFileSync(path.join(DIR, 'manifest.json'), 'utf8'));
const THEME = readFileSync(path.join(GAME, 'src/render/theme.ts'), 'utf8');
const PALETTE = [...THEME.matchAll(/'(#[0-9a-fA-F]{6})'/g)].map((m) => m[1].toLowerCase());
const PALETTE_SET = new Set(PALETTE);

function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('非 PNG');
  let off = 8, w = 0, h = 0, idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    if (type === 'IHDR') { w = buf.readUInt32BE(off + 8); h = buf.readUInt32BE(off + 12); }
    if (type === 'IDAT') idat.push(buf.subarray(off + 8, off + 8 + len));
    off += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * 4 + 1;
  const px = new Map(); // 'r,g,b' → count（filter 恒 0，逐行直读）
  for (let y = 0; y < h; y++) {
    if (raw[y * stride] !== 0) throw new Error(`行滤波非 0（y=${y}）`);
    for (let x = 0; x < w; x++) {
      const i = y * stride + 1 + x * 4;
      if (raw[i + 3] === 0) continue;
      const key = `${raw[i]},${raw[i + 1]},${raw[i + 2]}`;
      px.set(key, (px.get(key) || 0) + 1);
    }
  }
  return { w, h, px };
}

const failures = [];
const total = manifest.items.length;
for (const item of manifest.items) {
  try {
    const buf = readFileSync(path.join(DIR, item.file));
    if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('PNG 头不符');
    const sha = createHash('sha256').update(buf).digest('hex');
    if (sha !== item.sha256) throw new Error('sha256 与 manifest 不符');
    const img = decodePng(buf);
    const dims = `${img.w}x${img.h}`;
    if (dims !== item.size) throw new Error(`尺寸 ${dims} ≠ 定稿 ${item.size}`);
    // 色板派生：任一像素精确命中 NEON 表（生成器从同表取值，命中即派生正向证据）
    const hexOf = (k) => '#' + k.split(',').map((v) => Number(v).toString(16).padStart(2, '0')).join('');
    let hit = '';
    for (const k of img.px.keys()) if (PALETTE_SET.has(hexOf(k))) { hit = hexOf(k); break; }
    if (!hit) throw new Error('零像素命中 NEON 表（派生性不足）');
    console.log(`  PASS  ${item.id}  ${dims}  ${(item.bytes / 1024).toFixed(1)}KB  派生色 ${hit}`);
  } catch (e) {
    failures.push(item.id);
    console.log(`  FAIL  ${item.id}  ↳ ${e.message}`);
  }
}
if (total !== 7) {
  failures.push('count');
  console.log(`  FAIL  素材件数 ${total} ≠ 定稿 7 项`);
}
if (failures.length) {
  console.log(`RESULT: FAIL (${total - failures.length}/${total})`);
  process.exit(1);
}
console.log(`RESULT: PASS  — 平台素材查表 ${total}/${total}（sha256 + 尺寸 + NEON 派生）`);
