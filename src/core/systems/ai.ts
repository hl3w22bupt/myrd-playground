/**
 * core/systems/ai —— AI 敌人 FSM（patrol/loot/seek/fire/fleeZone/heal/retreat/airdrop/dead）
 * + 轮转分帧决策 + 人格多样化（aggressive/balanced/cautious，影响交火距离/撤退/治疗/抢空投）。
 * 约束：AI 与玩家共用同一 PlayerIntent 与同一套 systems，AI 不走特权通道。
 * 本系统只「产出意图」（写入 pendingIntents），由其余系统在每 tick 应用执行。
 */

import { EYE_HEIGHT, PICKUP_RADIUS_M } from '../../content/constants';
import { MAP_HALF } from '../../content/constants';
import type { World, Entity } from '../world';
import type { PlayerIntent } from '../types';
import { dist2D } from '../geom';
import { hasLineOfSight, activeWeapon, weaponDef } from './combat';
import { terrainHeightAt } from '../mapgen';
import { nearestLandedAirdrop } from './airdrop';

/** AI 初始化：跳伞时机 + 落点偏好（随机城区 + 确定性抖动）+ 人格抽选（权重来自 content/ai） */
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
    // 人格抽选（行为多样化线：同一种子流，确定性）
    e.aiPersonality = w.rng.ai.weighted(
      cfg.personalityWeights.map((p) => ({ item: p.personality, weight: p.weight })),
    );
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

function decide(w: World, e: Entity): void {
  const cfg = w.pack.ai;
  const persona = cfg.personalities[e.aiPersonality];

  // —— 空中阶段：跳伞时机与落点控制 ——
  if (e.state === 'plane') {
    if (e.aiJumpAtMs !== null && w.elapsedMs >= e.aiJumpAtMs) {
      e.pendingIntents = [{ kind: 'jumpFromPlane' }];
    }
    return;
  }

  if (e.state === 'freefall' || e.state === 'parachute') {
    const target = e.aiWaypoint ?? { x: e.pos.x, z: e.pos.z };
    const dx = target.x - e.pos.x;
    const dz = target.z - e.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    const intents: PlayerIntent[] = [];
    if (e.state === 'freefall') {
      if (d < 140) intents.push({ kind: 'deployParachute' });
      else intents.push({ kind: 'freefallControl', dirX: dx / d, dirZ: dz / d, dive: clamp01(d / 320) });
    } else {
      intents.push({ kind: 'freefallControl', dirX: dx / d, dirZ: dz / d, dive: 0 });
    }
    e.pendingIntents = intents;
    return;
  }

  // —— 地面阶段 ——
  const intents: PlayerIntent[] = [];
  const zone = w.zone;
  const zoneDist = dist2D(e.pos.x, e.pos.z, zone.center.x, zone.center.z);

  // 0) 医疗引导中：保持原地（移动/开火会打断引导），仅观察
  if (e.medkitUntilMs !== null) {
    e.firing = false;
    e.pendingIntents = [];
    return;
  }

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
    e.pendingIntents = intents;
    return;
  }

  // 2) 关键拾取：没有武器/弹尽 → 先解决武装问题（未武装时优先找武器而非交火）
  if (criticalLoot(w, e)) {
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
      e.pendingIntents = intents;
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

    // 3a) 谨慎人格撤退：血量低于阈值 → 背向目标撤退并停火（行为多样化线）
    if (e.hp < persona.retreatBelowHp) {
      e.aiState = 'retreat';
      e.firing = false;
      const ax = e.pos.x - target.pos.x;
      const az = e.pos.z - target.pos.z;
      const al = Math.hypot(ax, az) || 1;
      intents.push(aimAtPos(e, e.pos.x + ax, e.pos.z + az));
      intents.push({ kind: 'move', dirX: ax / al, dirZ: az / al, sprint: true });
      e.pendingIntents = intents;
      return;
    }

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
        d <= Math.min(cfg.fireRange * persona.fireRangeMul, weaponDef(w, slot.weapon).maxRange * 0.9) &&
        w.elapsedMs - e.aiFirstSeenMs >= cfg.reactionMs &&
        e.reloadUntilMs === null;
      e.firing = canFire;
      if (canFire) {
        if (persona.pushWhileFiring && d > 26) {
          // 激进人格：边打边压近目标（行为多样化线）
          intents.push({ kind: 'move', dirX: norm(e.pos.x, target.pos.x), dirZ: norm(e.pos.z, target.pos.z) });
        } else {
          // 交火小幅侧移，避免站桩
          const px = -(target.pos.z - e.pos.z);
          const pz = target.pos.x - e.pos.x;
          const l = Math.hypot(px, pz) || 1;
          const sway = Math.sin(w.elapsedMs / 700 + e.index) * 0.6;
          intents.push({ kind: 'move', dirX: (px / l) * sway, dirZ: (pz / l) * sway });
        }
      }
    }
    e.pendingIntents = intents;
    return;
  }

  e.firing = false;

  // 4) 治疗：无敌人可见且血量低于人格阈值 → 使用医疗物资（行为多样化线）
  if (e.hp < persona.healBelowHp && hasMedkit(w, e)) {
    e.aiState = 'heal';
    intents.push({ kind: 'useItem', slot: -1 });
    e.pendingIntents = intents;
    return;
  }

  // 5) 次级拾取（缺医疗/护甲），仅无目标可见时
  if (needsLoot(w, e)) {
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
      e.pendingIntents = intents;
      return;
    }
  }

  // 6) 抢空投：人格允许且空投降落在搜索半径内（行为多样化线）
  if (persona.seekAirdrop) {
    const drop = nearestLandedAirdrop(w, e.pos.x, e.pos.z, cfg.airdropSeekRange);
    if (drop && airdropHasLoot(w, drop.pos.x, drop.pos.z)) {
      e.aiState = 'airdrop';
      e.aiAirdropId = drop.id;
      const d = dist2D(e.pos.x, e.pos.z, drop.pos.x, drop.pos.z);
      if (d <= PICKUP_RADIUS_M * 0.9) {
        intents.push({ kind: 'interact' });
      } else {
        intents.push(aimAtPos(e, drop.pos.x, drop.pos.z));
        intents.push({ kind: 'move', dirX: norm(e.pos.x, drop.pos.x), dirZ: norm(e.pos.z, drop.pos.z) });
      }
      e.pendingIntents = intents;
      return;
    }
    e.aiAirdropId = null;
  }

  // 7) 失去目标 → 短暂追搜
  if (e.aiTargetId && w.elapsedMs - e.aiLastSeenMs < 6000) {
    const last = w.entities.find((x) => x.id === e.aiTargetId);
    if (last) {
      e.aiState = 'seek';
      intents.push(aimAtPos(e, last.pos.x, last.pos.z));
      intents.push({ kind: 'move', dirX: norm(e.pos.x, last.pos.x), dirZ: norm(e.pos.z, last.pos.z) });
      e.pendingIntents = intents;
      return;
    }
    e.aiTargetId = null;
  }

  // 8) 巡逻（终局全部阶段收缩完毕后向圈心收敛，保证对局自然终结）
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
  e.pendingIntents = intents;
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
  for (const other of w.entities) {
    if (other === e || !other.alive) continue;
    if (other.state !== 'ground') continue;
    const d = dist2D(e.pos.x, e.pos.z, other.pos.x, other.pos.z);
    if (d > cfg.visionRange || d >= bestD) continue;
    const eye = { x: e.pos.x, y: e.pos.y + EYE_HEIGHT, z: e.pos.z };
    const tgt = { x: other.pos.x, y: other.pos.y + EYE_HEIGHT, z: other.pos.z };
    if (!hasLineOfSight(w, eye, tgt)) continue;
    best = other;
    bestD = d;
  }
  return best;
}

