/**
 * BGM 环素材生成器（B0 · wx-runtime 落点 src/audio/bgm.ts 的 LOOP_MS=9600 对应件）。
 *
 * 确定性：无随机数；全部泛音频率取 f0=1/9.6s 的整数倍（锁相）→ 首尾相位连续无缝环。
 * 链路：进程内合成 16-bit PCM 44.1kHz 单声道 WAV → /usr/bin/afconvert AAC m4a（与 sfx-pack 同链）。
 * 产出：assets/bgm/neon-loop.m4a + manifest.json（durationMs/sha256）。
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GAME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(GAME, 'assets/bgm');
const LOOP_MS = 9600;
const SAMPLE_RATE = 44100;
const N = Math.round((SAMPLE_RATE * LOOP_MS) / 1000); // 423360 样本，整周锁相
const F0 = 1 / (LOOP_MS / 1000); // 0.104166…Hz；谐波 = k×F0 保证无缝

// 霓虹夜和弦垫（四小节，每小节 2.4s = F0×23.04 → 小节边界用 1/4 周期整点）
// 频率全部 snap 到整数倍 F0（偏差 <5 音分，听感等音、环缝为零）
const snap = (hz) => Math.round(hz / F0) * F0;
const CHORDS = [
  [snap(110.0), snap(164.81), snap(220.0)], // Am（A2 E3 A3）
  [snap(87.31), snap(130.81), snap(174.61)], // F（F2 C3 F3）
  [snap(98.0), snap(146.83), snap(196.0)], // C（G2 D3 G3）
  [snap(98.0), snap(146.83), snap(246.94)], // G（G2 D3 B3）
];

function synth() {
  const pcm = new Float64Array(N);
  const barN = Math.floor(N / 4);
  const attack = Math.floor(SAMPLE_RATE * 0.12); // 120ms 起音
  const release = Math.floor(SAMPLE_RATE * 0.3); // 300ms 释放
  for (let bar = 0; bar < 4; bar++) {
    const freqs = CHORDS[bar];
    for (let i = 0; i < barN; i++) {
      const t = i / SAMPLE_RATE;
      const env =
        (i < attack ? i / attack : 1) * (i > barN - release ? Math.max(0, (barN - i) / release) : 1);
      let s = 0;
      for (const f of freqs) {
        // 基音 + 二次/三次轻泛音（triangle 质感），相位随全局样本序连续 → 环无缝
        const phase = (f * t) % 1;
        s += 0.5 * (2 * Math.abs(2 * phase - 1)) - 0.5; // triangle in [−0.5,0.5]
        const phase3 = (3 * f * t) % 1;
        s += 0.12 * (2 * Math.abs(2 * phase3 - 1)) - 0.06;
      }
      // 小节交替的亚低音脉冲（K 节奏感，仍锁相）
      if (i % Math.floor(SAMPLE_RATE * 0.6) < SAMPLE_RATE * 0.04) {
        const bassF = snap(freqs[0] / 2);
        s += 0.35 * Math.sin(2 * Math.PI * bassF * t);
      }
      pcm[bar * barN + i] += s * env;
    }
  }
  // 归一 + 轻上限（0.72 峰值，垫底音量；wx 侧 volume 0.6 二次衰减）
  let peak = 0;
  for (let i = 0; i < N; i++) {
    const a = Math.abs(pcm[i]);
    if (a > peak) peak = a;
  }
  if (peak === 0) peak = 1;
  const out = Buffer.alloc(N * 2);
  for (let i = 0; i < N; i++) {
    const v = Math.round((pcm[i] / peak) * 0.72 * 32767);
    out.writeInt16LE(v, i * 2);
  }
  return out;
}

function wavHeader(pcm) {
  const hdr = Buffer.alloc(44);
  hdr.write('RIFF', 0);
  hdr.writeUInt32LE(36 + pcm.length, 4);
  hdr.write('WAVE', 8);
  hdr.write('fmt ', 12);
  hdr.writeUInt32LE(16, 16);
  hdr.writeUInt16LE(1, 20); // PCM
  hdr.writeUInt16LE(1, 22); // mono
  hdr.writeUInt32LE(SAMPLE_RATE, 24);
  hdr.writeUInt32LE(SAMPLE_RATE * 2, 28);
  hdr.writeUInt16LE(2, 32);
  hdr.writeUInt16LE(16, 34);
  hdr.write('data', 36);
  hdr.writeUInt32LE(pcm.length, 40);
  return hdr;
}

function run(cmd, args, label) {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  if (r.status !== 0) {
    console.error(`[fail] ${label}: ${cmd} ${args.join(' ')}\n${r.stderr || r.stdout}`);
    process.exit(1);
  }
  console.log(`[ok  ] ${label}`);
}

mkdirSync(OUT_DIR, { recursive: true });
const wavPath = path.join(OUT_DIR, 'neon-loop.wav');
const m4aPath = path.join(OUT_DIR, 'neon-loop.m4a');
writeFileSync(wavPath, Buffer.concat([wavHeader(synth()), synth()]));
run('/usr/bin/afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '48000', wavPath, m4aPath], 'neon-loop.m4a');
rmSync(wavPath);

const manifest = {
  id: 'bgm-neon-loop-v1',
  file: 'neon-loop.m4a',
  durationMs: LOOP_MS,
  sampleRate: SAMPLE_RATE,
  channels: 1,
  sha256: createHash('sha256').update(readFileSync(m4aPath)).digest('hex'),
  note: 'wx BGM 环素材（f0 锁相无缝环）；LOOP_MS 常量在 src/audio/bgm.ts，两者同值由 tests/wx/bgm-loop-wx.spec.mjs 断言',
};
writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`[out ] ${m4aPath}  ${(statSyncSize(m4aPath) / 1024).toFixed(1)}KB  sha256=${manifest.sha256.slice(0, 16)}…`);
console.log(`[done] BGM 环素材就绪（${LOOP_MS}ms 无缝环）`);

function statSyncSize(p) {
  return readFileSync(p).length;
}
