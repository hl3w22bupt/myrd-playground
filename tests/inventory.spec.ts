/**
 * inventory.spec —— 背包与物资管理（玩法缺口补齐项的自动化断言）：
 * 1) 拾取最近可行：最近的装不下时自动尝试下一件（不因单件背包不足而空手）；
 * 2) 整叠丢弃：堆叠数量随物资保留，格子回收，丢弃物可再次拾取且数量一致；
 * 3) slot -1 丢弃语义：第一个非空格；
 * 4) 新物品（绷带/急救包/AWM 弹药）容量记账与 content/items 配置一致；
 * 5) AI 拾取对新增物资生效（内容表驱动，无需改 AI 逻辑）。
 */

import { describe, expect, it } from 'vitest';
import { INVENTORY_GRIDS } from '../src/content/constants';
import { ITEMS } from '../src/content';
import type { AmmoItemDef, MedkitItemDef } from '../src/content';
import { tickWorld, vec3 } from '../src/core';
import { makeWorld, runUntilLanded } from './helpers';

const AMMO300 = ITEMS.ammo_300 as AmmoItemDef;
const BANDAGE = ITEMS.bandage as MedkitItemDef;

function placeOnGround(w: ReturnType<typeof makeWorld>, x: number, z: number) {
  const p = w.player;
  p.state = 'ground';
  p.pos = vec3(x, 0, z);
  w.zone.mode = 'wait';
  w.zone.timerMs = 1_000_000_000;
  w.zone.center = vec3(x, 0, z);
  w.zone.radius = 2000;
  w.zone.dps = 0;
  return p;
}

