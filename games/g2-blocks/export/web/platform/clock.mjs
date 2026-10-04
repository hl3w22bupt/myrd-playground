// clock.ts — 可注入时钟（A 轮 N3-T3 · 零外部依赖）
//
// 用途：把「现在几点」从业务逻辑里剥离。内核/玩法只认 Clock 接口，测试注入 fixedClock 即可复现，
// 生产注入 systemClock。daily（跨日重置）与任何时间敏感逻辑都以本接口取时。
// 纪律：本文件属 platform 层（非内核），systemClock 内部用 Date.now 不触 ac-14 内核纯净扫描。

                        
                
                  
                                                                    
                            
 

/** 生产时钟：真实系统时间 + 真实本地时区 */
export function systemClock()        {
  return {
    nowMs: ()         => Date.now(),
    tzOffsetMinutes: ()         => new Date().getTimezoneOffset(),
  };
}

/** 测试时钟：恒定时刻 + 恒定时区（同输入恒输出，契约/对抗用例复现用） */
export function fixedClock(epochMs        , tzOffsetMinutes = -480)        {
  if (!Number.isFinite(epochMs)) throw new TypeError(`epochMs 非有限数: ${epochMs}`);
  if (!Number.isInteger(tzOffsetMinutes)) throw new TypeError(`tzOffsetMinutes 非整数: ${tzOffsetMinutes}`);
  return { nowMs: ()         => epochMs, tzOffsetMinutes: ()         => tzOffsetMinutes };
}

/** 可推进时钟：手动 tick，用于时序类用例（跨日/连续手）不依赖真实等待 */
                                             
                                   
                             
 

export function steppedClock(startEpochMs        , tzOffsetMinutes = -480)               {
  let cur = startEpochMs;
  return {
    nowMs: ()         => cur,
    tzOffsetMinutes: ()         => tzOffsetMinutes,
    advanceMs: (deltaMs        )       => {
      if (!Number.isFinite(deltaMs)) throw new TypeError(`deltaMs 非有限数: ${deltaMs}`);
      cur += deltaMs;
    },
    set: (epochMs        )       => {
      if (!Number.isFinite(epochMs)) throw new TypeError(`epochMs 非有限数: ${epochMs}`);
      cur = epochMs;
    },
  };
}


//# sourceURL=platform/clock.ts