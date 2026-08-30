/**
 * core/systems/loot —— 按区域密度生成物资、拾取判定、背包容量/丢弃、护甲减伤/医疗回血生效。
 * AC3：数值全部来自 content/items + content/lootTable。
 */

import { INVENTORY_GRIDS, MAX_HP, MAP_HALF, PICKUP_RADIUS_M } from '../../content/constants';
import { LOOT_TOTAL_CAP } from '../../content/lootTable';
import type { World, Entity, LootItem } from '../world';
import type { ItemId, Vec3 } from '../types';
import { dist2D } from '../geom';
import { isUrbanArea, terrainHeightAt } from '../mapgen';
import { pushEvent } from '../world';
import { startReload } from './combat';

let lootSeq = 0;

/** 对局开局生成物资（确定性：rng.loot 子流） */
export function generateLoot(w: World): void {
  const areas = w.pack.map.urbanAreas;
  const urbanArea = areas.reduce((s, a) => s + Math.PI * a.radius * a.radius, 0);
  const totalArea = (2 * MAP_HALF) ** 2;
  const wildArea = Math.max(0, totalArea - urbanArea);
  const [urbanZone, wildZone] = w.pack.lootTable.zones;

  const urbanCount = Math.round((urbanZone.densityPer10kM2 * urbanArea) / 10_000);
  const wildCount = Math.min(
    LOOT_TOTAL_CAP,
    Math.round((wildZone.densityPer10kM2 * wildArea) / 10_000),
  );

  let guard = 0;
  let placed = 0;
  while (placed < urbanCount && guard < urbanCount * 30) {
    guard++;
    const area = areas[w.rng.loot.int(0, areas.length - 1)];
    const dir = w.rng.loot.unitDir();
    const r = Math.sqrt(w.rng.loot.next()) * area.radius;
    const x = area.x + dir.x * r;
    const z = area.z + dir.z * r;
    spawnLoot(w, x, z, urbanZone);
    placed++;
  }

  guard = 0;
  placed = 0;
  while (placed < wildCount && guard < wildCount * 40) {
    guard++;
    const dir = w.rng.loot.unitDir();
    const r = Math.sqrt(w.rng.loot.next()) * MAP_HALF * 0.94;
    const x = MAP_HALF + dir.x * r;
    const z = MAP_HALF + dir.z * r;
    if (isUrbanArea(w.pack, x, z)) continue;
    spawnLoot(w, x, z, wildZone);
    placed++;
  }
}

function spawnLoot(w: World, x: number, z: number, zone: { pool: Array<{ item: ItemId; weight: number }> }): void {
  const item = w.rng.loot.weighted(zone.pool);
  const pos: Vec3 = { x, y: terrainHeightAt(w.pack, x, z) + 0.25, z };
  const loot: LootItem = { id: `loot_${lootSeq++}`, item, pos, taken: false };
  w.loots.push(loot);
  pushEvent(w, { type: 'lootSpawned', id: loot.id, pos, item });
}

function lootDef(w: World, item: ItemId) {
  return w.pack.items[item as keyof typeof w.pack.items];
}

/** 拾取最近的可拾取物资；返回是否成功 */
export function tryPickup(w: World, e: Entity): boolean {
  if (e.state !== 'ground') return false;
  let best: LootItem | null = null;
  let bestD = Infinity;
  for (const l of w.loots) {
    if (l.taken) continue;
    const d = dist2D(e.pos.x, e.pos.z, l.pos.x, l.pos.z);
    if (d <= PICKUP_RADIUS_M && d < bestD) {
      bestD = d;
      best = l;
    }
  }
  if (!best) return false;
  if (!addItem(w, e, best.item)) return false;
  best.taken = true;
  pushEvent(w, { type: 'lootPickedUp', entityId: e.id, item: best.item, pos: best.pos });
  return true;
}

/**
 * 物品入包并立即生效：
 * - 武器 → 空武器槽并上膛（loadedAmmo），立即可射击
 * - 弹药 → 并入储备（占 gridCost 格子）
 * - 护甲/头盔 → 立即装备（不占格子）
 * - 医疗包 → 入背包（占格子），按键使用
 */
