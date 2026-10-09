// analytics.ts — 产品埋点（封版就绪冲刺 N4 · spec 链 v7 ac-29 九事件表单源）
//
// 纪律（任务书红线）：
//   ① 零玩法 diff：本模块只读调用方显式入参，不查 DOM、不读存档、不 await、不抛异常；
//      玩法路径内全部为同步 fire-and-forget 单次调用（锚点 once 语义用布尔标记，零热路径分配）。
//   ② 平台路由面单源：web = navigator.sendBeacon + pagehide/visibilitychange flush 兜底；
//      wx = wx.reportEvent（原生上报）；dy = tt.reportAnalytics（原生上报）；不自建第三方 SDK。
//   ③ 事件 id 清单 = spec acceptance ac-29.events 的代码面镜像（唯一第二份，契约双向断言盯防）。
//   ④ 无后端静态部署：web 面默认缓冲 + `__G2_ANALYTICS_LOG` 调试出口（QA 机读）；
//      设 `__G2_ANALYTICS_ENDPOINT` 后 sendBeacon 才外发（未设 = 只缓冲不外发，如实披露）。

                                                            

                                    
             
                                   
                                          
 

/** 九事件表（代码面镜像；spec 面 = acceptance ac-29.events，双向断言 ac-29 契约件盯防） */
export const ANALYTICS_EVENTS                               = [
  { id: 'session_start', surface: 'web', once: true },
  { id: 'session_end', surface: 'web', once: true },
  { id: 'run_start', surface: 'web', once: false },
  { id: 'run_end', surface: 'web', once: false },
  { id: 'restart_clicked', surface: 'web', once: false },
  { id: 'evt_first_screen', surface: 'web', once: true },
  { id: 'evt_first_drag', surface: 'web', once: true },
  { id: 'evt_first_place', surface: 'web', once: true },
  { id: 'share_clicked', surface: 'platform-only', once: false },
];

                                                                                

                                
                         
                                                         
                                                                                    
 

                         
             
             
                            
 

const g = globalThis                                      ;

function wxGlobal()                                 {
  return typeof g.wx === 'object' && g.wx !== null ? (g.wx                           ) : null;
}

function ttGlobal()                                 {
  return typeof g.tt === 'object' && g.tt !== null ? (g.tt                           ) : null;
}

/** wx 原生上报 sink：wx.reportEvent(eventId, kv)；缺失时静默丢弃（不阻塞玩法） */
export function wxSink()                {
  return {
    kind: 'wx',
    send: (eventId, payload) => {
      try { (wxGlobal()?.reportEvent                                                              )?.(eventId, payload); } catch { /* 上报失败不影响玩法 */ }
    },
    flush: () => { /* wx 原生通道即时上报，无缓冲可冲 */ },
  };
}

/** dy 原生上报 sink：tt.reportAnalytics(eventId, kv)；缺失时静默丢弃（不阻塞玩法） */
export function dySink()                {
  return {
    kind: 'dy',
    send: (eventId, payload) => {
      try { (ttGlobal()?.reportAnalytics                                                              )?.(eventId, payload); } catch { /* 上报失败不影响玩法 */ }
    },
    flush: () => { /* dy 原生通道即时上报，无缓冲可冲 */ },
  };
}

/** web sink：缓冲 + sendBeacon（端点未配置 = 只缓冲；pagehide/隐藏时 flush 兜底） */
                                                
                                      
                                                                      
 

export function webSink()          {
  const buffer                  = [];
  const endpoint = ()                     => typeof g.__G2_ANALYTICS_ENDPOINT === 'string' ? g.__G2_ANALYTICS_ENDPOINT           : undefined;
  return {
    kind: 'web',
    send: (eventId, payload) => {
      const item                = { id: eventId, ts: Date.now(), payload };
      buffer.push(item);
      if (buffer.length > 256) buffer.shift(); // 有界缓冲：会话级，防长局膨胀
      const url = endpoint();
      if (url && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        try { navigator.sendBeacon(url, new Blob([JSON.stringify(item)], { type: 'application/json' })); } catch { /* 外发失败留缓冲 */ }
      }
    },
    flush: (events) => {
      if (events.length === 0) return;
      const url = endpoint();
      if (url && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        try { navigator.sendBeacon(url, new Blob([JSON.stringify({ batch: events })], { type: 'application/json' })); } catch { /* 外发失败丢弃（会话已结束） */ }
      }
    },
    log: () => buffer.map((e) => ({ id: e.id, ts: e.ts, payload: e.payload })),
  };
}

/** 无通道 sink（Node/契约测试/无 API 环境）：只计数不外发 */
export function nullSink()                {
  return { kind: 'null', send: () => {}, flush: () => {} };
}

/** 平台探测：wx → dy → web → null（顺序即优先级；平台包只命中自己的全局） */
export function autoSink()                {
  if (wxGlobal()) return wxSink();
  if (ttGlobal()) return dySink();
  if (typeof navigator !== 'undefined') return webSink();
  return nullSink();
}

                            
                                      
                                                                            
                                                
                                              
                                            
                                          
                                                  
                                                  
                                                
                                                 
                                                
                
                           
 

/** 会话 id（每会话一次；telemetry 面允许 Math.random——kernel 纯度红线只限 src/kernel） */
function newSessionId()         {
  return `s-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

export function createAnalytics(sink               , opts                         = {})            {
  const now = opts.now ?? Date.now;
  const sessionId = newSessionId();
  const sentOnce = new Set        ();
  let runSeq = 0;
  let runOpen = false;
  let runEndedFired = false;
  const log                  = [];

  const emit = (def                   , payload                  )       => {
    if (def.once && sentOnce.has(def.id)) return;
    if (def.once) sentOnce.add(def.id);
    const event                = { id: def.id, ts: now(), payload: { sessionId, ...payload } };
    log.push(event);
    if (log.length > 512) log.shift();
    try { sink.send(def.id, event.payload); } catch { /* sink 异常不外溢（零玩法影响） */ }
  };

  const def = (id        )                    => {
    const found = ANALYTICS_EVENTS.find((e) => e.id === id);
    if (!found) throw new Error(`analytics: 未声明事件 ${id}（九事件表单源面）`);
    return found;
  };

  const api            = {
    sinkKind: sink.kind,
    sessionId,
    sessionStart: (p) => emit(def('session_start'), p),
    sessionEnd: (p) => emit(def('session_end'), p),
    runStart: (p) => {
      runSeq += 1;
      runOpen = true;
      runEndedFired = false;
      emit(def('run_start'), { runSeq, ...p });
    },
    runEnd: (p) => {
      if (!runOpen || runEndedFired) return; // 每局至多一次；未开局不报
      runEndedFired = true;
      runOpen = false;
      emit(def('run_end'), { runSeq, ...p });
    },
    restartClicked: (p) => emit(def('restart_clicked'), p),
    firstScreen: (p) => { emit(def('evt_first_screen'), p); return sentOnce.has('evt_first_screen'); },
    firstDrag: (p) => { emit(def('evt_first_drag'), p); return sentOnce.has('evt_first_drag'); },
    firstPlace: (p) => { emit(def('evt_first_place'), p); return sentOnce.has('evt_first_place'); },
    shareClicked: (p) => emit(def('share_clicked'), p),
    flush: () => {
      try { sink.flush(log.slice()); } catch { /* flush 异常不外溢 */ }
    },
    sentEventIds: () => log.map((e) => e.id),
  };
  return api;
}


//# sourceURL=telemetry/analytics.ts