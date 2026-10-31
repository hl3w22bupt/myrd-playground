// events.js — 事件流引擎（M2）：奇葩/暖心事件定义表 + 每日调度 + 统一结算入口落账。
// 数值唯一来源：spec.numeric.events 8 类事件效果表（本文件零魔数，全经 numeric.js M2 段）。
// 纯内核：零 three / 零 DOM / 零系统随机（唯一随机源 = w.rng）/ 零时钟（Node 可直接跑）。
// 铁律：事件对三资源的增减一律经 ledger.settle()，批次平移一律经 ledger.delayBatches()（落流水可重放）；
//       心情（spec.resources.mood kind=event-modifier）不是结算资源 —— 只经事件写入并留痕，作需求乘数。
import { settle, delayBatches } from "./ledger.js";
import {
  EVENT_CHANCE_PER_DAY, EVENT_COOLDOWN_DAYS, GOOD_EVENT_WEIGHT, EVENT_MIN_LISTED,
  FOLLOW_SELLER_DEMAND_FACTOR, FOLLOW_SELLER_DAYS, FOLLOW_SELLER_COMPLAIN_ENERGY,
  BAD_REVIEWER_HEALTH_HIT, BAD_REVIEWER_PR_COST, BAD_REVIEWER_PR_ENERGY, BAD_REVIEWER_PR_WINDOW_DAYS,
  FREIGHT_DELAY_DAYS, FREIGHT_DELAY_HEALTH,
  CUSTOMS_CHECK_FINE, CUSTOMS_CHECK_DELAY_DAYS,
  PEAK_STOCKOUT_HEALTH_PER_DAY,
  FIVE_STAR_HEALTH, FIVE_STAR_MOOD,
  ORGANIC_HIT_DEMAND_MULT,
  WAREHOUSE_RESTOCK_DAYS, WAREHOUSE_RESTOCK_HEALTH,
  MOOD_CLAMP, EVENT_IDS_SHELVED_WHEN_BROKE,
} from "../numeric.js";

/** 在营链接数（事件触发前置：未开店 = 无经营事件） */
export const listedCount = (w) => w.products.filter((p) => p.listed).length;

const clampMood = (v) => Math.max(-MOOD_CLAMP, Math.min(MOOD_CLAMP, v));

/** 心情写入（事件修正器专用通道；非结算资源，留痕在事件流水） */
export function shiftMood(w, delta) {
  w.mood = clampMood(w.mood + delta);
  return w.mood;
}

/** 事件流水留痕（M2 验收 1：事件名、游戏日、效果值、资源去向） */
function logEvent(w, def, effects) {
  const log = { day: w.day, id: def.id, name: def.name, moodKind: def.mood, effects, choice: null };
  w.eventLog.push(log);
  return log;
}

