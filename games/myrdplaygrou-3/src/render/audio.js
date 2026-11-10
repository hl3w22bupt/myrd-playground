// audio.js — WebAudio 程序化音频（零音频文件）：oscillator + gain 包络 + 总线压缩器。
// 音效：结果性事件各给一个可辨识的音（配方 §3）；BGM：16 步琶音 + 底鼓循环（render 层调度，
// 允许非确定性 —— 内核不 import 本文件）。AudioContext 必须在首次用户手势里创建/resume（E-07）；
// headless/无手势环境全部静默 no-op。
let ctx = null;
let bus = null;
let bgmTimer = null;
let bgmStep = 0;
let bgmNextTime = 0;
let bgmOn = false;

const BGM_BPM = 132;                       // 风格卡 music 段 BPM 基准
const STEP = 60 / BGM_BPM / 2;             // 八分音符步长（秒）
const LOOKAHEAD = 0.12;                    // 调度前视（秒）

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

/** 噪声脉冲：白噪声段 + 带通（射门/扑救的摩擦质感） */
function noiseHit(t0, dur = 0.14, vol = 0.3, freq = 900) {
  if (!ctx || !bus) return;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(filter);
  filter.connect(g);
  g.connect(bus);
  src.start(t0);
}

/** BGM 调度一步：底鼓（偶步）+ 军鼓（4/12 步）+ 琶音（C 大调上行级进循环） */
function scheduleBgmStep(t0, step) {
  if (step % 2 === 0) blip(t0, 120, 50, 0.12, 0.16, "sine");               // 底鼓
  if (step % 8 === 4) noiseHit(t0, 0.06, 0.05, 1800);                       // 军鼓（轻）
  const arp = [262, 330, 392, 523, 392, 330, 440, 523, 587, 523, 440, 392, 330, 392, 440, 330];
  blip(t0, arp[step % 16], arp[step % 16], STEP * 0.85, 0.05, "triangle"); // 琶音铺底
}

function bgmSchedulerTick() {
  if (!ctx || !bgmOn) return;
  while (bgmNextTime < ctx.currentTime + LOOKAHEAD) {
    scheduleBgmStep(bgmNextTime, bgmStep);
    bgmStep = (bgmStep + 1) % 16;
    bgmNextTime += STEP;
  }
}

export const bgm = {
  start() {
    if (!ctx || bgmOn) return;
    bgmOn = true;
    bgmStep = 0;
    bgmNextTime = ctx.currentTime + 0.06;
    bgmTimer = setInterval(bgmSchedulerTick, 30);
  },
  stop() {
    bgmOn = false;
    if (bgmTimer) { clearInterval(bgmTimer); bgmTimer = null; }
  },
};

export const sfx = {
  collect() { if (!ctx) return; const t = ctx.currentTime; blip(t, 660, 990, 0.1); blip(t + 0.08, 990, 1320, 0.12); },
  kick() { if (!ctx) return; const t = ctx.currentTime; noiseHit(t, 0.12, 0.32, 700); blip(t, 180, 60, 0.12, 0.2, "sine"); },
  save() { if (!ctx) return; const t = ctx.currentTime; noiseHit(t, 0.1, 0.22, 500); blip(t, 400, 200, 0.18, 0.18, "sawtooth"); },
  /** 裁判哨：高频颤音三短一长（进球庆祝） */
  goal() {
    if (!ctx) return;
    const t = ctx.currentTime;
    blip(t, 2100, 1900, 0.1, 0.16, "square");
    blip(t + 0.14, 2100, 1900, 0.1, 0.16, "square");
    blip(t + 0.28, 2050, 1800, 0.42, 0.18, "square");
    blip(t + 0.35, 523, 523, 0.14, 0.16, "triangle");
    blip(t + 0.5, 659, 659, 0.14, 0.16, "triangle");
    blip(t + 0.65, 784, 784, 0.24, 0.18, "triangle");
  },
  /** 开场哨：单长颤音 */
  whistle() {
    if (!ctx) return;
    const t = ctx.currentTime;
    blip(t, 2000, 1800, 0.35, 0.15, "square");
  },
  pause() { if (!ctx) return; blip(ctx.currentTime, 440, 440, 0.08, 0.15, "sine"); },
  resume() { if (!ctx) return; blip(ctx.currentTime, 550, 550, 0.08, 0.15, "sine"); },
  /** 终局前 10 秒每秒滴答（倒计时紧迫感；视觉侧时间徽章同步变橙） */
  tick() { if (!ctx) return; blip(ctx.currentTime, 880, 660, 0.07, 0.1, "sine"); },
  gameover(won) {
    if (!ctx) return;
    const t = ctx.currentTime;
    if (won) { blip(t, 523, 523, 0.12); blip(t + 0.12, 659, 659, 0.12); blip(t + 0.24, 784, 784, 0.2); }
    else { blip(t, 392, 392, 0.15); blip(t + 0.15, 311, 311, 0.15); blip(t + 0.3, 233, 233, 0.3); }
  },
};
