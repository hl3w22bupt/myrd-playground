// ac-06-perf-budget — perf-1：满载帧 ≤16ms + 同屏实体硬上限
import { assert, loadSpec, driveRun } from './helpers.mjs';
const { seededRng } = await import(new URL('../../src/kernel/loop.ts', import.meta.url).pathname);
const { createSim, stepSim } = await import(new URL('../../src/kernel/sim.ts', import.meta.url).pathname);
const spec = loadSpec();
const n = spec.numeric;
// 满载构造：跳过拒生成上限前先充满（直接 stepSim 到实体上限）
const cfg = { rng: seededRng(n.DEFAULT_SEED), field: { w: 390, h: 640 }, stepMs: n.FIXED_STEP_MS,
  captain: n.captain, squad: n.squad, enemy: n.enemy, wave: n.wave, upgrade: n.upgrade,
  firstKillBudgetSec: n.firstKillBudgetSec, feedback: n.feedback, perf: n.perf, runDuration: n.runDuration };
const st = createSim(cfg, n.DEFAULT_SEED);
let peak = 0;
for (let i = 0; i < 3000 && st.phase === 'running'; i += 1) {
  stepSim(st, n.FIXED_STEP_MS);
  peak = Math.max(peak, st.pests.length + st.bullets.length + st.pickups.length);
}
assert(peak <= n.perf.maxOnScreenEntities, `同屏实体峰值 ${peak} > 上限 ${n.perf.maxOnScreenEntities}`);
// 帧预算：满载 step 单次 ≤ frameBudgetMs（node 侧仿真步；渲染面在 smoke 浏览器档）
const t0 = process.hrtime.bigint();
for (let i = 0; i < 200; i += 1) stepSim(st, n.FIXED_STEP_MS);
const perStepMs = Number(process.hrtime.bigint() - t0) / 1e6 / 200;
assert(perStepMs <= n.perf.frameBudgetMs, `单步仿真 ${perStepMs.toFixed(3)}ms > 预算 ${n.perf.frameBudgetMs}ms`);

// 机型档（perf-1 v1 扩展）：档位键在档 + 老机节流档仿真（50ms 步进累积上限）可玩不崩 + 实体上限保持
for (const k of ['midTierFrameP95Ms', 'firstInteractiveMaxMs', 'lowEndFrameP95Ms']) {
  assert(typeof n.perf[k] === 'number', `spec numeric.perf 缺机型档键 ${k}`);
}
assert(n.perf.midTierFrameP95Ms <= 33 && n.perf.lowEndFrameP95Ms <= 50, '机型档基准须 ≤ 任务书口径（中端 33ms / 老机 50ms）');
const lowEnd = createSim(cfg, n.DEFAULT_SEED);
let lowEndSteps = 0;
for (let i = 0; i < 1200 && lowEnd.phase === 'running'; i += 1) { stepSim(lowEnd, n.perf.lowEndFrameP95Ms); lowEndSteps += 1; } // 老机帧时间=步进粒度
assert(lowEndSteps > 0 && (lowEnd.phase === 'running' || lowEnd.phase === 'ended'), '2GB 老机节流档仿真异常退出（可玩不崩违例）');
assert(lowEnd.pests.length + lowEnd.bullets.length + lowEnd.pickups.length <= n.perf.maxOnScreenEntities, '老机档实体上限失守');
console.log(`PASS perf-1 实体峰值 ${peak} ≤${n.perf.maxOnScreenEntities} · 单步 ${perStepMs.toFixed(3)}ms ≤${n.perf.frameBudgetMs}ms · 机型档（中端≤${n.perf.midTierFrameP95Ms}ms/首交互≤${n.perf.firstInteractiveMaxMs}ms/老机≤${n.perf.lowEndFrameP95Ms}ms）节流仿真不崩（node 仿真步；真机走查归 QA 清单）`);
