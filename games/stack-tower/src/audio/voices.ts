/**
 * sfx-pack-v1 音色表（实体 e-sfx-pack-v1 的唯一数据源）。
 * 同源纪律：tools/gen-audio.mjs 解析本表落盘 12 文件（6 事件 × m4a+ogg）；
 * 运行时文件缺失/解码失败时 AudioManager 用同一张表做程序化合成——两侧永不漂移。
 * 规格（风格卡 §1 延伸）：高频短促、克制，单音 ≤400ms；restart ≤ RESTART_SFX_MAX_MS(200ms)。
 * 纯数据卡：零 import、零 DOM，Node/生成器可直接解析。
 */

export type SfxEventId = 'place' | 'perfect' | 'miss' | 'game-over' | 'restart' | 'level-clear';

export interface SfxVoice {
  /** 基频序列（Hz）：多音按 60ms 错开（叮的上扬感 / 琶音下行感） */
  freqs: number[];
  durationMs: number;
  type: 'sine' | 'triangle' | 'sawtooth' | 'square';
  /** 峰值增益（0~1），经 sfx_bus_gain(0.9) 二次衰减 */
  gain: number;
  /** critical = 满载不挤占（8 voices 上限外仍必出声） */
  critical: boolean;
}

/** 事件 → 音色（a04 place / a05 perfect 与 v2 同源；game-over 承接原 over 音色） */
export const SFX_VOICES: Record<SfxEventId, SfxVoice> = {
  place: { freqs: [120], durationMs: 90, type: 'sine', gain: 0.35, critical: false },
  perfect: { freqs: [880, 1320], durationMs: 180, type: 'triangle', gain: 0.22, critical: false },
  miss: { freqs: [200, 150], durationMs: 140, type: 'square', gain: 0.16, critical: true },
  'game-over': { freqs: [220, 165], durationMs: 320, type: 'sawtooth', gain: 0.18, critical: true },
  restart: { freqs: [440, 587], durationMs: 130, type: 'triangle', gain: 0.2, critical: true },
  'level-clear': { freqs: [523, 659, 784], durationMs: 270, type: 'triangle', gain: 0.2, critical: false },
};

/** 事件 id 有序清单（= spec.content.sfxPack.events 逐字对应） */
export const SFX_EVENT_IDS: SfxEventId[] = ['place', 'perfect', 'miss', 'game-over', 'restart', 'level-clear'];

/** 事件 id → 文件基名（命名契约：文件名 = `sfx-` + 事件 id） */
export function sfxFileStem(eventId: SfxEventId): string {
  return `sfx-${eventId}`;
}
