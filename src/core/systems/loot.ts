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
  spawnLootAt(w, x, z, item);
}

/** 在指定位置生成一件物资（airdrop 等系统复用；序列号取 world.lootSeq，多局互不污染） */
export function spawnLootAt(w: World, x: number, z: number, item: ItemId, count?: number): LootItem {
  const pos: Vec3 = { x, y: terrainHeightAt(w.pack, x, z) + 0.25, z };
  const loot: LootItem = { id: `loot_${w.lootSeq++}`, item, pos, taken: false, count };
  w.loots.push(loot);
  pushEvent(w, { type: 'lootSpawned', id: loot.id, pos, item });
  return loot;
}

function lootDef(w: World, item: ItemId) {
  return w.pack.items[item as keyof typeof w.pack.items];
}

/** 拾取最近的可拾取物资；最近的装不下时自动尝试下一件（不因单件背包不足而空手） */
export function tryPickup(w: World, e: Entity): boolean {
  if (e.state !== 'ground') return false;
  const candidates: Array<{ loot: LootItem; d: number }> = [];
  for (const l of w.loots) {
    if (l.taken) continue;
    const d = dist2D(e.pos.x, e.pos.z, l.pos.x, l.pos.z);
    if (d <= PICKUP_RADIUS_M) candidates.push({ loot: l, d });
  }
  candidates.sort((a, b) => a.d - b.d);
  for (const { loot } of candidates) {
    if (!addItem(w, e, loot.item, loot.count)) continue;
    loot.taken = true;
    pushEvent(w, { type: 'lootPickedUp', entityId: e.id, item: loot.item, pos: loot.pos });
    return true;
  }
  return false;
}

/**
 * 物品入包并立即生效：
 * - 武器 → 空武器槽并上膛（loadedAmmo），立即可射击
 * - 弹药 → 并入储备（占 gridCost 格子）
 * - 护甲/头盔 → 立即装备（不占格子）
 * - 医疗包 → 入背包（占格子），按键使用
 */
export function addItem(w: World, e: Entity, itemId: ItemId, countOverride?: number): boolean {
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
    const count = countOverride ?? def.count;
    const idx = e.inventory.findIndex((s) => s !== null && s.item === itemId);
    if (idx >= 0) {
      e.inventory[idx]!.count += count;
    } else {
      const free = e.inventory.findIndex((s) => s === null);
      if (free < 0) return false;
      e.inventory[free] = { item: itemId, count };
      e.usedGrids += def.gridCost;
    }
    e.ammoReserve[def.ammoType] = (e.ammoReserve[def.ammoType] ?? 0) + count;
    return true;
  }

  // medkit
  const free = e.inventory.findIndex((s) => s === null);
  if (free < 0) return false;
  e.inventory[free] = { item: itemId, count: 1 };
  e.usedGrids += def.gridCost;
  return true;
}

/** 丢弃背包格整叠物资（在脚下重新生成，堆叠数量随物资保留；弹药同步扣减射击储备） */
export function dropItem(w: World, e: Entity, slot: number): boolean {
  const s = e.inventory[slot];
  if (!s || s.count <= 0) return false;
  const def = lootDef(w, s.item);
  const dropped = s.count;
  e.inventory[slot] = null;
  e.usedGrids = Math.max(0, e.usedGrids - def.gridCost);
  if (def.kind === 'ammo') {
    e.ammoReserve[def.ammoType] = Math.max(0, (e.ammoReserve[def.ammoType] ?? 0) - dropped);
  }
  spawnLootAt(w, e.pos.x, e.pos.z, s.item, dropped);
  return true;
}

/** 解析背包格：负数 = 第一个非空格（drop 意图语义） */
export function resolveDropSlot(e: Entity, slot: number): number {
  if (slot >= 0) return slot;
  return e.inventory.findIndex((s) => s !== null);
}

/** 使用医疗物品：开始引导（useMs），完成时回血。slot < 0 = 使用第一个可用的医疗物品 */
export function useMedkit(w: World, e: Entity, slot: number): boolean {
  const target = slot >= 0 ? slot : e.inventory.findIndex((s) => s !== null && lootDef(w, s.item).kind === 'medkit');
  if (target < 0 || target >= e.inventory.length) return false;
  const s = e.inventory[target];
  if (!s) return false;
  const def = lootDef(w, s.item);
  if (def.kind !== 'medkit') return false;
  if (e.hp >= e.maxHp || e.medkitUntilMs !== null) return false;
  e.medkitUntilMs = w.elapsedMs + def.useMs;
  e.medkitItemSlot = target;
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
      dropItem(w, e, resolveDropSlot(e, e.wantDrop));
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
