/**
 * core/systems/ai —— AI 敌人 FSM（patrol/loot/seek/fire/fleeZone/dead）+ 轮转分帧决策。
 * 约束：AI 与玩家共用同一 PlayerIntent 与同一套 systems，AI 不走特权通道。
 * 本系统只「产出意图」（写入 pendingIntents），由其余系统在每 tick 应用执行。
 */

import { EYE_HEIGHT, PICKUP_RADIUS_M } from '../../content/constants';
import { MAP_HALF } from '../../content/constants';
import type { World, Entity, LootItem } from '../world';
import type { PlayerIntent } from '../types';
import { dist2D } from '../geom';
import { hasLineOfSight, activeWeapon, weaponDef } from './combat';
import { terrainHeightAt } from '../mapgen';

/** AI 初始化：跳伞时机 + 落点偏好（随机城区 + 确定性抖动） */
export function initAi(w: World): void {
  const cfg = w.pack.ai;
  const urbanList = w.pack.map.urbanAreas;
  for (const e of w.entities) {
    if (e.kind !== 'ai') continue;
    const [lo, hi] = cfg.jumpWindowSec;
    e.aiJumpAtMs = w.rng.ai.range(lo, hi) * 1000;
    const urban = urbanList[w.rng.ai.int(0, urbanList.length - 1)];
    const jitter = w.rng.ai.unitDir();
    const r = w.rng.ai.next() * urban.radius * 0.8;
    e.aiWaypoint = { x: urban.x + jitter.x * r, y: 0, z: urban.z + jitter.z * r };
  }
}

export function updateAi(w: World): void {
  const every = w.pack.ai.decisionEveryTicks;
  for (const e of w.entities) {
    if (e.kind !== 'ai' || !e.alive) continue;
    if ((w.tick + e.aiDecisionOffset) % every !== 0) continue;
    decide(w, e);
  }
}

/**
 * 复用实体意图缓冲：原地清空并返回同一数组（避免每次决策分配新数组）。
 * 写入时序安全：意图在本 tick 末写入、下一 tick 开头由 tickWorld 应用后才可能被再次清空重写。
 */
function beginIntents(e: Entity): PlayerIntent[] {
  const intents = e.pendingIntents;
  intents.length = 0;
  return intents;
}

