// ac-01-seeded-determinism — det-1：同 seed 双局逐字节一致（机制级差异点①）
import { assert, loadSpec, driveRun } from './helpers.mjs';
const spec = loadSpec();
const a = await driveRun(spec, { seed: spec.numeric.DEFAULT_SEED });
const b = await driveRun(spec, { seed: spec.numeric.DEFAULT_SEED });
const sig = (s) => JSON.stringify({ tick: s.tick, phase: s.phase, kills: s.kills, xp: s.xp, wave: s.waveIndex, ups: s.upgradesPicked, firstKill: s.firstKillTick, firstUp: s.firstUpgradeTick });
assert(sig(a) === sig(b), `同 seed 双局不一致:\n A=${sig(a)}\n B=${sig(b)}`);
console.log('PASS det-1 同 seed 双局逐字节一致 ::', sig(a).slice(0, 120));
