/**
 * ballistics.spec —— 弹道下坠（玩法缺口补齐项：命中判定基于「弹道」而非直线）：
 * 1) 下坠量公式：drop = 0.5 × g × (d/v)²，g 与分段来自 content/physics.ballistic；
 * 2) 远距离弹着点低于瞄准点（直线射线 vs 抛物线弹道对照）；
 * 3) 下坠补偿：按弹速/距离抬高瞄准角后，弹着点回到预期高度。
 */

import { describe, expect, it } from 'vitest';
import { DEFAULT_CONTENT_PACK, MAP, WEAPONS, derivePack } from '../src/content';
import { ballisticDropAt, castShot, createEntity, vec3 } from '../src/core';
import type { Entity, World } from '../src/core';
import { makeWorld } from './helpers';

/** 平地靶场包：地形振幅 0（恒为 0m），隔离地形/建筑变量，武器参数不变 */
const FLAT_PACK = derivePack(DEFAULT_CONTENT_PACK, { map: { ...MAP, terrainAmplitude: 0 } });

/** 建一个孤立靶场 world：射击者 + 靶（不推进 tick，直接调用 castShot 做弹道学断言） */
function makeRange(distance: number): { w: World; shooter: Entity; target: Entity; originY: number } {
  const w = makeWorld(909, 1, FLAT_PACK);
  const shooter = w.player;
  const target = createEntity('target_dummy', 'ai', 1, vec3(0, 0, 0));
  w.entities.length = 0;
  w.entities.push(shooter, target);

  const ox = 300;
  const oz = 300;
  shooter.state = 'ground';
  shooter.pos = vec3(ox, 0, oz);
  target.state = 'ground';
  target.pos = vec3(ox + distance, 0, oz);
  target.hp = 1e9;
  shooter.weapons[0] = { weapon: 'ar_m4', magazine: WEAPONS.ar_m4.magazine };

  // 平地靶场：屏蔽建筑遮挡
  w.buildings.length = 0;
  const originY = 1.62;
  return { w, shooter, target, originY };
}

describe('弹道下坠（ballistics）', () => {
  it('下坠量公式：drop = 0.5 × g × (d/v)²，g 与弹速来自 content/physics.ballistic / weapons', () => {
    const { w } = makeRange(100);
    const g = w.pack.physics.ballistic.gravityMps2;
    const d = 400;
    const v = WEAPONS.ar_m4.projectileSpeed;
    const expected = 0.5 * g * (d / v) ** 2;
    expect(ballisticDropAt(w, d, v)).toBeCloseTo(expected, 9);
    // 弹速越快下坠越小（ar_m4 vs smg_ump），数值可区分
    expect(ballisticDropAt(w, d, WEAPONS.ar_m4.projectileSpeed)).toBeLessThan(
      ballisticDropAt(w, d, WEAPONS.smg_ump.projectileSpeed),
    );
  });

  it('远距离弹着点低于瞄准点，差值 ≈ 理论下坠量（直线射线 vs 弹道扫描对照）', () => {
    const distance = 400;
    const { w, shooter, target, originY } = makeRange(distance);
    const aimY = 1.2; // 瞄准靶躯干中心
    const pitch = Math.atan2(aimY - originY, distance);
    const dir = vec3(Math.cos(pitch), Math.sin(pitch), 0);
    const origin = vec3(shooter.pos.x, shooter.pos.y + originY, shooter.pos.z);

    const straight = castShot(w, shooter, origin, dir, WEAPONS.ar_m4.maxRange);
    const dropped = castShot(w, shooter, origin, dir, WEAPONS.ar_m4.maxRange, WEAPONS.ar_m4.projectileSpeed);

    expect(straight).not.toBeNull();
    expect(dropped).not.toBeNull();
    expect(straight!.entity?.id).toBe(target.id);
    expect(dropped!.entity?.id).toBe(target.id);
    // 弹着点差值 ≈ 理论下坠量（25m 分段弦近似，容差 5%）
    const delta = straight!.point.y - dropped!.point.y;
    const expected = ballisticDropAt(w, distance, WEAPONS.ar_m4.projectileSpeed);
    expect(delta).toBeGreaterThan(0);
    expect(Math.abs(delta - expected)).toBeLessThan(expected * 0.05);
    // 命中部位随下坠降低（相对 target 脚底的高度更低）
    expect(dropped!.point.y - target.pos.y).toBeLessThan(straight!.point.y - target.pos.y);
  });

  it('下坠补偿：按弹速/距离抬高瞄准角后，弹着点回到预期高度', () => {
    const distance = 400;
    const { w, shooter, target, originY } = makeRange(distance);
    const aimY = 1.2;
    const drop = ballisticDropAt(w, distance, WEAPONS.ar_m4.projectileSpeed);
    const comp = Math.atan2(drop, distance);
    const pitch = Math.atan2(aimY - originY, distance) + comp;
    const dir = vec3(Math.cos(pitch), Math.sin(pitch), 0);
    const origin = vec3(shooter.pos.x, shooter.pos.y + originY, shooter.pos.z);

    const hit = castShot(w, shooter, origin, dir, WEAPONS.ar_m4.maxRange, WEAPONS.ar_m4.projectileSpeed);
    expect(hit).not.toBeNull();
    expect(hit!.entity?.id).toBe(target.id);
    // 补偿后弹着点回到躯干高度（误差 ≤ 0.35m：分段弦近似 + 部位箱分辨率）
    expect(Math.abs(hit!.point.y - (target.pos.y + aimY))).toBeLessThan(0.35);
  });
});
