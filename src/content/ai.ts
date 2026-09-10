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
  /** 脱离交火撤退：hp < maxHp × 该值且近期受击时停止交火并后撤（玩法缺口补齐项） */
  retreatHpRatio: number;
  /** 受击后进入撤退判定的事件窗（ms） */
  retreatRecentDamageMs: number;
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
  retreatHpRatio: 0.45,
  retreatRecentDamageMs: 5000,
};

/** AI 行为人格（行为多样化，玩法缺口补齐项）：所有数值均为对 AI 全局参数的乘数，避免第二套魔数 */
export type AiPersonaId = 'assault' | 'sniper' | 'skirmisher' | 'looter';

export interface AiPersonaDef {
  id: AiPersonaId;
  name: string;
  /** 分配权重（initAi 按权重从 rng.ai 抽取，确定性） */
  weight: number;
  /** 视野半径乘数 */
  visionMul: number;
  /** 交火距离乘数 */
  fireRangeMul: number;
  /** 开火反应时间乘数 */
  reactionMsMul: number;
  /** 瞄准误差乘数（越大越不准） */
  aimErrMul: number;
  /** 拾取搜索半径乘数 */
  lootRangeMul: number;
}

export const AI_PERSONALITIES: Record<AiPersonaId, AiPersonaDef> = {
  assault: {
    id: 'assault', name: '突击手', weight: 4,
    visionMul: 1.0, fireRangeMul: 1.0, reactionMsMul: 0.8, aimErrMul: 1.0,
    lootRangeMul: 0.9,
  },
  sniper: {
    id: 'sniper', name: '狙击手', weight: 2,
    visionMul: 1.6, fireRangeMul: 2.0, reactionMsMul: 1.6, aimErrMul: 0.7,
    lootRangeMul: 0.8,
  },
  skirmisher: {
    id: 'skirmisher', name: '游击兵', weight: 3,
    visionMul: 1.1, fireRangeMul: 0.7, reactionMsMul: 0.6, aimErrMul: 1.25,
    lootRangeMul: 1.0,
  },
  looter: {
    id: 'looter', name: '搜刮者', weight: 3,
    visionMul: 0.8, fireRangeMul: 0.6, reactionMsMul: 1.4, aimErrMul: 1.1,
    lootRangeMul: 1.6,
  },
};

/** AI 低血治疗阈值（无可见敌人且 hp 低于 maxHp × 该值时使用医疗包） */
export const AI_HEAL_HP_RATIO = 0.7;
