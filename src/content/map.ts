/**
 * content/map —— 程序化地图参数（1.6km² 高度场 + 城区/野区 + AABB 建筑占位）
 */

export interface UrbanAreaDef {
  x: number;
  z: number;
  /** 城区半径（m） */
  radius: number;
  name: string;
}

export interface BuildingGenConfig {
  /** 城区内建筑数量 */
  urbanCount: number;
  /** 野区零散建筑数量 */
  wildCount: number;
  /** 建筑边长范围（m） */
  minSize: number;
  maxSize: number;
  /** 建筑高度范围（m） */
  minHeight: number;
  maxHeight: number;
}

export interface MapConfig {
  /** 城区中心点（对局内固定，配合 zone centerDrift 使用） */
  urbanAreas: UrbanAreaDef[];
  buildings: BuildingGenConfig;
  /** 地形起伏幅度（m） */
  terrainAmplitude: number;
  /** 建筑最小间距（m），避免重叠 */
  buildingSpacing: number;
}

export const MAP: MapConfig = {
  urbanAreas: [
    { x: 420, z: 430, radius: 190, name: 'P城' },
    { x: 1180, z: 520, radius: 170, name: '军事基地' },
    { x: 760, z: 1180, radius: 200, name: 'Y城' },
  ],
  buildings: {
    urbanCount: 26,
    wildCount: 22,
    minSize: 10,
    maxSize: 26,
    minHeight: 8,
    maxHeight: 22,
  },
  terrainAmplitude: 26,
  buildingSpacing: 16,
};
