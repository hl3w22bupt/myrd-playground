/**
 * tests/med —— 血包急救线：多档医疗物资 / 引导回血 / 受击与开火打断 / 自动选药 / 引导中禁射与减速。
 */

import { describe, expect, it } from 'vitest';
import { ITEMS } from '../src/content';
import type { MedkitItemDef } from '../src/content';
import { tickWorld, vec3, terrainHeightAt } from '../src/core';
import { makeWorld, runUntilLanded } from './helpers';
import { findBestMedkitSlot } from '../src/core/systems/loot';
import { applyDamage } from '../src/core/systems/combat';

const BANDAGE = ITEMS.bandage as MedkitItemDef;
const FIRST_AID = ITEMS.first_aid as MedkitItemDef;
const MEDKIT = ITEMS.medkit_large as MedkitItemDef;

function placeOnGround(w: ReturnType<typeof makeWorld>, x: number, z: number) {
  const p = w.player;
  p.state = 'ground';
  p.pos = vec3(x, terrainHeightAt(w.pack, x, z), z);
  return p;
}

/** 冻结其余 AI，避免干扰 */
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

describe('血包急救（多档医疗物资与引导规则）', () => {
  it('绷带/急救包/医疗箱引导完成分别按配置回血', () => {
    for (const [item, def] of [
      ['bandage', BANDAGE],
      ['first_aid', FIRST_AID],
      ['medkit_large', MEDKIT],
    ] as const) {
      const w = makeWorld(600);
      runUntilLanded(w, { x: 500, z: 500 });
      freezeAis(w);
      const p = placeOnGround(w, 500, 500);
      p.hp = 30;
      p.inventory[0] = { item, count: 1 };
      tickWorld(w, [{ kind: 'useItem', slot: 0 }]);
      expect(p.medkitUntilMs).not.toBeNull();
      // 跑过引导时长
      const ticks = Math.ceil(def.useMs / 20) + 2;
      for (let i = 0; i < ticks; i++) tickWorld(w, []);
      expect(p.medkitUntilMs).toBeNull();
      expect(p.hp).toBe(Math.min(p.maxHp, 30 + def.healAmount));
      expect(p.inventory[0]).toBeNull();
    }
  });

  it('受击打断引导：不回血、发出 medkitInterrupted 事件', () => {
    const w = makeWorld(601);
    runUntilLanded(w, { x: 500, z: 500 });
    freezeAis(w);
    const p = placeOnGround(w, 500, 500);
    p.hp = 40;
    p.inventory[0] = { item: 'first_aid', count: 1 };
    tickWorld(w, [{ kind: 'useItem', slot: 0 }]);
    expect(p.medkitUntilMs).not.toBeNull();

    // 引导中受到伤害（与枪击/毒圈同一打断路径）
    applyDamage(w, p, 5, 'torso', null);
    let interrupted = false;
    for (const ev of w.events) {
      if (ev.type === 'medkitInterrupted' && ev.entityId === p.id) interrupted = true;
    }
    expect(interrupted).toBe(true);
    expect(p.medkitUntilMs).toBeNull();
    // 引导被打断：急救包未消耗、未回血（hp = 40 - 5 受击伤害）
    expect(p.hp).toBe(35);
    expect(p.inventory[0]?.count).toBe(1);
  });

  it('开火打断引导：玩家主动开火立即取消治疗', () => {
    const w = makeWorld(602);
    runUntilLanded(w, { x: 500, z: 500 });
    freezeAis(w);
    const p = placeOnGround(w, 500, 500);
    p.hp = 40;
    p.weapons[0] = { weapon: 'ar_m4', magazine: 30 };
    p.ammoReserve['ammo_556'] = 300;
    p.inventory[0] = { item: 'bandage', count: 5 };
    tickWorld(w, [{ kind: 'useItem', slot: 0 }]);
    expect(p.medkitUntilMs).not.toBeNull();
    tickWorld(w, [{ kind: 'fire' }, { kind: 'aim', yaw: 0, pitch: 0 }]);
    expect(p.medkitUntilMs).toBeNull();
  });

  it('引导中禁止射击命中（tryFire 被引导阻塞）', () => {
    const w = makeWorld(603);
    runUntilLanded(w, { x: 500, z: 500 });
    freezeAis(w);
    const p = placeOnGround(w, 500, 500);
    p.hp = 40;
    p.weapons[0] = { weapon: 'ar_m4', magazine: 30 };
    p.ammoReserve['ammo_556'] = 300;
    p.inventory[0] = { item: 'medkit_large', count: 1 };
    tickWorld(w, [{ kind: 'useItem', slot: 0 }]);
    let fired = 0;
    for (let i = 0; i < 20; i++) {
      tickWorld(w, [{ kind: 'aim', yaw: 0, pitch: 0 }]);
      // 绕开 applyIntent 的 fire 打断路径：直接置 firing 模拟长按（验证 tryFire 阻塞）
      p.firing = true;
      tickWorld(w, []);
      for (const ev of w.events) if (ev.type === 'shotFired') fired++;
      w.events.length = 0;
    }
    expect(fired).toBe(0);
  });

  it('自动选药（slot=-1）：重伤优先急救包，轻伤用绷带', () => {
    const w = makeWorld(604);
    runUntilLanded(w, { x: 500, z: 500 });
    freezeAis(w);
    const p = placeOnGround(w, 500, 500);
    p.inventory[0] = { item: 'bandage', count: 5 };
    p.inventory[1] = { item: 'first_aid', count: 1 };
    p.inventory[2] = { item: 'medkit_large', count: 1 };

    p.hp = 30; // 缺口 70 → 选 first_aid（75 ≤ 70×1.6）
    expect(findBestMedkitSlot(w, p)).toBe(1);

    p.hp = 92; // 缺口 8 → 高档都超配，回退绷带
    expect(findBestMedkitSlot(w, p)).toBe(0);

    // 无绷带时小伤也可回退到高档（不至于无药可用）
    p.inventory[0] = null;
    expect(findBestMedkitSlot(w, p)).toBe(1);

    // useItem(-1) 走完整通道
    p.hp = 30;
    tickWorld(w, [{ kind: 'useItem', slot: -1 }]);
    expect(p.medkitUntilMs).not.toBeNull();
    expect(p.medkitItemSlot).toBe(1);
  });

  it('引导中移动减速：位移低于正常步行（channelMoveSpeedMul 生效）', () => {
    const w = makeWorld(605);
    runUntilLanded(w, { x: 500, z: 500 });
    freezeAis(w);
    const p = placeOnGround(w, 500, 500);
    p.hp = 40;
    p.inventory[0] = { item: 'first_aid', count: 1 };
    tickWorld(w, [{ kind: 'useItem', slot: 0 }]);
    const x0 = p.pos.x;
    for (let i = 0; i < 25; i++) {
      tickWorld(w, [{ kind: 'move', dirX: 1, dirZ: 0, sprint: true }]);
    }
    const moved = p.pos.x - x0;
    // 0.5s 正常疾跑应 ~4.3m；引导中（0.5 倍步行）应 ≤ 1.5m
    expect(moved).toBeLessThan(1.5);
    expect(moved).toBeGreaterThan(0.5);
  });
});
