/**
 * content/constants —— 全局常量配置表（AC 数值唯一来源之一，禁止在 core/render 中硬编码同类数值）
 */

/** 逻辑 tick 时长（ms），50Hz —— 架构 ADR-003 */
export const TICK_MS = 20;
export const TICK_HZ = 1000 / TICK_MS;

/** 每帧最多追赶 tick 数，超过则丢弃积压（防死亡螺旋） */
export const MAX_CATCH_UP_TICKS = 3;

/** 地图尺度 1.6km × 1.6km */
export const MAP_SIZE = 1600;
export const MAP_HALF = MAP_SIZE / 2;

/** AC2 落点容差：地图尺度的 5% = 80m */
export const LANDING_TOLERANCE_M = MAP_SIZE * 0.05;

/** 对局规模：玩家 1 + AI ≥10，实体上限 20 */
export const ENTITY_CAP = 20;
export const AI_COUNT_DEFAULT = 12;

/** 背包格子容量上限 */
export const INVENTORY_GRIDS = 20;

/** 拾取交互半径（m） */
export const PICKUP_RADIUS_M = 3;

/** 生命值 */
export const MAX_HP = 100;

/** 命中部位伤害倍率 */
export const PART_MULTIPLIERS = { head: 2.5, torso: 1.0, limb: 0.75 } as const;
export type BodyPartId = keyof typeof PART_MULTIPLIERS;

/** 目标包围盒（站立姿态）：半宽 0.4m，总高 1.8m */
export const TARGET_HALF_WIDTH = 0.4;
export const TARGET_HEIGHT = 1.8;

/** 眼部高度（射击射线起点） */
export const EYE_HEIGHT = 1.62;

/** 单局最长逻辑时长（ms），AC1 要求 ≤10 分钟自然结束 */
export const MAX_MATCH_MS = 600_000;
