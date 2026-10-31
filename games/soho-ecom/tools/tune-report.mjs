#!/usr/bin/env node
// tune-report.mjs — 调参 v1（spec.tune）复算器：多 seed 跑调参后内核，输出手感指标矩阵
// + M2 验收线（默认 seed 前 11 日 ≥6 类）复验。调参前（v3 部署实测）数字来自
// docs/acceptance/ACCEPTANCE-loop-abc.md §3 的 SMOKE payload 摘录，作为对照基线打印。
// 用法：node tools/tune-report.mjs [工程目录]
import { createGame } from "../src/kernel/loop.js";
import { bizIntent } from "../src/kernel/autopilot.js";
import {
  SEED_DEFAULT, SESSION_DAYS, CASH_INITIAL, RESTOCK_LOTS, MIN_RESTOCK_UNITS,
  BROKE_LINE, EVENT_CHANCE_PER_DAY, EVENT_IDS_SHELVED_WHEN_BROKE,
} from "../src/numeric.js";
import { PRODUCTS } from "../src/levels/products.js";

const root = process.argv[2] && !process.argv[2].startsWith("-") ? process.argv[2] : ".";
const SEEDS = [SEED_DEFAULT, 1, 7, 42, 2026, 99, 777, 31337, 5, 20261031];

console.log("== 调参 v1 生效参数（spec.tune 镜像核对） ==");
console.log(`  CASH_INITIAL=${CASH_INITIAL}（占位值校准 3000→3500）`);
console.log(`  RESTOCK_LOTS=[${RESTOCK_LOTS.join(",")}] MIN_RESTOCK_UNITS=${MIN_RESTOCK_UNITS} BROKE_LINE=${BROKE_LINE}`);
console.log(`  baseDemand=[${PRODUCTS.map((p) => p.baseDemand).join("/")}]（合计 ${PRODUCTS.reduce((s, p) => s + p.baseDemand, 0)}/日，带宽对齐资本带宽）`);
console.log(`  EVENT_CHANCE_PER_DAY=${EVENT_CHANCE_PER_DAY} SHELVED_WHEN_BROKE=[${EVENT_IDS_SHELVED_WHEN_BROKE.join(",")}]`);

/** 一局 30 日（与 ?smoke 协议同构）：12 次派发/日 + 快进 1 日 */
function runSession(seed, days = SESSION_DAYS) {
  const g = createGame({ seed });
  g.start();
  const w = g.world;
  let zeroOrderDays = 0, ordersToday = 0, lastDay = w.day;
  const activeDays = new Set();
  for (let d = 0; d < days && g.state === "playing"; d++) {
    for (let k = 0; k < 12; k++) {
      const it = bizIntent(w);
      if (!it) break;
      g.dispatch(it.action, it.arg);
    }
    for (const e of g.fastForward(1).events) {
      if (e.type === "order") { ordersToday += 1; activeDays.add(e.day); }
    }
    if (w.day !== lastDay) {
      if (ordersToday === 0) zeroOrderDays += 1;
      ordersToday = 0;
      lastDay = w.day;
    }
  }
  const kinds = new Set(w.eventLog.map((e) => e.id));
  const moods = new Set(w.eventLog.map((e) => e.moodKind));
  return {
    seed, day: w.day, orders: w.ordersTotal, missed: w.missedTotal,
    zeroOrderDays, activeDays: activeDays.size,
    broke: w.brokeCount, payouts: w.payoutCount, settled: Math.round(w.settledTotal),
    cash: Math.round(w.cash), kinds: kinds.size, bothMoods: moods.has("bad") && moods.has("good"),
    over: w.over, won: w.won,
  };
}

/** M2 验收 1 复验：默认 seed 前 11 日 ≥6 类（与 tests/events.spec.mjs 同口径，只跑部分天数） */
function coverageFirst11(seed) {
  const g = createGame({ seed });
  g.start();
  const w = g.world;
  for (let d = 0; d < 12 && g.state === "playing"; d++) {
    for (let k = 0; k < 12; k++) {
      const it = bizIntent(w);
      if (!it) break;
      g.dispatch(it.action, it.arg);
    }
    g.fastForward(1);
  }
  return new Set(w.eventLog.map((e) => e.id)).size;
}

const rows = SEEDS.map((s) => runSession(s));
const avg = (f) => rows.reduce((s, r) => s + r[f], 0) / rows.length;
const d0 = rows.find((r) => r.seed === SEED_DEFAULT);

console.log("\n== 30 日手感指标（调参后，10 seeds 多档复算） ==");
console.log("  seed | day | orders | missed | zeroDays | activeDays | broke | settledOrders | settled¥ | finalCash | kinds | over");
for (const r of rows) {
  console.log(`  ${String(r.seed).padEnd(8)} | ${String(r.day).padEnd(3)} | ${String(r.orders).padEnd(6)} | ${String(r.missed).padEnd(6)} | ${String(r.zeroOrderDays).padEnd(8)} | ${String(r.activeDays).padEnd(10)} | ${String(r.broke).padEnd(5)} | ${String(r.payouts).padEnd(12)} | ${String(r.settled).padEnd(8)} | ${String(r.cash).padEnd(9)} | ${String(r.kinds).padEnd(5)} | ${r.over ? "Y" : "-"}`);
}
console.log(`  均值  |     | ${avg("orders").toFixed(1)} | ${avg("missed").toFixed(0)} | ${avg("zeroOrderDays").toFixed(1)} | ${avg("activeDays").toFixed(1)} | ${avg("broke").toFixed(1)} | ${avg("payouts").toFixed(1)} | ${avg("settled").toFixed(0)} | ${avg("cash").toFixed(0)} |  |`);

console.log("\n== 对照基线（调参前 = v3 部署实测，docs/acceptance/ACCEPTANCE-loop-abc.md §3） ==");
console.log("  fresh 30 日：orders=140 missed=754 broke=4 回款=3 批 settled=3850 finalCash=0（默认 seed）");
console.log(`  调参后默认 seed：orders=${d0.orders} missed=${d0.missed} broke=${d0.broke} settledOrders=${d0.payouts} settled=${d0.settled} finalCash=${d0.cash}`);

const cov = coverageFirst11(SEED_DEFAULT);
const covOk = cov >= 6 && d0.kinds >= 6 && d0.bothMoods;
console.log("\n== M2 验收线复验 ==");
console.log(`  默认 seed 前 11 日事件 ${cov} 类（≥6）${cov >= 6 ? " ✓" : " ✗ FAIL"}；30 日 ${d0.kinds} 类、两类均有=${d0.bothMoods}`);
console.log(`  对局完整性：over=${d0.over} won=${d0.won}（撑满 30 日）`);
console.log(`  TUNE-REPORT: ${covOk && d0.over ? "PASS" : "FAIL"}`);
process.exit(covOk && d0.over ? 0 : 1);
