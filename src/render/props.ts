/**
 * render/props —— 植被（树 + 草丛，AC2① 场景细节）+ 分块 LOD（本次叠加：LOD 合批优化）。
 *
 * 合批：树干与树冠合并为单一 geometry（顶点色承载棕/绿），每块 1 个 InstancedMesh ——
 * 每棵树 2 draw call → 每块 1 draw call；草丛各块 1 个 InstancedMesh。
 *
 * LOD：全图按 VEG_CHUNK_SIZE 网格分块（vegLod 纯逻辑），块中心距相机超出 LOD 半径的块整块
 * 隐藏（visible=false 不产生 draw call）——GPU 只绘制视距内的块，成本随视距自适应。
 * 分布用确定性 hash（视觉稳定，不引入玩法随机流），避开建筑 AABB 与城区核心；静态摆放。
 */

import * as THREE from 'three';
import type { ContentPack } from '../content';
import { MAP_SIZE } from '../content/constants';
import { VEG_CHUNK_SIZE, VEG_LOD_UPDATE_HZ } from '../content/render';
import { terrainHeightAt } from '../core/mapgen';
import { makeFoliageTexture } from './textures';
import type { QualityLevel } from './quality';
import { buildChunks, grassLodRadius, treeLodRadius, updateVisibility, type VegChunk } from './vegLod';

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

const TREE_COUNT_BY_QUALITY: Record<QualityLevel, number> = { low: 90, medium: 220, high: 300 };
const GRASS_COUNT_BY_QUALITY: Record<QualityLevel, number> = { low: 220, medium: 620, high: 900 };

/** 候选采样放大系数：因建筑/城区剔除需要多采样一些才能摆满目标数量 */
const SAMPLE_MULTIPLE = 6;

export class PropsLayer {
  private readonly chunks: VegChunk[];
  private readonly treeInst: THREE.InstancedMesh[] = [];
  private readonly grassInst: THREE.InstancedMesh[] = [];
  private readonly lodIntervalFrames: number;
  private frameCounter = 0;
  private visibleTreeChunks = 0;
  private visibleGrassChunks = 0;

  constructor(
    private readonly scene: THREE.Scene,
    pack: ContentPack,
    buildings: BuildingBox[],
    quality: QualityLevel,
  ) {
    const treeCount = TREE_COUNT_BY_QUALITY[quality];
    const grassCount = GRASS_COUNT_BY_QUALITY[quality];
    this.chunks = buildChunks(MAP_SIZE, VEG_CHUNK_SIZE);
    this.lodIntervalFrames = Math.max(1, Math.round(60 / VEG_LOD_UPDATE_HZ));

    // —— 预采样全部候选位置并按块分桶（两段式：先分桶再按桶建 InstancedMesh，容量精确）——
    const treePositions = this.samplePositions(treeCount, buildings, pack, 2.2, 1, 0.85, 0.9, Math.PI * 2);
    const grassPositions = this.samplePositions(grassCount, buildings, pack, 0.6, 101, 0.7, 0.8, Math.PI);

    this.buildTreeChunks(treePositions);
    this.buildGrassChunks(grassPositions);

    // 初始可见性（以地图中心为初始相机位置，首帧 render 前也保证不漏画）
    this.refreshLod(MAP_SIZE / 2, MAP_SIZE / 2);
  }

  /** 每帧由 view 调用：内部按 VEG_LOD_UPDATE_HZ 降频决策，可见标志搬运到 InstancedMesh */
  update(cameraX: number, cameraZ: number): void {
    this.frameCounter += 1;
    if (this.frameCounter % this.lodIntervalFrames !== 1) return;
    this.refreshLod(cameraX, cameraZ);
  }

  /** 当前可见树/草块数（调试 HUD / 基准断言用） */
  get visibleChunkCounts(): { trees: number; grass: number; total: number } {
    return {
      trees: this.visibleTreeChunks,
      grass: this.visibleGrassChunks,
      total: this.visibleTreeChunks + this.visibleGrassChunks,
    };
  }

