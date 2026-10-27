// check-pixel-palette.mjs —— 栅格像素级调色板审计（2026-10-27 · 美术线独立机判）
// 手写最小 PNG 解码（node:zlib inflate + unfilter 0-4），零复用生成链 pnglib/check-assets 实现。
// 判定：不透明像素 ∈ 风格卡 v1 冻结 8 色板；alpha=0=圆角/间隙（合规）；0<alpha<255=投影档（逐组披露）。
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

const PALETTE = {
  '#F2EFE6': 'ground', '#D9D2C5': 'gridLine/obstacle', '#2B2D42': 'ink', '#111111': 'shadow',
  '#EF4444': 'target', '#F59E0B': 'carWarm', '#10B981': 'carCool', '#3B82F6': 'carAlt',
};
const hex = (r, g, b) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();

function decodePng(path) {
  const buf = readFileSync(path);
  if (buf.toString('ascii', 1, 4) !== 'PNG') throw new Error(`${path}: 非 PNG`);
  let off = 8, ihdr = null, idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off), type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') ihdr = { w: data.readUInt32BE(0), h: data.readUInt32BE(4), depth: data[8], colorType: data[9], interlace: data[12] };
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (ihdr.depth !== 8 || (ihdr.colorType !== 6 && ihdr.colorType !== 2) || ihdr.interlace !== 0)
    throw new Error(`${path}: 不支持的格式 depth=${ihdr.depth} colorType=${ihdr.colorType}`);
  const bpp = ihdr.colorType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = ihdr.w * bpp;
  const out = Buffer.alloc(ihdr.h * stride);
  const p = (x, y, c) => out[y * stride + x];
  let pos = 0;
  const paeth = (a, b, c) => { const t = a + b - c, da = Math.abs(t - a), db = Math.abs(t - b), dc = Math.abs(t - c); return da <= db && da <= dc ? a : db <= dc ? b : c; };
  for (let y = 0; y < ihdr.h; y++) {
    const f = raw[pos++];
    for (let x = 0; x < stride; x++) {
      const cur = raw[pos++];
      const left = x >= bpp ? out[y * stride + x - bpp] : 0;
      const up = y > 0 ? out[(y - 1) * stride + x] : 0;
      const ul = y > 0 && x >= bpp ? out[(y - 1) * stride + x - bpp] : 0;
      let v;
      if (f === 0) v = cur;
      else if (f === 1) v = cur + left;
      else if (f === 2) v = cur + up;
      else if (f === 3) v = cur + ((left + up) >> 1);
      else v = cur + paeth(left, up, ul);
      out[y * stride + x] = v & 0xff;
    }
  }
  return { ihdr, bpp, out };
}

const files = ['a01-lot-tiles', 'a02-car-set', 'a03-exit-gate', 'a04-guide-hand', 'a05-ui-hud'];
let findings = 0;
for (const name of files) {
  const { ihdr, bpp, out } = decodePng(`games/line4-unblock-jam/assets/${name}.png`);
  const opaque = new Map(), trans = { n: 0 }, partial = new Map();
  for (let i = 0; i < ihdr.w * ihdr.h; i++) {
    const r = out[i * bpp], g = out[i * bpp + 1], b = out[i * bpp + 2];
    const a = bpp === 4 ? out[i * bpp + 3] : 255;
    if (a === 0) trans.n++;
    else if (a === 255) { const k = hex(r, g, b); opaque.set(k, (opaque.get(k) || 0) + 1); }
    else { const k = `${hex(r, g, b)}@${(a / 255 * 100).toFixed(0)}%`; partial.set(k, (partial.get(k) || 0) + 1); }
  }
  const offPal = [...opaque.keys()].filter((k) => !(k in PALETTE));
  // token+alpha 判例（§八(b3)：alpha 属模板面）——半透明像素 RGB ∈ 冻结板即合规，档位逐组披露
  const offPartial = [...partial.keys()].filter((k) => !(k.slice(0, 7) in PALETTE));
  const ok = offPal.length === 0 && offPartial.length === 0;
  if (!ok) findings++;
  console.log(`${ok ? 'PASS' : 'FINDING'}  ${name}.png  ${ihdr.w}x${ihdr.h} colorType=${ihdr.colorType}`);
  console.log(`   不透明色 ${opaque.size} 组: ${[...opaque.entries()].map(([k, n]) => `${k}${PALETTE[k] ? '(' + PALETTE[k] + ')' : ''}×${n}`).join(' ')}`);
  console.log(`   透明像素 ${trans.n}（圆角/间隙）· 半透明 ${partial.size} 组: ${[...partial.entries()].map(([k, n]) => `${k}×${n}`).join(' ') || '无'}`);
  if (offPal.length) console.log(`   ⚠️ 白名单外不透明色: ${offPal.join(',')}`);
  if (offPartial.length) console.log(`   ⚠️ 非投影半透明色: ${offPartial.join(',')}`);
}
console.log(findings === 0 ? '== 像素审计 PASS=5 FAIL=0 ==' : `== 像素审计 FINDINGS=${findings} ==`);
