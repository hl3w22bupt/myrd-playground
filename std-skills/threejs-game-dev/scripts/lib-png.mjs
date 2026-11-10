/**
 * lib-png.mjs —— 工坊资产/证据脚本共用的零依赖 PNG 编解码 + 感知哈希（pHash）。
 *
 * 服务两个消费方（同一目录内相对导入，随技能目录整体注入工作区）：
 *   - asset-triple-check.mjs：firstColorCount 抽样需要逐像素读 RGBA；
 *   - visual-ratchet.mjs：相邻证据包 diff 需要缩略灰度 + DCT 感知哈希。
 *
 * 为什么不用 npm 依赖（sharp/jimp/pngjs）：判定脚本必须「仓库内零安装成本」——
 * 工作区是模板仓 worktree，跑门禁前不该要求 npm install（与 preflight.mjs /
 * mobile-web-smoke.mjs 的零依赖纪律一致）。
 *
 * 能力边界（显式声明，调用方按「无法解析」降级，不冒充通过）：
 *   - 支持 bit depth 8、非隔行（Adam7 interlace 不支持）；
 *   - 支持 color type 0（灰度）/ 2（RGB）/ 3（调色板）/ 4（灰度+alpha）/ 6（RGBA）；
 *   - JPEG / WebP 不支持（截图证据链与 generate_image 产物都是 PNG；遇到即抛 PngError）。
 */

import { inflateSync, deflateSync } from "node:zlib";

export class PngError extends Error {}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CHANNELS_BY_COLOR_TYPE = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

/** Paeth 预测器（PNG 规范 §6.3） */
function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/**
 * 解码 PNG → RGBA。不支持形态（16-bit / 隔行 / 损坏 / 非 PNG）抛 PngError，
 * 由调用方决定「无法解析」的降级语义（绝不静默当成功）。
 */
