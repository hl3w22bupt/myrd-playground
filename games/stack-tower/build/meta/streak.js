/** 应用一局结果：win → +1（best 同步）；lose → 清零；返回更新后的 streak 段（纯函数，不写存储） */
export function applyMatchResult(save, outcome) {
    if (outcome === 'level-clear') {
        save.streak.current += 1;
        if (save.streak.current > save.streak.best)
            save.streak.best = save.streak.current;
    }
    else {
        save.streak.current = 0;
    }
    return { ...save.streak };
}
/** 徽章视图（纯函数，契约直接断言） */
export function streakBadgeView(save) {
    return { visible: save.streak.current > 0, count: save.streak.current, best: save.streak.best };
}
