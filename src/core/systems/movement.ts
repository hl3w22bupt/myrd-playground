/**
 * core/systems/movement —— 地面移动、地形高度采样、AABB 建筑碰撞（先 X 后 Z 分离轴）。
 */

import { MAP_HALF } from '../../content/constants';
import type { World } from '../world';
import { terrainHeightAt, resolveBuildingCollision } from '../mapgen';
import { clamp } from '../geom';

export function updateMovement(w: World): void {
  const dtSec = w.pack.constants.TICK_MS / 1000;
  const cfg = w.pack.physics.movement;
  const radius = 0.5;

  for (const e of w.entities) {
    if (!e.alive || e.state !== 'ground') continue;
    const mag = Math.hypot(e.moveDirX, e.moveDirZ);
    if (mag > 1e-4) {
      // 医疗引导中：禁疾跑且移速减半（血包急救线，数值来自 ballistic.channelMoveSpeedMul）
      const channelMul = e.medkitUntilMs !== null ? w.pack.physics.ballistic.channelMoveSpeedMul : 1;
      const speed = (e.moveSprint && channelMul === 1 ? cfg.sprintSpeed : cfg.walkSpeed) * channelMul;
      const dx = (e.moveDirX / mag) * speed * dtSec;
      const dz = (e.moveDirZ / mag) * speed * dtSec;

      // 先 X 后 Z 分离轴
      const afterX = resolveBuildingCollision(e.pos.x + dx, e.pos.z, radius, e.pos.y, w.buildings);
      const afterZ = resolveBuildingCollision(afterX.x, afterX.z + dz, radius, e.pos.y, w.buildings);
      e.pos.x = clamp(afterZ.x, 2, 2 * MAP_HALF - 2);
      e.pos.z = clamp(afterZ.z, 2, 2 * MAP_HALF - 2);
    }
    e.pos.y = terrainHeightAt(w.pack, e.pos.x, e.pos.z);
  }
}
