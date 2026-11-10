#!/usr/bin/env node
// kernel-determinism.spec.mjs — 内核确定性门禁：同 seed 同输入序列 → 同最终状态；
// 异 seed → 布局不同。零 three 零 DOM，Node 直接跑（P3 口径的测试侧证明）。
import { createGame } from "../src/kernel/loop.js";
import { greedyIntent } from "../src/kernel/autopilot.js";
import { SEED_DEFAULT, ROUND_SECONDS } from "../src/numeric.js";

const failures = [];
const ok = (cond, m) => { console.log(`  ${cond ? "PASS" : "FAIL"}  ${m}`); if (!cond) failures.push(m); };

// 同 seed 两次完整对局：全程意图序列一致 → 最终状态逐字段一致
const runOnce = (seed) => {
  const g = createGame({ seed });
  g.start();
  // 分段变向意图序列（覆盖直行/斜向/停顿），路径完全确定
  for (let s = 0; s < 50; s++) {
    const intent = s % 5 === 0 ? { moveX: 0, moveZ: 0 } : { moveX: Math.sin(s) * 0.8, moveZ: Math.cos(s) * 0.8 };
    g.fastForward(1, intent);
    if (g.state === "gameover") break;
  }
  const w = g.world;
  return JSON.stringify({ p: w.player, g: w.gems, score: w.score, collected: w.collected, timeLeft: w.timeLeft, over: w.over, won: w.won });
};
const a = runOnce(SEED_DEFAULT);
const b = runOnce(SEED_DEFAULT);
ok(a === b, "同 seed 同意图序列 → 最终状态逐字段一致");

// 异 seed：宝石布局必须不同（拒绝采样由 rng 驱动）
const g1 = createGame({ seed: 1 });
const g2 = createGame({ seed: 2 });
ok(JSON.stringify(g1.world.gems) !== JSON.stringify(g2.world.gems), "异 seed → 宝石布局不同");

// 对局真实推进：贪心追宝石 60 秒应当收集宝石并终局（sanity：内核闭环不是摆设）
const g = createGame({ seed: SEED_DEFAULT });
g.start();
for (let s = 0; s < ROUND_SECONDS && g.state === "playing"; s++) {
  g.fastForward(1, greedyIntent(g.world));
}
ok(g.world.collected >= 1, "贪心 60s 至少收集 1 颗（事件上抛 + 收集闭环）");
ok(g.state === "gameover", "贪心 60s 后终局（时间到或全收集）");
ok(Number.isFinite(g.world.score) && Number.isFinite(g.world.timeLeft), "终局数值健康（无 NaN）");

console.log(failures.length ? `KERNEL-DETERMINISM: FAIL（${failures.length}）` : "KERNEL-DETERMINISM: PASS");
process.exit(failures.length ? 1 : 0);
