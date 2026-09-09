/**
 * airdrop.spec —— 定时空投（玩法缺口补齐项：对局中期高价值物资集中投放）：
 * 1) 内容表数值来自 content/airdrop（时间/次数/内容物）；
 * 2) 投放 → 下落 → 落地 → 内容物经标准 loot 通道在箱旁散布（可拾取）；
 * 3) 落点与散布确定性：同 seed 完全复现（rng.airdrop 独立子流）。
 */

import { describe, expect, it } from 'vitest';
import { AIRDROP, DEFAULT_CONTENT_PACK, derivePack } from '../src/content';
import { buildSnapshot, tickWorld } from '../src/core';
import { makeWorld } from './helpers';

/** 快速空投内容包：首投即投、高速下落、单局 1 箱 —— 仅加速时间轴，不改变空投玩法路径 */
const FAST_AIRDROP = derivePack(DEFAULT_CONTENT_PACK, {
  airdrop: {
    ...AIRDROP,
    firstDropAtSec: 0.05,
    respawnIntervalSec: 1000,
    maxDrops: 1,
    spawnAltitude: 80,
    fallSpeedMps: 10_000,
    landRadiusFactor: 0.2,
    landMinRadiusFactor: 0.05,
    scatterRadiusM: 3,
  },
});

describe('定时空投（airdrop）', () => {
  it('内容表数值来自 content/airdrop：首投/间隔/次数上限/内容物非空', () => {
    expect(AIRDROP.firstDropAtSec).toBeGreaterThan(0);
    expect(AIRDROP.respawnIntervalSec).toBeGreaterThan(0);
    expect(AIRDROP.maxDrops).toBeGreaterThanOrEqual(1);
    expect(AIRDROP.contents.length).toBeGreaterThanOrEqual(3);
    // 空投内容物必须是 content/items 已定义 id（走标准 loot 通道）
    for (const entry of AIRDROP.contents) {
      expect(DEFAULT_CONTENT_PACK.items[entry.item as keyof typeof DEFAULT_CONTENT_PACK.items]).toBeDefined();
    }
  });

  it('投放→下落→落地→内容物在箱旁散布（走标准 loot，可被拾取）', () => {
    const w = makeWorld(330, 1, FAST_AIRDROP);
    const before = w.loots.length;
    for (let i = 0; i < 10; i++) tickWorld(w, []);

    // 空投箱落地
    expect(w.airdrops.length).toBe(1);
    expect(w.airdrops[0].phase).toBe('landed');
    expect(w.airdrops[0].landedAtMs).not.toBeNull();

    // 事件：投放 + 落地
    const evTypes = new Set(w.events.map((e) => e.type));
    expect(evTypes.has('airdropIncoming')).toBe(true);
    expect(evTypes.has('airdropLanded')).toBe(true);

    // 落地散布：新增 loot = 内容物总份数
    const expectedCount = AIRDROP.contents.reduce((s, e) => s + e.count, 0);
    expect(w.loots.length - before).toBe(expectedCount);
    const crate = w.airdrops[0];
    // 每个内容物类型至少一份在箱旁散布半径内
    for (const entry of AIRDROP.contents) {
      const found = w.loots.some(
        (l) => l.item === entry.item && Math.hypot(l.pos.x - crate.pos.x, l.pos.z - crate.pos.z) <= 6,
      );
      expect(found).toBe(true);
    }

    // 快照暴露空投箱（渲染只读数据源）
    const snap = buildSnapshot(w);
    expect(snap.airdrops.length).toBe(1);
    expect(snap.airdrops[0].phase).toBe('landed');
  });

  it('落点与散布确定性：同 seed 复现（rng.airdrop 独立子流）', () => {
    const run = (seed: number) => {
      const w = makeWorld(seed, 1, FAST_AIRDROP);
      const before = w.loots.length;
      for (let i = 0; i < 10; i++) tickWorld(w, []);
      return {
        crate: { x: w.airdrops[0].pos.x, z: w.airdrops[0].pos.z },
        scattered: w.loots
          .slice(before)
          .map((l) => ({ item: l.item, x: l.pos.x, z: l.pos.z })),
      };
    };
    const a = run(409);
    const b = run(409);
    expect(a.crate).toEqual(b.crate);
    expect(a.scattered).toEqual(b.scattered);
    // 不同 seed 落点不同（低概率碰撞，稳定性足够）
    const c = run(410);
    expect(c.crate).not.toEqual(a.crate);
  });
});