  dispose(): void {
    const sharedGeo = new Set<THREE.BufferGeometry>();
    const sharedMat = new Set<THREE.Material>();
    for (const inst of [...this.treeInst, ...this.grassInst]) {
      sharedGeo.add(inst.geometry);
      sharedMat.add(inst.material as THREE.Material);
      inst.dispose();
      inst.removeFromParent();
    }
    sharedGeo.forEach((g) => g.dispose());
    sharedMat.forEach((m) => m.dispose());
    this.treeInst.length = 0;
    this.grassInst.length = 0;
  }

  // ———————————————————— 内部 ————————————————————

  /** 确定性采样植被候选点并按块分桶（返回 key→位置数组；避开建筑/城区/边缘） */
  private samplePositions(
    target: number,
    buildings: BuildingBox[],
    pack: ContentPack,
    margin: number,
    seedBase: number,
    scaleMin: number,
    scaleSpan: number,
    rotMax: number,
  ): Map<number, Array<{ x: number; y: number; z: number; s: number; rot: number }>> {
    const buckets = new Map<number, Array<{ x: number; y: number; z: number; s: number; rot: number }>>();
    let placed = 0;
    for (let i = 0; placed < target && i < target * SAMPLE_MULTIPLE; i++) {
      const x = hash01(i * 7 + seedBase) * MAP_SIZE;
      const z = hash01(i * 13 + seedBase + 2) * MAP_SIZE;
      if (blocked(x, z, margin, buildings, pack)) continue;
      const s = scaleMin + hash01(i * 29 + seedBase + 4) * scaleSpan;
      const rot = hash01(i * 41 + seedBase + 6) * rotMax;
      const y = terrainHeightAt(pack, x, z);
      const chunkIdx = this.chunkIndexOf(x, z);
      const bucket = buckets.get(chunkIdx);
      if (bucket) bucket.push({ x, y, z, s, rot });
      else buckets.set(chunkIdx, [{ x, y, z, s, rot }]);
      placed += 1;
    }
    return buckets;
  }

  /** 世界坐标 → 块下标（与 buildChunks 划分一致） */
  private chunkIndexOf(x: number, z: number): number {
    const n = Math.max(1, Math.ceil(MAP_SIZE / VEG_CHUNK_SIZE));
    const step = MAP_SIZE / n;
    const ix = Math.min(n - 1, Math.max(0, Math.floor(x / step)));
    const iz = Math.min(n - 1, Math.max(0, Math.floor(z / step)));
    return ix * n + iz;
  }

  /** 树块：合并树干+树冠 geometry，每块 1 个 InstancedMesh（顶点色 + instanceColor 明度变化） */
  private buildTreeChunks(buckets: Map<number, Array<{ x: number; y: number; z: number; s: number; rot: number }>>): void {
    const geo = buildTreeGeometry();
    const mat = new THREE.MeshLambertMaterial({ map: makeFoliageTexture(), vertexColors: true });
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    const tint = new THREE.Color();
    for (const [chunkIdx, items] of buckets) {
      if (items.length === 0) continue;
      const inst = new THREE.InstancedMesh(geo, mat, items.length);
      inst.userData.chunkIdx = chunkIdx;
      inst.castShadow = true;
      inst.receiveShadow = true;
      for (let k = 0; k < items.length; k++) {
        const it = items[k]!;
        e.set(0, it.rot, 0);
        q.setFromEuler(e);
        pos.set(it.x, it.y, it.z);
        scl.setScalar(it.s);
        m.compose(pos, q, scl);
        inst.setMatrixAt(k, m);
        // 明度微变（中性灰 tint，树干棕/树冠绿不被串色）
        const v = 0.85 + hash01(chunkIdx * 131 + k * 17) * 0.3;
        tint.setRGB(v, v, v);
        inst.setColorAt(k, tint);
      }
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      inst.visible = false;
      this.scene.add(inst);
      this.treeInst.push(inst);
    }
  }

