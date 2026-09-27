/**
 * 塔身栈（实体 e-tower-stack）— 已落块有序栈。
 * 塔基块：宽度=BLOCK_BASE_WIDTH，中心 x=画布逻辑宽中点（平台约定逻辑画布 480×720）。
 * 内核坐标即逻辑坐标；本模块零 DOM。
 */
import { NUMERIC } from './numeric.js';
import type { PlacedBlock } from './types.js';

/** 画布逻辑宽（平台约定，tech-plan §2）；塔基中心 x = 240 */
export const LOGICAL_WIDTH = 480;
/** 画布逻辑高（平台约定） */
export const LOGICAL_HEIGHT = 720;

/** 塔基块：seed 无关（宽度/位置固定，静止） */
export function createBaseBlock(): PlacedBlock {
  return {
    x: LOGICAL_WIDTH / 2,
    width: NUMERIC.cut_width.BLOCK_BASE_WIDTH,
    yIndex: 0,
  };
}

/**
 * 开局初始摆位（spec v1.2 e09-opening-stack）：塔基块之上预置 3–5 块。
 * 参数唯一来源 = numeric.opening（STACK_MIN_BLOCKS / STACK_MAX_BLOCKS / STACK_WIDTH_JITTER_PX）；
 * 块数与横向错位由 seeded RNG 决定 → 同 seed 逐字节可复现；
 * 块宽恒为 BLOCK_BASE_WIDTH（不触碰切割/宽度下限域），yIndex 连续堆叠。
 */
export function buildOpeningStack(rng: ReturnType<typeof import('./rng.js').createRng>): PlacedBlock[] {
  const { STACK_MIN_BLOCKS, STACK_MAX_BLOCKS, STACK_WIDTH_JITTER_PX } = NUMERIC.opening;
  const span = STACK_MAX_BLOCKS - STACK_MIN_BLOCKS + 1;
  const count = STACK_MIN_BLOCKS + Math.floor(rng.next() * span);
  const stack: PlacedBlock[] = [];
  for (let i = 0; i < count; i++) {
    const jitter = (rng.next() * 2 - 1) * STACK_WIDTH_JITTER_PX;
    stack.push({
      x: LOGICAL_WIDTH / 2 + jitter,
      width: NUMERIC.cut_width.BLOCK_BASE_WIDTH,
      yIndex: i + 1,
    });
  }
  return stack;
}

/** 塔顶参照块（切割/判定的对齐基准） */
export function topOf(tower: PlacedBlock[]): PlacedBlock {
  const top = tower[tower.length - 1];
  if (!top) throw new Error('塔身为空：塔基块缺失（非法状态）');
  return top;
}

/** 压入已落块（返回新数组长度=层数+塔基） */
export function pushBlock(tower: PlacedBlock[], block: PlacedBlock): void {
  tower.push(block);
}

/** 已落块层数（不含塔基与开局初始摆位，只数玩家落块）：spec content.targetLayers 的累计口径（v1.2 e09） */
export function layerCount(tower: PlacedBlock[], openingCount = 0): number {
  return Math.max(0, tower.length - 1 - openingCount);
}

/** keepWidth 下限校验：keepWidth < WIDTH_FLOOR_PX → 不可玩（game-over 域） */
export function isBelowFloor(keepWidth: number): boolean {
  return keepWidth < NUMERIC.cut_width.WIDTH_FLOOR_PX;
}
