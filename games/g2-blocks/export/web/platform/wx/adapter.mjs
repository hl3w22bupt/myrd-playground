// adapter.ts — 微信小游戏容器垫片（WX 提审轮 N2-P2 · 表现层装配，零内核触碰）
//
// 职责：在 wx 容器内提供 main.ts 所需的最小浏览器面——
//   canvas(#stage) / document.getElementById / window(localStorage·devicePixelRatio·inner尺寸·addEventListener)
//   location.search（来自启动 query）/ requestAnimationFrame 兜底 / 触摸 → pointerdown 映射 / URLSearchParams 兜底。
// 纪律：
//   ① 只垫不改：main.ts 与内核零改动；垫片面 = 表现层（canvas/localStorage/布局输入）。
//   ② 本件零内核 import；零随机数/系统时钟直调字面（含注释；时间源一律经容器 performance/rAF 面）。
//   ③ 宿主能力缺失一律静默降级，绝不抛错（资产/能力缺失走 fallback 判例）。
                                          

                                  
                            
                      
                       
              
 

                                                        

/** 极小 URLSearchParams 兜底（仅 ?a=b&c=d 读取面；wx 容器可能缺此全局） */
function ensureUrlSearchParams()       {
  const g = globalThis                                                                                         ;
  if (typeof g.URLSearchParams === 'function') return;
  class MiniURLSearchParams {
            m = new Map                ();
    constructor(s        ) {
      for (const part of String(s || '').replace(/^\?/, '').split('&')) {
        if (!part) continue;
        const i = part.indexOf('=');
        if (i < 0) this.m.set(part, '');
        else this.m.set(part.slice(0, i), decodeURIComponent(part.slice(i + 1)));
      }
    }
    get(k        )                { return this.m.has(k) ? this.m.get(k) ?? null : null; }
  }
  g.URLSearchParams = MiniURLSearchParams                                                                   ;
}

export function installWxAdapter(wx        )                  {
  const g = globalThis                                      ;
  ensureUrlSearchParams();

  const info = wx.getSystemInfoSync();
  const dpr = Math.min(2, info.pixelRatio || 1);
  const windowWidth = info.windowWidth;
  const windowHeight = info.windowHeight;

  const canvas = wx.createCanvas()                     ;
  const style = (canvas                                                ).style || {};
  (canvas                                                ).style = style;
  (canvas                                                                                                        )
    .getBoundingClientRect = () => ({ left: 0, top: 0, width: windowWidth, height: windowHeight });

                                      
  const windowHandlers = new Map                      ();
  const canvasHandlers = new Map                      ();
  const fire = (map                           , type        , e         )       => {
    const set = map.get(type);
    if (!set) return;
    for (const h of set) { try { h(e); } catch { /* 单个监听器异常不阻塞 */ } }
  };

  const addEventListener = (map                           ) => (type        , h         )       => {
    if (!map.has(type)) map.set(type, new Set());
    map.get(type) .add(h);
    if (map === windowHandlers && type === 'resize' && typeof (wx                                                            ).onWindowResize === 'function') {
      (wx                                                           ).onWindowResize(() => fire(windowHandlers, 'resize', {}));
    }
  };

  const pointerFromTouch = (t           )                                       => ({ clientX: t.clientX, clientY: t.clientY });
  const bindTouch = (wxEvent                                               , domType        )       => {
    const fn = (wx                                                                                                )[wxEvent];
    if (typeof fn !== 'function') return;
    fn.call(wx, (e) => {
      const t = e.touches && e.touches[0];
      if (!t) return;
      fire(canvasHandlers, domType, pointerFromTouch(t));
    });
  };
  // 触摸接线（2026-10-05 驳回修复随件补全）：canvas.addEventListener 接入 canvasHandlers——
  // main.ts 的 canvas.addEventListener('pointerdown', …) 依赖本接线收 wx.onTouch* 映射事件；
  // 未接线时 fire 目标为空 Map（触摸静默丢失 = wx 面不可玩，runbook G2 会暴露）。
  (canvas                                                                       ).addEventListener =
    addEventListener(canvasHandlers);
  bindTouch('onTouchStart', 'pointerdown');
  bindTouch('onTouchMove', 'pointermove');
  bindTouch('onTouchEnd', 'pointerup');

  const localStorageLike = {
    getItem: (k        )                => { const v = wx.getStorageSync(k); return v === '' || v === undefined || v === null ? null : String(v); },
    setItem: (k        , v        )       => { wx.setStorageSync(k, String(v)); },
    removeItem: (k        )       => { wx.removeStorageSync(k); },
  };

  // location.search ← 启动 query（level/daily 等入口参数；零 PII，键值面 = 渠道约定）
  const launch = wx.getLaunchOptionsSync();
  const qs = Object.entries(launch?.query ?? {}).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
  const locationShim = { search: qs ? `?${qs}` : '', href: 'game://wx/local/' };

  const windowShim = {
    localStorage: localStorageLike,
    devicePixelRatio: dpr,
    innerWidth: windowWidth,
    innerHeight: windowHeight,
    addEventListener: addEventListener(windowHandlers),
    removeEventListener: (type        , h         )       => { windowHandlers.get(type)?.delete(h); },
  };

  const documentShim = {
    getElementById: (_id        )                    => canvas,
    createElement: (_tag        )                          => ({}),
    addEventListener: ()       => { /* 文档级事件 wx 面不需要 */ },
  };

  g.document = documentShim;
  g.window = windowShim;
  g.location = locationShim;
  g.navigator = g.navigator ?? { userAgent: 'wx-minigame' };
  if (typeof g.requestAnimationFrame !== 'function') {
    // 兜底：无 rAF 的低版本容器按 ~60fps 定时驱动（仅表现层；内核为固定步长仿真，不依赖帧率）
    g.requestAnimationFrame = (cb                     )         => setTimeout(() => cb(0), 16)                     ;
  }

  return { canvas, windowWidth, windowHeight, dpr };
}


//# sourceURL=platform/wx/adapter.ts