#!/usr/bin/env node
/**
 * 音效包生成器（T3 美术线 · sfx-pack-v1 → assets/sfx/ 12 文件）— 复现：
 *   node games/stack-tower/tools/gen-audio.mjs
 *
 * 规格纪律（spec v3 content.sfxPack / numeric.audio）：
 *   - 同源：音色参数唯一真源 = src/audio/voices.ts（本脚本解析取值，解析失败即失败，禁止私设）；
 *   - 命名：文件名 = `sfx-` + 事件 id，双格式 .m4a + .ogg 成对（6 事件 = 12 文件）；
 *   - 采样：44100Hz 单声道 16-bit PCM（numeric.audio.SAMPLE_RATE_HZ）；
 *   - 封顶：单事件 ≤400ms；restart ≤ RESTART_SFX_MAX_MS(200ms)，超限即非零退出；
 *   - 登记：assets/sfx/manifest.json（acc-a1 资产注册表完整性断言点）。
 */
import { mkdirSync, writeFileSync, readFileSync, statSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const GAME_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(GAME_DIR, 'assets', 'sfx');
const SAMPLE_RATE = 44100;

const fail = (m) => {
  console.error(`FAIL ${m}`);
  process.exit(1);
};

// ---------- 同源解析 voices.ts ----------
const src = readFileSync(join(GAME_DIR, 'src', 'audio', 'voices.ts'), 'utf8');
function parseVoices() {
  const idMatch = (re) => {
    const m = re.exec(src);
    if (!m) fail(`voices.ts 解析失败：${re}`);
    return m;
  };
  const ids = idMatch(/SFX_EVENT_IDS: SfxEventId\[\] = \[([^\]]+)\]/)[1]
    .split(',')
    .map((s) => s.trim().replace(/^'|'$/g, ''))
    .filter(Boolean);
  const tableSrc = idMatch(/export const SFX_VOICES[^=]*= \{([\s\S]*?)\n\};/)[1];
  const voices = {};
  for (const id of ids) {
    const entry = new RegExp(`'?${id}'?: \\{([^}]*)\\}`).exec(tableSrc);
    if (!entry) fail(`voices.ts 缺事件音色: ${id}`);
    const body = entry[1];
    const freqs = /freqs: \[([^\]]*)\]/.exec(body)[1].split(',').map((s) => Number(s.trim()));
    const durationMs = Number(/durationMs: (\d+)/.exec(body)[1]);
    const type = /type: '(\w+)'/.exec(body)[1];
    const gain = Number(/gain: ([\d.]+)/.exec(body)[1]);
    const critical = /critical: (true|false)/.exec(body)[1] === 'true';
    voices[id] = { freqs, durationMs, type, gain, critical };
  }
  return { ids, voices };
}
const { ids, voices } = parseVoices();
const RESTART_MAX_MS = 200; // numeric.audio.RESTART_SFX_MAX_MS（acc-a1 红线）
const EVENT_MAX_MS = 400; // spec acc-a1：单事件 ≤400ms
if (voices['restart'].durationMs + 60 + 8 > RESTART_MAX_MS)
  fail(`restart 成品时长将超 ${RESTART_MAX_MS}ms 红线（durationMs ${voices['restart'].durationMs}）`);
for (const id of ids) {
  const totalMs = voices[id].durationMs + (voices[id].freqs.length - 1) * 60 + 8;
  if (totalMs > EVENT_MAX_MS) fail(`事件 ${id} 成品时长 ${totalMs}ms 超 ${EVENT_MAX_MS}ms 上限`);
}

