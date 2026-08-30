import { describe, expect, it } from 'vitest';
import { LANDING_TOLERANCE_M } from '../src/content/constants';
import { terrainHeightAt, tickWorld } from '../src/core';
import type { PlayerState } from '../src/core/types';
import { makeWorld, playerLandingController, runUntilLanded, runTicks } from './helpers';

const TARGET = { x: 430, z: 460 }; // P 城附近落点

/** 航线上距目标城区最近的点：真实玩法中落点只能选在航线走廊内 */
function trackPointNear(w: ReturnType<typeof makeWorld>, p: { x: number; z: number }) {
  const s = w.plane.start;
  const d = w.plane.dir;
  const t = (p.x - s.x) * d.x + (p.z - s.z) * d.z;
  return { x: s.x + d.x * t, z: s.z + d.z * t };
}

describe('AC2 跳伞系统', () => {
  it('同 seed 同意图序列：落地坐标逐 tick 复现（偏差为 0）', () => {
    const a = makeWorld(20260831);
    const b = makeWorld(20260831);
    runUntilLanded(a, TARGET);
    runUntilLanded(b, TARGET);
    expect(a.player.pos.x).toBe(b.player.pos.x);
    expect(a.player.pos.y).toBe(b.player.pos.y);
    expect(a.player.pos.z).toBe(b.player.pos.z);
    expect(a.player.state).toBe('ground');
  });

  it('完整经历四阶段：plane → freefall → parachute → ground', () => {
    const w = makeWorld(7);
    const seen: PlayerState[] = [w.player.state];
    let t = 0;
    while (w.player.state !== 'ground' && t < 8000) {
      const before = w.player.state;
      tickWorld(w, playerLandingController(w, TARGET));
      if (w.player.state !== before) seen.push(w.player.state);
      t++;
    }
    expect(seen).toEqual(['plane', 'freefall', 'parachute', 'ground']);
  });

  it('落点与预选落点偏差 ≤ 地图尺度 5%（80m）', () => {
    for (const seed of [11, 20260831, 909]) {
      const w = makeWorld(seed);
      const goal = trackPointNear(w, TARGET);
      runUntilLanded(w, goal);
      const dev = Math.hypot(w.player.pos.x - goal.x, w.player.pos.z - goal.z);
      expect(dev).toBeLessThanOrEqual(LANDING_TOLERANCE_M);
    }
  });

  it('落地后 1 秒内进入正常地面移动状态并可持续移动', () => {
    const w = makeWorld(33);
    runUntilLanded(w, TARGET);
    expect(w.player.state).toBe('ground');
    const x0 = w.player.pos.x;
    // 1s = 50 tick 内保持 ground 且持续移动
    runTicks(w, [
      { kind: 'aim', yaw: 0, pitch: 0 },
      { kind: 'move', dirX: 1, dirZ: 0, sprint: true },
    ], 50);
    expect(w.player.state).toBe('ground');
    expect(w.player.pos.x).toBeGreaterThan(x0 + 3);
  });

  it('玩家可自选跳伞时机（不同时机跳伞，均能落地图内）', () => {
    const early = makeWorld(5);
    runUntilLanded(early, TARGET);

    const late = makeWorld(5);
    // 先在机上待 12s（600 tick）
    runTicks(late, [], 600);
    expect(late.player.state).toBe('plane');
    let guard = 0;
    while (late.player.state !== 'ground' && guard < 8000) {
      tickWorld(late, playerLandingController(late, TARGET));
      guard++;
    }
    expect(late.player.state).toBe('ground');

    const inMap = (p: { x: number; z: number }) => p.x >= 0 && p.x <= 1600 && p.z >= 0 && p.z <= 1600;
    expect(inMap(early.player.pos)).toBe(true);
    expect(inMap(late.player.pos)).toBe(true);
    expect(terrainHeightAt(early.pack, early.player.pos.x, early.player.pos.z)).toBeGreaterThanOrEqual(0);
  });
});
