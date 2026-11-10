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

export const sfx = {
  collect() { if (!ctx) return; const t = ctx.currentTime; blip(t, 660, 990, 0.1); blip(t + 0.08, 990, 1320, 0.12); },
  pause() { if (!ctx) return; blip(ctx.currentTime, 440, 440, 0.08, 0.15, "sine"); },
  resume() { if (!ctx) return; blip(ctx.currentTime, 550, 550, 0.08, 0.15, "sine"); },
  gameover(won) {
    if (!ctx) return;
    const t = ctx.currentTime;
    if (won) { blip(t, 523, 523, 0.12); blip(t + 0.12, 659, 659, 0.12); blip(t + 0.24, 784, 784, 0.2); }
    else { blip(t, 392, 392, 0.15); blip(t + 0.15, 311, 311, 0.15); blip(t + 0.3, 233, 233, 0.3); }
  },
};
