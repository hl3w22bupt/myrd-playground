import { describe, expect, it } from 'vitest';
import { INVENTORY_GRIDS } from '../src/content/constants';
import { ITEMS, WEAPONS } from '../src/content';
import type { AmmoItemDef, ArmorItemDef, HelmetItemDef, MedkitItemDef, WeaponItemDef } from '../src/content';
import { tickWorld, vec3 } from '../src/core';
import { makeWorld, runUntilLanded, runTicks } from './helpers';

const AR = ITEMS.weapon_ar_m4 as WeaponItemDef;
const AMMO556 = ITEMS.ammo_556 as AmmoItemDef;
const AMMO45 = ITEMS.ammo_45 as AmmoItemDef;
const ARMOR = ITEMS.armor_vest as ArmorItemDef;
const HELMET = ITEMS.helmet_mk2 as HelmetItemDef;
const MEDKIT = ITEMS.medkit_large as MedkitItemDef;

/** 把玩家安置到指定位置（测试脚手架：跳过跳伞，直接地面场景） */
function placeOnGround(w: ReturnType<typeof makeWorld>, x: number, z: number) {
  const p = w.player;
  p.state = 'ground';
  p.pos = vec3(x, 0, z);
  p.pos.y = 0;
  return p;
}

describe('AC3 物资拾取与生效', () => {
  it('按区域密度规则生成物资：城区密度显著高于野区', () => {
    const w = makeWorld(42);
    let urban = 0;
    let wild = 0;
    for (const l of w.loots) {
      const inUrban = w.pack.map.urbanAreas.some(
        (u) => (l.pos.x - u.x) ** 2 + (l.pos.z - u.z) ** 2 <= u.radius * u.radius,
      );
      if (inUrban) urban++;
      else wild++;
    }
    // 城区面积 ~39万㎡，野区 ~218万㎡：期望城区 100+/野区 120 左右，密度（个/万㎡）城区应更高
    const urbanDensity = urban / 39;
    const wildDensity = wild / 218;
    expect(urban).toBeGreaterThan(50);
    expect(wild).toBeGreaterThan(50);
    expect(urbanDensity).toBeGreaterThan(wildDensity);
  });

  it('武器拾取后立即可射击（上膛），弹药计数与配置一致', () => {
    const w = makeWorld(100);
    runUntilLanded(w, { x: 430, z: 460 });
    const p = placeOnGround(w, 500, 500);

    // 脚下放一把 ar_m4（通过物资系统正常拾取通道）
    w.loots.push({ id: 'test_w', item: 'weapon_ar_m4', pos: vec3(500.5, 0, 500.5), taken: false });
    tickWorld(w, [{ kind: 'interact' }]);

    expect(p.weapons[0]).not.toBeNull();
    expect(p.weapons[0]!.weapon).toBe('ar_m4');
    expect(p.weapons[0]!.magazine).toBe(AR.loadedAmmo);
    expect(p.weapons[0]!.magazine).toBe(WEAPONS.ar_m4.magazine);

    // 立即射击：magazine 减少
    tickWorld(w, [
      { kind: 'aim', yaw: 0, pitch: 0 },
      { kind: 'fire' },
    ]);
    expect(p.weapons[0]!.magazine).toBe(WEAPONS.ar_m4.magazine - 1);
  });

  it('护甲减伤/头盔爆头减伤拾取即生效，数值与配置一致', () => {
    const w = makeWorld(101);
    const p = placeOnGround(w, 500, 500);
    expect(p.armorReduction).toBe(0);
    expect(p.helmetReduction).toBe(0);

    w.loots.push({ id: 't_a', item: 'armor_vest', pos: vec3(500.5, 0, 500.5), taken: false });
    tickWorld(w, [{ kind: 'interact' }]);
    expect(p.armorReduction).toBe(ARMOR.damageReduction);
    expect(p.armorReduction).toBe(0.35);

    w.loots.push({ id: 't_h', item: 'helmet_mk2', pos: vec3(500.5, 0, 500.5), taken: false });
    tickWorld(w, [{ kind: 'interact' }]);
    expect(p.helmetReduction).toBe(HELMET.headshotReduction);
    expect(p.helmetReduction).toBe(0.5);
  });

  it('医疗包拾取入背包、使用回血 +60（与配置一致），生命不超上限', () => {
    const w = makeWorld(102);
    const p = placeOnGround(w, 500, 500);
    p.hp = 40;

    w.loots.push({ id: 't_m', item: 'medkit_large', pos: vec3(500.5, 0, 500.5), taken: false });
    tickWorld(w, [{ kind: 'interact' }]);
    const slot = p.inventory.findIndex((s) => s?.item === 'medkit_large');
    expect(slot).toBeGreaterThanOrEqual(0);
    expect(p.usedGrids).toBe(MEDKIT.gridCost);

    // 使用：引导 3000ms 后回血
    tickWorld(w, [{ kind: 'useItem', slot }]);
    expect(p.medkitUntilMs).not.toBeNull();
    runTicks(w, [], 160); // 3.2s
    expect(p.medkitUntilMs).toBeNull();
    expect(p.hp).toBe(40 + MEDKIT.healAmount);

    // 满血时再次使用无效
    p.hp = 99;
    p.inventory[slot] = { item: 'medkit_large', count: 1 };
    p.usedGrids += MEDKIT.gridCost;
    tickWorld(w, [{ kind: 'useItem', slot }]);
    runTicks(w, [], 160);
    expect(p.hp).toBeLessThanOrEqual(p.maxHp);
    expect(p.hp).toBe(100);
  });

  it('弹药拾取进入储备，换弹消耗储备（计数与配置一致）', () => {
    const w = makeWorld(103);
    const p = placeOnGround(w, 500, 500);
    p.weapons[0] = { weapon: 'ar_m4', magazine: 0 };

    w.loots.push({ id: 't_am', item: 'ammo_556', pos: vec3(500.5, 0, 500.5), taken: false });
    tickWorld(w, [{ kind: 'interact' }]);
    expect(p.ammoReserve['ammo_556']).toBe(AMMO556.count);

    tickWorld(w, [{ kind: 'reload' }]);
    runTicks(w, [], 115); // 2.3s 换弹
    expect(p.weapons[0]!.magazine).toBe(WEAPONS.ar_m4.magazine);
    expect(p.ammoReserve['ammo_556']).toBe(AMMO556.count - WEAPONS.ar_m4.magazine);
  });

  it('背包容量上限生效：超出容量拒绝拾取；支持丢弃并在脚下生成物资', () => {
    const w = makeWorld(104);
    const p = placeOnGround(w, 500, 500);

    // 背包塞满医疗包（每个占 2 格）
    const medGrids = Math.floor(INVENTORY_GRIDS / MEDKIT.gridCost);
    for (let i = 0; i < medGrids; i++) {
      w.loots.push({ id: `t_m${i}`, item: 'medkit_large', pos: vec3(500.5, 0, 500.5), taken: false });
      tickWorld(w, [{ kind: 'interact' }]);
    }
    expect(p.usedGrids).toBe(medGrids * ITEMS.medkit_large.gridCost);

    // 再拾取一个弹药（占 2 格）应失败（容量满）
    const before = w.loots.length;
    w.loots.push({ id: 't_over', item: 'ammo_45', pos: vec3(500.5, 0, 500.5), taken: false });
    tickWorld(w, [{ kind: 'interact' }]);
    expect(p.usedGrids + AMMO45.gridCost).toBeGreaterThan(INVENTORY_GRIDS);
    const over = w.loots.find((l) => l.id === 't_over');
    expect(over?.taken).toBe(false);

    // 丢弃：背包清出格子，物资出现在脚下
    const slot = p.inventory.findIndex((s) => s?.item === 'medkit_large');
    tickWorld(w, [{ kind: 'drop', slot }]);
    expect(p.inventory[slot]).toBeNull();
    expect(w.loots.length).toBe(before + 2); // 拒绝拾取的那份 + 丢弃的那份
  });
});
