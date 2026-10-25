// check: acc-01-seeded-determinism — 同 seed 谱系逐字节一致（spec acceptance 原文断言转真）
// statement：DEFAULT_SEED 与 seeds 42..61 各局布局序列、可滑动解序列、终局态双跑逐字节一致。
import { deriveLot, solveLot } from '../../../src/levels/director.ts';
import { NUMERIC } from '../../../src/generated/spec-data.mjs';

let passN = 0, failN = 0;
const ok = (cond, name) => { if (cond) { passN += 1; } else { failN += 1; console.log(`  FAIL ${name}`); } };

// ① 同 seed 双跑布局派生逐字节一致（默认 seed）
const once = (s) => JSON.stringify({ lot: deriveLot(s), solve: solveLot(deriveLot(s)) });
ok(once(NUMERIC.DEFAULT_SEED) === once(NUMERIC.DEFAULT_SEED), 'DEFAULT_SEED 双跑逐字节一致');

// ② 同 seed 双跑布局派生逐字节一致（seeds 42..61 全谱系）
let allDet = true, allSolvable = true, solvableCount = 0;
for (let s = 42; s <= 61; s += 1) {
  if (once(s) !== once(s)) allDet = false;
  const r = solveLot(deriveLot(s));
  if (r.solvable) solvableCount += 1; else allSolvable = false;
}
ok(allDet, 'seeds 42..61 双跑逐字节一致');
ok(allSolvable, `seeds 42..61 全部可解（实际 ${solvableCount}/20）`);

// ③ 可滑动解序列稳定：同 seed 解序列两次求解一致（步数+动作序列）
const a = solveLot(deriveLot(50)), b = solveLot(deriveLot(50));
ok(JSON.stringify(a.moves) === JSON.stringify(b.moves) && a.steps === b.steps, 'seed=50 解序列稳定');

// ④ spec 锚：数值消费面来自生成件（零手抄）
ok(Number.isInteger(NUMERIC.DEFAULT_SEED) && NUMERIC.smokeSeeds === '42..61', '数值锚来自生成件 spec-data.mjs');

console.log(`[acc-01-seeded-determinism] PASS=${passN} FAIL=${failN}`);
process.exit(failN > 0 ? 1 : 0);
