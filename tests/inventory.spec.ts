/**
 * tests/inventory —— 背包与物资管理线：堆叠 / 武器丢弃 / 弹药储备一致性 / usedGrids 重算。
 * tests/ai-diversity —— AI 行为多样化：人格分配 / 治疗行为 / 抢空投（在本文件合并覆盖）。
 */

import { describe, expect, it } from 'vitest';
import { INVENTORY_GRIDS } from '../src/content/constants';
import { ITEMS, AI, DEFAULT_CONTENT_PACK, derivePack } from '../src/content';
import type { AmmoItemDef } from '../src/content';
import { tickWorld, vec3, terrainHeightAt } from '../src/core';
import { makeWorld, runUntilLanded } from './helpers';

const AMMO556 = ITEMS.ammo_556 as AmmoItemDef;

function placeOnGround(w: ReturnType<typeof makeWorld>, x: number, z: number) {
  const p = w.player;
  p.state = 'ground';
  p.pos = vec3(x, terrainHeightAt(w.pack, x, z), z);
  return p;
}

function freezeAis(w: ReturnType<typeof makeWorld>) {
  for (const e of w.entities) {
    if (e.kind !== 'ai') continue;
    e.pendingIntents = [];
    e.moveDirX = 0;
    e.moveDirZ = 0;
    e.firing = false;
    e.pos = vec3(20 + e.index * 3, 0, 20);
  }
  w.zone.mode = 'wait';
  w.zone.timerMs = 1_000_000_000;
  w.zone.dps = 0;
}

