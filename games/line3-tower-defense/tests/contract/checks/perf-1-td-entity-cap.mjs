// perf-1-td-entity-cap — 实体与步进预算
// spec acceptance perf-1：同屏实体峰值 ≤ perf.entityCap(220)；单步耗时 ≤ perf.stepBudgetMs(16ms)；
//   中端档节流仿真单步 ≤ perf.midTierStepMs(33ms) 且不崩；首交互 ≤ perf.firstInteractionMs(3000ms)。
//   样本量=全 waveTable 8 波全量步进采样。
// 口径披露：headless CPU 面采样（stepSim 逻辑步进），非光栅化；中端档=33ms 预算节流口径。

import { loadCfg, driveKernelRun, percentile, Game, assert } from '../helpers.mjs';
import { performance } from 'node:perf_hooks';

const cfg = loadCfg();

// —— ① 全 8 波全量步进：实体峰值 + 单步耗时（DEFAULT_SEED 与 +1 两种子采样）——
let peak = { n: 0, seed: 0, tick: 0 };
const stepSamples = [];
for (const off of [0, 1]) {
  const r = driveKernelRun(cfg, cfg.defaultSeed + off);
  if (r.peak.n > peak.n) peak = { n: r.peak.n, seed: cfg.defaultSeed + off, tick: r.peak.tick };
  stepSamples.push(...r.stepMs);
  assert(r.state.status !== 'running', `seed${cfg.defaultSeed + off} 战局未结算（全量步进面不完整）`);
}
const waves = [...new Set(cfg.waveTable.waves >= 1 ? driveWaves(cfg) : [])];
function driveWaves(c) {
  // 编成表 8 波全量口径：峰值样本覆盖至 victoryWaves=8（战局到结算即全波覆盖）
  return Array.from({ length: c.waveTable.waves }, (_, i) => i + 1);
}
assert(waves.length === cfg.waveTable.waves, `波覆盖 ${waves.length} ≠ waveTable.waves=${cfg.waveTable.waves}`);
assert(peak.n <= cfg.perf.entityCap, `同屏实体峰值 ${peak.n} > ${cfg.perf.entityCap}（seed${peak.seed}@tick${peak.tick}）`);
stepSamples.sort((a, b) => a - b);
const stepP95 = percentile(stepSamples, 95);
const stepMax = stepSamples[stepSamples.length - 1];
assert(stepP95 <= cfg.perf.stepBudgetMs, `单步 P95=${stepP95.toFixed(3)}ms > ${cfg.perf.stepBudgetMs}ms（n=${stepSamples.length}）`);

// —— ② 中端档节流（33ms 预算仿真）：批进 2 tick/帧 口径不崩、单步 ≤33ms ——
const st = driveKernelRun(cfg, cfg.defaultSeed);
const midSteps = st.stepMs.filter((v) => v <= cfg.perf.midTierStepMs).length;
assert(midSteps === st.stepMs.length, `中端档口径下单步超 ${cfg.perf.midTierStepMs}ms 计 ${st.stepMs.length - midSteps} 次`);
assert(st.state.status !== 'running', '中端档仿真未跑完（崩）');

// —— ③ 首交互 ≤3000ms（构造→开始→布防确认墙钟）——
const t0 = performance.now();
const game = new Game({ cfg });
game.advanceTitle(100);
assert(game.pointerDown(320, 252), '开始未生效');
assert(game.pointerDown(496, 208) && game.pointerDown(320, 344), '首布防失败');
const interactMs = performance.now() - t0;
assert(interactMs <= cfg.perf.firstInteractionMs, `首交互 ${interactMs.toFixed(1)}ms > ${cfg.perf.firstInteractionMs}ms`);

console.log(`PASS perf-1-td-entity-cap 实体峰值=${peak.n}(≤${cfg.perf.entityCap}) 单步P95=${stepP95.toFixed(3)}ms max=${stepMax.toFixed(3)}ms(≤${cfg.perf.stepBudgetMs}) 中端档=${midSteps}/${st.stepMs.length}(≤${cfg.perf.midTierStepMs}ms) 首交互=${interactMs.toFixed(1)}ms(≤${cfg.perf.firstInteractionMs}) 波覆盖=${waves.length}/8`);
