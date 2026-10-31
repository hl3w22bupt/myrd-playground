#!/usr/bin/env node
// events.spec.mjs — M2 事件流契约（M2 验收 1「覆盖与留痕」+ 验收 2「统一结算」的机判）：
// ① 覆盖：默认 seed 新档自动驾驶 ≥10 游戏日，≥6 类事件触发（奇葩与暖心两类均有）；
// ② 效果值逐条一致：事件结算侧 journal 发生额与 spec.numeric.events 效果表对号（误差 0）；
// ③ 统一结算：对局后资源快照 = 流水重放（事件增减无一绕过结算入口）；
// ④ 差评师公关可复现：未公关全额 −20；窗口内 ¥50+5 精力公关 → 净 −10（prEffect=halve）；
// ⑤ 弹窗期间每日结算不跳变：决策卡打开（paused 语义）内核零推进；
// ⑥ 未开张不触发经营事件（?case=broke 存档天然安静）；
// ⑦ 暂停态决策卡落账：「知道了/投诉」在 paused 态经唯一入口受理（弹窗暂停语义下的豁免），
//    商业动作 paused / eventChoice 在 title、gameover 态仍拒绝（线上 P0 弹窗软锁死的内核回归）。
import { createGame } from "../src/kernel/loop.js";
import { bizIntent } from "../src/kernel/autopilot.js";
import { replay, initialSnapshotOf } from "../src/kernel/ledger.js";
import { createWorld } from "../src/kernel/world.js";
import { EVENT_DEFS } from "../src/kernel/events.js";
import { settle } from "../src/kernel/ledger.js";
import {
  SEED_DEFAULT, BAD_REVIEWER_HEALTH_HIT, BAD_REVIEWER_PR_COST, BAD_REVIEWER_PR_ENERGY,
  FREIGHT_DELAY_DAYS, FREIGHT_DELAY_HEALTH, CUSTOMS_CHECK_FINE, CUSTOMS_CHECK_DELAY_DAYS,
  FIVE_STAR_HEALTH, PEAK_STOCKOUT_HEALTH_PER_DAY, FOLLOW_SELLER_DAYS, FOLLOW_SELLER_COMPLAIN_ENERGY,
  SESSION_DAYS,
} from "../src/numeric.js";

const failures = [];
const ok = (cond, m) => { console.log(`  ${cond ? "PASS" : "FAIL"}  ${m}`); if (!cond) failures.push(m); };

/** 默认 seed 新档自动驾驶：每日「派发到无动作 → 快进 1 天」（与冒烟协议同一条真实玩家路径） */
const play = (days, scenario = "fresh") => {
  const g = createGame({ seed: SEED_DEFAULT, scenario });
  g.start();
  for (let d = 0; d < days && g.state === "playing"; d++) {
    for (let k = 0; k < 12; k++) {
      const intent = bizIntent(g.world);
      if (!intent) break;
      g.dispatch(intent.action, intent.arg);
    }
    g.fastForward(1);
  }
  return g;
};

// —— ① 覆盖：≥10 游戏日 ≥6 类，奇葩与暖心均有 ——
{
  const g = play(12);
  const w = g.world;
  const kinds = [...new Set(w.eventLog.map((e) => e.id))];
  const moods = new Set(kinds.map((id) => w.eventLog.find((e) => e.id === id).moodKind));
  ok(w.day >= 11, `连续游玩 ${w.day - 1} 游戏日（≥10）`);
  ok(kinds.length >= 6, `触发 ${kinds.length} 类事件（≥6）：${kinds.join("、")}`);
  ok(moods.has("bad") && moods.has("good"), "奇葩与暖心两类均有触发");
  // 留痕：每条事件流水带事件名/游戏日/效果值
  const traced = w.eventLog.filter((e) => e.name && e.day >= 1 && Array.isArray(e.effects));
  ok(traced.length === w.eventLog.length, `事件流水 ${traced.length} 条全带（事件名/游戏日/效果值）留痕`);
  // 结算侧留痕：每条效果值在资金/资源 journal 里有对应发生额（乘数型需求/心情效果除外）
  const kinds2 = new Set(w.journal.filter((e) => e.kind.startsWith("event-")).map((e) => e.ref?.eventId));
  ok(kinds2.size >= 4, `事件结算侧 journal 覆盖 ${kinds2.size} 类事件的资源去向（kind= event-*，ref.eventId 可追溯）`);
}

