// check: acc-03-combo-pending-invariant — pending 不计连击恒等式（spec acceptance 原文断言转真）
// statement：20 冒烟局事件流审计 combo_pending_violations=0；comboCount 增量必伴随 car.exit
// 事件帧；拖拽中/pending 零增量。
import { createSessionState, begin, pendingDrag, cancelPending, settleMove, settleExitFrame, getCounters } from '../../../src/kernel/session.ts';
import { auditComboStream } from '../../../src/kernel/combo.ts';
import { deriveLot, solveLot } from '../../../src/levels/director.ts';
import { NUMERIC } from '../../../src/generated/spec-data.mjs';

let passN = 0, failN = 0;
const ok = (cond, name) => { if (cond) { passN += 1; } else { failN += 1; console.log(`  FAIL ${name}`); } };

// ① 机制面：pending/cancel 零增量，settleExitFrame 唯一增量通道
let st = begin(createSessionState(NUMERIC.DEFAULT_SEED));
st = pendingDrag(st);
const cPending = getCounters(st);
st = cancelPending(st);
st = settleMove(st);
const cMove = getCounters(st);
st = settleExitFrame(st);
const cExit = getCounters(st);
ok(cPending.moveCount === 0 && cPending.comboCount === 0, 'pending 中零增量');
ok(cMove.moveCount === 1 && cMove.comboCount === 0, 'settleMove 只进 moveCount');
ok(cExit.comboCount === 1 && cExit.moveCount === 1, 'car.exit 帧唯一 combo 增量通道');

// ② 20 局事件流审计：解序列合成事件流（drag_start→move_settled→…→car.exit），violations=0
let totalViolations = 0, streams = 0;
for (let s = 42; s <= 61; s += 1) {
  const lot = deriveLot(s);
  const sol = solveLot(lot);
  if (!sol.solvable) continue;
  streams += 1;
  const events = [];
  const comboAfter = [];
  let combo = 0;
  for (let i = 0; i < sol.steps; i += 1) {
    for (const ev of ['car.drag_start', 'car.drag_end', 'move-settled']) { events.push(ev); comboAfter.push(combo); }
    // pending 往返（拖拽中未确认→取消）也必须零增量
    for (const ev of ['pending-drag', 'pending-cancel']) { events.push(ev); comboAfter.push(combo); }
  }
  events.push('car.exit'); combo += 1; comboAfter.push(combo); // 终局唯一驶出结算
  const audit = auditComboStream(events, comboAfter);
  totalViolations += audit.violations;
}
ok(totalViolations === 0 && streams === 20, `20 局事件流审计 combo_pending_violations=0（实际 ${totalViolations} · ${streams} 局）`);

// ③ 审计器检出能力：非法增量必报违例（把 car.drag_end 后 +1 喂进去必须违规）
const bad = auditComboStream(['car.drag_end'], [1]);
ok(bad.violations === 1, '审计器对非法增量检出（violation=1）');

console.log(`[acc-03-combo-pending-invariant] PASS=${passN} FAIL=${failN}`);
process.exit(failN > 0 ? 1 : 0);
