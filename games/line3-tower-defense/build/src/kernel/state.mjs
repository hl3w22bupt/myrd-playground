// state.ts — 战局状态容器（确定性全量状态；序列化=det-1 对拍面）
// 四张机判序列表：spawnLog（波次编成序列）· enemies 推进面（spawn/end/pathDist）·
// fireLog（索敌开火序列）· dropLog（掉落序列）——同 seed 逐值一致。
// 哈希排除面：tickHashes（自身）/ events（瞬时消费面）——其余全量入哈希。

                                                                    
import { canonical, fnv1a } from "./loop.mjs";
import { MIRRORED } from "./config.mjs";
                                                  
                                                    
                                                            

                                                                               

                          
                                               
                                                    
                         
                         
                                                     
                              
                                                            
                                                                                        
                                                                                       
 

                                                                              

                           
               
                   
               
               
               
                    
                    
               
                         
                        
                          
                          
                                                                           
                   
                    
                            
                     
                                                                      
                               
                                        
                             
                        
                       
                    
                  
                                                                       
                                                                  
              
                     
                        
                       
 

/** 哈希排除键（瞬时/自指面不入全 tick 哈希） */
const HASH_EXCLUDE = new Set(["tickHashes", "events"]);

/** 创建一局（同 seed 同初态；recordHashes=det-1 对拍开关，浏览器面默认关） */
export function createRun(cfg            , seed        , recordHashes = false)           {
  const st           = {
    seed,
    rngState: seed >>> 0,
    tick: 0,
    speed: 1,
    gold: cfg.economy.startGold,
    coreLives: cfg.coreLives,
    waveIndex: 0,
    phase: "prep",
    phaseTicksLeft: Math.round(cfg.pacing.wavePrepMs / cfg.fixedStepMs),
    waveElapsedMs: 0,
    spawnQueue: [],
    spawnTimerTicks: 0,
    spawnLog: [],
    enemies: [],
    turrets: [],
    projectiles: [],
    occupied: [],
    nextEnemyId: 1, nextTurretId: 1, nextProjectileId: 1,
    kills: 0, leaks: 0,
    goldEarned: 0, goldSpent: 0,
    firstPlacementTick: 0,
    firstLoopTick: 0,
    restartCount: 0,
    status: "running",
    endTick: 0,
    fireLog: [],
    dropLog: [],
    fx: {
      placeTileKey: "", placeTicksLeft: 0,
      upgradeTurretId: 0, upgradeTicksLeft: 0,
      coreFlashTicks: 0, killPulseTicks: 0,
      guidanceHidden: false, guidanceFadeTicks: 0,
      settlementFadeTicks: 0,
      hitFlashes: [], particles: [], traces: [],
    },
    events: [],
    recordHashes,
    tickHashes: [],
  };
  return st;
}

/** 全 tick 状态哈希（排除面剔除后规范化；det-1 双局对拍） */
export function stateHashOf(state          )         {
  const clone                          = {};
  for (const k of Object.keys(state)) if (!HASH_EXCLUDE.has(k)) clone[k] = (state                                      )[k];
  return fnv1a(canonical(clone));
}

/** 同构性自检：createRun(MIRRORED,seed) 与任意 cfg 同 seed 初态规范化逐字节等（镜像断言运行面） */
export function initialStatesEqual(cfg            , seed        )          {
  return canonical(createRun(cfg, seed)) === canonical(createRun(MIRRORED, seed));
}
