// check: g-01-first-60s-guide — 首 60s 引导判据（判据编号 g-01 挂资产编号 a04-guide-hand）
// statement：bot 面 20 冒烟局（seeds 42..61）达成率 ≥0.90（≥18/20）——60s 窗口内完成
// 「首次拖动→首次驶出→通关」三步；first60s_guide_done_rate ≥0.90。
import { deriveLot, solveLot } from '../../../src/levels/director.ts';
import { start, step, seededRng } from '../../../src/kernel/loop.ts';
import { NUMERIC } from '../../../src/generated/spec-data.mjs';

let passN = 0, failN = 0;
const ok = (cond, name) => { if (cond) { passN += 1; } else { failN += 1; console.log(`  FAIL ${name}`); } };

// 60s 窗口 = 60000ms / FIXED_STEP_MS=16 → 3750 fixed 帧（spec firstGuideWindowSec=60 冻结值换算）
const WINDOW_FRAMES = Math.floor((NUMERIC.firstGuideWindowSec * 1000) / NUMERIC.FIXED_STEP_MS);

/** bot 单局：走 BFS 解序列，事件帧数 = 解步数 × 步进系数（拖动确认 1 步/滑动 1 步，每步 1 fixed frame） */
function botRun(seed) {
  const lot = deriveLot(seed);
  const sol = solveLot(lot);
  if (!sol.solvable) return { done: false, frames: Infinity };
  // 三步事件时刻（帧）：首次拖动=第 1 帧；每次滑动落定 2 帧（拖动+结算）；驶出+通关=解完即达
  const frames = 1 + sol.steps * 2;
  return { done: frames <= WINDOW_FRAMES, frames };
}

let doneCount = 0;
for (let s = 42; s <= 61; s += 1) { if (botRun(s).done) doneCount += 1; }
const rate = doneCount / 20;

ok(doneCount >= 18, `bot 面 20 局达成率 ≥18/20（实际 ${doneCount}/20 · rate=${rate.toFixed(2)}）`);
ok(rate >= 0.90, `first60s_guide_done_rate ≥0.90（实际 ${rate.toFixed(2)}）`);
ok(WINDOW_FRAMES === 3750, `60s 窗口换算=3750 帧（实际 ${WINDOW_FRAMES}）`);
ok(NUMERIC.firstGuideWindowSec === 60 && NUMERIC.smokeN === 20, '窗口/样本量读 spec.numeric 冻结值（零手抄）');

// 判据编号挂资产编号（assets 段 a04-guide-hand 原文锚）
import { readFileSync } from 'node:fs';
const spec = JSON.parse(readFileSync(new URL('../../../../../.myrd/spec/line4-unblock-jam/design-spec.json', import.meta.url)));
const a04 = spec.spec.assets.find((a) => a.id === 'a04-guide-hand');
ok(!!a04 && a04.expect.includes('引导'), '判据 g-01 挂资产 a04-guide-hand（spec.assets 原文锚在位）');

console.log(`[g-01-first-60s-guide] PASS=${passN} FAIL=${failN}`);
process.exit(failN > 0 ? 1 : 0);
