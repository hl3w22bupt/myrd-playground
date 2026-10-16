# 关卡状态黑板 — wheat-squad（麦浪小队 · 第二产品线 · 可玩基线轮）

> 更新时间：2026-10-16（**R1 复测三态分流收口轮** · 分流完成：绿 3 项固化 + A3 未判定·待真人）· 负责人：主策划（整合）/ 游戏程序（实现状态）
> 下一步：**等主人圈定 5 名真人试玩**（任务单 APPROVE-READY：`docs/a3-playtest-task-order-20261016.md`）· 采集面 = **v20 LIVE @ `3828f49`（证据绑 sha `4eccaf29`）** · 回填后复跑 ac-a3 → ≥4/5 达标即转「提审就绪预备」+ 双平台材料清单升级主人发布拍板

## R1 复测三态分流收口轮（2026-10-16 · 主策划整合）

| 项 | 值 |
|---|---|
| 轮次号 | **R1 复测三态分流收口轮**（任务书：sha 地基验证 → 三态分流 → 分支处理 → 条件触发链 → A3 任务单） |
| sha 地基验证（A1） | **三点对账链不成立**（工作区 HEAD ≠ 线上内嵌 `29e779b` ≠ 10/15 报告绑 `7b45b44`，逐字符两两不等）→ 按任务口径 R1 报告全量「未判定·待采」；源面零漂移如实附注不推翻口径 | 
| 补采（A3） | **绑新 sha `4eccaf293b11052041860ff7b0ee3141975258fd`**：run-all **16 PASS / 0 FAIL / 1 PEND** · A1=1.71s · A2 P50=168.096s victory 20/20 + **start→end 事件链 20/20 完整**（新工具 `tools/r1re-a2-chain-count.mjs`，装配面≡内核面同值）· A4 max=0ms·4 通道·P95=0.001ms · 与 R1 轮逐项同值（确定性复现） |
| 分流结论（A2） | **绿 15 项（固化 ✓ 16/16 check 薄壳在盘实跑）· 红 0 条 · 未判定 1 项（ac-a3 结论面 0/5 真人）**；缺陷型修复批 0 件；条件触发链（连续 2 轮红）不触发；QA 双签（QA-WS-R1RE-TRIAGE-20261016-01/02） |
| 部署（A4） | **v20 `cmvabm4wd…` running @ 发布 commit `3828f49`**（带 manifestPath 单次受理，504 判例先 GET 复查未盲重发）· LIVE 三点全过（md5 `67a60360` 逐字节 + **内嵌 sha ≡ 报告绑定 sha `4eccaf29` 逐字符全等** + specAnchor v6）· WS-LIVE-SMOKE PASS victory 167s 零错误 |
| 不达判据 id 清单 | **ac-a3-restart-willingness（结论面）**——样本不足型（0/5 真人）；冻结计数器 **0/3 维持**（两轮未采，既未消耗也未累积，如实登记）；「好不好玩」终裁归主人 |
| 证据 | `gate-logs/r1re-recheck-20261016/00..13`（对账/补采/门禁/部署/LIVE 冒烟全链原始输出）· 报告 `games/wheat-squad/docs/r1re-recheck-report-20261016.md` · 分流表 `docs/r1re-triage-table-20261016.md` · 任务单 `docs/a3-playtest-task-order-20261016.md` |



## R1 复测收口轮（2026-10-15 · N5 台账回填 · 主策划整合）

| 项 | 值 |
|---|---|
| 轮次号 | **R1-复测收口轮**（spec v1.4 = 链 v6 approved 判读纪律生效后首轮复测判定） |
| 复测 sha | 采样绑 **`7b45b44072747ca17af96f81dd109b926745f3d4`** · 发布 commit **`813fa38bf1240e1ec261806ccbc248fdbb5346f5`**（v17 LIVE，部署物内嵌 gitSha ≡ 采样绑定点 = 对账闭环） |
| 全绿与否 | **否——非全绿（如实）**：A1 ✅绿 / A2 ✅绿（20 局满，模拟局口径）/ A4 ✅绿 / A3 ⏳**未判定·待采**（机制面 PASS，结论面 0/5 无真人回填）；run-all 16 PASS / 0 FAIL / 1 PEND |
| 不达判据 id 清单 | **ac-a3-restart-willingness（结论面）**——样本不足型，非数值超阈型；不烧冻结余量（计数器 0/3 维持，部分达标即重置） |
| 分流结论 | **证据型**（QA-WS-R1RE-20261015-01 唯一 JSON）→ R1 维持「未判定·挂起」；缺陷型修复批 = 0 件；采集面 = v17 LIVE（证据绑 sha），主人圈定 5 名试玩回填后复跑 ac-a3 → 转「全绿·打磨中」路径 |

