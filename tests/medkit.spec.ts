/**
 * medkit.spec —— 血包急救语义补齐（开火打断医疗引导）：
 * 1) 医疗引导中开火 → 引导立即取消，引导时长结束后不回血（急救语义：持枪射击即中断包扎）；
 * 2) 不打断时按 useMs 完成回血 +healAmount 且与 content/items 配置一致（与 loot.spec 互补，聚焦打断）。
 */

import { describe, expect, it } from 'vitest';
import { ITEMS } from '../src/content';
import type { MedkitItemDef } from '../src/content';
import { tickWorld, vec3, applyDamage, findBestMedkitSlot } from '../src/core';
import { makeWorld, runTicks } from './helpers';

const MEDKIT = ITEMS.medkit_large as MedkitItemDef;

/** 把玩家安置到平地并给一把满弹 ar_m4 + 一个医疗包 */
function rigPlayer() {
  const w = makeWorld(310, 1);
  const p = w.player;
  p.state = 'ground';
  p.pos = vec3(500, 0, 500);
  p.weapons[0] = { weapon: 'ar_m4', magazine: 30 };
  p.weapons[1] = null;
  p.activeWeapon = 0;
  p.ammoReserve['ammo_556'] = 1000;
  const slot = 0;
  p.inventory[slot] = { item: 'medkit_large', count: 1 };
  p.usedGrids = MEDKIT.gridCost;
  return { w, p, slot };
}

describe('医疗包急救语义（AC3）', () => {
  it('医疗引导中开火 → 引导取消，引导时长结束后不回血', () => {
    const { w, p, slot } = rigPlayer();
    p.hp = 40;

    // 开始医疗引导
    tickWorld(w, [{ kind: 'useItem', slot }]);
    expect(p.medkitUntilMs).not.toBeNull();

    // 引导期间开火（按住 1 tick）→ 打断
    tickWorld(w, [{ kind: 'aim', yaw: 0, pitch: 0 }, { kind: 'fire' }]);
    expect(p.medkitUntilMs).toBeNull();
    expect(p.hp).toBe(40);

    // 再跑 5s：无引导完成，生命不恢复
    runTicks(w, [{ kind: 'stopFire' }], 250);
    expect(p.hp).toBe(40);
    // 医疗包仍在背包（未消耗）
    expect(p.inventory[slot]).toEqual({ item: 'medkit_large', count: 1 });
  });

  it('不打断时按配置 useMs 完成回血 +healAmount，医疗包消耗', () => {
    const { w, p, slot } = rigPlayer();
    p.hp = 40;
    expect(MEDKIT.healAmount).toBe(60);
    expect(MEDKIT.useMs).toBe(3000);

    tickWorld(w, [{ kind: 'useItem', slot }]);
    expect(p.medkitUntilMs).not.toBeNull();
    runTicks(w, [], 200); // 4s ≥ useMs
    expect(p.medkitUntilMs).toBeNull();
    expect(p.hp).toBe(100); // 40 + 60，不超上限
    expect(p.inventory[slot]).toBeNull(); // 已消耗
  });
});

describe('三档血包 + Q 自动选择 + 受击打断（玩法缺口补齐项）', () => {
  const BANDAGE = ITEMS.medkit_bandage as MedkitItemDef;
  const FIRST = ITEMS.medkit_first as MedkitItemDef;

  it('content/items 提供绷带/急救包/医疗包三档，healAmount/useMs 递增可区分', () => {
    expect(BANDAGE.kind).toBe('medkit');
    expect(FIRST.kind).toBe('medkit');
    expect(MEDKIT.kind).toBe('medkit');
    expect(BANDAGE.healAmount).toBeLessThan(FIRST.healAmount);
    expect(FIRST.healAmount).toBeLessThan(MEDKIT.healAmount);
    expect(BANDAGE.useMs).toBeLessThan(FIRST.useMs);
    expect(FIRST.useMs).toBeLessThan(MEDKIT.useMs);
  });

  it('Q 自动选择（useBestMedkit）用最强血包而非首个格子', () => {
    const w = makeWorld(312, 1);
    const p = w.player;
    p.state = 'ground';
    p.pos = vec3(500, 0, 500);
    p.hp = 25;
    // 弱血包（绷带）在前、强血包（医疗包）在后
    p.inventory[0] = { item: 'medkit_bandage', count: 1 };
    p.inventory[1] = { item: 'medkit_large', count: 1 };
    p.usedGrids = BANDAGE.gridCost + MEDKIT.gridCost;

    tickWorld(w, [{ kind: 'useBestMedkit' }]);
    expect(p.medkitItemSlot).toBe(1); // 应选中医疗包
    runTicks(w, [], 200); // 4s > 3s useMs
    expect(p.hp).toBe(25 + MEDKIT.healAmount);
    expect(p.inventory[1]).toBeNull(); // 医疗包已消耗
    expect(p.inventory[0]).toEqual({ item: 'medkit_bandage', count: 1 }); // 绷带未动
  });

  it('医疗引导中受击（非开火）→ 立即打断且不回血', () => {
    const { w, p, slot } = rigPlayer();
    p.hp = 40;
    tickWorld(w, [{ kind: 'useItem', slot }]);
    expect(p.medkitUntilMs).not.toBeNull();
    applyDamage(w, p, 25, 'torso', null);
    expect(p.medkitUntilMs).toBeNull();
    runTicks(w, [], 250);
    expect(p.hp).toBe(15); // 40 - 25，无回血
  });

  it('findBestMedkitSlot 数值来自 content：跨档返回最强档位', () => {
    const w = makeWorld(313, 1);
    const p = w.player;
    p.inventory[0] = { item: 'medkit_first', count: 1 };
    p.inventory[1] = { item: 'medkit_large', count: 2 };
    p.inventory[2] = { item: 'medkit_bandage', count: 1 };
    expect(findBestMedkitSlot(w, p)).toBe(1);
  });
});
