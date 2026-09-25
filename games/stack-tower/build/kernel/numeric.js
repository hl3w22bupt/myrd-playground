/**
 * 数值唯一来源（SSOT）— 与 spec.numeric 一一对应（.myrd/spec/design-spec.json）。
 * 红线：改这里之前必须先改策划案版本（spec 升版），禁止实现侧私调。
 * 键序与 spec.numeric 导出序一致：契约 e07「数值总闸」做序列化深比（键序敏感）。
 * 验证：契约 lvl-01-stack-tower_e05 / e07 会断言本表与 spec 基线一致。
 */
export const NUMERIC = {
    DEFAULT_SEED: 20260925,
    FIXED_STEP_MS: 16,
    MAX_DT_MS: 100,
    cut_width: {
        BLOCK_BASE_WIDTH: 120,
        SWING_TRAVEL_PX: 240,
        WIDTH_FLOOR_PX: 36,
        WIDTH_FLOOR_RATIO: 0.3,
    },
    difficulty: {
        LAYERS_PER_LEVEL_BASE: 8,
        LAYERS_PER_LEVEL_GROWTH: 2,
        LEVEL_COUNT: 12,
        SWING_SPEED_BASE_PXS: 160,
        SWING_SPEED_CAP_PXS: 420,
        SWING_SPEED_GROWTH_PXS: 24,
    },
    perfect_window: {
        PERFECT_WINDOW_BASE_MS: 140,
        PERFECT_WINDOW_DECAY_MS_PER_LEVEL: 8,
        PERFECT_WINDOW_MIN_MS: 60,
    },
    scoring: {
        PERFECT_BONUS_BASE: 25,
        PERFECT_COMBO_BONUS_CAP: 75,
        PERFECT_COMBO_STEP: 5,
        PLACE_SCORE: 10,
    },
};
/** 完美判定窗口（ms）：max(140 − (level−1)×8, 60) */
export function perfectWindowMs(level) {
    const { PERFECT_WINDOW_BASE_MS, PERFECT_WINDOW_DECAY_MS_PER_LEVEL, PERFECT_WINDOW_MIN_MS } = NUMERIC.perfect_window;
    return Math.max(PERFECT_WINDOW_BASE_MS - (level - 1) * PERFECT_WINDOW_DECAY_MS_PER_LEVEL, PERFECT_WINDOW_MIN_MS);
}
/** 摆动速度（px/s）：min(160 + (level−1)×24, 420) */
export function swingSpeed(level) {
    const { SWING_SPEED_BASE_PXS, SWING_SPEED_GROWTH_PXS, SWING_SPEED_CAP_PXS } = NUMERIC.difficulty;
    return Math.min(SWING_SPEED_BASE_PXS + (level - 1) * SWING_SPEED_GROWTH_PXS, SWING_SPEED_CAP_PXS);
}
/** 本关层目标：8 + (level−1)×2 */
export function targetLayers(level) {
    const { LAYERS_PER_LEVEL_BASE, LAYERS_PER_LEVEL_GROWTH } = NUMERIC.difficulty;
    return LAYERS_PER_LEVEL_BASE + (level - 1) * LAYERS_PER_LEVEL_GROWTH;
}
/** 完美判定距离阈值（px）：speed × window / 1000（L1 = 160×140/1000 = 22.4） */
export function perfectDistance(level) {
    return (swingSpeed(level) * perfectWindowMs(level)) / 1000;
}
/** tower-ripple 表现时长：名义 300ms，合法区间 [250,350]（spec.content.towerRipple） */
export const RIPPLE_DURATION = { NOMINAL_MS: 300, TOLERANCE_MS: 50, MIN_MS: 250, MAX_MS: 350 };
