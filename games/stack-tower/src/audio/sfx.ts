/**
 * 程序化音效（资产 a04-sfx-place / a05-sfx-perfect，generator: procedural:webaudio）。
 * 零外部音频文件：落块=短促闷响（低频正弦+快衰减）；完美=清脆叮（高频双音），
 * 与 tower-ripple 波纹一次性呼应（不随 duration_ms 循环）；结束=下行两音。
 * 浏览器外（无 AudioContext）自动退化为静音，绝不抛错。
 */
import type { AudioSink } from '../platform/index.js';

type Ctor = new () => AudioContext;

function getAudioContext(): AudioContext | null {
  const g = globalThis as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor };
  const Ctx = g.AudioContext ?? g.webkitAudioContext;
  if (!Ctx) return null;
  try {
    return new Ctx();
  } catch {
    return null;
  }
}

let ctx: AudioContext | null = null;

/** 三类程序化音色（频率/时长/波形表，零采样） */
interface Voice {
  freqs: number[];
  durationMs: number;
  type: OscillatorType;
  gain: number;
}

const SFX_TABLE: Record<'place' | 'perfect' | 'over', Voice> = {
  place: { freqs: [120], durationMs: 90, type: 'sine', gain: 0.35 },
  perfect: { freqs: [880, 1320], durationMs: 180, type: 'triangle', gain: 0.22 },
  over: { freqs: [220, 165], durationMs: 320, type: 'sawtooth', gain: 0.18 },
};

function tone(voice: Voice): void {
  if (!ctx) return;
  const t0 = ctx.currentTime;
  for (let i = 0; i < voice.freqs.length; i++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const freq = voice.freqs[i]!;
    osc.type = voice.type;
    osc.frequency.value = freq;
    const start = t0 + i * 0.06; // 双音错开 60ms（叮的上扬感）
    gain.gain.setValueAtTime(voice.gain, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + voice.durationMs / 1000);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + voice.durationMs / 1000 + 0.02);
  }
}

/** WebAudio 输出（浏览器平台装配用；无 AudioContext 环境为静音） */
export function createWebAudioSink(): AudioSink {
  return {
    play(kind) {
      if (!ctx) ctx = getAudioContext();
      tone(SFX_TABLE[kind]);
    },
  };
}

/** 事件消费门面（app/main 用）：静音开关 + 主音量 */
export function createSfx(sink: AudioSink): { play(kind: 'place' | 'perfect' | 'over'): void; toggleMute(): boolean } {
  let muted = false;
  return {
    play(kind) {
      if (!muted) sink.play(kind);
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
  };
}
