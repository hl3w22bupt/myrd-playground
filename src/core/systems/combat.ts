/**
 * core/systems/combat —— 射击节流、弹道射线、命中判定（包围盒 + 部位 + 距离衰减）、
 * 换弹/切枪、后坐力 bloom。AC4 数值全部来自 content/weapons。
 */

import { EYE_HEIGHT, PART_MULTIPLIERS, TARGET_HALF_WIDTH, TARGET_HEIGHT } from '../../content/constants';
import type { World, Entity, WeaponSlot } from '../world';
import type { BodyPart, Vec3, WeaponId } from '../types';
import { aimDir, clamp, rayAABB, rayVerticalBox, dist3D } from '../geom';
import { terrainHeightAt } from '../mapgen';
import { pushEvent } from '../world';

/** 切枪耗时（ms） */
export const SWITCH_WEAPON_MS = 350;
/** bloom 上限（散布放大倍数） */
const MAX_BLOOM = 2.2;
const BLOOM_DECAY_PER_SEC = 2.4;

interface HitResult {
  point: Vec3;
  dist: number;
  entity: Entity | null;
}

export function activeWeapon(e: Entity): WeaponSlot | null {
  return e.weapons[e.activeWeapon];
}

export function weaponDef(w: World, id: WeaponId) {
  return w.pack.weapons[id as keyof typeof w.pack.weapons];
}

export function updateCombat(w: World): void {
  const dtSec = w.pack.constants.TICK_MS / 1000;

  for (const e of w.entities) {
    if (!e.alive) continue;

    // 主动换弹请求
    if (e.wantReload) {
      e.wantReload = false;
      startReload(w, e);
    }

    // 换弹完成
    if (e.reloadUntilMs !== null && w.elapsedMs >= e.reloadUntilMs) {
      finishReload(w, e);
    }

    // 切枪
    if (e.wantSwitch !== null) {
      const slot = e.wantSwitch === 1 ? 1 : 0;
      if (slot !== e.activeWeapon && w.elapsedMs >= e.switchReadyAtMs) {
        e.activeWeapon = slot as 0 | 1;
        e.reloadUntilMs = null;
        e.switchReadyAtMs = w.elapsedMs + SWITCH_WEAPON_MS;
        e.fireReadyAtMs = Math.max(e.fireReadyAtMs, e.switchReadyAtMs);
      }
      e.wantSwitch = null;
    }

    if (e.state !== 'ground') {
      e.firing = false;
      continue;
    }

    if (e.firing) tryFire(w, e);

    // 后坐力 bloom 衰减
    e.bloom = Math.max(0, e.bloom - BLOOM_DECAY_PER_SEC * dtSec);
  }
}

export function tryFire(w: World, e: Entity): boolean {
  const slot = activeWeapon(e);
  if (!slot) return false;
  const def = weaponDef(w, slot.weapon);
  if (w.elapsedMs < e.fireReadyAtMs || e.reloadUntilMs !== null) return false;

  if (slot.magazine <= 0) {
    startReload(w, e);
    return false;
  }

  slot.magazine -= 1;
  e.fireReadyAtMs = w.elapsedMs + 60_000 / def.rpm;

  const origin: Vec3 = { x: e.pos.x, y: e.pos.y + EYE_HEIGHT, z: e.pos.z };
  const sigma = def.spread * (1 + e.bloom);
  const gx = w.rng.combat.gaussian() * sigma;
  const gy = w.rng.combat.gaussian() * sigma;
  const base = aimDir(e.yaw, e.pitch);
  // 在视线的垂直平面内施加高斯散布
  const dir = perturb(base, gx, gy);

  const hit = castShot(w, e, origin, dir, def.maxRange);
  const end: Vec3 = hit
    ? hit.point
    : { x: origin.x + dir.x * def.maxRange, y: origin.y + dir.y * def.maxRange, z: origin.z + dir.z * def.maxRange };

  // 后坐力：散布扩张 + 瞄准上抬（数值来自武器 recoil）
  e.bloom = Math.min(MAX_BLOOM, e.bloom + def.recoil * 0.9);
  e.pitch += def.recoil * 0.006;

  pushEvent(w, {
    type: 'shotFired',
    entityId: e.id,
    weapon: slot.weapon,
    origin,
    dir,
    end,
    hitEntity: !!hit?.entity,
  });

  if (hit?.entity) {
    const t = hit.dist;
    const falloff = t <= def.effectiveRange
      ? 1
      : clamp(1 - 0.5 * ((t - def.effectiveRange) / def.effectiveRange), 0.5, 1);
    const part = bodyPartAt(hit.entity, hit.point);
    const dmg = def.damage * PART_MULTIPLIERS[part] * falloff;
    applyDamage(w, hit.entity, dmg, part, e);
  }
  return true;
}

