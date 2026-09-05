/**
 * core/systems/movement —— 地面移动、地形高度采样、AABB 建筑碰撞（先 X 后 Z 分离轴）。
 */

import { MAP_HALF } from '../../content/constants';
import type { World } from '../world';
import { terrainHeightAt, resolveBuildingCollision, type XZ } from '../mapgen';
import { clamp } from '../geom';

/** 碰撞解算结果复用缓冲（交替使用：结果在本迭代内同步消费，不跨 tick 持有） */
const scratchA: XZ = { x: 0, z: 0 };
const scratchB: XZ = { x: 0, z: 0 };

export function updateMovement(w: World): void {
  const dtSec = w.pack.constants.TICK_MS / 1000;
  const cfg = w.pack.physics.movement;
  const radius = 0.5;

  for (const e of w.entities) {
    if (!e.alive || e.state !== 'ground') continue;
    const mag = Math.hypot(e.moveDirX, e.moveDirZ);
    if (mag > 1e-4) {
      const speed = (e.moveSprint ? cfg.sprintSpeed : cfg.walkSpeed);
      const dx = (e.moveDirX / mag) * speed * dtSec;
      const dz = (e.moveDirZ / mag) * speed * dtSec;

      // 先 X 后 Z 分离轴（零分配：写入复用缓冲；先取出 afterX 再做第二次调用）
      const afterX = resolveBuildingCollision(e.pos.x + dx, e.pos.z, radius, e.pos.y, w.buildings, scratchA);
      const afterXX = afterX.x;
      const afterXZ = afterX.z;
      const afterZ = resolveBuildingCollision(afterXX, afterXZ + dz, radius, e.pos.y, w.buildings, scratchB);
      e.pos.x = clamp(afterZ.x, 2, 2 * MAP_HALF - 2);
      e.pos.z = clamp(afterZ.z, 2, 2 * MAP_HALF - 2);
    }
    e.pos.y = terrainHeightAt(w.pack, e.pos.x, e.pos.z);
  }
}
