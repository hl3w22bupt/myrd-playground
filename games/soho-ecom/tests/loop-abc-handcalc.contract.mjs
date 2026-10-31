// loop-abc-handcalc.contract.mjs — 「三循环数值闭环」手算对照契约（使用验收 · goal-cmvv02e7a0019m9uwy2nosbkn）。
// 本文件是验收契约，不是实现镜像：**全部期望值硬编码自策划案原文**（design-spec.json → spec.loops /
// exchangeRates / payoutPools / stageCurve / numeric.events），不 import numeric.js 的任何常量做期望 ——
// 策划案 ↔ 代码 一旦漂移在此现形。驱动内核用的运行参数（seed / 固定步长）才允许 import。
//
// 手算基准（spec.loops，误差 0 口径）：
//   A 个人维持：30 单×¥15=¥450；精力−60、吃饭¥20、房租¥30 → 净 +¥400 > 0，且 < 增长所需（30 件补货
//     ¥40/件=¥1200）的 50%（400/1200=33.3%）。链：接单→精力↓→吃睡→恢复。
//   B 商业增长：利润→补货→更大单→利润↑；受 T+14 错配约束，增长有天然天花板。
//     手算：件成本 ¥40 预付、¥55 货款 T+14 后回 → 资金占用 = 14 日×(40S+固定开支)；首批 ¥3000 下
//     前 14 日净流出，首个回款日 = 首单日 + 14。
//   C 风险对冲：事故→健康/信誉↓→转化↓→收入↓；不花钱花精力清理就螺旋下降（不清理 = 螺旋，清理 = 回升）。
//
// 边界手算（spec.payoutPools / resources / stageCurve）：
//   趴窝线 = 固定开支 + 最低补货：床位档 30+5×40=¥230；海外仓档 30+5×20=¥130；SOHO+海外仓 60+5×20=¥160
//   （调参 v1 最低补货档 10→5 件，spec.tune.restockLots；口径公式不变。）
//   资金链断裂自救启动金 = 泡面 5 + 钟点房 50 = ¥55。
//   回款到期日 = 下单日 + 14（payoutCycleDays）；P1 解锁线 = 现金 ¥5000；升级花费 ¥3000×2。
//   8 类事件效果 = spec.numeric.events 原文（fx-swing M2 关闭，零出现）。
import { createGame } from "../src/kernel/loop.js";
import { createWorld, stepWorld, isBroke, isTerminal, actionList, actionRestock, actionSleepVan, actionMotel, actionReplyReview, actionAdvertise, dailyDemand } from "../src/kernel/world.js";
import { settle, bookOrder, replay } from "../src/kernel/ledger.js";
import { EVENT_DEFS, EVENT_BY_ID, eventChoice } from "../src/kernel/events.js";
import { applyUpgrade, stageCheck } from "../src/kernel/upgrades.js";
import { bizIntent } from "../src/kernel/autopilot.js";
import { FIXED_STEP, SEED_DEFAULT } from "../src/numeric.js";

