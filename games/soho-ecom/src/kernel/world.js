// world.js — 纯内核经济世界：三池账本 + 选品/上架 + 出单 + T+14 批次结算 + 生活动作 + 趴窝判定。
// 零 three / 零 DOM / 零系统随机 / 零系统时钟 —— Node 可直接 import 跑（preflight P3 口径）。
// 一切资源增减只经 ledger.settle()（M1 验收 3）；流水可重放复算（M1 验收 2）。
import { createRng } from "./rng.js";
import { PRODUCTS } from "../levels/products.js";
import { settle, bookOrder, seedScenario } from "./ledger.js";
import { dailyEventRoll, stockoutCheck, advanceDay, shiftMood, listedCount } from "./events.js";
import { restockUnitCost, rentPerDay, brokeLine, stageCheck } from "./upgrades.js";
import {
  FIXED_STEP,
  CASH_INITIAL, ENERGY_MAX, ENERGY_PER_ORDER, SATIETY_MAX, SATIETY_DECAY_PER_DAY,
  SHOP_HEALTH_MAX, SHOP_HEALTH_INITIAL, SHOP_HEALTH_WEAR_PER_DAY,
  REPLY_REVIEW_ENERGY, REPLY_REVIEW_HEALTH,
  INSTANT_NOODLE_COST, INSTANT_NOODLE_SATIETY, INSTANT_NOODLE_PENALTY,
  PROPER_MEAL_COST, PROPER_MEAL_SATIETY,
  SLEEP_IN_VAN_ENERGY, SLEEP_IN_VAN_MOOD, HOURLY_MOTEL_COST, HOURLY_MOTEL_ENERGY,
  SALE_PRICE_PER_UNIT, RESTOCK_LOTS,
  PAYOUT_CYCLE_DAYS, SEED_DEFAULT,
  DEMAND_NOISE_MIN, DEMAND_NOISE_MAX,
  SURVIVAL_BOOTSTRAP_COST, SESSION_DAYS,
  FOLLOW_SELLER_DEMAND_FACTOR, ORGANIC_HIT_DEMAND_MULT,
  SLEEP_HOME_ENERGY, AD_COST_PER_CAST, AD_EXPECTED_ORDERS, P1_CASH_LINE,
  RICH_SCENARIO_CASH,
} from "../numeric.js";

/** 边界加固（E-09）：非有限数值一律回退默认 —— 注入值不得进内核 */
export const finiteOr = (v, d = 0) => (Number.isFinite(v) ? v : d);

/** 趴窝判定（M0 payoutPools.brokeRule）：可用现金 < 固定开支 + 最低补货（档位动态取值，床位档 = 430 与 M1 一致） */
export const isBroke = (w) => w.cash + 1e-9 < brokeLine(w);

/**
 * 资金链断裂（终局）：趴窝 ∧ 在途为空 ∧（无库存 ∨ 精力不够处理一单）∧ 现金低于自救启动金
 * （泡面¥5 + 钟点房¥50 = 把精力从 0 拉回可接单的最低现金；三条件全封死才判负，趴窝本身可恢复）。
 */
export function isTerminal(w) {
  if (w.cash + 1e-9 >= brokeLine(w)) return false;
  if (w.receivables.length > 0) return false;
  const canSell = w.inventory >= 1 && w.energy + 1e-9 >= ENERGY_PER_ORDER;
  const canBootstrap = w.cash + 1e-9 >= SURVIVAL_BOOTSTRAP_COST;
  return !canSell && !canBootstrap;
}

/**
 * 创建世界。scenario="fresh" 正常开局（M0 resources.initial）；
 * scenario="broke" 构造「现金不足 + 回款全部在途」的趴窝存档（M1 验收 4 的可复现入口，?case=broke）。
 */
