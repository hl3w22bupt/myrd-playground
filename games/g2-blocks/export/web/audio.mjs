// audio.ts — procedural 音效（a03-sfx-pack · WebAudio 合成，零音频文件）
//
// spec 口径：a03 = 消除/连击/炉冷/重开四类 procedural；ac-15 消除命中 → 音效调用与反馈完成同帧发起
// （发起面在 game.ts 同步接线，本文件只负责「被调用即出声」）；音频缺失/未解锁不阻塞玩法。
import { SFX, SFX_MASTER } from './render/theme.mjs';
import { createPersistence } from './persistence.mjs';

                                
                             
                             
               
                  
 

                                     

export function createAudio(storage                   )                                                                              {
  const persist = storage ? createPersistence(storage) : null;
  let ctx                      = null;
  let muted = persist ? persist.getMuted() : SFX_MASTER.mutedDefault;

  const Ctx              = (globalThis                           ).AudioContext ?? null;

  function ensureCtx()                      {
    if (!Ctx) return null;
    if (!ctx) {
      try { ctx = new Ctx(); } catch { return null; }
    }
    return ctx;
  }

  function tone(kind                                        )       {
    if (muted) return;
    const ac = ensureCtx();
    if (!ac) return; // 音频缺失不阻塞玩法
    const spec = SFX.find((s) => s.kind === kind);
    if (!spec) return;
    try {
      if (ac.state === 'suspended') void ac.resume();
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      const t0 = ac.currentTime;
      const dur = spec.durationMs / 1000;
      osc.type = spec.wave                  ;
      osc.frequency.setValueAtTime(spec.freqFromHz, t0);
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, spec.freqToHz), t0 + dur);
      const peak = SFX_MASTER.gain * (kind === 'combo' ? 1.2 : 1);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain).connect(ac.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch { /* 音频失败静默（不阻塞玩法） */ }
  }

  return {
    clear(chain        )       {
      // 连击层级感：连击 ≥2 时叠加 combo 上探音
      if (chain >= 2) tone('combo');
      else tone('clear');
    },
    combo(chain        )       {
      void chain;
      tone('combo');
    },
    cool()       { tone('cool'); },
    restart()       { tone('restart'); },
    unlock()       {
      // 浏览器自动播放策略：首次用户手势解锁
      const ac = ensureCtx();
      if (ac && ac.state === 'suspended') void ac.resume();
    },
    muted()          { return muted; },
    toggleMute()          {
      muted = !muted;
      if (persist) persist.setMuted(muted);
      return muted;
    },
  };
}

                                                                                                           


//# sourceURL=audio.ts