// —— ② 效果值逐条一致（结算侧发生额 = spec.numeric.events 效果表）——
{
  const g = play(30);
  const w = g.world;
  const j = (kind) => w.journal.filter((e) => e.kind === kind);
  const br = j("event-bad-review");
  if (br.length > 0) ok(br.every((e) => e.amount === BAD_REVIEWER_HEALTH_HIT), `差评师全额扣减 ${BAD_REVIEWER_HEALTH_HIT}（${br.length} 次逐条一致）`);
  const pr = j("event-pr-relief");
  if (pr.length > 0) ok(pr.every((e) => e.amount === BAD_REVIEWER_HEALTH_HIT / 2), `公关减半返还 ${BAD_REVIEWER_HEALTH_HIT / 2}（prEffect=halve 逐条一致）`);
  const fd = j("event-freight-delay");
  if (fd.length > 0) ok(fd.every((e) => e.amount === FREIGHT_DELAY_HEALTH), `货代延误店铺健康 −${FREIGHT_DELAY_HEALTH}（逐条一致）`);
  const fdShift = j("payout-delay").filter((e) => e.ref?.eventId === "freight-delay");
  if (fdShift.length > 0) ok(fdShift.every((e) => e.ref.days === FREIGHT_DELAY_DAYS && e.unit === "日"), `货代延误在途 +${FREIGHT_DELAY_DAYS} 日（${fdShift.length} 次逐条一致，批次平移全落流水）`);
  const cc = j("event-customs-fine");
  if (cc.length > 0) ok(cc.every((e) => e.amount === Math.min(CUSTOMS_CHECK_FINE, e.amount)) && cc.every((e) => e.from === "cash" && e.to === "expense"), `海关查验现金 −¥${CUSTOMS_CHECK_FINE}（${cc.length} 次按实际发生额，逐条可复算）`);
  const ccShift = j("payout-delay").filter((e) => e.ref?.eventId === "customs-check");
  if (ccShift.length > 0) ok(ccShift.every((e) => e.ref.days === CUSTOMS_CHECK_DELAY_DAYS), `海关查验在途 +${CUSTOMS_CHECK_DELAY_DAYS} 日（逐条一致）`);
  const fs = j("event-five-star");
  if (fs.length > 0) ok(fs.every((e) => e.amount === FIVE_STAR_HEALTH && e.to === "shopHealth"), `老客五星复购店铺健康 +${FIVE_STAR_HEALTH}（逐条一致）`);
  const so = j("event-stockout");
  if (so.length > 0) ok(so.every((e) => e.amount === PEAK_STOCKOUT_HEALTH_PER_DAY), `旺季断货每游戏日店铺健康 −${PEAK_STOCKOUT_HEALTH_PER_DAY}（${so.length} 日逐条一致）`);
  // 跟卖狗：转化惩罚持续期与投诉提前下架
  const fl = w.eventLog.filter((e) => e.id === "follow-seller");
  if (fl.length > 0) ok(fl.every((e) => e.effects.some((x) => x.account === "demand" && x.amount === -20)), `跟卖狗转化 −20%（${fl.length} 次效果声明一致）`);
  const complained = fl.filter((e) => e.choice === "complain");
  if (complained.length > 0) ok(j("event-complain").every((e) => e.amount >= 1), `投诉提前下架（${complained.length} 次落地，精力经结算入口扣减）`);
  // 爆款自然流量：效果声明 ×2 + 广告费返还经结算入口
  const oh = w.eventLog.filter((e) => e.id === "organic-hit");
  if (oh.length > 0) ok(oh.every((e) => e.effects.some((x) => x.account === "demand" && x.amount === 2)), `爆款自然流量当日订单 ×2（${oh.length} 次效果声明一致）`);
  ok(!w.eventLog.some((e) => e.id === "fx-swing"), "汇率波动事件零出现（spec.fx.mode=constant，M2 非目标）");
}

// —— ③ 统一结算：整局快照 = 流水重放（事件增减无一绕过入口）——
{
  const g = play(30);
  const w = g.world;
  const w0 = createWorld(w.seed, w.scenario);
  const rep = replay(initialSnapshotOf(w0), w.journal);
  const diff = Object.keys(rep).filter((k) => JSON.stringify(rep[k]) !== JSON.stringify(w[k]));
  ok(diff.length === 0, diff.length === 0
    ? `含事件流整局资源快照与流水重放逐字段一致（journal ${w.journal.length} 条）`
    : `重放失配：${diff.join(", ")}`);
}

