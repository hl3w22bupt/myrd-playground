// audio.js — WebAudio 程序化音频（零音频文件）：音效 + BGM + 观众氛围 + 手势解锁。
// AudioContext 必须在首次用户手势里创建/resume（E-07）；headless/无手势环境全部静默 no-op。
// window.__audioDebug 由 installAudioDebug() 暴露（mobile-web-smoke 的音频解锁契约锚点）。
let ctx = null;
let bus = null;
let bgmTimer = null;
let bgmNext = 0;
let bgmBar = 0;

/** 首次手势时调用；不可用环境直接保持 null（所有播报方法自检空转） */
export function unlockAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      bus = ctx.createGain();
      bus.gain.value = 0.5;
      const comp = ctx.createDynamicsCompressor();
      bus.connect(comp);
      comp.connect(ctx.destination);
      startCrowd();
      startBgm();
    }
    if (ctx.state === "suspended") ctx.resume();
  } catch {
    ctx = null; // 音频失败不致命，游戏照常
  }
}

/** 单音：t0 起振，f0→f1 扫频，指数衰减包络 */
function blip(t0, f0, f1, dur = 0.12, vol = 0.22, type = "square") {
  if (!ctx || !bus) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g);
  g.connect(bus);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

/** 噪声脉冲（踢球/欢呼底）：白噪声段 + 低通 */
function noiseBurst(t0, dur = 0.5, vol = 0.12, freq = 800) {
  if (!ctx || !bus) return;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(bus);
  src.start(t0);
}

/** 观众氛围：循环低通白噪声「人声海」（极低增益垫底） */
function startCrowd() {
  if (!ctx || !bus) return;
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    last = last * 0.97 + (Math.random() * 2 - 1) * 0.03;
    d[i] = last * 8;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = 500;
  const g = ctx.createGain();
  g.gain.value = 0.045;
  src.connect(f); f.connect(g); g.connect(bus);
  src.start();
}

/** BGM：128 BPM 四小节循环（bass 方波 + 三和弦琶音），lookahead 调度 */
const BGM_CHORDS = [
  [130.8, 164.8, 196.0], // C
  [174.6, 220.0, 261.6], // F
  [146.8, 185.0, 220.0], // Dm
  [130.8, 164.8, 196.0], // C
];
const BAR_SECONDS = 60 / 128 * 4;

function scheduleBar(t0, chord) {
  // bass 四拍
  for (let b = 0; b < 4; b++) {
    blip(t0 + b * (BAR_SECONDS / 4), chord[0] / 2, chord[0] / 2, 0.16, 0.1, "square");
  }
  // 八分音符琶音
  for (let i = 0; i < 8; i++) {
    const note = chord[i % 3] * 2;
    blip(t0 + i * (BAR_SECONDS / 8), note, note, 0.1, 0.05, "triangle");
  }
}

function startBgm() {
  if (!ctx) return;
  bgmNext = ctx.currentTime + 0.1;
  bgmBar = 0;
  const pump = () => {
    if (!ctx) return;
    while (bgmNext < ctx.currentTime + 1.2) {
      scheduleBar(bgmNext, BGM_CHORDS[bgmBar % BGM_CHORDS.length]);
      bgmBar++;
      bgmNext += BAR_SECONDS;
    }
    bgmTimer = setTimeout(pump, 400);
  };
  pump();
}

export const sfx = {
  /** 传球/踢球：低频冲击 */
  kick() { if (!ctx) return; const t = ctx.currentTime; blip(t, 180, 60, 0.09, 0.3, "sine"); noiseBurst(t, 0.08, 0.06, 1200); },
  /** 射门：更重的冲击 + 嗖 */
  shoot() { if (!ctx) return; const t = ctx.currentTime; blip(t, 140, 40, 0.14, 0.38, "sine"); noiseBurst(t, 0.16, 0.1, 2000); },
  /** 裁判哨：双颤音 */
  whistle() { if (!ctx) return; const t = ctx.currentTime; blip(t, 2200, 2400, 0.12, 0.18, "square"); blip(t + 0.18, 2200, 2350, 0.22, 0.18, "square"); },
  /** 进球：上行琶音 + 欢呼噪声 */
  goal() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const seq = [523, 659, 784, 1046];
    seq.forEach((f, i) => blip(t + i * 0.11, f, f, 0.16, 0.24, "square"));
    noiseBurst(t + 0.1, 1.2, 0.16, 900);
  },
  /** 抢断：短噪声click */
  tackle() { if (!ctx) return; noiseBurst(ctx.currentTime, 0.1, 0.14, 500); },
  pause() { if (!ctx) return; blip(ctx.currentTime, 440, 440, 0.08, 0.15, "sine"); },
  resume() { if (!ctx) return; blip(ctx.currentTime, 550, 550, 0.08, 0.15, "sine"); },
  gameover(won) {
    if (!ctx) return;
    this.whistle();
    const t = ctx.currentTime + 0.3;
    if (won === "home") { blip(t, 523, 523, 0.12); blip(t + 0.12, 659, 659, 0.12); blip(t + 0.24, 784, 784, 0.24); }
    else if (won === "away") { blip(t, 392, 392, 0.15); blip(t + 0.15, 311, 311, 0.15); blip(t + 0.3, 233, 233, 0.3); }
    else { blip(t, 440, 440, 0.2); blip(t + 0.2, 440, 440, 0.3); }
  },
};

/** mobile-web-smoke 的音频解锁契约锚点：暴露诊断函数（typeof === 'function' 才算过） */
export function installAudioDebug() {
  try {
    window.__audioDebug = () => ({
      created: !!ctx,
      state: ctx ? ctx.state : "none",
      bgmScheduled: bgmTimer !== null,
      bar: bgmBar,
    });
  } catch { /* 无 window 环境 no-op */ }
}
