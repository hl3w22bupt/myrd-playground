# 关卡状态黑板 — wheat-squad（麦浪小队 · 第二产品线 · 可玩基线轮）

> 更新时间：2026-10-13（spec v1.2 增量轮 + N8 独立复核实测）· 负责人：主策划（整合）/ 游戏程序（实现状态）
> 下一步：W-3 页面路由解除 → 试玩入口交付 → 主人 5 名试玩回填（A3 结论面）

## spec v1.2 增量轮（2026-10-13 · 链 v4 approved · A1–A5 · N8 独立复核实测，HEAD `304dacf` 树净）

| 关卡/面 | 状态 | 判据面（实测值） | 证据 |
|---|---|---|---|
| level-1 初浪（教学波次） | ✅ v1.2 口径复证 | A1：首次核心正反馈 ≤10s（实测 1.71s）+ 5 种子首杀 ≤30s 全达 + 回归预算 3s/20s 保持 | ac-a1 PASS（`gate-logs/n8-reverify-20261013/01` 步②） |
| level-2 涌浪（升温波次） | ✅ v1.2 口径复证 | A2：20 种子 P50=168.096s ∈[90,180] · P90 ≤300 · victory=20/20；**a3 实测初值已落档**（`qa/local-duration-log.json`，P50=168.1s，N8 复跑逐值一致） | ac-a2 PASS + duration-log 复跑（同上 01 + 04） |
| 首分钟引导（a5 面） | ✅ auto 判据绿 | 四事件骨架：hint_shown@0ms + first_tap once + first_loop_complete@7040ms + restart_clicked count 1→2；a5 窗（hint 后 5s 内首操作）冒烟实测窗内可达 | ac-16 PASS + WS-SMOKE 四事件真实载荷（同上 01 步②③） |
| A3 结论面 | ⏳ PEND（机判口径=**非全绿**） | 5 名试玩记录 0/5 未回填；机制面（重开 0ms+全复位+结算三信息）PASS；严格模式 `WS_CONTRACT_STRICT_GREEN=1` → exit 2 样例已交 QA 预核 | ac-a3 PEND + `gate-logs/n8-reverify-20261013/02`（STRICT_EXIT=2） |
| 结算-重开闭环 | ✅ headless 可重复 | 打开→首次核心操作→单局结束（victory 167s）→重开复位 + 四事件 + A1/A4 埋点真实载荷 + console 零错误 | WS-SMOKE PASS（同上 01 步③） |

**N8 独立复核一行**（游戏程序 · verify-claims 纪律 · HEAD `304dacf`）：verify.sh 五步 VERIFY_EXIT=0（统一契约 **56/0** · 自有 **16/0/1PEND** ALL_GREEN=false · 冒烟四事件 · SCOPE-GUARD 双模式）+ 链 v4 approved ≡ 仓内单源逐字节（`--expect-version 4` DEEP_EQUAL=true）+ 确定性重建 `git diff build/`=0 + 线上 W-3 第七次复测仍串线（title=汽车连连看；资产路 live main.mjs md5 `bcde4bea…` ≡ HEAD build）。证据 `gate-logs/n8-reverify-20261013/01–05`。结论仅对该 sha 有效。

**N9 驳回修复轮一行**（2026-10-13 · QA 五条驳回 · 游戏程序）：① ac-16 补 a5 statement 谓词逐字断言（first_core_action_at − hint_shown ≤ 窗，窗值由 approved statement 机器解析 fail-closed）+ ② 三方 copy 逐字机判（spec.copy ≡ manifest.copy ≡ GUIDANCE_TEXT ≡ hint_shown.text）——双变异验证先红后绿（文案缺陷注入旧面绿/新断言红；延迟拖动 6s 红因 6048ms>5000ms 窗；还原绿）；③ ac-art-2 机判窄于 statement **升级主策划裁决**（选项 A statement 改 entities∪assets / B spec.assets 补登四件，ac-11 知情窄面披露不擅改）；④ LIVE_SMOKE exit 失实以显式取码重归档 **exit=1**（红正确）+ wrapper 取码口径落死；⑤ README 悬空行删除；两 QA 回执失实归因就地更正。spec 零变更（③ 走裁决未动链）。证据 `gate-logs/n9-rejection-fix-20261013/`。

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