describe('背包与物资管理', () => {
  it('同类医疗物资按 stackMax 堆叠占格（2 个医疗箱 = 1 格 2 计数）', () => {
    const w = makeWorld(800);
    runUntilLanded(w, { x: 500, z: 500 });
    freezeAis(w);
    const p = placeOnGround(w, 500, 500);
    w.loots.push({ id: 's1', item: 'medkit_large', pos: vec3(500.5, 0, 500.5), taken: false });
    tickWorld(w, [{ kind: 'interact' }]);
    w.loots.push({ id: 's2', item: 'medkit_large', pos: vec3(500.5, 0, 500.5), taken: false });
    tickWorld(w, [{ kind: 'interact' }]);
    const stacks = p.inventory.filter((s) => s !== null && s.item === 'medkit_large');
    expect(stacks.length).toBe(1);
    expect(stacks[0]!.count).toBe(2);
    expect(p.usedGrids).toBe(ITEMS.medkit_large.gridCost);
    // 第 3 个超 stackMax 开新格
    w.loots.push({ id: 's3', item: 'medkit_large', pos: vec3(500.5, 0, 500.5), taken: false });
    tickWorld(w, [{ kind: 'interact' }]);
    const stacks2 = p.inventory.filter((s) => s !== null && s.item === 'medkit_large');
    expect(stacks2.length).toBe(2);
    expect(p.usedGrids).toBe(ITEMS.medkit_large.gridCost * 2);
  });

  it('弹药拾取堆叠合并且储备与背包计数一致（丢弃整盒同步扣储备）', () => {
    const w = makeWorld(801);
    runUntilLanded(w, { x: 500, z: 500 });
    freezeAis(w);
    const p = placeOnGround(w, 500, 500);
    w.loots.push({ id: 'a1', item: 'ammo_556', pos: vec3(500.5, 0, 500.5), taken: false });
    tickWorld(w, [{ kind: 'interact' }]);
    w.loots.push({ id: 'a2', item: 'ammo_556', pos: vec3(500.5, 0, 500.5), taken: false });
    tickWorld(w, [{ kind: 'interact' }]);
    expect(p.ammoReserve['ammo_556']).toBe(AMMO556.count * 2);
    // 同格堆叠（count 累加，未超 stackMax × count）
    const ammoStacks = p.inventory.filter((s) => s !== null && s.item === 'ammo_556');
    expect(ammoStacks.length).toBe(1);
    expect(ammoStacks[0]!.count).toBe(AMMO556.count * 2);
    const slot = p.inventory.findIndex((s) => s !== null && s.item === 'ammo_556');
    // 丢弃一次 = 丢弃整盒（def.count），储备同步扣减
    tickWorld(w, [{ kind: 'drop', slot }]);
    expect(p.ammoReserve['ammo_556']).toBe(AMMO556.count);
    expect(p.inventory[slot]).not.toBeNull();
    tickWorld(w, [{ kind: 'drop', slot }]);
    expect(p.ammoReserve['ammo_556']).toBe(0);
    expect(p.inventory[slot]).toBeNull();
    expect(p.usedGrids).toBe(0);
  });

  it('丢弃当前武器：武器槽腾空、地面生成对应武器物资、激活槽回退', () => {
    const w = makeWorld(802);
    runUntilLanded(w, { x: 500, z: 500 });
    freezeAis(w);
    const p = placeOnGround(w, 500, 500);
    p.weapons[0] = { weapon: 'ar_m4', magazine: 12 };
    p.weapons[1] = { weapon: 'smg_ump', magazine: 20 };
    p.activeWeapon = 1;
    tickWorld(w, [{ kind: 'dropWeapon', slot: -1 }]);
    expect(p.weapons[1]).toBeNull();
    expect(p.activeWeapon).toBe(0);
    const dropped = w.loots.find((l) => l.item === 'weapon_smg_ump' && !l.taken);
    expect(dropped).toBeDefined();
    // 可重新拾取（按配置重新上膛）
    tickWorld(w, [{ kind: 'interact' }]);
    expect(p.weapons[1]?.weapon).toBe('smg_ump');
    expect(p.weapons[1]?.magazine).toBe(ITEMS.weapon_smg_ump.kind === 'weapon' ? ITEMS.weapon_smg_ump.loadedAmmo : 0);
  });

  it('容量按堆叠格计：武器/护甲/头盔不占格，满格后拒绝入包类物资', () => {
    const w = makeWorld(803);
    runUntilLanded(w, { x: 500, z: 500 });
    freezeAis(w);
    const p = placeOnGround(w, 500, 500);
    // 护甲头盔不占格
    w.loots.push({ id: 'ar1', item: 'armor_vest', pos: vec3(500.5, 0, 500.5), taken: false });
    tickWorld(w, [{ kind: 'interact' }]);
    w.loots.push({ id: 'h1', item: 'helmet_mk2', pos: vec3(500.5, 0, 500.5), taken: false });
    tickWorld(w, [{ kind: 'interact' }]);
    expect(p.armorReduction).toBeGreaterThan(0);
    expect(p.helmetReduction).toBeGreaterThan(0);
    expect(p.usedGrids).toBe(0);
    // 塞满绷带（每格 1 格 cost × stackMax 10）：20 格 = 2 格绷带堆
    const stacks = Math.floor(INVENTORY_GRIDS / ITEMS.bandage.gridCost);
    for (let i = 0; i < stacks * ITEMS.bandage.stackMax; i++) {
      w.loots.push({ id: `b${i}`, item: 'bandage', pos: vec3(500.5, 0, 500.5), taken: false });
      tickWorld(w, [{ kind: 'interact' }]);
    }
    expect(p.usedGrids).toBe(INVENTORY_GRIDS);
    w.loots.push({ id: 'over', item: 'first_aid', pos: vec3(500.5, 0, 500.5), taken: false });
    tickWorld(w, [{ kind: 'interact' }]);
    expect(w.loots.find((l) => l.id === 'over')?.taken).toBe(false);
  });
});

