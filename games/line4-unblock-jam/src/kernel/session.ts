// kernel/session.ts — 单局制会话 + 计数控名人（line4-unblock-jam · 中性脚手架）
//
// 计数控名人（spec v0 entities[e-session] 写死面，QA 缺陷⑤核销锚点）：
//   moveCount / comboCount 的【唯一所有权落点 = 本文件】——其余模块只读（get*），禁直接改写。
// pending 不计连击恒等式（spec acc-03）：comboCount 只能经 settleExitFrame()（car.exit 事件帧）+1；
//   pendingDrag()（拖拽中/未确认）与 cancelPending() 一律零增量。任何绕过 settle 通道的增量 = 契约违例。
export interface SessionCounters {
  moveCount: number;
  comboCount: number;
  pendingActive: boolean;
}

export interface SessionState {
  phase: 'ready' | 'running' | 'ended';
  seed: number;
  counters: SessionCounters;
}

export function createSessionState(seed: number): SessionState {
  return { phase: 'ready', seed, counters: { moveCount: 0, comboCount: 0, pendingActive: false } };
}

export function begin(state: SessionState): SessionState {
  return { ...state, phase: 'running' };
}

export function finish(state: SessionState): SessionState {
  return { ...state, phase: 'ended' };
}

// —— 写通道（仅本文件可实现的三个变更原语；对外其余皆只读） ——

/** 拖拽进入 pending：零计数（pending 不计连击） */
export function pendingDrag(state: SessionState): SessionState {
  return { ...state, counters: { ...state.counters, pendingActive: true } };
}

/** 拖拽中断/回落（pending 撤销）：零计数 */
export function cancelPending(state: SessionState): SessionState {
  return { ...state, counters: { ...state.counters, pendingActive: false } };
}

/** 一次有效移动落定（非 pending 路径）：moveCount+1 */
export function settleMove(state: SessionState): SessionState {
  return { ...state, counters: { ...state.counters, moveCount: state.counters.moveCount + 1, pendingActive: false } };
}

/** car.exit 事件帧结算：comboCount+1（连击唯一增量通道） */
export function settleExitFrame(state: SessionState): SessionState {
  return { ...state, counters: { ...state.counters, comboCount: state.counters.comboCount + 1, pendingActive: false } };
}

// —— 只读面（对外模块唯一合法访问口） ——

export const getCounters = (s: SessionState): Readonly<SessionCounters> => s.counters;
