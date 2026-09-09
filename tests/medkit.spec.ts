/**
 * medkit.spec —— 血包急救（玩法缺口补齐项的自动化断言）：
 * 1) Q 语义 slot -1：自动选择第一个可用医疗物品（绷带/急救包/医疗包按格子顺序）；
 * 2) 引导时长与回复量逐物品与 content/items 配置一致，生命不超上限；
 * 3) 受击打断 / 开火打断：引导取消、物品不消耗、不回血；
 * 4) 满血拒绝使用；AI 低血自动治疗（无可见敌人时）。
 */

import { describe, expect, it } from 'vitest';
import { ITEMS, WEAPONS } from '../src/content';
import type { MedkitItemDef } from '../src/content';
import { tickWorld, vec3 } from '../src/core';
import type { PlayerIntent, World } from '../src/core';
import { makeWorld, runTicks, runUntilLanded } from './helpers';

const MEDKIT = ITEMS.medkit_large as MedkitItemDef;
const FIRSTAID = ITEMS.firstaid_kit as MedkitItemDef;
const BANDAGE = ITEMS.bandage as MedkitItemDef;

/** 把玩家安置到指定位置（跳过跳伞；屏蔽干扰） */
function placeOnGround(w: World, x: number, z: number) {
  const p = w.player;
  p.state = 'ground';
  p.pos = vec3(x, 0, z);
  // 冻结缩圈，排除毒圈伤害干扰
  w.zone.mode = 'wait';
  w.zone.timerMs = 1_000_000_000;
  w.zone.center = vec3(x, 0, z);
  w.zone.radius = 2000;
  w.zone.dps = 0;
  return p;
}

