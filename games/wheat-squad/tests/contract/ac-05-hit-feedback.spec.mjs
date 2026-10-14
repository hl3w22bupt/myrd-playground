// ac-05-hit-feedback — ac-a4-feedback-channels（A4 · auto）：反馈延迟 ≤100ms + 每操作 ≥2 通道
// 判据源：spec acceptance ac-a4 + numeric.feedback（latencyBudgetMs/minChannelsPerOp/hitFlashMs）
// feedback_latency_ms = 操作 tick → 反馈事件 tick 差 × FIXED_STEP_MS（meta.telemetryFields 三方同名）
import { assert, loadSpec, driveRun, ROOT } from './helpers.mjs';
const spec = loadSpec();
const fb = spec.numeric.feedback;
const stepMs = spec.numeric.FIXED_STEP_MS;

const st = await driveRun(spec);
assert(Array.isArray(st.feedbackEvents) && st.feedbackEvents.length > 0, 'sim 未产出 feedbackEvents（A4 接线未完成）');

// 面1：延迟——每条反馈事件 latency ≤ latencyBudgetMs(100ms)
let maxLatency = 0;
for (const ev of st.feedbackEvents) {
  assert(typeof ev.latencyMs === 'number', 'feedbackEvent 缺 latencyMs（feedback_latency_ms 接线缺失）');
  maxLatency = Math.max(maxLatency, ev.latencyMs);
  assert(ev.latencyMs <= fb.latencyBudgetMs, `反馈延迟 ${ev.latencyMs}ms > ${fb.latencyBudgetMs}ms`);
}

// 面2：通道——采样操作每操作通道数 ≥ minChannelsPerOp(2)
const byOp = new Map();
for (const ev of st.feedbackEvents) {
  const set = byOp.get(ev.opId) ?? new Set();
  for (const ch of ev.channels) set.add(ch);
  byOp.set(ev.opId, set);
}
assert(byOp.size > 0, '无采样操作（通道面无样本）');
let minChannels = Infinity;
for (const [, chans] of byOp) minChannels = Math.min(minChannels, chans.size);
assert(minChannels >= fb.minChannelsPerOp, `存在操作仅 ${minChannels} 通道反馈 < ${fb.minChannelsPerOp}（A4 通道面）`);

// 面3：flash 视觉时长口径保持（hitFlashMs，且 ≤ 延迟预算）
assert(fb.hitFlashMs <= fb.latencyBudgetMs, `hitFlashMs(${fb.hitFlashMs}) > latencyBudgetMs(${fb.latencyBudgetMs})`);

// 面4（2026-10-14 R1 美术特效批接线 · 断言面加法零缩水）：每条发射的视觉通道必须绑登记 fx 资产
// ——「视觉通道绑资产 id 供 check 复算」（任务书美术批要求）：通道名 ⊆ manifest fx 件
//    feedbackChannels 并集；未绑定通道 = 美术映射缺口，逐通道点名
import { readFileSync } from 'node:fs';
import { join as pjoin } from 'node:path';
const manifest = JSON.parse(readFileSync(pjoin(ROOT, 'assets', 'manifest.json'), 'utf8'));
const boundChannels = new Set((manifest.assets ?? []).flatMap((a) => a.feedbackChannels ?? []));
const emitted = new Set(st.feedbackEvents.flatMap((ev) => ev.channels));
for (const ch of emitted) {
  assert(boundChannels.has(ch), `通道「${ch}」无 fx 资产绑定（manifest feedbackChannels 未覆盖——美术映射缺口）`);
}
console.log(`PASS ac-a4(auto) 反馈延迟 max=${maxLatencyMs(maxLatency)}ms ≤${fb.latencyBudgetMs}ms · 每操作通道 min=${minChannels} ≥${fb.minChannelsPerOp} · flash=${fb.hitFlashMs}ms · 通道 ${[...emitted].join('/')} 全绑 fx 件`);
function maxLatencyMs(v) { return v.toFixed(0); }
