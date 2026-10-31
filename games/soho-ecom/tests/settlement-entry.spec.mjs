#!/usr/bin/env node
// settlement-entry.spec.mjs — 三资源一致结算（M1 验收 3 的机判，静态 + 行为双查）：
// 静态：src/kernel 里除 ledger.js 外，不得出现对池/资源字段的直接赋值（绕过结算入口即违例）；
// 行为：随机动作序列后，任意资源快照与「从流水重放」结果一致；公式口径逐项复算（¥15/单、2精力/单、T+14）。
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createGame } from "../src/kernel/loop.js";
import { settle, replay, initialSnapshotOf } from "../src/kernel/ledger.js";
import { createWorld, stepWorld, actionRestock, actionList, actionNoodle, actionReplyReview } from "../src/kernel/world.js";
import {
  SEED_DEFAULT, SESSION_DAYS, SALE_PRICE_PER_UNIT, UNIT_COST_WITH_FREIGHT,
  ENERGY_PER_ORDER, RENT_PER_DAY, CASH_INITIAL, INVENTORY_INITIAL,
} from "../src/numeric.js";

const failures = [];
const ok = (cond, m) => { console.log(`  ${cond ? "PASS" : "FAIL"}  ${m}`); if (!cond) failures.push(m); };
const here = path.dirname(fileURLToPath(import.meta.url));
const kernelDir = path.join(here, "..", "src", "kernel");

const walk = (dir) => readdirSync(dir).sort().flatMap((name) => {
  const full = path.join(dir, name);
  return statSync(full).isDirectory() ? walk(full) : [full];
});

// —— 静态查：只有 ledger.js 允许写池/资源字段（createWorld 的初始字面量在 world.js，白名单豁免）——
{
  const FIELD_WRITE = /\b(?:cash|inventory|inTransit|energy|satiety|shopHealth|seq)\s*(?:=[^=]|\+=|-=|\+\+|--)/;
  const offenders = [];
  for (const f of walk(kernelDir)) {
    const rel = path.relative(kernelDir, f);
    if (rel === "ledger.js") continue;
    const code = readFileSync(f, "utf8").replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
    if (FIELD_WRITE.test(code)) offenders.push(rel);
  }
  ok(offenders.length === 0, offenders.length === 0
    ? "内核无绕过结算入口的直接改值（静态扫描 0 违例）"
    : `发现绕过结算入口的直接改值：${offenders.join("、")}`);
  const ledgerUsesSettle = readFileSync(path.join(kernelDir, "world.js"), "utf8").includes("settle(");
  ok(ledgerUsesSettle, "world.js 动作确实经 settle() 结算");
}

// —— 行为查：随机动作序列（种子驱动）后，资源快照 = 流水重放 ——
{
  let seed = 12345;
  const rand = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };
  const g = createGame({ seed: SEED_DEFAULT });
  g.start();
  const initTrue = initialSnapshotOf(g.world);
  const ACTIONS = [
    ["restock", 10], ["restock", 25], ["restock", 50],
    ["list", "led-light"], ["list", "pet-feeder"], ["list", "yoga-band"], ["list", "phone-stand"],
    ["delist", "led-light"],
    ["noodle"], ["meal"], ["sleepVan"], ["motel"], ["replyReview"],
  ];
  for (let i = 0; i < 200; i++) {
    const a = ACTIONS[Math.floor(rand() * ACTIONS.length)];
    g.dispatch(a[0], a[1]);
    if (rand() < 0.3) g.tick(0.05); // 时间也在动，覆盖日内出单与换日结算
    if (g.state === "gameover") break;
  }
  const w = g.world;
  const rep = replay(initTrue, w.journal);
  const diff = Object.keys(rep).filter((k) => JSON.stringify(rep[k]) !== JSON.stringify(w[k]));
  ok(diff.length === 0, diff.length === 0
    ? `随机 200 步动作后资源快照与流水重放一致（journal ${w.journal.length} 条）`
    : `重放失配：${diff.map((k) => k).join(", ")}`);
}

