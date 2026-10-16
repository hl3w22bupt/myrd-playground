/**
 * 连胜展示（实体 e-meta-streak，spec v1.4 acc-b4）。
 *
 * 口径（acceptance 原文）：
 *  - 达成 targetLayers(level) 即连胜 +1；game-over（keepWidth<36）连胜清零；
 *  - 重开（restart）不清零（连胜跨局累计）；
 *  - HUD 徽章显示当前连胜数，零连胜不渲染（零占位）；
 *  - 持久于 st.meta.save.v2。
 */
import type { MetaSaveV2 } from './save.js';

/** 一局结果（由装配根从内核状态翻译，meta 层不 import 内核） */
export type MatchOutcome = 'level-clear' | 'game-over';

/** 应用一局结果：win → +1（best 同步）；lose → 清零；返回更新后的 streak 段（纯函数，不写存储） */
export function applyMatchResult(save: MetaSaveV2, outcome: MatchOutcome): MetaSaveV2['streak'] {
  if (outcome === 'level-clear') {
    save.streak.current += 1;
    if (save.streak.current > save.streak.best) save.streak.best = save.streak.current;
  } else {
    save.streak.current = 0;
  }
  return { ...save.streak };
}

/** 徽章视图模型：visible=false 时渲染层零占位 */
export interface StreakBadgeView {
  visible: boolean;
  count: number;
  best: number;
}

/** 徽章视图（纯函数，契约直接断言） */
export function streakBadgeView(save: MetaSaveV2): StreakBadgeView {
  return { visible: save.streak.current > 0, count: save.streak.current, best: save.streak.best };
}
