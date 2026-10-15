// ac-03-run-duration — ac-a2-run-duration-band（A2 · auto）：单局时长带 P50∈[90,180]s / P90≤300s
// 判据源：spec acceptance ac-a2 + numeric.runDuration（sampleSeeds/p50MinSec/p50MaxSec/p90MaxSec）
// run_duration_ms = 结算 tick × FIXED_STEP_MS（meta.telemetryFields 三方同名）
import { assert, loadSpec, driveRun } from './helpers.mjs';
const spec = loadSpec();
const rd = spec.numeric.runDuration;
const stepMs = spec.numeric.FIXED_STEP_MS;

const durations = [];
const reasons = [];
for (let i = 0; i < rd.sampleSeeds; i += 1) {
  const seed = spec.numeric.DEFAULT_SEED + i;
  const st = await driveRun(spec, { seedOverride: seed });
  assert(st.phase === 'ended', `种子 ${seed} 未到结算`);
  durations.push((st.tick * stepMs) / 1000); // run_duration_ms（秒计）
  reasons.push(st.endedReason);
}
durations.sort((a, b) => a - b);
const median = durations[Math.floor(durations.length / 2)];
const p90 = durations[Math.ceil(durations.length * 0.9) - 1];
assert(median >= rd.p50MinSec && median <= rd.p50MaxSec, `P50 ${median}s 越出 [${rd.p50MinSec},${rd.p50MaxSec}]s（A2 时长带）`);
assert(p90 <= rd.p90MaxSec, `P90 ${p90}s > ${rd.p90MaxSec}s`);
for (const r of reasons) assert(r === 'victory' || r === 'timeout', `非法终局原因 ${r}（预期 victory/timeout）`);
const victories = reasons.filter((r) => r === 'victory').length;
console.log(`PASS ac-a2(auto) ${rd.sampleSeeds} 种子 P50=${median}s ∈[${rd.p50MinSec},${rd.p50MaxSec}] · P90=${p90}s ≤${rd.p90MaxSec} · victory=${victories}/${reasons.length}`);
