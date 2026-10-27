// dev/hud.ts — dev 性能 HUD：F1~F4 实时读数面板（line4-unblock-jam · 中性脚手架）
//
// 对应 spec QA 缺陷四族的判读证据面（F3 判读证据=dev HUD，口径见 numeric.measurement）：
//   F1 事件与引导：核心动作事件计数（car.drag_end/car.exit/level.complete）+ g-01 三步状态 + 60s 窗口余量
//   F2 局态与红轮：phase / moveCount / comboCount / 红轮预算消耗（三红轮边界读数）
//   F3 判读证据：冒烟局号/seed/采样帧数（N=20 定死，seeds 42..61）
//   F4 测量口径：时钟源标签 / 设备档位 / frame_time_p95 / fps_min（performance.now() 差分）
// 中性面：只聚合与渲染文本，不产生任何玩法语义；数值锚全部来自 spec 生成件（零手抄）。
import { NUMERIC } from '../generated/spec-data.mjs';

                                                    

                           
       
                         
                         
                               
                                                                  
                              
    
       
                  
                      
                       
                           
                           
                          
    
       
                   
                       
                     
                 
                          
    
       
                        
                       
                           
                   
    
 

/** p95（冒烟全量帧采样口径，与 numeric.telemetry.sampling 列一致） */
export function p95(samples          )         {
  if (samples.length === 0) return 0;
  const s = [...samples].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * 0.95))];
}

export function createHudModel()           {
  return {
    f1: { dragEndCount: 0, carExitCount: 0, levelCompleteCount: 0, g01Steps: { drag: false, exit: false, complete: false }, first60sRemainSec: NUMERIC.firstGuideWindowSec },
    f2: { phase: 'ready', moveCount: 0, comboCount: 0, pendingActive: false, redBudgetTotal: NUMERIC.redRoundStepBudget, redBudgetUsed: 0 },
    f3: { smokeN: NUMERIC.smokeN, smokeSeeds: NUMERIC.smokeSeeds, runIndex: 0, seed: 0, sampledFrames: 0 },
    f4: { clockSource: 'performance.now()（内核零 Date.now）', deviceTier: NUMERIC.deviceTier, frameTimeP95Ms: 0, fpsMin: 0 },
  };
}

/** 帧采样推进（表现层 performance.now() 差分；内核 fixed-step 16ms 累计不在此） */
export function pushFrame(model          , frameMs        )       {
  const buf = samplesOf(model);
  buf.push(frameMs);
  model.f4.frameTimeP95Ms = Math.round(p95(buf) * 100) / 100;
  model.f4.fpsMin = model.f4.fpsMin === 0 ? Math.round(1000 / Math.max(frameMs, 1)) : Math.min(model.f4.fpsMin, Math.round(1000 / Math.max(frameMs, 1)));
  model.f3.sampledFrames += 1;
}

// 内部帧样本缓冲（HUD 自身聚合用）
const frameBuf = new WeakMap                  ();
function samplesOf(model          )           {
  let a = frameBuf.get(model);
  if (!a) { a = []; frameBuf.set(model, a); }
  return a;
}

/** 渲染为文本面板（web 层可直绘 DOM/canvas；headless 冒烟取文本判读） */
export function renderHud(model          )         {
  const { f1, f2, f3, f4 } = model;
  const g01 = (b         ) => (b ? '✓' : '…');
  return [
    `F1 事件/引导: drag_end=${f1.dragEndCount} car_exit=${f1.carExitCount} complete=${f1.levelCompleteCount} | g-01 [拖${g01(f1.g01Steps.drag)} 驶${g01(f1.g01Steps.exit)} 通${g01(f1.g01Steps.complete)}] 60s 余 ${f1.first60sRemainSec}s`,
    `F2 局态/红轮: ${f2.phase} move=${f2.moveCount} combo=${f2.comboCount} pending=${f2.pendingActive ? 'Y(零计数)' : 'N'} | 红轮预算 ${f2.redBudgetUsed}/${f2.redBudgetTotal}`,
    `F3 判读证据: 局 ${f3.runIndex}/${f3.smokeN} seed=${f3.seed} seeds=${f3.smokeSeeds} 采样帧=${f3.sampledFrames}`,
    `F4 测量口径: ${f4.clockSource} | ${f4.deviceTier} | p95=${f4.frameTimeP95Ms}ms fps_min=${f4.fpsMin}`,
  ].join('\n');
}
