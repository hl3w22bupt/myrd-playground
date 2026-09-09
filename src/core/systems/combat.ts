/**
 * core/systems/combat —— 射击节流、投射物弹道（重力下坠 + 飞行时间）、命中判定
 * （包围盒 + 部位 + 距离衰减）、换弹/切枪、后坐力（bloom + 可恢复瞄准偏移）。
 * AC4 数值全部来自 content/weapons；弹道/后坐力参数来自 content/physics.ballistic。
 */

import { EYE_HEIGHT, PART_MULTIPLIERS, TARGET_HALF_WIDTH, TARGET_HEIGHT } from '../../content/constants';
import type { World, Entity, WeaponSlot, Projectile } from '../world';
import type { BodyPart, Vec3, WeaponId } from '../types';
import { aimDir, clamp, rayAABB, rayVerticalBox, dist3D } from '../geom';
import { terrainHeightAt } from '../mapgen';
import { pushEvent } from '../world';

/** 切枪耗时（ms） */
export const SWITCH_WEAPON_MS = 350;
/** bloom 上限（散布放大倍数） */
const MAX_BLOOM = 2.2;
const BLOOM_DECAY_PER_SEC = 2.4;

let projectileSeq = 0;

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
  const rec = w.pack.physics.ballistic.recoilRecoverPerSec;

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
    // 后坐力瞄准偏移恢复（指数衰减回零）
    const k = Math.max(0, 1 - rec * dtSec);
    e.recoilPitch *= k;
    e.recoilYaw *= k;
    if (Math.abs(e.recoilPitch) < 1e-6) e.recoilPitch = 0;
    if (Math.abs(e.recoilYaw) < 1e-6) e.recoilYaw = 0;
  }

  updateProjectiles(w);
}

export function tryFire(w: World, e: Entity): boolean {
  const slot = activeWeapon(e);
  if (!slot) return false;
  const def = weaponDef(w, slot.weapon);
  if (w.elapsedMs < e.fireReadyAtMs || e.reloadUntilMs !== null) return false;
  // 医疗引导中禁止开火（血包急救线：开火即打断由 applyIntent/cancelChannel 保证）
  if (e.medkitUntilMs !== null) return false;

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
  // 有效瞄准 = 输入瞄准 + 后坐力偏移（后坐力线：连射上抬/抖动真实影响弹着点）
  const base = aimDir(e.yaw + e.recoilYaw, e.pitch + e.recoilPitch);
  // 在视线的垂直平面内施加高斯散布
  const dir = perturb(base, gx, gy);

  // 发射投射物（弹道下坠线：重力积分 + 飞行时间，命中在后续 tick 结算）
  const speed = def.projectileSpeed;
  const proj: Projectile = {
    id: projectileSeq++,
    shooterId: e.id,
    weapon: slot.weapon,
    pos: { ...origin },
    prev: { ...origin },
    vel: { x: dir.x * speed, y: dir.y * speed, z: dir.z * speed },
    traveled: 0,
  };
  w.projectiles.push(proj);

  // 后坐力：散布扩张 + 可恢复瞄准偏移（垂直上抬 + 水平高斯抖动）
  const bal = w.pack.physics.ballistic;
  e.bloom = Math.min(MAX_BLOOM, e.bloom + def.recoil * 0.9);
  e.recoilPitch += def.recoil * bal.recoilPitchK;
  e.recoilYaw += w.rng.combat.gaussian() * def.recoil * bal.recoilYawK;

  pushEvent(w, {
    type: 'shotFired',
    entityId: e.id,
    weapon: slot.weapon,
    origin,
    dir,
    end: { x: origin.x + dir.x * 3, y: origin.y + dir.y * 3, z: origin.z + dir.z * 3 },
    hitEntity: false,
  });
  return true;
}

