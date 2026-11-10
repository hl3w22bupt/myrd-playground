// loop.js — 固定步长累加器 + 显式状态机 + fastForward 无头钩子。
// 内核入口：表现层每帧喂 dt + intent；测试直接喂意图序列跑 tick，零 three 零 DOM。
// 状态机：title → playing → paused / gameover；转移全部有守卫（非法转移 no-op + warning，E-10）。
import { createWorld, stepWorld, finiteOr } from "./world.js";
import { FIXED_STEP, MAX_DT, SEED_DEFAULT } from "../numeric.js";

export const EMPTY_INTENT = Object.freeze({ moveX: 0, moveZ: 0 });

/** 合法转移表：不在此表的转移一律拒绝 */
const TRANSITIONS = Object.freeze({
  title: ["playing"],
  playing: ["paused", "gameover"],
  paused: ["playing"],
  gameover: ["playing"],
});

export function createGame({ seed = SEED_DEFAULT } = {}) {
  let world = createWorld(seed);
  let state = "title";
  let acc = 0;
  const warnings = [];

  /** 守卫转移：合法 true；非法 no-op 并记 warning */
  function transition(next) {
    if (state === next) return true;
    if (!(TRANSITIONS[state] || []).includes(next)) {
      warnings.push({ from: state, to: next, timeLeft: world.timeLeft });
      return false;
    }
    if (next === "playing") acc = 0; // 进入 playing 清空累加器，不留残留
    state = next;
    return true;
  }

  function stepOnce(intent) {
    const events = stepWorld(world, intent, FIXED_STEP);
    if (world.over && state !== "gameover") transition("gameover");
    return events;
  }

  /** 帧驱动入口：dt 钳制 + 固定步长推进；非 playing 态零推进（时间冻结） */
  function tick(dt, rawIntent) {
    const clamped = Math.max(0, Math.min(MAX_DT, finiteOr(dt)));
    const intent = { moveX: finiteOr(rawIntent?.moveX), moveZ: finiteOr(rawIntent?.moveZ) };
    if (state !== "playing") return { events: [], stepped: 0, state };
    acc += clamped;
    const events = [];
    let stepped = 0;
    while (acc >= FIXED_STEP) {
      acc -= FIXED_STEP;
      events.push(...stepOnce(intent));
      stepped++;
      if (state === "gameover") break;
    }
    return { events, stepped, state };
  }

  /** 无头快进：按固定步长推满秒数（冒烟协议/测试用）；必须已在 playing 态 */
  function fastForward(seconds, rawIntent) {
    const budget = Math.min(Math.max(0, finiteOr(seconds)), 3600);
    const intent = { moveX: finiteOr(rawIntent?.moveX), moveZ: finiteOr(rawIntent?.moveZ) };
    const events = [];
    let t = 0;
    while (t < budget - 1e-9 && state === "playing") {
      const dt = Math.min(MAX_DT, budget - t);
      events.push(...tick(dt, intent).events);
      t += dt;
    }
    return { events, state };
  }

  /** 无头快进：精确按秒数折算的固定步数推进（冒烟协议/测试用）；必须已在 playing 态。
   *  不走浮点累加切分 —— fp 残差会让最后一小步永远走不到、timeLeft 卡在 1 步以内不终局。 */
  function fastForward(seconds, rawIntent) {
    const budget = Math.min(Math.max(0, finiteOr(seconds)), 3600);
    const intent = { moveX: finiteOr(rawIntent?.moveX), moveZ: finiteOr(rawIntent?.moveZ) };
    const events = [];
    const steps = Math.round(budget / FIXED_STEP);
    for (let i = 0; i < steps && state === "playing"; i++) events.push(...stepOnce(intent));
    return { events, state };
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
      world = createWorld(world.seed);
      state = "playing";
      acc = 0;
      return true;
    },

    tick,
    fastForward,
  };
}
