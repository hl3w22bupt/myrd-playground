/**
 * core/systems/airdrop —— 定时空投：投放 → 带伞下落 → 落地 → 高价值物资散布。
 * 数值全部来自 content/airdrop；随机取自 rng.airdrop 独立子流（随机流隔离，确定性红线）。
 * 空投是纯内容投放：落地物资走标准 loot 系统（拾取/背包/生效与常规物资完全同路径）。
 */

import { MAP_HALF } from '../../content/constants';
import type { World } from '../world';
import type { Vec3 } from '../types';
import { clamp } from '../geom';
import { terrainHeightAt } from '../mapgen';
import { pushEvent } from '../world';
import { spawnLootAt } from './loot';

/** 空投调度初始化（createWorld 时调用；首投时间 = firstDropAtSec，与 crate 数量无关） */
export function initAirdrops(_w: World): void {
  void _w;
}

/** 下一次空投的投放时刻（ms）：首投 + 已投放次数 × 间隔 */
export function nextDropAtMs(w: World): number {
  const cfg = w.pack.airdrop;
  return cfg.firstDropAtSec * 1000 + w.airdrops.length * cfg.respawnIntervalSec * 1000;
}

export function updateAirdrops(w: World): void {
  if (w.status === 'ended') return;
  const cfg = w.pack.airdrop;
  const dtSec = w.pack.constants.TICK_MS / 1000;

  // 1) 定时投放（上限 maxDrops）
  if (w.airdrops.length < cfg.maxDrops && w.elapsedMs >= nextDropAtMs(w)) {
    spawnCrate(w);
  }

  // 2) 下落与落地
  for (const crate of w.airdrops) {
    if (crate.phase !== 'falling') continue;
    crate.pos.y -= cfg.fallSpeedMps * dtSec;
    const groundY = terrainHeightAt(w.pack, crate.pos.x, crate.pos.z);
    if (crate.pos.y <= groundY + 0.45) {
      crate.pos.y = groundY + 0.45;
      crate.phase = 'landed';
      crate.landedAtMs = w.elapsedMs;
      scatterContents(w, crate.pos);
      pushEvent(w, { type: 'airdropLanded', id: crate.id, pos: { ...crate.pos } });
    }
  }
}

/** 在当前安全区内投放一个空投箱（落点由 rng.airdrop 确定，确定性） */
function spawnCrate(w: World): void {
  const cfg = w.pack.airdrop;
  const zr = Math.max(60, w.zone.radius);
  const dir = w.rng.airdrop.unitDir();
  const rFactor =
    cfg.landMinRadiusFactor +
    Math.sqrt(w.rng.airdrop.next()) * (cfg.landRadiusFactor - cfg.landMinRadiusFactor);
  const x = clamp(w.zone.center.x + dir.x * zr * rFactor, 40, 2 * MAP_HALF - 40);
  const z = clamp(w.zone.center.z + dir.z * zr * rFactor, 40, 2 * MAP_HALF - 40);
  const pos: Vec3 = { x, y: cfg.spawnAltitude, z };
  const crate = {
    id: `airdrop_${w.airdropSeq++}`,
    pos,
    phase: 'falling' as const,
    landedAtMs: null,
  };
  w.airdrops.push(crate);
  pushEvent(w, { type: 'airdropIncoming', id: crate.id, pos: { ...pos } });
}

/** 落地：按内容物在箱旁散布生成物资（标准 loot 通道） */
function scatterContents(w: World, pos: Vec3): void {
  const cfg = w.pack.airdrop;
  for (const entry of cfg.contents) {
    for (let i = 0; i < entry.count; i++) {
      const dir = w.rng.airdrop.unitDir();
      const r = Math.sqrt(w.rng.airdrop.next()) * cfg.scatterRadiusM;
      const x = clamp(pos.x + dir.x * r, 4, 2 * MAP_HALF - 4);
      const z = clamp(pos.z + dir.z * r, 4, 2 * MAP_HALF - 4);
      spawnLootAt(w, x, z, entry.item);
    }
  }
}
