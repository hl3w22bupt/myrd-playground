// level-01-deck.js — 关卡 lvl-01-deck 的布局数据（spec.levels[0] 的落点）。
// 元素编号 = `<level.id>/<element.id>`，与 spec.levels[].elements 一一对应（关卡编辑页编号化的数据源）。
// 内核只消费几何字段（bounds / covers / spawns）；表现层读同一份数据拼装网格 —— 逻辑与表现共享布局真源。

export const LEVEL_ID = "lvl-01-deck";

/** 甲板可行走区域（船体主甲板，米）。x=左右舷，z=舰首(-)→舰尾(+)*/
export const DECK_BOUNDS = { minX: -9, maxX: 9, minZ: -30, maxZ: 30 };

/** 玩家出生点（元素 lvl-01-deck/player-start）。yaw 口径与内核一致：0=+z（舰尾），π=-z（舰桥）*/
export const PLAYER_START = { x: 0, z: 8, yaw: Math.PI }; // 面向舰桥（-z）

/** 敌兵出生点（三处，轮转使用；与 spec 声明的 spawn-north/east/west 对应）。
 *  注意：出生点必须在掩体盒外（否则出生即被遮挡，永不可命中）。*/
export const ENEMY_SPAWNS = [
  { id: "lvl-01-deck/spawn-north", x: 0, z: -21.5 },
  { id: "lvl-01-deck/spawn-east", x: 6.6, z: -1 },
  { "id": "lvl-01-deck/spawn-west", x: -6.6, z: -6 },
];

/**
 * 掩体（轴对齐盒）。内核用于视线遮挡与移动阻挡；表现层按同一数据建集装箱/舰桥体块。
 * height 单位米（掩体视为通高遮挡，不做人眼高低差判定 —— 原型口径）。
 *
 * 编号口径（与 spec.levels[0].elements 双向一致）：`id` 只允许 spec 已声明的元素编号；
 * 同一元素由多个体块组成时（集装箱群 A/B），第二个及之后的体块只带 `group` 指回元素编号，
 * 不另造 spec 未声明的编号 —— 表现层按 group 取贴图/配色，内核只读几何字段。
 */
export const COVERS = [
  // 舰桥（lvl-01-deck/bridge）—— 层叠舱室，占舰首端
  { id: "lvl-01-deck/bridge", group: "lvl-01-deck/bridge", minX: -8, maxX: 8, minZ: -30, maxZ: -24, height: 9 },
  // 集装箱群 A（军绿，lvl-01-deck/container-a）：两个体块同属一个元素
  { id: "lvl-01-deck/container-a", group: "lvl-01-deck/container-a", minX: -8.6, maxX: -3.4, minZ: -14, maxZ: -8, height: 2.9 },
  { group: "lvl-01-deck/container-a", minX: -8.6, maxX: -3.4, minZ: -4, maxZ: 2, height: 2.9 },
  // 集装箱群 B（土黄，lvl-01-deck/container-b）—— 与 A 错位成通道
  { id: "lvl-01-deck/container-b", group: "lvl-01-deck/container-b", minX: 3.4, maxX: 8.6, minZ: -10, maxZ: -4, height: 2.9 },
  { group: "lvl-01-deck/container-b", minX: 3.4, maxX: 8.6, minZ: 2, maxZ: 8, height: 2.9 },
];

/** 纯地标（无碰撞，仅供表现层构图）：停机坪 / 吊臂 / 围栏 */
export const LANDMARKS = [
  { id: "lvl-01-deck/helipad", kind: "helipad", x: 0, z: 22, radius: 5 },
  { id: "lvl-01-deck/crane", kind: "crane", x: 9, z: 12, height: 12 },
  { id: "lvl-01-deck/railing", kind: "railing" },
  { id: "lvl-01-deck/sea", kind: "sea" },
];

/** 围栏内缩：内核把玩家钳制在 bounds 内（railing 的机判形态）*/
export function clampToDeck(x, z, radius) {
  return {
    x: Math.min(DECK_BOUNDS.maxX - radius, Math.max(DECK_BOUNDS.minX + radius, x)),
    z: Math.min(DECK_BOUNDS.maxZ - radius, Math.max(DECK_BOUNDS.minZ + radius, z)),
  };
}

/** 关卡元素编号表（= spec.levels[0].elements，qa-audit 断言双向集合相等；群内体块只计一次）*/
export const ELEMENT_IDS = [
  ...new Set([
    ...COVERS.map((c) => c.id).filter(Boolean),
    ...LANDMARKS.map((l) => l.id),
    ...ENEMY_SPAWNS.map((s) => s.id),
    "lvl-01-deck/player-start",
  ]),
];
