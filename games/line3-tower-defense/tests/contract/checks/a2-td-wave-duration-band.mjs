// a2-td-wave-duration-band — 单局时长带（模拟局口径，禁混真人局）
// spec acceptance a2：20 完整模拟局（DEFAULT_SEED+i）start→end 事件链 20/20 完整
//                    P50 ∈ [240,420]s ∧ P90 ≤ 600s ∧ 结局 ∈ {victory, defeat}。样本量=20。
import { loadCfg, driveGameRun, percentile, assert } from '../helpers.mjs';

const cfg = loadCfg();
const durs = [];
const outcomes = {};
let chainOk = 0;
for (let i = 0; i < cfg.waveBand.sampleSeeds; i += 1) {
  const game = driveGameRun(cfg, cfg.defaultSeed + i);
  const start = game.entries().filter((e) => e.name === 'run_start');
  const end = game.entries().filter((e) => e.name === 'run_end');
  if (start.length >= 1 && end.length >= 1 && end[end.length - 1].run_duration_ms > 0) chainOk += 1;
  const d = end[end.length - 1];
  assert(d, `seed${cfg.defaultSeed + i} run_end 缺失（事件链断裂）`);
  assert(['victory', 'defeat'].includes(d.reason), `seed${i} 非法结局 ${d.reason}`);
  durs.push(d.run_duration_ms / 1000);
  outcomes[d.reason] = (outcomes[d.reason] || 0) + 1;
}
assert(chainOk === cfg.waveBand.sampleSeeds, `start→end 事件链 ${chainOk}/${cfg.waveBand.sampleSeeds} 不完整`);
durs.sort((a, b) => a - b);
const p50 = percentile(durs, 50);
const p90 = percentile(durs, 90);
assert(p50 >= cfg.waveBand.p50MinSec && p50 <= cfg.waveBand.p50MaxSec, `P50=${p50}s 出带 [${cfg.waveBand.p50MinSec},${cfg.waveBand.p50MaxSec}]s`);
assert(p90 <= cfg.waveBand.p90MaxSec, `P90=${p90}s > ${cfg.waveBand.p90MaxSec}s`);
console.log(`PASS a2-td-wave-duration-band n=${durs.length} P50=${p50}s P90=${p90}s min=${durs[0]}s max=${durs[durs.length - 1]}s 结局=${JSON.stringify(outcomes)} 链=${chainOk}/20`);
