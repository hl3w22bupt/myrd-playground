/**
 * render/lod —— 实体 LOD（细节级别）判定（画面升级步）。
 *
 * 策略：按「实体与玩家的距离」三级降细节，配合实例合批（entityPool）实现——
 * LOD 切换不增删对象、不换 draw call 数，只决定哪些部件实例矩阵被写入（其余零缩放隐藏），
 * 因此切换零分配、零 draw call 抖动，只降低远处的顶点/片元负载。
 *
 * 级别：
 *   0 = FULL（躯干 + 头 + 枪，近景）
 *   1 = MEDIUM（躯干 + 头，中景；枪为细长小盒，远处不可辨）
 *   2 = MINIMAL（仅躯干，远景）
 *
 * 纯函数 + 零分配：每实体每帧一次距离比较，阈值来自 content/render 配置表。
 */

import type { LodParams } from './quality';

export const ENTITY_DETAIL_FULL = 0;
export const ENTITY_DETAIL_MEDIUM = 1;
export const ENTITY_DETAIL_MINIMAL = 2;

export type EntityDetail = 0 | 1 | 2;

/** LOD 判定（dist 为与玩家距离，m）。禁用时恒为完整细节（画面不因 LOD 而降级） */
export function pickEntityDetail(dist: number, params: LodParams): EntityDetail {
  if (!params.enabled) return ENTITY_DETAIL_FULL;
  if (dist < params.nearDist) return ENTITY_DETAIL_FULL;
  if (dist < params.midDist) return ENTITY_DETAIL_MEDIUM;
  return ENTITY_DETAIL_MINIMAL;
}

/**
 * LOD 降级是否影响某部件（部件下标：0=躯干 1=头 2=枪）。
 * MINIMAL 只保留躯干；MEDIUM 保留躯干+头；FULL 全保留。
 */
export function partVisibleAtDetail(partIndex: number, detail: EntityDetail): boolean {
  if (detail >= ENTITY_DETAIL_MINIMAL) return partIndex <= 0;
  if (detail === ENTITY_DETAIL_MEDIUM) return partIndex <= 1;
  return true;
}