// —————————————————— 8 类事件定义（spec.numeric.events 逐条对号，误差 0）——————————————————
// weight：抽取权重（奇葩 1.0 / 暖心 GOOD_EVENT_WEIGHT）；modal：需要玩家决策（挂 pendingEvents 弹窗应对）。
export const EVENT_DEFS = [
  {
    id: "follow-seller", name: "跟卖狗", mood: "bad", weight: 1.0, modal: true,
    desc: "有卖家盯上了你的链接，价格战一触即发。",
    detail: `转化率 −20% 持续 ${FOLLOW_SELLER_DAYS} 游戏日`,
    precond: (w) => listedCount(w) >= 1,
    apply(w, log) {
      w.followSellerDays = FOLLOW_SELLER_DAYS;
      log.effects.push({ account: "demand", amount: -20, unit: "%", note: `转化率 −20% × ${FOLLOW_SELLER_DAYS} 日` });
      w.pendingEvents.push({ id: this.id, name: this.name, day: w.day, deadline: Infinity, log, choice: null });
    },
    counterLabel: `投诉（精力 −${FOLLOW_SELLER_COMPLAIN_ENERGY}，提前下架）`,
    counter: (w) => w.energy >= FOLLOW_SELLER_COMPLAIN_ENERGY,
  },
  {
    id: "bad-reviewer", name: "差评师", mood: "bad", weight: 1.0, modal: true,
    desc: "职业差评师找上门，店铺健康眼看要崩。",
    detail: `店铺健康 −${BAD_REVIEWER_HEALTH_HIT}；${BAD_REVIEWER_PR_WINDOW_DAYS * 24}h 内花 ¥${BAD_REVIEWER_PR_COST}+${BAD_REVIEWER_PR_ENERGY} 精力公关则减半`,
    precond: (w) => w.ordersTotal >= 1, // 有订单才有被搞的价值
    apply(w, log) {
      const hit = settle(w, { kind: "event-bad-review", from: "shopHealth", to: "none", amount: BAD_REVIEWER_HEALTH_HIT, unit: "点", ref: { eventId: this.id } });
      if (hit) log.effects.push({ account: "shopHealth", amount: -hit.amount, unit: "点", note: "差评冲击（全额）" });
      // 触发即全额扣减（流水可复算）；窗口内公关 → 返还实际发生额的一半（prEffect=halve 的「减半」）
      w.pendingEvents.push({ id: this.id, name: this.name, day: w.day, deadline: w.day + BAD_REVIEWER_PR_WINDOW_DAYS, baseHit: hit?.amount ?? 0, log, choice: null });
    },
    counterLabel: `公关（¥${BAD_REVIEWER_PR_COST} + 精力 ${BAD_REVIEWER_PR_ENERGY}，减半返还）`,
    counter: (w, pe) => w.day + w.dayProgress < pe.deadline && w.cash >= BAD_REVIEWER_PR_COST && w.energy >= BAD_REVIEWER_PR_ENERGY,
  },
  {
    id: "freight-delay", name: "货代延误", mood: "bad", weight: 1.0, modal: false,
    desc: "货代舱位爆了，你的在途货款又被多压了几天。",
    detail: `在途批次 +${FREIGHT_DELAY_DAYS} 游戏日到港，店铺健康 −${FREIGHT_DELAY_HEALTH}`,
    precond: (w) => w.receivables.length >= 1,
    apply(w, log) {
      const shifts = delayBatches(w, FREIGHT_DELAY_DAYS, { eventId: this.id });
      if (shifts.length > 0) log.effects.push({ account: "inTransit", amount: FREIGHT_DELAY_DAYS, unit: "日", note: `在途批次 +${FREIGHT_DELAY_DAYS} 日到港（${shifts.length} 批）` });
      const hit = settle(w, { kind: "event-freight-delay", from: "shopHealth", to: "none", amount: FREIGHT_DELAY_HEALTH, unit: "点", ref: { eventId: this.id } });
      if (hit) log.effects.push({ account: "shopHealth", amount: -hit.amount, unit: "点", note: "延误差评缠身" });
    },
  },
  {
    id: "customs-check", name: "海关查验", mood: "bad", weight: 1.0, modal: false,
    desc: "包裹被海关抽查，查验费与滞留一起来了。",
    detail: `现金 −¥${CUSTOMS_CHECK_FINE}，在途批次 +${CUSTOMS_CHECK_DELAY_DAYS} 游戏日`,
    precond: (w) => w.receivables.length >= 1,
    apply(w, log) {
      const fine = settle(w, { kind: "event-customs-fine", from: "cash", to: "expense", amount: CUSTOMS_CHECK_FINE, unit: "¥", ref: { eventId: this.id } });
      if (fine) log.effects.push({ account: "cash", amount: -fine.amount, unit: "¥", note: "查验费用（余额不足按实际发生额）" });
      const shifts = delayBatches(w, CUSTOMS_CHECK_DELAY_DAYS, { eventId: this.id });
      if (shifts.length > 0) log.effects.push({ account: "inTransit", amount: CUSTOMS_CHECK_DELAY_DAYS, unit: "日", note: `在途批次 +${CUSTOMS_CHECK_DELAY_DAYS} 日滞留（${shifts.length} 批）` });
    },
  },
  {
    id: "five-star-rebuy", name: "老客五星复购", mood: "good", weight: GOOD_EVENT_WEIGHT, modal: false,
    desc: "老客户带着五星好评回来了，店铺口碑上涨。",
    detail: `店铺健康 +${FIVE_STAR_HEALTH}，心情 +${FIVE_STAR_MOOD}`,
    precond: (w) => w.ordersTotal >= 1,
    apply(w, log) {
      const got = settle(w, { kind: "event-five-star", from: "none", to: "shopHealth", amount: FIVE_STAR_HEALTH, unit: "点", ref: { eventId: this.id } });
      if (got) log.effects.push({ account: "shopHealth", amount: got.amount, unit: "点", note: "五星好评养店（上限内实际发生额）" });
      log.effects.push({ account: "mood", amount: FIVE_STAR_MOOD, unit: "点", note: `心情修正器 → ${shiftMood(w, FIVE_STAR_MOOD)}` });
    },
  },
  {
    id: "organic-hit", name: "爆款自然流量", mood: "good", weight: GOOD_EVENT_WEIGHT, modal: false,
    desc: "一条视频带火了你的链接，订单涌进来了。",
    detail: "当日订单 ×2，当日已投广告费全额返还",
    precond: (w) => listedCount(w) >= 1,
    apply(w, log) {
      w.organicToday = true;
      log.effects.push({ account: "demand", amount: ORGANIC_HIT_DEMAND_MULT, unit: "×", note: "当日需求 ×2" });
      if (w.adSpendToday > 0) {
        const back = settle(w, { kind: "event-ad-refund", from: "market", to: "cash", amount: w.adSpendToday, unit: "¥", ref: { eventId: this.id } });
        if (back) log.effects.push({ account: "cash", amount: back.amount, unit: "¥", note: "当日广告费返还" });
      }
    },
  },
  {
    id: "warehouse-restock", name: "海外仓及时补货", mood: "good", weight: GOOD_EVENT_WEIGHT, modal: false,
    desc: "海外仓库存兜住了断货风险，货物提前到港。",
    detail: `最早在途批次提前 ${WAREHOUSE_RESTOCK_DAYS} 游戏日到港，店铺健康 +${WAREHOUSE_RESTOCK_HEALTH}`,
    precond: (w) => w.upgrades.warehouse === true && w.receivables.length >= 1, // 海外仓升级后入池（P1 新解锁项）
    apply(w, log) {
      const shifts = delayBatches(w, -WAREHOUSE_RESTOCK_DAYS, { eventId: this.id });
      if (shifts.length > 0) log.effects.push({ account: "inTransit", amount: -WAREHOUSE_RESTOCK_DAYS, unit: "日", note: `最早在途批次提前 ${WAREHOUSE_RESTOCK_DAYS} 日到港（${shifts.length} 批）` });
      const got = settle(w, { kind: "event-warehouse-restock", from: "none", to: "shopHealth", amount: WAREHOUSE_RESTOCK_HEALTH, unit: "点", ref: { eventId: this.id } });
      if (got) log.effects.push({ account: "shopHealth", amount: got.amount, unit: "点", note: "供货顺畅养店（上限内实际发生额）" });
    },
  },
  {
    id: "peak-stockout", name: "旺季断货", mood: "bad", weight: 0, rollable: false, // 状态型：不进 roll 池，stockoutCheck 每日检查
    desc: "爆单期库存见底，订单眼睁睁错失，差评跟着来。",
    detail: `库存归零期间每游戏日店铺健康 −${PEAK_STOCKOUT_HEALTH_PER_DAY}（补货即解除）`,
    precond: () => false,
    apply() {},
  },
  // 注：spec.numeric.events 里的汇率波动事件 M2 不进定义表 —— spec.fx.mode=constant（P2 才降级为波动事件），
  // M2 非目标明确「汇率波动事件不进 M2」，汇率恒为 7.0（numeric.FX_USD_CNY）。
];