export function createWorld(seed = SEED_DEFAULT, scenario = "fresh") {
  const rng = createRng(seed >>> 0);
  const w = {
    seed: seed >>> 0,
    scenario,
    rng,
    products: PRODUCTS.map((p) => ({ ...p, listed: false })),
    day: 1,
    dayProgress: 0,
    cash: CASH_INITIAL,
    inventory: 0,
    inTransit: 0,
    energy: ENERGY_MAX,
    satiety: SATIETY_MAX,
    shopHealth: SHOP_HEALTH_INITIAL,
    receivables: [],            // 在途批次 [{dueDay, amount ¥, orders}]，按到期日升序
    pending: Object.fromEntries(PRODUCTS.map((p) => [p.id, 0])),
    noise: {},                  // 当日需求噪声（种子驱动，逐商品逐日一抽）
    noodlePenalty: 1,           // 泡面代价：当日精力消耗系数（隔日复位）
    // —— M2 叠加层状态 ——
    mood: 0,                    // 心情修正器（事件专用通道，±20 钳位；需求乘数 = 1 + mood/100）
    followSellerDays: 0,        // 跟卖狗转化惩罚剩余天数（0 = 无）
    organicToday: false,        // 爆款自然流量：当日需求 ×2（隔日失效）
    adQueue: 0,                 // 广告期望订单池（当日有效，日终清零）
    adSpendToday: 0,            // 当日已投广告费（爆款自然流量返还口径）
    stage: "P0",                // 阶段曲线：P0 兼职试水 → P1 SOHO 起量（单向）
    stageUpDay: null,           // P1 触发的游戏日（验收 4 的提示锚点）
    upgrades: { warehouse: false, housingSoho: false }, // 升级线一次性开关（连点不重复扣费）
    eventLog: [],               // 事件流水（事件名/游戏日/效果值/资源去向/玩家应对）
    eventCooldown: {},          // 事件冷却表 { eventId: 冷却至游戏日 }
    pendingEvents: [],          // 待玩家应对的弹窗事件（差评师公关 / 跟卖狗投诉）
    lastStockoutDay: -1,        // 旺季断货每日一次的当日哨兵
    stockoutActive: false,      // 断货状态（首次进入弹窗，补货解除）
    journal: [],
    seq: 0,
    ordersTotal: 0,
    missedTotal: 0,
    settledTotal: 0,
    payoutCount: 0,
    brokeCount: 0,
    broke: false,
    over: false,
    won: false,
    endReason: "",
  };
  if (scenario === "broke") {
    // 构造存档：现金 180 < 趴窝线 230（调参 v1：趴窝线 = 房租 30 + 最低补货档 5 件×¥40，spec.tune.restockLots）；
    // 回款 ¥825（15 单）在第 6 天到账；库存 0。
    seedScenario(w, { cash: 180, receivables: [{ dueDay: w.day + 5, amount: 825, orders: 15 }] });
    w.broke = isBroke(w);
    w.brokeCount = w.broke ? 1 : 0;
  } else if (scenario === "rich") {
    // 构造存档：现金 ¥7000（RICH_SCENARIO_CASH，调参 v1）> P1 解锁线 ¥5000 → 播种即触发 P1 阶段沿
    // （M2 验收 3/4「构造现金充足的存档」的可复现入口，?case=rich；两级升级演示见 numeric.js 调参标注）。
    seedScenario(w, { cash: RICH_SCENARIO_CASH });
    stageCheck(w, []);
  }
  rollDailyNoise(w);
  return w;
}

/** 当日需求噪声：逐商品各抽一帧（固定抽取数 → 随机流与玩家决策解耦，确定性更强） */
function rollDailyNoise(w) {
  for (const p of w.products) {
    w.noise[p.id] = DEMAND_NOISE_MIN + w.rng() * (DEMAND_NOISE_MAX - DEMAND_NOISE_MIN);
  }
}

/** 规则B 转化通道：店铺健康 → 需求系数（健康 0 = 没流量） */
const healthFactor = (w) => w.shopHealth / SHOP_HEALTH_MAX;

/** M2 事件/心情修正器：心情 ±%（每 1 点 = ±1%）× 跟卖狗 −20% × 爆款自然流量 ×2 */
export function demandMultiplier(w) {
  let m = 1 + w.mood / 100;
  if (w.followSellerDays > 0) m *= FOLLOW_SELLER_DEMAND_FACTOR;
  if (w.organicToday) m *= ORGANIC_HIT_DEMAND_MULT;
  return m;
}

/** 规则A 单链接日需求 = base × 健康系数 × 当日噪声 × 事件修正 */
export const dailyDemand = (w, p) => p.baseDemand * healthFactor(w) * w.noise[p.id] * demandMultiplier(w);

/** 泡面代价下的单笔精力成本（规则D 天花板口径） */
const orderEnergyCost = (w) => ENERGY_PER_ORDER * w.noodlePenalty;

/**
 * 每日结算（固定开支/饱腹衰减/健康磨损/回款转账 —— spec entity day-loop 四件事 + M2 事件流）。
 * 顺序：换日修正器推进 → T+14 到账 → 房租 → 磨损 → 饱腹衰减 → 旺季断货 → 事件判定 → 换日噪声
 *       → 阶段沿 → 趴窝状态机 → 终局判定。
 */
