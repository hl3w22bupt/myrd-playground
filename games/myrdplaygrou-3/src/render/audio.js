// audio.js — WebAudio 程序化音频（零音频文件）：音效 + BGM + 观众氛围 + 手势解锁。
// AudioContext 必须在首次用户手势里创建/resume（E-07）；headless/无手势环境全部静默 no-op。
// window.__audioDebug 由 installAudioDebug() 暴露（mobile-web-smoke 的音频解锁契约锚点）。
// v3 手感打磨：蓄力音调线性升高（chargeTone）+ BGM 庆祝压低/恢复（duckBgm）+
// 切换确认音（switchConfirm，与抢断噪声异频段互不打断）。
let ctx = null;
let bus = null;
let bgmGain = null; // BGM 独立增益（庆祝 duck 30% 只压 BGM，音效/观众不受影响）
let bgmTimer = null;
let bgmNext = 0;
let bgmBar = 0;
let chargeOsc = null; // 蓄力持续音（按住期间频率线性爬升，松手停）
let chargeGain = null;
let ducked = false;

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
      bgmGain = ctx.createGain();
      bgmGain.gain.value = 1;
      bgmGain.connect(bus);
      startCrowd();
      startBgm();
    }
    if (ctx.state === "suspended") ctx.resume();
  } catch {
    ctx = null; // 音频失败不致命，游戏照常
  }
}

/** 单音：t0 起振，f0→f1 扫频，指数衰减包络 */
function blip(t0, f0, f1, dur = 0.12, vol = 0.22, type = "square", dest = null) {
  if (!ctx || !bus) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g);
  g.connect(dest || bus);
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
  // bass 四拍（走 bgmGain：庆祝 duck 只压 BGM 垫底，不压音效）
  for (let b = 0; b < 4; b++) {
    blip(t0 + b * (BAR_SECONDS / 4), chord[0] / 2, chord[0] / 2, 0.16, 0.1, "square", bgmGain);
  }
  // 八分音符琶音
  for (let i = 0; i < 8; i++) {
    const note = chord[i % 3] * 2;
    blip(t0 + i * (BAR_SECONDS / 8), note, note, 0.1, 0.05, "triangle", bgmGain);
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
  /** 射门：更重的冲击 + 嗖（松手瞬间；此前按住期由 chargeTone 爬升铺垫） */
  shoot() { if (!ctx) return; const t = ctx.currentTime; blip(t, 140, 40, 0.14, 0.38, "sine"); noiseBurst(t, 0.16, 0.1, 2000); },
  /** 蓄力开始：持续音起振（按住期间 chargeTone(ms) 线性爬升音调，松手 stopCharge） */
  startCharge() {
    if (!ctx || !bus || chargeOsc) return;
    try {
      chargeOsc = ctx.createOscillator();
      chargeGain = ctx.createGain();
      chargeOsc.type = "sawtooth";
      chargeOsc.frequency.setValueAtTime(220, ctx.currentTime);
      chargeGain.gain.setValueAtTime(0.0001, ctx.currentTime);
      chargeGain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.05);
      chargeOsc.connect(chargeGain);
      chargeGain.connect(bus);
      chargeOsc.start();
    } catch { chargeOsc = null; }
  },
  /** 蓄力音调随蓄力线性升高（acc-game-feel-audio 机判锚点：220→880Hz 线性映射蓄力比例） */
  chargeTone(progress) {
    if (!ctx || !chargeOsc) return;
    const p = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
    try {
      chargeOsc.frequency.setValueAtTime(220 + 660 * p, ctx.currentTime);
    } catch { /* 已停 */ }
  },
  /** 蓄力松手/取消：停持续音（射门冲击由 shoot() 承担） */
  stopCharge() {
    if (!ctx || !chargeOsc) { chargeOsc = null; return; }
    try {
      chargeGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.02);
      chargeOsc.stop(ctx.currentTime + 0.08);
    } catch { /* 已停 */ }
    chargeOsc = null;
    chargeGain = null;
  },
  /** 切换确认音（v3 控制权切换规范：切换反馈 = 单环脉冲 + 确认音）：
   *  高频短正弦上行，与抢断噪声（低通 500Hz）异频段 —— 互不打断（acc-game-feel-audio） */
  switchConfirm() { if (!ctx) return; const t = ctx.currentTime; blip(t, 880, 1320, 0.07, 0.12, "sine"); },
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
  /** 抢断：短噪声click（低通 500Hz 频段，与 switchConfirm 高频正弦分离） */
  tackle() { if (!ctx) return; noiseBurst(ctx.currentTime, 0.1, 0.14, 500); },
  /** BGM 庆祝压低/恢复（v3：庆祝期间压低约 30%，庆祝结束线性恢复；只压 BGM 增益节点） */
  duckBgm(on) {
    if (!ctx || !bgmGain) return;
    const want = on ? 1 - 0.3 : 1; // 0.7 / 1.0
    try {
      bgmGain.gain.cancelScheduledValues(ctx.currentTime);
      bgmGain.gain.setTargetAtTime(want, ctx.currentTime, 0.15);
      ducked = on;
    } catch { /* 音频失败不致命 */ }
  },
  /** 调试读数（duck 状态留痕，验收取证消费） */
  get ducked() { return ducked; },
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
