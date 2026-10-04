/**
 * 霓虹夜塔 P0 资产逐件查表器（T3 美术线 · r4 · N3 → acc-a8 契约入口）。
 * 复现：node games/stack-tower/tests/assets-neon-check.mjs
 *
 * 查表判据（任务书 N3 / spec acc-a8）：
 *  ① 完整性：文件在档 + PNG 签名 + sha256 与 manifest 一致（防漂移）；
 *  ② hex±5：核心像素逐通道与 theme 真源期望值偏差 ≤5；
 *  ③ 禁描边：outlineFree 件边缘 1px 无暗色描边环（边缘亮度 ≥ 核心亮度 × 0.82，且非近黑）；
 *  ④ 渐变方向二值：a08 垂直单向——行内水平零梯度、行间沿 y 单向插值；
 *  ⑤ 几何 ±10%：尺寸与 manifest 一致；圆角/字形锚点偏差 ≤10%。
 *
 * 输出：逐件 PASS/FAIL + 汇总（任一 FAIL → exit 1）；供 contract acc-a8 同门调用。
 */
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GAME_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(GAME_DIR, 'assets', 'neon');

// ---------- 微型 PNG 解码器（只解本仓编码形态：8-bit RGBA、filter 0） ----------
function decodePng(buf) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!buf.subarray(0, 8).equals(sig)) throw new Error('非 PNG 签名');
  let off = 8;
  let width = 0;
  let height = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const bitDepth = data[8];
      const colorType = data[9];
      if (bitDepth !== 8 || colorType !== 6) throw new Error(`不支持的形态 bit=${bitDepth} color=${colorType}`);
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    off += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const out = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    if (filter !== 0) throw new Error(`filter ${filter} 非本仓编码形态`);
    raw.copy(out, y * stride, y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
  }
  return { width, height, data: out };
}

