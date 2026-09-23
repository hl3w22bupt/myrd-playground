// audio.js — WebAudio 运行时合成音效（零音频文件）。内核事件 → 短合成器音色。
// 口径：首次用户手势后 lazily resume AudioContext（浏览器自动播放策略）。

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
  function blip({ freq = 880, dur = 0.08, vol = 0.25, type = "square", slide = 0 }) {
    const ac = ensure(); if (!ac) return;
    const o = ac.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(freq, ac.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), ac.currentTime + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    o.connect(g); g.connect(master);
    o.start(); o.stop(ac.currentTime + dur + 0.02);
  }

  return {
    unlock: ensure,
    /** 内核事件 → 音色（统一入口，物理层零音频依赖）*/
    handle(events) {
      for (const ev of events) {
        switch (ev.type) {
          case "shot": noiseBurst({ dur: 0.09, vol: 0.42, filter: 1500 }); blip({ freq: 180, dur: 0.05, vol: 0.16, type: "sawtooth", slide: -110 }); break;
          case "enemyHit": blip({ freq: 520, dur: 0.05, vol: 0.18, type: "triangle" }); break;
          case "headshot": blip({ freq: 1180, dur: 0.09, vol: 0.26, type: "triangle", slide: 420 }); break;
          case "kill": blip({ freq: 320, dur: 0.14, vol: 0.2, type: "sawtooth", slide: -160 }); break;
          case "playerHit": noiseBurst({ dur: 0.22, vol: 0.5, filter: 420 }); break;
          case "reloadStart": blip({ freq: 240, dur: 0.06, vol: 0.16, type: "square" }); break;
          case "reloadEnd": blip({ freq: 420, dur: 0.07, vol: 0.2, type: "square", slide: 180 }); break;
          case "waveStart": blip({ freq: 300, dur: 0.3, vol: 0.22, type: "sine", slide: 220 }); break;
          case "waveClear": blip({ freq: 660, dur: 0.18, vol: 0.22, type: "sine", slide: 330 }); break;
          case "gameOver": blip({ freq: 220, dur: 0.6, vol: 0.3, type: "sawtooth", slide: -170 }); break;
          default: break;
        }
      }
    },
  };
}