describe('背包与物资管理（inventory）', () => {
  it('拾取最近可行：最近的武器装不下（双武器已满）时自动拾取下一件弹药', () => {
    const w = makeWorld(120);
    const p = placeOnGround(w, 500, 500);
    // 双武器槽占满
    p.weapons[0] = { weapon: 'ar_m4', magazine: 30 };
    p.weapons[1] = { weapon: 'smg_ump', magazine: 25 };

    // 最近的 = 武器（装不下），稍远 = 弹药（可装）
    w.loots.push({ id: 'near_w', item: 'weapon_ar_m4', pos: vec3(500.4, 0, 500), taken: false });
    w.loots.push({ id: 'far_a', item: 'ammo_556', pos: vec3(500.8, 0, 500), taken: false });
    tickWorld(w, [{ kind: 'interact' }]);

    expect(w.loots.find((l) => l.id === 'near_w')?.taken).toBe(false); // 武器留在地上
    expect(w.loots.find((l) => l.id === 'far_a')?.taken).toBe(true); // 弹药被拾起
    expect(p.ammoReserve['ammo_556']).toBe((ITEMS.ammo_556 as AmmoItemDef).count);
  });

  it('整叠丢弃：弹药堆叠数量保留、格子回收、再拾取数量一致', () => {
    const w = makeWorld(121);
    const p = placeOnGround(w, 500, 500);
    p.weapons[0] = { weapon: 'ar_m4', magazine: 0 };

    w.loots.push({ id: 't_am', item: 'ammo_556', pos: vec3(500.5, 0, 500.5), taken: false });
    tickWorld(w, [{ kind: 'interact' }]);
    const count = (ITEMS.ammo_556 as AmmoItemDef).count;
    expect(p.ammoReserve['ammo_556']).toBe(count);
    const slot = p.inventory.findIndex((s) => s?.item === 'ammo_556');
    expect(slot).toBeGreaterThanOrEqual(0);
    expect(p.usedGrids).toBe((ITEMS.ammo_556 as AmmoItemDef).gridCost);

    // 整叠丢弃：格子回收，物资出现在脚下且堆叠数量一致
    const lootsBefore = w.loots.length;
    tickWorld(w, [{ kind: 'drop', slot }]);
    expect(p.inventory[slot]).toBeNull();
    expect(p.usedGrids).toBe(0);
    expect(p.ammoReserve['ammo_556']).toBe(0);
    const dropped = w.loots[w.loots.length - 1];
    expect(w.loots.length).toBe(lootsBefore + 1);
    expect(dropped.item).toBe('ammo_556');
    expect(dropped.count).toBe(count);

    // 再拾取：储备回到相同数量（丢弃不吞数量）
    tickWorld(w, [{ kind: 'interact' }]);
    expect(p.ammoReserve['ammo_556']).toBe(count);
  });

  it('slot -1 丢弃：第一个非空格被丢弃', () => {
    const w = makeWorld(122);
    const p = placeOnGround(w, 500, 500);
    p.hp = 60;
    w.loots.push({ id: 't_b1', item: 'bandage', pos: vec3(500.5, 0, 500.5), taken: false });
    tickWorld(w, [{ kind: 'interact' }]);
    w.loots.push({ id: 't_m1', item: 'medkit_large', pos: vec3(500.5, 0, 500.5), taken: false });
    tickWorld(w, [{ kind: 'interact' }]);
    expect(p.inventory[0]?.item).toBe('bandage');
    expect(p.inventory[1]?.item).toBe('medkit_large');

    tickWorld(w, [{ kind: 'drop', slot: -1 }]);
    expect(p.inventory[0]).toBeNull(); // 第一格（绷带）被丢弃
    expect(p.inventory[1]?.item).toBe('medkit_large');
    expect(p.usedGrids).toBe(ITEMS.medkit_large.gridCost); // 仅剩医疗包的格子
  });

  it('新物品容量记账：AWM 弹药/绷带的 gridCost 与 content/items 一致', () => {
    const w = makeWorld(123);
    const p = placeOnGround(w, 500, 500);

    w.loots.push({ id: 't_300', item: 'ammo_300', pos: vec3(500.5, 0, 500.5), taken: false });
    tickWorld(w, [{ kind: 'interact' }]);
    expect(p.ammoReserve['ammo_300']).toBe(AMMO300.count);
    expect(p.usedGrids).toBe(AMMO300.gridCost);

    w.loots.push({ id: 't_bd', item: 'bandage', pos: vec3(500.5, 0, 500.5), taken: false });
    tickWorld(w, [{ kind: 'interact' }]);
    expect(p.usedGrids).toBe(AMMO300.gridCost + BANDAGE.gridCost);

    // 逐一丢弃后格子清零（slot -1 = 第一个非空格）
    tickWorld(w, [{ kind: 'drop', slot: -1 }]);
    tickWorld(w, [{ kind: 'drop', slot: -1 }]);
    expect(p.usedGrids).toBe(0);
  });

  it('背包上限语义不变：20 格装满后拾取被拒', () => {
    const w = makeWorld(124);
    const p = placeOnGround(w, 500, 500);
    const grids = Math.floor(INVENTORY_GRIDS / ITEMS.medkit_large.gridCost);
    for (let i = 0; i < grids; i++) {
      w.loots.push({ id: `t_m${i}`, item: 'medkit_large', pos: vec3(500.5, 0, 500.5), taken: false });
      tickWorld(w, [{ kind: 'interact' }]);
    }
    expect(p.usedGrids).toBe(grids * ITEMS.medkit_large.gridCost);
    w.loots.push({ id: 't_over', item: 'bandage', pos: vec3(500.5, 0, 500.5), taken: false });
    tickWorld(w, [{ kind: 'interact' }]);
    // bandage 只占 1 格但 20 格已满 → 拒绝
    expect(p.usedGrids).toBe(INVENTORY_GRIDS);
    expect(w.loots.find((l) => l.id === 't_over')?.taken).toBe(false);
  });

  it('AI 拾取对新增物资生效：AI 会拾取空投弹药 ammo_300（内容表驱动）', () => {
    const w = makeWorld(125);
    runUntilLanded(w, { x: 500, z: 500 });
    let ai = null as ReturnType<typeof makeWorld>['entities'][number] | null;
    for (let i = 0; i < 6000 && !ai; i++) {
      tickWorld(w, []);
      ai = w.entities.find((e) => e.kind === 'ai' && e.state === 'ground') ?? null;
    }
    const a = ai!;
    // 冻结圈、清建筑、其它实体挪远
    w.zone.mode = 'wait';
    w.zone.timerMs = 1_000_000_000;
    w.zone.center = vec3(60, 0, 60);
    w.zone.radius = 2000;
    w.zone.dps = 0;
    w.buildings.length = 0;
    a.pos = vec3(60, 0, 60);
    for (let i = 1; i < w.entities.length; i++) {
      if (w.entities[i] !== a) {
        const e = w.entities[i];
        e.pos = vec3(1500 + (i % 5) * 8, 0, 100 + i * 12);
        e.moveDirX = 0;
        e.moveDirZ = 0;
        e.firing = false;
      }
    }
    w.loots.push({ id: 't_ai_300', item: 'ammo_300', pos: vec3(60.5, 0, 60.5), taken: false });
    let picked = false;
    for (let i = 0; i < 3000 && !picked; i++) {
      tickWorld(w, []);
      picked = w.loots.find((l) => l.id === 't_ai_300')?.taken === true;
    }
    expect(picked).toBe(true);
    expect((a.ammoReserve['ammo_300'] ?? 0)).toBeGreaterThan(0);
  });
});