export const EVENT_BY_ID = Object.freeze(Object.fromEntries(EVENT_DEFS.map((d) => [d.id, d])));

/** 单事件触发：apply + 冷却登记 + 事件总线（表现层弹窗用） */
function fire(w, def, events) {
  const log = logEvent(w, def, []);
  def.apply(w, log);
  w.eventCooldown[def.id] = w.day + EVENT_COOLDOWN_DAYS;
  events.push({ type: "game-event", id: def.id, name: def.name, mood: def.mood, day: w.day, modal: def.modal === true, log });
}

/**
 * 每日事件判定（dayTick 调用，一游戏日至多一次）：前置（在营链接）→ 概率 → 合格池（冷却 + 各自前置
 * + 趴窝期剔除延误类，spec.tune.eventCadenceTune：趴窝已是最低点，再压救命钱只产生挫败不产生张力）→ 加权抽取。
 * 随机全部走 w.rng（内核唯一随机源）；抽取帧数不定，但序列仍是确定性的。
 */
export function dailyEventRoll(w, events) {
  if (w.over) return;
  if (listedCount(w) < EVENT_MIN_LISTED) return;
  if (w.rng() >= EVENT_CHANCE_PER_DAY) return;
  const pool = EVENT_DEFS.filter((d) => d.rollable !== false
    && (w.eventCooldown[d.id] ?? 0) <= w.day
    && d.precond(w)
    && !(w.broke && EVENT_IDS_SHELVED_WHEN_BROKE.includes(d.id)));
  if (pool.length === 0) return;
  const total = pool.reduce((s, d) => s + d.weight, 0);
  let r = w.rng() * total;
  let picked = pool[pool.length - 1];
  for (const d of pool) {
    r -= d.weight;
    if (r < 0) { picked = d; break; }
  }
  fire(w, picked, events);
}

/**
 * 旺季断货（状态型，M2 每日结算检查）：爆单期（有订单史 ∧ 有链接在营）库存归零 →
 * 每游戏日错失订单（出单管线天然行为）且店铺健康 −5；首次进入弹窗，补货即解除。
 */
