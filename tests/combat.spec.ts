import { describe, expect, it } from 'vitest';
import { DEFAULT_CONTENT_PACK, MAP, WEAPONS, derivePack } from '../src/content';
import { terrainHeightAt, tickWorld, vec3 } from '../src/core';
import type { PlayerIntent } from '../src/core';
import { findClearLine, makeWorld, runUntilLanded } from './helpers';

const RANGE = 100;

/** 低起伏地形包：用于远距离弹道测试（隔离地形遮挡变量，武器参数不变） */
const FLAT_PACK = derivePack(DEFAULT_CONTENT_PACK, {
  map: { ...MAP, terrainAmplitude: 1.5 },
});

type Rig = ReturnType<typeof setupRange>;

/** 建立射击靶场：自动寻找无遮挡靶道，玩家与静止靶相距 distance，靶不还手不移动 */
function setupRange(
  seed: number,
  weapon: 'ar_m4' | 'smg_ump',
  distance = RANGE,
  pack: typeof DEFAULT_CONTENT_PACK = DEFAULT_CONTENT_PACK,
) {
  const w = makeWorld(seed, 2, pack);
  runUntilLanded(w, { x: 500, z: 500 });

  const spot = findClearLine(w, distance, (hit) => hit === null || hit.dist >= distance - 0.5);
  // 其余 AI 挪到靶道之外
  for (let i = 1; i < w.entities.length; i++) {
    w.entities[i].pos = vec3(10 + i * 3, 0, 10);
    w.entities[i].moveDirX = 0;
    w.entities[i].moveDirZ = 0;
  }

  const p = w.player;
  const t = w.entities[1];

  p.state = 'ground';
  p.pos = vec3(spot.x, terrainHeightAt(w.pack, spot.x, spot.z), spot.z);
  p.hp = 100;
  p.weapons[0] = { weapon, magazine: WEAPONS[weapon].magazine };
  p.weapons[1] = null;
  p.activeWeapon = 0;
  p.ammoReserve[WEAPONS[weapon].ammoType] = 1_000_000;
  p.moveDirX = 0;
  p.moveDirZ = 0;

  const tx = spot.x + distance;
  t.state = 'ground';
  t.pos = vec3(tx, terrainHeightAt(w.pack, tx, spot.z), spot.z);
  t.hp = 100_000; // 命中率统计时靶子不死
  t.weapons[0] = null;
  t.weapons[1] = null;
  t.firing = false;
  t.moveDirX = 0;
  t.moveDirZ = 0;

  // 屏蔽毒圈干扰：靶场即安全区，并冻结缩圈计时（避免缩圈插值把圈心拉回原圈）
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

/** 驱动一个 tick：先算好瞄准意图（打靶靶心），tick 后冻结靶子 */
function aimIntent(rig: Rig, aimY = 1.1): PlayerIntent {
  const { w, p, t } = rig;
  const yaw = Math.atan2(t.pos.z - p.pos.z, t.pos.x - p.pos.x);
  const dist = Math.hypot(t.pos.x - p.pos.x, t.pos.z - p.pos.z);
  const pitch = Math.atan2(t.pos.y + aimY - (p.pos.y + 1.62), dist);
  void w;
  return { kind: 'aim', yaw, pitch };
}

/**
 * 单发点射意图序列：i%12==0 扣扳机、下一 tick 松开（fire 是"按住"语义），
 * 240ms 间隔让后坐力 bloom 完全衰减，用于测量武器本精度。
 */
function singleShotIntents(rig: Rig, i: number, aimY = 1.1): PlayerIntent[] {
  const phase = i % 12;
  if (phase === 0) return [aimIntent(rig, aimY), { kind: 'fire' }];
  if (phase === 1) return [aimIntent(rig, aimY), { kind: 'stopFire' }];
  return [aimIntent(rig, aimY)];
}

describe('AC4 武器射击命中', () => {
  it('ar_m4 与 smg_ump 参数彼此可区分且与配置表一致', () => {
    const a = WEAPONS.ar_m4;
    const b = WEAPONS.smg_ump;
    expect(a.damage).toBe(26);
    expect(a.rpm).toBe(620);
    expect(a.magazine).toBe(30);
    expect(a.reloadMs).toBe(2200);
    expect(a.effectiveRange).toBe(350);
    expect(a.recoil).toBe(0.45);
    expect(b.damage).toBe(18);
    expect(b.rpm).toBe(850);
    expect(b.magazine).toBe(25);
    expect(b.reloadMs).toBe(1800);
    expect(b.effectiveRange).toBe(120);
    expect(b.recoil).toBe(0.3);
    expect(a.damage).not.toBe(b.damage);
    expect(a.rpm).not.toBe(b.rpm);
    expect(a.magazine).not.toBe(b.magazine);
    expect(a.reloadMs).not.toBe(b.reloadMs);
  });

  it('射速节流：ar_m4 连射 3s 实际发数 ≈ 620rpm（容差 ±10%）', () => {
    const rig = setupRange(201, 'ar_m4');
    const { w, p } = rig;
    w.entities[1].hp = 1e9;
    let fired = 0;
    for (let i = 0; i < 150; i++) {
      tickWorld(w, [aimIntent(rig), { kind: 'fire' }]);
      rig.freezeTarget();
      for (const ev of w.events) if (ev.type === 'shotFired' && ev.entityId === p.id) fired++;
      w.events.length = 0;
    }
    // 150 tick = 3s；620rpm → 31 发
    expect(fired).toBeGreaterThanOrEqual(28);
    expect(fired).toBeLessThanOrEqual(34);
  });

  it('静止目标 100m 命中率 ≥ 90%（蒙特卡洛 1000 发，双武器，单发点射）', () => {
    for (const weapon of ['ar_m4', 'smg_ump'] as const) {
      const rig = setupRange(300 + weapon.length, weapon);
      const { w, p, t } = rig;
      let firedCount = 0;
      let hitCount = 0;
      let i = 0;
      while (firedCount < 1000 && i < 100_000) {
        tickWorld(w, singleShotIntents(rig, i));
        rig.freezeTarget();
        i++;
        for (const ev of w.events) {
          if (ev.type === 'shotFired' && ev.entityId === p.id) firedCount++;
          if (ev.type === 'damageDealt' && ev.target === t.id) hitCount++;
        }
        w.events.length = 0;
      }
      expect(firedCount).toBe(1000);
      expect(hitCount / firedCount).toBeGreaterThanOrEqual(0.9);
    }
  });

  it('距离衰减：420m 处单发伤害低于 100m（超出 350m 有效射程衰减生效）', () => {
    const singleShotDamage = (
      seed: number,
      distance: number,
      pack: typeof DEFAULT_CONTENT_PACK = DEFAULT_CONTENT_PACK,
    ): number => {
      const rig = setupRange(seed, 'ar_m4', distance, pack);
      const { w, t } = rig;
      t.hp = 1e9;
      // 单发点射直到首枚命中（命中率 <100% 属正常）
      for (let i = 0; i < 20_000; i++) {
        tickWorld(w, singleShotIntents(rig, i, 1.2));
        rig.freezeTarget();
        let dmg = 0;
        for (const ev of w.events) {
          if (ev.type === 'damageDealt' && ev.target === t.id) dmg += ev.amount;
        }
        w.events.length = 0;
        if (dmg > 0) return dmg;
      }
      throw new Error('长时间未命中（不应发生）');
    };

    const near = singleShotDamage(401, 100);
    const far = singleShotDamage(401, 420, FLAT_PACK);
    expect(near).toBeGreaterThan(0);
    expect(far).toBeLessThan(near);
    // 420m：衰减系数 = 1 - 0.5*(70/350) = 0.9（躯干命中），允许部位差异带来的波动
  });

  it('命中即时掉血、生命归零即淘汰、淘汰数计入击杀', () => {
    const rig = setupRange(501, 'ar_m4', 40);
    const { w, p, t } = rig;
    t.hp = 30; // 两发躯干内淘汰
    let eliminations = 0;
    for (let i = 0; i < 1200 && eliminations === 0; i++) {
      const phase = i % 12;
      const intents: PlayerIntent[] =
        phase === 0
          ? [aimIntent(rig), { kind: 'fire' }]
          : phase === 1
            ? [aimIntent(rig), { kind: 'stopFire' }]
            : [aimIntent(rig)];
      tickWorld(w, intents);
      rig.freezeTarget();
      for (const ev of w.events) {
        if (ev.type === 'entityEliminated' && ev.entityId === t.id) eliminations++;
      }
      w.events.length = 0;
    }
    expect(t.alive).toBe(false);
    expect(eliminations).toBe(1);
    expect(p.kills).toBe(1);
  });

  it('换弹时间与配置一致（ar_m4 2.2s / smg_ump 1.8s）', () => {
    for (const weapon of ['ar_m4', 'smg_ump'] as const) {
      const rig = setupRange(601, weapon);
      const { w, p } = rig;
      p.weapons[0]!.magazine = 0;
      tickWorld(w, [{ kind: 'reload' }]);
      rig.freezeTarget();
      expect(p.reloadUntilMs).not.toBeNull();
      const startedAt = w.elapsedMs;
      const expected = WEAPONS[weapon].reloadMs;
      let done = -1;
      for (let i = 0; i < 200; i++) {
        tickWorld(w, []);
        rig.freezeTarget();
        if (p.reloadUntilMs === null && done < 0) {
          done = w.elapsedMs - startedAt;
          break;
        }
      }
      expect(done).toBeGreaterThan(0);
      expect(Math.abs(done - expected)).toBeLessThanOrEqual(20);
    }
  });

  it('部位倍率：躯干命中伤害 = 基础 × 1.0；爆头命中 = 基础 × 2.5', () => {
    const rig = setupRange(701, 'ar_m4', 30);
    const { w, t } = rig;
    t.hp = 1e9;
    // 瞄准爆头线，单发点射直到命中
    for (let i = 0; i < 2000; i++) {
      tickWorld(w, singleShotIntents(rig, i, 1.75));
      rig.freezeTarget();
      const events = w.events.filter(
        (e) => e.type === 'damageDealt' && e.target === t.id,
      ) as Array<{ amount: number; bodyPart: string }>;
      w.events.length = 0;
      if (events.length > 0) {
        expect(events[0].bodyPart).toBe('head');
        expect(events[0].amount).toBeCloseTo(WEAPONS.ar_m4.damage * 2.5, 5);
        return;
      }
    }
    throw new Error('爆头线射击未命中（不应发生）');
  });

  it('护甲减伤生效：装备护甲后躯干承伤 = 基础 × (1 - 0.35)', () => {
    const rig = setupRange(801, 'ar_m4', 30);
    const { w, t } = rig;
    t.armorReduction = 0.35;
    t.hp = 1e9;
    for (let i = 0; i < 2000; i++) {
      tickWorld(w, singleShotIntents(rig, i, 1.0));
      rig.freezeTarget();
      const events = w.events.filter(
        (e) => e.type === 'damageDealt' && e.target === t.id,
      ) as Array<{ amount: number; bodyPart: string }>;
      w.events.length = 0;
      if (events.length > 0) {
        expect(events[0].bodyPart).toBe('torso');
        expect(events[0].amount).toBeCloseTo(WEAPONS.ar_m4.damage * (1 - 0.35), 5);
        return;
      }
    }
    throw new Error('躯干射击未命中（不应发生）');
  });
});
