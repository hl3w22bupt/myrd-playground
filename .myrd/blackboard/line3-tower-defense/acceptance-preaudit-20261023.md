# acceptance 四判据「三问」可测性预审清单 —— line3-tower-defense spec v1.0（2026-10-23 · P0-3 · 游戏策划 + 游戏 QA 联署件）

> 更新时间：2026-10-23 ｜ 负责人：游戏策划（三问主审）· 游戏 QA（可判定性与禁词复核） ｜ 下一步：1 项不可测 → 按任务口径走 `POST /api/v1/game-design-specs/cmvbqgzbl0029m9ax64foxd37/revisions` 出 v1.1（只补真人面可测表述/测量方法/目标行为，已达阈值一字不动，本修订不计打磨轮 R1、不受「等反馈」约束——主策划裁定口径）
> 三问 = ①量化定义？②测量方法？③阈值出处？
> 预审输入 = 链上 approved 实况（`cmvbqgzbl0029m9ax64foxd37` v2 approved，导出件 `.myrd/spec/line3-tower-defense/design-spec.json` 零漂移基线）+ 门禁复跑实测（`gate-logs/p0-3-rerun-20261023/01` VERIFY_EXIT=0 @ `fa71074`）

## 一、逐条预审（四判据）

| 判据 | 三问①量化定义 | 三问②测量方法 | 三问③阈值出处 | 结论 |
|---|---|---|---|---|
| **a1-td-first-placement-feedback**（首 30 秒体验，auto） | ✓ 5/5 种子（DEFAULT_SEED+i，i=0..4）首 30s 内完成首次布防，first_placement_at ≤ firstPlacementBudgetSec(20s)，反馈延迟 ≤ 100ms——全部数值/计数谓词，零模糊词（QA 复核确认） | ✓ 机判 check `tests/contract/checks/a1-td-first-placement-feedback.mjs`，headless 可复跑（本轮 VERIFY 复跑 14/14 实证） | ✓ B6 数值初始锚定值（REVISIONS.md v2 行「初始锚定值、实测后 revision 校准」）+ B5 QA 预审 PASS | **可测** |
| **a2-td-wave-duration-band**（单局时长带，auto） | ✓ 20 完整模拟局 P50∈[240,420]s 且 P90≤600s，结局∈{victory,defeat}，样本量=20 | ✓ 机判 check + start→end 事件链 20/20 完整性门（本轮复跑 PASS） | ✓ numeric.waveBand 初始锚定（B6 六判据核签在档） | **可测**（模拟局口径；真人局时长=口径外 → 见 §二映射行 2） |
| **a3-td-restart-willingness**（自然重开意愿，manual） | ✓ ≥4/5 名真人自然重开 ≥2 局且重开理由原话非空；样本不足=未判定·待采不烧冻结余量 | ✓ 真人记录卡核（`games/line3-tower-defense/qa/playtest-collection-round1.md` 在档，wheat A3 任务单判例形制）+ QA 回收核真 | ✓ wheat-squad A3 判例阈值形制 + 任务书 5 真人口径 | **条件可测（待采）**：机面全就绪、采集窗已开，卡 0/5 真人未回流——归主人圈定（W-L3-3），机器不代采 |
| **a4-td-feedback-channels**（反馈延迟与通道，auto） | ✓ 每操作 ≤100ms、通道 ≥2、帧 P95 ≤16ms、帧采样 n≥3000 | ✓ 机判 check 逐操作全采样 + 帧采样 | ✓ numeric.feedback 初始锚定 | **可测** |

## 二、好玩判据本地埋点三键 ↔ spec 映射（配合 telemetrie-plan-v1）

| # | 埋点判据 | spec 现状 | 结论 | 补法 |
|---|---|---|---|---|
| 1 | **首 30 秒流失**（真人面） | a1 写的是「首 30 秒内完成首次布防」**目标行为**（机面），真人「未达目标行为即离开」的流失判据**spec 未写**——无量化定义、无阈值、无测量挂点 | **不可测（作为验收判据）** | v1.1 修订：a1 追加真人面对应面表述（流失定义 = run_start 后 30,000ms 内无 first_placement_at 且无 run_end 含中途离开；测量方法 = 本地埋点方案 v1，零平台 API；阈值 = 观测型初始锚定，样本回流后 revision 校准）。**a1 既有阈值一字不动** |
| 2 | **单局时长**（真人口径） | a2 明文「模拟局口径，禁混真人局」→ 真人局时长无判据；但测量字段已备（`run_end.run_duration_ms` 出账在档） | **条件可测**（字段就绪、判据缺真人面表述） | v1.1 修订：a2 追加真人面对应面表述（取 run_duration_ms 逐局分布、与模拟局分开统计；观测型初始锚定，≥5 局回流后校准）。**模拟局阈值带一字不动** |
| 3 | **再来一局点击** | a5/fnd-1 机面已定名机判（restart_clicked.count）+ a3 真人面意愿主条 | **可测**（双面齐备） | 无需修订 |

## 三、「首 30 秒体验」第一分钟目标行为核对（任务书硬规则核对）

任务书规则：「首 30 秒体验」spec 未写第一分钟目标行为 → 直接判不可测。核对结论：**a1 已写首 30 秒目标行为**（首次布防 ≤20s within 30s 窗 + 反馈延迟 ≤100ms，5 种子），故**硬规则不触发**；但规则核对同时暴露 a1 只有机面（模拟种子），真人面流失口径缺失 → 按 §二行 1 判不可测并走修订。两条结论并存、不互相覆盖，如实并记。

## 四、修订纪律（红线）

1. 修订仅动 a1/a2 两条 statement 的**追加句** + `meta.approval`/`meta.revision_note` 状态行；numeric 段逐字节冻结（revision 前后 hash 对账）、world/entities/levels 零触碰、acceptance id/check 命令零改动（run-all 逐件对账不破）。
2. 版本链纪律：`POST …/:id/revisions`（version 2→3，父版 superseded）→ QA 预审 diff → 主策划六判据 approve → 回查唯一 approved → 导出件换基线 + REVISIONS.md 记账。禁止本地伪造版本号。
3. 好玩终裁红线不失效：spec approve ≠ 好玩判定，a3 真人面与最终好玩判定始终归主人。

——联署：游戏策划（三问主审）· 游戏 QA（可判定性/禁词复核 · 代行节点判例）· 主策划（裁定修订通道）
