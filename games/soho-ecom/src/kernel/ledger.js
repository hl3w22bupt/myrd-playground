// ledger.js — 账本三池（可用现金/在途货款/库存）+ 三资源 的唯一结算入口。
// 铁律（M1 验收 3「三资源一致结算」）：内核里一切资源/池的增减必须经 settle()，
// 任何绕过结算入口的直接改值路径都是违例 —— tests/settlement-entry.spec.mjs 静态 + 行为双查。
// 流水（M1 验收 2）：每笔变动落 journal（来源 ref、游戏日、金额、池间去向），
// replay() 可从初始态逐条重放复算出终态 —— 三池守恒由此可判（tests/pools-conservation.spec.mjs）。
//
// 池语义（对齐 spec.payoutPools.flow「可用现金 ←T+14← 在途货款 ←出单← 已售库存」）：
//   cash ¥ · inTransit ¥（在途货款，只放钱）· inventory 件（现金的前置形态，只放货）。
//   出单 = 库存−1（货权出库，inventory→none）∧ 在途货款+¥55（market→inTransit，按 T+14 归批）。
import { PAYOUT_CYCLE_DAYS } from "../numeric.js";

/** 资金/货/资源 的字段映射：settle 只允许碰这些名字 */
export const POOLS = Object.freeze(["cash", "inventory", "inTransit"]);
export const RESOURCES = Object.freeze(["energy", "satiety", "shopHealth"]);
export const RESOURCE_MAX = Object.freeze({ energy: 100, satiety: 100, shopHealth: 100 });
/** 外部账户：market=外部流入（销售收入/供货入库），expense=外部流出（开支），none=纯出库/资源调整 */
export const EXTERNAL = Object.freeze(["market", "expense", "none"]);

const finiteOr0 = (v) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

function fieldName(account) {
  return POOLS.includes(account) || RESOURCES.includes(account) ? account : null; // 外部账户不落字段
}

/** 在途货款镜像 = 批次之和（任何时刻必须相等；bypass 检测的哨兵） */
export function inTransitTotal(w) {
  return w.receivables.reduce((s, b) => s + b.amount, 0);
}

/**
 * 唯一结算入口。entry = { kind, from, to, amount, unit?, ref? }。
 * from/to ∈ POOLS ∪ RESOURCES ∪ EXTERNAL；amount ≥ 0 且有限（非有限按 0 拒绝，E-09 边界加固）。
 * 钳位：池 ≥ 0，资源 ∈ [0, 上限]；流水记录实际发生额 —— replay 才能逐条对上。
 * inTransit 的增减同步维护 receivables 批次（ref.dueDay 必带）：入库按 T+14 归批、结算按批提取。
 * 返回实际落账的 entry（amount = 发生额），零发生额（被钳位吞掉）返回 null。
 */
export function settle(w, entry) {
  const kind = typeof entry?.kind === "string" ? entry.kind : "";
  const from = entry?.from;
  const to = entry?.to;
  if (!kind || !from || !to) throw new Error(`ledger: 非法结算条目 kind=${kind}`);
  const universe = [...POOLS, ...RESOURCES, ...EXTERNAL];
  if (!universe.includes(from) || !universe.includes(to)) throw new Error(`ledger: 未知账户 ${from}→${to}`);
  if (from === to) throw new Error(`ledger: 同账户转移无意义 ${from}`);
  const requested = finiteOr0(entry.amount);
  if (requested < 0) throw new Error(`ledger: 负数金额请换转 from/to（kind=${kind}）`);
  const unit = typeof entry.unit === "string" ? entry.unit : "¥";

  // —— 借方（from 扣减）：钳位后得到实际发生额 ——
  let applied = requested;
  const fromField = fieldName(from);
  if (fromField) {
    const cap = RESOURCES.includes(fromField) ? RESOURCE_MAX[fromField] : Infinity;
    const before = w[fromField];
    applied = Math.max(0, Math.min(applied, before));
    w[fromField] = Math.max(0, Math.min(cap, before - applied));
  }

  // —— 贷方（to 增加）：资源钳上限；在途批次维护与字段更新解耦（回款 = inTransit→cash 也要减批）——
  const toField = fieldName(to);
  if (toField) {
    const cap = RESOURCES.includes(toField) ? RESOURCE_MAX[toField] : Infinity;
    const before = w[toField];
    const gain = toField === "inTransit" ? applied : Math.max(0, Math.min(applied, cap - before));
    w[toField] = before + gain;
  }
  if (to === "inTransit") appendReceivable(w, entry, applied);
  else if (from === "inTransit") withdrawReceivable(w, entry, applied);

  if (applied <= 0) return null; // 零发生额不落流水（借方被钳位吞掉 = 余额不足，调用方自查）

  w.journal.push({
    seq: w.seq++,
    day: w.day,
    t: Math.round(w.dayProgress * 10000) / 10000,
    kind,
    from,
    to,
    amount: applied,
    unit,
    ref: entry.ref ?? null,
  });
  return { ...entry, amount: applied };
}

