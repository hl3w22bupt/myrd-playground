/**
 * core/systems/ai —— AI 敌人 FSM（patrol/loot/seek/fire/fleeZone/dead）+ 轮转分帧决策。
 * 行为多样化：每个 AI 按权重分配行为人格（content/ai.AI_PERSONALITIES），人格只缩放
 * 全局参数（视野/交火距离/反应/误差/侧移）并附加差异行为（保持距离/低血撤退治疗/点射节流）。
 * 约束：AI 与玩家共用同一 PlayerIntent 与同一套 systems，AI 不走特权通道。
 * 本系统只「产出意图」（写入 pendingIntents），由其余系统在每 tick 应用执行。
 */

import { EYE_HEIGHT, PICKUP_RADIUS_M } from '../../content/constants';
import { MAP_HALF } from '../../content/constants';
import { AI_PERSONALITIES, AI_HEAL_HP_RATIO, type AiPersonaDef } from '../../content/ai';
import type { World, Entity } from '../world';
import type { PlayerIntent } from '../types';
import { dist2D } from '../geom';
import { hasLineOfSight, activeWeapon, weaponDef, ballisticDropAt } from './combat';
import { terrainHeightAt } from '../mapgen';

/** AI 初始化：跳伞时机 + 落点偏好（随机城区 + 确定性抖动）+ 行为人格分配 */
export function initAi(w: World): void {
  const cfg = w.pack.ai;
  const urbanList = w.pack.map.urbanAreas;
  const personaPool = Object.values(AI_PERSONALITIES).map((p) => ({ item: p.id, weight: p.weight }));
  for (const e of w.entities) {
    if (e.kind !== 'ai') continue;
    e.persona = w.rng.ai.weighted(personaPool);
    const [lo, hi] = cfg.jumpWindowSec;
    e.aiJumpAtMs = w.rng.ai.range(lo, hi) * 1000;
    const urban = urbanList[w.rng.ai.int(0, urbanList.length - 1)];
    const jitter = w.rng.ai.unitDir();
    const r = w.rng.ai.next() * urban.radius * 0.8;
    e.aiWaypoint = { x: urban.x + jitter.x * r, y: 0, z: urban.z + jitter.z * r };
  }
}

