/**
 * core/systems/parachute —— 运输机航线 + 跳伞四阶段物理（自由落体 → 开伞 → 滑翔 → 落地）。
 * AC2：同 seed 同意图序列逐 tick 复现；落地 1s 内进入 ground；落点可控。
 */

import { MAP_HALF } from '../../content/constants';
import type { World, Entity } from '../world';
import { terrainHeightAt } from '../mapgen';
import { clamp } from '../geom';
import { pushEvent } from '../world';

/** 更新运输机航线（每 tick 一次，全体登机者跟随） */
export function updatePlane(w: World): void {
  const plane = w.plane;
  if (!plane.active) return;
  const cfg = w.pack.physics.parachute;
  const step = (cfg.planeSpeed * w.pack.constants.TICK_MS) / 1000;
  plane.pos.x += plane.dir.x * step;
  plane.pos.z += plane.dir.z * step;

  const limit = MAP_HALF + cfg.planePathMargin;
  if (
    plane.pos.x < -limit || plane.pos.x > 2 * MAP_HALF + limit ||
    plane.pos.z < -limit || plane.pos.z > 2 * MAP_HALF + limit
  ) {
    plane.active = false;
  }

  for (const e of w.entities) {
    if (e.state !== 'plane' || !e.alive) continue;
    if (!plane.active) {
      forceJump(w, e);
      continue;
    }
    e.pos.x = plane.pos.x;
    e.pos.z = plane.pos.z;
    e.pos.y = plane.pos.y;
    e.yaw = Math.atan2(plane.dir.z, plane.dir.x);
    if (e.wantJump) {
      e.wantJump = false;
      jumpFromPlane(w, e);
    }
  }
}

export function jumpFromPlane(w: World, e: Entity): void {
  if (e.state !== 'plane') return;
  e.state = 'freefall';
  const cfg = w.pack.physics.parachute;
  e.vel.x = w.plane.dir.x * cfg.planeSpeed * 0.45;
  e.vel.y = -6;
  e.vel.z = w.plane.dir.z * cfg.planeSpeed * 0.45;
  pushEvent(w, { type: 'playerStateChanged', entityId: e.id, state: 'freefall' });
}

function forceJump(w: World, e: Entity): void {
  jumpFromPlane(w, e);
}

/**
 * 四阶段物理推进（单实体）。
 * @param dtSec 本 tick 时长（秒）
 */
export function simulateFalling(w: World, e: Entity, dtSec: number): void {
  if (!e.alive) return;
  const cfg = w.pack.physics.parachute;

  if (e.state === 'plane') return;

  if (e.state === 'freefall') {
    // 控制输入：ctrlX/ctrlZ 为期望水平方向（模长 <=1），ctrlDive ∈ [0,1] 俯冲
    const targetH = cfg.freefallHorizontalSpeed + cfg.freefallDiveBonus * e.ctrlDive;
    const mag = Math.hypot(e.ctrlX, e.ctrlZ);
    const tx = mag > 1e-4 ? (e.ctrlX / mag) * targetH : 0;
    const tz = mag > 1e-4 ? (e.ctrlZ / mag) * targetH : 0;
    const accel = cfg.freefallHorizontalAccel;
    e.vel.x = approach(e.vel.x, tx, accel * dtSec);
    e.vel.z = approach(e.vel.z, tz, accel * dtSec);

    const terminalVy = cfg.freefallTerminalVy * (1 + 0.45 * e.ctrlDive);
    e.vel.y -= cfg.freefallGravity * dtSec;
    if (e.vel.y < -terminalVy) e.vel.y = -terminalVy;

    if (e.wantDeploy) {
      e.wantDeploy = false;
      deployChute(w, e);
    } else {
      const groundY = terrainHeightAt(w.pack, e.pos.x, e.pos.z);
      if (e.pos.y - groundY <= cfg.autoDeployAltitude) deployChute(w, e);
    }
  }

  if (e.state === 'parachute') {
    const targetVy = -cfg.chuteDescentSpeed;
    const k = 1 - Math.exp(-dtSec / Math.max(0.05, cfg.chuteVyTau));
    e.vel.y += (targetVy - e.vel.y) * k;

    const mag = Math.hypot(e.ctrlX, e.ctrlZ);
    const tx = mag > 1e-4 ? (e.ctrlX / mag) * cfg.chuteGlideSpeed : 0;
    const tz = mag > 1e-4 ? (e.ctrlZ / mag) * cfg.chuteGlideSpeed : 0;
    e.vel.x = approach(e.vel.x, tx, cfg.chuteHorizontalAccel * dtSec);
    e.vel.z = approach(e.vel.z, tz, cfg.chuteHorizontalAccel * dtSec);
  }

  if (e.state === 'freefall' || e.state === 'parachute') {
    e.pos.x += e.vel.x * dtSec;
    e.pos.y += e.vel.y * dtSec;
    e.pos.z += e.vel.z * dtSec;
    e.pos.x = clamp(e.pos.x, 4, 2 * MAP_HALF - 4);
    e.pos.z = clamp(e.pos.z, 4, 2 * MAP_HALF - 4);
    e.yaw = Math.atan2(e.vel.z, e.vel.x);

    const groundY = terrainHeightAt(w.pack, e.pos.x, e.pos.z);
    if (e.pos.y <= groundY + cfg.landingAltitude) {
      land(w, e, groundY);
    }
  }
}

function deployChute(w: World, e: Entity): void {
  if (e.state !== 'freefall') return;
  e.state = 'parachute';
  e.vel.y = Math.max(e.vel.y, -w.pack.physics.parachute.deployBrakeVy);
  pushEvent(w, { type: 'playerStateChanged', entityId: e.id, state: 'parachute' });
}

function land(w: World, e: Entity, groundY: number): void {
  e.state = 'ground';
  e.pos.y = groundY;
  e.vel.x = 0;
  e.vel.y = 0;
  e.vel.z = 0;
  e.ctrlX = 0;
  e.ctrlZ = 0;
  e.ctrlDive = 0;
  pushEvent(w, { type: 'playerStateChanged', entityId: e.id, state: 'ground' });
}

function approach(cur: number, target: number, maxDelta: number): number {
  const d = target - cur;
  if (Math.abs(d) <= maxDelta) return target;
  return cur + Math.sign(d) * maxDelta;
}
