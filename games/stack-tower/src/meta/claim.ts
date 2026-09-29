/**
 * 挑战奖励幂等领取（实体 e-meta-claim，spec v1.4 acc-b7）。
 *
 * 契约：
 *  - 幂等：同挑战日重复领取只发一次（claimedDates 旗标与发奖同事务序）；
 *  - 崩溃注入：persist 抛错（可注入崩溃点）→ 内存状态回滚 → 重启后允许重领且仅一次；
 *  - 跨日隔离：昨日 claimed 不影响今日首次领取（按日期键隔离）。
 */
import type { MetaSaveV2 } from './save.js';

/** 持久化注入点（崩溃测试在此抛错；装配根传真实 saveMetaSave） */
export type PersistFn = (save: MetaSaveV2) => void;

/** 奖励描述（meta 层只记账，不实现具体发放通道） */
export interface RewardGrant {
  challengeDate: string;
  kind: 'icon-badge' | 'none';
  amount: number;
}

export interface ClaimResult {
  /** true = 本次实际发放；false = 当日已领取（幂等拒绝） */
  granted: boolean;
  reward?: RewardGrant;
}

/**
 * 领取当日挑战奖励：
 *  流程 = 查重（claimedDates 含当日 → 拒绝）→ 内存记账（claimedDates + lastDate）→ persist 落盘；
 *  persist 抛错 → 回滚内存记账 → 异常上抛（调用方隔离），重启后仍可领取（且仅一次）。
 */
export function claimDailyReward(save: MetaSaveV2, challengeDate: string, persist: PersistFn): ClaimResult {
  if (save.daily.claimedDates.includes(challengeDate)) {
    return { granted: false };
  }
  save.daily.claimedDates.push(challengeDate);
  save.daily.lastDate = challengeDate;
  const reward: RewardGrant = { challengeDate, kind: 'icon-badge', amount: 1 };
  try {
    persist(save);
  } catch (e) {
    // 崩溃点：落盘失败 → 回滚内存（无半发状态），上抛由调用方隔离
    save.daily.claimedDates = save.daily.claimedDates.filter((d) => d !== challengeDate);
    save.daily.lastDate = save.daily.claimedDates.length > 0 ? save.daily.claimedDates[save.daily.claimedDates.length - 1]! : null;
    throw e;
  }
  return { granted: true, reward };
}