/** 取实体的人格定义（玩家无人格，返回 assault 兜底） */
export function personaOf(e: Entity): AiPersonaDef {
  return AI_PERSONALITIES[e.persona] ?? AI_PERSONALITIES.assault;
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
  const persona = personaOf(e);
  const intents: PlayerIntent[] = [];
  const zone = w.zone;
  const zoneDist = dist2D(e.pos.x, e.pos.z, zone.center.x, zone.center.z);

  // 1) 避毒（最高优先级，人格不影响生存底线）
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

  // 2) 关键拾取：没有武器/弹尽 → 无论是否有敌人可见都先解决武装问题
  if (criticalLoot(w, e)) {
    const loot = findNearbyLoot(w, e, persona);
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

  // 3) 低血撤退治疗（人格差异行为）：血量低于人格阈值时脱离交火自救
  const hasMed = e.inventory.some((s) => s !== null && w.pack.items[s.item as keyof typeof w.pack.items]?.kind === 'medkit');
  if (e.hp / e.maxHp < persona.retreatHpRatio && hasMed && e.medkitUntilMs === null) {
    e.aiState = 'heal';
    e.firing = false;
    e.burstCount = 0;
    intents.push({ kind: 'useItem', slot: -1 });
    // 边打药边脱离：远离最后已知敌人方向
    const threat = e.aiTargetId ? w.entities.find((x) => x.id === e.aiTargetId) : null;
    if (threat) {
      intents.push(aimAtPos(e, threat.pos.x, threat.pos.z));
      intents.push({
        kind: 'move',
        dirX: norm(e.pos.x, 2 * e.pos.x - threat.pos.x),
        dirZ: norm(e.pos.z, 2 * e.pos.z - threat.pos.z),
        sprint: true,
      });
    }
    e.pendingIntents = intents;
    return;
  }

  // 4) 索敌与开火（感知在决策帧执行，成本摊平；人格缩放视野/反应/误差）
  const target = findVisibleEnemy(w, e, persona);
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
      e.burstCount = 0;
      intents.push({ kind: 'reload' });
    } else {
      const range = slot
        ? Math.min(cfg.fireRange * persona.fireRangeMul, weaponDef(w, slot.weapon).maxRange * 0.9)
        : 0;
      const reactionOk = w.elapsedMs - e.aiFirstSeenMs >= cfg.reactionMs * persona.reactionMsMul;
      const burstLen = Math.max(1, persona.burstShots);
      const burstOk = w.elapsedMs >= e.burstReadyAtMs && e.burstCount < burstLen;
      const canFire = slot !== null && d <= range && reactionOk && e.reloadUntilMs === null && burstOk;
      e.firing = canFire;
      if (canFire) {
        // 点射节流：打满点射长度后进入冷却（人格差异：狙击长冷却短点射，游击短冷却频点射）
        e.burstCount += 1;
        if (e.burstCount >= burstLen) {
          e.burstReadyAtMs = w.elapsedMs + persona.burstCooldownMs;
          e.burstCount = 0;
        }
        if (d < persona.engageDist * 0.5) {
          // 过近：后撤拉开交战距离（狙击手保持距离的行为特征）
          intents.push({ kind: 'move', dirX: norm(target.pos.x, e.pos.x), dirZ: norm(target.pos.z, e.pos.z) });
        } else {
          // 交火小幅侧移，避免站桩（幅度按人格）
          const px = -(target.pos.z - e.pos.z);
          const pz = target.pos.x - e.pos.x;
          const l = Math.hypot(px, pz) || 1;
          const sway = Math.sin(w.elapsedMs / 700 + e.index) * 0.6 * persona.strafeMul;
          intents.push({ kind: 'move', dirX: (px / l) * sway, dirZ: (pz / l) * sway });
        }
      }
    }
    e.pendingIntents = intents;
    return;
  }

  e.firing = false;
  e.burstCount = 0;

  // 5) 自我恢复：无可见敌人且血量未满 → 使用医疗物品（不脱离巡逻意图，边包扎边走）
  if (e.hp < e.maxHp * AI_HEAL_HP_RATIO && hasMed && e.medkitUntilMs === null) {
    intents.push({ kind: 'useItem', slot: -1 });
  }

  // 6) 次级拾取（缺弹药/医疗/护甲），仅无目标可见时
  if (needsLoot(w, e)) {
    const loot = findNearbyLoot(w, e, persona);
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
  const persona = personaOf(e);
  const aimY = target.pos.y + EYE_HEIGHT * 0.75;
  const dx = target.pos.x - e.pos.x;
  const dy = aimY - (e.pos.y + EYE_HEIGHT);
  const dz = target.pos.z - e.pos.z;
  const flat = Math.hypot(dx, dz) || 1;
  const errYaw = w.rng.ai.gaussian() * 0.006 * w.pack.ai.spreadMultiplier * persona.aimErrMul;
  const errPitch = w.rng.ai.gaussian() * 0.004 * w.pack.ai.spreadMultiplier * persona.aimErrMul;
  // 弹道下坠补偿：提前量 = 距离/弹速对应下坠量换算成 pitch；再补偿当前后坐力偏移
  const slot = activeWeapon(e);
  let comp = -e.recoilPitch;
  if (slot) {
    const def = weaponDef(w, slot.weapon);
    const drop = ballisticDropAt(w, flat, def.projectileSpeed);
    comp -= Math.atan2(drop, flat);
  }
  return {
    kind: 'aim',
    yaw: Math.atan2(dz, dx) + errYaw,
    pitch: Math.atan2(dy, flat) + errPitch + comp,
  };
}

function norm(from: number, to: number): number {
  const d = to - from;
  return Math.abs(d) < 1e-6 ? 0 : d;
}

function findVisibleEnemy(w: World, e: Entity, persona: AiPersonaDef): Entity | null {
  const cfg = w.pack.ai;
  const vision = cfg.visionRange * persona.visionMul;
  let best: Entity | null = null;
  let bestD = Infinity;
  for (const other of w.entities) {
    if (other === e || !other.alive) continue;
    if (other.state !== 'ground') continue;
    const d = dist2D(e.pos.x, e.pos.z, other.pos.x, other.pos.z);
    if (d > vision || d >= bestD) continue;
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
  const hasHeal = e.inventory.some(
    (s) => s !== null && w.pack.items[s.item as keyof typeof w.pack.items]?.kind === 'medkit',
  );
  if (e.hp < 55 && !hasHeal) return true;
  return false;
}

function findNearbyLoot(w: World, e: Entity, persona: AiPersonaDef): { id: string; pos: { x: number; z: number } } | null {
  const range = w.pack.ai.lootSearchRange * persona.lootRangeMul;
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

/** 是否想要该物资：由 content 配置驱动（新增武器/弹药/护甲/医疗无需改此逻辑） */
function lootWanted(w: World, e: Entity, item: string): boolean {
  const def = w.pack.items[item as keyof typeof w.pack.items];
  if (!def) return false;
  if (def.kind === 'weapon') return e.weapons[0] === null || e.weapons[1] === null;
  if (def.kind === 'ammo') return (e.ammoReserve[def.ammoType] ?? 0) < def.count * 1.5;
  if (def.kind === 'armor') return e.armorReduction < def.damageReduction;
  if (def.kind === 'helmet') return e.helmetReduction < def.headshotReduction;
  if (def.kind === 'medkit') {
    const carried = e.inventory.reduce((n, s) => n + (s !== null && s.item === item ? s.count : 0), 0);
    return e.hp < 90 && carried < 2;
  }
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
