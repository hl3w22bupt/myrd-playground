/**
 * 色板（资产 a01-block-palette，generator: procedural:constant-table）。
 * 唯一真源 = games/stack-tower/docs/moodboard-stack-tower.md §二（8 色板）；
 * 改色先改情绪板再动这里；不得在渲染代码里另设色值。
 */
/** 8 色板（与情绪板逐条对应） */
export const PALETTE = {
    /** 1 暮蓝深：天空渐变顶 */
    SKY_TOP: '#2b3a4d',
    /** 2 暮蓝浅：天空渐变底 / 反弹光 */
    SKY_BOTTOM: '#8a97a8',
    /** 3 陶土橙：塔块主色 A */
    BLOCK_A: '#c96f3b',
    /** 4 砖红：塔块主色 B */
    BLOCK_B: '#a84a32',
    /** 5 沙黄：塔块主色 C */
    BLOCK_C: '#d9a441',
    /** 6 切面白：判定物描边（唯一纯白，唯一高亮） */
    FACE_HIGHLIGHT: 'rgba(255,255,255,0.85)',
    /** 7 暮色线：地平线 1px（α0.4） */
    HORIZON: '#a08c6a',
    /** 8 失败黑：掉落碎块（离开可玩域） */
    DEBRIS: 'rgba(0,0,0,0.25)',
};
/** 塔块暖色三循环（层序读数，不表意好坏） */
export const BLOCK_CYCLE = [PALETTE.BLOCK_A, PALETTE.BLOCK_B, PALETTE.BLOCK_C];
/** 塔身自上而下每层明度 −2%，下限 0.55（风格卡 §1 层递减） */
export const LAYER_SHADE_STEP = 0.02;
export const LAYER_SHADE_MIN = 0.55;
/** 层序取色（已落块按层循环；摆动块用首色提亮） */
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
