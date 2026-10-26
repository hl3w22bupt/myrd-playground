// entities/exit.ts — 出口门（line4-unblock-jam · spec v0.2 entities[e-exit]）
//
// spec expect（逐条对齐）：出口门：目标车驶出判定线（车尾越线的事件帧即 car.exit）；
// 触发 vf-car-exit-burst 反馈（首反馈 ≤1 帧渲染成本，三通道规格见 assets.md §四）。
// 事件名写死（QA 缺陷 F1 核销锚点）：car.exit / level.complete 走本文件唯一出口，
// 判定与反馈同帧（acc-02：car_exit_latency_ms_p95 ≤100ms 的机制面前身）。
                                    
import { targetCar } from './lot.mjs';

/** 驶出事件名（契约键，零旁路拼写） */
export const EV_CAR_EXIT = 'car.exit'         ;
export const EV_LEVEL_COMPLETE = 'level.complete'         ;
export const EV_LEVEL_FAIL = 'level.fail'         ;

                            
                                                                              
                                                             
                
 

/**
 * 驶出判定（判定线口径）：目标车横放，右移至车头 col+len-1 ≥ 出口线 col0 = size-1 时，
 * 车尾（col）越过 size-2 即整车有 ≥1 格出界 → car.exit 事件帧。
 * v0 冻结：出口在右边界 row=exitGate.row 一行（2 格宽开口由渲染层 a03-exit-gate 表达）。
 */
export function checkExit(lot     , frame        )                   {
  const gate = lot.exit;
  const t = targetCar(lot);
  if (t.row !== gate.row) return null;              // 目标车不在出口行 → 不判定
  if (t.orient !== 'h') return null;                 // v0 目标车恒横放
  const tailCrossed = t.col >= lot.size; // 车尾（左端）越过右边界线=整车驶出（spec 口径，与 director.solveLot 终态一致）
  if (!tailCrossed) return null;
  return { event: EV_CAR_EXIT, frame };
}

/** 通关判定：目标车已完全驶出（col ≥ size）→ level.complete 同帧发出 */
export function checkLevelComplete(lot     , frame        )                   {
  const t = targetCar(lot);
  if (t.row === lot.exit.row && t.col >= lot.size) return { event: EV_LEVEL_COMPLETE, frame };
  return null;
}

/** 正反馈通道名（三通道规格 v0.2 勘误口径：通道/预算/硬顶，spec acc-02 statement 原文） */
export const VF_CHANNELS = ['vf-car-exit-burst', 'vf-combo-pop', 'vf-level-clear']         ;
                                                     