export function addItem(w: World, e: Entity, itemId: ItemId): boolean {
  const def = lootDef(w, itemId);

  if (def.kind === 'weapon') {
    const slotIdx = e.weapons[0] === null ? 0 : e.weapons[1] === null ? 1 : -1;
    if (slotIdx < 0) return false;
    e.weapons[slotIdx] = { weapon: def.weaponId, magazine: def.loadedAmmo };
    if (e.weapons[e.activeWeapon] === null) e.activeWeapon = slotIdx as 0 | 1;
    pushEvent(w, { type: 'weaponEquipped', entityId: e.id, weapon: def.weaponId });
    return true;
  }

  if (def.kind === 'armor') {
    e.armorReduction = Math.max(e.armorReduction, def.damageReduction);
    return true;
  }

  if (def.kind === 'helmet') {
    e.helmetReduction = Math.max(e.helmetReduction, def.headshotReduction);
    return true;
  }

  if (e.usedGrids + def.gridCost > INVENTORY_GRIDS) return false;

  if (def.kind === 'ammo') {
    const idx = e.inventory.findIndex((s) => s !== null && s.item === itemId);
    if (idx >= 0) {
      e.inventory[idx]!.count += def.count;
    } else {
      const free = e.inventory.findIndex((s) => s === null);
      if (free < 0) return false;
      e.inventory[free] = { item: itemId, count: def.count };
      e.usedGrids += def.gridCost;
    }
    e.ammoReserve[def.ammoType] = (e.ammoReserve[def.ammoType] ?? 0) + def.count;
    return true;
  }

  // medkit
  const free = e.inventory.findIndex((s) => s === null);
  if (free < 0) return false;
  e.inventory[free] = { item: itemId, count: 1 };
  e.usedGrids += def.gridCost;
  return true;
}

/** 丢弃背包格（在脚下重新生成物资） */
export function dropItem(w: World, e: Entity, slot: number): boolean {
  const s = e.inventory[slot];
  if (!s || s.count <= 0) return false;
  const def = lootDef(w, s.item);
  s.count -= 1;
  if (s.count <= 0) {
    e.inventory[slot] = null;
  }
  e.usedGrids = Math.max(0, e.usedGrids - def.gridCost);
  const pos: Vec3 = { x: e.pos.x, y: e.pos.y + 0.25, z: e.pos.z };
  const loot: LootItem = { id: `loot_${lootSeq++}`, item: s.item, pos, taken: false };
  w.loots.push(loot);
  pushEvent(w, { type: 'lootSpawned', id: loot.id, pos, item: s.item });
  return true;
}

/** 使用医疗包：开始引导（useMs），完成时回血 */
export function useMedkit(w: World, e: Entity, slot: number): boolean {
  const s = e.inventory[slot];
  if (!s) return false;
  const def = lootDef(w, s.item);
  if (def.kind !== 'medkit') return false;
  if (e.hp >= e.maxHp || e.medkitUntilMs !== null) return false;
  e.medkitUntilMs = w.elapsedMs + def.useMs;
  e.medkitItemSlot = slot;
  return true;
}

export function updateLoot(w: World): void {
  for (const e of w.entities) {
    if (!e.alive) continue;

    if (e.wantInteract) {
      e.wantInteract = false;
      tryPickup(w, e);
    }
    if (e.wantDrop !== null) {
      dropItem(w, e, e.wantDrop);
      e.wantDrop = null;
    }
    if (e.wantUse !== null) {
      useMedkit(w, e, e.wantUse);
      e.wantUse = null;
    }

    // 医疗引导完成
    if (e.medkitUntilMs !== null && w.elapsedMs >= e.medkitUntilMs) {
      const slot = e.medkitItemSlot ?? -1;
      const s = slot >= 0 ? e.inventory[slot] : null;
      e.medkitUntilMs = null;
      e.medkitItemSlot = null;
      if (s) {
        const def = lootDef(w, s.item);
        if (def.kind === 'medkit') {
          e.hp = Math.min(e.maxHp, e.hp + def.healAmount);
          s.count -= 1;
          if (s.count <= 0) e.inventory[slot] = null;
          e.usedGrids = Math.max(0, e.usedGrids - def.gridCost);
          pushEvent(w, { type: 'itemUsed', entityId: e.id, item: s.item });
        }
      }
    }
  }
}

/** AI/玩家拾取武器后立即上膛检查（弹药不足时尝试换弹） */
export function ensureReady(w: World, e: Entity): void {
  const slot = e.weapons[e.activeWeapon];
  if (slot && slot.magazine <= 0) startReload(w, e);
  void MAX_HP;
}
