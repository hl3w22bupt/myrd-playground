// e-kernel-sim — stepSim 纯函数步进（敌军推进×索敌开火×命中×经济×漏怪，全可机判）
// spec: entities/e-kernel-sim · ×1/×2 加速=步频倍率非步长改变（stepSim 单步 16ms 恒定，
//       加速在 loop 装配层按倍率取 tick 数）· 零 Math.random/Date.now（随机面=state.rngState）

import type { GameConfig, EnemyKind } from "./config.ts";
import { rngDraw } from "./loop.ts";
import { createRun, stateHashOf, type SimState } from "./state.ts";
import { enemyMaxHp, enemySpeedPxPerTick, type Enemy } from "../entities/enemy.ts";
import { dmgPerShot, fireIntervalTicks, rangeTiles, type Turret } from "../entities/turret.ts";
import { flightTicks, type Projectile } from "../entities/projectile.ts";
import { waveComposition, spawnIntervalTicks } from "../systems/waveDirector.ts";
import { killReward, placeCost, upCost } from "../systems/economy.ts";
import { isBuildable, tileCenter, pointAt, PATH_TOTAL_PX, rangePx } from "../world/grid.ts";

/** 单 tick 推进（纯函数口径：读改入参状态并返回同一引用；确定性只取决于状态+cfg） */
export function stepSim(state: SimState, cfg: GameConfig): SimState {
  if (state.status !== "running") return state;
  state.tick += 1;
  const flashTicks = Math.max(1, Math.round(cfg.feedback.hitFlashMs / cfg.fixedStepMs));
  const fadeTicks = Math.max(1, Math.round(cfg.pacing.fadeMs / cfg.fixedStepMs));

  // —— fx 计时衰减（tick 派生 → 确定性）——
  const fx = state.fx;
  if (fx.placeTicksLeft > 0) fx.placeTicksLeft -= 1;
  if (fx.upgradeTicksLeft > 0) fx.upgradeTicksLeft -= 1;
  if (fx.coreFlashTicks > 0) fx.coreFlashTicks -= 1;
  if (fx.killPulseTicks > 0) fx.killPulseTicks -= 1;
  if (fx.guidanceFadeTicks > 0) fx.guidanceFadeTicks -= 1;
  if (fx.settlementFadeTicks > 0) fx.settlementFadeTicks -= 1;
  fx.hitFlashes = fx.hitFlashes.filter((f) => --f.ticksLeft > 0);
  fx.traces = fx.traces.filter((t) => --t.ticksLeft > 0);
  fx.particles = fx.particles.filter((p) => { p.x += p.vx; p.y += p.vy; return --p.ticksLeft > 0; });

  // —— 波次状态机 ——
  if (state.phase === "prep" || state.phase === "intermission") {
    state.phaseTicksLeft -= 1;
    if (state.phaseTicksLeft <= 0) startWave(state, cfg, state.waveIndex + 1);
  } else if (state.phase === "spawning") {
    state.waveElapsedMs += cfg.fixedStepMs;
    state.spawnTimerTicks -= 1;
    if (state.spawnTimerTicks <= 0 && state.spawnQueue.length > 0) {
      const kind = state.spawnQueue.shift() as EnemyKind;
      spawnEnemy(state, cfg, kind);
      state.spawnTimerTicks = spawnIntervalTicks(cfg, state.waveIndex, state.waveElapsedMs);
    }
    if (state.spawnQueue.length === 0) state.phase = "clearing";
  } else if (state.phase === "clearing") {
    if (!state.enemies.some((e) => e.alive)) {
      state.events.push({ tick: state.tick, type: "wave-clear", wave: state.waveIndex });
      if (state.waveIndex === 1 && state.firstLoopTick === 0) state.firstLoopTick = state.tick;
      if (state.waveIndex >= cfg.victoryWaves) {
        state.status = "victory";
        state.phase = "over";
        state.endTick = state.tick;
        state.fx.settlementFadeTicks = fadeTicks;
        state.events.push({ tick: state.tick, type: "run-end", reason: "victory" });
      } else {
        state.phase = "intermission";
        state.phaseTicksLeft = Math.round(cfg.pacing.waveIntermissionMs / cfg.fixedStepMs);
      }
    }
  }

  // —— 敌军推进（路径推进序=索敌优先序的确定来源）——
  for (const e of state.enemies) {
    if (!e.alive) continue;
    e.pathDistPx += e.speedPxPerTick;
    if (e.pathDistPx >= PATH_TOTAL_PX) {
      e.alive = false;
      e.endTick = state.tick;
      e.endReason = "leaked";
      state.leaks += 1;
      state.coreLives -= 1;
      fx.coreFlashTicks = flashTicks;
      state.events.push({ tick: state.tick, type: "leak", enemyId: e.id, coreLives: state.coreLives });
      if (state.coreLives <= 0) {
        state.status = "defeat";
        state.phase = "over";
        state.endTick = state.tick;
        fx.settlementFadeTicks = fadeTicks;
        state.events.push({ tick: state.tick, type: "run-end", reason: "defeat" });
        break;
      }
    }
  }

  if (state.status === "running") {
    stepTurrets(state, cfg);
    stepProjectiles(state, cfg, flashTicks);
  }

  if (state.recordHashes) state.tickHashes.push(stateHashOf(state));
  return state;
}