describe('血包急救（medkit）', () => {
  it('slot -1 自动选择：按背包顺序使用第一个医疗物品（绷带优先）', () => {
    const w = makeWorld(110);
    const p = placeOnGround(w, 500, 500);
    p.hp = 50;
    // 槽 0 = 绷带，槽 1 = 医疗包
    w.loots.push({ id: 't_b', item: 'bandage', pos: vec3(500.5, 0, 500.5), taken: false });
    tickWorld(w, [{ kind: 'interact' }]);
    w.loots.push({ id: 't_m', item: 'medkit_large', pos: vec3(500.5, 0, 500.5), taken: false });
    tickWorld(w, [{ kind: 'interact' }]);

    tickWorld(w, [{ kind: 'useItem', slot: -1 }]);
    expect(p.medkitItemSlot).toBe(0); // 选中的是第一格绷带
    expect(p.medkitUntilMs).not.toBeNull();
    runTicks(w, [], 70); // 1.4s ≥ 绷带 1.2s
    expect(p.hp).toBe(50 + BANDAGE.healAmount);
    expect(p.inventory[0]).toBeNull(); // 绷带消耗
    expect(p.inventory[1]?.item).toBe('medkit_large'); // 医疗包未动
  });

  it('引导时长与回复量与配置一致（medkit 3s/+60、firstaid 2s/+45、bandage 1.2s/+15）', () => {
    for (const [item, def] of [
      ['medkit_large', MEDKIT],
      ['firstaid_kit', FIRSTAID],
      ['bandage', BANDAGE],
    ] as const) {
      const w = makeWorld(111 + def.gridCost);
      const p = placeOnGround(w, 500, 500);
      p.hp = 40;
      w.loots.push({ id: `t_${item}`, item, pos: vec3(500.5, 0, 500.5), taken: false });
      tickWorld(w, [{ kind: 'interact' }]);
      const slot = p.inventory.findIndex((s) => s?.item === item);

      tickWorld(w, [{ kind: 'useItem', slot }]);
      // 引导未完成前不回血
      runTicks(w, [], Math.max(1, Math.floor(def.useMs / 20) - 1));
      expect(p.hp).toBe(40);
      runTicks(w, [], 2);
      expect(p.hp).toBe(40 + def.healAmount);
      void slot;
    }
  });

  it('受击打断：引导中受伤 → 取消引导、不回血、物品不消耗', () => {
    const w = makeWorld(112);
    const p = placeOnGround(w, 500, 500);
    p.hp = 40;
    w.buildings.length = 0; // 靶场无遮挡
    // 其余 AI 冻结在远处，仅保留一个受控射手
    for (let i = 2; i < w.entities.length; i++) {
      const e = w.entities[i];
      e.pos = vec3(1600, 0, 30 + i * 3);
      e.pendingIntents = [{ kind: 'move', dirX: 0, dirZ: 0 }];
      e.moveDirX = 0;
      e.moveDirZ = 0;
      e.firing = false;
    }
    w.loots.push({ id: 't_m', item: 'medkit_large', pos: vec3(500.5, 0, 500.5), taken: false });
    tickWorld(w, [{ kind: 'interact' }]);
    const slot = p.inventory.findIndex((s) => s?.item === 'medkit_large');

    tickWorld(w, [{ kind: 'useItem', slot }]);
    expect(p.medkitUntilMs).not.toBeNull();
    // 走标准伤害通道（combat.applyDamage）触发受击打断：受控 AI 射手直射玩家
    const shooter = w.entities[1];
    shooter.state = 'ground';
    shooter.pos = vec3(530, 0, 500); // 30m 正对
    shooter.weapons[0] = { weapon: 'ar_m4', magazine: 30 };
    const fireIntents = [
      { kind: 'aim', yaw: Math.PI, pitch: 0 },
      { kind: 'fire' },
    ] as PlayerIntent[];
    shooter.pendingIntents = fireIntents;
    let interrupted = false;
    for (let i = 0; i < 30 && !interrupted; i++) {
      tickWorld(w, []);
      shooter.pendingIntents = fireIntents;
      if (p.medkitUntilMs === null) interrupted = true;
    }
    expect(interrupted).toBe(true);
    // 只承受了打断的这一枪（30m 躯干 26 伤害 = 40-26），引导回血未发生
    expect(p.hp).toBe(40 - WEAPONS.ar_m4.damage);
    expect(p.inventory[slot]?.item).toBe('medkit_large'); // 物品未消耗
  });

  it('开火打断：引导中扣扳机 → 引导取消', () => {
    const w = makeWorld(113);
    const p = placeOnGround(w, 500, 500);
    p.hp = 40;
    p.weapons[0] = { weapon: 'ar_m4', magazine: 30 };
    p.ammoReserve['ammo_556'] = 90;
    w.loots.push({ id: 't_m', item: 'medkit_large', pos: vec3(500.5, 0, 500.5), taken: false });
    tickWorld(w, [{ kind: 'interact' }]);
    const slot = p.inventory.findIndex((s) => s?.item === 'medkit_large');

    tickWorld(w, [{ kind: 'useItem', slot }]);
    expect(p.medkitUntilMs).not.toBeNull();
    const intents: PlayerIntent[] = [
      { kind: 'aim', yaw: 0, pitch: 0 },
      { kind: 'fire' },
    ];
    tickWorld(w, intents);
    expect(p.medkitUntilMs).toBeNull();
  });

  it('满血拒绝使用；生命回复不超上限', () => {
    const w = makeWorld(114);
    const p = placeOnGround(w, 500, 500);
    p.hp = 100;
    w.loots.push({ id: 't_m', item: 'medkit_large', pos: vec3(500.5, 0, 500.5), taken: false });
    tickWorld(w, [{ kind: 'interact' }]);
    const slot = p.inventory.findIndex((s) => s?.item === 'medkit_large');

    tickWorld(w, [{ kind: 'useItem', slot }]);
    expect(p.medkitUntilMs).toBeNull(); // 满血不开引导

    // 接近满血时使用：回复封顶 maxHp
    p.hp = 95;
    tickWorld(w, [{ kind: 'useItem', slot }]);
    runTicks(w, [], 160);
    expect(p.hp).toBe(Math.min(100, 95 + MEDKIT.healAmount));
    expect(p.hp).toBeLessThanOrEqual(p.maxHp);
  });

  it('AI 低血自动治疗：无可见敌人时使用医疗物品并回血', () => {
    const w = makeWorld(115);
    runUntilLanded(w, { x: 500, z: 500 });
    // 等 AI 落地
    let ai = null as World['entities'][number] | null;
    for (let i = 0; i < 6000 && !ai; i++) {
      tickWorld(w, []);
      ai = w.entities.find((e) => e.kind === 'ai' && e.state === 'ground') ?? null;
    }
    const a = ai!;
    // 冻结缩圈（避免 AI 优先避毒），低血 + 脚下绷带，其余实体挪到远处
    w.zone.mode = 'wait';
    w.zone.timerMs = 1_000_000_000;
    w.zone.center = vec3(60, 0, 60);
    w.zone.radius = 2000;
    w.zone.dps = 0;
    a.hp = 30;
    a.pos = vec3(60, 0, 60);
    a.aiWaypoint = vec3(60, 0, 60);
    for (let i = 1; i < w.entities.length; i++) {
      if (w.entities[i] !== a) {
        const e = w.entities[i];
        e.state = 'ground';
        e.pos = vec3(1500 + (i % 5) * 8, 0, 100 + i * 12);
        e.moveDirX = 0;
        e.moveDirZ = 0;
        e.firing = false;
      }
    }
    w.buildings.length = 0;
    w.loots.push({ id: 't_ai_m', item: 'bandage', pos: vec3(60.5, 0, 60.5), taken: false });
    let healed = false;
    for (let i = 0; i < 3000 && !healed; i++) {
      tickWorld(w, []);
      if (a.hp > 30) healed = true;
    }
    expect(healed).toBe(true);
  });
});
