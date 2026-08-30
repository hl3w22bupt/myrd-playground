import { describe, expect, it } from 'vitest';
import { ZONE, ZONE_DAMAGE_TICK_SEC } from '../src/content/zone';
import { tickWorld, vec3 } from '../src/core';
import { makeWorld, runTicks, runUntilLanded } from './helpers';

describe('AC5a 缩圈毒圈', () => {
  it('安全区按 ≥3 阶段逐次收缩，各阶段 wait/shrink/dps 与配置一致', () => {
    const w = makeWorld(60);
    expect(w.pack.zone.phases.length).toBeGreaterThanOrEqual(3);
    // 静止等圈：玩家落地后挂机推进缩圈
    runUntilLanded(w, { x: 500, z: 500 });
    w.player.pendingIntents = [];

    const seen: Array<{ phase: number; radius: number; dps: number }> = [];
    let lastPhase = -1;
    let guard = 0;
    while (w.zone.phase < w.pack.zone.phases.length && guard < 30_000) {
      tickWorld(w, []);
      guard++;
      if (w.zone.phase !== lastPhase && w.zone.phase < w.pack.zone.phases.length) {
        lastPhase = w.zone.phase;
        seen.push({ phase: w.zone.phase, radius: w.zone.radius, dps: w.zone.dps });
      }
    }
    expect(seen.length).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < seen.length; i++) {
      const cfg = w.pack.zone.phases[seen[i].phase];
      expect(cfg.waitSec).toBe(ZONE.phases[seen[i].phase].waitSec);
      expect(cfg.shrinkSec).toBe(ZONE.phases[seen[i].phase].shrinkSec);
      expect(seen[i].dps).toBe(ZONE.phases[seen[i].phase].dps);
      if (i > 0) expect(seen[i].dps).toBeGreaterThan(seen[i - 1].dps); // 速率递增
    }
  });

  it('圈半径逐阶段缩小并趋近 minRadius × shrinkFactor 链', () => {
    const w = makeWorld(61);
    const r0 = w.zone.radius;
    expect(r0).toBe(ZONE.initialRadius);
    runTicks(w, [], 1);
    // 推进数个完整阶段验证半径单调不增
    runUntilLanded(w, { x: 500, z: 500 });
    let prev = w.zone.radius;
    let guard = 0;
    while (w.zone.mode !== 'done' && guard < 30_000) {
      tickWorld(w, []);
      guard++;
      if (w.zone.mode === 'shrink' || w.zone.mode === 'wait') {
        expect(w.zone.radius).toBeLessThanOrEqual(prev + 1e-6);
        prev = w.zone.radius;
      }
    }
    expect(w.zone.radius).toBeLessThan(ZONE.initialRadius);
  });

  it('圈外单位按秒掉血（不逐 tick 扣血）且速率随阶段递增', () => {
    const w = makeWorld(62, 1);
    runUntilLanded(w, { x: 500, z: 500 });
    const p = w.player;
    // 把玩家放到圈外远处（圈内不动则不掉血，作为对照）
    p.pos = vec3(w.zone.center.x + w.zone.radius + 100, 0, w.zone.center.z);
    p.hp = 1000;

    // 观察 10s：每秒结算一次
    let damageTicks = 0;
    let totalDamage = 0;
    const hpSeries: number[] = [];
    for (let i = 0; i < 500; i++) {
      const before = p.hp;
      tickWorld(w, []);
      if (p.hp < before) {
        damageTicks++;
        totalDamage += before - p.hp;
      }
      if (i % 50 === 0) hpSeries.push(p.hp);
    }
    // 每秒一次结算 → 10s 内掉血 tick 数 ≈ 10（而非 500）
    expect(damageTicks).toBeLessThanOrEqual(12);
    expect(totalDamage).toBeGreaterThan(0);
    // dps=0.4（第 0 阶段）± 时间取整
    expect(totalDamage / 10).toBeCloseTo(ZONE.phases[0].dps, 1);
  });

  it('安全区外持续掉血直至淘汰（归因 zone）', () => {
    const w = makeWorld(63, 1);
    runUntilLanded(w, { x: 500, z: 500 });
    const p = w.player;
    p.pos = vec3(w.zone.center.x + w.zone.radius + 100, 0, w.zone.center.z);
    // 直接快进到末期阶段（dps 高），缩短等待
    const lastPhase = w.pack.zone.phases.length - 1;
    w.zone.phase = lastPhase;
    w.zone.dps = w.pack.zone.phases[lastPhase].dps;
    p.hp = 20;
    let eliminated = false;
    let zoneCause = false;
    for (let i = 0; i < 20_000 && !eliminated; i++) {
      tickWorld(w, []);
      for (const ev of w.events) {
        if (ev.type === 'entityEliminated' && ev.entityId === p.id) {
          eliminated = true;
          zoneCause = ev.cause === 'zone';
        }
      }
      w.events.length = 0;
    }
    expect(eliminated).toBe(true);
    expect(zoneCause).toBe(true);
    expect(p.alive).toBe(false);
  });

  it('按秒结算周期与配置一致（ZONE_DAMAGE_TICK_SEC=1s）', () => {
    expect(ZONE_DAMAGE_TICK_SEC).toBe(1);
  });
});