function decide(w: World, e: Entity): void {
  const cfg = w.pack.ai;

  // —— 空中阶段：跳伞时机与落点控制 ——
  if (e.state === 'plane') {
    if (e.aiJumpAtMs !== null && w.elapsedMs >= e.aiJumpAtMs) {
      beginIntents(e).push({ kind: 'jumpFromPlane' });
    }
    return;
  }

  if (e.state === 'freefall' || e.state === 'parachute') {
    const target = e.aiWaypoint ?? { x: e.pos.x, z: e.pos.z };
    const dx = target.x - e.pos.x;
    const dz = target.z - e.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    const intents = beginIntents(e);
    if (e.state === 'freefall') {
      if (d < 140) intents.push({ kind: 'deployParachute' });
      else intents.push({ kind: 'freefallControl', dirX: dx / d, dirZ: dz / d, dive: clamp01(d / 320) });
    } else {
      intents.push({ kind: 'freefallControl', dirX: dx / d, dirZ: dz / d, dive: 0 });
    }
    return;
  }

  // —— 地面阶段 ——
  const intents = beginIntents(e);
  const zone = w.zone;
  const zoneDist = dist2D(e.pos.x, e.pos.z, zone.center.x, zone.center.z);

  // 1) 避毒（最高优先级）
  if (zoneDist > zone.radius * cfg.fleeZoneRatio) {
    e.aiState = 'fleeZone';
    e.aiTargetId = null;
    e.firing = false;
    const dx = zone.center.x - e.pos.x;
    const dz = zone.center.z - e.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    intents.push({ kind: 'aim', yaw: Math.atan2(dz, dx), pitch: 0 });
    intents.push({ kind: 'move', dirX: dx / d, dirZ: dz / d, sprint: true });
    return;
  }

  // 2) 关键拾取：没有武器/弹尽 → 无论是否有敌人可见都先解决武装问题
  if (criticalLoot(e)) {
    const loot = findNearbyLoot(w, e);
    if (loot) {
      e.aiState = 'loot';
      e.aiTargetId = null;
      e.firing = false;
      e.aiLootId = loot.id;
      const d = dist2D(e.pos.x, e.pos.z, loot.pos.x, loot.pos.z);
      if (d <= PICKUP_RADIUS_M * 0.9) {
        intents.push({ kind: 'interact' });
      } else {
        intents.push(aimAtPos(e, loot.pos.x, loot.pos.z));
        intents.push({ kind: 'move', dirX: norm(e.pos.x, loot.pos.x), dirZ: norm(e.pos.z, loot.pos.z) });
      }
      return;
    }
  } else if (e.aiState === 'loot') {
    e.aiLootId = null;
  }

  // 3) 索敌与开火（感知在决策帧执行，成本摊平）
  const target = findVisibleEnemy(w, e);
  if (target) {
    if (e.aiTargetId !== target.id) {
      e.aiTargetId = target.id;
      e.aiFirstSeenMs = w.elapsedMs;
    }
    e.aiLastSeenMs = w.elapsedMs;
    e.aiState = 'fire';
    intents.push(aimIntent(w, e, target));

    const slot = activeWeapon(e);
    const d = dist2D(e.pos.x, e.pos.z, target.pos.x, target.pos.z);
    if (slot && slot.magazine <= 0) {
      e.firing = false;
      intents.push({ kind: 'reload' });
    } else {
      const canFire =
        slot !== null &&
        d <= Math.min(cfg.fireRange, weaponDef(w, slot.weapon).maxRange * 0.9) &&
        w.elapsedMs - e.aiFirstSeenMs >= cfg.reactionMs &&
        e.reloadUntilMs === null;
      e.firing = canFire;
      if (canFire) {
        // 交火小幅侧移，避免站桩
        const px = -(target.pos.z - e.pos.z);
        const pz = target.pos.x - e.pos.x;
        const l = Math.hypot(px, pz) || 1;
        const sway = Math.sin(w.elapsedMs / 700 + e.index) * 0.6;
        intents.push({ kind: 'move', dirX: (px / l) * sway, dirZ: (pz / l) * sway });
      }
    }
    return;
  }

  e.firing = false;

  // 4) 次级拾取（缺医疗/护甲），仅无目标可见时
  if (needsLoot(e)) {
    const loot = findNearbyLoot(w, e);
    if (loot) {
      e.aiState = 'loot';
      e.aiLootId = loot.id;
      const d = dist2D(e.pos.x, e.pos.z, loot.pos.x, loot.pos.z);
      if (d <= PICKUP_RADIUS_M * 0.9) {
        intents.push({ kind: 'interact' });
      } else {
        intents.push(aimAtPos(e, loot.pos.x, loot.pos.z));
        intents.push({ kind: 'move', dirX: norm(e.pos.x, loot.pos.x), dirZ: norm(e.pos.z, loot.pos.z) });
      }
      return;
    }
  }

  // 5) 失去目标 → 短暂追搜
  if (e.aiTargetId && w.elapsedMs - e.aiLastSeenMs < 6000) {
    const last = w.entities.find((x) => x.id === e.aiTargetId);
    if (last) {
      e.aiState = 'seek';
      intents.push(aimAtPos(e, last.pos.x, last.pos.z));
      intents.push({ kind: 'move', dirX: norm(e.pos.x, last.pos.x), dirZ: norm(e.pos.z, last.pos.z) });
      return;
    }
    e.aiTargetId = null;
  }

  // 6) 巡逻（终局全部阶段收缩完毕后向圈心收敛，保证对局自然终结）
  if (zone.mode === 'done') {
    e.aiWaypoint = { x: zone.center.x, y: 0, z: zone.center.z };
  } else if (
    e.aiWaypoint === null ||
    dist2D(e.pos.x, e.pos.z, e.aiWaypoint.x, e.aiWaypoint.z) < w.pack.ai.waypointReachDist
  ) {
    e.aiWaypoint = pickWaypoint(w, e);
  }
  e.aiState = 'patrol';
  intents.push(aimAtPos(e, e.aiWaypoint.x, e.aiWaypoint.z));
  intents.push({
    kind: 'move',
    dirX: norm(e.pos.x, e.aiWaypoint.x),
    dirZ: norm(e.pos.z, e.aiWaypoint.z),
  });
}

function aimAtPos(e: Entity, x: number, z: number): PlayerIntent {
  const dx = x - e.pos.x;
  const dz = z - e.pos.z;
  return { kind: 'aim', yaw: Math.atan2(dz, dx), pitch: 0 };
}

