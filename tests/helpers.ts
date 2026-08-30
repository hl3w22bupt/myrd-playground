/**
 * tests/helpers —— 测试公共工具：跑满局、控制玩家跳伞落点的闭环控制器。
 * 注意：控制器只产生 PlayerIntent，与真实玩家同通道，不做任何内部状态直改。
 */

import { createWorldForTest, tickWorld, terrainHeightAt } from '../src/core';
import type { PlayerIntent, World } from '../src/core';
import { DEFAULT_CONTENT_PACK, type ContentPack } from '../src/content';

export function makeWorld(seed: number, aiCount = 12, pack: ContentPack = DEFAULT_CONTENT_PACK): World {
  return createWorldForTest({ seed, contentPack: pack, playerCount: 1, aiCount });
}

/**
 * 驱动玩家在航线内跳伞并向目标点滑翔（模拟熟练玩家操作，仅产生 PlayerIntent，用于 AC2 落点验证）。
 * 策略：按当前速度估计「预测落点」，误差大 → 俯冲增程，误差小 → 减速/开伞修正。
 */
export function playerLandingController(w: World, target: { x: number; z: number }): PlayerIntent[] {
  const p = w.player;
  // 自选跳伞时机：目标进入可达范围（约 420m）才跳伞
  if (p.state === 'plane') {
    const d = Math.hypot(target.x - p.pos.x, target.z - p.pos.z);
    return d <= 420 ? [{ kind: 'jumpFromPlane' }] : [];
  }
  if (p.state !== 'freefall' && p.state !== 'parachute') return [];

  const groundY = terrainHeightAt(w.pack, p.pos.x, p.pos.z);
  const descent =
    p.state === 'freefall'
      ? Math.max(25, -p.vel.y)
      : w.pack.physics.parachute.chuteDescentSpeed;
  const ttg = Math.max(0, (p.pos.y - groundY) / descent);
  const predX = p.pos.x + p.vel.x * ttg;
  const predZ = p.pos.z + p.vel.z * ttg;
  const errX = target.x - predX;
  const errZ = target.z - predZ;
  const err = Math.hypot(errX, errZ);
  const toX = target.x - p.pos.x;
  const toZ = target.z - p.pos.z;
  const toD = Math.hypot(toX, toZ) || 1;

  const intents: PlayerIntent[] = [];
  if (p.state === 'freefall') {
    if (err < 45) intents.push({ kind: 'deployParachute' });
    else if (err > 160) intents.push({ kind: 'freefallControl', dirX: toX / toD, dirZ: toZ / toD, dive: 1 });
    else intents.push({ kind: 'freefallControl', dirX: errX / err, dirZ: errZ / err, dive: 0.15 });
  } else {
    // 开伞滑翔：前置追踪（抵消当前速度），接近目标后收杆
    const leadX = target.x - p.vel.x * 0.4;
    const leadZ = target.z - p.vel.z * 0.4;
    const dx = leadX - p.pos.x;
    const dz = leadZ - p.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 2) intents.push({ kind: 'freefallControl', dirX: dx / d, dirZ: dz / d, dive: 0 });
    else intents.push({ kind: 'freefallControl', dirX: 0, dirZ: 0, dive: 0 });
  }
  return intents;
}

/** 跑到玩家落地为止，返回落地时的 tick */
export function runUntilLanded(w: World, target: { x: number; z: number }, maxTicks = 8000): number {
  let t = 0;
  while (w.player.state !== 'ground' && t < maxTicks) {
    tickWorld(w, playerLandingController(w, target));
    t++;
  }
  if (w.player.state !== 'ground') throw new Error(`玩家 ${maxTicks} tick 内未落地`);
  return t;
}

export function runTicks(w: World, intents: PlayerIntent[], n: number): void {
  for (let i = 0; i < n; i++) tickWorld(w, intents);
}

/** 跑到对局结束，返回结束 tick（超时抛错） */
export function runToEnd(w: World, maxTicks = 31_000, intentsForPlayer?: (w: World) => PlayerIntent[]): number {
  let t = 0;
  while (w.status !== 'ended' && t < maxTicks) {
    const intents = intentsForPlayer ? intentsForPlayer(w) : [];
    tickWorld(w, intents);
    t++;
  }
  if (w.status !== 'ended') throw new Error(`对局在 ${maxTicks} tick（${((maxTicks * 20) / 1000).toFixed(0)}s 逻辑时长）内未结束`);
  return t;
}

export function groundAt(pack: ContentPack, x: number, z: number): number {
  return terrainHeightAt(pack, x, z);
}

/** 在地图上寻找一条无建筑/地形遮挡的直线靶道（用于 AC4 射击测试） */
export function findClearLine(
  w: World,
  distance: number,
  isClear: (hit: { dist: number; entity: unknown } | null) => boolean,
): { x: number; z: number } {
  const candidates: Array<[number, number]> = [
    [200, 200], [300, 260], [1240, 320], [420, 1240], [1020, 1060],
    [640, 640], [220, 1380], [1380, 240], [900, 400], [500, 900],
  ];
  for (const [x, z] of candidates) {
    if (x + distance > 1590) continue;
    const origin = { x, y: terrainHeightAt(w.pack, x, z) + 1.62, z };
    const dir = { x: 1, y: 0, z: 0 };
    const hit = castShotPublic(w, origin, dir, distance - 0.5);
    if (isClear(hit)) return { x, z };
  }
  throw new Error('未找到无遮挡靶道');
}

import { castShot } from '../src/core/systems/combat';
function castShotPublic(
  w: World,
  origin: { x: number; y: number; z: number },
  dir: { x: number; y: number; z: number },
  maxRange: number,
): { dist: number; entity: unknown } | null {
  return castShot(w, w.player, origin, dir as never, maxRange) as never;
}
