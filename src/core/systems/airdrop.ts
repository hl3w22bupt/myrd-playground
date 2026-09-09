/**
 * core/systems/airdrop —— 空投：锚定缩圈阶段投放、降落伞匀速下落、落地生成高级物资包。
 * 确定性：落点与物资散布全部来自 rng.airdrop 子流（随机流隔离红线）。
 */

import type { World, Airdrop, LootItem } from '../world';
import type { Vec3 } from '../types';
import { clamp } from '../geom';
import { terrainHeightAt } from '../mapgen';
import { pushEvent } from '../world';

let airdropSeq = 0;
let airdropLootSeq = 0;

export function updateAirdrops(w: World): void {
  const cfg = w.pack.airdrop;
  const dtSec = w.pack.constants.TICK_MS / 1000;

  // 1) 触发：进入配置阶段的 wait 时投放（每阶段一次）
  if (
    w.zone.mode === 'wait' &&
    cfg.triggerPhases.includes(w.zone.phase) &&
    !w.airdropTriggeredPhases.includes(w.zone.phase)
  ) {
    w.airdropTriggeredPhases.push(w.zone.phase);
    spawnAirdrop(w);
  }

  // 2) 下落与落地
  for (const a of w.airdrops) {
    if (a.state !== 'falling') continue;
    a.pos.y -= cfg.fallSpeed * dtSec;
    const ground = terrainHeightAt(w.pack, a.pos.x, a.pos.z);
    if (a.pos.y <= ground + 0.6) {
      a.pos.y = ground + 0.6;
      a.state = 'landed';
      spawnBundle(w, a.pos);
      pushEvent(w, { type: 'airdropLanded', id: a.id, pos: { ...a.pos } });
    }
  }
}

function spawnAirdrop(w: World): void {
  const cfg = w.pack.airdrop;
  // 落点：下一圈范围内（保证可达且有争夺性）
  const dir = w.rng.airdrop.unitDir();
  const r = Math.sqrt(w.rng.airdrop.next()) * w.zone.nextRadius * cfg.landingRadiusRatio;
  const x = clamp(w.zone.nextCenter.x + dir.x * r, 8, 2 * w.pack.constants.MAP_HALF - 8);
  const z = clamp(w.zone.nextCenter.z + dir.z * r, 8, 2 * w.pack.constants.MAP_HALF - 8);
  const ground = terrainHeightAt(w.pack, x, z);
  const drop: Airdrop = {
    id: `airdrop_${airdropSeq++}`,
    pos: { x, y: ground + cfg.spawnAltitude, z },
    state: 'falling',
  };
  w.airdrops.push(drop);
  pushEvent(w, { type: 'airdropIncoming', id: drop.id, pos: { ...drop.pos } });
}

/** 落地物资包：箱周环形散布（高级物资：空投专属武器/三级装备/急救包） */
function spawnBundle(w: World, center: Vec3): void {
  const cfg = w.pack.airdrop;
  const n = cfg.bundle.length;
  for (let i = 0; i < n; i++) {
    const item = cfg.bundle[i];
    const angle = (i / n) * Math.PI * 2 + w.rng.airdrop.next() * 0.6;
    const r = cfg.bundleSpreadM * (0.5 + w.rng.airdrop.next() * 0.5);
    const x = center.x + Math.cos(angle) * r;
    const z = center.z + Math.sin(angle) * r;
    const pos: Vec3 = { x, y: terrainHeightAt(w.pack, x, z) + 0.25, z };
    const loot: LootItem = { id: `loot_airdrop_${airdropLootSeq++}`, item, pos, taken: false };
    w.loots.push(loot);
    pushEvent(w, { type: 'lootSpawned', id: loot.id, pos, item });
  }
}

/** 最近的已落地空投（AI 抢空投用） */
export function nearestLandedAirdrop(w: World, x: number, z: number, maxDist: number): Airdrop | null {
  let best: Airdrop | null = null;
  let bestD = maxDist;
  for (const a of w.airdrops) {
    if (a.state !== 'landed') continue;
    const d = Math.hypot(a.pos.x - x, a.pos.z - z);
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return best;
}