export function decodePng(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 8 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new PngError("不是 PNG（签名不符）");
  }
  let off = 8;
  let ihdr = null;
  let palette = null;
  const idat = [];
  while (off + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(off);
    const type = buffer.subarray(off + 4, off + 8).toString("ascii");
    const data = buffer.subarray(off + 8, off + 8 + length);
    if (type === "IHDR") {
      ihdr = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        compression: data[10],
        filter: data[11],
        interlace: data[12],
      };
    } else if (type === "PLTE") {
      palette = data;
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    off += 12 + length;
  }
  if (!ihdr) throw new PngError("PNG 缺 IHDR");
  const { width, height, bitDepth, colorType, interlace } = ihdr;
  if (width <= 0 || height <= 0) throw new PngError(`非法尺寸 ${width}x${height}`);
  if (bitDepth !== 8) throw new PngError(`不支持 bit depth ${bitDepth}（仅支持 8）`);
  if (interlace !== 0) throw new PngError("不支持隔行（Adam7）PNG");
  if (!(colorType in CHANNELS_BY_COLOR_TYPE)) throw new PngError(`不支持的 color type ${colorType}`);
  if (colorType === 3 && !palette) throw new PngError("调色板 PNG 缺 PLTE");

  const channels = CHANNELS_BY_COLOR_TYPE[colorType];
  const stride = width * channels;
  let raw;
  try {
    raw = inflateSync(Buffer.concat(idat));
  } catch (e) {
    throw new PngError(`IDAT 解压失败: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (raw.length < (stride + 1) * height) {
    throw new PngError(`像素数据不足：期望 ${(stride + 1) * height} 字节，实际 ${raw.length}`);
  }

  // 逐扫描线反滤波（PNG 规范 §6：filter 0-4）
  const lines = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    for (let x = 0; x < stride; x += 1) {
      const rawByte = raw[src + x];
      const left = x >= channels ? lines[dst + x - channels] : 0;
      const up = y > 0 ? lines[dst - stride + x] : 0;
      const upLeft = y > 0 && x >= channels ? lines[dst - stride + x - channels] : 0;
      let value;
      switch (filter) {
        case 0: value = rawByte; break;
        case 1: value = rawByte + left; break;
        case 2: value = rawByte + up; break;
        case 3: value = rawByte + ((left + up) >> 1); break;
        case 4: value = rawByte + paeth(left, up, upLeft); break;
        default: throw new PngError(`未知滤波器类型 ${filter}`);
      }
      lines[dst + x] = value & 0xff;
    }
  }

  // 展开成 RGBA
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    const o = i * channels;
    let r = 0, g = 0, b = 0, a = 255;
    switch (colorType) {
      case 0: r = g = b = lines[o]; break;
      case 2: r = lines[o]; g = lines[o + 1]; b = lines[o + 2]; break;
      case 3: {
        const idx = lines[o] * 3;
        r = palette[idx]; g = palette[idx + 1]; b = palette[idx + 2];
        break;
      }
      case 4: r = g = b = lines[o]; a = lines[o + 1]; break;
      case 6: r = lines[o]; g = lines[o + 1]; b = lines[o + 2]; a = lines[o + 3]; break;
      default: throw new PngError(`不支持的 color type ${colorType}`);
    }
    rgba[i * 4] = r;
    rgba[i * 4 + 1] = g;
    rgba[i * 4 + 2] = b;
    rgba[i * 4 + 3] = a;
  }
  return { width, height, rgba };
}

/** CRC32（PNG 编码用，纯查表实现） */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

/**
 * 编码最小 PNG（8-bit RGBA、filter 0 全 None）—— 仅供自测/夹具使用（给 firstColorCount
 * 与 pHash 造确定像素），不追求压缩率。
 */
export function encodePng(width, height, rgba) {
  if (rgba.length !== width * height * 4) throw new PngError("rgba 长度与尺寸不符");
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

/** RGBA → 灰度（0-255，ITU-R BT.601 加权） */
export function toGrayscale(rgba, width, height) {
  const gray = new Float64Array(width * height);
  for (let i = 0; i < width * height; i += 1) {
    gray[i] = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
  }
  return gray;
}

/** 盒式缩略（box average）到 size×size 灰度 —— pHash 的标准预处理 */
export function resizeGrayscale(gray, width, height, size) {
  const out = new Float64Array(size * size);
  for (let ty = 0; ty < size; ty += 1) {
    const y0 = Math.floor((ty * height) / size);
    const y1 = Math.max(y0 + 1, Math.floor(((ty + 1) * height) / size));
    for (let tx = 0; tx < size; tx += 1) {
      const x0 = Math.floor((tx * width) / size);
      const x1 = Math.max(x0 + 1, Math.floor(((tx + 1) * width) / size));
      let sum = 0;
      let count = 0;
      for (let y = y0; y < y1 && y < height; y += 1) {
        for (let x = x0; x < x1 && x < width; x += 1) {
          sum += gray[y * width + x];
          count += 1;
        }
      }
      out[ty * size + tx] = count > 0 ? sum / count : 0;
    }
  }
  return out;
}

/** 一维 DCT-II（长度 N；O(N²) 直接实现 —— N=32 时每行 1024 次乘加，量级无害） */
function dct1d(input) {
  const n = input.length;
  const out = new Float64Array(n);
  for (let u = 0; u < n; u += 1) {
    let sum = 0;
    for (let x = 0; x < n; x += 1) {
      sum += input[x] * Math.cos(((2 * x + 1) * u * Math.PI) / (2 * n));
    }
    out[u] = sum;
  }
  return out;
}

/**
 * pHash（64-bit，返回 16 位 hex 字符串）：
 * 32×32 缩略灰度 → 二维 DCT（行列两次一维 DCT）→ 取左上 8×8 低频 → 以中值为阈值编位。
 * 与常见实现口径一致（pHash.net / imagehash(phash) 同形），hex 串可直接入库比对。
 */
export function pHash(rgba, width, height) {
  const SIZE = 32;
  const LOW = 8;
  const small = resizeGrayscale(toGrayscale(rgba, width, height), width, height, SIZE);
  // 行列两次一维 DCT（可分离）
  const rows = new Float64Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y += 1) {
    const row = dct1d(small.subarray(y * SIZE, (y + 1) * SIZE));
    for (let x = 0; x < SIZE; x += 1) rows[y * SIZE + x] = row[x];
  }
  const freq = new Float64Array(LOW * LOW);
  for (let x = 0; x < LOW; x += 1) {
    const col = new Float64Array(SIZE);
    for (let y = 0; y < SIZE; y += 1) col[y] = rows[y * SIZE + x];
    const out = dct1d(col);
    for (let y = 0; y < LOW; y += 1) freq[y * LOW + x] = out[y];
  }
  const sorted = Float64Array.from(freq).sort();
  const median = (sorted[31] + sorted[32]) / 2;
  let bits = "";
  for (let i = 0; i < LOW * LOW; i += 1) bits += freq[i] > median ? "1" : "0";
  // 64 bit → 16 hex
  let hex = "";
  for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return hex;
}

/** 两个 pHash hex 的相似度 = 1 - hamming/64（0-1，越大越像） */
export function pHashSimilarity(hexA, hexB) {
  if (hexA.length !== hexB.length) return 0;
  let distance = 0;
  for (let i = 0; i < hexA.length; i += 1) {
    const a = parseInt(hexA[i], 16);
    const b = parseInt(hexB[i], 16);
    let x = a ^ b;
    while (x) {
      distance += x & 1;
      x >>= 1;
    }
  }
  return 1 - distance / 64;
}