// ---------- 合成：16-bit PCM mono ----------
function synthVoice(v) {
  const totalMs = v.durationMs + (v.freqs.length - 1) * 60 + 8; // 尾音 8ms 收零防爆音
  const n = Math.ceil((totalMs / 1000) * SAMPLE_RATE);
  const pcm = new Float64Array(n);
  const tau = v.durationMs / Math.log(1000); // 指数衰减：尾部 ≈ 峰值 0.1%
  for (let i = 0; i < v.freqs.length; i++) {
    const f = v.freqs[i];
    const startS = (i * 60) / 1000;
    const durS = v.durationMs / 1000;
    const i0 = Math.floor(startS * SAMPLE_RATE);
    const i1 = Math.min(n, Math.ceil((startS + durS) * SAMPLE_RATE));
    for (let i = i0; i < i1; i++) {
      const t = i / SAMPLE_RATE - startS;
      const ph = 2 * Math.PI * f * t;
      let s;
      if (v.type === 'sine') s = Math.sin(ph);
      else if (v.type === 'triangle') s = (2 / Math.PI) * Math.asin(Math.sin(ph));
      else if (v.type === 'sawtooth') s = 2 * (t * f - Math.floor(t * f + 0.5));
      else s = Math.sign(Math.sin(ph)); // square
      // 包络：3ms 起音 + 指数衰减 + 末 3ms 收零
      const envAttack = Math.min(1, t / 0.003);
      const envRelease = Math.min(1, (durS - t) / 0.003);
      pcm[i] += v.gain * s * Math.exp(-t / tau) * envAttack * Math.max(0, envRelease);
    }
  }
  const out = new Int16Array(n);
  for (let i = 0; i < n; i++) out[i] = Math.max(-1, Math.min(1, pcm[i])) * 32767;
  return { pcm: out, durationMs: Math.round((n / SAMPLE_RATE) * 1000) };
}

function wavBytes(pcm) {
  const dataBytes = pcm.length * 2;
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SAMPLE_RATE, 24);
  buf.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < pcm.length; i++) buf.writeInt16LE(pcm[i], 44 + i * 2);
  return buf;
}

function run(cmd, args, what) {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  if (r.status !== 0) fail(`${what} 失败（${cmd} exit ${r.status}）: ${(r.stderr || r.stdout || '').split('\n')[0]}`);
}

// ---------- 生成 12 文件 + manifest ----------
mkdirSync(OUT_DIR, { recursive: true });
const manifest = {
  id: 'sfx-pack-v1',
  naming: '文件名 = `sfx-` + 事件 id；双格式 .m4a + .ogg 成对',
  sampleRateHz: SAMPLE_RATE,
  channels: 1,
  source: 'generated（tools/gen-audio.mjs ← src/audio/voices.ts 同源音色表）',
  events: {},
};
let total = 0;
for (const id of ids) {
  const { pcm, durationMs } = synthVoice(voices[id]);
  const stem = `sfx-${id}`;
  const wavPath = join(OUT_DIR, `${stem}.wav`);
  writeFileSync(wavPath, wavBytes(pcm));
  run('/usr/bin/afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '48000', wavPath, join(OUT_DIR, `${stem}.m4a`)], `${stem}.m4a`);
  // ogg：oggenc（vorbis-tools）—— 真 44.1kHz 单声道 Vorbis（本机 ffmpeg 无 libvorbis，原生编码器拒单声道）
  run('oggenc', ['-Q', '-q', '3', '-o', join(OUT_DIR, `${stem}.ogg`), wavPath], `${stem}.ogg`);
  rmSync(wavPath);
  const sizes = {};
  for (const ext of ['m4a', 'ogg']) {
    const kb = statSync(join(OUT_DIR, `${stem}.${ext}`)).size / 1024;
    if (statSync(join(OUT_DIR, `${stem}.${ext}`)).size === 0) fail(`${stem}.${ext} 为空文件`);
    sizes[`${ext}Kb`] = Number(kb.toFixed(2));
    total += kb;
  }
  manifest.events[id] = {
    m4a: `${stem}.m4a`,
    ogg: `${stem}.ogg`,
    durationMs,
    critical: voices[id].critical,
    ...sizes,
  };
  console.log(`  ${stem}  ${durationMs}ms  ${voices[id].type} ${voices[id].freqs.join('/')}Hz  critical=${voices[id].critical}  m4a ${sizes.m4aKb}KB / ogg ${sizes.oggKb}KB`);
}
writeFileSync(join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

const fileCount = ids.length * 2;
if (fileCount !== 12) fail(`文件数 ${fileCount} ≠ 12（6 事件 × 双格式）`);
console.log(`预算：12 音频文件共 ${total.toFixed(2)}KB`);
console.log(`RESULT: PASS (sfx-pack-v1: ${fileCount} files + manifest.json)`);
