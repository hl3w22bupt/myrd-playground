// check: acc-04-red-round-boundaries — 三红轮边界数值断言（spec acceptance 原文断言转真）
// statement：进入边界（前关步数 ≤par 才入红轮）、完成边界（redRoundStepBudget=12 内驶出）、
// 失败边界（超预算即 fail + 连败 redRoundFailDowngrade=2 降级回标准轮）三谓词逐条机判。
// 数值全部读 spec.numeric（生成件），禁手抄第二份。
import { shouldEnterRedRound as enterR, planRedRound as judge } from '../../../src/levels/director.ts';
import { NUMERIC as N } from '../../../src/generated/spec-data.mjs';

let p = 0, f = 0;
const t = (c, m) => { if (c) { p += 1; } else { f += 1; console.log(`  FAIL ${m}`); } };

const B = N.redRoundStepBudget;      // 12
const D = N.redRoundFailDowngrade;   // 2

// ① 进入边界：prevMoves ≤ par 才入红轮（边界值/越界值逐条过）
t(enterR(4, 4) === true, '进入边界：prevMoves=par=4 → 入红轮');
t(enterR(5, 4) === false, '进入边界：prevMoves=5 > par=4 → 不入');
t(enterR(0, 4) === true, '进入边界：零步必入');

// ② 完成边界：预算内驶出 = clear（恰在预算值与远小于预算各测一条）
const at = judge({ exited: true, redMoves: B, prevMoves: 0, par: 4, budget: B, failStreak: 0, downgrade: D });
const under = judge({ exited: true, redMoves: 1, prevMoves: 0, par: 4, budget: B, failStreak: 0, downgrade: D });
t(at.verdict === 'clear' && at.shouldDowngrade === false, `完成边界：恰 ${B} 步内驶出=clear`);
t(under.verdict === 'clear' && under.nextStreak === 0, '完成边界：1 步驶出=clear 且清零连败');

// ③ 失败边界：超预算未驶出 = fail + 连败计数；连败 ≥ downgrade=2 触发降级
const f1 = judge({ exited: false, redMoves: B + 1, prevMoves: 0, par: 4, budget: B, failStreak: 0, downgrade: D });
const f2 = judge({ exited: false, redMoves: B + 5, prevMoves: 0, par: 4, budget: B, failStreak: 1, downgrade: D });
t(f1.verdict === 'fail' && f1.shouldDowngrade === false && f1.nextStreak === 1, `失败边界：超预算=fail（首败不降级 · streak=1）`);
t(f2.verdict === 'fail' && f2.shouldDowngrade === true && f2.nextStreak === 2, '失败边界：连败 2 → downgrade 触发降级回标准轮');

// ④ 数值锚：budget=12 / downgrade=2 读生成件（断言冻结值不被手抄漂移）
t(B === 12 && D === 2, `数值锚读生成件（budget=${B} · downgrade=${D}）`);

console.log(`[acc-04-red-round-boundaries] PASS=${p} FAIL=${f}`);
process.exit(f > 0 ? 1 : 0);
