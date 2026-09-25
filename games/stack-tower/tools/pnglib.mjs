/**
 * 零依赖 PNG 编码 + 软件栅格（素材生成器底层，gen-assets.mjs 专用）。
 * 产物 = 8-bit RGBA PNG（zlib deflate + CRC32，Node 内置，无 npm 依赖）。
 * 纪律：确定性绘制（固定 seed 噪声），同一命令重复产出逐字节一致。
 */
import { deflateSync } from 'node:zlib';

// ---------- CRC32 ----------
const CRC_TABLE = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c;
}

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

/** RGBA 栅格 → PNG Buffer（filter 0 逐行） */
export function encodePng(img) {
  const { width: w, height: h, data } = img;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    data.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** '#rrggbb' → [r,g,b]（与 render/palette 同源色值） */
export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** 明度系数缩放（与 palette.shade 同语义：factor 1=原色） */
export function shadeRgb(rgb, factor) {
  return rgb.map((v) => Math.round(v * factor));
}

// ---------- 栅格 ----------
export class Raster {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.data = Buffer.alloc(width * height * 4, 0);
  }

  /** alpha 混合写单像素（srcA 0..255） */
  blend(x, y, [r, g, b], a) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height || a <= 0) return;
    const i = (y * this.width + x) * 4;
    const sa = Math.min(255, a);
    const da = this.data[i + 3];
    const outA = sa + (da * (255 - sa)) / 255;
    if (outA <= 0) return;
    for (let k = 0; k < 3; k++) {
      this.data[i + k] = Math.round((r * sa + this.data[i + k] * da * (255 - sa) / 255) / outA);
    }
    this.data[i + 3] = Math.round(outA);
  }

  fillRect(x, y, w, h, rgb, a = 255) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.blend(xx, yy, rgb, a);
  }

  /** 混凝土颗粒噪声：确定性 mulberry32，逐像素明度扰动（风格卡 §1 程序化材质） */
  grain(seed, amp = 5, alphaFloor = 0.9) {
    let s = seed >>> 0;
    const next = () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const i = (y * this.width + x) * 4;
        if (this.data[i + 3] === 0) continue;
        const d = Math.round((next() * 2 - 1) * amp);
        for (let k = 0; k < 3; k++) {
          const v = this.data[i + k] + d;
          this.data[i + k] = Math.max(0, Math.min(255, v));
        }
        this.data[i + 3] = Math.round(this.data[i + 3] * (alphaFloor + next() * (1 - alphaFloor)));
      }
    }
  }
}
