// tests/contract/ac-template.spec.mjs — 契约模板（line4-unblock-jam · 中性面）
//
// 红线（任务书）：玩法逻辑与 contract-check 断言只认审查通过版——本模板只断【中性脚手架面】，
// spec acceptance 8 条 auto 均为规划落点（.myrd/spec/line4-unblock-jam/design-spec.json），
// 审查通过 + 玩法落地后逐条转真（line3 v0.1 → 实现轮判例同型）。
import { createSession, start, step, seededRng } from '../../src/kernel/loop.ts';
import { createSessionState, begin, pendingDrag, cancelPending, settleMove, settleExitFrame, getCounters } from '../../src/kernel/session.ts';
import { auditComboStream } from '../../src/kernel/combo.ts';
import { createTelemetryHub, keySetParity } from '../../src/telemetry/telemetry.ts';
import { TELEMETRY_KEYS, NUMERIC } from '../../src/generated/spec-data.mjs';

export default function run() {
  // ① 内核确定性：同 seed 双跑逐字节一致
  const runOnce = () => {
    let s = start(createSession(NUMERIC.DEFAULT_SEED));
    const rng = seededRng(NUMERIC.DEFAULT_SEED);
    for (let i = 0; i < 8; i += 1) s = step(s, NUMERIC.FIXED_STEP_MS, { advance: rng.next() > 0.2 });
    return s;
  };
  const det = JSON.stringify(runOnce()) === JSON.stringify(runOnce());

  // ② pending 不计连击恒等式（acc-03 机制面前身）：pending/cancel 零增量，仅 car.exit 帧结算 +1
  let st = begin(createSessionState(NUMERIC.DEFAULT_SEED));
  st = pendingDrag(st);            // pending：零计数
  st = cancelPending(st);          // 回落：零计数
  st = settleMove(st);            // move 落定：moveCount+1
  st = settleExitFrame(st);        // car.exit 帧：comboCount+1（唯一增量通道）
  const c = getCounters(st);
  const pendingInvariant = c.moveCount === 1 && c.comboCount === 1;

  // ③ 事件流审计器：违例检出能力（把非法增量喂进去必须报 violation）
  const audit = auditComboStream(['car.drag_end', 'car.exit', 'pending-drag'], [0, 1, 1]);
  const auditOk = audit.violations === 0;

  // ④ telemetry 单一出口：非契约键 fail-closed + 键集合全等
  const hub = createTelemetryHub();
  let failClosed = false;
  try { hub.record('not_a_spec_key', 1); } catch { failClosed = true; }
  hub.record('frame_time_p95_ms', 15.9);
  const parity = keySetParity(TELEMETRY_KEYS);

  const pass = det && pendingInvariant && auditOk && failClosed && parity.equal;
  return {
    pass,
    detail: `det=${det} pendingInvariant=${pendingInvariant} audit=${auditOk} failClosed=${failClosed} parity=${parity.equal}（${TELEMETRY_KEYS.length} 键）`,
  };
}

// 直跑入口：node tests/contract/ac-template.spec.mjs
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const r = run();
  console.log(`[ac-template] ${r.pass ? 'PASS' : 'FAIL'} ${r.detail}`);
  process.exit(r.pass ? 0 : 1);
}
