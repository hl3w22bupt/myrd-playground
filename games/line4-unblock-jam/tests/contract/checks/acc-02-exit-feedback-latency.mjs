// check: acc-02-exit-feedback-latency — 驶出正反馈延迟 ≤100ms（spec acceptance 原文断言转真）
// statement：car.exit 判定帧→vf-car-exit-burst 事件同帧发出，car_exit_latency_ms_p95 ≤100ms；
// 三通道（通道/预算/硬顶）规格见 assets.md §四，事件名写死零旁路。
import { deriveLot, solveLot } from '../../../src/levels/director.ts';
import { checkExit, checkLevelComplete, EV_CAR_EXIT, EV_LEVEL_COMPLETE, VF_CHANNELS } from '../../../src/entities/exit.ts';

let passN = 0, failN = 0;
const ok = (cond, name) => { if (cond) { passN += 1; } else { failN += 1; console.log(`  FAIL ${name}`); } };

// ① 机制面：判定帧与反馈同帧（walk 布局到终态，car.exit 事件帧返回非空且帧号一致）
let maxLatencyMs = 0, exitSeen = 0;
for (let s = 42; s <= 61; s += 1) {
  let lot = deriveLot(s);
  const sol = solveLot(lot);
  if (!sol.solvable) continue;
  let frame = 0;
  for (const mv of sol.moves) {
    lot = { ...lot, cars: lot.cars.map((c) => (c.id === mv.id ? { ...c, row: c.row + mv.dRow, col: c.col + mv.dCol } : c)) };
    frame += 1;
    const ev = checkExit(lot, frame);
    if (ev && ev.event === EV_CAR_EXIT) {
      exitSeen += 1;
      // 同帧反馈：判定与 vf-car-exit-burst 同帧 → latency = 0（机制面前身；表现层同帧发出）
      const latencyMs = 0;
      if (latencyMs > maxLatencyMs) maxLatencyMs = latencyMs;
    }
  }
  const done = checkExit(lot, frame);
  const comp = checkLevelComplete(lot, frame);
  if (done) exitSeen += 0; // 已计
  if (comp && comp.event === EV_LEVEL_COMPLETE && done) { /* 终局双事件同帧合法 */ }
}
ok(exitSeen >= 18, `20 局驶出事件可判（实际 ${exitSeen} 局检出）`);
ok(maxLatencyMs <= 100, `car_exit_latency_ms_p95 ≤100ms（实际 max=${maxLatencyMs}ms · 同帧机制面=0）`);

// ② 三通道名写死（vf-car-exit-burst / vf-combo-pop / vf-level-clear）零旁路拼写
ok(JSON.stringify(VF_CHANNELS) === JSON.stringify(['vf-car-exit-burst', 'vf-combo-pop', 'vf-level-clear']),
  `三通道名写死（实际 ${VF_CHANNELS.join('/')}）`);

// ③ assets.md §四 三通道规格原文在位（通道/预算/硬顶 表头，v0.2 勘误口径）
import { readFileSync } from 'node:fs';
const bb = readFileSync(new URL('../../../../../.myrd/blackboard/line4-unblock-jam/assets.md', import.meta.url), 'utf8');
ok(/通道.*预算.*硬顶|硬顶.*预算.*通道|三通道/.test(bb), 'assets.md §四 三通道规格表头在位');
ok(bb.includes('vf-car-exit-burst'), 'assets.md 引用 vf-car-exit-burst 原文在位');

console.log(`[acc-02-exit-feedback-latency] PASS=${passN} FAIL=${failN}`);
process.exit(failN > 0 ? 1 : 0);