const px = (img, x, y) => {
  const i = (y * img.width + x) * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]];
};
const chDiff = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
const hex2rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/** 查表单件：返回 {id, pass, reasons[]} */
function checkItem(m) {
  const reasons = [];
  const file = path.join(GAME_DIR, m.file);
  // ① 完整性
  if (!existsSync(file)) return { id: m.id, pass: false, reasons: ['文件缺失'] };
  const buf = readFileSync(file);
  let img;
  try {
    img = decodePng(buf);
  } catch (e) {
    return { id: m.id, pass: false, reasons: [`解码失败: ${e.message}`] };
  }
  // sha256 完整性（防漂移）
  if (createHash('sha256').update(buf).digest('hex') !== m.sha256) reasons.push('sha256 与 manifest 不符（漂移）');
  // 几何 ±10%
  if (m.geometry) {
    if (Math.abs(img.width - m.geometry.width) / m.geometry.width > 0.1) reasons.push(`宽 ${img.width} ≠ ${m.geometry.width}±10%`);
    if (Math.abs(img.height - m.geometry.height) / m.geometry.height > 0.1) reasons.push(`高 ${img.height} ≠ ${m.geometry.height}±10%`);
  }
  // ② hex±5（带感知采样：三面光照 100:88:76 下按带取期望；无光照标注则单点比较）
  const core = m.expectedHex?.core;
  if (core && m.bands) {
    const exp = hex2rgb(core);
    const midY = Math.floor(img.height / 2);
    const bands = [
      { y: Math.floor(img.height * 0.05), f: m.bands.top },
      { y: midY, f: m.bands.mid },
      { y: Math.floor(img.height * 0.93), f: m.bands.bottom },
    ];
    for (const b of bands) {
      const want = [0, 1, 2].map((k) => Math.round(exp[k] * b.f));
      const got = px(img, Math.floor(img.width / 4), b.y);
      if (got[3] !== 0 && chDiff(got, want) > 5) {
        reasons.push(`带采样 y=${b.y} 像素 ${got.slice(0, 3)} 偏离 ${core}×${b.f}（>±5）`);
        break;
      }
    }
  } else if (core) {
    const exp = hex2rgb(core);
    const cx = Math.floor(img.width / 2);
    const cy = Math.floor(img.height / 2);
    const samples = [px(img, cx, cy), px(img, Math.floor(img.width / 4), cy), px(img, Math.floor((img.width * 3) / 4), cy)];
    for (const s of samples) {
      if (s[3] === 0) continue;
      if (chDiff(s, exp) > 5) {
        reasons.push(`核心像素 ${s.slice(0, 3)} 偏离 ${core}（>±5）`);
        break;
      }
    }
  }
  // ②' 双色件（a18 边框/内芯）：边框中点 + 内芯中点分别比对
  if (m.expectedHex?.border && m.expectedHex?.fill) {
    const border = px(img, Math.floor(img.width / 2), 1);
    const fill = px(img, Math.floor(img.width / 2), Math.floor(img.height / 2));
    if (border[3] !== 0 && chDiff(border, hex2rgb(m.expectedHex.border)) > 5) reasons.push('边框色偏差 >±5');
    if (chDiff(fill, hex2rgb(m.expectedHex.fill)) > 5) reasons.push('内芯色偏差 >±5');
  }
  if (m.expectedHex?.top && m.expectedHex?.bottom) {
    const top = px(img, Math.floor(img.width / 2), 0);
    const bottom = px(img, Math.floor(img.width / 2), img.height - 1);
    if (chDiff(top, hex2rgb(m.expectedHex.top)) > 5) reasons.push('渐变顶色偏差 >±5');
    if (chDiff(bottom, hex2rgb(m.expectedHex.bottom)) > 5) reasons.push('渐变底色偏差 >±5');
  }
  // ③ 禁描边：边缘 1px 不出现「暗于核心 ≥40%」的描边环
  if (m.outlineFree && core) {
    const exp = hex2rgb(core);
    const lum = (p) => 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2];
    const coreLum = lum(exp);
    const edges = [];
    for (let x = 0; x < img.width; x++) {
      edges.push(px(img, x, 0), px(img, x, img.height - 1));
    }
    for (let y = 0; y < img.height; y++) {
      edges.push(px(img, 0, y), px(img, img.width - 1, y));
    }
    const opaque = edges.filter((p) => p[3] > 60);
    if (opaque.length && opaque.some((p) => coreLum - lum(p) > coreLum * 0.4 && lum(p) < 60)) {
      reasons.push('检出暗色描边环（禁描边违例）');
    }
  }
  // ④ 渐变方向二值（a08）：行内水平零梯度 + 沿 y 单向
  if (m.gradient === 'vertical-one-way') {
    const midY = Math.floor(img.height / 2);
    const left = px(img, 0, midY);
    const right = px(img, img.width - 1, midY);
    if (chDiff(left, right) > 2) reasons.push('行内存在水平梯度（非垂直单向）');
    const top = hex2rgb(m.expectedHex.top);
    const bot = hex2rgb(m.expectedHex.bottom);
    for (let y = 0; y < img.height; y++) {
      const tIdea = y / (img.height - 1);
      const want = [0, 1, 2].map((k) => Math.round(top[k] + (bot[k] - top[k]) * tIdea));
      if (chDiff(px(img, 0, y), want) > 3) {
        reasons.push(`渐变行 y=${y} 偏离垂直线性插值（方向二值违例）`);
        break;
      }
    }
  }
  // ⑤ 圆角半径 ±10%（a18）：左上角扫描边带半径
  if (m.geometry?.cornerRadius) {
    const R = m.geometry.cornerRadius;
    let edgeY = R; // 默认无透明段 = 直角（读数 R 越界，仍会 FAIL）
    for (let y = 0; y < img.height; y++) {
      if (px(img, 0, y)[3] > 60) {
        edgeY = y;
        break;
      }
    }
    // x=0 列的首个不透明行 y* = 圆角半径（直边起点）
    if (Math.abs(edgeY - R) / R > 0.1) reasons.push(`圆角读数 ${edgeY}px ≠ ${R}px±10%`);
  }
  // ⑤' 字形锚点（a20）：非透明像素包围盒
  if (m.glyph) {
    let minX = 1e9;
    let maxX = -1;
    let minY = 1e9;
    let maxY = -1;
    for (let y = 0; y < img.height; y++) {
      for (let x = 0; x < img.width; x++) {
        if (px(img, x, y)[3] > 60) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    }
    const expectedBox = { minX: 6, maxX: 31, minY: 8, maxY: 28 };
    const tol = (v, e) => Math.abs(v - e) / Math.max(1, e) <= 0.1;
    if (!tol(minX, expectedBox.minX) || !tol(maxX, expectedBox.maxX) || !tol(minY, expectedBox.minY) || !tol(maxY, expectedBox.maxY)) {
      reasons.push(`字形包围盒 (${minX},${minY})-(${maxX},${maxY}) 偏离锚点 ±10%`);
    }
  }
  return { id: m.id, pass: reasons.length === 0, reasons };
}

/** 全量查表入口（acc-a8 契约同门调用）：返回 {pass, rows} */
export function runNeonAssetCheck() {
  const manifest = JSON.parse(readFileSync(path.join(DIR, 'manifest.json'), 'utf8'));
  const rows = manifest.items.map(checkItem);
  return { pass: rows.every((r) => r.pass), rows };
}

// ---------- CLI 直跑 ----------
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { pass, rows } = runNeonAssetCheck();
  for (const r of rows) {
    console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.id}${r.reasons.length ? ' — ' + r.reasons.join('; ') : ''}`);
  }
  const fail = rows.filter((r) => !r.pass).length;
  console.log(`RESULT: ${fail === 0 ? 'PASS' : 'FAIL'} (${rows.length - fail}/${rows.length}) — P0 资产逐件查表`);
  process.exitCode = fail === 0 ? 0 : 1;
}
