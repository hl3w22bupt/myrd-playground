// runtime.ts — 抖音小游戏运行时装配（DY 平台段轮 N2 · 复用 T1/T3 门面，核心逻辑零改动）
//
// 纪律（spec dy-runtime 条目 + 映射表 dy-diff-01/05）：
//   ① 存储复用 src/platform/storage.ts 门面 + persistence 键制（muted/anonId 最小集，不新增落盘键）；
//   ② 音频复用 src/audio.ts 门面（合成器可注入；容器缺失静默跳过，不阻塞玩法）；
//   ③ 时钟复用 src/platform/clock.ts（可注入；缺省 systemClock）；
//   ④ 生命周期 onShow/onHide 经 tt.onShow/onHide 注册，回调仅作表现层挂起/恢复，零内核触碰；
//   ⑤ 本件零内核 import；tt 宿主注入（DI），Node 侧测试用 fake 宿主；
//   ⑥ tt.* 直调面收口：宿主调用只发生在本目录（src/platform/dy/）内，门面外直调即缺陷。
                                                        
import { createAudio } from '../../audio.mjs';
import { systemClock,            } from '../clock.mjs';
                                          

                            
                     
            
                                                   
                           
                                      
                                        
                                              
               
                           
                                                      
                                           
                                                                                            
 

                                   
                                        
             
                             
                
 

/** tt 同步存储 → StorageLike（tt.getStorageSync 缺键返回空串，映射为 null；dy-diff-01 键制逐字复用） */
function ttStorageLike(tt        )              {
  return {
    getItem(key        )                {
      const v = tt.getStorageSync(key);
      return v === '' || v === undefined || v === null ? null : String(v);
    },
    setItem(key        , value        )       {
      tt.setStorageSync(key, String(value));
    },
    removeItem(key        )       {
      tt.removeStorageSync(key);
    },
  };
}

/** tt 宿主音频合成器：容器 WebAudio 缺失即 available()=false，门面静默跳过（不阻塞玩法） */
function ttSynthAvailable()          {
  const g = globalThis                                                                 ;
  return typeof g.tt?.createWebAudioContext === 'function';
}

export function createDyRuntime(opts                  )            {
  const tt = opts.tt;
  const storageLike = ttStorageLike(tt);
  const audio = createAudio(storageLike);
  const clock = opts.clock ?? systemClock();
  const systemInfo = tt.getSystemInfoSync();

  const detachFns                    = [];
  return {
    tag: 'dy',
    storageLike,
    audio,
    clock,
    systemInfo,
    attachLifecycle(handlers) {
      // 宿主 API 无解绑能力：回调仅注册一次，返回句柄保留对称语义（与 wx-runtime 同构）
      try { tt.onShow(() => handlers.onShow()); } catch { /* 宿主能力缺失静默 */ }
      try { tt.onHide(() => handlers.onHide()); } catch { /* 同上 */ }
      return { detach: () => { for (const f of detachFns) f(); } };
    },
  };
}

export { ttSynthAvailable };


//# sourceURL=platform/dy/runtime.ts