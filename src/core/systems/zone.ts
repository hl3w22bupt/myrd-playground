/**
 * core/systems/zone —— 缩圈阶段表、圈心/半径插值收缩、圈外按秒掉血（速率随阶段递增）。
 * AC5 数值来自 content/zone；掉血按秒结算（ZONE_DAMAGE_TICK_SEC）。
 */

import { MAP_HALF } from '../../content/constants';
import { ZONE_DAMAGE_TICK_SEC } from '../../content/zone';
import type { Entity, World } from '../world';
import type { Vec3 } from '../types';
import { clamp, dist2D } from '../geom';
import { pushEvent } from '../world';

/** 初始化首圈与次圈（对局创建时调用） */
export function initZone(w: World): void {
  const cfg = w.pack.zone;
  const c = w.rng.zone.unitDir();
  const center: Vec3 = {
    x: MAP_HALF + c.x * MAP_HALF * 0.15,
    y: 0,
    z: MAP_HALF + c.z * MAP_HALF * 0.15,
  };
  w.zone.center = center;
  w.zone.radius = cfg.initialRadius;
  w.zone.phase = 0;
  w.zone.mode = 'wait';
  w.zone.timerMs = cfg.phases[0].waitSec * 1000;
  w.zone.dps = cfg.phases[0].dps;
  w.zone.accumulatorSec = 0;
  w.zone.doneElapsedMs = 0;
  w.zone.shrinkFrom = { center: { ...center }, radius: cfg.initialRadius };
  const next = computeNextCircle(w, center, cfg.initialRadius);
  w.zone.nextCenter = next.center;
  w.zone.nextRadius = next.radius;
}

function computeNextCircle(w: World, cur: Vec3, curRadius: number): { center: Vec3; radius: number } {
  const cfg = w.pack.zone;
  const nextRadius = Math.max(cfg.minRadius, curRadius * cfg.shrinkFactor);
  const maxDrift = Math.max(0, (curRadius - nextRadius) * cfg.centerDrift);
  const d = w.rng.zone.unitDir();
  const r = Math.sqrt(w.rng.zone.next()) * maxDrift;
  return {
    center: {
      x: clamp(cur.x + d.x * r, nextRadius * 0.5, 2 * MAP_HALF - nextRadius * 0.5),
      y: 0,
      z: clamp(cur.z + d.z * r, nextRadius * 0.5, 2 * MAP_HALF - nextRadius * 0.5),
    },
    radius: nextRadius,
  };
}

export function updateZone(w: World): void {
  const cfg = w.pack.zone;
  const dtMs = w.pack.constants.TICK_MS;
  const zone = w.zone;

  if (zone.mode === 'wait') {
    zone.timerMs -= dtMs;
    if (zone.timerMs <= 0) {
      zone.mode = 'shrink';
      zone.timerMs = cfg.phases[zone.phase].shrinkSec * 1000;
      zone.shrinkFrom = { center: { ...zone.center }, radius: zone.radius };
    }
  } else if (zone.mode === 'shrink') {
    const duration = Math.max(1, cfg.phases[zone.phase].shrinkSec * 1000);
    zone.timerMs -= dtMs;
    const t = clamp(1 - zone.timerMs / duration, 0, 1);
    zone.center.x = zone.shrinkFrom.center.x + (zone.nextCenter.x - zone.shrinkFrom.center.x) * t;
    zone.center.z = zone.shrinkFrom.center.z + (zone.nextCenter.z - zone.shrinkFrom.center.z) * t;
    zone.radius = zone.shrinkFrom.radius + (zone.nextRadius - zone.shrinkFrom.radius) * t;
    if (zone.timerMs <= 0) {
      zone.center = { ...zone.nextCenter };
      zone.radius = zone.nextRadius;
      zone.phase += 1;
      if (zone.phase < cfg.phases.length) {
        zone.mode = 'wait';
        zone.timerMs = cfg.phases[zone.phase].waitSec * 1000;
        zone.dps = cfg.phases[zone.phase].dps;
        const next = computeNextCircle(w, zone.center, zone.radius);
        zone.nextCenter = next.center;
        zone.nextRadius = next.radius;
        pushZoneEvent(w);
      } else {
        zone.mode = 'done';
        zone.doneElapsedMs = 0;
      }
    }
  } else {
    zone.doneElapsedMs += dtMs;
    const over = zone.doneElapsedMs - cfg.finalRampAfterSec * 1000;
    if (over > 0) {
      zone.dps = cfg.phases[cfg.phases.length - 1].dps * (1 + cfg.finalRampPerSec * (over / 1000));
    }
    // 终局坍缩：半径持续收缩至 0，圈内单位最终也会进入毒圈（保证对局自然终结）
    if (zone.radius > 0) {
      zone.radius = Math.max(0, zone.radius - cfg.finalCollapseRate * (dtMs / 1000));
    }
  }

  applyZoneDamage(w);
}

/** 圈外单位按秒掉血：满 1 个结算周期统一结算一次 */
function applyZoneDamage(w: World): void {
  const zone = w.zone;
  const dtSec = w.pack.constants.TICK_MS / 1000;
  zone.accumulatorSec += dtSec;
  if (zone.accumulatorSec < ZONE_DAMAGE_TICK_SEC) return;

  const apply = ZONE_DAMAGE_TICK_SEC;
  zone.accumulatorSec -= ZONE_DAMAGE_TICK_SEC;

  for (const e of w.entities) {
    if (!e.alive || e.state !== 'ground') continue;
    const d = dist2D(e.pos.x, e.pos.z, zone.center.x, zone.center.z);
    if (d > zone.radius) {
      zoneDamage(w, e, zone.dps * apply);
    }
  }
}

/** 毒圈伤害：不触发护甲减伤，归因 zone（直引实体：此前每秒对每受害实体做一次 find 闭包查找） */
function zoneDamage(w: World, target: Entity, amount: number): void {
  if (!target.alive) return;
  target.hp -= amount;
  if (target.hp <= 0) {
    // 存活数普通循环（去 reduce 闭包分配；与 eliminate 一致：先计数后置亡）
    let aliveCount = 0;
    const ents = w.entities;
    for (let i = 0; i < ents.length; i++) {
      if (ents[i].alive) aliveCount += 1;
    }
    target.alive = false;
    target.state = 'dead';
    target.rank = aliveCount;
    target.eliminatedAtMs = w.elapsedMs;
    target.eliminatedBy = 'zone';
    target.firing = false;
    target.aiState = 'dead';
    pushEvent(w, { type: 'entityEliminated', entityId: target.id, byId: 'zone', cause: 'zone' });
  }
}

function pushZoneEvent(w: World): void {
  const zone = w.zone;
  pushEvent(w, {
    type: 'zonePhaseChanged',
    phase: zone.phase,
    center: { ...zone.center },
    radius: zone.radius,
    nextCenter: { ...zone.nextCenter },
    nextRadius: zone.nextRadius,
    dps: zone.dps,
  });
}
