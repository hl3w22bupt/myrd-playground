// upgrades.js — 升级线 + 阶段曲线（M2）：发货方式「自发货→海外仓」、住房「出租房→SOHO 一人居」、
// 阶段 P0「兼职试水」→ P1「SOHO 起量」（P2/P3 内容一律不进 —— spec.stageCurve 只取前两档）。
// 数值唯一来源：spec.stageCurve（P1 unlock「现金 ¥5000」、unitEconomics ¥35/单）
// + spec.m2.upgrades（升级花费派生口径）；本文件零魔数，全经 numeric.js。
// 铁律：升级扣费走 ledger.settle()（唯一结算入口）；升级状态是一次性开关（连点只扣一次）。
import { settle } from "./ledger.js";
import {
  P1_CASH_LINE, WAREHOUSE_UPGRADE_COST, HOUSING_SOHO_COST,
  WAREHOUSE_UNIT_COST, RENT_SOHO_PER_DAY, UNIT_COST_WITH_FREIGHT, RENT_PER_DAY, MIN_RESTOCK_UNITS,
} from "../numeric.js";

/** 阶段：P0 兼职试水 / P1 SOHO 起量（单向进度：解锁线达到即进入，花钱降现金不回退） */
export const stageOf = (w) => (w.cash + 1e-9 >= P1_CASH_LINE ? "P1" : "P0");

/** 阶段沿检查（dayTick / afterAction 调用）：现金达到 ¥5000 触发 P1（一次性，含 stage-up 事件） */
export function stageCheck(w, events) {
  if (w.stage === "P0" && stageOf(w) === "P1") {
    w.stage = "P1";
    w.stageUpDay = w.day;
    events.push({ type: "stage-up", stage: "P1", day: w.day });
    return true;
  }
  return false;
}

/** 当前单件补货成本：海外仓头程结构变化 ¥40 → ¥20 → 出单毛利 ¥15 → ¥35（= stageCurve P1 ¥35/单） */
export const restockUnitCost = (w) => (w.upgrades.warehouse ? WAREHOUSE_UNIT_COST : UNIT_COST_WITH_FREIGHT);

/** 当前房租档位：床位档 ¥30（M0 #13 起步）→ SOHO 一人居 ¥60 */
export const rentPerDay = (w) => (w.upgrades.housingSoho ? RENT_SOHO_PER_DAY : RENT_PER_DAY);

/** 当前趴窝线（M0 brokeRule「固定开支 + 最低补货」随档位动态取值；床位档 = 430 与 M1 口径一致） */
export const brokeLine = (w) => rentPerDay(w) + MIN_RESTOCK_UNITS * restockUnitCost(w);

/** 升级线定义（入口元数据 + 守卫 + 落账），loop.dispatch 按此派发 */
export const UPGRADE_DEFS = Object.freeze([
  {
    id: "warehouse", name: "海外仓", fromName: "自发货", toName: "海外仓",
    cost: WAREHOUSE_UPGRADE_COST,
    effectText: `单件补货 ¥${UNIT_COST_WITH_FREIGHT}→¥${WAREHOUSE_UNIT_COST} · 毛利 ¥15→¥35 · 解锁暖心事件「海外仓及时补货」`,
    done: (w) => w.upgrades.warehouse === true,
    applyDone: (w) => { w.upgrades.warehouse = true; },
  },
  {
    id: "housingSoho", name: "SOHO 一人居", fromName: "出租房（床位档）", toName: "SOHO 一人居",
    cost: HOUSING_SOHO_COST,
    effectText: `房租 ¥${RENT_PER_DAY}→¥${RENT_SOHO_PER_DAY}/日 · 睡车里升级为睡家里（免费，精力 +60）`,
    done: (w) => w.upgrades.housingSoho === true,
    applyDone: (w) => { w.upgrades.housingSoho = true; },
  },
]);

export const UPGRADE_BY_ID = Object.freeze(Object.fromEntries(UPGRADE_DEFS.map((u) => [u.id, u])));

/** 升级守卫：P1 阶段 ∧ 未升级 ∧ 未趴窝 ∧ 现金足够（一次性开关 → 重复点击天然不重复扣费） */
export function upgradeGuard(w, id) {
  const def = UPGRADE_BY_ID[id];
  if (!def) return { ok: false, reason: "未知升级项" };
  if (w.over) return { ok: false, reason: "已终局" };
  if (def.done(w)) return { ok: false, reason: "已升级（不重复扣费）" };
  if (w.stage !== "P1") return { ok: false, reason: `P0 阶段不可用：现金达 ¥${P1_CASH_LINE} 解锁` };
  if (w.broke) return { ok: false, reason: "趴窝中无法升级" };
  if (w.cash + 1e-9 < def.cost) return { ok: false, reason: "现金不足" };
  return { ok: true, def };
}

/** 升级落账：扣费走唯一结算入口（kind="upgrade-<id>"），返回 { ok } 供 loop.dispatch */
export function applyUpgrade(w, id, events = []) {
  const guard = upgradeGuard(w, id);
  if (!guard.ok) return guard;
  const def = guard.def;
  const paid = settle(w, { kind: `upgrade-${id}`, from: "cash", to: "expense", amount: def.cost, unit: "¥", ref: { upgrade: id } });
  if (!paid) return { ok: false, reason: "现金不足" };
  def.applyDone(w);
  events.push({ type: "upgrade", id, day: w.day });
  return { ok: true, cost: paid.amount };
}
