/**
 * tests/airdrop —— 空投线：缩圈阶段触发投放、降落伞下落、落地生成高级物资包、
 * 落点在下一圈范围内、同 seed 可复现、整局自然出现空投且不破坏闭环。
 */

import { describe, expect, it } from 'vitest';
import { tickWorld, vec3, terrainHeightAt } from '../src/core';
import { AIRDROP, AI, DEFAULT_CONTENT_PACK, derivePack } from '../src/content';
import { makeWorld, runUntilLanded, runToEnd, playerLandingController } from './helpers';
import { nearestLandedAirdrop } from '../src/core/systems/airdrop';

/** 冻结玩家操作（无意图）跑到第 targetPhase 阶段开始 */
function runToPhase(w: ReturnType<typeof makeWorld>, targetPhase: number, maxTicks = 30_000): number {
  let t = 0;
  while (w.zone.phase < targetPhase && t < maxTicks && w.status !== 'ended') {
    tickWorld(w, []);
    t++;
  }
  return t;
}

describe('空投（阶段触发 / 下落 / 落地物资）', () => {
  it('进入触发阶段 wait 时投放空投：airdropIncoming 事件 + falling 状态', () => {
    const w = makeWorld(700);
    let incoming = 0;
    while (w.zone.phase < 1 && w.status !== 'ended') {
      tickWorld(w, []);
      for (const ev of w.events) if (ev.type === 'airdropIncoming') incoming++;
      w.events.length = 0;
    }
    expect(w.zone.phase).toBe(1);
    expect(incoming).toBe(1);
    expect(w.airdrops.length).toBe(1);
    expect(w.airdrops[0].state).toBe('falling');
  });

  it('空投匀速下落并落地：airdropLanded 事件 + 落点在下一圈范围内', () => {
    const w = makeWorld(701);
    runToPhase(w, 1);
    const drop = w.airdrops[0];
    expect(drop).toBeDefined();
    const startY = drop.pos.y;
    // 下落到落地最多 spawnAltitude/fallSpeed 秒
    const maxTicks = Math.ceil(AIRDROP.spawnAltitude / AIRDROP.fallSpeed / 0.02) + 50;
    let landed = 0;
    for (let i = 0; i < maxTicks && drop.state === 'falling'; i++) {
      const before = drop.pos.y;
      tickWorld(w, []);
      expect(drop.pos.y).toBeLessThan(before); // 单调下降
      for (const ev of w.events) if (ev.type === 'airdropLanded') landed++;
      w.events.length = 0;
    }
    expect(drop.state).toBe('landed');
    expect(landed).toBe(1);
    expect(startY).toBeGreaterThan(drop.pos.y);
    // 落点在下一圈范围内（landingRadiusRatio 容差 + 投放时圈心漂移余量）
    const dNext = Math.hypot(drop.pos.x - w.zone.nextCenter.x, drop.pos.z - w.zone.nextCenter.z);
    expect(dNext).toBeLessThanOrEqual(w.zone.nextRadius + 1);
    // 落地高度贴地
    const ground = terrainHeightAt(w.pack, drop.pos.x, drop.pos.z);
    expect(Math.abs(drop.pos.y - ground)).toBeLessThan(2);
  });

  it('落地生成高级物资包：bundle 物品全部出现在箱周且可拾取', () => {
    const w = makeWorld(702);
    runToPhase(w, 1);
    const drop = w.airdrops[0];
    for (let i = 0; i < 2000 && drop.state === 'falling'; i++) {
      tickWorld(w, []);
      w.events.length = 0;
    }
    expect(drop.state).toBe('landed');
    const nearby = w.loots.filter(
      (l) => !l.taken && Math.hypot(l.pos.x - drop.pos.x, l.pos.z - drop.pos.z) <= AIRDROP.bundleSpreadM + 1,
    );
    const items = nearby.map((l) => l.item).sort();
    expect(items).toEqual([...AIRDROP.bundle].sort());
    // 含空投专属装备
    expect(items).toContain('weapon_ar_groza');
    expect(items).toContain('armor_vest_l3');
    expect(items).toContain('helmet_l3');
  });

  it('空投物资可被玩家拾取并立即生效（Groza 上膛即可射）', () => {
    // 隔离变量：本用例只验证「玩家拾取空投物资」机制，派生包关闭 AI 感知/拾取/抢空投竞争
    const passiveAI = derivePack(DEFAULT_CONTENT_PACK, {
      ai: { ...AI, visionRange: 0, lootSearchRange: 0, airdropSeekRange: 0 },
    });
    const w = makeWorld(703, 12, passiveAI);
    runUntilLanded(w, { x: 500, z: 500 });
    runToPhase(w, 1);
    const drop = w.airdrops[0];
    for (let i = 0; i < 2000 && drop.state === 'falling'; i++) {
      tickWorld(w, []);
      w.events.length = 0;
    }
    expect(drop.state).toBe('landed');
    // 把玩家挪到空投旁并屏蔽 AI 干扰；逐个靠近拾取（交互半径 3m，物资环布在箱周）
    const p = w.player;
    p.state = 'ground';
    for (const e of w.entities) {
      if (e.kind === 'ai') {
        e.pos = vec3(30 + e.index * 3, 0, 30);
        e.pendingIntents = [];
      }
    }
    let hasGroza = false;
    for (let k = 0; k < AIRDROP.bundle.length && !hasGroza; k++) {
      const near = w.loots
        .filter((l) => !l.taken && Math.hypot(l.pos.x - drop.pos.x, l.pos.z - drop.pos.z) <= AIRDROP.bundleSpreadM + 1)
        .sort((a, b) => a.id.localeCompare(b.id))[0];
      if (!near) break;
      p.pos = vec3(near.pos.x, near.pos.y, near.pos.z);
      tickWorld(w, [{ kind: 'interact' }]);
      hasGroza = p.weapons.some((s) => s !== null && s.weapon === 'ar_groza');
    }
    expect(hasGroza).toBe(true);
  });

  it('同 seed 空投落点可复现；不同 seed 落点不同（rng 子流隔离）', () => {
    const land = (seed: number) => {
      const w = makeWorld(seed);
      runToPhase(w, 1);
      const drop = w.airdrops[0];
      for (let i = 0; i < 2000 && drop.state === 'falling'; i++) {
        tickWorld(w, []);
        w.events.length = 0;
      }
      return { x: drop.pos.x, z: drop.pos.z };
    };
    const a1 = land(704);
    const a2 = land(704);
    const b = land(705);
    expect(a1.x).toBeCloseTo(a2.x, 6);
    expect(a1.z).toBeCloseTo(a2.z, 6);
    expect(Math.hypot(a1.x - b.x, a1.z - b.z)).toBeGreaterThan(1);
  });

  it('nearestLandedAirdrop：AI 抢空投感知接口（只返回已落地且在半径内的）', () => {
    const w = makeWorld(706);
    runToPhase(w, 1);
    const drop = w.airdrops[0];
    // 未落地：不可感知
    expect(nearestLandedAirdrop(w, drop.pos.x, drop.pos.z, 500)).toBeNull();
    for (let i = 0; i < 2000 && drop.state === 'falling'; i++) {
      tickWorld(w, []);
      w.events.length = 0;
    }
    expect(nearestLandedAirdrop(w, drop.pos.x + 10, drop.pos.z, 500)?.id).toBe(drop.id);
    expect(nearestLandedAirdrop(w, drop.pos.x + 10, drop.pos.z, 5)).toBeNull();
  });

  it('完整对局闭环：空投自然出现且对局仍 ≤10 分钟自然结束（E2E 门）', () => {
    const w = makeWorld(707);
    let airdropsSeen = 0;
    let landedSeen = 0;
    const t = runToEnd(w, 31_000, (ww) => {
      const intents = playerLandingController(ww, { x: 500, z: 500 });
      for (const ev of ww.events) {
        if (ev.type === 'airdropIncoming') airdropsSeen++;
        if (ev.type === 'airdropLanded') landedSeen++;
      }
      ww.events.length = 0;
      return intents;
    });
    expect(w.status).toBe('ended');
    expect(t * 20).toBeLessThanOrEqual(600_000);
    // 对局足够长时至少触发一次空投（触发阶段 1：首圈收缩完成后进入 phase1 wait）
    expect(airdropsSeen).toBeGreaterThanOrEqual(1);
    expect(landedSeen).toBeGreaterThanOrEqual(1);
    expect(w.result).not.toBeNull();
    expect(w.result!.winnerId).not.toBeNull();
  });
});