function dayTick(w, events) {
  w.day += 1;
  w.dayProgress = 0;
  w.noodlePenalty = 1; // 泡面的「当日精力消耗+10%」只在当日内有效

  // ⓪ M2 换日推进：跟卖狗惩罚 −1 日、爆款 ×2 隔日失效、广告期望池/当日广告费日终清零
  advanceDay(w);
  w.adQueue = 0;
  w.adSpendToday = 0;

  // ① T+14 当日在途货款自动转可用现金（settleRule；到期日 = 下单日 + 14，误差 0 天；
  //    货代延误/海关查验/海外仓补货的批次平移经 delayBatches 落流水后在此自然生效）
  const due = w.receivables.filter((b) => b.dueDay <= w.day);
  for (const b of due) {
    const ordersInBatch = b.orders; // settle 会在批内原地清零 —— 先取快照再结算
    const got = settle(w, {
      kind: "payout", from: "inTransit", to: "cash", amount: b.amount, unit: "¥",
      ref: { dueDay: b.dueDay, orders: ordersInBatch },
    });
    if (got) {
      w.settledTotal += got.amount;
      w.payoutCount += ordersInBatch;
      events.push({ type: "payout", amount: got.amount, dueDay: b.dueDay, day: w.day });
    }
  }

  // ② 固定开支：房租按住房档位（床位档 ¥30 / SOHO 一人居 ¥60 —— M0 #13 + spec.m2 升级效果）
  settle(w, { kind: "rent", from: "cash", to: "expense", amount: rentPerDay(w), unit: "¥", ref: { housingTier: w.upgrades.housingSoho ? "soho" : "bed" } });

  // ③ 店铺健康磨损 −5/日（M0 #11）④ 饱腹衰减 −40/日（M0 satiety.decayPerDay）
  settle(w, { kind: "wear", from: "shopHealth", to: "none", amount: SHOP_HEALTH_WEAR_PER_DAY, unit: "点" });
  settle(w, { kind: "satiety-decay", from: "satiety", to: "none", amount: SATIETY_DECAY_PER_DAY, unit: "点" });

  // ④b M2 旺季断货（状态型：爆单期库存归零，每游戏日店铺健康 −5）
  stockoutCheck(w, events);

  // ④c M2 每日事件判定（至多一次：概率 → 合格池 → 加权抽取）
  dailyEventRoll(w, events);

  // ⑤ 换日：重抽需求噪声
  rollDailyNoise(w);

  // ⑤b M2 阶段沿：现金达到 ¥5000 触发 P1（stageCurve unlock，一次性）
  stageCheck(w, events);

  // ⑥ 趴窝状态机：进入/解除沿（M1 验收 4：可触发、可恢复、现金充足不误报）
  const nowBroke = isBroke(w);
  if (nowBroke && !w.broke) { w.broke = true; w.brokeCount += 1; events.push({ type: "broke-on", day: w.day }); }
  else if (!nowBroke && w.broke) { w.broke = false; events.push({ type: "broke-off", day: w.day }); }

  events.push({ type: "day", day: w.day });

  // ⑦ 终局判定：撑满一局 = 达成；资金链断裂 = 失败
  if (w.day > SESSION_DAYS) {
    w.over = true;
    w.won = true;
    w.endReason = `撑满 ${SESSION_DAYS} 个游戏日`;
    events.push({ type: "gameover", won: true });
  } else if (isTerminal(w)) {
    w.over = true;
    w.won = false;
    w.endReason = "资金链断裂：无现金、无在途回款、无库存可售";
    events.push({ type: "gameover", won: false });
  }
}

/** 出单尝试：精力与库存双守卫（规则D 天花板），不满足即错失 */
function tryFulfill(w, p, events) {
  const cost = orderEnergyCost(w);
  if (w.inventory >= 1 && w.energy + 1e-9 >= cost) {
    const orderId = `#${w.day}-${w.ordersTotal + 1}`;
    settle(w, { kind: "order-labor", from: "energy", to: "none", amount: cost, unit: "点", ref: { orderId } });
    const dueDay = bookOrder(w, orderId, SALE_PRICE_PER_UNIT);
    events.push({ type: "order", orderId, amount: SALE_PRICE_PER_UNIT, dueDay, day: w.day });
    return true;
  }
  w.missedTotal += 1;
  events.push({ type: "missed", productId: p.id, day: w.day });
  return false;
}

