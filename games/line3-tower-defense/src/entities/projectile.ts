// projectile.ts — e-projectile：弹丸（发射点→命末点直线 2px；命中按 tick 离散结算零浮点漂移面）
// spec: entities/e-projectile · 发射时锁定目标，arrivalTick 到点结算——不逐 tick 追踪浮点位

export interface Projectile {
  id: number;
  turretId: number;
  targetId: number;
  x1: number; y1: number;   // 发射点
  x2: number; y2: number;   // 命末点（发射时锁定目标当时位）
  damage: number;
  spawnTick: number;
  arrivalTick: number;      // 离散结算 tick
  spent: boolean;
}

/** 飞行 tick 数 = ceil(距离 / 每tick位移)；距离 0 亦保 1 tick（同 tick 命中=反馈延迟 0 语义面） */
export function flightTicks(distPx: number, speedPxPerSec: number, stepMs: number): number {
  const perTick = (speedPxPerSec * stepMs) / 1000;
  return Math.max(1, Math.ceil(distPx / perTick));
}
