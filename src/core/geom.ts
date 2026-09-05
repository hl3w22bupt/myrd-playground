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

/** 射线 vs AABB（slab 法），返回 t（>=0）或 -1 */
export function rayAABB(origin: Vec3, dir: Vec3, box: AABB, maxDist: number): number {
  let tmin = 0;
  let tmax = maxDist;

  const axes: Array<[number, number, number, number]> = [
    [origin.x, dir.x, box.minX, box.maxX],
    [origin.y, dir.y, box.minY, box.maxY],
    [origin.z, dir.z, box.minZ, box.maxZ],
  ];

  for (const [o, d, lo, hi] of axes) {
    if (Math.abs(d) < 1e-9) {
      if (o < lo || o > hi) return -1;
    } else {
      let t1 = (lo - o) / d;
      let t2 = (hi - o) / d;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return -1;
    }
  }
  return tmin;
}

/** 射线 vs 竖直圆柱近似包围盒（用于人体命中判定），返回 t 或 -1 */
export function rayVerticalBox(
  origin: Vec3,
  dir: Vec3,
  center: Vec3,
  halfWidth: number,
  height: number,
  maxDist: number,
): number {
  const box: AABB = {
    minX: center.x - halfWidth,
    maxX: center.x + halfWidth,
    minZ: center.z - halfWidth,
    maxZ: center.z + halfWidth,
    minY: center.y,
    maxY: center.y + height,
  };
  return rayAABB(origin, dir, box, maxDist);
}

/** 平面圆 vs AABB 相交（用于建筑占位判定） */
export function circleIntersectsAABB(cx: number, cz: number, r: number, box: AABB): boolean {
  const nx = clamp(cx, box.minX, box.maxX);
  const nz = clamp(cz, box.minZ, box.maxZ);
  const dx = cx - nx;
  const dz = cz - nz;
  return dx * dx + dz * dz <= r * r;
}
