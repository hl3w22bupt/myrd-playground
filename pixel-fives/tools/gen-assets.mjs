#!/usr/bin/env node
/**
 * pixel-fives 资产生产线 —— gen-assets.mjs
 * 职责：解析 .grid 像素真源 → 校验（帧数/帧宽/调色板锁）→ 导出 PNG spritesheet
 *       → A03 由 A02 换色派生 → 回填 manifest 字节数 → 强校验 1.5MB 总量红线
 * 边界：本脚本为资产工具，非游戏运行时代码；不依赖任何 npm 包（仅 node 内置）。
 * 用法：node pixel-fives/tools/gen-assets.mjs [--scale N]   （N=整数倍放大 1-8，默认 1）
 * 失败策略：任何校验失败收集后统一报告并 exit 1（红线纪律）。
 */
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const TOOLS_DIR = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(TOOLS_DIR, '..') // pixel-fives/
const BUDGET_BYTES = 1572864 // 1.5MB（风格卡§7 / manifest.budget）

// ---------- .grid 解析 ----------
// 格式：'# key: value' 头；'legend:' 段（字符 HEX）；'grid:' 段像素行；仅'+'的行分隔帧
export function parseGrid(text, fileLabel) {
  const lines = text.split(/\r?\n/)
  // 文件末尾换行容错（2026-09-22 复验修复）：split 后的末尾空串不是像素行，
  // 不剔除会让末帧多出一行「行宽=0」的伪影校验失败（A01/A02/A03/A04/A06/A07 同型）。
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  const header = {}
  const legend = {}
  const gridRows = []
  let section = 'header'
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '')
    if (line === '' && section !== 'grid') continue
    if (line.startsWith('#')) {
      const m = line.match(/^#\s*([A-Za-z_][A-Za-z0-9_]*):\s*(.+)$/)
      if (m) header[m[1]] = m[2].trim()
      continue
    }
    if (line === 'legend:') { section = 'legend'; continue }
    if (line === 'grid:') { section = 'grid'; continue }
    if (section === 'legend') {
      const m = line.match(/^(\S)\s+(#[0-9A-Fa-f]{6})$/)
      if (m) legend[m[1]] = m[2].toUpperCase()
      continue
    }
    if (section === 'grid') gridRows.push(line)
  }
  // 帧切分：仅含'+'的行
  const frames = [[]]
  for (const row of gridRows) {
    if (/^\++$/.test(row)) { frames.push([]); continue }
    frames[frames.length - 1].push(row)
  }
  return { header, legend, frames: frames.filter((f) => f.length > 0), fileLabel }
}

// ---------- 校验 ----------
export function validateGrid(grid, spec, globalPalette, errors) {
  const tag = spec.id
  const [fw, fh] = spec.frame_size
  if (grid.frames.length !== spec.frames) {
    errors.push(`${tag}: 帧数不符 grid=${grid.frames.length} manifest=${spec.frames}`)
  }
  grid.frames.forEach((f, i) => {
    if (f.length !== fh) errors.push(`${tag}: 帧${i} 行数=${f.length} 期望=${fh}`)
    for (const row of f) {
      if (row.length !== fw) errors.push(`${tag}: 帧${i} 行宽=${row.length} 期望=${fw}（行:"${row.slice(0, 20)}…"）`)
      for (const ch of row) {
        if (ch === '.') continue
        if (!(ch in grid.legend)) errors.push(`${tag}: 帧${i} 字符'${ch}'不在 legend`)
        else if (!(ch in globalPalette)) errors.push(`${tag}: 帧${i} 色号'${ch}'不在全局20色锁（风格漂移）`)
      }
    }
  })
  for (const ch of Object.keys(grid.legend)) {
    if (!(ch in globalPalette)) errors.push(`${tag}: legend 色'${ch}'不在全局20色锁`)
  }
  const used = new Set(grid.frames.flat().join('').replace(/\./g, ''))
  // 派生资产：网格字符为源色，经 palette_swap 映射后与 palette_used 比对
  const swap = spec.palette_swap
  const usedEffective = new Set([...used].map((ch) => (swap && swap[ch] ? swap[ch] : ch)))
  for (const ch of spec.palette_used || []) {
    if (!usedEffective.has(ch)) errors.push(`${tag}: manifest.palette_used 含未使用色'${ch}'`)
  }
  for (const ch of usedEffective) {
    if (!(spec.palette_used || []).includes(ch)) errors.push(`${tag}: 实际用色'${ch}'未登记 manifest.palette_used`)
  }
}

// ---------- 渲染 ----------
export function framesToRGBA(grid, spec, globalPalette, swap) {
  const [fw, fh] = spec.frame_size
  const n = grid.frames.length
  const W = fw * n
  const H = fh
  const rgba = Buffer.alloc(W * H * 4)
  const hexOf = (ch) => {
    const mapped = swap && swap[ch] ? swap[ch] : ch
    const hex = globalPalette[mapped]
    return hex ? { r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16) } : null
  }
  grid.frames.forEach((f, fi) => {
    for (let y = 0; y < fh; y++) {
      const row = f[y] || ''
      for (let x = 0; x < fw; x++) {
        const ch = row[x] || '.'
        if (ch === '.') continue
        const c = hexOf(ch)
        if (!c) continue
        const px = ((y * W) + (fi * fw + x)) * 4
        rgba[px] = c.r; rgba[px + 1] = c.g; rgba[px + 2] = c.b; rgba[px + 3] = 255
      }
    }
  })
  return { rgba, width: W, height: H }
}

