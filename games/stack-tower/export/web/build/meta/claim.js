/**
 * 领取当日挑战奖励：
 *  流程 = 查重（claimedDates 含当日 → 拒绝）→ 内存记账（claimedDates + lastDate）→ persist 落盘；
 *  persist 抛错 → 回滚内存记账 → 异常上抛（调用方隔离），重启后仍可领取（且仅一次）。
 */
export function claimDailyReward(save, challengeDate, persist) {
    if (save.daily.claimedDates.includes(challengeDate)) {
        return { granted: false };
    }
    save.daily.claimedDates.push(challengeDate);
    save.daily.lastDate = challengeDate;
    const reward = { challengeDate, kind: 'icon-badge', amount: 1 };
    try {
        persist(save);
    }
    catch (e) {
        // 崩溃点：落盘失败 → 回滚内存（无半发状态），上抛由调用方隔离
        save.daily.claimedDates = save.daily.claimedDates.filter((d) => d !== challengeDate);
        save.daily.lastDate = save.daily.claimedDates.length > 0 ? save.daily.claimedDates[save.daily.claimedDates.length - 1] : null;
        throw e;
    }
    return { granted: true, reward };
}
