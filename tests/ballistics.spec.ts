/**
 * ballistics.spec —— 弹道下坠与后坐力（玩法缺口补齐项的自动化断言）：
 * 1) 弹道下坠：下坠量 = 0.5 × g × t²（content/physics.ballistic），远距离弹着点低于瞄准点；
 * 2) 下坠补偿：按弹速/距离补偿后可命中预期高度；
 * 3) 后坐力：连射垂直/水平踢枪累积、快照朝向包含后坐力（镜头踢枪可见）、停火恢复；
 * 4) aimDelta 相对瞄准通道：增量叠加且与绝对瞄准等效。
 */

import { describe, expect, it } from 'vitest';
import { DEFAULT_CONTENT_PACK, MAP, RECOIL_TUNING, WEAPONS, derivePack } from '../src/content';
import {
  ballisticDropAt,
  buildSnapshot,
  castShot,
  createEntity,
  tickWorld,
  vec3,
} from '../src/core';
import type { Entity, PlayerIntent, World } from '../src/core';
import { makeWorld, runUntilLanded } from './helpers';

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
  it('下坠量公式：drop = 0.5 × g × (d/v)²，g 与分段来自 content/physics.ballistic', () => {
    const w = makeWorld(1);
    const g = w.pack.physics.ballistic.gravityMps2;
    const d = 400;
    const v = WEAPONS.ar_m4.projectileSpeed;
    const expected = 0.5 * g * (d / v) ** 2;
    expect(ballisticDropAt(w, d, v)).toBeCloseTo(expected, 9);
    // 弹速越快下坠越小（ar_m4 vs smg_ump）
    expect(ballisticDropAt(w, d, WEAPONS.ar_m4.projectileSpeed)).toBeLessThan(
      ballisticDropAt(w, d, WEAPONS.smg_ump.projectileSpeed),
    );
  });

  it('远距离弹着点低于瞄准点，差值 ≈ 下坠量（直线射线 vs 弹道扫描对照）', () => {
    const distance = 400;
    const { w, shooter, target, originY } = makeRange(distance);
    const aimY = 1.2; // 瞄准靶躯干中心
    const yaw = 0; // +x 方向
    const pitch = Math.atan2(aimY - originY, distance);
    const dir = vec3(Math.cos(yaw) * Math.cos(pitch), Math.sin(pitch), Math.sin(yaw) * Math.cos(pitch));
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
    // 命中部位因下坠降低（躯干 → 四肢）
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

/** 建立可开火的地面靶场（推进 tick，测后坐力累积与恢复） */
function setupFireRange(seed: number) {
  const w = makeWorld(seed, 2, FLAT_PACK);
  runUntilLanded(w, { x: 500, z: 500 });
  const p = w.player;
  const t = w.entities[1];
  w.buildings.length = 0; // 平地靶场：屏蔽建筑遮挡
  p.state = 'ground';
  p.pos = vec3(600, 0, 600);
  t.state = 'ground';
  t.pos = vec3(640, 0, 600); // 40m 近距
  t.hp = 1e9;
  t.weapons[0] = null;
  p.weapons[0] = { weapon: 'ar_m4', magazine: WEAPONS.ar_m4.magazine };
  p.weapons[1] = null;
  p.activeWeapon = 0;
  p.ammoReserve[WEAPONS.ar_m4.ammoType] = 100_000;
  // 冻结缩圈
  w.zone.mode = 'wait';
  w.zone.timerMs = 1_000_000_000;
  w.zone.center = vec3(620, 0, 600);
  w.zone.radius = 2000;
  w.zone.dps = 0;
  const aim = (): PlayerIntent => ({ kind: 'aim', yaw: 0, pitch: 0 });
  const freezeTarget = () => {
    t.pendingIntents = [];
    t.moveDirX = 0;
    t.moveDirZ = 0;
    t.firing = false;
  };
  return { w, p, t, aim, freezeTarget };
}

describe('后坐力（recoil）', () => {
  it('连射踢枪累积：垂直偏移单调上升，快照朝向包含后坐力（镜头踢枪可见）', () => {
    const rig = setupFireRange(202);
    const { w, p, aim, freezeTarget } = rig;
    expect(p.recoilPitch).toBe(0);
    let snapshotPitchAfter = 0;
    for (let i = 0; i < 30; i++) {
      tickWorld(w, [aim(), { kind: 'fire' }]);
      freezeTarget();
    }
    expect(p.recoilPitch).toBeGreaterThan(0.02); // 30 发垂直踢枪显著累积
    expect(p.recoilYaw).not.toBe(0); // 水平漂移存在（确定性随机方向）
    const snap = buildSnapshot(w);
    snapshotPitchAfter = snap.playerEntity!.pitch;
    expect(snapshotPitchAfter).toBeCloseTo(p.pitch + p.recoilPitch, 9);
  });

  it('踢枪量与配置一致：每发 = recoil × pitchKickPerRecoil（上限封顶）', () => {
    const rig = setupFireRange(203);
    const { w, p, aim, freezeTarget } = rig;
    const perShot = WEAPONS.ar_m4.recoil * RECOIL_TUNING.pitchKickPerRecoil;
    const fireOneShot = () => {
      // 5 tick = 100ms ≥ ar_m4 射击间隔（96ms），保证恰好出膛一发
      for (let i = 0; i < 5; i++) {
        tickWorld(w, [aim(), { kind: 'fire' }]);
        freezeTarget();
      }
    };
    fireOneShot();
    expect(p.recoilPitch).toBeCloseTo(perShot, 9);
    fireOneShot();
    expect(p.recoilPitch).toBeCloseTo(perShot * 2, 9);
    expect(p.recoilPitch).toBeLessThan(RECOIL_TUNING.maxPitchOffset);
  });

  it('停火恢复：停止射击后踢枪偏移按 RECOIL_TUNING.recoverPerSec 衰减到 0', () => {
    const rig = setupFireRange(204);
    const { w, p, aim, freezeTarget } = rig;
    for (let i = 0; i < 20; i++) {
      tickWorld(w, [aim(), { kind: 'fire' }]);
      freezeTarget();
    }
    expect(p.recoilPitch).toBeGreaterThan(0);
    for (let i = 0; i < 60; i++) {
      tickWorld(w, [aim(), { kind: 'stopFire' }]);
      freezeTarget();
    }
    expect(p.recoilPitch).toBe(0);
    expect(p.recoilYaw).toBe(0);
  });

  it('连射散布扩张（bloom）与后坐力共同作用：连射命中率显著低于单发点射', () => {
    const hitRateOf = (burst: boolean): number => {
      const rig = setupFireRange(205);
      const { w, p, t, aim, freezeTarget } = rig;
      let fired = 0;
      let hits = 0;
      for (let i = 0; i < 1200 && fired < 120; i++) {
        const intents: PlayerIntent[] = burst
          ? [aim(), { kind: 'fire' }]
          : i % 12 === 0
            ? [aim(), { kind: 'fire' }]
            : i % 12 === 1
              ? [aim(), { kind: 'stopFire' }]
              : [aim()];
        tickWorld(w, intents);
        freezeTarget();
        for (const ev of w.events) {
          if (ev.type === 'shotFired' && ev.entityId === p.id) fired++;
          if (ev.type === 'damageDealt' && ev.target === t.id) hits++;
        }
        w.events.length = 0;
      }
      return hits / Math.max(1, fired);
    };
    const single = hitRateOf(false);
    const auto = hitRateOf(true);
    expect(single).toBeGreaterThan(0.7);
    expect(auto).toBeLessThan(single); // 连射受后坐力惩罚
  });
});

describe('aimDelta 相对瞄准通道', () => {
  it('增量叠加：aimDelta 累计效果与绝对 aim 一致，且 pitch 限幅', () => {
    const a = makeWorld(301);
    const b = makeWorld(302);
    runUntilLanded(a, { x: 500, z: 500 });
    runUntilLanded(b, { x: 500, z: 500 });
    // 各自记录落地时的基础朝向（不同 seed 航线不同），换算增量
    const bYaw0 = b.player.yaw;
    const bPitch0 = b.player.pitch;
    // a：绝对瞄准（变化到 0.6/0.2）；b：增量合成到同一绝对朝向
    tickWorld(a, [{ kind: 'aim', yaw: 0.6, pitch: 0.2 }]);
    tickWorld(b, [{ kind: 'aimDelta', dYaw: 0.6 - bYaw0, dPitch: 0.2 - bPitch0 }]);
    tickWorld(b, [{ kind: 'aimDelta', dYaw: 0, dPitch: 0 }]);
    expect(a.player.yaw).toBeCloseTo(0.6, 12);
    expect(b.player.yaw).toBeCloseTo(0.6, 12); // 增量合成与绝对瞄准收敛一致
    expect(b.player.pitch).toBeCloseTo(0.2, 12);
    // pitch 限幅（±π/2 - 0.05）
    for (let i = 0; i < 200; i++) tickWorld(b, [{ kind: 'aimDelta', dYaw: 0, dPitch: 1 }]);
    expect(b.player.pitch).toBeLessThanOrEqual(Math.PI / 2 - 0.05 + 1e-9);
    // 后坐力偏移不受瞄准意图覆盖（独立字段）；开火中不衰减（需持 fire 意图）
    const c = makeWorld(303);
    runUntilLanded(c, { x: 500, z: 500 });
    c.player.recoilPitch = 0.05;
    tickWorld(c, [{ kind: 'aim', yaw: 1, pitch: 0.1 }, { kind: 'fire' }]);
    expect(c.player.pitch).toBeCloseTo(0.1, 12);
    expect(c.player.recoilPitch).toBeCloseTo(0.05, 12);
  });
});
