// kernel/loop.ts — 单局制确定性内核骨架（line4-unblock-jam · 中性脚手架）
//
// 纪律（三线判例）：零 Math.random / 零 Date.now / 零平台 import——随机走注入 seeded Rng，
// 时间走 fixed-step 累计；同 seed 同输入 → 逐字节一致。
// 单局制（spec world.sceneSpec）：一局 = 一关，ready → running → ended 终局即止（重开=新局新 seed）。
                                        

export function seededRng(seed        )      {
  // mulberry32（判例承自 g2-blocks ac-14）
  let a = seed >>> 0;
  return {
    next() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

                                                  

                              
               
               
                    
               
 

                                                

/** fixed-step 步进（FIXED_STEP_MS=16，spec numeric 冻结值）：advance=false 只累计不推进 */
export function step(state             , stepMs        , input           )              {
  if (state.phase !== 'running' || !input.advance) return state;
  return { ...state, tick: state.tick + 1, elapsedMs: state.elapsedMs + stepMs };
}

export function createSession(seed        )              {
  return { phase: 'ready', tick: 0, elapsedMs: 0, seed };
}

export function start(state             )              {
  return { ...state, phase: 'running' };
}

export function end(state             )              {
  return { ...state, phase: 'ended' };
}
