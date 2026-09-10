/**
 * aiBehavior.spec —— AI 行为多样化补齐项：
 * 1) 低血 + 近期受击 → 脱离交火撤退（retreat 状态、停止开火、远离目标）；
 * 2) 低血且无敌人可见 → 使用背包任意血包（含弱档绷带）回血（与玩家同急救通道）；
 * 3) 远距弹道下坠补偿角：随距离/弹速变化（AI aimIntent 使用该补偿）。
 */

import { describe, expect, it } from 'vitest';
import { DEFAULT_CONTENT_PACK, MAP, WEAPONS, derivePack } from '../src/content';
import { tickWorld, vec3, ballisticCompensationRad } from '../src/core';
import type { World } from '../src/core';
import { makeWorld } from './helpers';

/** 平地包：地形振幅 0，隔离地形/建筑变量（与 ballistics/recoil spec 同法） */
const FLAT_PACK = derivePack(DEFAULT_CONTENT_PACK, { map: { ...MAP, terrainAmplitude: 0 } });

/** 冻结缩圈（避免 fleeZone / 毒圈干扰行为断言） */
function freezeZone(w: World): void {
  w.zone.mode = 'wait';
  w.zone.timerMs = 1_000_000_000;
  w.zone.dps = 0;
  w.zone.center = vec3(600, 0, 600);
  w.zone.radius = 5000;
}

/** 把单个实体拉到地面指定位置并清空残留意图 */
function groundEntity(w: World, e: World['entities'][number], x: number, z: number): void {
  e.alive = true;
  e.state = 'ground';
  e.pos = vec3(x, 0, z);
  e.pendingIntents = [];
  e.firing = false;
  e.moveDirX = 0;
  e.moveDirZ = 0;
  e.moveSprint = false;
  void w;
}

describe('AI 行为多样化（补齐项）', () => {
  it('低血 + 近期受击且有可见敌人 → 脱离交火撤退（retreat、远离目标、停止开火）', () => {
    const w = makeWorld(601, 1, FLAT_PACK);
    freezeZone(w);
    w.buildings.length = 0;

    const ai = w.entities[1];
    const foe = w.player;
    groundEntity(w, ai, 600, 600);
    groundEntity(w, foe, 660, 600);
    // 武装 AI：避免 criticalLoot 抢占决策
    ai.weapons[0] = { weapon: 'ar_m4', magazine: 30 };
    ai.weapons[1] = null;
    ai.activeWeapon = 0;
    ai.ammoReserve[WEAPONS.ar_m4.ammoType] = 1000;
    foe.weapons = [null, null];

    // 低血 + 近期受击
    ai.hp = 30;
    ai.lastDamagedAtMs = w.elapsedMs;
    ai.aiDecisionOffset = 0;

    const d0 = Math.hypot(ai.pos.x - foe.pos.x, ai.pos.z - foe.pos.z);
    let sawRetreat = false;
    for (let i = 0; i < 40 && !sawRetreat; i++) {
      tickWorld(w, []);
      if (ai.aiState === 'retreat') sawRetreat = true;
    }
    expect(sawRetreat).toBe(true);
    expect(ai.firing).toBe(false);

    // 撤退后持续远离目标
    for (let i = 0; i < 80; i++) tickWorld(w, []);
    const d1 = Math.hypot(ai.pos.x - foe.pos.x, ai.pos.z - foe.pos.z);
    expect(d1).toBeGreaterThan(d0);
  });

  it('低血且无敌人可见 → 使用背包弱档血包（绷带）回血（与玩家同急救通道）', () => {
    const w = makeWorld(602, 1, FLAT_PACK);
    freezeZone(w);
    w.buildings.length = 0;

    const ai = w.entities[1];
    const foe = w.player;
    // 玩家放在 AI 视野之外（>300m），且双方均存活避免直接结算
    groundEntity(w, ai, 900, 900);
    groundEntity(w, foe, 200, 200);
    ai.weapons[0] = { weapon: 'ar_m4', magazine: 30 };
    ai.weapons[1] = null;
    ai.activeWeapon = 0;
    ai.ammoReserve[WEAPONS.ar_m4.ammoType] = 1000;
    foe.weapons = [null, null];
    // 移除 AI 身上可能影响判断的既有物资，仅留一个弱档血包
    ai.inventory = new Array(20).fill(null);
    ai.inventory[0] = { item: 'medkit_bandage', count: 1 };
    ai.usedGrids = 1;
    ai.hp = 20;
    ai.lastDamagedAtMs = -1e9;
    ai.medkitUntilMs = null;
    ai.aiDecisionOffset = 0;

    // 跑足 4s：覆盖决策（4 tick）+ 绷带引导 800ms + 完成
    for (let i = 0; i < 200; i++) tickWorld(w, []);
    expect(ai.hp).toBeGreaterThan(20);
    expect(ai.inventory[0]).toBeNull(); // 绷带已消耗
  });

  it('远距弹道下坠补偿角：随距离增大、慢弹速更大（数值来自 content/physics + weapons）', () => {
    const w = makeWorld(603, 1);
    const arSpeed = WEAPONS.ar_m4.projectileSpeed;
    const c100 = ballisticCompensationRad(w, arSpeed, 100);
    const c400 = ballisticCompensationRad(w, arSpeed, 400);
    expect(c100).toBeGreaterThan(0);
    expect(c400).toBeGreaterThan(c100);
    // 同距离：smg 弹速更慢 → 下坠更大 → 补偿角更大（与武器参数一致）
    expect(ballisticCompensationRad(w, WEAPONS.smg_ump.projectileSpeed, 200)).toBeGreaterThan(
      ballisticCompensationRad(w, arSpeed, 200),
    );
  });
});
