# Q-1 已知缺陷登记：offerIfNeeded 触发阈值旁路（2026-10-13 · N1 轮发现 · 本轮不擅修）

> 发现人：游戏程序（N1 埋点四事件落骨架 · ac-16 先红诊断链）· 处置裁决：待主策划/主人（走 feedbackProtocol）
> 性质：**实现面触发阈值与 spec「阈值递增」口径不同源**——非本轮引入，上轮（可玩基线轮）既有。

## 现象（诊断实证，复现链可跑）

- `src/game.ts#offerIfNeeded` 触发条件硬编码 `state.xp >= 5`（死阈值），而 `src/kernel/sim.ts` 内部触发（:156/:260）用 `st.xp >= st.nextUpgradeXp`（递增阈值 5,15,25…——N4 轮「三选一触发面过窄」修复面）。**两条触发路径并存且不同源**。
- 后果链：首次 pick 后 `nextUpgradeXp=15` 但 `xp=5 ≥ 5` → offerIfNeeded 下帧立即重新 offer → 玩家每次选完立刻再弹三选一，**xp≥5 后三选一永久连弹**（战局被 choices 冻结帧吞掉，stepSim 停摆直到玩家点选）。
- 诊断输出（2026-10-13）：`choices@tick 440 xp 5` 连续重复打印（pick 后 next 帧 choices 又非空）——`/tmp` 诊断脚本结论收档于本档 §三。
- 附带发现（已随本轮修复，先红后绿）：`step()` 的 choices 冻结 `return` 位于遥测推进**之前**，悬停帧 first_loop_complete 等观测面永不落账——已修（遥测段前移至冻结检查前，ac-16 红→绿证据 `gate-logs/n0-rebaseline-20261013/04·05`）。

## 为什么本轮不修

- 上轮 approved 契约面建立在此旁路行为上：ac-a2 的 P50=168.1s / victory 20/20、ac-a1 的首升 ≤20s 实测 7.04s，均含「xp≥5 后连弹」的实际节奏（headless 快进每帧自动 pick 等价于连选）。
- 修复（offerIfNeeded 对齐 nextUpgradeXp）会改变真实玩家面的升级节奏 → A1/A2 行为面需重新实测 → **属 spec 行为口径变更，须走 feedbackProtocol revision（策划出修订 → QA 联审 → 程序按 approved 改码），程序不单方面定**（feedbackProtocol 第 3/4 条 + 机器不替人判好玩红线）。

## 建议修复方向（供 revision 评审，非本轮执行）

1. `offerIfNeeded` 条件改 `state.xp >= state.nextUpgradeXp && state.choices === null`（与 sim 单源同源，删除死阈值 5）。
2. 预期影响：三选一节奏回归「拾取驱动递增」设计意图；A1 首升时点（7s 附近）不变（首次触发阈值同为 5）；A2 时长带需 20 种子复测（升级变稀 → 击杀成长变慢 → P50 可能上移，若越出 [90,180] 需策划侧评估 wave/upgrade 数值 revision 或接受新带）。
3. 复测判据：修复后 `duration-log.mjs` 与 ac-02/ac-03 全量复跑 + 真人试玩首 30 秒面（A3 结论面回填顺带覆盖）。

## 处置状态

| 项 | 状态 |
|---|---|
| 缺陷确认 | ✅ 诊断实证（本档 §一） |
| 玩家面影响 | ⚠️ 真人试玩未回填（0/5）——连弹节奏未被真人面证实/证伪 |
| 修复执行 | ⏸ 待 feedbackProtocol revision 授权（登记黑板升级项 Q-1） |
| 关联本轮改动 | 遥测推进前移已修（ac-16 绿）；四事件埋点不受本缺陷影响 |
