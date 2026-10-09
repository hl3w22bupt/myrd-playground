// nearmiss-telemetry.ts — near-miss 遥测面（v1.3 首批 · ac-31 events · e-nearmiss.attributes.events）
//
// 事件 id 单源 = spec ac-31.events（nm_triggered / nm_capped）；本模块是代码镜像第二份，
// 契约件双向断言盯防（沿 ac-29 ANALYTICS_EVENTS 先例）。事件 id 不进 ac-29 九事件表（表满员零改动）。
//
// 口径（链 v8 + 任务书「内测工具」标注）：
//   web 面只缓冲不外发（未配 __G2_ANALYTICS_ENDPOINT 时同 ac-29 如实披露）；wx/dy 走原生路由 sink。
//   内部玩家 tag：?internal=1 显式开启 → payload.internal=true；缺省 absent（零行为零标记）。
//   局级 seed 入每条事件（runSeed；DoD 首轮校准的 seed 重放抽检数据源）。
//   零抛异常（sink 异常不外溢，零玩法影响）；缓冲有界（512，同 analytics 面纪律）。
                                                                      

export const NM_EVENT_IDS = ['nm_triggered', 'nm_capped']         ;
                                                      

                              
                             
                                               
                                      
                                            
                                   
                                        
                                                                         
                                         
                
 

                            
                 
               
                             
               
                  
                                 
                 
                            
                 
 

export function createNearMissTelemetry(sink               , opts                                                               )              {
  const now = opts.now ?? Date.now;
  const log                                                                  = [];
  const emit = (id           , p           )       => {
    const payload                   = {
      sessionId: opts.sessionId,
      ts: now(),
      runSeq: p.runSeq,
      seed: p.seed,
      phase: p.phase,
      rule: p.rule,
      rows: (p.rows ?? []).join('|'),
      chain: p.chain ?? null,
      handsLeft: p.handsLeft ?? null,
      score: p.score ?? null,
      internal: opts.internal === true,
      ...(p.capType ? { capType: p.capType } : {}),
    };
    if (log.length > 512) log.shift();
    log.push({ id, ts: now(), payload });
    try { sink.send(id, payload); } catch { /* sink 异常不外溢（零玩法影响） */ }
  };
  return {
    sessionId: opts.sessionId,
    triggered: (p) => emit('nm_triggered', p),
    capped: (p) => emit('nm_capped', p),
    log: () => log.slice(),
    flush: () => {
      try { sink.flush(log.map((e) => ({ id: e.id, ts: e.ts, payload: e.payload }))); } catch { /* flush 异常不外溢 */ }
    },
  };
}

/** 内部玩家标记（内测工具面）：?internal=1 显式开启；缺省 false（零行为零标记） */
export function internalPlayerFlag(search        )          {
  try {
    return new URLSearchParams(search).get('internal') === '1';
  } catch {
    return false;
  }
}


//# sourceURL=telemetry/nearmiss-telemetry.ts