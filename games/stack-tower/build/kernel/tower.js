/**
 * 塔身栈（实体 e-tower-stack）— 已落块有序栈。
 * 塔基块：宽度=BLOCK_BASE_WIDTH，中心 x=画布逻辑宽中点（平台约定逻辑画布 480×720）。
 * 内核坐标即逻辑坐标；本模块零 DOM。
 */
import { NUMERIC } from './numeric.js';
/** 画布逻辑宽（平台约定，tech-plan §2）；塔基中心 x = 240 */
export const LOGICAL_WIDTH = 480;
/** 画布逻辑高（平台约定） */
export const LOGICAL_HEIGHT = 720;
/** 塔基块：seed 无关（宽度/位置固定，静止） */
export function createBaseBlock() {
    return {
        x: LOGICAL_WIDTH / 2,
        width: NUMERIC.cut_width.BLOCK_BASE_WIDTH,
        yIndex: 0,
    };
}
/** 塔顶参照块（切割/判定的对齐基准） */
export function topOf(tower) {
    const top = tower[tower.length - 1];
    if (!top)
        throw new Error('塔身为空：塔基块缺失（非法状态）');
    return top;
}
/** 压入已落块（返回新数组长度=层数+塔基） */
export function pushBlock(tower, block) {
    tower.push(block);
}
/** 已落块层数（不含塔基）：spec content.targetLayers 的累计口径 */
export function layerCount(tower) {
    return Math.max(0, tower.length - 1);
}
/** keepWidth 下限校验：keepWidth < WIDTH_FLOOR_PX → 不可玩（game-over 域） */
export function isBelowFloor(keepWidth) {
    return keepWidth < NUMERIC.cut_width.WIDTH_FLOOR_PX;
}
