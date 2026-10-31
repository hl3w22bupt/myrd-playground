// audio.js — WebAudio 程序化音效（零音频文件）：oscillator + gain 包络 + 总线压缩器。
// AudioContext 必须在首次用户手势里创建/resume（E-07）；headless/无手势环境全部静默 no-op。
let ctx = null;
let bus = null;

/** 首次手势时调用；不可用环境直接保持 null（所有播报方法自检空转） */
export function unlockAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      bus = ctx.createGain();
      bus.gain.value = 0.4;
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
function blip(t0, f0, f1, dur = 0.12, vol = 0.2, type = "square") {
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

/** 低噪爆点：趴窝/断裂的低频闷响 */
function thud(t0, f0 = 90, dur = 0.3, vol = 0.3) {
  if (!ctx || !bus) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(f0, t0);
  o.frequency.exponentialRampToValueAtTime(30, t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g);
  g.connect(bus);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

export const sfx = {
  click() { if (!ctx) return; blip(ctx.currentTime, 520, 520, 0.05, 0.12, "sine"); },
  list() { if (!ctx) return; const t = ctx.currentTime; blip(t, 440, 660, 0.1); blip(t + 0.09, 660, 880, 0.12); },
  restock() { if (!ctx) return; thud(ctx.currentTime, 120, 0.18, 0.22); },
  eat() { if (!ctx) return; blip(ctx.currentTime, 330, 220, 0.14, 0.16, "triangle"); },
  sleep() { if (!ctx) return; blip(ctx.currentTime, 220, 110, 0.4, 0.14, "sine"); },
  reply() { if (!ctx) return; blip(ctx.currentTime, 550, 720, 0.1, 0.15, "triangle"); },
  order() { if (!ctx) return; const t = ctx.currentTime; blip(t, 660, 990, 0.08, 0.14); },
  missed() { if (!ctx) return; blip(ctx.currentTime, 330, 240, 0.1, 0.1, "triangle"); },
  payout() {
    if (!ctx) return;
    const t = ctx.currentTime;
    blip(t, 523, 523, 0.09, 0.18, "triangle");
    blip(t + 0.09, 659, 659, 0.09, 0.18, "triangle");
    blip(t + 0.18, 784, 1046, 0.16, 0.2, "triangle");
  },
  broke() { if (!ctx) return; const t = ctx.currentTime; thud(t, 140, 0.4, 0.3); blip(t + 0.1, 220, 110, 0.3, 0.16, "sawtooth"); },
  gameover(won) {
    if (!ctx) return;
    const t = ctx.currentTime;
    if (won) { blip(t, 523, 523, 0.12); blip(t + 0.12, 659, 659, 0.12); blip(t + 0.24, 784, 784, 0.14); blip(t + 0.38, 1046, 1046, 0.24); }
    else { thud(t, 140, 0.5, 0.32); blip(t + 0.2, 220, 110, 0.4, 0.18, "sawtooth"); }
  },
  pause() { if (!ctx) return; blip(ctx.currentTime, 440, 440, 0.08, 0.14, "sine"); },
  resume() { if (!ctx) return; blip(ctx.currentTime, 550, 550, 0.08, 0.14, "sine"); },
  // —— M2：事件流与升级线 ——
  eventBad() { if (!ctx) return; const t = ctx.currentTime; blip(t, 300, 180, 0.16, 0.16, "sawtooth"); blip(t + 0.12, 220, 140, 0.2, 0.14, "sawtooth"); },
  eventGood() { if (!ctx) return; const t = ctx.currentTime; blip(t, 523, 523, 0.08, 0.15, "triangle"); blip(t + 0.08, 784, 1046, 0.14, 0.16, "triangle"); },
  upgrade() { if (!ctx) return; const t = ctx.currentTime; blip(t, 392, 392, 0.1, 0.16, "triangle"); blip(t + 0.1, 523, 523, 0.1, 0.16, "triangle"); blip(t + 0.2, 659, 784, 0.22, 0.18, "triangle"); },
};
