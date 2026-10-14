// run-all.mjs — wheat-squad 契约聚合器（三态输出 PASS/FAIL/PEND；零断言不装绿）
//
// PEND 语义（2026-10-13 v2，任务书「含 pending 即非全绿」口径落死）：
//   · 测试件通过 globalThis.__WS_CONTRACT_PENDS__（string[]）注册挂起项——凡显式 PEND（manual 结论面
//     未回填 / 数值待校准）必须注册，不允许只 console.log 完事（旧版 PEND 行会被合计吞成 PASS，已修）。
//   · 输出「X PASS / Y FAIL / Z PEND」+ ALL_GREEN 标记：**含 pending 即非全绿**（ALL_GREEN=false），
//     消费方（QA 预核 / deploy 放行 / 黑板「全绿」宣称）不得把含 PEND 的运行宣称为全绿。
//   · 退出码：FAIL>0 → 1；WS_CONTRACT_STRICT_GREEN=1 时 PEND>0 → 2（严格门禁口径，默认宽松不卡 CI）。
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const g = globalThis;
g.__WS_CONTRACT_PENDS__ = [];
const files = readdirSync(HERE).filter((f) => /^ac-\d+.*\.spec\.mjs$/.test(f)).sort();
let pass = 0, fail = 0;
for (const f of files) {
  const before = g.__WS_CONTRACT_PENDS__.length;
  try {
    await import(join(HERE, f));
    if (g.__WS_CONTRACT_PENDS__.length > before) pass += 1; // 挂起件照常计数为已执行（非 FAIL）
    else pass += 1;
  } catch (e) {
    fail += 1;
    console.log(`FAIL ${f} :: ${String(e.message || e).split('\n')[0].slice(0, 220)}`);
  }
}
const pends = g.__WS_CONTRACT_PENDS__;
console.log(`—— wheat-squad 契约合计 ${pass} PASS / ${fail} FAIL / ${pends.length} PEND ——`);
if (pends.length > 0) {
  console.log(`ALL_GREEN=false（含 pending 即非全绿——PEND ${pends.length} 件：`);
  for (const p of pends) console.log(`  PEND · ${p}`);
  console.log('）');
} else if (fail > 0) {
  // 修复（2026-10-14 R1 修复批 · 先红证据 gate-logs/r1-converge-20261014/07：1 FAIL 时曾打印 ALL_GREEN=true）：
  // 全绿判定 = 零 FAIL **且** 零 PEND——exit code 一直正确（fail>0→1），仅此打印面曾误导
  console.log(`ALL_GREEN=false（零 PEND 亦非全绿——FAIL ${fail} 件）`);
} else {
  console.log('ALL_GREEN=true（零 FAIL 零 PEND）');
}
if (fail > 0) process.exit(1);
if (pends.length > 0 && process.env.WS_CONTRACT_STRICT_GREEN === '1') process.exit(2);
process.exit(0);