/** 开波：编成序列由状态内嵌 RNG 驱动（同 seed 同序列） */
export function startWave(state: SimState, cfg: GameConfig, wave: number): void {
  state.waveIndex = wave;
  state.phase = "spawning";
  state.waveElapsedMs = 0;
  state.spawnTimerTicks = 0;
  state.spawnQueue = waveComposition(cfg, wave, () => rngDraw(state)) as EnemyKind[];
  state.events.push({ tick: state.tick, type: "wave-start", wave, count: state.spawnQueue.length });
}

function spawnEnemy(state: SimState, cfg: GameConfig, kind: EnemyKind): void {
  const i = state.spawnLog.filter((r) => r.wave === state.waveIndex).length;
  const e: Enemy = {
    id: state.nextEnemyId,
    kind,
    wave: state.waveIndex,
    hp: enemyMaxHp(cfg, kind, state.waveIndex),
    maxHp: enemyMaxHp(cfg, kind, state.waveIndex),
    pathDistPx: 0,
    speedPxPerTick: enemySpeedPxPerTick(cfg, kind),
    sizePx: cfg.enemy.types[kind].sizePx,
    spawnTick: state.tick,
    alive: true,
    endTick: 0,
    endReason: "",
  };
  state.nextEnemyId += 1;
  state.enemies.push(e);
  state.spawnLog.push({ wave: state.waveIndex, i, kind, tick: state.tick });
  state.events.push({ tick: state.tick, type: "spawn", enemyId: e.id, kind });
}