/** 投射物推进：半隐式欧拉积分重力，逐 tick 线段 ray-march（建筑/地形/实体） */
export function updateProjectiles(w: World): void {
  const dtSec = w.pack.constants.TICK_MS / 1000;
  const g = w.pack.physics.ballistic.projectileGravity;
  const list = w.projectiles;
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    const def = weaponDef(w, p.weapon);
    p.prev.x = p.pos.x;
    p.prev.y = p.pos.y;
    p.prev.z = p.pos.z;
    p.vel.y -= g * dtSec;
    p.pos.x += p.vel.x * dtSec;
    p.pos.y += p.vel.y * dtSec;
    p.pos.z += p.vel.z * dtSec;
    const segLen = Math.sqrt(
      (p.pos.x - p.prev.x) ** 2 + (p.pos.y - p.prev.y) ** 2 + (p.pos.z - p.prev.z) ** 2,
    );

    const hit = marchSegment(w, p, segLen);
    if (hit) {
      resolveProjectileHit(w, p, hit);
      list.splice(i, 1);
      continue;
    }
    p.traveled += segLen;
    if (p.traveled >= def.maxRange) {
      pushEvent(w, { type: 'projectileImpact', shooterId: p.shooterId, pos: { ...p.pos }, hitEntity: false });
      list.splice(i, 1);
    }
  }
}

interface SegmentHit {
  point: Vec3;
  segT: number;
  entity: Entity | null;
}

/** 线段（prev→pos）命中扫描：建筑 AABB、地形高度场、实体竖直包围盒，取最近 */
function marchSegment(w: World, p: Projectile, segLen: number): SegmentHit | null {
  if (segLen < 1e-9) return null;
  const dir: Vec3 = {
    x: (p.pos.x - p.prev.x) / segLen,
    y: (p.pos.y - p.prev.y) / segLen,
    z: (p.pos.z - p.prev.z) / segLen,
  };
  let best: SegmentHit | null = null;

  for (const b of w.buildings) {
    const t = rayAABB(p.prev, dir, b, segLen);
    if (t >= 0 && t <= segLen && (!best || t < best.segT)) {
      best = { segT: t, entity: null, point: pointOnSegment(p.prev, dir, t) };
    }
  }

  // 地形：粗采样 + 二分细化（与 castShot 同策略）
  const step = 4;
  let prevT = 0;
  for (let t = step; t <= segLen + step; t += step) {
    const tc = Math.min(t, segLen);
    const px = p.prev.x + dir.x * tc;
    const py = p.prev.y + dir.y * tc;
    const pz = p.prev.z + dir.z * tc;
    if (py - terrainHeightAt(w.pack, px, pz) <= 0) {
      let lo = prevT;
      let hi = tc;
      for (let k = 0; k < 5; k++) {
        const mid = (lo + hi) / 2;
        const mx = p.prev.x + dir.x * mid;
        const my = p.prev.y + dir.y * mid;
        const mz = p.prev.z + dir.z * mid;
        if (my - terrainHeightAt(w.pack, mx, mz) > 0) lo = mid;
        else hi = mid;
      }
      const tHit = (lo + hi) / 2;
      if (!best || tHit < best.segT) {
        best = { segT: tHit, entity: null, point: pointOnSegment(p.prev, dir, tHit) };
      }
      break;
    }
    prevT = tc;
    if (tc >= segLen) break;
  }

  for (const target of w.entities) {
    if (!target.alive || target.id === p.shooterId) continue;
    if (target.state === 'plane') continue;
    const t = rayVerticalBox(p.prev, dir, target.pos, TARGET_HALF_WIDTH, TARGET_HEIGHT, segLen);
    if (t >= 0 && t <= segLen && (!best || t < best.segT)) {
      best = { segT: t, entity: target, point: pointOnSegment(p.prev, dir, t) };
    }
  }

  return best;
}

function pointOnSegment(origin: Vec3, dir: Vec3, t: number): Vec3 {
  return { x: origin.x + dir.x * t, y: origin.y + dir.y * t, z: origin.z + dir.z * t };
}

