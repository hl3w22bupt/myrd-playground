#!/usr/bin/env node
/**
 * pixel-fives 资产生产线 —— gen-audio.mjs
 * 职责：按 assets/a08-sfx-goal-hit.spec.json 确定性合成 A08 进球音效 → 16bit PCM WAV。
 *       同 seed 必同比特（QA 可复现）。零 npm 依赖。
 * 用法：node pixel-fives/tools/gen-audio.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SPEC = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'a08-sfx-goal-hit.spec.json'), 'utf8'))
const OUT = path.join(ROOT, SPEC.build_output || path.join('assets', 'out', 'a08-sfx-goal-hit.wav'))

const SR = SPEC.format.sample_rate_hz
const DUR = SPEC.format.duration_s
const N = Math.round(SR * DUR)
const db2lin = (db) => Math.pow(10, db / 20)

// 确定性 LCG 噪声（-1..1）
function lcgNoise(seed) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return (s / 0x100000000) * 2 - 1
  }
}

// RBJ 二阶 biquad，direct form I
function biquad(kind, { f0, q, cutoff }) {
  const w0 = (2 * Math.PI * (f0 ?? cutoff)) / SR
  const cos = Math.cos(w0), sin = Math.sin(w0)
  const alpha = sin / (2 * (q ?? 0.707))
  let b0, b1, b2, a0, a1, a2
  if (kind === 'bandpass') { b0 = alpha; b1 = 0; b2 = -alpha; a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha }
  else { b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = (1 - cos) / 2; a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha }
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0, x1: 0, x2: 0, y1: 0, y2: 0 }
}
function runFilt(st, x) {
  const y = st.b0 * x + st.b1 * st.x1 + st.b2 * st.x2 - st.a1 * st.y1 - st.a2 * st.y2
  st.x2 = st.x1; st.x1 = x; st.y2 = st.y1; st.y1 = y
  return y
}
// 包络：attack 线性升至 1，随后 exp 衰减
function envAt(t, attack, decay) {
  if (t < attack) return t / Math.max(attack, 1e-6)
  return Math.exp(-(t - attack) / Math.max(decay, 1e-6))
}
// 梯形包络：attack 升 → hold → release 降
function envTrap(t, attack, release, total) {
  if (t < attack) return t / Math.max(attack, 1e-6)
  if (t > total - release) return Math.max(0, (total - t) / Math.max(release, 1e-6))
  return 1
}

const mix = new Float64Array(N)
for (const layer of SPEC.layers) {
  const g = db2lin(layer.gain_db)
  if (layer.type === 'bandpass-noise') {
    const noise = lcgNoise(SPEC.format.seed)
    const st = biquad('bandpass', { f0: layer.center_hz, q: layer.q })
    for (let i = 0; i < N; i++) {
      const t = i / SR
      mix[i] += g * envAt(t, layer.attack_s, layer.decay_s) * runFilt(st, noise())
    }
  } else if (layer.type === 'lowpass-noise') {
    const noise = lcgNoise((SPEC.format.seed ^ 0x5f5f5f5f) >>> 0)
    const st = biquad('lowpass', { cutoff: layer.cutoff_hz })
    for (let i = 0; i < N; i++) {
      const t = i / SR
      mix[i] += g * envTrap(t, layer.attack_s, layer.release_s, DUR) * runFilt(st, noise())
    }
  } else if (layer.type === 'sine-sweep') {
    let phase = 0
    for (let i = 0; i < N; i++) {
      const t = i / SR
      const k = Math.min(1, t / layer.decay_s)
      const f = layer.freq_hz + (layer.end_freq_hz - layer.freq_hz) * k
      phase += (2 * Math.PI * f) / SR
      mix[i] += g * envAt(t, layer.attack_s, layer.decay_s) * Math.sin(phase)
    }
  } else {
    console.error(`[FAIL] 未知图层类型: ${layer.type}`)
    process.exit(1)
  }
  console.log(`[layer] ${layer.name} 混入 (gain ${layer.gain_db}dB)`)
}

// 归一化到目标 dBFS（峰值），限幅
const peak = mix.reduce((m, v) => Math.max(m, Math.abs(v)), 0)
const norm = peak > 0 ? db2lin(SPEC.format.normalize_dbfs) / peak : 1
const pcm = Buffer.alloc(N * 2)
let clipped = 0
for (let i = 0; i < N; i++) {
  let v = mix[i] * norm
  if (v > 1) { v = 1; clipped++ }
  if (v < -1) { v = -1; clipped++ }
  pcm.writeInt16LE(Math.round(v * 32767), i * 2)
}

// WAV 封装（RIFF）
const hdr = Buffer.alloc(44)
hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + pcm.length, 4); hdr.write('WAVE', 8)
hdr.write('fmt ', 12); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20)
hdr.writeUInt16LE(1, 22); hdr.writeUInt32LE(SR, 24); hdr.writeUInt32LE(SR * 2, 28)
hdr.writeUInt16LE(2, 32); hdr.writeUInt16LE(16, 34)
hdr.write('data', 36); hdr.writeUInt32LE(pcm.length, 40)

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, Buffer.concat([hdr, pcm]))
const bytes = fs.statSync(OUT).size
console.log(`[OK] ${path.relative(ROOT, OUT)}  ${bytes}B  ${DUR}s/${SR}Hz/16bit mono  seed=${SPEC.format.seed}  clipped=${clipped}`)
console.log(`[hint] 回填 manifest：node pixel-fives/tools/gen-assets.mjs`)