/** 在途入库：同到期日合并成批（渲染层按批显示剩余天数）；orders 记批次含订单数 */
function appendReceivable(w, entry, amount) {
  const dueDay = entry.ref?.dueDay;
  if (!Number.isInteger(dueDay)) throw new Error("ledger: 在途入库必须带整数 ref.dueDay（T+14 归批）");
  let batch = w.receivables.find((b) => b.dueDay === dueDay);
  if (!batch) {
    batch = { dueDay, amount: 0, orders: 0 };
    w.receivables.push(batch);
    w.receivables.sort((a, b) => a.dueDay - b.dueDay);
  }
  batch.amount = Math.round((batch.amount + amount) * 100) / 100;
  batch.orders += Number.isInteger(entry.ref?.orders) ? entry.ref.orders : 1;
}

/** 在途提取：按批扣减，空批移除 */
function withdrawReceivable(w, entry, amount) {
  const dueDay = entry.ref?.dueDay;
  if (!Number.isInteger(dueDay)) throw new Error("ledger: 在途提取必须带整数 ref.dueDay");
  const batch = w.receivables.find((b) => b.dueDay === dueDay);
  if (!batch || batch.amount + 1e-9 < amount) throw new Error(`ledger: 在途批次不足 dueDay=${dueDay}`);
  batch.amount = Math.round((batch.amount - amount) * 100) / 100;
  batch.orders = Math.max(0, batch.orders - (Number.isInteger(entry.ref?.orders) ? entry.ref.orders : batch.orders));
  if (batch.amount <= 0) w.receivables.splice(w.receivables.indexOf(batch), 1);
}

/**
 * 场景播种（仅 createWorld 构造初始态用）：绕过流水的开局存档构造。
 * 重放基线 = 播种后的 initialSnapshotOf（播种先于一切流水，不污染守恒判定）。
 */
export function seedScenario(w, { cash, receivables }) {
  if (Number.isFinite(cash)) w.cash = cash;
  if (Array.isArray(receivables)) {
    w.receivables = receivables.map((b) => ({ ...b }));
    w.inTransit = inTransitTotal(w);
  }
}

/**
 * 在途批次整体延期/提前（M2 事件效果：货代延误 +3 日、海关查验 +2 日、海外仓及时补货 −3 日）。
 * T+14 规则本身零误差（bookOrder 恒为下单日 + 14）；事件延期是「意外」，必须落流水才可重放复算 ——
 * 流水 kind="payout-delay"（unit="日"，ref.shifts 记录每批 from→to），replay 逐条平移批次到期日。
 * days > 0 延期；days < 0 提前（提前不得早于当日之后的下一次上午结算窗口，钳到 w.day + 1）。
 * 返回发生平移的批次数组（事件流水留痕用）。
 */
export function delayBatches(w, days, ref = {}) {
  if (!Number.isInteger(days) || days === 0) throw new Error(`ledger: 批次平移天数必须是非零整数 days=${days}`);
  const minDue = w.day + 1;
  const shifts = [];
  for (const b of w.receivables) {
    const to = Math.max(minDue, b.dueDay + days);
    if (to === b.dueDay) continue;
    shifts.push({ from: b.dueDay, to, amount: b.amount, orders: b.orders });
    b.dueDay = to;
  }
  if (shifts.length === 0) return [];
  w.receivables.sort((a, b) => a.dueDay - b.dueDay);
  w.journal.push({
    seq: w.seq++,
    day: w.day,
    t: Math.round(w.dayProgress * 10000) / 10000,
    kind: "payout-delay",
    from: "none",
    to: "none",
    amount: Math.abs(days),
    unit: "日",
    ref: { days, shifts, ...ref },
  });
  return shifts;
}

/** 一笔订单的入账（货权出库 + 货款按 T+14 归批），world 出单时调用；返回到期日 */
export function bookOrder(w, orderId, salePrice) {
  const dueDay = w.day + PAYOUT_CYCLE_DAYS;
  const ship = settle(w, { kind: "order-ship", from: "inventory", to: "none", amount: 1, unit: "件", ref: { orderId } });
  if (!ship) return null; // 库存不足（调用方应先守卫，此处兜底）
  const rev = settle(w, { kind: "order-revenue", from: "market", to: "inTransit", amount: salePrice, unit: "¥", ref: { orderId, dueDay, orders: 1 } });
  if (!rev) throw new Error("ledger: 订单货款入账失败（不应发生）");
  w.ordersTotal += 1;
  return dueDay;
}

