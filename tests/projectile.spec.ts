/**
 * tests/projectile —— 弹道下坠与后坐力（收口新增玩法线）。
 * 断言：投射物有飞行时间（远距离非当帧命中）、重力下坠（远距离着弹点低于直线瞄准）、
 * 近距离行为与即时命中一致、后坐力偏移累积与恢复、同 seed 弹道可复现。
 */

import { describe, expect, it } from 'vitest';
import { DEFAULT_CONTENT_PACK, MAP, WEAPONS, derivePack } from '../src/content';
import { tickWorld, vec3, terrainHeightAt } from '../src/core';
import type { PlayerIntent, World } from '../src/core';
import { findClearLine, makeWorld, runUntilLanded } from './helpers';

/** 低起伏地形包：远距离弹道测试（隔离地形遮挡变量，武器参数不变） */
const FLAT_PACK = derivePack(DEFAULT_CONTENT_PACK, {
  map: { ...MAP, terrainAmplitude: 1.5 },
});

/** 靶场：自动寻找无遮挡靶道，玩家与静止靶相距 distance（冻结缩圈与其余 AI） */
function setupRange(
  seed: number,
  weapon: 'ar_m4' | 'smg_ump',
  distance: number,
  pack: typeof DEFAULT_CONTENT_PACK = DEFAULT_CONTENT_PACK,
) {
  const w = makeWorld(seed, 2, pack);
  runUntilLanded(w, { x: 500, z: 500 });
  const spot = findClearLine(w, distance, (hit) => hit === null || hit.dist >= distance - 0.5);

  for (let i = 2; i < w.entities.length; i++) {
    w.entities[i].pos = vec3(10 + i * 3, 0, 10);
  }

  const p = w.player;
  const t = w.entities[1];
  p.state = 'ground';
  p.pos = vec3(spot.x, terrainHeightAt(w.pack, spot.x, spot.z), spot.z);
  p.weapons[0] = { weapon, magazine: WEAPONS[weapon].magazine };
  p.weapons[1] = null;
  p.activeWeapon = 0;
  p.ammoReserve[WEAPONS[weapon].ammoType] = 1_000_000;
  p.moveDirX = 0;
  p.moveDirZ = 0;

  const tx = spot.x + distance;
  t.state = 'ground';
  t.pos = vec3(tx, terrainHeightAt(w.pack, tx, spot.z), spot.z);
  t.hp = 1e9;
  t.weapons[0] = null;
  t.weapons[1] = null;
  t.moveDirX = 0;
  t.moveDirZ = 0;

  w.zone.mode = 'wait';
  w.zone.timerMs = 1_000_000_000;
  w.zone.center = vec3(spot.x + distance / 2, 0, spot.z);
  w.zone.radius = 2000;
  w.zone.dps = 0;

  const freezeTarget = () => {
    t.pendingIntents = [];
    t.moveDirX = 0;
    t.moveDirZ = 0;
    t.firing = false;
  };
  return { w, p, t, freezeTarget };
}

function aimAt(
  _w: World,
  from: { pos: { x: number; y: number; z: number } },
  target: { pos: { x: number; y: number; z: number } },
  aimY: number,
): PlayerIntent {
  const dx = target.pos.x - from.pos.x;
  const dz = target.pos.z - from.pos.z;
  const dist = Math.hypot(dx, dz);
  return {
    kind: 'aim',
    yaw: Math.atan2(dz, dx),
    pitch: Math.atan2(target.pos.y + aimY - (from.pos.y + 1.62), dist),
  };
}

/** 开一枪（单 tick 按下），然后跑到投射物清空，收集首个弹着点 */
function fireOneAndResolve(
  rig: ReturnType<typeof setupRange>,
  aimY: number,
): { flightTicks: number; hitPoint: { x: number; y: number; z: number } | null } {
  const { w, p, t } = rig;
  const aim = aimAt(w, p, t, aimY);
  tickWorld(w, [aim, { kind: 'fire' }]);
  rig.freezeTarget();
  const fireTick = w.tick;
  let hitTick = -1;
  let hitPoint: { x: number; y: number; z: number } | null = null;
  for (let i = 0; i < 400; i++) {
    tickWorld(w, [{ kind: 'stopFire' }, aimAt(w, p, t, aimY)]);
    rig.freezeTarget();
    for (const ev of w.events) {
      if (ev.type === 'projectileImpact' && ev.shooterId === p.id && hitTick < 0) {
        hitTick = w.tick;
        hitPoint = { ...ev.pos };
      }
    }
    w.events.length = 0;
    if (w.projectiles.length === 0) break;
  }
  return { flightTicks: hitTick - fireTick, hitPoint };
}