/** 在视线垂直平面内扰动方向（gx：水平右向，gy：垂直上向，单位 rad） */
export function perturb(base: Vec3, gx: number, gy: number): Vec3 {
  // worldUp × base → right
  let rx = -base.z;
  const ry = 0;
  let rz = base.x;
  const rl = Math.hypot(rx, rz) || 1;
  rx /= rl;
  rz /= rl;
  // right × base → up
  const ux = ry * base.z - rz * base.y;
  const uy = rz * base.x - rx * base.z;
  const uz = rx * base.y - ry * base.x;
  return {
    x: base.x + rx * gx + ux * gy,
    y: base.y + ry * gx + uy * gy,
    z: base.z + rz * gx + uz * gy,
  };
}

export function bodyPartAt(target: Entity, point: Vec3): BodyPart {
  const relY = point.y - target.pos.y;
  if (relY > TARGET_HEIGHT * 0.86) return 'head';
  if (relY > TARGET_HEIGHT * 0.42) return 'torso';
  return 'limb';
}

/**
 * 弹道射线：先地形/建筑遮挡，再实体包围盒，取最近命中。
 * 性能：以标量（bestT/bestEntity）追踪最近命中，只对最终命中构造一次 HitResult + point。
 * 此前每个「更近命中」都分配一个 HitResult + 命中点对象，每发子弹最多可产生 ~10 次分配。
 */
export function castShot(w: World, shooter: Entity, origin: Vec3, dir: Vec3, maxRange: number): HitResult | null {
  let bestT = -1;
  let bestEntity: Entity | null = null;

  for (const b of w.buildings) {
    const t = rayAABB(origin, dir, b, maxRange);
    if (t >= 0 && (bestT < 0 || t < bestT)) {
      bestT = t;
      bestEntity = null;
    }
  }

  // 地形粗采样 + 一次二分细化
  const step = 6;
  let prevT = 0;
  let prevAbove = origin.y - terrainHeightAt(w.pack, origin.x, origin.z) > 0;
  for (let t = step; t <= maxRange; t += step) {
    const px = origin.x + dir.x * t;
    const py = origin.y + dir.y * t;
    const pz = origin.z + dir.z * t;
    const above = py - terrainHeightAt(w.pack, px, pz) > 0;
    if (!above) {
      let lo = prevT;
      let hi = t;
      for (let i = 0; i < 6; i++) {
        const mid = (lo + hi) / 2;
        const mx = origin.x + dir.x * mid;
        const my = origin.y + dir.y * mid;
        const mz = origin.z + dir.z * mid;
        if (my - terrainHeightAt(w.pack, mx, mz) > 0) lo = mid;
        else hi = mid;
      }
      const tHit = (lo + hi) / 2;
      if (bestT < 0 || tHit < bestT) {
        bestT = tHit;
        bestEntity = null;
      }
      break;
    }
    prevT = t;
    prevAbove = above;
  }
  void prevAbove;

  for (const target of w.entities) {
    if (!target.alive || target === shooter) continue;
    if (target.state === 'plane') continue;
    const t = rayVerticalBox(origin, dir, target.pos, TARGET_HALF_WIDTH, TARGET_HEIGHT, maxRange);
    if (t >= 0 && (bestT < 0 || t < bestT)) {
      bestT = t;
      bestEntity = target;
    }
  }

  if (bestT < 0 || bestT > maxRange) return null;
  return {
    dist: bestT,
    entity: bestEntity,
    point: { x: origin.x + dir.x * bestT, y: origin.y + dir.y * bestT, z: origin.z + dir.z * bestT },
  };
}