/** 推进一个固定步长（单位：游戏日）：需求连续累积 + 换日触发。over 后零推进 */
export function stepWorld(w, dtDays) {
  const events = [];
  if (w.over || !(dtDays > 0)) return events;

  w.dayProgress += dtDays;
  while (w.dayProgress >= 1 - 1e-12) {
    w.dayProgress -= 1;
    dayTick(w, events);
    if (w.over) { w.dayProgress = 0; return events; }
  }

  // 需求累积：仅已上架链接（规则A），按步长折算
  for (const p of w.products) {
    if (!p.listed) continue;
    w.pending[p.id] += dailyDemand(w, p) * dtDays;
    while (w.pending[p.id] >= 1 - 1e-12) {
      w.pending[p.id] -= 1;
      if (!tryFulfill(w, p, events)) break; // 错失即止：该链接当日需求按实际损失计
    }
  }

  // M2 广告期望订单池：与链接需求同一条出单管线（库存/精力守卫一致），喂给需求最大的在营链接。
  // 「¥10 → 期望 +1.5 单」在此精确落地（池按 1 单粒度出货，0.5 残差留池）；当日有效、日终清零。
  while (w.adQueue >= 1 - 1e-12) {
    const p = w.products.filter((x) => x.listed).sort((a, b) => b.baseDemand - a.baseDemand)[0];
    if (!p) break;
    w.adQueue -= 1;
    if (!tryFulfill(w, p, events)) break; // 库存/精力不足 → 滞留到日终作废（广告时效口径）
  }

  if (isTerminal(w) && !w.over) {
    w.over = true;
    w.won = false;
    w.endReason = "资金链断裂：无现金、无在途回款、无库存可售";
    events.push({ type: "gameover", won: false });
  }
  return events;
}

// —————————————————— 玩家动作（全部守卫 + 唯一结算入口）——————————————————

function pay(w, kind, cost) {
  return settle(w, { kind, from: "cash", to: "expense", amount: cost, unit: "¥" });
}

/** 补货：现金 → 库存（一条公式：¥40/件，海外仓升级后 ¥20/件）。趴窝禁补货（M0 brokeRule）。lots ∈ RESTOCK_LOTS */
export function actionRestock(w, units, events = []) {
  if (w.over) return { ok: false, reason: "已终局" };
  if (!RESTOCK_LOTS.includes(units)) return { ok: false, reason: "补货档位不合法" };
  if (w.broke) return { ok: false, reason: "趴窝中：无法补货" };
  const cost = units * restockUnitCost(w);
  const paid = pay(w, "restock-pay", cost);
  if (!paid) return { ok: false, reason: "现金不足" };
  const got = settle(w, { kind: "restock-goods", from: "market", to: "inventory", amount: units, unit: "件" });
  if (!got) throw new Error("world: 补货入库失败（不应发生）");
  events.push({ type: "restock", units, cost: paid.amount });
  return { ok: true, units, cost: paid.amount };
}

/** 上架（选品的落子）：免费，上架后该链接开始产生需求 */
export function actionList(w, productId, events = []) {
  const p = w.products.find((x) => x.id === productId);
  if (!p || w.over) return { ok: false, reason: "商品不存在或已终局" };
  if (p.listed) return { ok: false, reason: "已上架" };
  p.listed = true;
  events.push({ type: "list", productId, day: w.day });
  return { ok: true };
}

/** 下架：停止需求；未处理完的当日积压清零（链接已不在售） */
export function actionDelist(w, productId, events = []) {
  const p = w.products.find((x) => x.id === productId);
  if (!p || w.over) return { ok: false, reason: "商品不存在或已终局" };
  if (!p.listed) return { ok: false, reason: "未上架" };
  p.listed = false;
  w.pending[productId] = 0;
  events.push({ type: "delist", productId, day: w.day });
  return { ok: true };
}

/** 泡面 ¥5：饱腹+30，当日精力消耗+10%（M0 #3） */
export function actionNoodle(w, events = []) {
  if (w.over) return { ok: false, reason: "已终局" };
  const paid = pay(w, "noodle", INSTANT_NOODLE_COST);
  if (!paid) return { ok: false, reason: "现金不足" };
  settle(w, { kind: "satiety-restore", from: "none", to: "satiety", amount: INSTANT_NOODLE_SATIETY, unit: "点" });
  w.noodlePenalty = 1 + INSTANT_NOODLE_PENALTY;
  events.push({ type: "noodle", cost: paid.amount });
  return { ok: true };
}

/** 正经饭 ¥20：饱腹+60（M0 #4） */
export function actionMeal(w, events = []) {
  if (w.over) return { ok: false, reason: "已终局" };
  const paid = pay(w, "meal", PROPER_MEAL_COST);
  if (!paid) return { ok: false, reason: "现金不足" };
  settle(w, { kind: "satiety-restore", from: "none", to: "satiety", amount: PROPER_MEAL_SATIETY, unit: "点" });
  events.push({ type: "meal", cost: paid.amount });
  return { ok: true };
}