// —— ④ 差评师公关机制可复现（构造事件，验收 2 口径）——
{
  const g = createGame({ seed: SEED_DEFAULT });
  g.start();
  const w = g.world; // 与 game 同一个 world（构造事件必须落在对局世界里）
  const def = EVENT_DEFS.find((d) => d.id === "bad-reviewer");
  const log = { day: w.day, id: def.id, name: def.name, moodKind: def.mood, effects: [], choice: null };
  w.eventLog.push(log);
  def.apply(w, log);
  const healthAfterHit = w.shopHealth;
  ok(100 - healthAfterHit === BAD_REVIEWER_HEALTH_HIT, `触发即全额：店铺健康 100 → ${healthAfterHit}（−${BAD_REVIEWER_HEALTH_HIT}）`);
  // 窗口外公关被拒（deadline = 触发日 + 1 游戏日）
  w.day += 5;
  const refused = g.dispatch("eventChoice", { id: "bad-reviewer", choice: "pr" });
  ok(refused.length === 0, "公关窗口（24h = 1 游戏日）外公关被拒");
  w.day -= 5;
  // 窗口内公关：¥50 + 5 精力 → 减半返还
  w.cash = 1000;
  w.energy = 100;
  const cashBefore = w.cash, energyBefore = w.energy;
  const done = g.dispatch("eventChoice", { id: "bad-reviewer", choice: "pr" });
  const netHealth = 100 - w.shopHealth; // 公关返还后净扣（相对触发前的满血基准）
  ok(done.length > 0 && netHealth === BAD_REVIEWER_HEALTH_HIT / 2, `窗口内公关减半：净扣 ${netHealth}（${BAD_REVIEWER_HEALTH_HIT} − 返还 ${BAD_REVIEWER_HEALTH_HIT / 2}）`);
  ok(w.cash === cashBefore - BAD_REVIEWER_PR_COST, `公关花费 ¥${BAD_REVIEWER_PR_COST}（${cashBefore} → ${w.cash}）`);
  ok(w.energy === energyBefore - BAD_REVIEWER_PR_ENERGY, `公关耗神 ${BAD_REVIEWER_PR_ENERGY}（${energyBefore} → ${w.energy}）`);
  ok(w.pendingEvents.length === 0 && log.choice === "pr", "应对后队列清空、事件流水标记 pr");
  // 精力不足时公关被拒且不扣费
  const log2 = { day: w.day, id: def.id, name: def.name, moodKind: def.mood, effects: [], choice: null };
  w.eventLog.push(log2);
  def.apply(w, log2);
  w.energy = 1;
  const cash0 = w.cash;
  ok(g.dispatch("eventChoice", { id: "bad-reviewer", choice: "pr" }).length === 0 && w.cash === cash0, "精力不足公关被拒（现金分文不动）");
  // settle 拒绝非法：防御性 sanity（入口不变）
  let threw = 0;
  try { settle(w, { kind: "x", from: "shopHealth", to: "none", amount: -1 }); } catch { threw++; }
  ok(threw === 1, "结算入口仍拒绝负数金额（事件无特权路径）");
}

// —— ⑤ 弹窗期间每日结算不跳变（决策卡打开 = paused 语义）——
{
  const g = createGame({ seed: SEED_DEFAULT });
  g.start();
  const w = g.world;
  const def = EVENT_DEFS.find((d) => d.id === "bad-reviewer");
  const log = { day: w.day, id: def.id, name: def.name, moodKind: def.mood, effects: [], choice: null };
  w.eventLog.push(log);
  def.apply(w, log);
  g.pause(); // 表现层打开决策卡时的唯一动作
  const snap = JSON.stringify({ d: w.day, c: w.cash, h: w.shopHealth, j: w.journal.length });
  const r = g.tick(0.5);
  const snap2 = JSON.stringify({ d: w.day, c: w.cash, h: w.shopHealth, j: w.journal.length });
  ok(snap === snap2 && r.stepped === 0, "事件弹窗打开期间 tick 零推进（每日结算不跳变）");
  g.resume();
  ok(g.tick(0.5).stepped > 0, "弹窗关闭恢复后推进如常");
}

