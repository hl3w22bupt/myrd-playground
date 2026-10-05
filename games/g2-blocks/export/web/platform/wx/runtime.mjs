// runtime.ts — 微信小游戏运行时装配（WX 提审轮 N2-P2 · 复用 T1/T3 门面，核心逻辑零改动）
//
// 纪律（spec wx-runtime 条目）：
//   ① 存储复用 src/platform/storage.ts 门面 + persistence 键制（muted/anonId 最小集，不新增落盘键）；
//   ② 音频复用 src/audio.ts 门面（合成器可注入；容器缺失静默跳过，不阻塞玩法）；
//   ③ 时钟复用 src/platform/clock.ts（可注入；缺省 systemClock）；
//   ④ 生命周期 onShow/onHide 经 wx.onShow/onHide 注册，回调仅作表现层挂起/恢复，零内核触碰；
//   ⑤ 本件零内核 import；wx 宿主注入（DI），Node 侧测试用 fake 宿主。
                                                        
import { createAudio } from '../../audio.mjs';
import { systemClock,            } from '../clock.mjs';
                                          

                            
                     
            
                                                   
                           
                                      
                                        
                                              
               
                           
                                                      
                                           
                                                                                            
 

                                   
                                        
             
                             
                
 

/** wx 同步存储 → StorageLike（wx.getStorageSync 缺键返回空串，映射为 null） */
function wxStorageLike(wx        )              {
  return {
    getItem(key        )                {
      const v = wx.getStorageSync(key);
      return v === '' || v === undefined || v === null ? null : String(v);
    },
    setItem(key        , value        )       {
      wx.setStorageSync(key, String(value));
    },
    removeItem(key        )       {
      wx.removeStorageSync(key);
    },
  };
}

/** wx 宿主音频合成器：容器 WebAudio 缺失即 available()=false，门面静默跳过（不阻塞玩法） */
function wxSynthAvailable()          {
  const g = globalThis                                                                 ;
  return typeof g.wx?.createWebAudioContext === 'function';
}

export function createWxRuntime(opts                  )            {
  const wx = opts.wx;
  const storageLike = wxStorageLike(wx);
  const audio = createAudio(storageLike);
  const clock = opts.clock ?? systemClock();
  const systemInfo = wx.getSystemInfoSync();

  const detachFns                    = [];
  return {
    tag: 'wx',
    storageLike,
    audio,
    clock,
    systemInfo,
    attachLifecycle(handlers) {
      const onHideWrap = ()       => {
        try { wx.onHide(() => handlers.onHide()); } catch { /* 宿主能力缺失静默 */ }
      };
      // 每次调用注册一次；返回句柄只解绑表现层（宿主 API 无解绑能力，置空标记）
      try { wx.onShow(() => handlers.onShow()); } catch { /* 同上 */ }
      onHideWrap();
      return { detach: () => { for (const f of detachFns) f(); } };
    },
  };
}

export { wxSynthAvailable };


//# sourceURL=platform/wx/runtime.ts