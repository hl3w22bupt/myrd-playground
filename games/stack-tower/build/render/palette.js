/**
 * 色板出口（v1.2 换装「霓虹夜塔」）— 兼容层：色值唯一真源已迁至 theme.ts（e-theme-constants，
 * acc-t1 单一常量源契约），本文件仅做具名再导出，供既有渲染调用点（renderer/backdrop/textures）平滑换源。
 * 禁止在本文件新增任何字面量色值；新增常量一律落 theme.ts。
 */
import { NEON, BLOCK_NEON_CYCLE } from './theme.js';
/** 8 色板（旧口径命名 → 霓虹夜塔映射；真源 theme.NEON） */
export const PALETTE = {
    /** 1 夜空渐变顶（旧：暮蓝深） */
    SKY_TOP: NEON.NIGHT_SKY_TOP,
    /** 2 夜空渐变底（旧：暮蓝浅） */
    SKY_BOTTOM: NEON.NIGHT_SKY_BOTTOM,
    /** 3 塔块主色 A（霓虹 01 青蓝） */
    BLOCK_A: NEON.BLOCK_NEON_01,
    /** 4 塔块主色 B（霓虹 02 品红） */
    BLOCK_B: NEON.BLOCK_NEON_02,
    /** 5 塔块主色 C（霓虹 03 琥珀） */
    BLOCK_C: NEON.BLOCK_NEON_03,
    /** 6 切面高亮（霓虹白，发光填充无描边） */
    FACE_HIGHLIGHT: NEON.CUT_FACE,
    /** 7 夜色地平线 */
    HORIZON: NEON.HORIZON,
    /** 8 失败黑（霓虹熄灭态） */
    DEBRIS: NEON.DEBRIS,
};
/** 塔块霓虹六色循环（v1.2：3 色升 6 色，a09..a14 同源；导出改名 BLOCK_NEON_CYCLE，旧名保留别名） */
export const BLOCK_CYCLE = BLOCK_NEON_CYCLE;
export { BLOCK_NEON_CYCLE };
/** 塔身自上而下每层明度 −2%，下限 0.55（层递减读数感保留；霓虹自发光体光照差见 theme.LIGHT） */
export const LAYER_SHADE_STEP = 0.02;
export const LAYER_SHADE_MIN = 0.55;
/** 层序取色（已落块按层六色循环；摆动块用首色提亮） */
export function blockColor(yIndex) {
    return BLOCK_CYCLE[yIndex % BLOCK_CYCLE.length];
}
/** hex → rgb 明度系数缩放（程序化，无外部依赖） */
export function shade(hex, factor) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.round(((n >> 16) & 255) * factor);
    const g = Math.round(((n >> 8) & 255) * factor);
    const b = Math.round((n & 255) * factor);
    return `rgb(${r},${g},${b})`;
}
/** 层明度：max(MIN, 1 − yIndex×STEP) */
export function layerShade(yIndex) {
    return Math.max(LAYER_SHADE_MIN, 1 - yIndex * LAYER_SHADE_STEP);
}