// —— ⑥ 未开张不触发经营事件（事件全部晚于首次上架；?case=broke 解除趴窝开张前保持安静）——
{
  const g = play(8, "broke");
  const w = g.world;
  const firstListedDay = w.journal.find((e) => e.kind === "restock-pay")?.day ?? Infinity;
  const beforeOpen = w.eventLog.filter((e) => e.day < firstListedDay);
  ok(beforeOpen.length === 0, `趴窝存档开张前（首批补货 D${firstListedDay === Infinity ? "—" : firstListedDay}）零经营事件（${beforeOpen.length} 条，在营链接前置生效）`);
}

// —— ⑦ 暂停态决策卡落账（线上 P0「知道了/投诉点了没反应」的内核回归）：
// 决策卡「打开即暂停」（main.js processPendingEvents 弹卡前 game.pause()），玩家点按钮时 state=paused ——
// dispatch 守卫若不放行 eventChoice，pendingEvents 残留 → closeModal → resumeAfterModal → 同一张卡立刻弹回
// （同步死循环，用户观感 = 点了没反应，整局软锁死）。豁免仅限 eventChoice，其余商业动作 paused 仍拒绝。
{
  const g = createGame({ seed: SEED_DEFAULT });
  g.start();
  const w = g.world;
  const def = EVENT_DEFS.find((d) => d.id === "follow-seller");
  const trigger = () => {
    const log = { day: w.day, id: def.id, name: def.name, moodKind: def.mood, effects: [], choice: null };
    w.eventLog.push(log);
    def.apply(w, log); // 真实触发路径：转化惩罚 + pendingEvents 入队（与每日抽取同一落点）
    g.pause();         // 表现层打开决策卡时的唯一动作（弹窗暂停语义）
    return log;
  };
  // 「知道了」= dismiss：暂停态必须落账（队列清空 + 返回事件流），修复前返回 [] 且队列残留
  const log1 = trigger();
  const energy0 = w.energy;
  const evs = g.dispatch("eventChoice", { id: "follow-seller", choice: "dismiss" });
  ok(evs.length > 0, "暂停态「知道了」被受理（返回事件流非空）");
  ok(w.pendingEvents.length === 0 && log1.choice === "dismiss", `暂停态「知道了」落账：队列清空（残留 ${w.pendingEvents.length} 条即弹回死循环）+ 流水标记 dismiss`);
  ok(w.energy === energy0, "dismiss 不扣资源");
  // 「投诉」= complain：暂停态经唯一入口落账（精力 −10 经结算入口 + 提前下架）
  const log2 = trigger();
  const energy1 = w.energy;
  const evs2 = g.dispatch("eventChoice", { id: "follow-seller", choice: "complain" });
  ok(evs2.length > 0 && w.pendingEvents.length === 0 && log2.choice === "complain",
    `暂停态「${def.counterLabel}」落账：队列清空 + 流水标记 complain`);
  ok(energy1 - w.energy === FOLLOW_SELLER_COMPLAIN_ENERGY && w.followSellerDays === 0,
    `投诉扣精力 ${FOLLOW_SELLER_COMPLAIN_ENERGY}（${energy1} → ${w.energy}）且转化惩罚立即结束（followSellerDays=0）`);
  // 豁免不放宽：paused 态其余商业动作 / title、gameover 态 eventChoice 一律拒绝
  ok(g.dispatch("noodle").length === 0 && g.dispatch("restock", 10).length === 0, "paused 态商业动作仍拒绝（豁免仅 eventChoice）");
  const g2 = createGame({ seed: SEED_DEFAULT });
  const logT = { day: 1, id: def.id, name: def.name, moodKind: def.mood, effects: [], choice: null };
  g2.world.eventLog.push(logT);
  def.apply(g2.world, logT); // title 态预置队列
  ok(g2.dispatch("eventChoice", { id: "follow-seller", choice: "dismiss" }).length === 0 && g2.world.pendingEvents.length === 1,
    "title 态 eventChoice 仍拒绝（队列不动）");
  const g3 = createGame({ seed: SEED_DEFAULT });
  g3.start();
  g3.fastForward(SESSION_DAYS + 1);
  ok(g3.state === "gameover" && g3.dispatch("eventChoice", { id: "follow-seller", choice: "dismiss" }).length === 0,
    "gameover 态 eventChoice 仍拒绝（world.over 全局守卫不豁免）");
}

console.log(failures.length ? `EVENTS: FAIL（${failures.length}）` : "EVENTS: PASS");
process.exit(failures.length ? 1 : 0);
