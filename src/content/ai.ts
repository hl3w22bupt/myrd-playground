/**
 * content/ai —— AI 行为参数（AC5：巡图/拾取/索敌/开火/避毒，FSM + 分帧决策）
 */

export interface AiConfig {
  /** 决策分帧：每 N 个 tick 轮转一个决策片（ADR-006） */
  decisionEveryTicks: number;
  /** 视野半径（m） */
  visionRange: number;
  /** 开火反应时间（ms，首次索敌到开火） */
  reactionMs: number;
  /** AI 散布放大系数（命中率手感，>1 弱于玩家） */
  spreadMultiplier: number;
  /** 交火距离上限（m） */
  fireRange: number;
  /** 拾取搜索半径（m） */
  lootSearchRange: number;
  /** 开始避毒的圈半径比例（距圈心 > radius × 该值即向圈心移动） */
  fleeZoneRatio: number;
  /** 跳伞窗口：登机后 [min, max] 秒内跳伞 */
  jumpWindowSec: [number, number];
  /** 巡逻点到达距离（m） */
  waypointReachDist: number;
}

export const AI: AiConfig = {
  decisionEveryTicks: 4,
  visionRange: 170,
  reactionMs: 650,
  spreadMultiplier: 1.7,
  fireRange: 140,
  lootSearchRange: 180,
  fleeZoneRatio: 0.82,
  jumpWindowSec: [12, 42],
  waypointReachDist: 8,
};
