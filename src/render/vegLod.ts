/**
 * render/vegLod —— 植被分块 LOD 纯逻辑（零 three 依赖，Node 可直接断言）。
 *
 * 问题：1.6km 地图上数百树 / 上千草丛常驻提交（此前为全量 InstancedMesh），远处植被在雾中
 * 已不可辨却仍占 GPU。方案：把植被实例按 VEG_CHUNK_SIZE 网格分块，逐块以「块中心到相机水平
 * 距离 ≤ LOD 距离」决定 visible 开关——GPU 只绘制相机附近的块，draw call 数量随视距自适应。
 *
 * 本模块只产出/复算数据（块中心、可见标志），不持有 three 对象：由 PropsLayer 把标志搬运到
 * InstancedMesh.visible。全部缓冲预分配复用，运行期零分配。
 */

import { GRASS_LOD_DISTANCE, TREE_LOD_DISTANCE } from '../content/render';

/** 一个植被块（纯数据，无 three 对象） */
export interface VegChunk {
  /** 块中心世界坐标（m） */
  cx: number;
  cz: number;
  /** 可见标志（由 updateVisibility 写入，渲染层搬运到 InstancedMesh.visible） */
  visible: boolean;
}

/** 块网格划分数：1600m / 160m = 10 × 10 = 100 块 */
export function chunkGridCount(mapSize: number, chunkSize: number): number {
  return Math.max(1, Math.ceil(mapSize / chunkSize));
}

/** 划分全部块中心（构造时一次；返回扁平数组，行优先：x 外层 / z 内层） */
export function buildChunks(mapSize: number, chunkSize: number): VegChunk[] {
  const n = chunkGridCount(mapSize, chunkSize);
  const step = mapSize / n;
  const chunks: VegChunk[] = [];
  for (let ix = 0; ix < n; ix++) {
    for (let iz = 0; iz < n; iz++) {
      chunks.push({ cx: ix * step + step / 2, cz: iz * step + step / 2, visible: true });
    }
  }
  return chunks;
}

/**
 * 重算块可见性：块中心与相机水平距离 ≤ 半径（LOD 距离 + 块外接半径）即可见。
 * 返回可见块数（供调试 HUD / 基准断言）。写入传入数组，零分配。
 */
export function updateVisibility(
  chunks: VegChunk[],
  cameraX: number,
  cameraZ: number,
  radius: number,
): number {
  // 块外接半径：对角线一半 + 少量余量，保证相机在块边缘时本块不闪烁消失
  let visible = 0;
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i]!;
    const dx = c.cx - cameraX;
    const dz = c.cz - cameraZ;
    c.visible = dx * dx + dz * dz <= radius * radius;
    if (c.visible) visible += 1;
  }
  return visible;
}

/** 树块的剔除半径（LOD 距离 + 块外接半径） */
export function treeLodRadius(mapSize: number, chunkSize: number): number {
  return TREE_LOD_DISTANCE + chunkBoundRadius(mapSize, chunkSize);
}

/** 草块的剔除半径（LOD 距离 + 块外接半径） */
export function grassLodRadius(mapSize: number, chunkSize: number): number {
  return GRASS_LOD_DISTANCE + chunkBoundRadius(mapSize, chunkSize);
}

/** 块外接半径（对角线一半 + 余量） */
export function chunkBoundRadius(mapSize: number, chunkSize: number): number {
  const step = mapSize / chunkGridCount(mapSize, chunkSize);
  return (step * Math.SQRT2) / 2 + 8;
}
