/**
 * core/systems/combat —— 射击节流、弹道扫描（抛物线下坠）、命中判定（包围盒 + 部位 + 距离衰减）、
 * 换弹/切枪、后坐力（bloom + 踢枪偏移 + 恢复）。AC4 数值全部来自 content/weapons / content/physics。
 */

import { EYE_HEIGHT, PART_MULTIPLIERS, TARGET_HALF_WIDTH, TARGET_HEIGHT } from '../../content/constants';
import { RECOIL_TUNING } from '../../content/weapons';
import type { World, Entity, WeaponSlot } from '../world';
import type { BodyPart, Vec3, WeaponId } from '../types';
import { aimDir, clamp, rayAABB, rayVerticalBox } from '../geom';
import { terrainHeightAt } from '../mapgen';
import { pushEvent, cancelMedkitChannel } from '../world';

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

    // 后坐力恢复：停火后踢枪偏移按配置速率回落（AC4 后坐力可感知且可压枪）
    if (!e.firing && (e.recoilPitch !== 0 || e.recoilYaw !== 0)) {
      const rec = RECOIL_TUNING.recoverPerSec * dtSec;
      e.recoilPitch = e.recoilPitch > 0 ? Math.max(0, e.recoilPitch - rec) : Math.min(0, e.recoilPitch + rec);
      e.recoilYaw = e.recoilYaw > 0 ? Math.max(0, e.recoilYaw - rec) : Math.min(0, e.recoilYaw + rec);
    }
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
  // 开火打断医疗引导（急救语义：持枪射击即中断包扎）
  cancelMedkitChannel(e);

  const origin: Vec3 = { x: e.pos.x, y: e.pos.y + EYE_HEIGHT, z: e.pos.z };
  const sigma = def.spread * (1 + e.bloom);
  const gx = w.rng.combat.gaussian() * sigma;
  const gy = w.rng.combat.gaussian() * sigma;
  // 实际弹道方向 = 瞄准方向 + 后坐力偏移（垂直上抬 + 水平漂移，弹道含重力下坠）
  const base = aimDir(e.yaw + e.recoilYaw, e.pitch + e.recoilPitch);
  // 在视线的垂直平面内施加高斯散布
  const dir = perturb(base, gx, gy);

  const hit = castShot(w, e, origin, dir, def.maxRange, def.projectileSpeed);
  const end: Vec3 = hit
    ? hit.point
    : {
        x: origin.x + dir.x * def.maxRange,
        y: origin.y + dir.y * def.maxRange - ballisticDropAt(w, def.maxRange, def.projectileSpeed),
        z: origin.z + dir.z * def.maxRange,
      };

  // 后坐力：散布扩张 + 踢枪（垂直上抬 + 水平漂移，数值来自 RECOIL_TUNING × 武器 recoil）
  e.bloom = Math.min(MAX_BLOOM, e.bloom + def.recoil * 0.9);
  e.recoilPitch = Math.min(RECOIL_TUNING.maxPitchOffset, e.recoilPitch + def.recoil * RECOIL_TUNING.pitchKickPerRecoil);
  const yawKick = w.rng.combat.gaussian() * def.recoil * RECOIL_TUNING.yawKickPerRecoil;
  e.recoilYaw = clamp(e.recoilYaw + yawKick, -RECOIL_TUNING.maxYawOffset, RECOIL_TUNING.maxYawOffset);

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
    const falloff =
      t <= def.effectiveRange
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

/** 弹道下坠量（m）：抛物线近似 drop = 0.5 × g × t²，t = 距离 / 弹速（content/physics.ballistic） */
export function ballisticDropAt(w: World, dist: number, projectileSpeed: number): number {
  if (!Number.isFinite(projectileSpeed) || projectileSpeed <= 0) return 0;
  const t = dist / projectileSpeed;
  return 0.5 * w.pack.physics.ballistic.gravityMps2 * t * t;
}

/**
 * 弹道扫描：先地形/建筑遮挡，再实体包围盒，取最近命中。
 * 传入 projectileSpeed 时按抛物线弹道分段扫描（重力下坠，分段长度 content/physics.ballistic.segmentM）；
 * 不传（或非有限值）时退化为直线射线（测试基建与视线检测复用）。
 */