  /** 草块：每块 1 个 InstancedMesh */
  private buildGrassChunks(buckets: Map<number, Array<{ x: number; y: number; z: number; s: number; rot: number }>>): void {
    const geo = buildGrassGeometry();
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    for (const [chunkIdx, items] of buckets) {
      if (items.length === 0) continue;
      const inst = new THREE.InstancedMesh(geo, mat, items.length);
      inst.userData.chunkIdx = chunkIdx;
      inst.receiveShadow = true;
      for (let k = 0; k < items.length; k++) {
        const it = items[k]!;
        e.set(0, it.rot, 0);
        q.setFromEuler(e);
        pos.set(it.x, it.y + 0.28 * it.s, it.z);
        scl.setScalar(it.s);
        m.compose(pos, q, scl);
        inst.setMatrixAt(k, m);
      }
      inst.instanceMatrix.needsUpdate = true;
      inst.visible = false;
      this.scene.add(inst);
      this.grassInst.push(inst);
    }
  }

  /** 重算块可见性并搬运到 InstancedMesh（零分配；树/草剔除半径不同，各决策一次） */
  private refreshLod(cameraX: number, cameraZ: number): void {
    updateVisibility(this.chunks, cameraX, cameraZ, treeLodRadius(MAP_SIZE, VEG_CHUNK_SIZE));
    this.visibleTreeChunks = this.applyVisibility(this.treeInst);
    updateVisibility(this.chunks, cameraX, cameraZ, grassLodRadius(MAP_SIZE, VEG_CHUNK_SIZE));
    this.visibleGrassChunks = this.applyVisibility(this.grassInst);
  }

  /** 把块可见标志搬运到该组 InstancedMesh，返回可见块数 */
  private applyVisibility(insts: THREE.InstancedMesh[]): number {
    let visible = 0;
    for (let i = 0; i < insts.length; i++) {
      const inst = insts[i]!;
      const chunk = this.chunks[inst.userData.chunkIdx as number];
      inst.visible = chunk?.visible ?? false;
      if (inst.visible) visible += 1;
    }
    return visible;
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

/** 树 geometry：树干（圆柱，棕色）+ 树冠（双层错位球，绿色）合并，顶点色承载颜色（1 draw call / 块） */
function buildTreeGeometry(): THREE.BufferGeometry {
  const trunk = new THREE.CylinderGeometry(0.22, 0.34, 2.6, 6).toNonIndexed();
  trunk.translate(0, 1.3, 0);
  const canopy = new THREE.IcosahedronGeometry(1, 1).toNonIndexed();
  canopy.scale(2.1, 2.4, 2.1);
  canopy.translate(0, 3.1, 0);

  const trunkColor = new THREE.Color(0x6b4f34);
  const canopyColor = new THREE.Color(0x3f7a2e);
  paintVertexColor(trunk, trunkColor, 1);
  paintVertexColor(canopy, canopyColor, 0.86); // 顶部提亮，形成受光层次

  const merged = mergeSimple([trunk, canopy]);
  trunk.dispose();
  canopy.dispose();
  return merged;
}

/** 为 geometry 全部顶点写入颜色（topLight: 1 = 顶部按 y 归一化提亮，模拟天光受光面） */
function paintVertexColor(geo: THREE.BufferGeometry, color: THREE.Color, topLight: number): void {
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const span = Math.max(1e-5, maxY - minY);
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const k = topLight === 1 ? 1 : 1 - topLight + topLight * ((pos.getY(i) - minY) / span);
    colors[i * 3] = color.r * k;
    colors[i * 3 + 1] = color.g * k;
    colors[i * 3 + 2] = color.b * k;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

/** 合并两个仅含 position/normal/color 的非索引 geometry（免 examples 依赖，~20 行） */
function mergeSimple(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let total = 0;
  for (const g of geos) total += (g.getAttribute('position') as THREE.BufferAttribute).count;
  const position = new Float32Array(total * 3);
  const normal = new Float32Array(total * 3);
  const color = new Float32Array(total * 3);
  let offset = 0;
  for (const g of geos) {
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    const n = g.getAttribute('normal') as THREE.BufferAttribute;
    const c = g.getAttribute('color') as THREE.BufferAttribute;
    position.set(p.array as Float32Array, offset * 3);
    normal.set(n.array as Float32Array, offset * 3);
    color.set(c.array as Float32Array, offset * 3);
    offset += p.count;
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(position, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  merged.setAttribute('color', new THREE.BufferAttribute(color, 3));
  return merged;
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
