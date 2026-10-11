// ac-05-hit-feedback — fv-4（auto 面）：判定→反馈 ≤150ms（帧级）+ flash 时长 = hitFlashMs
import { assert, loadSpec, driveRun } from './helpers.mjs';
const spec = loadSpec();
const st = await driveRun(spec);
assert(st.kills > 0, '无击杀无反馈面');
const stepMs = spec.numeric.FIXED_STEP_MS;
const latencyMs = (st.lastFeedbackLatencyTicks ?? 99) * stepMs;
assert(latencyMs <= spec.numeric.feedback.latencyBudgetMs, `反馈延迟 ${latencyMs}ms > 预算 ${spec.numeric.feedback.latencyBudgetMs}ms`);
const flashTicks = Math.max(1, Math.round(spec.numeric.feedback.hitFlashMs / stepMs));
const f = st.flashes[0];
if (f) assert(f.endTick - f.bornTick === flashTicks, `flash 时长 ${f.endTick - f.bornTick} 帧 ≠ ${flashTicks} 帧（hitFlashMs 换算）`);
console.log(`PASS fv-4(auto) 反馈延迟 ${latencyMs}ms ≤${spec.numeric.feedback.latencyBudgetMs}ms · flash=${spec.numeric.feedback.hitFlashMs}ms 换算一致`);