export function castShot(
  w: World,
  shooter: Entity,
  origin: Vec3,
  dir: Vec3,
  maxRange: number,
  projectileSpeed: number = Number.POSITIVE_INFINITY,
): HitResult | null {
  if (!Number.isFinite(projectileSpeed)) return castStraight(w, shooter, origin, dir, maxRange);

  let best: HitResult | null = null;
  let bestDist = Infinity;
  let prev: Vec3 = origin;
  let prevD = 0;
  const seg = w.pack.physics.ballistic.segmentM;

  for (;;) {
    const d = Math.min(prevD + seg, maxRange);
    const drop = ballisticDropAt(w, d, projectileSpeed);
    const point: Vec3 = {
      x: origin.x + dir.x * d,
      y: origin.y + dir.y * d - drop,
      z: origin.z + dir.z * d,
    };
    const segLen = Math.hypot(point.x - prev.x, point.y - prev.y, point.z - prev.z);
    if (segLen > 1e-6) {
      const sdir: Vec3 = {
        x: (point.x - prev.x) / segLen,
        y: (point.y - prev.y) / segLen,
        z: (point.z - prev.z) / segLen,
      };
      const found = nearestInSegment(w, shooter, prev, sdir, segLen, prevD);
      if (found && found.dist < bestDist) {
        best = found;
        bestDist = found.dist;
      }
      if (best) return best;
    }
    // 地形：段末低于地形 → 沿段二分求交点
    if (point.y - terrainHeightAt(w.pack, point.x, point.z) <= 0) {
      const tHit = bisectTerrain(w, prev, point, prevD, d);
      if (tHit >= 0 && tHit < bestDist) {
        const f = (tHit - prevD) / Math.max(1e-6, d - prevD);
        best = {
          dist: tHit,
          entity: null,
          point: {
            x: prev.x + (point.x - prev.x) * f,
            y: prev.y + (point.y - prev.y) * f,
            z: prev.z + (point.z - prev.z) * f,
          },
        };
        bestDist = tHit;
      }
      if (best) return best;
    }
    prev = point;
    prevD = d;
    if (d >= maxRange) break;
  }
  return best;
}

/** 对一段弹道弦做建筑/实体命中检测，返回段内最近命中（距离以弹道全程里程计） */
function nearestInSegment(
  w: World,
  shooter: Entity,
  from: Vec3,
  sdir: Vec3,
  segLen: number,
  baseD: number,
): HitResult | null {
  let best: HitResult | null = null;
  for (const b of w.buildings) {
    const t = rayAABB(from, sdir, b, segLen);
    if (t >= 0 && (!best || baseD + t < best.dist)) {
      best = {
        dist: baseD + t,
        entity: null,
        point: { x: from.x + sdir.x * t, y: from.y + sdir.y * t, z: from.z + sdir.z * t },
      };
    }
  }
  for (const target of w.entities) {
    if (!target.alive || target === shooter) continue;
    if (target.state === 'plane') continue;
    const t = rayVerticalBox(from, sdir, target.pos, TARGET_HALF_WIDTH, TARGET_HEIGHT, segLen);
    if (t >= 0 && (!best || baseD + t < best.dist)) {
      best = {
        dist: baseD + t,
        entity: target,
        point: { x: from.x + sdir.x * t, y: from.y + sdir.y * t, z: from.z + sdir.z * t },
      };
    }
  }
  return best;
}

/** 段内地形交点二分（返回弹道全程里程；无交点返回 -1） */
function bisectTerrain(w: World, from: Vec3, to: Vec3, baseD: number, d: number): number {
  let lo = 0;
  let hi = 1;
  if (from.y - terrainHeightAt(w.pack, from.x, from.z) <= 0) return baseD;
  for (let i = 0; i < 6; i++) {
    const mid = (lo + hi) / 2;
    const mx = from.x + (to.x - from.x) * mid;
    const my = from.y + (to.y - from.y) * mid;
    const mz = from.z + (to.z - from.z) * mid;
    if (my - terrainHeightAt(w.pack, mx, mz) > 0) lo = mid;
    else hi = mid;
  }
  const f = (lo + hi) / 2;
  return baseD + (d - baseD) * f;
}

/** 直线射线（无重力下坠退化路径）：视线检测与测试基建复用 */
function castStraight(w: World, shooter: Entity, origin: Vec3, dir: Vec3, maxRange: number): HitResult | null {
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
  if (lethal) eliminate(w, target, by ? by.id : '', 'shot');
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
}
