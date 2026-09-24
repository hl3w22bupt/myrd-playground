// audio.js — WebAudio 运行时合成音效（零音频文件）。内核事件 → 短合成器音色。
// 口径：首次用户手势后 lazily resume AudioContext（浏览器自动播放策略）。
// 资产接线：音色参数表在 assets/a03-sfx.mjs（数据表驱动 —— 调音色改表不改代码）；
//          表缺失/合成失败 → 静音兜底，不破坏运行。

import { SFX_TABLE, SFX_FALLBACK } from "../../assets/a03-sfx.mjs";
import { safe } from "../../assets/index.mjs";

export function buildAudio() {
  let ctx = null;
  let master = null;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  /** 通用噪声脉冲（射击/命中/破空）*/
  function noiseBurst({ dur = 0.12, vol = 0.5, filter = 1800, q = 0.7, type = "lowpass" }) {
    const ac = ensure(); if (!ac) return;
    const n = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, n, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2;
    const src = ac.createBufferSource(); src.buffer = buf;
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = filter; f.Q.value = q;
    const g = ac.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(master);
    src.start();
  }

  /** 短促方波/锯齿音（UI/提示/爆头叮声）*/
  function blip({ freq = 880, dur = 0.08, vol = 0.25, wave = "square", slide = 0, type }) {
    const ac = ensure(); if (!ac) return;
    const o = ac.createOscillator(); o.type = type ?? wave;
    o.frequency.setValueAtTime(freq, ac.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), ac.currentTime + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    o.connect(g); g.connect(master);
    o.start(); o.stop(ac.currentTime + dur + 0.02);
  }

  /** 音色表 → 合成调用（表项缺字段走默认值，坏表项不抛出）*/
  function play(layers) {
    for (const l of layers ?? []) {
      try { l.kind === "noise" ? noiseBurst(l) : blip(l); } catch { /* 静音兜底 */ }
    }
  }

  return {
    unlock: ensure,
    /** 内核事件 → 音色（统一入口，物理层零音频依赖）*/
    handle(events) {
      for (const ev of events) {
        play(safe(`a03:${ev.type}`, () => SFX_TABLE[ev.type] ?? SFX_FALLBACK, () => SFX_FALLBACK));
      }
    },
  };
}