/** 关键拾取：没有武器，或当前武器弹尽且无储备（必须先解决武装） */
function criticalLoot(w: World, e: Entity): boolean {
  if (e.weapons[0] === null && e.weapons[1] === null) return true;
  const slot = e.weapons[e.activeWeapon];
  if (slot) {
    const def = weaponDef(w, slot.weapon);
    const reserve = e.ammoReserve[def.ammoType] ?? 0;
    if (slot.magazine <= 0 && reserve <= 0) return true;
  }
  return false;
}

/** 次级拾取：缺弹药储备或缺医疗 */
function needsLoot(w: World, e: Entity): boolean {
  const slot = e.weapons[e.activeWeapon];
  if (slot) {
    const def = weaponDef(w, slot.weapon);
    if ((e.ammoReserve[def.ammoType] ?? 0) < 30) return true;
  } else {
    return true;
  }
  if (e.hp < 55 && !hasMedkit(w, e)) return true;
  return false;
}

/** 是否持有任意医疗物资（行为多样化线：治疗行为前置判定，查 content 表不硬编码） */
function hasMedkit(w: World, e: Entity): boolean {
  for (const s of e.inventory) {
    if (!s || s.count <= 0) continue;
    const def = w.pack.items[s.item as keyof typeof w.pack.items];
    if (def && def.kind === 'medkit') return true;
  }
  return false;
}

/** 空投箱周仍有可拾取物资（抢空投价值判定） */
function airdropHasLoot(w: World, x: number, z: number): boolean {
  for (const l of w.loots) {
    if (l.taken) continue;
    if (dist2D(x, z, l.pos.x, l.pos.z) <= PICKUP_RADIUS_M + 3) return true;
  }
  return false;
}

function findNearbyLoot(w: World, e: Entity): { id: string; pos: { x: number; z: number } } | null {
  const range = w.pack.ai.lootSearchRange;
  let best: { id: string; pos: { x: number; z: number } } | null = null;
  let bestD = Infinity;
  for (const l of w.loots) {
    if (l.taken) continue;
    if (!lootWanted(w, e, l.item)) continue;
    const d = dist2D(e.pos.x, e.pos.z, l.pos.x, l.pos.z);
    if (d < range && d < bestD) {
      bestD = d;
      best = { id: l.id, pos: { x: l.pos.x, z: l.pos.z } };
    }
  }
  return best;
}

function lootWanted(w: World, e: Entity, item: string): boolean {
  const def = w.pack.items[item as keyof typeof w.pack.items];
  if (!def) return false;
  switch (def.kind) {
    case 'weapon':
      return e.weapons[0] === null || e.weapons[1] === null;
    case 'ammo':
      return (e.ammoReserve[def.ammoType] ?? 0) < def.count * 1.5;
    case 'medkit':
      return e.hp < 90;
    case 'armor':
      return e.armorReduction < def.damageReduction;
    case 'helmet':
      return e.helmetReduction < def.headshotReduction;
    default:
      return false;
  }
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
