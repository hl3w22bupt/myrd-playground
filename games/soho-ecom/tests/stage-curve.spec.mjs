#!/usr/bin/env node
// stage-curve.spec.mjs — M2 阶段曲线 + 广告契约（M2 验收 4「P0→P1 曲线正确」+ 范围核对的机判）：
// ① P0：现金 <¥5000 时广告与升级入口不可用、单位经济 ¥15/单（M1 口径保持）；
// ② 现金达到 ¥5000 触发 P1 提示（stage-up 事件，一次性）后：广告可用（¥10 → 期望 +1.5 单）、
//    海外仓投入后单位经济变 ¥35/单且效果可观察；
// ③ 广告期望值精确：投放 N 次期望订单池累计 1.5N，经出单管线消耗（同一库存/精力守卫）；
// ④ 广告停投（趴窝规则）与当日时效（日终清零）；
// ⑤ 范围：P2/P3 内容与汇率波动零出现（升级项只有海外仓/SOHO 两档）。
import { createGame } from "../src/kernel/loop.js";
import { bizIntent } from "../src/kernel/autopilot.js";
import { seedScenario, initialSnapshotOf, replay } from "../src/kernel/ledger.js";
import { restockUnitCost } from "../src/kernel/upgrades.js";
import { UPGRADE_DEFS } from "../src/kernel/upgrades.js";
import { EVENT_DEFS } from "../src/kernel/events.js";
import { SEED_DEFAULT, P1_CASH_LINE, AD_COST_PER_CAST, AD_EXPECTED_ORDERS, UNIT_ECONOMY_P0, UNIT_ECONOMY_P1 } from "../src/numeric.js";

const failures = [];
const ok = (cond, m) => { console.log(`  ${cond ? "PASS" : "FAIL"}  ${m}`); if (!cond) failures.push(m); };

// —— ① P0 曲线 ——
{
  const g = createGame({ seed: SEED_DEFAULT });
  g.start();
  const w = g.world;
  ok(w.stage === "P0" && w.cash < P1_CASH_LINE, `开局 P0「兼职试水」（现金 ¥${w.cash} < ¥${P1_CASH_LINE}）`);
  ok(restockUnitCost(w) === 40 && 55 - restockUnitCost(w) === UNIT_ECONOMY_P0, `P0 单位经济 ¥${UNIT_ECONOMY_P0}/单（补货 ¥40/件，M1 口径保持）`);
  g.dispatch("list", "led-light");
  ok(g.dispatch("ad").length === 0, "P0 广告入口不可用");
  ok(g.dispatch("upgradeWarehouse").length === 0 && g.dispatch("upgradeHousing").length === 0, "P0 升级入口不可用");
}

// —— ② P1 触发沿 + 单位经济切换 ——
{
  const g = createGame({ seed: SEED_DEFAULT, scenario: "rich" }); // 构造存档：¥8000 > ¥5000（RICH_SCENARIO_CASH，调参 v1）
  g.start();
  const w = g.world;
  ok(w.stage === "P1", `现金达到 ¥${P1_CASH_LINE} 触发 P1「SOHO 起量」`);
  ok(w.eventLog.length === 0, "P1 提示为阶段事件而非经营事件（不占事件表）");
  // 广告可用且投入后可观察到效果
  g.dispatch("list", "led-light");
  const adDone = g.dispatch("ad");
  ok(adDone.some((e) => e.type === "ad" && e.cost === AD_COST_PER_CAST), `P1 广告可用：¥${AD_COST_PER_CAST}/次`);
  ok(w.adQueue === AD_EXPECTED_ORDERS, `投放后期望订单池 +${AD_EXPECTED_ORDERS}（可观察效果）`);
  // 海外仓投入后单位经济 ¥35
  g.dispatch("upgradeWarehouse");
  ok(55 - restockUnitCost(w) === UNIT_ECONOMY_P1, `海外仓投入后单位经济 ¥${UNIT_ECONOMY_P1}/单（stageCurve P1 锚）`);
  // P1 单向：升级消费后现金跌破解锁线也不回退
  ok(w.cash < P1_CASH_LINE && w.stage === "P1", `升级消费后现金 ¥${Math.round(w.cash)} < ¥${P1_CASH_LINE} 仍保持 P1（单向进度）`);
}

