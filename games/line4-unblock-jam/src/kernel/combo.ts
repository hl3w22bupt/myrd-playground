// kernel/combo.ts — 连击判定器壳（line4-unblock-jam · 中性脚手架）
//
// spec entities[e-combo] 写死面：仅 car.exit 事件帧结算 comboCount+1；pending 一律不计。
// 本壳只提供【审计面】：给任意 counters 状态 + 事件流判定 combo_pending_violations=0 恒等式
// （acc-03 机判口径）。玩法语义（何为 car.exit）归审查通过版实现，本壳不定义。
export interface CountersLike { moveCount: number; comboCount: number; pendingActive: boolean; }
export type ComboEvent = 'car.drag_start' | 'car.drag_end' | 'pending-drag' | 'pending-cancel' | 'car.exit' | 'move-settled';

export interface AuditRow { event: ComboEvent; comboBefore: number; comboAfter: number; violation: boolean; }

/**
 * 事件流审计：逐事件核对 combo 增量合法性。
 * 唯一合法增量事件 = 'car.exit'（事件帧结算）；其余事件 comboCount 必须不变。
 */
export function auditComboStream(events: ComboEvent[], comboAfterEach: number[]): { violations: number; rows: AuditRow[] } {
  const rows: AuditRow[] = [];
  let violations = 0;
  let before = 0;
  for (let i = 0; i < events.length; i += 1) {
    const after = comboAfterEach[i];
    const legal = events[i] === 'car.exit' ? after === before + 1 : after === before;
    if (!legal) violations += 1;
    rows.push({ event: events[i], comboBefore: before, comboAfter: after, violation: !legal });
    before = after;
  }
  return { violations, rows };
}
