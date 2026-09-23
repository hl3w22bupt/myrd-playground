#!/usr/bin/env node
// kernel-determinism.spec.mjs — ac-2：同 seed 同意图序列逐 tick 快照一致；固定步长累加器语义成立。
import { createGame } from "../src/kernel/loop.js";
import { FIXED_STEP, MAX_DT } from "../src/numeric.js";

const failures = [];
const pass = (m) => console.log(`  PASS  ${m}`);
const fail = (m) => failures.push(m);

/** 意图脚本：以 tick 为键的确定性脚本（转向/移动/开火/换弹都有覆盖）*/
function scriptFor(t) {
  return {
    forward: (t >> 4) % 3 === 0 ? 1 : (t >> 4) % 3 === 1 ? 0.6 : 0,
    strafe: (t >> 5) % 2 === 0 ? 0.8 : -0.4,
    yaw: Math.PI + Math.sin(t * 0.011) * 1.4,
    pitch: Math.sin(t * 0.017) * 0.35,
    sprint: t % 97 < 30,
    firing: t % 53 < 26,
    reload: t % 211 === 100,
  };
}

const SECONDS = 45;
function runSeries(seed) {
  const g = createGame({ seed });
  const snaps = [];
  const total = Math.floor(SECONDS / FIXED_STEP);
  for (let t = 0; t < total; t++) {
    g.frame(FIXED_STEP, scriptFor(t));
    snaps.push(JSON.stringify(g.snapshot()));
    if (g.world.over) break;
  }
  return snaps;
}

// ① 同 seed 双跑逐 tick 一致
for (const seed of [7, 20260923]) {
  const a = runSeries(seed), b = runSeries(seed);
  const firstDiff = a.findIndex((s, i) => s !== b[i]);
  if (a.length === b.length && firstDiff === -1) pass(`seed=${seed} 两跑 ${a.length} tick 快照逐字段一致`);
  else fail(`seed=${seed} 确定性破坏：首个差异 tick=${firstDiff}`);
}

// ② 不同 seed 表现不同（seeded RNG 真的生效，不是常量）
const [s1, s2] = [runSeries(7), runSeries(8)];
if (s1.some((s, i) => s !== s2[i])) pass("不同 seed 轨迹分化（seeded RNG 生效）");
else fail("不同 seed 轨迹完全相同 —— RNG 未接入");

// ③ 大 dt 帧 = 等量固定子步（累加器 + MAX_DT 钳制语义：同一意图注入一整帧）
{
  const a = createGame({ seed: 5 }), b = createGame({ seed: 5 });
  const intent = { forward: 1, strafe: 0.4, yaw: Math.PI / 2, pitch: 0.1, firing: true, reload: true };
  a.frame(0.37, intent);                          // 一大帧（被 MAX_DT 钳制到 0.1 → 6 tick，边缘标志只在首子步注入）
  for (let i = 0; i < Math.round(MAX_DT / FIXED_STEP); i++) b.frame(FIXED_STEP, intent);
  const sa = JSON.stringify(a.snapshot()), sb = JSON.stringify(b.snapshot());
  if (sa === sb) pass(`大 dt 帧被钳制为 ${Math.round(MAX_DT / FIXED_STEP)} 个固定子步（快照一致）`);
  else fail("大 dt 帧与固定子步序列不等价：累加器语义不成立");
}

// ④ fastForward 与逐 tick 快进等价
{
  const a = createGame({ seed: 11 });
  const b = createGame({ seed: 11 });
  a.fastForward(20, { firing: true, yaw: Math.PI });
  const total = Math.floor(20 / FIXED_STEP);
  for (let t = 0; t < total && !b.world.over; t++) b.frame(FIXED_STEP, { firing: true, yaw: Math.PI });
  const sa = JSON.stringify(a.snapshot()), sb = JSON.stringify(b.snapshot());
  if (sa === sb) pass("fastForward 与逐 tick frame 快照等价");
  else fail("fastForward 与逐 tick frame 不等价");
}

if (failures.length) { console.error("—— 合计 FAIL ——"); for (const f of failures) console.error(`  FAIL  ${f}`); process.exit(1); }
console.log("CONTRACT: PASS 内核确定性成立");
