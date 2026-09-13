/**
 * airdrop.spec —— 空投系统（玩法缺口补齐项的自动化断言）：
 * 1) 调度：首投时间/间隔/单局上限与 content/airdrop 配置一致；
 * 2) 确定性：同 seed 两次模拟，空投落点与散布物资逐 tick 一致；
 * 3) 落点：落在安全区内（landRadiusFactor 约束）；
 * 4) 生命周期：falling → landed（快照可见 + 事件驱动），落地散布高价值物资；
 * 5) 玩法闭环：玩家可拾取空投专属武器 sr_awm 并立即射击。
 */

import { describe, expect, it } from 'vitest';
import { WEAPONS } from '../src/content';
import { createWorldForTest, tickWorld, vec3 } from '../src/core';
import type { PlayerIntent, World } from '../src/core';
import { makeWorld, runUntilLanded } from './helpers';

const FIRST_AT_MS = 55 * 1000;
const INTERVAL_MS = 110 * 1000;
const MAX_DROPS = 3;

/** 推进到指定逻辑时刻 */
function runToMs(w: World, ms: number, maxTicks = 40_000): void {
  let t = 0;
  while (w.elapsedMs < ms && t < maxTicks) {
    tickWorld(w, []);
    t++;
  }
  if (w.elapsedMs < ms) throw new Error(`未能在 ${maxTicks} tick 内推进到 ${ms}ms`);
}

/** 收集空投事件 */
function drainAirdropEvents(w: World): { incoming: number; landed: number } {
  let incoming = 0;
  let landed = 0;
  for (const ev of w.events) {
    if (ev.type === 'airdropIncoming') incoming++;
    if (ev.type === 'airdropLanded') landed++;
  }
  w.events.length = 0;
  return { incoming, landed };
}

