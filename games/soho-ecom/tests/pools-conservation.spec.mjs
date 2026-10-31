#!/usr/bin/env node
// pools-conservation.spec.mjs — 三池守恒 + T+14 零误差 + 流水可追溯（M1 验收 2 的机判）：
// ① 每笔订单货款的到账日 = 下单日 + 14（误差 0 天，逐笔核对）；
// ② 流水重放：从开局真值逐条执行 journal → 与终态账本逐字段一致（一切增减走同一入口的守恒证明）；
// ③ 资金守恒：现金+在途+累计开支−市场流入 = 开局现金（分毫不差）；
// ④ 货权守恒：补货入库件数 = 出单出库件数 + 期末库存；
// ⑤ 每笔流水带来源 ref / 游戏日 / 金额 / 池间去向（可追溯）。
import { createGame } from "../src/kernel/loop.js";
import { bizIntent } from "../src/kernel/autopilot.js";
import { replay, initialSnapshotOf, inTransitTotal } from "../src/kernel/ledger.js";
import { createWorld } from "../src/kernel/world.js";
import { SEED_DEFAULT, SESSION_DAYS, PAYOUT_CYCLE_DAYS } from "../src/numeric.js";

const failures = [];
const ok = (cond, m) => { console.log(`  ${cond ? "PASS" : "FAIL"}  ${m}`); if (!cond) failures.push(m); };

// —— 跑两局（正常 + 趴窝构造存档）作为守恒样本 ——
const play = (scenario) => {
  const g = createGame({ seed: SEED_DEFAULT, scenario });
  g.start();
  for (let d = 0; d < SESSION_DAYS + 2 && g.state === "playing"; d++) {
    for (let k = 0; k < 10; k++) {
      const intent = bizIntent(g.world);
      if (!intent) break;
      g.dispatch(intent.action, intent.arg);
    }
    g.fastForward(1);
  }
  return g.world;
};

for (const scenario of ["fresh", "broke"]) {
  console.log(`\n—— 场景 ${scenario} ——`);
  const w = play(scenario);
  const w0 = createWorld(w.seed, scenario);
  const baseline = initialSnapshotOf(w0); // 守恒基线 = 开局真值（broke 场景是播种存档 ¥180 + 在途 ¥825，调参 v1 趴窝线 230）

  // ① T+14 零误差：逐订单、逐回款核对
  const revenues = w.journal.filter((e) => e.kind === "order-revenue");
  const payouts = w.journal.filter((e) => e.kind === "payout");
  const badDue = revenues.filter((e) => e.ref.dueDay - e.day !== PAYOUT_CYCLE_DAYS);
  ok(badDue.length === 0, `每笔订单到期日 = 下单日 + ${PAYOUT_CYCLE_DAYS}（${revenues.length} 笔零误差）`);
  const badPay = payouts.filter((e) => e.day !== e.ref.dueDay);
  ok(badPay.length === 0, `每笔回款在到期日当日上午结算（${payouts.length} 批零误差）`);

  // ② 流水重放守恒
  const rep = replay(baseline, w.journal);
  const keys = Object.keys(rep);
  const diff = keys.filter((k) => JSON.stringify(rep[k]) !== JSON.stringify(w[k]));
  ok(diff.length === 0, diff.length === 0
    ? `流水重放与终态账本逐字段一致（${w.journal.length} 条流水，${keys.length} 个字段）`
    : `重放失配：${diff.map((k) => `${k}: replay=${JSON.stringify(rep[k])} != final=${JSON.stringify(w[k])}`).join("; ")}`);

  // ③ 资金守恒：市场流入（订单货款）− 开支（房租/补货/生活）= 资金增量（相对开局真值）
  const marketIn = w.journal.filter((e) => e.from === "market" && e.unit === "¥").reduce((s, e) => s + e.amount, 0);
  const expenseOut = w.journal.filter((e) => e.to === "expense" && e.unit === "¥").reduce((s, e) => s + e.amount, 0);
  const lhs = w.cash + w.inTransit + expenseOut - marketIn;
  const rhs = baseline.cash + baseline.inTransit;
  ok(Math.abs(lhs - rhs) < 1e-6, `资金守恒：现金${Math.round(w.cash)}+在途${Math.round(w.inTransit)}+开支${Math.round(expenseOut)}−货款流入${Math.round(marketIn)} = ${Math.round(lhs)}（开局 ${Math.round(rhs)}）`);

  // ④ 货权守恒：入库件数 = 出库件数 + 期末库存
  const goodsIn = w.journal.filter((e) => e.to === "inventory").reduce((s, e) => s + e.amount, 0);
  const goodsOut = w.journal.filter((e) => e.from === "inventory").reduce((s, e) => s + e.amount, 0);
  ok(Math.abs(goodsIn - goodsOut - w.inventory) < 1e-9, `货权守恒：入库 ${goodsIn} = 出库 ${goodsOut} + 期末 ${w.inventory}`);

  // ⑤ 可追溯：每笔资金流水带游戏日/金额/池间去向；池间转移类（订单/回款）额外带来源 ref
  const moneyEntries = w.journal.filter((e) => e.unit === "¥");
  const untraceable = moneyEntries.filter((e) => !e.from || !e.to || !(e.day >= 1) || !(e.amount > 0) || !e.kind);
  const pool2pool = moneyEntries.filter((e) => (e.from === "inTransit" || e.to === "inTransit"));
  const noRef = pool2pool.filter((e) => !(e.ref?.dueDay >= 1));
  ok(untraceable.length === 0 && noRef.length === 0,
    `每笔资金流水均带来源/游戏日/金额/去向（${moneyEntries.length} 笔全可追溯，池间转移 ${pool2pool.length} 笔全带批次 ref）`);

  // ⑥ 在途镜像守恒（bypass 哨兵）
  ok(Math.abs(w.inTransit - inTransitTotal(w)) < 1e-9, "在途镜像 = 批次之和（无绕过结算入口的改值）");
}

console.log(failures.length ? `POOLS-CONSERVATION: FAIL（${failures.length}）` : "POOLS-CONSERVATION: PASS");
process.exit(failures.length ? 1 : 0);
