/**
 * content/ai —— AI 行为参数（AC5：巡图/拾取/索敌/开火/避毒，FSM + 分帧决策）
 * AI 行为多样化线：人格（aggressive/balanced/cautious）驱动交火距离、撤退、治疗与抢空投倾向。
 */

export type AiPersonality = 'aggressive' | 'balanced' | 'cautious';

export interface AiPersonalityDef {
  /** 交火距离倍率（乘 fireRange） */
  fireRangeMul: number;
  /** 血量低于该值且可见敌人时撤退（cautious 核心行为；0 = 从不撤退） */
  retreatBelowHp: number;
  /** 无敌人可见且血量低于该值时使用医疗物资 */
  healBelowHp: number;
  /** 是否主动奔向空投 */
  seekAirdrop: boolean;
  /** 交火时是否边打边压近目标（aggressive 核心行为） */
  pushWhileFiring: boolean;
}

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
  /** 人格权重（initAi 按 rng.ai 抽选） */
  personalityWeights: Array<{ personality: AiPersonality; weight: number }>;
  /** 人格行为参数 */
  personalities: Record<AiPersonality, AiPersonalityDef>;
  /** 空投奔袭搜索半径（m，仅 seekAirdrop 人格） */
  airdropSeekRange: number;
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
  personalityWeights: [
    { personality: 'aggressive', weight: 35 },
    { personality: 'balanced', weight: 40 },
    { personality: 'cautious', weight: 25 },
  ],
  personalities: {
    aggressive: {
      fireRangeMul: 1.15,
      retreatBelowHp: 0,
      healBelowHp: 45,
      seekAirdrop: true,
      pushWhileFiring: true,
    },
    balanced: {
      fireRangeMul: 1,
      retreatBelowHp: 0,
      healBelowHp: 60,
      seekAirdrop: true,
      pushWhileFiring: false,
    },
    cautious: {
      fireRangeMul: 0.85,
      retreatBelowHp: 45,
      healBelowHp: 75,
      seekAirdrop: false,
      pushWhileFiring: false,
    },
  },
  airdropSeekRange: 320,
};
