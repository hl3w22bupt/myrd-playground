// loop.js — 固定步长累加器 + fastForward 无头钩子（对标样本的 fastForward(seconds, step) 接口）。
// 内核入口：表现层每帧喂 dt + intent；测试直接喂意图序列跑 tick，零 three 零 DOM。

import { createWorld, moveWithCollision } from "./world.js";
import { stepWave, stepEnemies, tickOf } from "./wave.js";
import { stepWeapon } from "./combat.js";
import { PLAYER_MOVE_SPEED, PLAYER_SPRINT_MULT, FIXED_STEP, MAX_DT, WAVE_REST } from "../numeric.js";

export const EMPTY_INTENT = Object.freeze({
  forward: 0, strafe: 0, yaw: 0, pitch: 0, sprint: false, firing: false, reload: false,
});

/** 俯仰钳制（与输入层 player.js/touch.js 同值）：对抗注入的极端俯仰，超界取边界 */
const PITCH_CLAMP = 1.2;

/** 边界加固（验收口径 C）：非有限数值（NaN/±Infinity）一律回退默认 —— 注入值不得进内核 */
const finiteOr = (v, d = 0) => (Number.isFinite(v) ? v : d);

/** 归一化意图：剥离表现层多余字段 + 边沿标志（reload）只在第一个子步注入 —— 对标样本的边缘输入口径。
 *  边界加固：数值取有限值、俯仰钳制（超界坐标/极端参数在 world 层围栏钳制兜底）。*/
function normalizeIntent(raw) {
  return {
    forward: finiteOr(raw.forward),
    strafe: finiteOr(raw.strafe),
    yaw: finiteOr(raw.yaw),
    pitch: Math.max(-PITCH_CLAMP, Math.min(PITCH_CLAMP, finiteOr(raw.pitch))),
    sprint: raw.sprint === true,
    firing: raw.firing === true,
    reload: raw.reload === true,
  };
}

export function createGame({ seed = 1 } = {}) {
  const world = createWorld(seed);
  world.wave.restT = tickOf(WAVE_REST); // 开局休整，给玩家读 HUD 的时间
  let acc = 0;

  /** 单个固定逻辑子步（1 tick）。返回本子步事件。*/
  function stepTick(rawIntent) {
    const intent = normalizeIntent(rawIntent);
    const p = world.player;
    const events = [];

    // —— 玩家移动（局部朝向 → 世界位移；掩体滑移 + 围栏钳制在 world 层做）——
    const speed = PLAYER_MOVE_SPEED * (intent.sprint ? PLAYER_SPRINT_MULT : 1);
    const sin = Math.sin(intent.yaw), cos = Math.cos(intent.yaw);
    const dx = (sin * intent.forward + cos * intent.strafe) * speed * FIXED_STEP;
    const dz = (cos * intent.forward - sin * intent.strafe) * speed * FIXED_STEP;
    const moving = Math.abs(intent.forward) + Math.abs(intent.strafe) > 0;
    p.moving = moving;
    p.sprinting = intent.sprint && moving;
    moveWithCollision(world, p, dx, dz); // 掩体滑移 + 围栏钳制（world 层）
    p.yaw = intent.yaw; p.pitch = intent.pitch;

    // —— 系统推进（顺序固定：武器 → 波次 → 敌兵，保证确定性）——
    stepWeapon(world, intent, events);
    if (!world.over) stepWave(world, events);
    if (!world.over) stepEnemies(world, events);

    world.time += FIXED_STEP;
    return events;
  }

  return {
    world,
    /** 渲染帧推进：dt 钳制 [0, MAX_DT]（0/负值/NaN → 不推进且不污染累加器），累加器跑固定子步；边缘标志只在首子步注入 */
    frame(dt, rawIntent) {
      const clamped = Number.isFinite(dt) ? Math.min(Math.max(dt, 0), MAX_DT) : 0;
      acc += clamped;
      let first = true;
      const events = [];
      while (acc >= FIXED_STEP) {
        const slice = first ? rawIntent : { ...rawIntent, reload: false };
        events.push(...stepTick(slice ?? EMPTY_INTENT));
        acc -= FIXED_STEP;
        first = false;
        if (world.over) { acc = 0; break; }
      }
      return events;
    },
    /** 无头快进：等价于连续 frame(FIXED_STEP)；返回聚合结果（对标样本 {score,time,kills} 口径并扩展）。
     *  边界加固：0/负值/非有限秒数 → 0 tick（不推进）。*/
    fastForward(seconds, intentProvider = EMPTY_INTENT) {
      const s = Number.isFinite(seconds) ? seconds : 0;
      const total = Math.max(0, Math.floor(s / FIXED_STEP));
      const allEvents = [];
      for (let i = 0; i < total && !world.over; i++) {
        const raw = typeof intentProvider === "function" ? intentProvider(i) : intentProvider;
        allEvents.push(...stepTick(raw ?? EMPTY_INTENT));
      }
      return {
        score: world.score, time: world.time, kills: world.kills,
        hp: world.player.hp, wave: world.wave.n, headshots: world.headshots,
        shotsFired: world.shotsFired, shotsHit: world.shotsHit,
        enemiesAlive: world.enemies.filter((e) => e.state !== "dead").length,
        over: world.over, events: allEvents,
      };
    },
    /** 逐 tick 快照（确定性测试用：两跑逐字段比对）*/
    snapshot() {
      return {
        time: world.time,
        score: world.score, kills: world.kills, headshots: world.headshots,
        shotsFired: world.shotsFired, shotsHit: world.shotsHit,
        hp: world.player.hp, ammo: world.player.ammo, reserve: world.player.reserve,
        px: +world.player.x.toFixed(6), pz: +world.player.z.toFixed(6), yaw: +world.player.yaw.toFixed(6),
        waveN: world.wave.n, waveState: world.wave.state, spawned: world.wave.spawned,
        enemies: world.enemies.map((e) => ({ id: e.id, x: +e.x.toFixed(6), z: +e.z.toFixed(6), hp: e.hp, state: e.state })),
      };
    },
  };
}
