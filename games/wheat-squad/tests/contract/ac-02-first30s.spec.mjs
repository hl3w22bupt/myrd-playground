// ac-02-first30s — ac-a1-first-core-feedback（A1 · auto）：首次核心正反馈 ≤10s 且首 30 秒必达
// 判据源：spec acceptance ac-a1 + numeric.firstCore（maxLatencySec/mustReachBySec/sampleSeeds）
// 遗留预算保留：首杀 ≤3s（firstKillBudgetSec）+ 首升 ≤20s（upgrade.firstAtSec）作回归下限
import { assert, loadSpec, driveRun } from './helpers.mjs';
const spec = loadSpec();
const stepMs = spec.numeric.FIXED_STEP_MS;
const fc = spec.numeric.firstCore;

// 面1：契约主判据——自 first_core_action（首次拖动）起首杀 ≤10s
const st = await driveRun(spec);
assert(st.firstCoreActionTick !== null, 'sim 未记录 first_core_action（firstCoreActionTick 缺失——埋点接线未完成）');
const firstCoreActionMs = st.firstCoreActionTick * stepMs; // = meta.telemetryFields.first_core_action_at
assert(st.firstKillTick !== null, '全局无击杀（接敌链断）');
const feedbackLatencySec = (st.firstKillTick * stepMs - firstCoreActionMs) / 1000;
assert(feedbackLatencySec <= fc.maxLatencySec, `A1 首次核心正反馈 ${feedbackLatencySec.toFixed(2)}s > ${fc.maxLatencySec}s（first_core_action_at→first_kill）`);

// 面2：首 30 秒必达——任一种子局首杀 ≤30s（sampleSeeds 个种子全数断言）
for (let i = 0; i < (fc.sampleSeeds ?? 5); i += 1) {
  const seed = spec.numeric.DEFAULT_SEED + i + 1;
  const run = await driveRun(spec, { seedOverride: seed, stopAtSec: fc.mustReachBySec });
  assert(run.firstKillTick !== null, `种子 ${seed}：首 30 秒内未达首次核心正反馈（首杀缺失）`);
  const killSec = (run.firstKillTick * stepMs) / 1000;
  assert(killSec <= fc.mustReachBySec, `种子 ${seed} 首杀 ${killSec.toFixed(2)}s > mustReachBySec(${fc.mustReachBySec}s)`);
}

// 面3：回归下限（v0.1 遗留预算，防倒退）
assert((st.firstKillTick * stepMs) / 1000 <= spec.numeric.firstKillBudgetSec, '首杀超 v0.1 回归预算 3s');
assert(st.firstUpgradeTick !== null && (st.firstUpgradeTick * stepMs) / 1000 <= spec.numeric.upgrade.firstAtSec, '首升超预算 20s');

console.log(`PASS ac-a1(auto) 首次核心正反馈 ${feedbackLatencySec.toFixed(2)}s ≤${fc.maxLatencySec}s · ${fc.sampleSeeds} 种子首杀全部 ≤${fc.mustReachBySec}s · 回归预算 3s/20s 保持`);
