import { describe, expect, it } from 'vitest';
import { AI_COUNT_DEFAULT } from '../src/content/constants';
import { tickWorld } from '../src/core';
import { makeWorld, runToEnd, runUntilLanded } from './helpers';

describe('AC5b AI 敌人', () => {
  it('每局生成 ≥10 名 AI（实体上限 20）', () => {
    const w = makeWorld(70);
    const ai = w.entities.filter((e) => e.kind === 'ai');
    expect(ai.length).toBeGreaterThanOrEqual(10);
    expect(w.entities.length).toBeLessThanOrEqual(w.pack.constants.ENTITY_CAP);
    expect(AI_COUNT_DEFAULT).toBe(12);
  });

  it('AI 具备巡图行为（patrol：有巡逻点且位置随时间变化）', () => {
    const w = makeWorld(71);
    runUntilLanded(w, { x: 500, z: 500 });
    // 等 AI 落地
    let guard = 0;
    while (guard < 6000 && !w.entities.some((e) => e.kind === 'ai' && e.state === 'ground')) {
      tickWorld(w, []);
      guard++;
    }
    const ai = w.entities.find((e) => e.kind === 'ai' && e.state === 'ground')!;
    const start = { ...ai.pos };
    let moved = 0;
    for (let i = 0; i < 500; i++) {
      tickWorld(w, []);
      moved += Math.abs(ai.pos.x - start.x) + Math.abs(ai.pos.z - start.z);
    }
    expect(ai.aiState === 'patrol' || ai.aiState === 'loot' || ai.aiState === 'fleeZone').toBe(true);
    expect(moved).toBeGreaterThan(5);
  });

  it('AI 具备拾取行为（落地后拾取武器/物资）', () => {
    const w = makeWorld(72);
    runUntilLanded(w, { x: 500, z: 500 });
    // 推进至多数 AI 落地并活动 60s
    let guard = 0;
    while (guard < 6000) {
      tickWorld(w, []);
      guard++;
      const landed = w.entities.filter((e) => e.kind === 'ai' && e.state === 'ground').length;
      if (landed >= Math.floor(w.entities.length * 0.8) && guard > 1500) break;
    }
    // 继续 60s（3000 tick）
    for (let i = 0; i < 3000; i++) tickWorld(w, []);
    const armed = w.entities.filter((e) => e.kind === 'ai' && (e.weapons[0] !== null || e.weapons[1] !== null));
    const looted = w.entities.filter((e) => e.kind === 'ai' && e.usedGrids > 0);
    expect(armed.length + looted.length).toBeGreaterThan(0);
    // AI 拾取走的是同一套 loot 系统：物资被消耗
    expect(w.loots.some((l) => l.taken)).toBe(true);
  });

  it('AI 具备索敌与开火行为（fire 状态出现并产生伤害事件）', () => {
    const w = makeWorld(73);
    runUntilLanded(w, { x: 500, z: 500 });
    // 快进：AI 落地、拾取、相遇交火
    let sawFire = false;
    let sawDamage = false;
    for (let i = 0; i < 9000 && !(sawFire && sawDamage); i++) {
      tickWorld(w, []);
      for (const e of w.entities) {
        if (e.kind === 'ai' && e.aiState === 'fire') sawFire = true;
      }
      for (const ev of w.events) {
        if (ev.type === 'damageDealt') sawDamage = true;
      }
      w.events.length = 0;
    }
    expect(sawFire).toBe(true);
    expect(sawDamage).toBe(true);
  });

  it('AI 具备避毒行为（圈外 AI 向圈心移动）', () => {
    const w = makeWorld(74);
    runUntilLanded(w, { x: 500, z: 500 });
    // 找一个已落地 AI，把它扔到圈外
    let ai = w.entities.find((e) => e.kind === 'ai' && e.state === 'ground');
    let guard = 0;
    while (!ai && guard < 6000) {
      tickWorld(w, []);
      ai = w.entities.find((e) => e.kind === 'ai' && e.state === 'ground');
      guard++;
    }
    ai = ai!;
    ai.pos = {
      x: w.zone.center.x + w.zone.radius * 0.95 + 60,
      y: ai.pos.y,
      z: w.zone.center.z,
    };
    const distBefore = Math.hypot(ai.pos.x - w.zone.center.x, ai.pos.z - w.zone.center.z);
    for (let i = 0; i < 400; i++) tickWorld(w, []);
    const distAfter = Math.hypot(ai.pos.x - w.zone.center.x, ai.pos.z - w.zone.center.z);
    expect(ai.aiState).toBe('fleeZone');
    expect(distAfter).toBeLessThan(distBefore);
  });

  it('AI 可被玩家或其他 AI 淘汰（对局中 AI 之间会互相淘汰）', () => {
    const w = makeWorld(75);
    runToEnd(w, 31_000);
    const aiEliminated = w.entities.filter((e) => e.kind === 'ai' && !e.alive);
    expect(aiEliminated.length).toBeGreaterThan(0);
    // 淘汰归因包含 shot 或 zone
    const causes = new Set(
      w.events.filter((e) => e.type === 'entityEliminated').map((e) => (e as { cause: string }).cause),
    );
    expect(causes.size).toBeGreaterThan(0);
  });
});