/** 索敌开火：路径推进序首个进射程者（最远 pathDist；平手取低 id）——同 seed 序列确定 */
function stepTurrets(state: SimState, cfg: GameConfig): void {
  for (const t of state.turrets) {
    if (t.cooldownTicks > 0) { t.cooldownTicks -= 1; continue; }
    const r = rangePx(rangeTiles(cfg, t.level));
    let target: Enemy | null = null;
    for (const e of state.enemies) {
      if (!e.alive) continue;
      const p = pointAt(e.pathDistPx);
      const d = Math.hypot(p.x - t.x, p.y - t.y);
      if (d > r) continue;
      if (target === null || e.pathDistPx > target.pathDistPx || (e.pathDistPx === target.pathDistPx && e.id < target.id)) target = e;
    }
    if (target === null) continue;
    const tp = pointAt(target.pathDistPx);
    const proj: Projectile = {
      id: state.nextProjectileId,
      turretId: t.id,
      targetId: target.id,
      x1: t.x, y1: t.y, x2: tp.x, y2: tp.y,
      damage: dmgPerShot(cfg, t.level),
      spawnTick: state.tick,
      arrivalTick: state.tick + flightTicks(Math.hypot(tp.x - t.x, tp.y - t.y), cfg.pacing.projectileSpeedPxPerSec, cfg.fixedStepMs),
      spent: false,
    };
    state.nextProjectileId += 1;
    state.projectiles.push(proj);
    t.cooldownTicks = fireIntervalTicks(cfg, t.level);
    state.fireLog.push({ tick: state.tick, turretId: t.id, targetId: target.id });
    fxTrace(state, t.x, t.y, tp.x, tp.y, Math.max(1, Math.round(cfg.pacing.traceMs / cfg.fixedStepMs)));
    state.events.push({ tick: state.tick, type: "fire", turretId: t.id, targetId: target.id });
  }
}

function fxTrace(state: SimState, x1: number, y1: number, x2: number, y2: number, ticks: number): void {
  state.fx.traces.push({ x1, y1, x2, y2, ticksLeft: ticks });
}

/** 命中按 tick 离散结算：arrivalTick 到点一次性判定（零浮点漂移面） */
function stepProjectiles(state: SimState, cfg: GameConfig, flashTicks: number): void {
  const alive = state.projectiles.filter((p) => !p.spent && state.tick >= p.arrivalTick);
  for (const p of alive) {
    p.spent = true;
    const e = state.enemies.find((x) => x.id === p.targetId);
    if (!e || !e.alive) continue;
    const t = state.turrets.find((x) => x.id === p.turretId);
    const applied = Math.min(e.hp, p.damage);
    e.hp -= p.damage;
    if (t) { t.totalDamage += applied; t.kills += 0; }
    state.fx.hitFlashes.push({ enemyId: e.id, ticksLeft: flashTicks });
    if (e.hp <= 0) {
      e.alive = false;
      e.endTick = state.tick;
      e.endReason = "killed";
      const reward = killReward(cfg, e.wave);
      state.gold += reward;
      state.goldEarned += reward;
      state.kills += 1;
      if (t) t.kills += 1;
      state.fx.killPulseTicks = flashTicks;
      state.dropLog.push({ tick: state.tick, enemyId: e.id, gold: reward });
      spawnParticles(state, e.id, p.x2, p.y2);
      state.events.push({ tick: state.tick, type: "kill", enemyId: e.id, gold: reward });
    } else {
      state.events.push({ tick: state.tick, type: "hit", enemyId: e.id });
    }
  }
  state.projectiles = state.projectiles.filter((p) => !p.spent);
}

/** 命中粒子 3 颗（方向由敌 id 决定=确定性；a4 通道「particles」） */
function spawnParticles(state: SimState, enemyId: number, x: number, y: number): void {
  for (let i = 0; i < 3; i += 1) {
    const angle = ((enemyId * 3 + i) * 2.0943951023931953); // 2π/3 步进
    state.fx.particles.push({
      x, y,
      vx: Math.cos(angle) * 1.2,
      vy: Math.sin(angle) * 1.2,
      ticksLeft: Math.max(1, Math.round(220 / 16)),
    });
  }
}

// ======== 玩家行动面（操作路径 5 条的内核承接；全部确定性、同 tick 反馈=延迟 0 语义） ========

export interface ActionResult { ok: boolean; reason?: string; latencyMs: number }