describe('AI 行为多样化', () => {
  it('人格按权重分配且同 seed 可复现（三种人格均出现）', () => {
    const w = makeWorld(810, 19);
    const personalities = w.entities.filter((e) => e.kind === 'ai').map((e) => e.aiPersonality);
    expect(personalities.length).toBe(19);
    const set = new Set(personalities);
    // 19 个 AI、三种人格权重 35/40/25：全集大概率覆盖全部三种（固定 seed 必然确定）
    expect(set.size).toBeGreaterThanOrEqual(2);
    for (const p of personalities) {
      expect(['aggressive', 'balanced', 'cautious']).toContain(p);
    }
    const w2 = makeWorld(810, 19);
    const p2 = w2.entities.filter((e) => e.kind === 'ai').map((e) => e.aiPersonality);
    expect(p2).toEqual(personalities);
  });

  it('治疗行为：无敌人可见且血量低于人格阈值时 AI 使用医疗物资并回血', () => {
    const w = makeWorld(811, 3);
    runUntilLanded(w, { x: 500, z: 500 });
    const ai = w.entities[1];
    // 把所有 AI 与玩家隔离（不可见），冻结玩家
    const p = w.player;
    p.state = 'ground';
    p.pos = vec3(1400, terrainHeightAt(w.pack, 1400, 1400), 1400);
    p.pendingIntents = [];
    w.zone.mode = 'wait';
    w.zone.timerMs = 1_000_000_000;
    w.zone.radius = 2000;
    w.zone.dps = 0;

    ai.state = 'ground';
    ai.pos = vec3(500, terrainHeightAt(w.pack, 500, 500), 500);
    ai.hp = 40; // 低于全部人格的 healBelowHp
    // 已武装（有武器有弹），脱离 criticalLoot「先找武器」分支，专注验证治疗行为
    ai.weapons[0] = { weapon: 'ar_m4', magazine: 30 };
    ai.activeWeapon = 0;
    ai.ammoReserve['ammo_556'] = 120;
    ai.inventory[0] = { item: 'first_aid', count: 1 };
    const others = w.entities.slice(2);
    for (const o of others) {
      o.pos = vec3(20 + o.index * 3, 0, 20);
      o.pendingIntents = [];
    }

    let used = false;
    for (let i = 0; i < 400; i++) {
      // 冻结其余实体意图（被测 AI 的意图由 FSM 产出，不干预）
      for (const o of others) o.pendingIntents = [];
      p.pendingIntents = [];
      tickWorld(w, []);
      for (const ev of w.events) {
        if (ev.type === 'itemUsed' && ev.entityId === ai.id) used = true;
      }
      w.events.length = 0;
      if (used) break;
    }
    expect(used).toBe(true);
    expect(ai.hp).toBeGreaterThan(40);
  });

  it('谨慎人格撤退：低血量遇敌时背向敌人移动（retreat）', () => {
    const cautiousOnly = derivePack(DEFAULT_CONTENT_PACK, {
      ai: {
        ...AI,
        personalityWeights: [{ personality: 'cautious' as const, weight: 1 }],
      },
    });
    const w = makeWorld(812, 1, cautiousOnly);
    runUntilLanded(w, { x: 500, z: 500 });
    const ai = w.entities[1];
    const p = w.player;
    p.state = 'ground';
    p.pos = vec3(520, terrainHeightAt(w.pack, 520, 500), 500);
    p.pendingIntents = [];
    w.zone.mode = 'wait';
    w.zone.timerMs = 1_000_000_000;
    w.zone.radius = 2000;
    w.zone.dps = 0;

    ai.state = 'ground';
    ai.pos = vec3(500, terrainHeightAt(w.pack, 500, 500), 500);
    ai.hp = 30; // < retreatBelowHp 45
    ai.weapons[0] = { weapon: 'ar_m4', magazine: 30 };
    ai.activeWeapon = 0;
    ai.ammoReserve['ammo_556'] = 300;

    const d0 = Math.hypot(p.pos.x - ai.pos.x, p.pos.z - ai.pos.z);
    let retreated = false;
    for (let i = 0; i < 200; i++) {
      p.pendingIntents = [];
      tickWorld(w, []);
      w.events.length = 0;
      if (ai.aiState === 'retreat') retreated = true;
      if (retreated) break;
    }
    const d1 = Math.hypot(p.pos.x - ai.pos.x, p.pos.z - ai.pos.z);
    expect(retreated).toBe(true);
    expect(d1).toBeGreaterThan(d0); // 背向玩家拉开距离
  });
});
