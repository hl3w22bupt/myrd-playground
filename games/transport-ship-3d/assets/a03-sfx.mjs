// a03-sfx.mjs — 资产条目 a03（sfx）：音效资产的音色参数表（数据表驱动，代码零魔数）。
//   合成器本体在 spec 声明落点 src/render/audio.js（WebAudio 运行时合成，零音频文件，保留为 fallback 底座）；
//   本文件只存「内核事件 → 合成参数」的真源：调音色 = 改这张表，不改合成器代码。
//   口径（风格卡：军事干练、短促不拖泥带水）：射击/命中类一律 <0.25s，提示类用正弦上滑。

/** 音色参数表。kind: "noise"=噪声脉冲（枪械/撞击） | "blip"=振荡器（UI/命中/提示）*/
export const SFX_TABLE = {
  shot: [
    { kind: "noise", dur: 0.09, vol: 0.42, filter: 1500, q: 0.7, type: "lowpass" },
    { kind: "blip", freq: 180, dur: 0.05, vol: 0.16, wave: "sawtooth", slide: -110 },
  ],
  enemyHit: [{ kind: "blip", freq: 520, dur: 0.05, vol: 0.18, wave: "triangle" }],
  headshot: [{ kind: "blip", freq: 1180, dur: 0.09, vol: 0.26, wave: "triangle", slide: 420 }],
  kill: [{ kind: "blip", freq: 320, dur: 0.14, vol: 0.2, wave: "sawtooth", slide: -160 }],
  playerHit: [{ kind: "noise", dur: 0.22, vol: 0.5, filter: 420, q: 0.7, type: "lowpass" }],
  reloadStart: [{ kind: "blip", freq: 240, dur: 0.06, vol: 0.16, wave: "square" }],
  reloadEnd: [{ kind: "blip", freq: 420, dur: 0.07, vol: 0.2, wave: "square", slide: 180 }],
  waveStart: [{ kind: "blip", freq: 300, dur: 0.3, vol: 0.22, wave: "sine", slide: 220 }],
  waveClear: [{ kind: "blip", freq: 660, dur: 0.18, vol: 0.22, wave: "sine", slide: 330 }],
  gameOver: [{ kind: "blip", freq: 220, dur: 0.6, vol: 0.3, wave: "sawtooth", slide: -170 }],
};

/** 兜底：静音（合成器/表挂了也不报错、不破音） */
export const SFX_FALLBACK = [];