describe('弹道下坠（投射物仿真）', () => {
  it('远距离命中存在飞行时间：300m 弹着不在开火当帧（弹速 890m/s ≈ 17 tick）', () => {
    const rig = setupRange(910, 'ar_m4', 300, FLAT_PACK);
    const { flightTicks, hitPoint } = fireOneAndResolve(rig, 1.1);
    expect(hitPoint).not.toBeNull();
    expect(flightTicks).toBeGreaterThan(0);
  });

  it('近距离 30m 命中几乎即时（≤2 tick）且弹着点在靶上', () => {
    const rig = setupRange(911, 'ar_m4', 30);
    const { flightTicks, hitPoint } = fireOneAndResolve(rig, 1.1);
    expect(hitPoint).not.toBeNull();
    expect(flightTicks).toBeLessThanOrEqual(2);
    const d = Math.hypot(hitPoint!.x - rig.t.pos.x, hitPoint!.z - rig.t.pos.z);
    expect(d).toBeLessThan(1);
  });

  it('重力下坠：400m 直线瞄准头部时弹着点显著低于瞄准线（下坠 > 0.5m）', () => {
    const rig = setupRange(912, 'ar_m4', 400, FLAT_PACK);
    const { hitPoint } = fireOneAndResolve(rig, 1.8);
    expect(hitPoint).not.toBeNull();
    // 飞行 400m/890m/s ≈ 0.45s → 下坠 ≈ 0.5·9.8·0.45² ≈ 1.0m；
    // 弹着点高度应明显低于瞄准直线在 400m 处的高度
    const targetLineY = rig.t.pos.y + 1.8;
    expect(hitPoint!.y).toBeLessThan(targetLineY - 0.5);
  });

  it('抬枪补偿下坠后可命中远靶：400m 抬高瞄准 → 命中目标', () => {
    const rig = setupRange(913, 'ar_m4', 400, FLAT_PACK);
    const { w, p, t } = rig;
    // 抬高 2.8mrad ≈ 400m 处 ~1.1m 下坠补偿
    const base = aimAt(w, p, t, 1.1) as { kind: 'aim'; yaw: number; pitch: number };
    const compensated: PlayerIntent = { kind: 'aim', yaw: base.yaw, pitch: base.pitch + 0.0028 };
    let hits = 0;
    let shots = 0;
    for (let i = 0; i < 40 && shots < 40; i++) {
      tickWorld(w, [compensated, { kind: 'fire' }]);
      rig.freezeTarget();
      for (const ev of w.events) {
        if (ev.type === 'shotFired' && ev.entityId === p.id) shots++;
      }
      w.events.length = 0;
      for (let k = 0; k < 50 && w.projectiles.length > 0; k++) {
        tickWorld(w, [{ kind: 'stopFire' }, compensated]);
        rig.freezeTarget();
        for (const ev of w.events) {
          if (ev.type === 'damageDealt' && ev.target === t.id) hits++;
        }
        w.events.length = 0;
      }
    }
    expect(shots).toBeGreaterThan(10);
    expect(hits).toBeGreaterThan(0);
  });

  it('同 seed 弹道可复现：两次同 seed 对局首枚弹着点完全一致', () => {
    const a = setupRange(914, 'ar_m4', 250, FLAT_PACK);
    const b = setupRange(914, 'ar_m4', 250, FLAT_PACK);
    const ra = fireOneAndResolve(a, 1.1);
    const rb = fireOneAndResolve(b, 1.1);
    expect(ra.hitPoint).not.toBeNull();
    expect(rb.hitPoint).not.toBeNull();
    expect(ra.flightTicks).toBe(rb.flightTicks);
    expect(ra.hitPoint!.x).toBeCloseTo(rb.hitPoint!.x, 6);
    expect(ra.hitPoint!.y).toBeCloseTo(rb.hitPoint!.y, 6);
    expect(ra.hitPoint!.z).toBeCloseTo(rb.hitPoint!.z, 6);
  });
});

describe('后坐力（可恢复瞄准偏移）', () => {
  it('连射累积后坐力上抬：连射后 recoilPitch 显著大于 0', () => {
    const rig = setupRange(920, 'ar_m4', 50);
    const { w, p, t } = rig;
    for (let i = 0; i < 40; i++) {
      tickWorld(w, [aimAt(w, p, t, 1.1), { kind: 'fire' }]);
      rig.freezeTarget();
      w.events.length = 0;
    }
    // ar_m4 recoil 0.45 × recoilPitchK 0.0075 ≈ 0.0034/发，连射累积（含恢复）应显著 > 0.001
    expect(p.recoilPitch).toBeGreaterThan(0.001);
  });

  it('停火后后坐力恢复：0.5s 内偏移回收到接近 0', () => {
    const rig = setupRange(921, 'ar_m4', 50);
    const { w, p, t } = rig;
    for (let i = 0; i < 40; i++) {
      tickWorld(w, [aimAt(w, p, t, 1.1), { kind: 'fire' }]);
      rig.freezeTarget();
      w.events.length = 0;
    }
    const peak = p.recoilPitch;
    expect(peak).toBeGreaterThan(0);
    for (let i = 0; i < 25; i++) {
      tickWorld(w, [{ kind: 'stopFire' }, aimAt(w, p, t, 1.1)]);
      rig.freezeTarget();
      w.events.length = 0;
    }
    expect(p.recoilPitch).toBeLessThan(peak * 0.05);
    expect(Math.abs(p.recoilYaw)).toBeLessThan(0.001);
  });

  it('不同武器后坐力可区分：ar_m4 单发上抬 > smg_ump（与 recoil 系数一致）', () => {
    // 单发后坐力 = recoil × recoilPitchK，同一 tick 内经一次恢复（×(1-recover·dt)）
    const decayOnce = 1 - 11 * 0.02;
    const a = setupRange(923, 'ar_m4', 50);
    tickWorld(a.w, [aimAt(a.w, a.p, a.t, 1.1), { kind: 'fire' }]);
    const arKick = a.p.recoilPitch;
    const b = setupRange(923, 'smg_ump', 50);
    tickWorld(b.w, [aimAt(b.w, b.p, b.t, 1.1), { kind: 'fire' }]);
    const smgKick = b.p.recoilPitch;
    expect(arKick).toBeCloseTo(WEAPONS.ar_m4.recoil * 0.0075 * decayOnce, 5);
    expect(smgKick).toBeCloseTo(WEAPONS.smg_ump.recoil * 0.0075 * decayOnce, 5);
    expect(arKick).toBeGreaterThan(smgKick);
  });
});
