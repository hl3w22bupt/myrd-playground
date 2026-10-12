// ac-02-first30s — fv-1（auto 面）：首杀 ≤3s + 首次三选一 ≤20s
import { assert, loadSpec, driveRun } from './helpers.mjs';
const spec = loadSpec();
const st = await driveRun(spec);
const stepMs = spec.numeric.FIXED_STEP_MS;
assert(st.firstKillTick !== null, '全局无击杀（接敌链断）');
const firstKillSec = (st.firstKillTick * stepMs) / 1000;
assert(firstKillSec <= spec.numeric.firstKillBudgetSec, `首杀 ${firstKillSec.toFixed(2)}s > 预算 ${spec.numeric.firstKillBudgetSec}s`);
assert(st.firstUpgradeTick !== null, '全局无升级（三选一链断）');
const firstUpSec = (st.firstUpgradeTick * stepMs) / 1000;
assert(firstUpSec <= spec.numeric.upgrade.firstAtSec, `首升 ${firstUpSec.toFixed(2)}s > 预算 ${spec.numeric.upgrade.firstAtSec}s`);
console.log(`PASS fv-1(auto) 首杀 ${firstKillSec.toFixed(2)}s ≤${spec.numeric.firstKillBudgetSec}s · 首升 ${firstUpSec.toFixed(2)}s ≤${spec.numeric.upgrade.firstAtSec}s`);
