/**
 * sfx-pack-v1 音色表（实体 e-sfx-pack-v1 的唯一数据源）。
 * 同源纪律：tools/gen-audio.mjs 解析本表落盘 12 文件（6 事件 × m4a+ogg）；
 * 运行时文件缺失/解码失败时 AudioManager 用同一张表做程序化合成——两侧永不漂移。
 * 规格（风格卡 §1 延伸）：高频短促、克制，单音 ≤400ms；restart ≤ RESTART_SFX_MAX_MS(200ms)。
 * 纯数据卡：零 import、零 DOM，Node/生成器可直接解析。
 */
/** 事件 → 音色（a04 place / a05 perfect 与 v2 同源；game-over 承接原 over 音色） */
export const SFX_VOICES = {
    place: { freqs: [120], durationMs: 90, type: 'sine', gain: 0.35, critical: false },
    perfect: { freqs: [880, 1320], durationMs: 180, type: 'triangle', gain: 0.22, critical: false },
    miss: { freqs: [200, 150], durationMs: 140, type: 'square', gain: 0.16, critical: true },
    'game-over': { freqs: [220, 165], durationMs: 320, type: 'sawtooth', gain: 0.18, critical: true },
    restart: { freqs: [440, 587], durationMs: 130, type: 'triangle', gain: 0.2, critical: true },
    'level-clear': { freqs: [523, 659, 784], durationMs: 270, type: 'triangle', gain: 0.2, critical: false },
};
/** 事件 id 有序清单（= spec.content.sfxPack.events 逐字对应） */
export const SFX_EVENT_IDS = ['place', 'perfect', 'miss', 'game-over', 'restart', 'level-clear'];
/** 事件 id → 文件基名（命名契约：文件名 = `sfx-` + 事件 id） */
export function sfxFileStem(eventId) {
    return `sfx-${eventId}`;
}