/** 布防（path-place-turret-01）：可建∧足额 → 落位；首次布防记 firstPlacementTick（a1 锚） */
export function placeTurret(state: SimState, cfg: GameConfig, col: number, row: number): ActionResult {
  if (state.status !== "running") return { ok: false, reason: "run-over", latencyMs: 0 };
  if (!isBuildable(col, row, new Set(state.occupied))) return { ok: false, reason: "not-buildable", latencyMs: 0 };
  const cost = placeCost(cfg);
  if (state.gold < cost) return { ok: false, reason: "gold-insufficient", latencyMs: 0 };
  state.gold -= cost;
  state.goldSpent += cost;
  const c = tileCenter(col, row);
  const t: Turret = {
    id: state.nextTurretId, col, row, level: 1, x: c.x, y: c.y,
    cooldownTicks: 0, investedGold: cost, kills: 0, totalDamage: 0,
  };
  state.nextTurretId += 1;
  state.turrets.push(t);
  state.occupied.push(`${col},${row}`);
  state.fx.placeTileKey = `${col},${row}`;
  state.fx.placeTicksLeft = Math.max(1, Math.round(cfg.pacing.bounceMs / cfg.fixedStepMs));
  dismissGuidance(state);
  if (state.firstPlacementTick === 0) state.firstPlacementTick = state.tick;
  state.events.push({ tick: state.tick, type: "place", turretId: t.id, col, row });
  return { ok: true, latencyMs: 0 };
}

/** 升级（path-upgrade-turret-01）：等级+1 属性刷新；不足额 fail-closed */
export function upgradeTurret(state: SimState, cfg: GameConfig, turretId: number): ActionResult {
  const t = state.turrets.find((x) => x.id === turretId);
  if (!t) return { ok: false, reason: "no-turret", latencyMs: 0 };
  if (t.level >= cfg.turret.levels) return { ok: false, reason: "max-level", latencyMs: 0 };
  const cost = upCost(cfg, t.level);
  if (state.gold < cost) return { ok: false, reason: "gold-insufficient", latencyMs: 0 };
  state.gold -= cost;
  state.goldSpent += cost;
  t.level += 1;
  t.investedGold += cost;
  state.fx.upgradeTurretId = t.id;
  state.fx.upgradeTicksLeft = Math.max(1, Math.round(cfg.pacing.bounceMs / cfg.fixedStepMs));
  dismissGuidance(state);
  state.events.push({ tick: state.tick, type: "upgrade", turretId: t.id, level: t.level });
  return { ok: true, latencyMs: 0 };
}

/** 加速（path-speed-toggle-01）：步频倍率 ×1↔×2（步长 16ms 不变） */
export function toggleSpeed(state: SimState): ActionResult {
  state.speed = state.speed === 1 ? 2 : 1;
  dismissGuidance(state);
  state.events.push({ tick: state.tick, type: "speed-toggle", speed: state.speed });
  return { ok: true, latencyMs: 0 };
}

/** 引导消散（path-guidance-dismiss-01）：首次有效操作即淡出且不再复现 */
export function dismissGuidance(state: SimState): void {
  if (!state.fx.guidanceHidden) {
    state.fx.guidanceHidden = true;
    state.fx.guidanceFadeTicks = Math.max(1, Math.round(200 / 16));
    state.events.push({ tick: state.tick, type: "guidance-dismiss" });
  }
}

/** 重开（path-restart-01）：全复位同 seed；restartCount 累加（a5 count 1→2 锚） */
export function restartRun(state: SimState, cfg: GameConfig): { state: SimState; result: ActionResult } {
  const next = createRun(cfg, state.seed, state.recordHashes);
  next.restartCount = state.restartCount + 1;
  next.events.push({ tick: 0, type: "restart", count: next.restartCount });
  return { state: next, result: { ok: true, latencyMs: 0 } };
}

/** 结算摘要（copy-result-win/lose + copy-core-label/copy-gold-label 三信息面） */
export function settlementView(state: SimState): { win: boolean; coreLives: number; gold: number; kills: number; durationMs: number } {
  return {
    win: state.status === "victory",
    coreLives: state.coreLives,
    gold: state.gold,
    kills: state.kills,
    durationMs: (state.endTick || state.tick) * 16,
  };
}
