# QA 对账回执 — R1 打磨轮三件套（QA-WS-R1-20261014-01 · 游戏 QA）

> 预审人：游戏 QA（主策划工作室代行节点，产物独立落盘）· 日期：2026-10-14
> 三输入：① approved spec = 链 **v5 `cmv7hekf3000mjofivl4ebhdf`（meta v1.3 · approved · 唯一，API 实查 + 项目级 approved 查询回查同源）**· 导出件零漂移（updatedAt `2026-10-14T02:20:27.925Z` 双边全等）；② HEAD 实现 + 门禁/冒烟输出 = 绑定 sha **`f0fca52`**（实测报告锚）· QA 独立复跑 `gate-logs/r1-converge-20261014/06-qa-verify-recheck.log`（放行权在本席，非引用程序侧历史输出）；③ 实测报告 = `games/wheat-squad/docs/r1-measured-report.md`（绑同 sha，A3 如实「未判定·待采」）。

## 一、门禁复跑（QA 独立实跑，sha 间代码差异处置）

- sha 差异核对：实测报告锚 `f0fca52` ≡ 本席复跑 HEAD（`06-qa-verify-recheck-head`）——**零差异**，无双平台全量复跑触发条件；若 N7 修复批再动代码，发布 commit 上必须再复跑一次全部门禁后才可部署（顺序契约写死）。
- 复跑结果：五步全 PASS · **VERIFY_EXIT=0**（统一契约 56/0 · 自有 16/0/1PEND · WS-SMOKE PASS · SCOPE-GUARD 双模式 PASS）。

## 二、A1–A5 逐条对账（行号级）

| 条款 | 对账点（文件:行） | 机器面 | 结论 |
|---|---|---|---|
| ac-a1 | `tests/contract/ac-02-first30s.spec.mjs:15`（首杀延迟 ≤10s）· `:21`（5 种子 ≤30s）· 计时起点 = `src/game.ts` telemetry `first_core_action_at`（ac-14 剥注释机判） | 实测 1.71s ≤10s · 5/5（`04` 日志 EXIT=0） | ✅ 放行 |
| ac-a2 | `tests/contract/ac-03-run-duration.spec.mjs:21-24`（P50 带/P90/结局势/victory 面）· 样本量 = `numeric.runDuration.sampleSeeds=20` | 实测 P50=168.1s∈[90,180] · P90=168.1s≤300 · victory 20/20（`05` 日志 EXIT=0，脚本 `tools/duration-log.mjs`） | ✅ 放行（分布面方差≈0 为既有知情项 G1，真人面待采） |
| ac-a3 | `tests/contract/ac-04-restart-loop.spec.mjs`（机制面）· 结论面量表 `qa/playtest-record-template.md` | 机制面 EXIT=0 · 结论面 **0/5 未回填** | ⏳ **结论面未判定·待采**（机制面放行；条件：N7 重部署后开采集，`restart_clicked` 仅附录旁证） |
| ac-a4 | `tests/contract/ac-05-hit-feedback.spec.mjs:30`（通道 ≥2）· `:12-18`（延迟 ≤100ms）· `:44`（面4 fx 绑定）· `:69`（面5 帧采样 P95 ≤16ms） | max 0ms · min 4 通道 · 全绑 fx · n=3750 P95=0.002ms（`04` 日志） | ✅ 放行 |
| ac-a4b | 共享实体件 ac-16（v1.2 判例：一断言面跑两次，幂等） | 16/0 内 PASS | ✅ 放行 |
| ac-a5 | ac-16（hint_shown→首操作 ≤5000ms · 文案三方同名逐字机判） | 16/0 内 PASS | ✅ 放行 |
| det/perf/tex/anchor/loop | ac-01/06/07/08 + `tools/smoke.mjs`（loop-1 薄壳转发） | 五步复跑全绿 | ✅ 放行 |
| fv-pend | ac-09（结构冻结机判 · 基准数值待内测样本） | PEND 如实展示（ALL_GREEN=false 口径），零静默跳过 | ⏸ PEND 维持（数值校准归 revision，归主人内测样本） |
| ac-art-1..3 | ac-10/11/12 · ac-11 行号：`:17`（封顶 13）· `:19-22`（面1 entity 逐字）· `:24-27`（**面4 B 案扩严逐件对账**） | 13 件 ≤13 · 零清单外 · 先红（RED-EXIT=1 `02` 前置）后绿 | ✅ 放行 |
| ac-art-4 | ac-13 机制面 + 互查回执 `qa/style-consistency-check.md`；本轮 §R1.1 复核三方全等（`style-card-v1.md` §R1.1） | 机制面绿 · 人判面回执在档 | ✅ 机制面放行（主人观感终裁保留） |

## 三、spec v1.3 修订面复核（QA 立场）

- 零数值/零条款字面改动机判成立（v5↔v4 五段 EQUAL，`spec-v13-pre-review.md` §一实查路径）——**非判据放宽**，B 案为登记闭合 + 机判扩严（ac-11 面4 为加强项）。
- 修订流程合规：revisions 接口 version+1（v4→v5 draft 201）→ 本席只读预审 APPROVE-READY → 主策划审签 → approve 200 → 回查唯一 approved ✓。
- **开口项（如实列明）**：①链上 v4→v5 过渡窗口无 approved（平台版本链语义，已闭合）；②A2 真人分布方差、A3 结论面、fv-pend 数值、真机走查（G3）四项**待真人样本/内测**，均不阻塞机判放行。

## 四、结论

- **放行 N7 修复批入口**：本席未发现需打回的代码缺口——主线⑤「修复批」本轮为**空批通过**（零代码差异 ⇒ 发布 commit 复跑门禁后直接进入 deploy 节点重新部署）。
- 放行条件（写死）：①发布 commit 上复跑 verify.sh 五步全绿（含微信红线面：SCOPE-GUARD 凭证类标识符扫描 ④⑤ 双模式）；②deploy 后线上三点复测（页面 title=麦浪小队 + main.mjs md5 ≡ 发布 commit build + WS-LIVE-SMOKE PASS）；③A3 采集窗开启（试玩入口交付）。
- 「四件套全达」**本轮不宣称**：A3 结论面待采；本轮结束时若仍无真人证据，黑板记**好玩判据不达第 1 轮**（任务书红线，3 轮不达即冻结条款在 spec meta.baselineProtocol）。
