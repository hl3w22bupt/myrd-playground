// geometry.js — 程序化几何工厂：圆角盒缓存 + 材质缓存 + 枪模/敌兵拼装。零外部模型。

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { camo } from "./textures.js";

// ---- 缓存工厂（同参数全场景唯一实例，对标样本 ht(color, opts) 口径）----
const geoCache = new Map();
const matCache = new Map();

export function roundedBox(w, h, d, r = 0.04, seg = 2) {
  const key = `rb-${w}-${h}-${d}-${r}-${seg}`;
  if (!geoCache.has(key)) geoCache.set(key, new RoundedBoxGeometry(w, h, d, seg, r));
  return geoCache.get(key);
}

export function standardMat(color, opts = {}) {
  const key = `m-${color}-${opts.roughness ?? 0.8}-${opts.metalness ?? 0.15}-${opts.map ?? ""}-${opts.emissive ?? ""}`;
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshStandardMaterial({
      color, roughness: opts.roughness ?? 0.8, metalness: opts.metalness ?? 0.15,
      map: opts.map ?? null, emissive: opts.emissive ?? 0x000000,
    }));
  }
  return matCache.get(key);
}

/** 盒体辅助：指定尺寸/颜色/位置的一块圆角盒 mesh */
export function block(w, h, d, color, x, y, z, opts = {}) {
  const m = new THREE.Mesh(roundedBox(w, h, d, opts.r ?? 0.04), standardMat(color, opts));
  m.position.set(x, y, z);
  if (opts.ry) m.rotation.y = opts.ry;
  m.castShadow = opts.shadow !== false;
  m.receiveShadow = true;
  return m;
}

/**
 * 武器视图模型：突击步枪（圆角盒拼装，对标样本「圆角盒拼枪」）。
 * 返回组，原点在握把；枪口朝 -z（与相机视线一致）。
 */
export function buildRifle() {
  const g = new THREE.Group();
  const dark = 0x2a2d31, mid = 0x3c4147, grip = 0x24262a, accent = 0xc9762e;
  g.add(block(0.09, 0.10, 0.62, dark, 0, 0, -0.22));            // 机匣
  g.add(block(0.07, 0.07, 0.34, mid, 0, 0.015, -0.68));         // 护木
  g.add(block(0.035, 0.035, 0.22, dark, 0, 0.015, -0.94));      // 枪管
  g.add(block(0.05, 0.05, 0.06, accent, 0, 0.015, -1.02, { r: 0.02 })); // 消焰器警示环
  g.add(block(0.08, 0.16, 0.10, grip, 0, -0.12, -0.06, { r: 0.03 }));   // 握把
  g.add(block(0.07, 0.18, 0.09, mid, 0, -0.10, -0.28, { r: 0.02 }));    // 弹匣
  g.add(block(0.08, 0.09, 0.26, dark, 0, 0.005, 0.16));         // 枪托
  g.add(block(0.02, 0.05, 0.02, accent, 0.045, 0.06, -0.18, { r: 0.008 })); // 抛壳窗警示
  g.add(block(0.03, 0.06, 0.14, mid, 0, 0.085, -0.30));         // 导轨/瞄具座
  return g;
}

/**
 * 敌兵：圆角盒拼装人形（对标样本「骨骼蒙皮士兵」的原型级替代——刚体分段 + 程序化摆动）。
 * 返回 { group, parts: {torso, head, legL, legR, armL, armR} }，表现层按快照驱动位置/朝向/摆动。
 */
export function buildSoldier() {
  const g = new THREE.Group();
  const uniform = standardMat(0xffffff, { map: camo(), roughness: 0.9, metalness: 0.05 });
  const skin = standardMat(0x8a6a52, { roughness: 0.85 });
  const gear = standardMat(0x2f3328, { roughness: 0.8 });

  const mk = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
    return m;
  };
  const torso = mk(roundedBox(0.52, 0.62, 0.30, 0.06), uniform, 0, 1.12, 0);
  const vest = mk(roundedBox(0.56, 0.34, 0.34, 0.05), gear, 0, 1.16, 0);
  const head = mk(roundedBox(0.26, 0.26, 0.26, 0.06), skin, 0, 1.58, 0);
  const helmet = mk(roundedBox(0.30, 0.12, 0.30, 0.05), gear, 0, 1.70, 0);
  const legL = mk(roundedBox(0.18, 0.72, 0.20, 0.05), uniform, -0.14, 0.40, 0);
  const legR = mk(roundedBox(0.18, 0.72, 0.20, 0.05), uniform, 0.14, 0.40, 0);
  const armL = mk(roundedBox(0.14, 0.52, 0.16, 0.05), uniform, -0.34, 1.10, 0);
  const armR = mk(roundedBox(0.14, 0.52, 0.16, 0.05), uniform, 0.34, 1.10, 0);
  const rifle = mk(roundedBox(0.07, 0.09, 0.66, 0.02), gear, 0.10, 1.12, -0.36);
  g.add(torso, vest, head, helmet, legL, legR, armL, armR, rifle);
  return { group: g, parts: { torso, head, legL, legR, armL, armR } };
}