**程序线 verify-claims 复核一行**（2026-10-15 · 游戏程序 · 独立实跑 @ HEAD `4f424e5`，不照抄声称）：五步门禁实跑全绿（统契约 PASS · 16/0/1PEND · WS-SMOKE victory 167s ≡ 复测报告逐值 · 双 guard PASS）+ 严格模式 `STRICT_EXIT=2` 如实（A3 挂起口径未被冲刷）；同时揪出并修复**三份顶层共板（levels/assets/blockers）合流冲突标记随库残留**（r1 合流 `5a6b979` 引入，零信息丢失机判前置后删除）+ 扩 scope-policy 共板三件精确串白名单（Run2 假红 → Run3 `VERIFY_EXIT=0`）。spec/工程/他线零触碰；R1 判定结论不变。证据 `gate-logs/levels-conflict-fix-20261015/00..04`。



## 部署轮 · v19 LIVE 重锚（2026-10-15 · deploy 节点 · R1 收口后本轮 · 采集面字节刷新）

| 项 | 值 |
|---|---|
| 轮次号 | R1 复测收口后部署轮（deploy-only：源面运行时零内容变更，部署物指纹重锚） |
| 发布 commit | `0031d3140ac3ffe8ec9b4387ecdf4503bb58d620`（部署物内嵌 gitSha=`29e779ba…` = 重建时内容 HEAD，「构建自指单行滞后」不变量维持；specAnchor=链 v6 approved） |
| 坑/版本 | `cmv36wl94001xm9mxp119q48x`（wheat-squad-2）· **v19 running/current**（v18 同字节先行 running；504 双受理如实披露见 blockers 部署台账） |
| 关卡判据面 | **零改动零复判**：R1 判定值绑 `7b45b44…` 仍有效（spec v1.4 判读纪律①绑 sha 有效性 = 受测源面 diff 为空——本部署 src 零变更实证）· A1/A2/A4 绿 · A3 结论面维持 ⏳ 未判定·待采（0/5 真人） |
| LIVE 自测 | /health 200（共享壳静态身份串，定性非串线）· `/` 308→入口 · `/gw` title=麦浪小队 · main.mjs md5 `ae62534dd4cbb7626f8175906882915b` ≡ 发布 build 逐字节 · **WS-LIVE-SMOKE PASS victory 167s 零错误** |
| 证据 | `gate-logs/deploy-v18-20261015/01`（verify 五步）· `02`（部署 POST）· `03–04`（坑位/轮询）· `05`（LIVE 冒烟）· `README-deploy.md` |

## R1 打磨轮（2026-10-14 · spec v1.3 = 链 v5 approved · 实测三样绑 sha · 双线合流 HEAD `b33bea2`）

| 关卡/面 | 状态 | 判据面（本轮实测值） | 证据 |
|---|---|---|---|
| level-1 初浪 | ✅ 实测达标 | A1 首杀 1.71s ≤10s + 5 种子 ≤30s 全达（计时起点=first_core_action_at） | `gate-logs/r1-converge-20261014/04`（绑 sha f0fca52） |
| level-2 涌浪 | ✅ 实测达标 | A2 20 完整局 P50=168.1s∈[90,180] · P90=168.1s≤300 · victory 20/20（样本量门槛 20=numeric 冻结） | `05`（tools/duration-log.mjs） |
| A4 反馈面 | ✅ 实测达标（含 R1 两新面） | max 0ms ≤100ms · min 4 通道 ≥2 · fx 三件绑定全过（面4）· 帧采样 n=3750 P95=0.002ms ≤16ms（面5） | `04`（ac-05 五面） |
| A3 结论面 | ⏳ 未判定·待采 | 记录 0/5；采集窗前置 = v14 重部署复测 PASS（线上包须含 v1.2+ 埋点 9 键）；记录卡 `qa/playtest-collection-round1.md`（时间窗 ISO 可验真） | ac-a3 PEND 口径（16/0/1PEND 非全绿） |
| 结算-重开闭环 | ✅ 门禁五步复现 | 统一 56/0 + 自有 16/0/1PEND + SMOKE + GUARD 双模式 VERIFY_EXIT=0 | `08-release-verify2.log` @ b33bea2 |

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

