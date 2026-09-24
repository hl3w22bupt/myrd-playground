// world.js — 确定性世界状态（纯数据 + 纯函数）。零 three、零 DOM、零系统随机源、零系统时钟（时间由步进注入）。
// 事件上抛：step 产物 events[]，主控翻译成 HUD/音效/粒子 —— 内核不依赖任何表现层。

import { createRng } from "./rng.js";
import { LEVEL_ID, DECK_BOUNDS, PLAYER_START, ENEMY_SPAWNS, COVERS, clampToDeck } from "../levels/level-01-deck.js";
import {
  PLAYER_MAX_HP, PLAYER_RADIUS, MAG_SIZE, RESERVE_AMMO,
  ENEMY_HP, ENEMY_ENGAGE_DIST,
} from "../numeric.js";

export function createWorld(seed = 1) {
  const rng = createRng(seed);
  return {
    levelId: LEVEL_ID,
    seed,
    rng,
    time: 0,
    bounds: DECK_BOUNDS,
    covers: COVERS,
    spawns: ENEMY_SPAWNS,
    player: {
      x: PLAYER_START.x, z: PLAYER_START.z, yaw: PLAYER_START.yaw, pitch: 0,
      hp: PLAYER_MAX_HP, radius: PLAYER_RADIUS,
      ammo: MAG_SIZE, reserve: RESERVE_AMMO,
      reloading: false, reloadT: 0, fireT: 0,
      moving: false, sprinting: false,
      hitFlashT: 0,
    },
    enemies: [],
    nextEnemyId: 1,
    wave: { n: 0, state: "rest", restT: 0, toSpawn: 0, spawned: 0, spawnT: 0 },
    score: 0, kills: 0, shotsFired: 0, shotsHit: 0, headshots: 0,
    over: false,
    // 对局状态机（唯一字段）：playing | paused | gameover —— 任一时刻只有一个明确状态，
    // 由 loop.js 的 pause/resume/restart 与 over→gameover 收敛维护；非 playing 一律拒意图、停推进。
    state: "playing",
  };
}

export function spawnEnemy(world, spawnIndex) {
  const spot = world.spawns[spawnIndex % world.spawns.length];
  const jitterX = (world.rng() - 0.5) * 2.2;
  const jitterZ = (world.rng() - 0.5) * 2.2;
  const pos = clampToDeck(spot.x + jitterX, spot.z + jitterZ, 0.4);
  const e = {
    id: world.nextEnemyId++,
    x: pos.x, z: pos.z,
    yaw: 0,
    hp: ENEMY_HP,
    state: "chase",       // chase → engage（进入交火距离）→ dead
    fireT: 0,
    hitFlashT: 0,
    deadT: 0,
    engageDist: ENEMY_ENGAGE_DIST,
  };
  world.enemies.push(e);
  return e;
}

/** 敌兵到玩家的视线是否被掩体遮挡（2D 射线 vs AABB，通高口径）*/
export function losBlocked(world, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  for (const c of world.covers) {
    let tmin = 0, tmax = 1, hit = true;
    // x 轴 slab
    if (Math.abs(dx) < 1e-9) { if (ax < c.minX || ax > c.maxX) hit = false; }
    else {
      let t1 = (c.minX - ax) / dx, t2 = (c.maxX - ax) / dx;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
      if (tmin > tmax) hit = false;
    }
    // z 轴 slab
    if (hit) {
      if (Math.abs(dz) < 1e-9) { if (az < c.minZ || az > c.maxZ) hit = false; }
      else {
        let t1 = (c.minZ - az) / dz, t2 = (c.maxZ - az) / dz;
        if (t1 > t2) [t1, t2] = [t2, t1];
        tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
        if (tmin > tmax) hit = false;
      }
    }
    if (hit && tmax > 0.001 && tmin < 0.999) return true;
  }
  return false;
}

/** 点是否在掩体 AABB 内（半径外扩）—— 移动阻挡用 */
export function insideCover(world, x, z, radius) {
  for (const c of world.covers) {
    if (x > c.minX - radius && x < c.maxX + radius && z > c.minZ - radius && z < c.maxZ + radius) return c;
  }
  return null;
}

/** 带掩体滑移的移动：先整体走，被挡则拆 x/z 分量走（保持确定性，无物理引擎）*/
export function moveWithCollision(world, ent, dx, dz) {
  const r = ent.radius ?? 0.4;
  if (!insideCover(world, ent.x + dx, ent.z + dz, r)) {
    const c = clampToDeck(ent.x + dx, ent.z + dz, r);
    ent.x = c.x; ent.z = c.z;
    return;
  }
  if (!insideCover(world, ent.x + dx, ent.z, r)) {
    const c = clampToDeck(ent.x + dx, ent.z, r);
    ent.x = c.x;
  }
  if (!insideCover(world, ent.x, ent.z + dz, r)) {
    const c = clampToDeck(ent.x, ent.z + dz, r);
    ent.z = c.z;
  }
}
