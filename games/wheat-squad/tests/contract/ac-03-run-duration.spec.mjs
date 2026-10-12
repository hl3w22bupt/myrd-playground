// ac-03-run-duration — fv-2：单局时长 3–5 分钟（check 文件路径已写进 spec acceptance fv-2）
import { assert, loadSpec, driveRun } from './helpers.mjs';
const spec = loadSpec();
const st = await driveRun(spec);
assert(st.phase === 'ended', '驱动未到结算');
assert(st.endedReason === 'timeout', `终局原因=${st.endedReason}（预期 timeout=打满目标上限自然结算）`);
const sec = (st.tick * spec.numeric.FIXED_STEP_MS) / 1000;
const { targetMinSec, targetMaxSec } = spec.numeric.runDuration;
assert(sec >= targetMinSec && sec <= targetMaxSec, `单局 ${sec}s 越出 [${targetMinSec},${targetMaxSec}]s`);
console.log(`PASS fv-2 单局 ${sec}s ∈ [${targetMinSec},${targetMaxSec}]s · reason=${st.endedReason}`);
