/**
 * core/geom —— 确定性几何工具（Vec3 值类型 + 射线/AABB/地形采样）。
 * 禁止任何 DOM / three / Math.random / Date.now。
 */

import type { AABB, Vec3 } from './types';

export function vec3(x = 0, y = 0, z = 0): Vec3 {
  return { x, y, z };
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

export function dist2D(ax: number, az: number, bx: number, bz: number): number {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

export function dist3D(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/** 平面方位角：+x 为 0，+z 为 +PI/2（右手系，yaw 逆时针） */
export function yawFromDir(dx: number, dz: number): number {
  return Math.atan2(dz, dx);
}

export function dirFromYaw(yaw: number): { x: number; z: number } {
  return { x: Math.cos(yaw), z: Math.sin(yaw) };
}

/**
 * 视线方向向量（含 pitch，向下为正）。pitch 单位 rad。
 */
export function aimDir(yaw: number, pitch: number): Vec3 {
  const c = Math.cos(pitch);
  return { x: Math.cos(yaw) * c, y: Math.sin(pitch), z: Math.sin(yaw) * c };
}

/**
 * 射线 vs AABB（slab 法），返回 t（>=0）或 -1。
 * 性能：三轴 slab 手工展开（调用点在每发子弹 × 每栋建筑、AI 视线 × 每栋建筑的热路径上，
 * 展开前的「轴元组数组」实现每次调用分配 4 个短命数组，交火时可达数万对象/秒）。
 */
export function rayAABB(origin: Vec3, dir: Vec3, box: AABB, maxDist: number): number {
  let tmin = 0;
  let tmax = maxDist;

  // X slab
  if (dir.x > -1e-9 && dir.x < 1e-9) {
    if (origin.x < box.minX || origin.x > box.maxX) return -1;
  } else {
    let t1 = (box.minX - origin.x) / dir.x;
    let t2 = (box.maxX - origin.x) / dir.x;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return -1;
  }

  // Y slab
  if (dir.y > -1e-9 && dir.y < 1e-9) {
    if (origin.y < box.minY || origin.y > box.maxY) return -1;
  } else {
    let t1 = (box.minY - origin.y) / dir.y;
    let t2 = (box.maxY - origin.y) / dir.y;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return -1;
  }

  // Z slab
  if (dir.z > -1e-9 && dir.z < 1e-9) {
    if (origin.z < box.minZ || origin.z > box.maxZ) return -1;
  } else {
    let t1 = (box.minZ - origin.z) / dir.z;
    let t2 = (box.maxZ - origin.z) / dir.z;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return -1;
  }

  return tmin;
}

/**
 * 射线 vs 竖直圆柱近似包围盒（用于人体命中判定），返回 t 或 -1。
 * 性能：包围盒边界直接以标量参与 slab 测试，不再构造临时 AABB 对象
 * （调用点 = 每发子弹 × 每个实体，弹匣连射下是稳定的高频分配源）。
 */
export function rayVerticalBox(
  origin: Vec3,
  dir: Vec3,
  center: Vec3,
  halfWidth: number,
  height: number,
  maxDist: number,
): number {
  let tmin = 0;
  let tmax = maxDist;

  // X slab（center ± halfWidth）
  if (dir.x > -1e-9 && dir.x < 1e-9) {
    if (origin.x < center.x - halfWidth || origin.x > center.x + halfWidth) return -1;
  } else {
    let t1 = (center.x - halfWidth - origin.x) / dir.x;
    let t2 = (center.x + halfWidth - origin.x) / dir.x;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return -1;
  }

  // Y slab（center.y .. center.y + height）
  if (dir.y > -1e-9 && dir.y < 1e-9) {
    if (origin.y < center.y || origin.y > center.y + height) return -1;
  } else {
    let t1 = (center.y - origin.y) / dir.y;
    let t2 = (center.y + height - origin.y) / dir.y;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return -1;
  }

  // Z slab（center ± halfWidth）
  if (dir.z > -1e-9 && dir.z < 1e-9) {
    if (origin.z < center.z - halfWidth || origin.z > center.z + halfWidth) return -1;
  } else {
    let t1 = (center.z - halfWidth - origin.z) / dir.z;
    let t2 = (center.z + halfWidth - origin.z) / dir.z;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return -1;
  }

  return tmin;
}

/** 平面圆 vs AABB 相交（用于建筑占位判定） */
export function circleIntersectsAABB(cx: number, cz: number, r: number, box: AABB): boolean {
  const nx = clamp(cx, box.minX, box.maxX);
  const nz = clamp(cz, box.minZ, box.maxZ);
  const dx = cx - nx;
  const dz = cz - nz;
  return dx * dx + dz * dz <= r * r;
}
