// audio.ts — 音频门面（A 轮 N3-T1 · 零外部依赖 · 零网络调用）
//
// 用途：把「什么时候响」（玩法层）与「怎么响」（合成器实现）拆开。
//  玩法层只依赖 GameAudioSurface；测试注入 fakeSynth 即可断言「哪一帧发起了哪类音效」，
//  生产注入 WebAudio 合成器（src/audio.ts 现有实现）。
// 纪律（ac-15 不降）：消除命中 → 音效调用与反馈完成**同帧同步发起**，缺失/静音零阻塞玩法。
// 纪律（ac-16 不降）：静音状态读写仍走 persistence 的 muted 键（键级最小集不变）。

import { createPersistence,                  } from '../persistence.mjs';

                                                                       

/** 三档边界（V1.2 注入面：生产 = numeric.feel.sfx.tierBoundaries；缺省 = 二档 legacy 行为） */
                                                                                          

const DEFAULT_TWO_TIER                 = [
  { tier: 1, minChain: 1, maxChain: 1 },
  { tier: 2, minChain: 2, maxChain: null },
];

export function voiceOfTier(tier        )          {
  return tier === 1 ? 'clear' : tier === 2 ? 'combo' : 'blaze';
}

export function tierForChain(chain        , boundaries                         )         {
  for (const b of boundaries) {
    if (chain >= b.minChain && (b.maxChain === null || chain <= b.maxChain)) return b.tier;
  }
  return 1;
}

/** 合成器面（生产 = WebAudio；测试 = 记录调用的 fake） */
                        
                            
                                                          
                       
 

                                   
                                      
                             
                             
               
                  
                 
                   
                        
 

                                     
               
                                        
                        
                                
                         
                                                                       
                                           
 

export function createAudioFacade(opts                    )                   {
  const persist = opts.storage ? createPersistence(opts.storage) : null;
  let muted = persist ? persist.getMuted() : (opts.initialMuted ?? false);
  const boundaries = opts.tierBoundaries ?? DEFAULT_TWO_TIER;

  const emit = (kind         )       => {
    if (muted) return;
    if (!opts.synth.available()) return; // 音频缺失不阻塞玩法
    try {
      opts.synth.play(kind);
    } catch {
      /* 合成器异常不阻塞玩法 */
    }
  };

  return {
    clear(chain        )       {
      emit(voiceOfTier(tierForChain(chain, boundaries)));
    },
    combo(chain        )       {
      void chain;
      emit('combo');
    },
    cool()       {
      emit('cool');
    },
    restart()       {
      emit('restart');
    },
    unlock()       {
      try {
        opts.synth.play('restart');
      } catch {
        /* 解锁失败不阻塞玩法 */
      }
    },
    muted: ()          => muted,
    toggleMute()          {
      muted = !muted;
      if (persist) persist.setMuted(muted);
      return muted;
    },
  };
}

/** 记录型合成器（契约/对抗用例用：断言「哪一帧发起了哪类音效」而不真出声） */
export function recordingSynth()                                                                                {
  const calls            = [];
  return {
    calls,
    available: ()          => true,
    play: (kind)       => {
      calls.push(kind);
    },
    kinds: ()            => calls.slice(),
    countOf: (k)         => calls.filter((c) => c === k).length,
  };
}


//# sourceURL=platform/audio.ts