// —— 公式口径复算（M0 锚点逐项） ——
{
  const w = createWorld(SEED_DEFAULT);
  // 单件毛利 = 售价 − 头程成本 = ¥15（M0 锚 #1）
  ok(SALE_PRICE_PER_UNIT - UNIT_COST_WITH_FREIGHT === 15, `单件毛利公式 55 − 40 = 15（¥15/单锚点）`);
  // 补货一条公式：现金 −40/件 → 库存 +件
  const evs = [];
  const r = actionRestock(w, 10, evs);
  ok(r.ok && w.cash === CASH_INITIAL - 400 && w.inventory === 10, `补货 10 件：现金 ${CASH_INITIAL}−400=${w.cash}、库存=${w.inventory}（¥40/件一条公式）`);
  // 出单：精力 −2、库存 −1、在途 +¥55、T+14（上架后步进到首单出现）
  const evs2 = [];
  actionList(w, "led-light", evs2);
  const invBefore = w.inventory;
  const energyBefore = w.energy;
  let guard = 0;
  while (w.journal.filter((e) => e.kind === "order-labor").length === 0 && guard++ < 240) stepWorld(w, 1 / 240);
  const labor = w.journal.filter((e) => e.kind === "order-labor");
  const revenue = w.journal.filter((e) => e.kind === "order-revenue");
  if (labor.length > 0) {
    const l = labor[0];
    ok(Math.abs(l.amount - ENERGY_PER_ORDER) < 1e-9, `处理一单精力 −${l.amount}（M0 energyPerOrder=2）`);
    ok(w.inventory === invBefore - 1, `出单库存 −1（${invBefore} → ${w.inventory}）`);
    ok(energyBefore - w.energy >= ENERGY_PER_ORDER, `精力实际下降 ≥2（${energyBefore} → ${w.energy}）`);
    const rev = revenue[revenue.length - 1];
    ok(rev.amount === SALE_PRICE_PER_UNIT && rev.to === "inTransit", `订单货款 +¥${rev.amount} 进在途池（T+14 前不进现金）`);
    ok(rev.ref.dueDay - rev.day === 14, `在途批次 T+14 归批（dueDay ${rev.ref.dueDay} = 下单日 ${rev.day} + 14）`);
  } else {
    ok(false, "上架后一天内未产生订单（需求管线异常）");
  }
  // 房租每日 ¥30
  const rent = w.journal.filter((e) => e.kind === "rent");
  ok(rent.every((e) => e.amount === RENT_PER_DAY), `房租逐日 ¥${RENT_PER_DAY}（床位档）`);
  // 回评：精力 −5 → 店铺健康 +15
  const evs4 = [];
  const h0 = w.shopHealth;
  w.energy = 100;
  actionReplyReview(w, evs4);
  ok(w.shopHealth === Math.min(100, h0 + 15) && w.energy <= 95, `回评：店铺健康 ${h0}→${w.shopHealth}（+15）、精力 ≤95`);
  // INVENTORY_INITIAL 与 IN_TRANSIT_INITIAL 为 0（M0 resources.initial）
  const w2 = createWorld(SEED_DEFAULT);
  ok(w2.inventory === INVENTORY_INITIAL && w2.inTransit === 0, "开局库存/在途为 0（库存=现金的前置形态）");
  // settle 拒绝负数与未知账户
  let threw = 0;
  try { settle(w2, { kind: "x", from: "cash", to: "expense", amount: -5 }); } catch { threw++; }
  try { settle(w2, { kind: "x", from: "moon", to: "cash", amount: 5 }); } catch { threw++; }
  ok(threw === 2, "结算入口拒绝负数金额与未知账户（非法路径无副作用）");
}

console.log(failures.length ? `SETTLEMENT-ENTRY: FAIL（${failures.length}）` : "SETTLEMENT-ENTRY: PASS");
process.exit(failures.length ? 1 : 0);