function aimIntent(w: World, e: Entity, target: Entity): PlayerIntent {
  const aimY = target.pos.y + EYE_HEIGHT * 0.75;
  const dx = target.pos.x - e.pos.x;
  const dy = aimY - (e.pos.y + EYE_HEIGHT);
  const dz = target.pos.z - e.pos.z;
  const flat = Math.hypot(dx, dz) || 1;
  const errYaw = w.rng.ai.gaussian() * 0.006 * w.pack.ai.spreadMultiplier;
  const errPitch = w.rng.ai.gaussian() * 0.004 * w.pack.ai.spreadMultiplier;
  return {
    kind: 'aim',
    yaw: Math.atan2(dz, dx) + errYaw,
    pitch: Math.atan2(dy, flat) + errPitch,
  };
}

function norm(from: number, to: number): number {
  const d = to - from;
  return Math.abs(d) < 1e-6 ? 0 : d;
}

function findVisibleEnemy(w: World, e: Entity): Entity | null {
  const cfg = w.pack.ai;
  let best: Entity | null = null;
  let bestD = Infinity;
  // 视点高度只计算一次（此前每候选分配 eye/tgt 两个对象，交火时是稳定分配源）
  const eyeX = e.pos.x;
  const eyeY = e.pos.y + EYE_HEIGHT;
  const eyeZ = e.pos.z;
  for (const other of w.entities) {
    if (other === e || !other.alive) continue;
    if (other.state !== 'ground') continue;
    const d = dist2D(e.pos.x, e.pos.z, other.pos.x, other.pos.z);
    if (d > cfg.visionRange || d >= bestD) continue;
    if (!hasLineOfSight(w, eyeX, eyeY, eyeZ, other.pos.x, other.pos.y + EYE_HEIGHT, other.pos.z)) continue;
    best = other;
    bestD = d;
  }
  return best;
}

/** 关键拾取：没有武器，或当前武器弹尽且无储备（必须先解决武装） */
function criticalLoot(e: Entity): boolean {
  if (e.weapons[0] === null && e.weapons[1] === null) return true;
  const slot = e.weapons[e.activeWeapon];
  if (slot) {
    const def = weaponDefOf(slot.weapon);
    const reserve = e.ammoReserve[def.ammoType] ?? 0;
    if (slot.magazine <= 0 && reserve <= 0) return true;
  }
  return false;
}

/** 次级拾取：缺弹药储备或缺医疗 */
function needsLoot(e: Entity): boolean {
  const slot = e.weapons[e.activeWeapon];
  if (slot) {
    const def = weaponDefOf(slot.weapon);
    if ((e.ammoReserve[def.ammoType] ?? 0) < 30) return true;
  } else {
    return true;
  }
  if (e.hp < 55 && !e.inventory.some((s) => s !== null && s.item === 'medkit_large')) return true;
  return false;
}

function weaponDefOf(id: string): { ammoType: string } {
  return id === 'ar_m4' ? { ammoType: 'ammo_556' } : { ammoType: 'ammo_45' };
}

/** 最近可拾取物资（直引 LootItem，避免每决策分配结果包装对象） */
function findNearbyLoot(w: World, e: Entity): LootItem | null {
  const range = w.pack.ai.lootSearchRange;
  let best: LootItem | null = null;
  let bestD = Infinity;
  for (const l of w.loots) {
    if (l.taken) continue;
    if (!lootWanted(e, l.item)) continue;
    const d = dist2D(e.pos.x, e.pos.z, l.pos.x, l.pos.z);
    if (d < range && d < bestD) {
      bestD = d;
      best = l;
    }
  }
  return best;
}

function lootWanted(e: Entity, item: string): boolean {
  if (item === 'weapon_ar_m4' || item === 'weapon_smg_ump') return e.weapons[0] === null || e.weapons[1] === null;
  if (item === 'ammo_556') return (e.ammoReserve['ammo_556'] ?? 0) < 90;
  if (item === 'ammo_45') return (e.ammoReserve['ammo_45'] ?? 0) < 75;
  if (item === 'medkit_large') return e.hp < 90;
  if (item === 'armor_vest') return e.armorReduction < 0.3;
  if (item === 'helmet_mk2') return e.helmetReduction < 0.4;
  return false;
}

function pickWaypoint(w: World, _e: Entity): { x: number; y: number; z: number } {
  const zone = w.zone;
  const d = w.rng.ai.unitDir();
  const r = Math.sqrt(w.rng.ai.next()) * zone.radius * 0.75;
  const x = Math.max(8, Math.min(2 * MAP_HALF - 8, zone.center.x + d.x * r));
  const z = Math.max(8, Math.min(2 * MAP_HALF - 8, zone.center.z + d.z * r));
  return { x, y: terrainHeightAt(w.pack, x, z), z };
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
