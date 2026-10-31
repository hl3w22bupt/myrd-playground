#!/usr/bin/env node
// kernel-smoke.mjs — 内核侧冒烟 payload（与 main.js ?smoke 协议同构：bizIntent 派发 + fastForward 逐日），
// 输出与部署版 SMOKE payload 同形状的「经济面」字段，供部署等价核验（tools/deployed-smoke.mjs 的对照面）。
// 用法：node tools/kernel-smoke.mjs <days> [fresh|broke|rich]  → stdout 一行 JSON
import { createGame } from "../src/kernel/loop.js";
import { bizIntent } from "../src/kernel/autopilot.js";
import { SEED_DEFAULT, SESSION_DAYS } from "../src/numeric.js";

const days = Math.max(0, Math.min(60, Number(process.argv[2]) || 0));
const scenario = ["fresh", "broke", "rich"].includes(process.argv[3]) ? process.argv[3] : "fresh";

const game = createGame({ seed: SEED_DEFAULT, scenario });
game.start();
for (let d = 0; d < days && game.state === "playing"; d++) {
  for (let k = 0; k < 10; k++) {
    const intent = bizIntent(game.world);
    if (!intent) break;
    game.dispatch(intent.action, intent.arg);
  }
  game.fastForward(1);
}
const w = game.world;
console.log(JSON.stringify({
  day: w.day,
  score: Math.round(w.settledTotal),
  timeLeft: Math.max(0, SESSION_DAYS - w.day),
  cash: Math.round(w.cash),
  inventory: Math.floor(w.inventory),
  inTransit: Math.round(w.inTransit),
  orders: w.ordersTotal,
  missed: w.missedTotal,
  broke: w.brokeCount,
  journal: w.journal.length,
  scenario: w.scenario,
  stage: w.stage,
  stageUpDay: w.stageUpDay,
  upgrades: { ...w.upgrades },
  mood: w.mood,
  events: w.eventLog.length,
  eventKinds: [...new Set(w.eventLog.map((e) => e.id))],
  eventChoices: w.eventLog.filter((e) => e.choice).map((e) => ({ id: e.id, choice: e.choice })),
  adCasts: w.journal.filter((e) => e.kind === "ad-spend").length,
}));