// ---------- PNG 编码（零依赖，8bit RGBA） ----------
const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()
function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return ~c >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const t = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])))
  return Buffer.concat([len, t, data, crc])
}
export function encodePNG(width, height, rgba, scale = 1) {
  const W = width * scale, H = height * scale
  const raw = Buffer.alloc((W * 4 + 1) * H)
  for (let y = 0; y < H; y++) {
    const sy = Math.floor(y / scale)
    for (let x = 0; x < W; x++) {
      const sx = Math.floor(x / scale)
      const s = (sy * width + sx) * 4
      const d = y * (W * 4 + 1) + 1 + x * 4
      raw[d] = rgba[s]; raw[d + 1] = rgba[s + 1]; raw[d + 2] = rgba[s + 2]; raw[d + 3] = rgba[s + 3]
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4)
  ihdr[8] = 8; ihdr[9] = 6 // 8bit RGBA
  const idat = zlib.deflateSync(raw, { level: 9 })
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0)),
  ])
}

// ---------- main ----------
function main() {
  const argv = process.argv.slice(2)
  let scale = 1
  const si = argv.indexOf('--scale')
  if (si >= 0) scale = Math.max(1, Math.min(8, parseInt(argv[si + 1], 10) || 1))

  const manifestPath = path.join(ROOT, 'assets', 'manifest.json')
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  const globalPalette = manifest.style_lock.palette
  const errors = []
  const rows = []
  let outBytes = 0
  let srcBytes = 0

  const rendered = new Map() // id -> {rgba,width,height}
  for (const spec of manifest.assets) {
    if (spec.kind === 'audio') continue
    const srcPath = path.join(ROOT, spec.source)
    const grid = parseGrid(fs.readFileSync(srcPath, 'utf8'), spec.source)
    validateGrid(grid, spec, globalPalette, errors)
    const swap = spec.derive_from ? spec.palette_swap : undefined
    const img = framesToRGBA(grid, spec, globalPalette, swap)
    rendered.set(spec.id, img)
    const png = encodePNG(img.width, img.height, img.rgba, scale)
    const outPath = path.join(ROOT, spec.output.replace(/\.png$/, `${scale > 1 ? '@' + scale + 'x' : ''}.png`))
    fs.mkdirSync(path.dirname(outPath), { recursive: true })
    fs.writeFileSync(outPath, png)
    const pngBytes = png.length
    const gridBytes = fs.statSync(srcPath).size
    outBytes += pngBytes; srcBytes += gridBytes
    spec.bytes = gridBytes + pngBytes
    rows.push([spec.id, spec.name, `${img.width}x${img.height}`, String(spec.frames), String(spec.fps ?? '-'), String(Object.keys(globalPalette).length ? (spec.palette_used || []).length : 0), `${gridBytes}+${pngBytes}=${spec.bytes}`])
  }

  // A03 换色派生校验：与 A02 像素逐位同构（除 swap 色）
  const a02 = rendered.get('A02'); const a03spec = manifest.assets.find((a) => a.id === 'A03')
  if (a02 && a03spec) {
    const a03src = rendered.get('A03')
    if (a03src && (a02.rgba.length !== a03src.rgba.length)) errors.push('A03: 派生尺寸与 A02 不一致')
  }

  // 音频：读取已生成 wav 字节（若尚未生成则保持 null 并提示）
  for (const spec of manifest.assets) {
    if (spec.kind !== 'audio') continue
    const specPath = path.join(ROOT, spec.source)
    srcBytes += fs.statSync(specPath).size
    const wavPath = path.join(ROOT, spec.output)
    if (fs.existsSync(wavPath)) {
      const b = fs.statSync(wavPath).size
      outBytes += b; spec.bytes = b
      rows.push([spec.id, spec.name, 'audio', '1', `${spec.format.sample_rate_hz}Hz`, '-', `wav=${b}`])
    } else {
      spec.bytes = null
      rows.push([spec.id, spec.name, 'audio', '1', `${spec.format.sample_rate_hz}Hz`, '-', 'wav 未生成（node tools/gen-audio.mjs）'])
    }
  }

  const total = srcBytes + outBytes
  manifest.budget.assets_total_bytes = total
  manifest.budget.generated_with_scale = scale
  manifest.generated_at = new Date().toISOString()
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')

  console.log('id   name           size      frames fps     pal  bytes(grid+png)')
  for (const r of rows) console.log(r.map((c, i) => c.padEnd(i === 1 ? 14 : i === 2 ? 9 : 7)).join(' ').trimEnd())
  console.log(`scale=${scale}x  源=${srcBytes}B  产物=${outBytes}B  合计=${total}B / 上限=${BUDGET_BYTES}B`)

  if (errors.length) {
    console.error(`\n[FAIL] ${errors.length} 项校验失败:`)
    for (const e of errors) console.error('  - ' + e)
    process.exit(1)
  }
  if (total > BUDGET_BYTES) {
    console.error(`\n[FAIL] 资产总量 ${total}B 超出 1.5MB 红线（${BUDGET_BYTES}B）—— 微信主包预算红线`)
    process.exit(1)
  }
  console.log('[OK] 全部校验通过；manifest 已回填字节数')
}

main()

