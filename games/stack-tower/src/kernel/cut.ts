/**
 * 切面切割（实体 e-cut-system）。
 * 公式（spec.content.formulas）：
 *  - keepWidth = width − |offset|；|offset| ≥ width → 整块掉落（不加分、不升层）；
 *  - keepWidth < WIDTH_FLOOR_PX(36) → game-over；
 *  - perfect（见 judge.ts）→ 宽度不减。
 * 掉落碎块只记录初始姿态（DebrisSpec），动画归表现层。
 */
import { isBelowFloor } from './tower.js';
import { judgeDrop } from './judge.js';
import type { DebrisSpec, PlacedBlock } from './types.js';

export type CutOutcome = 'perfect' | 'cut' | 'miss';

export interface CutResult {
  outcome: CutOutcome;
  /** 落块成功时的新塔顶（miss 时缺省） */
  placed?: PlacedBlock;
  /** 本次切割产生的碎块（perfect 时缺省） */
  debris?: DebrisSpec;
  /** game-over 归因（miss 时必有；当前 spec 公式 keepWidth<36 统一归因 width-floor） */
  failReason?: 'width-floor';
}

/**
 * @param top      塔顶已落块（对齐基准）
 * @param movingX  摆动块中心 x（drop 意图生效瞬间的位置，本 tick 不再推进）
 */
export function resolveCut(top: PlacedBlock, movingX: number, level: number): CutResult {
  const offset = movingX - top.x;
  const { perfect } = judgeDrop(offset, level);

  if (perfect) {
    return {
      outcome: 'perfect',
      placed: { x: top.x, width: top.width, yIndex: top.yIndex + 1 },
    };
  }

  const absOffset = Math.abs(offset);
  const keepWidth = top.width - absOffset;

  // 不可玩域：keepWidth < WIDTH_FLOOR_PX（含整块掉落 keepWidth≤0，其为本规则的子域，
  // 见契约 e04 文件头注明「两契约不重叠」）。归因统一 width-floor（spec 单一失败公式）。
  if (isBelowFloor(keepWidth)) {
    return {
      outcome: 'miss',
      debris: { x: movingX, width: top.width, yIndex: top.yIndex + 1, dir: offset >= 0 ? 1 : -1 },
      failReason: 'width-floor',
    };
  }

  // 正常切割：保留段 = 摆块与塔顶的交集（中心 = top.x + offset/2），切掉段带符号外抛
  const dir: 1 | -1 = offset >= 0 ? 1 : -1;
  return {
    outcome: 'cut',
    placed: { x: top.x + offset / 2, width: keepWidth, yIndex: top.yIndex + 1 },
    debris: { x: movingX + dir * (keepWidth / 2), width: absOffset, yIndex: top.yIndex + 1, dir },
  };
}
