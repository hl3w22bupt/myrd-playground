// loop.js — 固定步长累加器 + 显式状态机 + fastForward 无头钩子（内核时间单位 = 游戏日）。
// 内核入口：表现层每帧喂 dt（已按速率折算成游戏日）+ 动作派发；测试直接喂 tick 序列跑，零 three 零 DOM。
// 状态机：title → playing → paused / gameover；转移全部有守卫（非法转移 no-op + warning，E-10）。
import {
  createWorld, stepWorld, afterAction, finiteOr,
  actionRestock, actionList, actionDelist,
  actionNoodle, actionMeal, actionSleepVan, actionMotel, actionReplyReview,
  actionAdvertise,
} from "./world.js";
import { applyUpgrade } from "./upgrades.js";
import { eventChoice } from "./events.js";
import { FIXED_STEP, MAX_DT_DAYS, SEED_DEFAULT } from "../numeric.js";

export const EMPTY_INTENT = Object.freeze({});

/** 合法转移表：不在此表的转移一律拒绝 */
const TRANSITIONS = Object.freeze({
  title: ["playing"],
  playing: ["paused", "gameover"],
  paused: ["playing"],
  gameover: ["playing"],
});

export function createGame({ seed = SEED_DEFAULT, scenario = "fresh" } = {}) {
  let world = createWorld(seed, scenario);
  let state = "title";
  let acc = 0;
  const warnings = [];

  /** 守卫转移：合法 true；非法 no-op 并记 warning */
  function transition(next) {
    if (state === next) return true;
    if (!(TRANSITIONS[state] || []).includes(next)) {
      warnings.push({ from: state, to: next, day: world.day });
      return false;
    }
    if (next === "playing") acc = 0; // 进入 playing 清空累加器，不留残留
    state = next;
    return true;
  }

  function stepOnce() {
    return stepWorld(world, FIXED_STEP);
  }

  /** 帧驱动入口：dt 单位 = 游戏日（表现层按速率折算）；钳制 + 固定步长推进；非 playing 态零推进 */
  function tick(dtDays) {
    const clamped = Math.max(0, Math.min(MAX_DT_DAYS, finiteOr(dtDays)));
    if (state !== "playing") return { events: [], stepped: 0, state };
    acc += clamped;
    const events = [];
    let stepped = 0;
    while (acc >= FIXED_STEP) {
      acc -= FIXED_STEP;
      events.push(...stepOnce());
      stepped++;
      if (state === "gameover" || world.over) break;
    }
    if (world.over && state === "playing") transition("gameover");
    return { events, stepped, state };
  }

  /** 无头快进：精确按游戏日折算的固定步数推进（冒烟协议/测试用）；必须已在 playing 态。
   *  不走浮点累加切分 —— fp 残差会让最后一小步永远走不到、终局判定被吞。 */
  function fastForward(days) {
    const budget = Math.min(Math.max(0, finiteOr(days)), 400);
    const events = [];
    const steps = Math.round(budget / FIXED_STEP);
    for (let i = 0; i < steps && state === "playing" && !world.over; i++) events.push(...stepOnce());
    if (world.over && state === "playing") transition("gameover");
    return { events, state };
  }

  /**
   * 玩家动作派发：唯一的状态守卫入口 —— 非 playing 态（title/paused/gameover）一律拒绝，
   * 唯一豁免：eventChoice 在 paused 态放行（事件决策卡「打开即暂停」语义，见下）。
   * action ∈ restock/list/delist/noodle/meal/sleepVan/motel/replyReview
   *        + M2：ad / upgradeWarehouse / upgradeHousing / eventChoice({id, choice})；返回 events。
   */
  function dispatch(action, arg) {
    // 决策卡豁免：表现层弹卡前必 game.pause()（main.js processPendingEvents「打开即暂停」，
    // 弹窗期间时间冻结），玩家点「知道了/投诉/公关」时 state=paused —— 守卫若不放行 eventChoice，
    // 按钮被静默拒收、pendingEvents 残留，closeModal → processPendingEvents 立刻把同一张卡弹回
    // （同步死循环 = 线上 P0「点了没反应」整局软锁死）。豁免仅此一类：商业动作 paused 仍拒绝
    // （state-machine.spec 既有断言不放宽），title / gameover(world.over) 态 eventChoice 照拒。
    const modalChoice = action === "eventChoice" && state === "paused";
    if ((state !== "playing" && !modalChoice) || world.over) return [];
    const events = [];
    const done = (() => {
      switch (action) {
        case "restock": return actionRestock(world, arg, events).ok;
        case "list": return actionList(world, arg, events).ok;
        case "delist": return actionDelist(world, arg, events).ok;
        case "noodle": return actionNoodle(world, events).ok;
        case "meal": return actionMeal(world, events).ok;
        case "sleepVan": return actionSleepVan(world, events).ok;
        case "motel": return actionMotel(world, events).ok;
        case "replyReview": return actionReplyReview(world, events).ok;
        case "ad": return actionAdvertise(world, events).ok;
        case "upgradeWarehouse": return applyUpgrade(world, "warehouse", events).ok;
        case "upgradeHousing": return applyUpgrade(world, "housingSoho", events).ok;
        case "eventChoice": return eventChoice(world, arg?.id, arg?.choice, events).ok;
        default:
          warnings.push({ from: state, to: state, reason: `unknown-action:${action}` });
          return false;
      }
    })();
    if (!done) return events;
    afterAction(world, events); // 花光现金可能立刻断裂
    return events;
  }

  return {
    get world() { return world; },
    get state() { return state; },
    get warnings() { return warnings; },

    start() { return transition("playing"); },
    pause() { return transition("paused"); },
    resume() { return transition("playing"); },

    /** 重开：整 world 重建（E-10：重开必须全复位）；title 态无可重开 */
    restart() {
      if (state === "title") {
        warnings.push({ from: state, to: "playing", reason: "restart-from-title" });
        return false;
      }
      world = createWorld(world.seed, world.scenario);
      state = "playing";
      acc = 0;
      return true;
    },

    tick,
    fastForward,
    dispatch,
  };
}
