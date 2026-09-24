// wave.js — 波次调度 + 敌兵 AI（确定性）。第 n 波规模 = min(BASE+(n-1)*GROWTH, CAP)，速度随波次成长。
// tick 口径：1 tick = FIXED_STEP 秒；时长→tick 换算统一走 tickOf()，避免各处浮点累积口径不一。

import { spawnEnemy, losBlocked, moveWithCollision } from "./world.js";
import {
  FIXED_STEP, WAVE_REST, WAVE_SIZE_BASE, WAVE_SIZE_GROWTH, WAVE_SIZE_CAP,
  SPAWN_INTERVAL, SPAWN_DISTANCE,
  ENEMY_SPEED, ENEMY_SPEED_GROWTH, ENEMY_ATTACK_DIST, ENEMY_FIRE_INTERVAL,
  ENEMY_HIT_CHANCE, ENEMY_DAMAGE, WAVE_CLEAR_BONUS, WAVE_CLEAR_HEAL, PLAYER_MAX_HP,
} from "../numeric.js";

export function tickOf(seconds) {
  return Math.max(1, Math.round(seconds / FIXED_STEP));
}

export function waveSize(n) {
  return Math.min(WAVE_SIZE_BASE + (n - 1) * WAVE_SIZE_GROWTH, WAVE_SIZE_CAP);
}

export function enemySpeedForWave(n) {
  return ENEMY_SPEED + ENEMY_SPEED_GROWTH * (n - 1);
}

/** 波次推进：rest（休整倒计时）→ active（按 SPAWN_INTERVAL 出兵，全灭 → 奖励 → 下一波 rest）*/
export function stepWave(world, events) {
  const w = world.wave;
  if (w.state === "rest") {
    w.restT -= 1;
    if (w.restT <= 0) startWave(world, events);
    return;
  }
  if (w.spawned < w.toSpawn) {
    w.spawnT -= 1;
    if (w.spawnT <= 0) {
      spawnEnemy(world, w.spawned);
      w.spawned += 1;
      w.spawnT = tickOf(SPAWN_INTERVAL);
      events.push({ type: "enemySpawn" });
    }
  }
  if (w.spawned >= w.toSpawn && world.enemies.length === 0) {
    world.score += WAVE_CLEAR_BONUS;
    const healed = Math.min(PLAYER_MAX_HP - world.player.hp, WAVE_CLEAR_HEAL);
    world.player.hp += healed; // 清波回血（spec v3 数值 WAVE_CLEAR_HEAL）
    events.push({ type: "waveClear", wave: w.n, bonus: WAVE_CLEAR_BONUS, healed });
    w.state = "rest";
    w.restT = tickOf(WAVE_REST);
  }
}

function startWave(world, events) {
  const w = world.wave;
  w.n += 1;
  w.state = "active";
  w.toSpawn = waveSize(w.n);
  w.spawned = 0;
  w.spawnT = 1; // 本子步立即出第一个
  events.push({ type: "waveStart", wave: w.n, size: w.toSpawn });
}

/** 出生点轮转：第 k 个敌兵用 (k % spawns.length) 号出生点（确定性轮转，供测试断言）*/
export function spawnIndexFor(k) {
  return k % 3;
}

/** 敌兵 AI：追击 → 进入交火距离且有视线 → 站定开火；无视线则绕行接近 */
export function stepEnemies(world, events) {
  const p = world.player;
  const speed = enemySpeedForWave(world.wave.n);
  for (const e of world.enemies) {
    if (e.state === "dead") { e.deadT += 1; continue; }
    const dx = p.x - e.x, dz = p.z - e.z;
    const dist = Math.hypot(dx, dz) || 1e-6;
    e.yaw = Math.atan2(dx, dz);
    if (e.hitFlashT > 0) e.hitFlashT -= 1;

    const blocked = losBlocked(world, e.x, e.z, p.x, p.z);
    if (dist > ENEMY_ATTACK_DIST || blocked) {
      const strafe = (world.rng() - 0.5) * 0.6;
      const ang = e.yaw + strafe;
      moveWithCollision(world, e, Math.sin(ang) * speed * FIXED_STEP, Math.cos(ang) * speed * FIXED_STEP);
      e.state = "chase";
      e.fireT = Math.max(e.fireT, 1);
    } else {
      e.state = "engage";
      e.fireT -= 1;
      if (e.fireT <= 0) {
        e.fireT = tickOf(ENEMY_FIRE_INTERVAL);
        if (world.rng() < ENEMY_HIT_CHANCE) {
          p.hp = Math.max(0, p.hp - ENEMY_DAMAGE);
          p.hitFlashT = tickOf(0.25);
          events.push({ type: "playerHit", damage: ENEMY_DAMAGE, hp: p.hp, by: e.id });
          if (p.hp <= 0 && !world.over) {
            world.over = true;
            events.push({ type: "gameOver", score: world.score, wave: world.wave.n, kills: world.kills, time: world.time });
          }
        } else {
          events.push({ type: "enemyMiss", by: e.id });
        }
      }
    }
  }
  world.enemies = world.enemies.filter((e) => e.state !== "dead" || e.deadT < tickOf(3));
}

export { SPAWN_DISTANCE };