/** 视线是否被建筑/地形遮挡（AI 感知用） */
export function hasLineOfSight(w: World, from: Vec3, to: Vec3): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (len < 1e-4) return true;
  const dir = { x: dx / len, y: dy / len, z: dz / len };
  for (const b of w.buildings) {
    const t = rayAABB(from, dir, b, len);
    if (t >= 0 && t < len - 0.5) return false;
  }
  const steps = 8;
  for (let i = 1; i <= steps; i++) {
    const t = (i / steps) * len;
    const px = from.x + dir.x * t;
    const py = from.y + dir.y * t;
    const pz = from.z + dir.z * t;
    if (py < terrainHeightAt(w.pack, px, pz)) return false;
  }
  return true;
}

export function startReload(w: World, e: Entity): boolean {
  const slot = activeWeapon(e);
  if (!slot || e.reloadUntilMs !== null) return false;
  const def = weaponDef(w, slot.weapon);
  if (slot.magazine >= def.magazine) return false;
  if ((e.ammoReserve[def.ammoType] ?? 0) <= 0) return false;
  e.reloadUntilMs = w.elapsedMs + def.reloadMs;
  return true;
}

function finishReload(w: World, e: Entity): void {
  const slot = activeWeapon(e);
  e.reloadUntilMs = null;
  if (!slot) return;
  const def = weaponDef(w, slot.weapon);
  const need = def.magazine - slot.magazine;
  const reserve = e.ammoReserve[def.ammoType] ?? 0;
  const take = Math.min(need, reserve);
  slot.magazine += take;
  e.ammoReserve[def.ammoType] = reserve - take;
}

export function applyDamage(
  w: World,
  target: Entity,
  amount: number,
  part: BodyPart,
  by: Entity | null,
): void {
  if (!target.alive) return;
  const reduction = part === 'head' ? target.helmetReduction : part === 'torso' ? target.armorReduction : 0;
  const dmg = amount * (1 - reduction);
  target.hp -= dmg;
  const lethal = target.hp <= 0;
  pushEvent(w, {
    type: 'damageDealt',
    target: target.id,
    byId: by ? by.id : '',
    amount: dmg,
    bodyPart: part,
    lethal,
  });
  if (lethal) eliminate(w, target, by ? by.id : '', 'shot');
}

export function eliminate(w: World, target: Entity, byId: string, cause: 'shot' | 'zone'): void {
  if (!target.alive) return;
  // 存活数与击杀者一次遍历同时求出（去 reduce/find 闭包分配；顺序与旧实现一致：先计数后置亡）
  let aliveCount = 0;
  let killer: Entity | null = null;
  const ents = w.entities;
  for (let i = 0; i < ents.length; i++) {
    const e = ents[i];
    if (e.alive) aliveCount += 1;
    if (byId !== '' && killer === null && e.id === byId) killer = e;
  }
  target.alive = false;
  target.state = 'dead';
  target.rank = aliveCount;
  target.eliminatedAtMs = w.elapsedMs;
  target.eliminatedBy = byId;
  target.firing = false;
  target.aiState = 'dead';
  if (killer && killer !== target) killer.kills += 1;
  pushEvent(w, { type: 'entityEliminated', entityId: target.id, byId, cause });
  void dist3D;
}