/** 规则C 吃睡链：饱腹 ≤ 0 时睡觉类动作无效（饿着睡不着） */
const sleepBlocked = (w) => w.satiety <= 0;

/** 睡觉（免费）：床位档 = 睡车里 精力+40 + 心情−5（M0 #5 moodDelta，随 M2 事件修正器通道恢复）；
 *  SOHO 一人居后 = 睡家里 精力+60、无心情代价（spec.m2 升级效果「精力恢复效率上调」）。 */
export function actionSleepVan(w, events = []) {
  if (w.over) return { ok: false, reason: "已终局" };
  if (sleepBlocked(w)) return { ok: false, reason: "饱腹为 0：睡不下去，先吃点东西" };
  if (w.upgrades.housingSoho) {
    settle(w, { kind: "sleep-home", from: "none", to: "energy", amount: SLEEP_HOME_ENERGY, unit: "点" });
    events.push({ type: "sleep-home" });
  } else {
    settle(w, { kind: "sleep-van", from: "none", to: "energy", amount: SLEEP_IN_VAN_ENERGY, unit: "点" });
    shiftMood(w, SLEEP_IN_VAN_MOOD);
    events.push({ type: "sleep-van" });
  }
  return { ok: true };
}

/** 广告投放（M0 #9）：¥10 → 当日期望订单池 +1.5。P1 解锁（stageCurve P1）∧ 非趴窝（brokeRule 广告停投）∧ 有链接在营 */
export function actionAdvertise(w, events = []) {
  if (w.over) return { ok: false, reason: "已终局" };
  if (w.stage !== "P1") return { ok: false, reason: `P0 阶段不可用：现金达 ¥${P1_CASH_LINE} 解锁广告` };
  if (w.broke) return { ok: false, reason: "趴窝中：广告停投" };
  if (listedCount(w) < 1) return { ok: false, reason: "先上架一个链接再投广告" };
  const paid = pay(w, "ad-spend", AD_COST_PER_CAST);
  if (!paid) return { ok: false, reason: "现金不足" };
  w.adQueue += AD_EXPECTED_ORDERS;
  w.adSpendToday += paid.amount;
  events.push({ type: "ad", cost: paid.amount });
  return { ok: true, cost: paid.amount };
}

/** 钟点房 ¥50：精力+80（M0 #6） */
export function actionMotel(w, events = []) {
  if (w.over) return { ok: false, reason: "已终局" };
  if (sleepBlocked(w)) return { ok: false, reason: "饱腹为 0：钟点房无效，先吃点东西" };
  const paid = pay(w, "motel", HOURLY_MOTEL_COST);
  if (!paid) return { ok: false, reason: "现金不足" };
  settle(w, { kind: "motel-rest", from: "none", to: "energy", amount: HOURLY_MOTEL_ENERGY, unit: "点" });
  events.push({ type: "motel", cost: paid.amount });
  return { ok: true };
}

/** 回评：精力−5 → 店铺健康+15（M0 #11，店铺健康的唯一修复通道） */
export function actionReplyReview(w, events = []) {
  if (w.over) return { ok: false, reason: "已终局" };
  const spent = settle(w, { kind: "reply-review", from: "energy", to: "none", amount: REPLY_REVIEW_ENERGY, unit: "点" });
  if (!spent) return { ok: false, reason: "精力不足" };
  settle(w, { kind: "health-restore", from: "none", to: "shopHealth", amount: REPLY_REVIEW_HEALTH, unit: "点" });
  events.push({ type: "reply-review" });
  return { ok: true };
}

/** 一次动作后的兜底判定：阶段沿（T+14 到账外的现金变化不触发，但守卫无害）+ 终局（花光现金可能立刻断裂） */
export function afterAction(w, events) {
  stageCheck(w, events);
  if (!w.over && isTerminal(w)) {
    w.over = true;
    w.won = false;
    w.endReason = "资金链断裂：无现金、无在途回款、无库存可售";
    events.push({ type: "gameover", won: false });
  }
}

/** 冒烟/调试：按游戏日快进（内核无时钟，步数精确折算 —— fp 残差不吞最后一步） */
export function fastForwardDays(w, days, { onEvents } = {}) {
  const steps = Math.round(days / FIXED_STEP);
  const all = [];
  for (let i = 0; i < steps && !w.over; i++) {
    const ev = stepWorld(w, FIXED_STEP);
    all.push(...ev);
    onEvents?.(ev);
  }
  return all;
}
