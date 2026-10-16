// adapter.ts — 抖音小游戏容器垫片（DY 平台段轮 N2 · 表现层装配，零内核触碰）
//
// 职责：在 tt 容器内提供 main.ts 所需的最小浏览器面——
//   canvas(#stage) / document.getElementById / window(localStorage·devicePixelRatio·inner尺寸·addEventListener)
//   location.search（来自启动 query）/ requestAnimationFrame 兜底 / 触摸 → pointerdown 映射 / URLSearchParams 兜底。
// 纪律：
//   ① 只垫不改：main.ts 与内核零改动；垫片面 = 表现层（canvas/localStorage/布局输入）。
//   ② 本件零内核 import；零随机数/系统时钟直调字面（含注释；时间源一律经容器 performance/rAF 面）。
//   ③ 宿主能力缺失一律静默降级，绝不抛错（映射 dy-diff-06：safeArea 缺失走默认值）。
//   ④ 触摸接线沿 wx 轮 ed172e1 判例反向钉死：canvas.addEventListener 必须接入 handlers（fire 目标非空）。
                                          

                                  
                            
                      
                       
              
                                             
                                                                          
 

                                                        

/**
 * 全局注入双路（沿 navigator 判例泛化）：
 *  - 宿主缺失该全局（tt 容器无 DOM）→ 直接赋值；
 *  - 宿主已有该全局（浏览器代理跑冒烟等）→ defineProperty 覆写（getter-only 裸赋值会抛 TypeError）；
 *  - 覆写失败（极端宿主）→ 保留原生，绝不抛错（调用方按宿主原生面继续）。
 */
function defGlobal(g                         , name        , value         )       {
  if (typeof g[name] === 'undefined') {
    try { g[name] = value; return; } catch { /* 落 defineProperty */ }
  }
  try {
    Object.defineProperty(g, name, { value, writable: true, configurable: true });
  } catch { /* 保留原生 */ }
}

/** 极小 URLSearchParams 兜底（仅 ?a=b&c=d 读取面；tt 容器可能缺此全局） */
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

export function installDyAdapter(tt        )                  {
  const g = globalThis                                      ;
  ensureUrlSearchParams();

  const info = tt.getSystemInfoSync();
  const dpr = Math.min(2, info.pixelRatio || 1);
  const windowWidth = info.windowWidth;
  const windowHeight = info.windowHeight;
  // dy-diff-06：tt 侧 safeArea 可能缺省 → 全 0 内边距默认值，不抛错
  const sa = info.safeArea;
  const safeInset = {
    top: typeof sa?.top === 'number' ? Math.max(0, sa.top) : 0,
    bottom: typeof sa?.bottom === 'number' ? Math.max(0, windowHeight - sa.bottom) : 0,
    left: typeof sa?.left === 'number' ? Math.max(0, sa.left) : 0,
    right: typeof sa?.right === 'number' ? Math.max(0, windowWidth - sa.right) : 0,
  };

  const canvas = tt.createCanvas()                     ;
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
  };

  const pointerFromTouch = (t           )                                       => ({ clientX: t.clientX, clientY: t.clientY });
  const bindTouch = (ttEvent                                               , domType        )       => {
    const fn = (tt                                                                                                )[ttEvent];
    if (typeof fn !== 'function') return;
    fn.call(tt, (e) => {
      const t = e.touches && e.touches[0];
      if (!t) return;
      fire(canvasHandlers, domType, pointerFromTouch(t));
    });
  };
  // 触摸接线（映射 dy-diff-07；沿 wx 轮 ed172e1 判例反向钉死）：canvas.addEventListener 接入
  // canvasHandlers——main.ts 的 canvas.addEventListener('pointerdown', …) 依赖本接线收 tt.onTouch*
  // 映射事件；未接线时 fire 目标为空 Map（触摸静默丢失 = dy 面不可玩，runbook G2 会暴露）。
  (canvas                                                                       ).addEventListener =
    addEventListener(canvasHandlers);
  bindTouch('onTouchStart', 'pointerdown');
  bindTouch('onTouchMove', 'pointermove');
  bindTouch('onTouchEnd', 'pointerup');

  const localStorageLike = {
    getItem: (k        )                => { const v = tt.getStorageSync(k); return v === '' || v === undefined || v === null ? null : String(v); },
    setItem: (k        , v        )       => { tt.setStorageSync(k, String(v)); },
    removeItem: (k        )       => { tt.removeStorageSync(k); },
  };

  // location.search ← 启动 query（level 等入口参数；零 PII，键值面 = 渠道约定）
  const launch = tt.getLaunchOptionsSync();
  const qs = Object.entries(launch?.query ?? {}).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
  const locationShim = { search: qs ? `?${qs}` : '', href: 'game://dy/local/' };

  const windowShim = {
    localStorage: localStorageLike,
    devicePixelRatio: dpr,
    innerWidth: windowWidth,
    innerHeight: windowHeight,
    addEventListener: addEventListener(windowHandlers),
    removeEventListener: (type        , h         )       => { windowHandlers.get(type)?.delete(h); },
    // location 垫片（sync/dy-v1.3 适配缺陷修复）：v1.3 首批 main.ts 顶层读 window.location.search
    // （near-miss telemetry internal flag + level/daily 入口参数）——web 宿主自带，tt 容器 Worker 面
    // 缺省 → 只垫不改（同 locationShim 单源），缺垫 = main 模块求值即 TypeError（黑屏零诊断）。
    location: locationShim,
  };

  const documentShim = {
    getElementById: (_id        )                    => canvas,
    createElement: (_tag        )                          => ({}),
    addEventListener: ()       => { /* 文档级事件 tt 面不需要 */ },
  };

  defGlobal(g, 'document', documentShim);
  defGlobal(g, 'window', windowShim);
  defGlobal(g, 'location', locationShim);
  defGlobal(g, 'navigator', { userAgent: 'tt-minigame' });
  if (typeof g.requestAnimationFrame !== 'function') {
    // 兜底：无 rAF 的低版本容器按 ~60fps 定时驱动（仅表现层；内核为固定步长仿真，不依赖帧率）
    g.requestAnimationFrame = (cb                     )         => setTimeout(() => cb(0), 16)                     ;
  }

  // 遥测原生桥注册（sync/dy-v1.3 · dr-acc-2 收口）：tt.* 直调只许出现在 src/platform/dy/ 门面内。
  // 装填时把 tt.reportAnalytics 桥接进全局注册面 __G2_DY_SINK，telemetry/analytics.ts 只消费注册面
  // （零 tt 字面）；时序保证 = boot-dy 先装垫片再动态 import main（main 运行期 autoSink 探测时桥必已注册）。
  // 上报失败静默（不阻塞玩法，沿 analytics.ts dy sink 同口径）。
  defGlobal(g, '__G2_DY_SINK', (eventId        , payload                         )       => {
    try {
      const report = (tt                                                                                        ).reportAnalytics;
      if (typeof report === 'function') report.call(tt, eventId, payload);
    } catch { /* 上报失败不影响玩法 */ }
  });

  // 安全区机读观测口（dy 同步轮美术留证面）：真机档（devtools/真机）核对 HUD 顶行与容器胶囊
  // 关系时直接读此值，零插桩；缺省全 0（dy-diff-06 fallback 口径不变）。
  defGlobal(g, '__G2_DY_SAFEINSET', { ...safeInset });

  return { canvas, windowWidth, windowHeight, dpr, safeInset };
}


//# sourceURL=platform/dy/adapter.ts