/**
 * render/props —— 植被点缀（树 + 草丛，AC2① 场景细节）。
 * InstancedMesh：各 1 个 draw call；分布用确定性 hash（视觉稳定，不引入玩法随机流），
 * 避开建筑 AABB 与城区核心；静态摆放，零逐帧成本。
 */

import * as THREE from 'three';
import type { ContentPack } from '../content';
import type { VisualDetailPreset } from '../content/render';
import { MAP_SIZE } from '../content/constants';
import { terrainHeightAt } from '../core/mapgen';
import { makeFoliageTexture } from './textures';

/** 确定性 0..1 hash（视觉分布专用，与玩法 RNG 无关） */
function hash01(n: number): number {
  let t = (n + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

interface BuildingBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export class PropsLayer {
  private trunkInst: THREE.InstancedMesh;
  private canopyInst: THREE.InstancedMesh;
  private grassInst: THREE.InstancedMesh;
  private treeCount: number;
  private grassCount: number;

  constructor(
    scene: THREE.Scene,
    pack: ContentPack,
    buildings: BuildingBox[],
    detail: VisualDetailPreset,
  ) {
    this.treeCount = detail.trees;
    this.grassCount = detail.grass;

    // —— 树干 + 树冠（共享分布矩阵）——
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4f34 });
    const canopyMat = new THREE.MeshLambertMaterial({ map: makeFoliageTexture() });
    this.trunkInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.34, 2.6, 6), trunkMat, this.treeCount);
    this.canopyInst = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), canopyMat, this.treeCount);
    this.trunkInst.castShadow = true;
    this.canopyInst.castShadow = true;
    this.canopyInst.receiveShadow = true;

    // —— 草丛：手写叶片束（3 片交叉草叶，vertexColors 底暗顶亮）——
    this.grassInst = new THREE.InstancedMesh(buildGrassGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), this.grassCount);

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const scale = new THREE.Vector3();
    const pos = new THREE.Vector3();
    const canopyColor = new THREE.Color();

    let placedTrees = 0;
    for (let i = 0; placedTrees < this.treeCount && i < this.treeCount * 6; i++) {
      const x = hash01(i * 7 + 1) * MAP_SIZE;
      const z = hash01(i * 13 + 5) * MAP_SIZE;
      if (blocked(x, z, 2.2, buildings, pack)) continue;
      const y = terrainHeightAt(pack, x, z);
      const s = 0.85 + hash01(i * 29 + 3) * 0.9;
      const rot = hash01(i * 41 + 7) * Math.PI * 2;

      // 树干
      e.set(0, rot, 0);
      q.setFromEuler(e);
      pos.set(x, y + 1.3 * s, z);
      scale.set(s, s, s);
      m.compose(pos, q, scale);
      this.trunkInst.setMatrixAt(placedTrees, m);

      // 树冠：双层错位球（一大一小）合成树形
      pos.set(x, y + 3.1 * s, z);
      scale.set(2.1 * s, 2.4 * s, 2.1 * s);
      m.compose(pos, q, scale);
      this.canopyInst.setMatrixAt(placedTrees, m);
      canopyColor.setHSL(0.26 + hash01(i * 53 + 11) * 0.05, 0.42, 0.26 + hash01(i * 61 + 13) * 0.1);
      this.canopyInst.setColorAt(placedTrees, canopyColor);
      placedTrees++;
    }
    this.trunkInst.count = placedTrees;
    this.canopyInst.count = placedTrees;
    this.trunkInst.instanceMatrix.needsUpdate = true;
    this.canopyInst.instanceMatrix.needsUpdate = true;
    if (this.canopyInst.instanceColor) this.canopyInst.instanceColor.needsUpdate = true;

    // —— 草丛分布（城区少、野区密）——
    let placedGrass = 0;
    for (let i = 0; placedGrass < this.grassCount && i < this.grassCount * 5; i++) {
      const x = hash01(i * 17 + 101) * MAP_SIZE;
      const z = hash01(i * 23 + 103) * MAP_SIZE;
      if (blocked(x, z, 0.6, buildings, pack)) continue;
      const y = terrainHeightAt(pack, x, z);
      const s = 0.7 + hash01(i * 31 + 107) * 0.8;
      e.set(0, hash01(i * 37 + 109) * Math.PI, 0);
      q.setFromEuler(e);
      pos.set(x, y + 0.28 * s, z);
      scale.set(s, s, s);
      m.compose(pos, q, scale);
      this.grassInst.setMatrixAt(placedGrass, m);
      placedGrass++;
    }
    this.grassInst.count = placedGrass;
    this.grassInst.instanceMatrix.needsUpdate = true;
    this.grassInst.receiveShadow = true;

    scene.add(this.trunkInst, this.canopyInst, this.grassInst);
  }

  /** 档位联动开关：降档时隐藏植被（3 个 instanced draw call → 0） */
  setDetailVisible(on: boolean): void {
    this.trunkInst.visible = on;
    this.canopyInst.visible = on;
    this.grassInst.visible = on;
  }

  dispose(): void {
    for (const inst of [this.trunkInst, this.canopyInst, this.grassInst]) {
      inst.geometry.dispose();
      (inst.material as THREE.Material).dispose();
      inst.removeFromParent();
    }
  }
}

/** 城区核心 / 建筑 AABB / 地图边缘阻挡判定 */
function blocked(x: number, z: number, margin: number, buildings: BuildingBox[], pack: ContentPack): boolean {
  if (x < margin + 4 || z < margin + 4 || x > MAP_SIZE - margin - 4 || z > MAP_SIZE - margin - 4) return true;
  for (const u of pack.map.urbanAreas) {
    const d2 = (x - u.x) ** 2 + (z - u.z) ** 2;
    if (d2 < (u.radius * 0.62) ** 2) return true;
  }
  for (const b of buildings) {
    if (x > b.minX - margin && x < b.maxX + margin && z > b.minZ - margin && z < b.maxZ + margin) return true;
  }
  return false;
}

/** 手写草叶束：6 片交叉三角草叶，底暗顶亮 vertexColors */
function buildGrassGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const dark = [0.16, 0.3, 0.12];
  const light = [0.42, 0.62, 0.22];
  const blades = 6;
  for (let i = 0; i < blades; i++) {
    const a = (i / blades) * Math.PI + hash01(i * 3) * 0.5;
    const dx = Math.cos(a) * 0.34;
    const dz = Math.sin(a) * 0.34;
    const cx = Math.cos(a + Math.PI / 2) * 0.05;
    const cz = Math.sin(a + Math.PI / 2) * 0.05;
    const h = 0.5 + hash01(i * 5) * 0.35;
    // 叶片三角形：底边两点 + 顶点（带风倾角）
    positions.push(-cx, 0, -cz, cx, 0, cz, dx, h, dz);
    colors.push(...dark, ...dark, ...light);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}
