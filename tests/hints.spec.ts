/**
 * tests/hints —— 快照提示字段断言：
 * AC3「靠近物资时出现可拾取提示」→ snapshot.player.nearbyLoot；
 * AC5「圈外按秒掉血的界面提示」→ snapshot.player.outsideZone。
 * 判定属玩法规则，落在 core 快照；UI 只渲染。
 */

import { describe, expect, it } from 'vitest';
import { PICKUP_RADIUS_M } from '../src/content/constants';
import { buildSnapshot, vec3 } from '../src/core';
import { makeWorld } from './helpers';

import type { World } from '../src/core';

function placeOnGround(w: World, x: number, z: number) {
  const p = w.player;
  p.state = 'ground';
  p.pos = vec3(x, 0, z);
  return p;
}

describe('AC3 拾取提示（snapshot.player.nearbyLoot）', () => {
  it('范围内存在物资：返回最近一个，且距离 ≤ 拾取半径', () => {
    const w = makeWorld(7);
    const p = placeOnGround(w, 500, 500);
    // 清空既有物资，构造确定性场景
    w.loots = [];
    w.loots.push({ id: 'near', item: 'weapon_ar_m4', pos: vec3(501.0, 0, 501.0), taken: false });
    w.loots.push({ id: 'near2', item: 'medkit_large', pos: vec3(500.4, 0, 500.4), taken: false });
    w.loots.push({ id: 'far', item: 'armor_vest', pos: vec3(506, 0, 506), taken: false });

    const snap = buildSnapshot(w);
    expect(snap.player?.nearbyLoot).not.toBeNull();
    expect(snap.player?.nearbyLoot?.id).toBe('near2');
    expect(snap.player?.nearbyLoot?.item).toBe('medkit_large');
    expect(snap.player?.nearbyLoot!.dist).toBeLessThanOrEqual(PICKUP_RADIUS_M);
    void p;
  });

  it('范围内无物资：nearbyLoot 为 null（不显示提示）', () => {
    const w = makeWorld(7);
    placeOnGround(w, 500, 500);
    w.loots = [];
    w.loots.push({ id: 'far', item: 'weapon_ar_m4', pos: vec3(506, 0, 506), taken: false });

    const snap = buildSnapshot(w);
    expect(snap.player?.nearbyLoot).toBeNull();
  });

  it('已拾取（taken）与空中状态（plane）均不产生提示', () => {
    const w = makeWorld(7);
    placeOnGround(w, 500, 500);
    w.loots = [];
    w.loots.push({ id: 'taken', item: 'weapon_ar_m4', pos: vec3(500.5, 0, 500.5), taken: true });
    expect(buildSnapshot(w).player?.nearbyLoot).toBeNull();

    const p = w.player;
    p.state = 'plane';
    p.pos = vec3(800, 400, 800);
    w.loots.push({ id: 'below', item: 'medkit_large', pos: vec3(800.5, 0, 800.5), taken: false });
    expect(buildSnapshot(w).player?.nearbyLoot).toBeNull();
  });
});

describe('AC5 毒圈警示（snapshot.player.outsideZone）', () => {
  it('玩家在安全区内：outsideZone = false', () => {
    const w = makeWorld(7);
    // 圈心附近（初始圈半径 600m，圈心在地图中心附近）
    placeOnGround(w, w.zone.center.x, w.zone.center.z);
    expect(buildSnapshot(w).player?.outsideZone).toBe(false);
  });

  it('玩家在安全区外：outsideZone = true（与到圈心距离 > 半径一致）', () => {
    const w = makeWorld(7);
    const c = w.zone.center;
    const r = w.zone.radius;
    // 沿圈心向外推 1.5 倍半径的地面点
    const x = c.x + r * 1.5;
    const z = c.z;
    const p = placeOnGround(w, x, z);
    const d = Math.hypot(p.pos.x - c.x, p.pos.z - c.z);
    expect(d).toBeGreaterThan(r);
    expect(buildSnapshot(w).player?.outsideZone).toBe(true);
  });
});
