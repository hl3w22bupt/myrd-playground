// combat.js — 武器与命中判定（确定性 hitscan）。射速节流 / 弹匣记账 / 换弹 / 射线-圆柱命中 / 部位倍率 / 得分。

import { losBlocked } from "./world.js";
import {
  FIXED_STEP, FIRE_INTERVAL, RELOAD_TIME, MAG_SIZE, BULLET_DAMAGE, HEADSHOT_MULT, BULLET_RANGE,
  SPREAD_BASE, SPREAD_MOVE_ADD, HIT_SCORE, KILL_SCORE, HEADSHOT_BONUS,
  EYE_HEIGHT, ENEMY_HIT_RADIUS, HEAD_HEIGHT_MIN, HEAD_HEIGHT_MAX,
} from "../numeric.js";
import { rngSymmetric } from "./rng.js";

/** 秒 → tick（射速/换弹计时统一口径）*/
const TICKS = (s) => Math.round(s / FIXED_STEP);

/** 开火意图结算。返回是否真的开出一发（供表现层做枪口特效同步）。*/
export function tryFire(world, intent, events) {
  const p = world.player;
  if (world.over || p.reloading || p.fireT > 0) return false;
  if (intent.firing !== true) return false;
  if (p.ammo <= 0) { startReload(world, events); return false; }

  p.ammo -= 1;
  p.fireT = TICKS(FIRE_INTERVAL);
  world.shotsFired += 1;
  events.push({ type: "shot" }); // 表现层用它同步枪口特效/后坐/音效（命中事件另行上抛）
  fireHitscan(world, intent, events);
  if (p.ammo === 0) startReload(world, events); // 打空当 tick 立即自动换弹（避免下一次死扣）
  return true;
}

export function startReload(world, events) {
  const p = world.player;
  if (p.reloading || p.reserve <= 0 || p.ammo >= MAG_SIZE) return false;
  p.reloading = true;
  p.reloadT = TICKS(RELOAD_TIME);
  events.push({ type: "reloadStart" });
  return true;
}

export function stepWeapon(world, intent, events) {
  const p = world.player;
  if (p.fireT > 0) p.fireT -= 1;
  if (p.hitFlashT > 0) p.hitFlashT -= 1;
  if (p.reloading) {
    p.reloadT -= 1;
    if (p.reloadT <= 0) {
      const need = MAG_SIZE - p.ammo;
      const take = Math.min(need, p.reserve);
      p.ammo += take;
      p.reserve -= take;
      p.reloading = false;
      events.push({ type: "reloadEnd", ammo: p.ammo, reserve: p.reserve });
    }
  }
  tryFire(world, intent, events);
}

/**
 * hitscan：由眼位沿 (yaw, pitch + 散布) 打射线，取最近命中者。
 * 命中判定：2D 射线到敌兵圆柱轴的垂距 ≤ ENEMY_HIT_RADIUS，且射线在该距离的高度落在身体带；
 * 高度 ≥ HEAD_HEIGHT_MIN 记爆头。掩体（通高 AABB）遮挡优先于命中。
 */
export function fireHitscan(world, intent, events) {
  const p = world.player;
  const spread = SPREAD_BASE + (p.moving ? SPREAD_MOVE_ADD : 0);
  const yaw = intent.yaw + rngSymmetric(world.rng) * spread;
  const pitch = (intent.pitch ?? 0) + rngSymmetric(world.rng) * spread;
  const dx = Math.sin(yaw), dz = Math.cos(yaw);
  const slope = Math.tan(pitch); // 高度随距离的斜率（水平距离）

  // 最近遮挡距离（掩体）
  let wallT = Infinity;
  for (const c of world.covers) {
    const t = rayAabbT(p.x, p.z, dx, dz, c);
    if (t !== null && t < wallT) wallT = t;
  }

  let best = null;
  for (const e of world.enemies) {
    if (e.state === "dead") continue;
    const ex = e.x - p.x, ez = e.z - p.z;
    const along = ex * dx + ez * dz;                 // 沿射线的水平投影距离
    if (along <= 0 || along > BULLET_RANGE) continue;
    if (along >= wallT) continue;                     // 被掩体挡住
    const perp = Math.abs(ex * dz - ez * dx);         // 垂距
    if (perp > ENEMY_HIT_RADIUS) continue;
    const hitH = EYE_HEIGHT + slope * along;          // 命中点高度
    if (hitH < 0 || hitH > HEAD_HEIGHT_MAX) continue; // 打地/打过顶
    if (!best || along < best.along) {
      best = { enemy: e, along, headshot: hitH >= HEAD_HEIGHT_MIN };
    }
  }

  if (!best) { events.push({ type: "shotMiss" }); return null; }
  const e = best.enemy;
  const dmg = BULLET_DAMAGE * (best.headshot ? HEADSHOT_MULT : 1);
  e.hp -= dmg;
  e.hitFlashT = 6;
  world.shotsHit += 1;
  let gained = HIT_SCORE;
  if (best.headshot) { world.headshots += 1; gained += HEADSHOT_BONUS; }
  if (e.hp <= 0) {
    e.state = "dead";
    e.deadT = 0;
    world.kills += 1;
    gained += KILL_SCORE;
  }
  world.score += gained;
  events.push({
    type: "enemyHit", id: e.id, damage: dmg, headshot: best.headshot,
    killed: e.state === "dead", score: gained, dist: best.along,
  });
  return best;
}

/** 2D 射线 vs AABB：命中返回 t（0..∞），未命中返回 null */
export function rayAabbT(ox, oz, dx, dz, c) {
  let tmin = 0, tmax = Infinity;
  if (Math.abs(dx) < 1e-9) { if (ox < c.minX || ox > c.maxX) return null; }
  else {
    let t1 = (c.minX - ox) / dx, t2 = (c.maxX - ox) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  if (Math.abs(dz) < 1e-9) { if (oz < c.minZ || oz > c.maxZ) return null; }
  else {
    let t1 = (c.minZ - oz) / dz, t2 = (c.maxZ - oz) / dz;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  return tmin;
}