export function stockoutCheck(w, events) {
  if (w.over) return;
  const active = listedCount(w) >= 1 && w.ordersTotal >= 1 && w.inventory < 1;
  if (!active) { w.stockoutActive = false; return; }
  if (w.lastStockoutDay === w.day) return;
  w.lastStockoutDay = w.day;
  const def = EVENT_BY_ID["peak-stockout"];
  const log = logEvent(w, def, []);
  const hit = settle(w, { kind: "event-stockout", from: "shopHealth", to: "none", amount: PEAK_STOCKOUT_HEALTH_PER_DAY, unit: "点", ref: { eventId: def.id } });
  if (hit) log.effects.push({ account: "shopHealth", amount: -hit.amount, unit: "点", note: "断货期差评缠身（每游戏日）" });
  const first = !w.stockoutActive;
  w.stockoutActive = true;
  events.push({ type: "game-event", id: def.id, name: def.name, mood: def.mood, day: w.day, modal: first, log });
}

/**
 * 事件应对（loop.dispatch("eventChoice", { id, choice }) 的内核落点）：
 *   bad-reviewer + "pr"       → 窗口内 ¥50+5 精力公关，减半返还（净扣 10 = 效果表 halve 口径）
 *   follow-seller + "complain"→ 精力 −10 投诉，转化率惩罚立即结束（提前下架）
 *   choice "dismiss"          → 放弃应对（差评保持全额已扣 / 跟卖等 3 日自然结束）
 */
export function eventChoice(w, id, choice, events = []) {
  const idx = w.pendingEvents.findIndex((p) => p.id === id);
  if (idx < 0) return { ok: false, reason: "无此待应对事件" };
  const pe = w.pendingEvents[idx];
  const def = EVENT_BY_ID[id];
  if (!def?.modal) return { ok: false, reason: "该事件无需应对" };
  if (choice === "dismiss") {
    pe.choice = "dismiss";
    pe.log.choice = "dismiss";
    w.pendingEvents.splice(idx, 1);
    events.push({ type: "event-choice", id, choice, day: w.day });
    return { ok: true };
  }
  if (!def.counter(w, pe)) return { ok: false, reason: "应对条件不满足（窗口/资源）" };
  if (id === "bad-reviewer" && choice === "pr") {
    const paid = settle(w, { kind: "event-pr-cost", from: "cash", to: "expense", amount: BAD_REVIEWER_PR_COST, unit: "¥", ref: { eventId: id } });
    if (!paid) return { ok: false, reason: "现金不足" };
    const spent = settle(w, { kind: "event-pr-labor", from: "energy", to: "none", amount: BAD_REVIEWER_PR_ENERGY, unit: "点", ref: { eventId: id } });
    const reliefAmount = Math.ceil((pe.baseHit || BAD_REVIEWER_HEALTH_HIT) / 2); // 减半 = 实际发生额 ÷ 2
    const relief = settle(w, { kind: "event-pr-relief", from: "none", to: "shopHealth", amount: reliefAmount, unit: "点", ref: { eventId: id } });
    pe.log.effects.push({ account: "cash", amount: -paid.amount, unit: "¥", note: "公关花费" });
    pe.log.effects.push({ account: "energy", amount: -(spent?.amount ?? BAD_REVIEWER_PR_ENERGY), unit: "点", note: "公关耗神" });
    if (relief) pe.log.effects.push({ account: "shopHealth", amount: relief.amount, unit: "点", note: "公关减半返还（prEffect=halve）" });
    pe.choice = "pr";
    pe.log.choice = "pr";
    w.pendingEvents.splice(idx, 1);
    events.push({ type: "event-choice", id, choice, day: w.day });
    return { ok: true };
  }
  if (id === "follow-seller" && choice === "complain") {
    const spent = settle(w, { kind: "event-complain", from: "energy", to: "none", amount: FOLLOW_SELLER_COMPLAIN_ENERGY, unit: "点", ref: { eventId: id } });
    if (!spent) return { ok: false, reason: "精力不足" };
    w.followSellerDays = 0;
    pe.log.effects.push({ account: "energy", amount: -spent.amount, unit: "点", note: "投诉耗神（提前下架）" });
    pe.choice = "complain";
    pe.log.choice = "complain";
    w.pendingEvents.splice(idx, 1);
    events.push({ type: "event-choice", id, choice, day: w.day });
    return { ok: true };
  }
  return { ok: false, reason: "未知应对方式" };
}

/** 换日推进：跟卖狗惩罚 −1 日（自然到期）；organicToday 隔日失效（「当日」口径） */
export function advanceDay(w) {
  if (w.followSellerDays > 0) w.followSellerDays -= 1;
  w.organicToday = false;
}
