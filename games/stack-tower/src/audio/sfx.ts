/**
 * 程序化合成音效（资产 a04-sfx-place / a05-sfx-perfect 规格，generator: procedural:webaudio）。
 * M2.1 起本模块 = AudioManager 的降级合成路径（sfx-pack 文件缺失/解码失败时用同一张
 * voices.ts 音色表合成）；落块=短促闷响、完美=清脆双音叮的音色规格不变。
 * 浏览器外（无 AudioContext）自动退化为静音，绝不抛错。
 */
import type { GainNodeLike, OscillatorLike } from './audio-manager.js';
import type { SfxVoice } from './voices.js';

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

/** 浏览器共享 AudioContext（AudioManager 装配用；无 AudioContext 环境返回 null） */
export function sharedAudioContext(): AudioContext | null {
  if (!ctx) ctx = getAudioContext();
  return ctx;
}

/** 程序化合成单音色（多频按 60ms 错开；rate 用于连击升调）。返回结束时刻（ctx 时钟，秒） */
export function scheduleProceduralVoice(
  audioCtx: { currentTime: number },
  bus: GainNodeLike,
  voice: SfxVoice,
  rate: number,
  mkOsc: () => OscillatorLike,
  mkGain: () => GainNodeLike,
): number {
  const t0 = audioCtx.currentTime;
  let last = 0;
  for (let i = 0; i < voice.freqs.length; i++) {
    const osc = mkOsc();
    const gain = mkGain();
    osc.type = voice.type;
    osc.frequency.value = voice.freqs[i]! * rate;
    const start = t0 + i * 0.06; // 双音错开 60ms（叮的上扬感）
    const dur = voice.durationMs / 1000 / rate;
    if (gain.gain.setValueAtTime) gain.gain.setValueAtTime(voice.gain, start);
    else gain.gain.value = voice.gain;
    osc.connect(gain);
    gain.connect(bus);
    osc.start(start);
    osc.stop(start + dur + 0.02);
    last = Math.max(last, start + dur);
  }
  return last;
}