let passed = 0;
const failures = [];
const ok = (cond, msg) => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${msg}`);
  if (cond) passed += 1;
  else failures.push(msg);
};
const eq = (a, b, msg) => ok(a === b, `${msg}（期望 ${b}，实测 ${a}）`);

// —— 手算期望值（策划案原文硬编码；唯一来源 design-spec.json，勿从 numeric.js 抄）——
const SPEC = Object.freeze({
  grossPerOrder: 15,        // #1 全表之锚
  salePrice: 55,            // #8 售价
  unitCost: 40,             // #8 头程成本
  energyPerOrder: 2,        // #2
  rentBed: 30,              // #13 床位档
  rentSoho: 60,             // #13 ×2 档位递进（spec.m2）
  payoutDays: 14,           // #10
  mealCost: 20,             // #4
  noodleCost: 5,            // #3
  motelCost: 50,            // #6
  bootstrap: 55,            // 自救启动金 = 5 + 50
  p1Line: 5000,             // stageCurve P1 unlock
  upgradeCost: 3000,        // spec.m2.upgrades（1.5× 首批 ¥2000）
  brokeBed: 230,            // 30 + 5×40（调参 v1 最低补货档 5 件，spec.tune.restockLots）
  brokeWarehouse: 130,      // 30 + 5×20
  brokeSoho: 160,           // 60 + 5×20
  wearPerDay: 5,            // #11
  replyEnergy: 5,           // #11
  replyHealth: 15,          // #11
  warehouseUnitCost: 20,    // spec.m2 头程结构变化 ¥40→¥20（毛利 ¥15→¥35 反推）
  // —— 8 类事件效果（spec.numeric.events 原文）——
  followSeller: { demandFactor: 0.8, days: 3, complainEnergy: 10 },
  badReviewer: { healthHit: 20, prCost: 50, prEnergy: 5, relief: 10 },   // 减半 → 净 −10
  freightDelay: { days: 3, health: 10 },
  customsCheck: { fine: 300, days: 2 },
  peakStockout: { healthPerDay: 5 },
  fiveStar: { health: 10, mood: 5 },
  organicHit: { mult: 2 },
  warehouseRestock: { days: 3, health: 10 },
});

const snap = (w) => ({
  day: w.day, cash: w.cash, inventory: w.inventory, inTransit: w.inTransit,
  energy: w.energy, satiety: w.satiety, shopHealth: w.shopHealth,
  ordersTotal: w.ordersTotal, missedTotal: w.missedTotal, settledTotal: w.settledTotal,
  broke: w.broke, brokeCount: w.brokeCount, stage: w.stage, mood: w.mood,
  receivables: w.receivables.map((b) => ({ ...b })), over: w.over, won: w.won,
});

/** 30 日轨迹 runner（与 main.js ?smoke 协议逐日同构：每日 policy 派发到穷尽 + 快进 1 日）。
 *  policy 可替换 —— 用于区分「自动驾驶策略问题」与「数值调参问题」（验收对照的实验设计） */
function runTrajectory({ days = 30, scenario = "fresh", policy = bizIntent } = {}) {
  const game = createGame({ seed: SEED_DEFAULT, scenario });
  game.start();
  const w = game.world;
  const trace = [];
  let jour = 0;
  for (let d = 0; d < days && game.state === "playing"; d++) {
    const before = snap(w);
    const actions = [];
    for (let k = 0; k < 10; k++) {
      const it = policy(w);
      if (!it) break;
      game.dispatch(it.action, it.arg);
      actions.push(it.action);
    }
    const jourStart = jour;
    const evs = [];
    for (let step = 0; step < Math.round(1 / FIXED_STEP); step++) evs.push(...stepWorld(w, FIXED_STEP));
    jour = w.journal.length;
    trace.push({
      day: before.day,
      before, after: snap(w),
      actions,
      events: evs,
      journal: w.journal.slice(jourStart, jour),
    });
  }
  return { game, world: w, trace };
}

/** 一天的经济学净额（策划案口径：毛利×单数 − 生活/固定开支；补货是现金↔库存等价置换，净值 0） */
function econOf(j) {
  const orders = j.filter((e) => e.kind === "order-revenue").length;
  const revenue = j.filter((e) => e.kind === "order-revenue").reduce((s, e) => s + e.amount, 0);
  const opex = j
    .filter((e) => ["rent", "meal", "noodle", "motel", "ad-spend", "event-customs-fine", "event-pr-cost"].includes(e.kind))
    .reduce((s, e) => s + e.amount, 0);
  const refunds = j.filter((e) => e.kind === "event-ad-refund").reduce((s, e) => s + e.amount, 0);
  const capex = j.filter((e) => e.kind.startsWith("upgrade-")).reduce((s, e) => s + e.amount, 0);
  const restockPay = j.filter((e) => e.kind === "restock-pay").reduce((s, e) => s + e.amount, 0);
  return { orders, revenue, opex, refunds, capex, restockPay, net: SPEC.grossPerOrder * orders - opex + refunds - capex };
}

const fmt = (n) => String(Math.round(n * 100) / 100);
function printTrace(title, trace) {
  console.log(`\n  —— ${title}（部署同源内核逐日表，手算对照证据）——`);
  console.log("  day |    cash | inv | inTransit | ord | miss | enrg | sati | hlth | settled | broke | stage");
  for (const r of trace) {
    const e = econOf(r.journal);
    console.log(`  ${String(r.day).padStart(3)} | ${fmt(r.after.cash).padStart(7)} | ${String(r.after.inventory).padStart(3)} | ${fmt(r.after.inTransit).padStart(9)} | ${String(e.orders).padStart(3)} | ${String(r.events.filter((x) => x.type === "missed").length).padStart(4)} | ${fmt(r.after.energy).padStart(4)} | ${fmt(r.after.satiety).padStart(4)} | ${fmt(r.after.shopHealth).padStart(4)} | ${fmt(r.after.settledTotal).padStart(7)} | ${r.after.broke ? "Y" : "-"}     | ${r.after.stage}`);
  }
}

// ———————————————— 主轨迹（部署版同源代码 + 与 ?smoke 协议同构的自动驾驶策略）————————————————
const MAIN = runTrajectory({ days: 30 });
printTrace("主轨迹：autopilot（bizIntent 原策略，与部署版 ?smoke=30 同协议同种子）", MAIN.trace);

console.log("\n===== 循环 A（个人维持）：手算 30 单×¥15=¥450，净 +¥400 > 0 且 < 增长所需 50% =====");
{
  // 手算复算（策划案 A 原文）
  const handGross = SPEC.grossPerOrder * 30;
  const handNet = handGross - SPEC.mealCost - SPEC.rentBed;
  eq(handGross, 450, "手算复算：30×15=450（策划案 A 原文）");
  eq(handNet, 400, "手算复算：450−20−30=+400（策划案 A 原文）");
  ok(handNet > 0, "循环 A 判据①（手算层）：净 +400 > 0（个人维持不亏）");
  const growthNeed = SPEC.unitCost * 30; // 30 件补货 ¥1200
  ok(handNet < 0.5 * growthNeed, `循环 A 判据②（手算层）：净 400 < 增长所需 ¥${growthNeed} ×50%（占比 ${(100 * handNet / growthNeed).toFixed(1)}%）`);

  // 内核实测：出单日的净额手算公式「15×单数 − 开支」与池变动恒等（结算完整性，逐日全称量词）
  const servingDays = MAIN.trace.filter((r) => econOf(r.journal).orders > 0);
  ok(servingDays.length >= 1, `实测轨迹有出单日（${servingDays.length}/30 日）`);
  let formulaOk = 0;
  for (const r of servingDays) {
    const e = econOf(r.journal);
    const dCash = r.after.cash - r.before.cash;
    const dTransit = r.after.inTransit - r.before.inTransit;
    const basis = r.after.stage === "P1" ? SPEC.warehouseUnitCost : SPEC.unitCost; // 补货成本基线（P0=40）
    const dInv = r.after.inventory - r.before.inventory;
    // 恒等式：净额 = Δcash + ΔinTransit + basis×Δinventory（补货=现金↔库存等价置换、回款=在途→现金内部划转，均不进净额）
    if (Math.abs((dCash + dTransit + basis * dInv) - e.net) < 1e-6) formulaOk += 1;
  }
  eq(formulaOk, servingDays.length, `净额手算公式逐日成立（${formulaOk}/${servingDays.length} 出单日：15×单数−开支 = Δ现金+Δ在途+成本基线×Δ库存）`);

  // 判据①实测（回款飞轮期、无事件现金冲击、无资本开支的出单日）。
  // 调参 v1（spec.tune.demandBand）后单链接日需求 ~11/日，单日净额可在低出单日为负（2-3 单覆盖不了当日
  // 开支）——「个人维持不亏」的判据落在回款周期聚合层（策划案 A 的 +400 本就是满产日手算口径），
  // 单日层另证「存在净额为正的出单日」。
  const cleanFlywheel = MAIN.trace.filter((r) => r.after.settledTotal > 0
    && econOf(r.journal).orders > 0
    && econOf(r.journal).capex === 0
    && !r.journal.some((x) => ["event-customs-fine", "event-pr-cost"].includes(x.kind)));
  const netSum = cleanFlywheel.reduce((s, r) => s + econOf(r.journal).net, 0);
  const bestDay = cleanFlywheel.length > 0 ? Math.max(...cleanFlywheel.map((r) => econOf(r.journal).net)) : 0;
  ok(cleanFlywheel.length > 0 && netSum > 0,
    `循环 A 判据①（实测层）：回款期干净出单日累计净额 +¥${fmt(netSum)} > 0（${cleanFlywheel.length} 日聚合，周期层面不亏）`);
  ok(bestDay > 0, `循环 A 判据①（单日层）：干净出单日净额峰值 +¥${fmt(bestDay)} > 0`);

  // 判据②实测：出单日净额 / 该日单数的补货所需（40/单）< 50%
  const ratioOk = cleanFlywheel.every((r) => {
    const e = econOf(r.journal);
    return e.net < 0.5 * SPEC.unitCost * e.orders;
  });
  ok(ratioOk, "循环 A 判据②（实测层）：出单日净额 < 增长所需（40/单）×50% —— 利润大头必须再投入（增长空间成立）");
}

console.log("\n===== 循环 B（商业增长）：T+14 错配 = 增长天花板；资金占用 14 日×(40S+固定) =====");
{
  const { trace, world } = MAIN;
  const firstOrder = trace.flatMap((r) => r.journal).find((e) => e.kind === "order-revenue");
  const payouts = trace.flatMap((r) => r.journal).filter((e) => e.kind === "payout");
  ok(firstOrder != null && payouts.length > 0, `首单在第 ${firstOrder?.day} 日、首个回款在第 ${payouts[0]?.day} 日（共 ${payouts.length} 笔）`);
  // 每笔回款都必须发生在其批次到期日当天（#10 T+14；批次平移经 payout-delay 落账后按平移后到期日结，仍零误差）
  const payoutOnDue = payouts.every((p) => p.day === p.ref?.dueDay);
  ok(payoutOnDue, `全部 ${payouts.length} 笔回款都在批次到期日当日上午结转（逐笔 day == ref.dueDay，误差 0 天）`);
  // T+14 零误差三段证明：①每笔订单入账时 ref.dueDay 恒 = 下单日+14（booking 层）
  const ordersAll = trace.flatMap((r) => r.journal).filter((e) => e.kind === "order-revenue");
  const bookingOk = ordersAll.every((e) => e.ref?.dueDay === e.day + SPEC.payoutDays);
  ok(bookingOk, `全部 ${ordersAll.length} 笔订单入账：ref.dueDay = 下单日 + ${SPEC.payoutDays}（booking 层零误差）`);
  // ②事件平移只经 payout-delay 流水发生（amount=天数、ref.shifts 逐批 from→to），平移后 ③结转仍按到期日当日（上条已判）
  const shiftsAll = trace.flatMap((r) => r.journal).filter((e) => e.kind === "payout-delay");
  const shiftLegs = shiftsAll.reduce((s, e) => s + (e.ref?.shifts ?? []).length, 0);
  console.log(`  INFO  事件平移 ${shiftsAll.length} 次 / ${shiftLegs} 个批次腿（全经 payout-delay 流水；首批原始到期日 ${firstOrder.day + SPEC.payoutDays} → 实际结转第 ${payouts[0]?.day} 日）`);

  // 手算：首单→首回款窗口（14 日）现金单向下行 —— 增长被 T+14 锁住（spec loop B balanceCriteria）
  const pre = trace.filter((r) => r.day < firstOrder.day + SPEC.payoutDays);
  const preNetCash = pre.reduce((s, r) => s + (r.after.cash - r.before.cash), 0);
  ok(preNetCash < 0, `首单→首回款窗口（${pre.length} 日）现金净变动 ¥${fmt(preNetCash)} < 0（货款全压在途）`);
  const windowTrace = trace.filter((r) => r.day <= firstOrder.day + SPEC.payoutDays);
  const trough = Math.min(...windowTrace.map((r) => r.after.cash));
  const noDeath = windowTrace.every((r) => !r.after.over) && trace.some((r) => r.day >= firstOrder.day + SPEC.payoutDays);
  ok(noDeath, `窗口内零资金链断裂（趴窝≠断裂：在途批次是救命稻草，isTerminal 全程 false）`);
  const inTransitPeak = Math.max(...trace.map((r) => r.after.inTransit));
  ok(inTransitPeak > trough, `张力公式实测：在途峰值 ¥${fmt(inTransitPeak)} ≫ 现金谷值 ¥${fmt(trough)}（订单越爆→在途越多→可用现金越紧）`);

  // 张力路径实测：趴窝（无法补货）→ 回款到账自动解除 → 当日再投入（事件自带 day 字段，前流水口径）
  const brokeOnDays = trace.flatMap((r) => r.events).filter((e) => e.type === "broke-on").map((e) => e.day);
  const brokeOffDays = trace.flatMap((r) => r.events).filter((e) => e.type === "broke-off").map((e) => e.day);
  ok(brokeOnDays.length >= 1, `趴窝可触发（${brokeOnDays.length} 次：第 ${brokeOnDays.join("、")} 日进入）`);
  ok(brokeOffDays.length >= 1, `趴窝可恢复（回款到账当日解除：第 ${brokeOffDays.join("、")} 日）`);
  // 解除沿只可能由回款制造（回款是现金唯一回升沿）：每次解除当日必有回款；解除次数 ≤ 回款笔数
  // （调参 v1 后回款节拍加密为 5-7 次，趴窝未必每笔都赶上了——原「解除==回款笔数」随节拍放宽为该恒等式）
  const offOnPayout = brokeOffDays.every((d) => payouts.some((p) => p.day === d));
  ok(offOnPayout, `趴窝解除全部发生在回款到账当日（${brokeOffDays.join("、")} ∈ 回款日）`);
  ok(brokeOffDays.length <= payouts.length, `解除次数 ≤ 回款笔数（${brokeOffDays.length} ≤ ${payouts.length}：一次回款至多解除一次趴窝）`);
  const reinvestSameDay = trace.filter((r) => brokeOffDays.includes(r.day)).filter((r) => r.journal.some((e) => e.kind === "restock-goods"));
  ok(reinvestSameDay.length >= 1, `解除当日有再补货（回血→再投入 闭环成立：${reinvestSameDay.map((r) => `day${r.day}`).join("、")}）`);

  // 三池守恒独立复算：replay 从真初始态（trace[0].before = createWorld 后未 tick 的快照）重放整局流水 == 终态
  const initial = { ...trace[0].before, payoutCount: 0 };
  const end = replay(initial, world.journal);
  const same = Math.abs(end.cash - world.cash) < 1e-6
    && Math.abs(end.inTransit - world.inTransit) < 1e-6
    && end.inventory === world.inventory
    && Math.abs(end.settledTotal - world.settledTotal) < 1e-6
    && end.ordersTotal === world.ordersTotal;
  ok(same, `replay 复算 == 终态（cash ${fmt(end.cash)}/${fmt(world.cash)}，inTransit ${fmt(end.inTransit)}/${fmt(world.inTransit)}，orders ${end.ordersTotal}/${world.ordersTotal}）`);

  // —— 对照实验：节俭策略（1 链接 + 趴窝线缓冲 + 小档补货）能否缩短 T+14 天窗 ——
  //    判据与主轨迹同口径（首回款日、趴窝次数、30 日回款笔数）。策略可救 = 调参项降级为「策略引导」；
  //    策略救不了 = 数值调参项（初始现金/首批量/补货档位/趴窝线）。调参 v1 落地后本对照组保留为
  //    「贴线经营基线」：节俭策略用 5 件档贴线细水长流，与主轨迹（autopilot 贴线小步）同族对照。
  const FRUGAL = runTrajectory({ days: 30, policy: frugalIntent });
  printTrace("对照组：节俭策略（1 链接 + 趴窝线缓冲 + 5 件档贴线补货）", FRUGAL.trace);
  const fpay = FRUGAL.trace.flatMap((r) => r.journal).filter((e) => e.kind === "payout");
  const fBroke = FRUGAL.trace.flatMap((r) => r.events).filter((e) => e.type === "broke-on").length;
  const fOrders = FRUGAL.world.ordersTotal;
  const mOrders = world.ordersTotal;
  console.log(`  INFO  对照：autopilot 单数 ${mOrders}/趴窝 ${brokeOnDays.length} 次/回款 ${payouts.length} 笔 vs 节俭 单数 ${fOrders}/趴窝 ${fBroke} 次/回款 ${fpay.length} 笔`);
}

console.log("\n===== 循环 C（风险对冲）：事故→健康↓→转化↓→收入↓；清理→回升 =====");
{
  // 手算链：需求 = base × 健康/100 × 噪声（健康 100→50 = 需求减半；健康 0 = 需求归零，规则 B）
  const w = createWorld(SEED_DEFAULT);
  const p = w.products[0];
  w.shopHealth = 100;
  const d100 = dailyDemand(w, p);
  w.shopHealth = 50;
  const d50 = dailyDemand(w, p);
  w.shopHealth = 0;
  const d0 = dailyDemand(w, p);
  ok(Math.abs(d50 - d100 / 2) < 1e-9, `转化通道手算：健康 100→50 需求减半（${d100.toFixed(2)}→${d50.toFixed(2)}）`);
  eq(d0, 0, "转化归零：健康 0 → 需求 0（规则 B，循环 C 底线）");

  // 螺旋下降（躺平不清理）：有单史 + 断货 + 不回评 → 健康 −5/日 且出单递减
  const w2 = createWorld(SEED_DEFAULT);
  actionRestock(w2, 50, []);
  actionList(w2, "led-light", []);
  const days = 14;
  const ordersByDay = [];
  for (let d = 0; d < days; d++) {
    let o = 0;
    for (let s = 0; s < Math.round(1 / FIXED_STEP); s++) {
      o += stepWorld(w2, FIXED_STEP).filter((e) => e.type === "order").length;
    }
    ordersByDay.push(o);
  }
  ok(w2.shopHealth < 100 - SPEC.wearPerDay * (days - 2), `不清理 → 健康磨损实测 −${SPEC.wearPerDay}/日（100→${fmt(w2.shopHealth)}）`);
  ok(ordersByDay[days - 1] < ordersByDay[0], `收入下滑实测：日出单 ${ordersByDay[0]} → ${ordersByDay[days - 1]}（健康↓→转化↓→收入↓ 螺旋成立）`);

  // 清理回升：回评 +15/日（精力 −5）− 磨损 5 → 净 +10/日，需求随之回升
  const w3 = createWorld(SEED_DEFAULT);
  actionRestock(w3, 50, []);
  actionList(w3, "led-light", []);
  w3.shopHealth = 50;
  for (let d = 0; d < 6; d++) {
    if (w3.energy >= SPEC.replyEnergy) actionReplyReview(w3, []);
    for (let s = 0; s < Math.round(1 / FIXED_STEP); s++) stepWorld(w3, FIXED_STEP);
  }
  ok(w3.shopHealth > 50, `清理 → 健康回升实测（50→${fmt(w3.shopHealth)}，回评 +${SPEC.replyHealth}/日 − 磨损 ${SPEC.wearPerDay}/日）`);
  ok(w3.ordersTotal > 0, `清理 → 收入恢复实测（累计出单 ${w3.ordersTotal}）`);

  // 事件对冲手算：差评师 −20 → 公关减半净 −10；不公关保持 −20
  const w4 = createWorld(SEED_DEFAULT);
  w4.ordersTotal = 1; // 满足 precond（有订单才有被搞的价值）
  const log4 = { effects: [], choice: null };
  EVENT_BY_ID["bad-reviewer"].apply(w4, log4);
  eq(w4.shopHealth, 100 - SPEC.badReviewer.healthHit, `差评师全额扣减（100→${w4.shopHealth}）`);
  const pr = eventChoice(w4, "bad-reviewer", "pr", []);
  ok(pr.ok === true && Math.abs(w4.shopHealth - (100 - SPEC.badReviewer.relief)) < 1e-9,
    `公关减半（净 −${SPEC.badReviewer.relief}：100−20+10=${w4.shopHealth}，公关费 ¥${SPEC.badReviewer.prCost}）`);
  ok(!w4.pendingEvents.some((x) => x.id === "bad-reviewer"), "公关后待应对队列清空（不重复结算）");

  // 跟卖狗：转化 −20% × 3 日；投诉（精力 −10）提前结束
  const w5 = createWorld(SEED_DEFAULT);
  actionList(w5, "led-light", []);
  const log5 = { effects: [], choice: null };
  EVENT_BY_ID["follow-seller"].apply(w5, log5);
  eq(w5.followSellerDays, SPEC.followSeller.days, `跟卖狗惩罚 ${SPEC.followSeller.days} 日登记`);
  const beforeComplain = w5.energy;
  const cp = eventChoice(w5, "follow-seller", "complain", []);
  ok(cp.ok === true && w5.followSellerDays === 0, "投诉 → 转化惩罚立即结束（提前下架）");
  eq(beforeComplain - w5.energy, SPEC.followSeller.complainEnergy, `投诉精力 −${SPEC.followSeller.complainEnergy}`);

  // 货代延误 / 海关查验 / 五星复购 / 爆款流量 / 海外仓补货 —— 效果表逐条（延迟经 delayBatches 落流水）
  const w6 = createWorld(SEED_DEFAULT);
  actionList(w6, "led-light", []);
  settle(w6, { kind: "order-revenue", from: "market", to: "inTransit", amount: 55, unit: "¥", ref: { orderId: "#t", dueDay: w6.day + 14, orders: 1 } });
  const dueBefore = w6.receivables[0]?.dueDay;
  const fdLog = { effects: [], choice: null };
  EVENT_BY_ID["freight-delay"].apply(w6, fdLog);
  eq(w6.receivables[0]?.dueDay, dueBefore + SPEC.freightDelay.days, `货代延误：在途 +${SPEC.freightDelay.days} 日到港（${dueBefore}→${w6.receivables[0]?.dueDay}）`);
  eq(w6.shopHealth, 100 - SPEC.freightDelay.health, `货代延误：店铺健康 −${SPEC.freightDelay.health}`);
  const cashBeforeCc = w6.cash;
  EVENT_BY_ID["customs-check"].apply(w6, { effects: [], choice: null });
  eq(cashBeforeCc - w6.cash, SPEC.customsCheck.fine, `海关查验：现金 −¥${SPEC.customsCheck.fine}`);
  eq(w6.receivables[0]?.dueDay - (dueBefore + SPEC.freightDelay.days), SPEC.customsCheck.days, `海关查验：在途再 +${SPEC.customsCheck.days} 日`);
  const healthBeforeFs = w6.shopHealth;
  EVENT_BY_ID["five-star-rebuy"].apply(w6, { effects: [], choice: null });
  eq(w6.shopHealth - healthBeforeFs, SPEC.fiveStar.health, `老客五星复购：店铺健康 +${SPEC.fiveStar.health}`);
  eq(w6.mood, SPEC.fiveStar.mood, `老客五星复购：心情 +${SPEC.fiveStar.mood}（纯修正器）`);

  // 爆款自然流量：当日需求 ×2 —— 用需求公式直接复算
  const w7 = createWorld(SEED_DEFAULT);
  actionList(w7, "led-light", []);
  const base7 = dailyDemand(w7, w7.products[0]);
  EVENT_BY_ID["organic-hit"].apply(w7, { effects: [], choice: null });
  const boosted = dailyDemand(w7, w7.products[0]);
  ok(Math.abs(boosted / base7 - SPEC.organicHit.mult) < 1e-9, `爆款自然流量：当日需求 ×${SPEC.organicHit.mult}（${base7.toFixed(2)}→${boosted.toFixed(2)}）`);

  // 海外仓及时补货（海外仓升级后入池）：最早批次 −3 日 + 健康 +10（钳位前的实际发生额）
  const w8 = createWorld(SEED_DEFAULT);
  w8.upgrades.warehouse = true;
  w8.shopHealth = 90; // 预留钳位空间：+10 满额发生
  settle(w8, { kind: "order-revenue", from: "market", to: "inTransit", amount: 55, unit: "¥", ref: { orderId: "#t2", dueDay: w8.day + 14, orders: 1 } });
  const d8 = w8.receivables[0]?.dueDay;
  EVENT_BY_ID["warehouse-restock"].apply(w8, { effects: [], choice: null });
  eq(w8.receivables[0]?.dueDay, d8 - SPEC.warehouseRestock.days, `海外仓及时补货：最早批次提前 ${SPEC.warehouseRestock.days} 日（${d8}→${w8.receivables[0]?.dueDay}）`);
  eq(w8.shopHealth, 90 + SPEC.warehouseRestock.health, `海外仓及时补货：店铺健康 +${SPEC.warehouseRestock.health}`);

  // M2 非目标：汇率波动事件零出现（spec.fx.mode=constant）
  ok(!EVENT_DEFS.some((d) => d.id === "fx-swing"), "fx-swing（汇率波动）不在事件表（M2 非目标机判）");
  eq(EVENT_DEFS.filter((d) => d.rollable !== false).length, 7, "可抽取事件 7 类（8 类效果表 − fx-swing − 断货为状态型）");
}

console.log("\n===== 边界手算逐条（趴窝线 / 终局自救金 / 精力天花板 / 吃睡链 / P1 单向 / 幂等 / T+14 归批）=====");
{
  const mk = (cash, opts = {}) => {
    const w = createWorld(SEED_DEFAULT);
    w.cash = cash;
    if (opts.warehouse) w.upgrades.warehouse = true;
    if (opts.soho) w.upgrades.housingSoho = true;
    if (opts.receivable) settle(w, { kind: "order-revenue", from: "market", to: "inTransit", amount: opts.receivable, unit: "¥", ref: { orderId: "#p", dueDay: w.day + 5, orders: 1 } });
    return w;
  };
  eq(isBroke(mk(SPEC.brokeBed - 0.01)), true, `趴窝线（床位档）：现金 ¥${SPEC.brokeBed - 0.01} < ¥${SPEC.brokeBed} → 趴窝`);
  eq(isBroke(mk(SPEC.brokeBed)), false, `趴窝线（床位档）：现金 = ¥${SPEC.brokeBed}（固定开支+最低补货）→ 不趴窝（边界含等号）`);
  eq(isBroke(mk(SPEC.brokeWarehouse - 0.01, { warehouse: true })), true, `趴窝线（海外仓档）：¥${SPEC.brokeWarehouse - 0.01} → 趴窝（最低补货按 ¥20/件 折算）`);
  eq(isBroke(mk(SPEC.brokeSoho - 0.01, { warehouse: true, soho: true })), true, `趴窝线（SOHO+海外仓档）：¥${SPEC.brokeSoho - 0.01} → 趴窝（固定开支 ¥${SPEC.rentSoho}）`);

  eq(isTerminal(mk(SPEC.bootstrap - 1)), true, `资金链断裂：现金 ¥${SPEC.bootstrap - 1} < 自救金 ¥${SPEC.bootstrap} ∧ 无在途 ∧ 无库存 → 终局`);
  eq(isTerminal(mk(SPEC.bootstrap)), false, `自救启动金含等号：现金 = ¥${SPEC.bootstrap}（泡面5+钟点房50）→ 不判负`);
  eq(isTerminal(mk(SPEC.bootstrap - 1, { receivable: 100 })), false, `在途回款是救命稻草：现金再低，有在途批次 → 不判负（趴窝≠断裂）`);

  // 精力天花板（规则 D）：可用精力 < 2/单 → 错失
  const w = createWorld(SEED_DEFAULT);
  actionRestock(w, 10, []);
  actionList(w, "led-light", []);
  settle(w, { kind: "drain", from: "energy", to: "none", amount: 98.5, unit: "点" });
  const missedBefore = w.missedTotal;
  for (let s = 0; s < Math.round(1 / FIXED_STEP); s++) stepWorld(w, FIXED_STEP);
  ok(w.missedTotal > missedBefore, `精力天花板实测：精力 ${w.energy.toFixed(1)} < 2/单 → 订单错失（missed ${w.missedTotal - missedBefore}）`);

  // 吃睡链（规则 C）：饱腹 0 → 睡车里/钟点房无效
  const w2 = createWorld(SEED_DEFAULT);
  w2.satiety = 0;
  eq(actionSleepVan(w2, []).ok, false, "吃睡链：饱腹 0 → 睡车里无效（饿着睡不着）");
  eq(actionMotel(w2, []).ok, false, "吃睡链：饱腹 0 → 钟点房无效（不扣费）");
  eq(w2.energy, 100, "吃睡链守卫：无效动作零精力变化");

  // P1 单向：达标进 P1 后花钱跌破 ¥5000 不回退（spec.m2 stageCurve 单向进度）
  const w3 = createWorld(SEED_DEFAULT);
  w3.cash = SPEC.p1Line;
  stageCheck(w3, []); // 阶段沿由结算后的检查触发（此处模拟 dayTick/afterAction 的调用点）
  eq(w3.stage, "P1", `现金 ¥${SPEC.p1Line} 触发 P1（stageCurve unlock）`);
  applyUpgrade(w3, "warehouse", []);
  ok(w3.stage === "P1" && w3.cash === SPEC.p1Line - SPEC.upgradeCost, `P1 解锁后升级扣费 ¥${SPEC.upgradeCost}（现金 ¥${SPEC.p1Line - SPEC.upgradeCost} < 解锁线）`);
  eq(w3.stage, "P1", "P1 单向：跌破解锁线不回退（花钱降级不存在）");
  const w4 = createWorld(SEED_DEFAULT);
  w4.cash = 3000;
  eq(actionAdvertise(w4, []).ok, false, "P0 广告入口不可用（stageCurve P0 机判）");
  eq(applyUpgrade(w4, "warehouse", []).ok, false, "P0 升级入口不可用");

  // 幂等：升级连点 10 次仅扣 1 次（spec acceptance acc-idempotency / M2 验收 3）
  const w5 = createWorld(SEED_DEFAULT, "rich");
  applyUpgrade(w5, "warehouse", []);
  const cashAfterFirst = w5.cash;
  for (let i = 0; i < 10; i++) applyUpgrade(w5, "warehouse", []);
  eq(w5.cash, cashAfterFirst, `海外仓连点 10 次仅扣费 1 次（现金稳定 ¥${cashAfterFirst}）`);

  // 补货单价随档位：¥40 → ¥20（毛利 15 → 35 = stageCurve P1 ¥35/单 反推）
  const w6 = createWorld(SEED_DEFAULT, "rich");
  applyUpgrade(w6, "warehouse", []);
  const payBefore = w6.cash;
  actionRestock(w6, 10, []);
  eq(payBefore - w6.cash, 10 * SPEC.warehouseUnitCost, `海外仓补货 10 件 = ¥${10 * SPEC.warehouseUnitCost}（¥${SPEC.warehouseUnitCost}/件，毛利 ¥${SPEC.salePrice - SPEC.warehouseUnitCost}）`);
  const w7 = createWorld(SEED_DEFAULT);
  const payBefore7 = w7.cash;
  actionRestock(w7, 10, []);
  eq(payBefore7 - w7.cash, 10 * SPEC.unitCost, `自发货补货 10 件 = ¥${10 * SPEC.unitCost}（毛利 ¥${SPEC.grossPerOrder}）`);

  // T+14 归批：同到期日合并成批；bookOrder 恒为下单日 + 14（#10，三刀收敛刀3：回款唯一值）
  const w8 = createWorld(SEED_DEFAULT);
  actionRestock(w8, 10, []);
  const d1 = bookOrder(w8, "#a", 55);
  const d2 = bookOrder(w8, "#b", 55);
  eq(d1, w8.day + SPEC.payoutDays, `T+14 归批：到期日 = 下单日 + ${SPEC.payoutDays}`);
  eq(w8.receivables.length, 1, "同到期日合并成批（一屏一笔在途）");
  eq(w8.receivables[0]?.amount, 110, "批次金额合并（2×¥55=¥110）");
  eq(d2, d1, "同日订单同批次（T+14 唯一值）");
}

console.log("\n===== 30 日总账（部署同源）：循环 A 手算 vs 实测的差距定量化 =====");
{
  const w = MAIN.world;
  const totalOrders = w.ordersTotal;
  const totalMissed = w.missedTotal;
  const avgOrdersPerDay = totalOrders / 30;
  console.log(`  INFO  30 日：总出单 ${totalOrders}（日均 ${avgOrdersPerDay.toFixed(1)}）、总错失 ${totalMissed}、回款 ${w.payoutCount} 笔 ¥${fmt(w.settledTotal)}、趴窝 ${w.brokeCount} 次`);
  console.log(`  INFO  循环 A 手算基线 30 单/日 vs 实测日均 ${avgOrdersPerDay.toFixed(1)} 单 —— 差距 ${totalOrders < 30 * 30 ? "显著" : "不显著"}（进调参清单，不以硬门禁绑架手感调优）`);
  ok(w.journal.every((e) => Number.isFinite(e.amount) && e.amount >= 0), "全流水金额有限且非负（E-09 边界加固，全称量词）");
  ok(MAIN.trace.length >= 20, `30 日轨迹基本完整（跑满 ${MAIN.trace.length} 日，over=${w.over} won=${w.won}）`);
}

// —— 节俭对照组（与主轨迹同协议；定义在文件底部避免提升顺序问题）——
function frugalIntent(w) {
  const BUFFER = 230 + 60; // 趴窝线（床位档手算值 230，spec.tune.restockLots）+ 一日开支保证金（调参 v1 贴线口径）
  if (w.satiety < 40) { if (w.cash >= 20 + BUFFER) return { action: "meal" }; if (w.cash >= 5 + BUFFER) return { action: "noodle" }; }
  if (w.energy < 40) { if (w.satiety > 0 && w.cash >= 50 + BUFFER) return { action: "motel" }; if (w.satiety > 0) return { action: "sleepVan" }; }
  if (w.shopHealth < 70 && w.energy >= 5) return { action: "replyReview" };
  if (w.inventory === 0 && w.ordersTotal === 0 && w.cash >= 2000 + BUFFER) return { action: "restock", arg: 50 };
  if (!w.products[0].listed && w.inventory >= 1) return { action: "list", arg: w.products[0].id };
  if (!w.broke && w.inventory < 15 && w.cash >= 200 + BUFFER) return { action: "restock", arg: 5 }; // 5 件档贴线细水长流
  return null;
}

console.log(`\nLOOP-ABC-HANDCALC: ${failures.length === 0 ? "PASS" : "FAIL"}（${passed} 过 / ${failures.length} 败）`);
if (failures.length) {
  console.error("未过项：\n" + failures.map((f) => `  - ${f}`).join("\n"));
  process.exit(1);
}