/** 快照：确定性/重放比对的最小状态面 */
export function snapshotOf(w) {
  return {
    day: w.day,
    cash: w.cash,
    inventory: w.inventory,
    inTransit: w.inTransit,
    energy: w.energy,
    satiety: w.satiety,
    shopHealth: w.shopHealth,
    receivables: w.receivables.map((b) => ({ ...b })),
    ordersTotal: w.ordersTotal,
    missedTotal: w.missedTotal,
    settledTotal: w.settledTotal,
    payoutCount: w.payoutCount,
  };
}

/** 重放的初始态 = createWorld 后未 tick 的快照（开局真值，任何动作发生前取） */
export function initialSnapshotOf(w) {
  return { ...snapshotOf(w), seq: w.seq, listed: w.products.map((p) => p.listed) };
}

/**
 * 重放：从初始态逐条执行流水，返回**账本可证字段**的终态快照。
 * （day/missedTotal 不经结算入口产生 —— 换日与错失不是资源变动，不在可重放范围内。）
 * M1 验收 2/3 的机判基础：终态快照与 replay 结果逐字段一致 = 「一切增减走同一入口」成立。
 */
export function replay(initial, journal) {
  const w = {
    cash: initial.cash,
    inventory: initial.inventory,
    inTransit: initial.inTransit,
    energy: initial.energy,
    satiety: initial.satiety,
    shopHealth: initial.shopHealth,
    receivables: initial.receivables.map((b) => ({ ...b })),
    ordersTotal: initial.ordersTotal,
    settledTotal: initial.settledTotal,
    payoutCount: initial.payoutCount,
  };
  for (const e of journal) {
    const fromField = fieldName(e.from);
    const toField = fieldName(e.to);
    if (fromField) w[fromField] -= e.amount;
    if (toField) w[toField] += e.amount;
    // 批次平移（M2 事件效果）：live 语义是「同一 delay 内全部批次同时平移」（delayBatches 先算后写），
    // replay 必须整体重算 max(day+1, dueDay+days)——不能按 ref.shifts 逐腿 find(dueDay===from)：
    // 同一 delay 内前腿把批次 A 移到后腿 B 的 from 上时，逐腿查找会错移 A（调参 v1 批次变密后暴露）。
    // ref.shifts 保留为逐批审计留痕（from→to），不复用于重放定位。
    if (e.kind === "payout-delay" && Number.isInteger(e.ref?.days)) {
      const minDue = e.day + 1;
      for (const b of w.receivables) b.dueDay = Math.max(minDue, b.dueDay + e.ref.days);
      w.receivables.sort((a, b) => a.dueDay - b.dueDay);
    }
    if (e.from === "inTransit" || e.to === "inTransit") {
      let batch = w.receivables.find((b) => b.dueDay === e.ref?.dueDay);
      if (!batch && e.to === "inTransit") {
        batch = { dueDay: e.ref.dueDay, amount: 0, orders: 0 };
        w.receivables.push(batch);
        w.receivables.sort((a, b) => a.dueDay - b.dueDay);
      }
      if (batch) {
        batch.amount = Math.round((batch.amount + (e.to === "inTransit" ? e.amount : -e.amount)) * 100) / 100;
        if (e.to === "inTransit") batch.orders += Number.isInteger(e.ref?.orders) ? e.ref.orders : 1;
        if (batch.amount <= 0) w.receivables.splice(w.receivables.indexOf(batch), 1);
      }
    }
    for (const r of RESOURCES) w[r] = Math.max(0, Math.min(RESOURCE_MAX[r], w[r]));
    w.inventory = Math.max(0, w.inventory);
    if (e.kind === "order-revenue") w.ordersTotal += 1;
    if (e.kind === "payout") { w.settledTotal += e.amount; w.payoutCount += Number.isInteger(e.ref?.orders) ? e.ref.orders : 0; }
  }
  w.inTransit = inTransitTotal(w);
  return {
    cash: w.cash,
    inventory: w.inventory,
    inTransit: w.inTransit,
    energy: w.energy,
    satiety: w.satiety,
    shopHealth: w.shopHealth,
    receivables: w.receivables.map((b) => ({ ...b })),
    ordersTotal: w.ordersTotal,
    settledTotal: w.settledTotal,
    payoutCount: w.payoutCount,
  };
}