// —— ③ 广告期望值精确 + 出单管线守卫 ——
{
  const g = createGame({ seed: SEED_DEFAULT, scenario: "rich" });
  g.start();
  const w = g.world;
  g.dispatch("list", "led-light");
  const N = 20;
  for (let i = 0; i < N; i++) g.dispatch("ad");
  const casts = w.journal.filter((e) => e.kind === "ad-spend");
  ok(casts.length === N && w.adQueue === N * AD_EXPECTED_ORDERS, `投放 ${N} 次：扣费 ${casts.length} 笔、期望订单池 ${w.adQueue} = ${N} × ${AD_EXPECTED_ORDERS}（期望值精确）`);
  ok(casts.every((e) => e.amount === AD_COST_PER_CAST && e.from === "cash"), "广告扣费逐笔 ¥10 经结算入口（连点 N 次每次独立投放，无幽灵扣费）");
  // 补货充足 → 期望单全部经出单管线出货（同一库存/精力守卫）
  g.dispatch("restock", 50);
  const ordersBefore = w.ordersTotal;
  let guard = 0;
  while (w.adQueue >= 1 - 1e-9 && guard++ < 2400) g.tick(1 / 240);
  ok(w.ordersTotal > ordersBefore, `广告期望单经出单管线真实出货（${ordersBefore} → ${w.ordersTotal} 单）`);
  const rep = replay(initialSnapshotOf(createGame({ seed: SEED_DEFAULT, scenario: "rich" }).world), w.journal);
  const diff = Object.keys(rep).filter((k) => JSON.stringify(rep[k]) !== JSON.stringify(w[k]));
  ok(diff.length === 0, diff.length === 0 ? "含广告/升级整局流水重放一致（广告费无一绕过结算入口）" : `重放失配：${diff.join(", ")}`);
}

// —— ④ 广告停投 + 当日时效 ——
{
  const g = createGame({ seed: SEED_DEFAULT, scenario: "rich" });
  g.start();
  const w = g.world;
  g.dispatch("list", "led-light");
  g.dispatch("ad");
  ok(w.adQueue === AD_EXPECTED_ORDERS, "投放后进入当日期望订单池");
  // 趴窝 → 广告停投（M0 brokeRule 原文）
  w.cash = 100;
  w.broke = true;
  ok(g.dispatch("ad").length === 0, "趴窝中广告停投（brokeRule）");
  // 日终清零（换日后未出货的期望单作废 —— 广告当日时效）
  g.broke = undefined; // 语义无操作，防 lint 误读
  w.broke = false;
  w.cash = 5000;
  g.fastForward(1);
  ok(w.adQueue === 0, `换日后期望订单池清零（当日有效口径，adQueue=${w.adQueue}）`);
}

// —— ⑤ 范围核对：P2/P3 与汇率波动零出现 ——
{
  ok(UPGRADE_DEFS.length === 2 && UPGRADE_DEFS.every((u) => ["warehouse", "housingSoho"].includes(u.id)), "升级线只有两档：海外仓 / SOHO 一人居（P2/P3 内容零出现）");
  ok(!EVENT_DEFS.some((d) => d.id === "fx-swing"), "汇率波动事件零出现（spec.fx.mode=constant，P2 才开启）");
  ok(!EVENT_DEFS.some((d) => ["hire-operator", "payout-advance", "multi-store"].includes(d.id)), "招运营/回款垫资/多店铺不在事件表（P2/P3 零出现）");
  // 自动驾驶在 P0 全程不派发 M2 动作（阶段守卫的端到端证明）
  const g = createGame({ seed: SEED_DEFAULT });
  g.start();
  let m2Actions = 0;
  for (let d = 0; d < 10 && g.state === "playing"; d++) {
    for (let k = 0; k < 12; k++) {
      const intent = bizIntent(g.world);
      if (!intent) break;
      if (["ad", "upgradeWarehouse", "upgradeHousing"].includes(intent.action)) m2Actions++;
      g.dispatch(intent.action, intent.arg);
    }
    g.fastForward(1);
  }
  ok(m2Actions === 0, `自动驾驶 P0 十日零 M2 动作派发（${m2Actions} 次）`);
}

console.log(failures.length ? `STAGE-CURVE: FAIL（${failures.length}）` : "STAGE-CURVE: PASS");
process.exit(failures.length ? 1 : 0);