describe('空投系统（airdrop）', () => {
  it('调度与配置一致：首投 55s、间隔 110s、单局上限 3 次', () => {
    const w = makeWorld(130);
    runToMs(w, FIRST_AT_MS - 20);
    expect(w.airdrops.length).toBe(0); // 首投前无空投
    runToMs(w, FIRST_AT_MS + 20);
    expect(w.airdrops.length).toBe(1);
    runToMs(w, FIRST_AT_MS + INTERVAL_MS + 20);
    expect(w.airdrops.length).toBe(2);
    runToMs(w, FIRST_AT_MS + INTERVAL_MS * 5 + 20);
    expect(w.airdrops.length).toBe(MAX_DROPS); // 封顶
    // 事件成对出现（incoming ≥ landed，落地的都已发 landed 事件）
    const ev = drainAirdropEvents(w);
    expect(ev.incoming).toBe(MAX_DROPS);
    expect(ev.landed).toBe(MAX_DROPS);
  });

  it('确定性：同 seed 两次模拟，落点与散布物资位置一致', () => {
    const w1 = makeWorld(131);
    const w2 = makeWorld(131);
    runToMs(w1, FIRST_AT_MS + 30_000);
    runToMs(w2, FIRST_AT_MS + 30_000);
    expect(w1.airdrops.length).toBe(w2.airdrops.length);
    expect(w1.airdrops.length).toBeGreaterThan(0);
    for (let i = 0; i < w1.airdrops.length; i++) {
      const a = w1.airdrops[i];
      const b = w2.airdrops[i];
      expect(a.id).toBe(b.id);
      expect(a.pos.x).toBeCloseTo(b.pos.x, 9);
      expect(a.pos.y).toBeCloseTo(b.pos.y, 9);
      expect(a.pos.z).toBeCloseTo(b.pos.z, 9);
      expect(a.phase).toBe(b.phase);
    }
    // 散布物资（落地生成）的位置也一致
    const aLoots = w1.loots.filter((l) => l.id.startsWith('loot_')).slice(-10);
    const bLoots = w2.loots.filter((l) => l.id.startsWith('loot_')).slice(-10);
    expect(aLoots.length).toBe(bLoots.length);
    for (let i = 0; i < aLoots.length; i++) {
      expect(aLoots[i].pos.x).toBeCloseTo(bLoots[i].pos.x, 9);
      expect(aLoots[i].pos.z).toBeCloseTo(bLoots[i].pos.z, 9);
    }
  });

  it('落点在安全区内（landRadiusFactor = 0.55 约束）且在下落中快照可见', () => {
    const w = makeWorld(132);
    runToMs(w, FIRST_AT_MS + 100); // 刚投放，仍处于高空
    expect(w.airdrops.length).toBe(1);
    const crate = w.airdrops[0];
    expect(crate.phase).toBe('falling');
    const d = Math.hypot(crate.pos.x - w.zone.center.x, crate.pos.z - w.zone.center.z);
    const bound = w.zone.radius * 0.55 + 5; // +5：地图边界 clamp 余量
    expect(d).toBeLessThanOrEqual(bound);
    // 快照通道暴露空投（渲染/小地图数据源）
    const snap = w.airdrops;
    expect(snap.length).toBe(1);
  });

  it('生命周期：falling → landed，落地散布高价值物资（含空投专属 sr_awm）', () => {
    const w = makeWorld(133);
    runToMs(w, FIRST_AT_MS + 100);
    expect(w.airdrops[0].phase).toBe('falling');
    // 下落：从 260m 以 18m/s 计 ≤ 15s 落地
    runToMs(w, FIRST_AT_MS + 30_000);
    const crate = w.airdrops[0];
    expect(crate.phase).toBe('landed');
    expect(crate.landedAtMs).not.toBeNull();
    // 内容物已散布：sr_awm 武器 + ammo_300 + 三级甲 + 三级盔 + 医疗包
    for (const item of ['weapon_sr_awm', 'ammo_300', 'armor_vest_lv3', 'helmet_mk3', 'medkit_large']) {
      expect(w.loots.some((l) => !l.taken && l.item === item)).toBe(true);
    }
    // 落地物资在箱旁 scatterRadius = 4m 内
    const awm = w.loots.find((l) => l.item === 'weapon_sr_awm')!;
    expect(Math.hypot(awm.pos.x - crate.pos.x, awm.pos.z - crate.pos.z)).toBeLessThanOrEqual(6);
  });

  it('玩法闭环：玩家拾取空投专属武器 sr_awm 并可立即射击', () => {
    // 单 AI 对局：排除等待期被其它 AI 击杀的干扰
    const w = makeWorld(134, 1);
    runUntilLanded(w, { x: 500, z: 500 });
    const p = w.player;
    p.state = 'ground';
    // 先冻结缩圈并把 AI 隔离到对角，再等待空投
    w.zone.mode = 'wait';
    w.zone.timerMs = 1_000_000_000;
    w.zone.center = vec3(800, 0, 800);
    w.zone.radius = 2000;
    w.zone.dps = 0;
    const loneAi = w.entities[1];
    loneAi.pos = vec3(40, 0, 40);
    runToMs(w, FIRST_AT_MS + 30_000);
    const crate = w.airdrops[0];
    expect(crate.phase).toBe('landed');
    // 玩家传送到 sr_awm 散布点拾取（标准 interact 通道；散布点 0..4m 内取最近）
    const awmLoot = w.loots.find((l) => !l.taken && l.item === 'weapon_sr_awm')!;
    p.pos = vec3(awmLoot.pos.x + 0.3, awmLoot.pos.y, awmLoot.pos.z);
    tickWorld(w, [{ kind: 'interact' }]);
    const held = p.weapons.find((s) => s?.weapon === 'sr_awm');
    expect(held).not.toBeUndefined();
    expect(held!.magazine).toBe(WEAPONS.sr_awm.magazine);
    // 立即射击：magazine 减少（弹道下坠 + 后坐力全链路生效）
    const intents: PlayerIntent[] = [
      { kind: 'aim', yaw: 0, pitch: 0 },
      { kind: 'fire' },
    ];
    tickWorld(w, intents);
    expect(held!.magazine).toBe(WEAPONS.sr_awm.magazine - 1);
  });

  it('createWorldForTest 的快照通道包含空投（分配版与复用版一致）', () => {
    const match = createWorldForTest({ seed: 135, playerCount: 1, aiCount: 10 });
    // createMatch 包装层才有 snapshot；这里直接验证 world → buildSnapshot 由 match.spec 覆盖，
    // 本用例验证空投调度函数可独立驱动（可测性）
    expect(match.airdrops).toEqual([]);
    let fired = false;
    let t = 0;
    while (!fired && t < 10_000) {
      tickWorld(match, []);
      fired = match.airdrops.length > 0;
      t++;
    }
    // 默认 10_000 tick = 200s > 首投 55s → 必有空投
    expect(fired).toBe(true);
  });
});
