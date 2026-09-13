/**
 * recoil.spec —— 后坐力模型（玩法缺口补齐项：可感知、可压枪、参数可区分）：
 * 1) 每发垂直踢枪 = 武器 recoil × RECOIL_TUNING.pitchKickPerRecoil（累积，上限封顶）；
 * 2) 武器间踢枪可区分（ar_m4 > smg_ump）；
 * 3) 停火后踢枪偏移按 RECOIL_TUNING.recoverPerSec 衰减到 0；
 * 4) 连射受后坐力惩罚：连射命中率显著低于单发点射。
 */

import { describe, expect, it } from 'vitest';
import { DEFAULT_CONTENT_PACK, MAP, RECOIL_TUNING, WEAPONS, derivePack } from '../src/content';
import { tickWorld, vec3 } from '../src/core';
import type { PlayerIntent } from '../src/core';
import { makeWorld, runUntilLanded } from './helpers';

/** 平地靶场包：地形振幅 0，隔离地形/建筑变量 */
const FLAT_PACK = derivePack(DEFAULT_CONTENT_PACK, { map: { ...MAP, terrainAmplitude: 0 } });

type Rig = ReturnType<typeof setupFireRange>;

/** 建立可开火的地面靶场（40m 近距、平地、无建筑） */
function setupFireRange(seed: number) {
  const w = makeWorld(seed, 1, FLAT_PACK);
  runUntilLanded(w, { x: 500, z: 500 });
  const p = w.player;
  const t = w.entities[1];
  w.buildings.length = 0;
  p.state = 'ground';
  p.pos = vec3(600, 0, 600);
  t.state = 'ground';
  t.pos = vec3(640, 0, 600); // 40m 近距
  t.hp = 1e9;
  t.weapons[0] = null;
  p.weapons[0] = { weapon: 'ar_m4', magazine: 100_000 }; // 大弹匣：隔离换弹变量，聚焦后坐力
  p.weapons[1] = null;
  p.activeWeapon = 0;
  p.ammoReserve[WEAPONS.ar_m4.ammoType] = 1_000_000;
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

/** 跑 5 tick（100ms，≥ ar_m4 射击间隔 96.7ms），保证恰好出膛一发 */
function fireOneShot(rig: Rig): void {
  const { w, aim, freezeTarget } = rig;
  for (let i = 0; i < 5; i++) {
    tickWorld(w, [aim(), { kind: 'fire' }]);
    freezeTarget();
  }
}

describe('后坐力（recoil）', () => {
  it('连射踢枪累积：垂直偏移单调累积且封顶于 RECOIL_TUNING.maxPitchOffset', () => {
    const rig = setupFireRange(202);
    const { w, p, aim, freezeTarget } = rig;
    expect(p.recoilPitch).toBe(0);
    for (let i = 0; i < 30; i++) {
      tickWorld(w, [aim(), { kind: 'fire' }]);
      freezeTarget();
    }
    expect(p.recoilPitch).toBeGreaterThan(0.02);
    expect(p.recoilPitch).toBeLessThanOrEqual(RECOIL_TUNING.maxPitchOffset);
    // 水平漂移存在（确定性随机方向），且在限幅内
    expect(p.recoilYaw).not.toBe(0);
    expect(Math.abs(p.recoilYaw)).toBeLessThanOrEqual(RECOIL_TUNING.maxYawOffset + 1e-9);
  });

  it('每发踢枪量与配置一致：recoil × pitchKickPerRecoil（逐发累积精确）', () => {
    const rig = setupFireRange(203);
    const { p } = rig;
    const perShot = WEAPONS.ar_m4.recoil * RECOIL_TUNING.pitchKickPerRecoil;
    fireOneShot(rig);
    expect(p.recoilPitch).toBeCloseTo(perShot, 9);
    fireOneShot(rig);
    expect(p.recoilPitch).toBeCloseTo(perShot * 2, 9);
    expect(p.recoilPitch).toBeLessThan(RECOIL_TUNING.maxPitchOffset);
  });

  it('武器间踢枪可区分：ar_m4 单发垂直踢枪 > smg_ump（recoil 0.45 vs 0.3）', () => {
    const perShotAr = WEAPONS.ar_m4.recoil * RECOIL_TUNING.pitchKickPerRecoil;
    const perShotSmg = WEAPONS.smg_ump.recoil * RECOIL_TUNING.pitchKickPerRecoil;
    expect(perShotAr).toBeGreaterThan(perShotSmg);
  });

  it('停火恢复：踢枪偏移按 RECOIL_TUNING.recoverPerSec 衰减到 0', () => {
    const rig = setupFireRange(204);
    const { w, p, aim, freezeTarget } = rig;
    for (let i = 0; i < 30; i++) {
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

  it('后坐力惩罚：连射命中率显著低于单发点射（40m 静止靶）', () => {
    const hitRateOf = (burst: boolean): number => {
      const rig = setupFireRange(205 + (burst ? 1 : 0));
      const { w, p, t, aim, freezeTarget } = rig;
      let fired = 0;
      let hits = 0;
      for (let i = 0; i < 1600 && fired < 150; i++) {
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
    expect(auto).toBeLessThan(single);
  });
});
