// web/game.ts — 可玩面对局模型（line4-unblock-jam · 表现层，审查通过版落地 2026-10-26）
//
// 边界：本文件只做「拖动→落定→驶出/失败」的局内编排，零平台感知（DOM/canvas/input 在别处）、
// 零 Math.random / 零 Date.now（seed 由会话层注入；spec level-proc-gen/el-daily-seed 写死面）。
// 计数纪律：moveCount/comboCount 唯一所有权 = kernel/session.ts 控名人——本模型只经
// settleMove / settleExitFrame 结算通道落定，禁止第二处直改（spec entities[e-session] 写死面）。
// 复用面：布局派生/红轮三边界=levels/director.ts；驶出/通关判定=entities/exit.ts（事件名写死零旁路）。
import { deriveLot, shouldEnterRedRound, planRedRound } from '../levels/director.ts';
import { checkExit, checkLevelComplete, EV_CAR_EXIT, EV_LEVEL_COMPLETE, EV_LEVEL_FAIL } from '../entities/exit.ts';
import { occupancy, targetCar, type Lot } from '../entities/lot.ts';
import { createSessionState, begin, settleMove, settleExitFrame, getCounters, type SessionState } from '../kernel/session.ts';
import type { Car } from '../entities/car.ts';

export type GameEvent =
  | typeof EV_CAR_EXIT | typeof EV_LEVEL_COMPLETE | typeof EV_LEVEL_FAIL
  | 'car.drag_end' | 'red.enter' | 'red.clear' | 'red.fail' | 'red.downgrade' | 'budget.exhausted';

export interface Game {
  seed: number;
  levelId: string;
  levelName: string;
  lot: Lot;
  /** 进入本局前是否已入红轮（spec level-2/el-red-entry 谓词的会话层消费） */
  red: boolean;
  /** 谱系参数 par（红轮进入边界上界，PEND-待校准显式不编数） */
  par: number;
  phase: 'playing' | 'won' | 'failed';
  frame: number;
  /** 红轮步数预算（spec numeric.redRoundStepBudget，会话层注入，零手抄） */
  budget: number;
  /** 红轮已耗步数（el-red-clear/el-red-fail 边界判读输入） */
  budgetUsed: number;
  /** 计数控名人（唯一所有权：src/kernel/session.ts——本模型经结算通道读写） */
  session: SessionState;
}

export function createGame(seed: number, levelId: string, levelName: string, red: boolean, budget = 0): Game {
  const lot = deriveLot(seed);
  return {
    seed, levelId, levelName, lot, red, par: lot.par, phase: 'playing', frame: 0, budget, budgetUsed: 0,
    session: begin(createSessionState(seed)),
  };
}

/** 只读计数面（对外唯一合法读口，session.ts 判例同型） */
export const counters = (g: Game): Readonly<{ moveCount: number; comboCount: number; pendingActive: boolean }> => getCounters(g.session);

export interface MoveResult { ok: boolean; events: GameEvent[]; reason?: string; }

/**
 * 逐格路径判定（占格面 + 出口车道豁免）：车身每格要么在网格内空位（非障碍非他车），
 * 要么属出口车道（红目标车、出口行、col ≥ size 的越界段）——与 director.solveLot
 * 终态口径逐字同义（「车尾越线=整车驶出」），lot.hasCollision 不认出口车道故不在此复用。
 */
function pathFree(g: Game, c: Car, nr: number, nc: number): boolean {
  const grid = occupancy(g.lot);
  for (let i = 0; i < c.len; i += 1) {
    const r = c.orient === 'h' ? nr : nr + i;
    const col = c.orient === 'h' ? nc + i : nc;
    const exitLane = c.color === 'red' && c.orient === 'h' && r === g.lot.exit.row && col >= g.lot.size;
    if (exitLane) continue;
    if (r < 0 || col < 0 || r >= g.lot.size || col >= g.lot.size) return false;
    const cell = grid[r][col];
    if (cell !== null && cell !== c.id) return false;
  }
  return true;
}

/**
 * 一次拖动落定（表现层唯一入口）：
 * ① 逐格碰撞试探（路径全空才可滑；出口车道允许目标车出界=整车驶出口径）
 * ② 落定走 session.settleMove（控名人唯一写通道：moves+1）
 * ③ 同帧判读 驶出（car.exit → settleExitFrame 连击唯一增量）→ 通关 / 红轮超预算判负。
 */
export function applyDrag(g: Game, carId: string, dCells: number): MoveResult {
  if (g.phase !== 'playing') return { ok: false, events: [], reason: '局已终' };
  const c = g.lot.cars.find((x) => x.id === carId);
  if (!c || dCells === 0) return { ok: false, events: [], reason: '无目标车或零位移' };
  const dir = Math.sign(dCells);
  const events: GameEvent[] = ['car.drag_end'];
  let row = c.row, col = c.col, moved = 0;
  for (let k = 0; k < Math.abs(dCells); k += 1) {
    const nr = row + (c.orient === 'v' ? dir : 0);
    const nc = col + (c.orient === 'h' ? dir : 0);
    if (!pathFree(g, c, nr, nc)) break; // 含出口车道豁免的逐格试探（与 solveLot 同口径）
    row = nr; col = nc; moved += 1;
  }
  if (moved === 0) return { ok: false, events, reason: '路径受阻（零位移不计数）' };
  const cars = g.lot.cars.map((x) => (x.id === carId ? { ...x, row, col } : x));
  g.lot = { ...g.lot, cars };
  g.session = settleMove(g.session); // 控名人：有效移动落定 moves+1
  g.frame += 1;
  if (g.red) g.budgetUsed += 1;
  if (checkExit(g.lot, g.frame)?.event === EV_CAR_EXIT) {
    events.push(EV_CAR_EXIT);
    g.session = settleExitFrame(g.session); // 连击唯一增量通道（car.exit 事件帧）
  }
  if (checkLevelComplete(g.lot, g.frame)?.event === EV_LEVEL_COMPLETE && targetCar(g.lot).col >= g.lot.size) {
    g.phase = 'won';
    events.push(EV_LEVEL_COMPLETE);
    return { ok: true, events };
  }
  if (g.red && g.budgetUsed >= g.budget && g.phase === 'playing') {
    // el-red-fail：红轮步数预算耗尽未驶出即 level.fail（超预算无豁免，2026-10-25 驳回勘误口径）
    g.phase = 'failed';
    events.push('budget.exhausted', EV_LEVEL_FAIL);
  }
  return { ok: true, events };
}

/** 红轮收局裁决（三边界唯一裁判 = director.planRedRound，会话层只透传数值） */
export function resolveRedRound(g: Game, failStreak: number, downgrade: number) {
  return planRedRound({ exited: g.phase === 'won', redMoves: g.budgetUsed, prevMoves: counters(g).moveCount, par: g.par, budget: g.budget, failStreak, downgrade });
}

/** 红轮进入边界（进入谓词唯一实现 = director.shouldEnterRedRound，会话层只透传） */
export function shouldEnterRed(prevMoves: number, par: number): boolean {
  return shouldEnterRedRound(prevMoves, par);
}
