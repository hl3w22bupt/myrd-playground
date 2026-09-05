/**
 * core/mapgen —— 程序化地形高度场、城区/野区划分、AABB 建筑生成。
 * 全部确定性：地形为解析函数（同输入恒同输出），建筑由 seeded RNG 生成。
 */

import { MAP_HALF } from '../content/constants';
import type { ContentPack } from '../content';
import type { AABB, Vec3 } from './types';
import type { Rng } from './rng';
import { clamp } from './geom';

/**
 * 地形高度场：解析正弦叠加 + 中心盆地。与 seed 无关（地图形状固定，便于落点预判），
 * 数值范围 [0, terrainAmplitude]。
 */
export function terrainHeightAt(pack: ContentPack, x: number, z: number): number {
  const a = pack.map.terrainAmplitude;
  const nx = x / MAP_HALF;
  const nz = z / MAP_HALF;
  const h =
    0.34 * Math.sin(nx * 2.1 + 0.7) * Math.cos(nz * 1.7 - 0.4) +
    0.22 * Math.sin(nx * 4.3 - 1.1) * Math.sin(nz * 3.7 + 0.9) +
    0.12 * Math.sin(nx * 8.1 + nz * 6.3 + 2.2) +
    0.08 * Math.cos(nx * 13.0 - nz * 11.0);
  const basin = 1 - 0.25 * Math.exp(-(nx * nx + nz * nz));
  return Math.max(0, (h * 0.5 + 0.5) * a * basin);
}

/** 城区判定：任一城区半径内即城区 */
export function isUrbanArea(pack: ContentPack, x: number, z: number): boolean {
  for (const u of pack.map.urbanAreas) {
    const dx = x - u.x;
    const dz = z - u.z;
    if (dx * dx + dz * dz <= u.radius * u.radius) return true;
  }
  return false;
}

/** 最近城区中心（跳伞落点推荐/AI 落点用） */
export function nearestUrbanCenter(pack: ContentPack, x: number, z: number) {
  let best = pack.map.urbanAreas[0];
  let bestD = Infinity;
  for (const u of pack.map.urbanAreas) {
    const d = (x - u.x) ** 2 + (z - u.z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = u;
    }
  }
  return best;
}

export interface GeneratedMap {
  buildings: AABB[];
  /** 城区出生/落点参考点（每城区一个，无建筑重叠处） */
  dropHints: Vec3[];
}

/** 生成建筑 AABB（确定性）：城区密集方块 + 野区零散 */
export function generateMap(pack: ContentPack, rng: Rng): GeneratedMap {
  const { buildings } = pack.map;
  const out: AABB[] = [];
  const dropHints: Vec3[] = [];

  const tryPlace = (cx: number, cz: number, size: number, height: number): boolean => {
    const box: AABB = {
      minX: cx - size / 2,
      maxX: cx + size / 2,
      minZ: cz - size / 2,
      maxZ: cz + size / 2,
      minY: terrainHeightAt(pack, cx, cz) - 1,
      maxY: terrainHeightAt(pack, cx, cz) + height,
    };
    for (const b of out) {
      const gap = pack.map.buildingSpacing;
      if (
        box.minX - gap < b.maxX &&
        box.maxX + gap > b.minX &&
        box.minZ - gap < b.maxZ &&
        box.maxZ + gap > b.minZ
      ) {
        return false;
      }
    }
    out.push(box);
    return true;
  };

  for (const urban of pack.map.urbanAreas) {
    let placed = 0;
    let guard = 0;
    while (placed < buildings.urbanCount && guard < buildings.urbanCount * 24) {
      guard++;
      const dir = rng.unitDir();
      const r = Math.sqrt(rng.next()) * urban.radius * 0.92;
      const cx = clamp(urban.x + dir.x * r, 40, 2 * MAP_HALF - 40);
      const cz = clamp(urban.z + dir.z * r, 40, 2 * MAP_HALF - 40);
      const size = rng.range(buildings.minSize, buildings.maxSize);
      const height = rng.range(buildings.minHeight, buildings.maxHeight);
      if (tryPlace(cx, cz, size, height)) placed++;
    }
    // 城区中心找一个空地作为落点提示
    dropHints.push(findClearSpot(pack, out, urban.x, urban.z, 26));
  }

  let placedWild = 0;
  let guardWild = 0;
  while (placedWild < buildings.wildCount && guardWild < buildings.wildCount * 40) {
    guardWild++;
    const p = rng.unitDir();
    const r = Math.sqrt(rng.next()) * MAP_HALF * 0.92;
    const cx = clamp(MAP_HALF + p.x * r, 40, 2 * MAP_HALF - 40);
    const cz = clamp(MAP_HALF + p.z * r, 40, 2 * MAP_HALF - 40);
    if (isUrbanArea(pack, cx, cz)) continue;
    const size = rng.range(buildings.minSize, buildings.maxSize);
    const height = rng.range(buildings.minHeight * 0.6, buildings.maxHeight * 0.7);
    if (tryPlace(cx, cz, size, height)) placedWild++;
  }

  return { buildings: out, dropHints };
}

function findClearSpot(pack: ContentPack, buildings: AABB[], x: number, z: number, r: number): Vec3 {
  for (let ring = 0; ring < 12; ring++) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + ring;
      const px = clamp(x + Math.cos(a) * ring * r * 0.5, 20, 2 * MAP_HALF - 20);
      const pz = clamp(z + Math.sin(a) * ring * r * 0.5, 20, 2 * MAP_HALF - 20);
      let clear = true;
      for (const b of buildings) {
        if (
          px > b.minX - 6 && px < b.maxX + 6 &&
          pz > b.minZ - 6 && pz < b.maxZ + 6
        ) {
          clear = false;
          break;
        }
      }
      if (clear) return { x: px, y: terrainHeightAt(pack, px, pz), z: pz };
    }
  }
  return { x, y: terrainHeightAt(pack, x, z), z };
}

/** 平面坐标（值类型） */
export interface XZ {
  x: number;
  z: number;
}

/**
 * 地面移动的 AABB 碰撞：先 X 后 Z 分离轴 + 速度钳制（架构 ADR-002）。
 * 返回修正后的位置。
 * 性能：out 复用调用方缓冲（movement 每实体每 tick 调用 2 次，此前每次返回新对象）。
 */
export function resolveBuildingCollision(
  x: number,
  z: number,
  radius: number,
  groundY: number,
  buildings: AABB[],
  out: XZ = { x: 0, z: 0 },
): XZ {
  let nx = x;
  let nz = z;
  for (const b of buildings) {
    if (groundY >= b.maxY - 0.05) continue; // 低于建筑底部（不会发生，建筑贴地）
    const closestX = clamp(nx, b.minX, b.maxX);
    const closestZ = clamp(nz, b.minZ, b.maxZ);
    const dx = nx - closestX;
    const dz = nz - closestZ;
    const d2 = dx * dx + dz * dz;
    if (d2 > radius * radius) continue;
    if (d2 > 1e-8) {
      const d = Math.sqrt(d2);
      nx = closestX + (dx / d) * radius;
      nz = closestZ + (dz / d) * radius;
    } else {
      // 圆心在建筑内：沿最小穿透轴推出
      const left = nx - b.minX;
      const right = b.maxX - nx;
      const up = nz - b.minZ;
      const down = b.maxZ - nz;
      const m = Math.min(left, right, up, down);
      if (m === left) nx = b.minX - radius;
      else if (m === right) nx = b.maxX + radius;
      else if (m === up) nz = b.minZ - radius;
      else nz = b.maxZ + radius;
    }
  }
  out.x = nx;
  out.z = nz;
  return out;
}
