# 关卡状态黑板 — wheat-squad（麦浪小队 · 第二产品线 · 可玩基线轮）

> 更新时间：2026-10-12 · 负责人：主策划（整合）/ 游戏程序（实现状态）
> 下一步：W-3 页面路由解除 → 试玩入口交付 → 主人 5 名试玩回填（A3 结论面）

## 可玩基线轮（2026-10-12 · spec v1.1 approved · victory 终局结构）

| 关卡 | 状态 | 判据面 | 证据 |
|---|---|---|---|
| level-1 初浪（教学波次） | ✅ 可玩基线 · auto 判据绿 | 首波 ×1.5 宽松 + A1 首次核心正反馈 ≤10s（实测 1.71s）+ 5 种子首杀 ≤30s 全达 + 回归预算 3s/20s 保持 | ac-02 PASS（`gate-logs/n7-adversarial-20261012/01` 新鲜复跑） |
| level-2 涌浪（升温波次） | ✅ 可玩基线 · auto 判据绿 | 1.15×/浪爬升 + **victory 终局**：victoryWaves(6) 波次通关即结算（实测 P50=168.1s ∈[90,180]，victory 20/20 种子）+ hardTimeoutSec(300) 保底 + 结算页三信息齐 | ac-03 PASS（同上） |
| 结算-重开闭环 | ✅ headless 可重复 | 打开→首次核心操作→单局结束→重开 + first_core_action_at/run_duration_ms/feedback_latency_ms 埋点真实产生 | WS-SMOKE PASS（同上） |

- 冻结计数器：**0/3**（基线轮第 1 轮，四件套 3 达 1 未达不计数；触发条款写死于 spec meta.baselineProtocol）
- A3 结论面 ⏳：5 名试玩 ≥3 人自然重开 ≥2 局且理由原文非空（记录 0/5——量表 `games/wheat-squad/qa/playtest-record-template.md`）
- **n9 轮 HEAD 复核（2026-10-12）**：上表三行判据全部独立复跑再证（13/0 + 53/0 + WS-SMOKE PASS），证据 `gate-logs/n9-verify-20261012/03`；本行仅加注，不改判据面
- **n14 轮（2026-10-12 · D1 修复）**：A2 面冒烟断言升格为**直读真实遥测载荷**（`run_end.run_duration_ms`，弃自算值），结局势按 approved spec 同源为 {victory, timeout, defeat}；新增 ac-14 机判定名三方同名（剥注释）。判据数值面零改动，证据 `gate-logs/n14-telemetry-naming-20261012/`

## 既有登记（2026-10-11 骨架轮 · 原文保留）

| 关卡 | 状态 | 判据面 | 证据 |
|---|---|---|---|
| level-1 初浪（教学波次） | 🗄️ 上轮口径归档 | 首杀 ≤3s（实测 1.73s）+ 首升 ≤20s（实测 7.04s） | ac-02（`gate-logs/n4-scaffold-20261011/01`） |
| level-2 涌浪（升温波次） | 🗄️ 上轮口径归档 | 300s 时限自然结算（timeout 主结局——v1.1 起 victory 为新主结局） | ac-03（同上） |

