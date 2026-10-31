#!/usr/bin/env node
// kernel-determinism.spec.mjs — 内核确定性门禁：同 seed 同动作序列 → 同最终经营状态；
// 异 seed → 当日需求噪声不同。零 three 零 DOM，Node 直接跑（P3 口径的测试侧证明）。
import { createGame } from "../src/kernel/loop.js";
import { bizIntent } from "../src/kernel/autopilot.js";
import { SEED_DEFAULT, SESSION_DAYS } from "../src/numeric.js";

const failures = [];
const ok = (cond, m) => { console.log(`  ${cond ? "PASS" : "FAIL"}  ${m}`); if (!cond) failures.push(m); };

/** 完整跑一局：每日「派发到无动作 → 快进 1 天」，返回终态指纹 */
const runOnce = (seed) => {
  const g = createGame({ seed });
  g.start();
  for (let d = 0; d < SESSION_DAYS + 2 && g.state === "playing"; d++) {
    for (let k = 0; k < 10; k++) {
      const intent = bizIntent(g.world);
      if (!intent) break;
      g.dispatch(intent.action, intent.arg);
    }
    g.fastForward(1);
  }
  const w = g.world;
  return JSON.stringify({
    day: w.day, cash: w.cash, inventory: w.inventory, inTransit: w.inTransit,
    energy: w.energy, satiety: w.satiety, shopHealth: w.shopHealth,
    receivables: w.receivables, ordersTotal: w.ordersTotal, missedTotal: w.missedTotal,
    settledTotal: w.settledTotal, brokeCount: w.brokeCount, over: w.over, won: w.won,
    journal: w.journal,
  });
};

ok(runOnce(SEED_DEFAULT) === runOnce(SEED_DEFAULT), "同 seed 同动作序列 → 终态与全量流水逐字段一致");
ok(runOnce(SEED_DEFAULT + 1) !== runOnce(SEED_DEFAULT), "异 seed → 需求噪声分岔，经营轨迹不同");

// 一局真实推进：自动驾驶 30+ 游戏日应出单、应趴窝、应回款、应终局（内核闭环不是摆设）
{
  const g = createGame({ seed: SEED_DEFAULT });
  g.start();
  for (let d = 0; d < SESSION_DAYS + 2 && g.state === "playing"; d++) {
    for (let k = 0; k < 10; k++) {
      const intent = bizIntent(g.world);
      if (!intent) break;
      g.dispatch(intent.action, intent.arg);
    }
    g.fastForward(1);
  }
  const w = g.world;
  ok(w.ordersTotal > 0, `自动驾驶真实出单（ordersTotal=${w.ordersTotal}）`);
  ok(w.brokeCount >= 1, `亲历趴窝（brokeCount=${w.brokeCount}，M1 核心张力「爆单 → 现金紧」）`);
  ok(w.settledTotal > 0, `T+14 回款真实到账（settledTotal=${Math.round(w.settledTotal)}）`);
  ok(w.state === undefined && g.state === "gameover", "对局终局（撑满 30 日或资金链断裂）");
  ok([w.cash, w.energy, w.shopHealth, w.satiety, w.inTransit].every(Number.isFinite), "终局数值健康（无 NaN）");
}

console.log(failures.length ? `KERNEL-DETERMINISM: FAIL（${failures.length}）` : "KERNEL-DETERMINISM: PASS");
process.exit(failures.length ? 1 : 0);
