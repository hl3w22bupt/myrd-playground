#!/usr/bin/env node
/**
 * 发布素材终检 · maskable 安全区像素级检查器（T3 美术线 · 2026-09-26 正式发布轮 r3）
 * 只读检查，零外部依赖（zlib + 手工 unfilter）；落证据目录自足可复现（v1.1 D3 证据条款）。
 * 判据：安全圆（中心，d=80%）外像素必须为背景；圆内必须有内容；背景按「逐行左右边缘参照
 *       + 行内线性插值」识别（适配垂直/水平渐变底，tol=8）。apple-touch-icon 无 maskable 语义，按全出血底核对。
 * 用法：node art-check-maskable.mjs [assetsDir]   （默认 = games/stack-tower/export/web/assets/icons）
 */
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ICONS = process.argv[2]
  ? join(process.argv[2])
  : join(HERE, '../../../../games/stack-tower/export/web/assets/icons');
const TOL = 8;

function decodePNG(buf) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!buf.subarray(0, 8).equals(sig)) throw new Error('非 PNG 签名');
  let off = 8, w = 0, h = 0, bitDepth = 0, colorType = 0, interlace = 0;
  const idat = [];
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.subarray(off + 4, off + 8).toString('ascii');
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9]; interlace = data[12];
    } else if (type === 'IDAT') idat.push(Buffer.from(data));
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2) || interlace !== 0)
    throw new Error(`不支持的 PNG 形态 bitDepth=${bitDepth} colorType=${colorType} interlace=${interlace}`);
  const raw = inflateSync(Buffer.concat(idat));
  const ch = colorType === 6 ? 4 : 3;
  const stride = w * ch;
  const out = Buffer.alloc(w * h * ch);
  let p = 0;
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[p++];
    const cur = Buffer.from(raw.subarray(p, p + stride)); p += stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0;
      const b = prev[x];
      const c = x >= ch ? prev[x - ch] : 0;
      let v = cur[x];
      if (f === 1) v = (v + a) & 255;
      else if (f === 2) v = (v + b) & 255;
      else if (f === 3) v = (v + ((a + b) >> 1)) & 255;
      else if (f === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        v = (v + ((pa <= pb && pa <= pc) ? a : pb <= pc ? b : c)) & 255;
      }
      cur[x] = v;
    }
    cur.copy(out, y * stride);
    prev = cur;
  }
  return { w, h, ch, data: out };
}

const px = (img, x, y) => {
  const i = (y * img.w + x) * img.ch;
  return [img.data[i], img.data[i + 1], img.data[i + 2]];
};
const chan = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');

function checkIcon(file, { maskable }) {
  const img = decodePNG(readFileSync(join(ICONS, file)));
  const cx = (img.w - 1) / 2, cy = (img.h - 1) / 2, r = img.w * 0.4; // d = 80%
  let outsideNonBg = 0, rowEdgeMismatch = 0, insideContent = 0;
  const hist = new Map();
  for (let y = 0; y < img.h; y++) {
    const left = px(img, 0, y), right = px(img, img.w - 1, y);
    if (chan(left, right) > TOL) rowEdgeMismatch++;
    for (let x = 0; x < img.w; x++) {
      const c = px(img, x, y);
      const t = img.w === 1 ? 0 : x / (img.w - 1);
      const bg = [0, 1, 2].map((k) => Math.round(left[k] + (right[k] - left[k]) * t));
      const isBg = chan(c, bg) <= TOL;
      const inside = (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
      if (!isBg) {
        const k = c.join(',');
        hist.set(k, (hist.get(k) || 0) + 1);
        if (maskable ? inside : true) insideContent++;
        else outsideNonBg++;
      }
    }
  }
  const top = [...hist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([k, n]) => `${hex(k.split(',').map(Number))}×${n}`).join(' ');
  const bg =
    `bgTop=${hex(px(img, 0, 0))} bgMid=${hex(px(img, 0, img.h >> 1))} bgBottom=${hex(px(img, 0, img.h - 1))}`;
  const pass = outsideNonBg === 0 && rowEdgeMismatch === 0 && insideContent > 0;
  return { file, w: img.w, h: img.h, outsideNonBg, rowEdgeMismatch, insideContent, top, bg, pass };
}

const targets = [
  { file: 'icon-192-maskable.png', maskable: true },
  { file: 'icon-512-maskable.png', maskable: true },
  { file: 'apple-touch-icon-180.png', maskable: false },
];
let allPass = true;
for (const t of targets) {
  const r = checkIcon(t.file, { maskable: t.maskable });
  allPass = allPass && r.pass;
  const verdict = r.pass
    ? (t.maskable ? 'MASKABLE-SAFE-PASS' : 'FULLBLEED-PASS')
    : 'FAIL';
  console.log(
    `${r.file} ${r.w}×${r.h} → outsideCircleNonBgPx=${r.outsideNonBg} rowEdgeMismatch=${r.rowEdgeMismatch} contentPx=${r.insideContent} · ${r.bg} · 圆内内容色 top: ${r.top || '(无)'} → ${verdict}`
  );
}
console.log(allPass ? 'ART-MASKABLE-RESULT: PASS (3/3)' : 'ART-MASKABLE-RESULT: FAIL');
process.exit(allPass ? 0 : 1);