/** 命中结算：部位倍率 × 距离衰减（按总飞行距离），事件驱动 UI/特效 */
function resolveProjectileHit(w: World, p: Projectile, hit: SegmentHit): void {
  const def = weaponDef(w, p.weapon);
  const totalDist = p.traveled + hit.segT;
  const shooter = w.entities.find((e) => e.id === p.shooterId) ?? null;
  pushEvent(w, {
    type: 'projectileImpact',
    shooterId: p.shooterId,
    pos: hit.point,
    hitEntity: !!hit.entity,
  });
  if (!hit.entity) return;
  const falloff =
    totalDist <= def.effectiveRange
      ? 1
      : clamp(1 - 0.5 * ((totalDist - def.effectiveRange) / def.effectiveRange), 0.5, 1);
  const part = bodyPartAt(hit.entity, hit.point);
  const dmg = def.damage * PART_MULTIPLIERS[part] * falloff;
  applyDamage(w, hit.entity, dmg, part, shooter);
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

/** 直线弹道射线（AI 视线感知与测试靶道扫描用；实体命中走投射物） */
export function castShot(w: World, shooter: Entity, origin: Vec3, dir: Vec3, maxRange: number): HitResult | null {
  let best: HitResult | null = null;

  for (const b of w.buildings) {
    const t = rayAABB(origin, dir, b, maxRange);
    if (t >= 0 && (!best || t < best.dist)) {
      best = {
        dist: t,
        entity: null,
        point: { x: origin.x + dir.x * t, y: origin.y + dir.y * t, z: origin.z + dir.z * t },
      };
    }
  }

  // 地形粗采样 + 一次二分细化
  const step = 6;
  let prevT = 0;
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
      if (!best || tHit < best.dist) {
        best = {
          dist: tHit,
          entity: null,
          point: { x: origin.x + dir.x * tHit, y: origin.y + dir.y * tHit, z: origin.z + dir.z * tHit },
        };
      }
      break;
    }
    prevT = t;
  }

  for (const target of w.entities) {
    if (!target.alive || target === shooter) continue;
    if (target.state === 'plane') continue;
    const t = rayVerticalBox(origin, dir, target.pos, TARGET_HALF_WIDTH, TARGET_HEIGHT, maxRange);
    if (t >= 0 && (!best || t < best.dist)) {
      best = {
        dist: t,
        entity: target,
        point: { x: origin.x + dir.x * t, y: origin.y + dir.y * t, z: origin.z + dir.z * t },
      };
    }
  }

  return best && best.dist <= maxRange ? best : null;
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
  // 血包急救线：受击打断医疗引导
  if (target.medkitUntilMs !== null) {
    cancelMedkitChannel(w, target);
  }
  if (lethal) eliminate(w, target, by ? by.id : '', 'shot');
}

/** 打断医疗引导（受击/开火）：物资不返还、不回血 */
export function cancelMedkitChannel(w: World, e: Entity): void {
  if (e.medkitUntilMs === null) return;
  const slot = e.medkitItemSlot ?? -1;
  const item = slot >= 0 ? e.inventory[slot]?.item : null;
  e.medkitUntilMs = null;
  e.medkitItemSlot = null;
  if (item) pushEvent(w, { type: 'medkitInterrupted', entityId: e.id, item });
}

export function eliminate(w: World, target: Entity, byId: string, cause: 'shot' | 'zone'): void {
  if (!target.alive) return;
  const aliveCount = w.entities.reduce((n, e) => n + (e.alive ? 1 : 0), 0);
  target.alive = false;
  target.state = 'dead';
  target.rank = aliveCount;
  target.eliminatedAtMs = w.elapsedMs;
  target.eliminatedBy = byId;
  target.firing = false;
  target.aiState = 'dead';
  const killer = byId ? w.entities.find((e) => e.id === byId) : null;
  if (killer && killer !== target) killer.kills += 1;
  pushEvent(w, { type: 'entityEliminated', entityId: target.id, byId, cause });
  void dist3D;
}
