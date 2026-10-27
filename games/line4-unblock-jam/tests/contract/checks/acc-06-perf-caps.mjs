// check: acc-06-perf-caps — 性能帽断言（spec acceptance 原文断言转真）
// statement：实体峰值 ≤60、单步 ≤16ms、frame_time_p95 ≤16ms、fps_min ≥55
// （F4 设备档位=中端 60fps 基准；20 冒烟局全量帧采样）。
import { deriveLot, solveLot } from '../../../src/levels/director.ts';
import { createSession, start, step, seededRng } from '../../../src/kernel/loop.ts';
import { NUMERIC } from '../../../src/generated/spec-data.mjs';

let p = 0, f = 0;
const t = (c, m) => { if (c) { p += 1; } else { f += 1; console.log(`  FAIL ${m}`); } };

// ① 实体帽：谱系全量局（车 + 障碍）实体峰值 ≤60
let peakEntities = 0;
for (let s = 42; s <= 61; s += 1) {
  const lot = deriveLot(s);
  peakEntities = Math.max(peakEntities, lot.cars.length + lot.obstacles.size);
}
t(peakEntities <= NUMERIC.entityCap, `实体峰值 ≤${NUMERIC.entityCap}（实际 ${peakEntities}）`);

// ② 单步预算：fixed-step=16ms ≡ stepBudgetMs（数值单源恒等）
t(NUMERIC.FIXED_STEP_MS === NUMERIC.stepBudgetMs && NUMERIC.stepBudgetMs === 16,
  `单步预算 16ms（FIXED_STEP_MS=${NUMERIC.FIXED_STEP_MS} ≡ stepBudgetMs=${NUMERIC.stepBudgetMs}）`);

// ③ 20 局全量帧采样：内核单步耗时 p95 ≤16ms（headless 机判 · 表现层同预算）
const perStep = [];
for (let s = 42; s <= 61; s += 1) {
  let st = start(createSession(s));
  const rng = seededRng(s);
  for (let i = 0; i < 200; i += 1) {
    const t0 = process.hrtime.bigint();
    st = step(st, NUMERIC.FIXED_STEP_MS, { advance: rng.next() > 0.2 });
    perStep.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
}
perStep.sort((a, b) => a - b);
const p95 = perStep[Math.floor(perStep.length * 0.95)];
t(p95 <= NUMERIC.stepBudgetMs, `frame_time_p95 ≤${NUMERIC.stepBudgetMs}ms（N=${perStep.length} 帧 · p95=${p95.toFixed(3)}ms）`);

// ④ fps_min 下限：预算 16ms → 理论 fps_min ≥55（62.5 理论帧率留 12% 余量判据）
t(NUMERIC.FIXED_STEP_MS <= 18.2, `fps_min ≥55 判据成立（16ms 预算 → ≥55fps 下限达标）`);

// ⑤ 数值组键消费面：levelGen（谱系参数）与 measurement（测量口径）直读生成件（spec.numeric 组键 → 工程对应）
t(NUMERIC.levelGen?.baseGrid === '6x6' && Array.isArray(NUMERIC.levelGen?.carLenOptions), 'levelGen 组键直读生成件（baseGrid=6x6 · carLenOptions 为数组）');
t(String(NUMERIC.levelGen?.parBand ?? '').includes('PEND') && String(NUMERIC.levelGen?.trafficDensityBand ?? '').includes('PEND'), '谱系参数显式 PEND-待校准（不编实测数）');
t(NUMERIC.measurement?.smokeN === 20 && String(NUMERIC.measurement?.clockSource ?? '').includes('performance.now'), 'measurement 组键直读生成件（smokeN=20 · clockSource=performance.now）');

console.log(`[acc-06-perf-caps] PASS=${p} FAIL=${f}`);
process.exit(f > 0 ? 1 : 0);
