# R1 复测收口轮 · A1/A2/A4 绑 sha 复测报告（2026-10-15 · 游戏程序）

> 署名：游戏程序（主策划工作室代行节点）· **绑定 sha：`7b45b44072747ca17af96f81dd109b926745f3d4`**（采样时工作区 HEAD，spec v1.4 = 链 v6 approved 合入后）
> 定稿口径：spec **v1.4（链 v6 `cmv8xcexk0009m9dj6ev1dj0r` · approved · 唯一）**导出件 `.myrd/spec/wheat-squad/design-spec.json`；判读纪律 = meta.retestProtocol（本轮 v1.4 增补）
> 原始输出归档：`.myrd/blackboard/wheat-squad/gate-logs/r2-recheck-20261015/05..09`（各带命令/UTC/退出码）
> 绑 sha 有效性复核口径（v1.4 retestProtocol①）：`git diff 7b45b44..<当前 HEAD> -- games/wheat-squad/src games/wheat-squad/tests games/wheat-squad/tools .myrd/spec` = 空（后续仅 docs/黑板提交）则本报告数值仍有效
> 确定性红线：本次复采与 R1 轮（`f0fca52`）实测值逐项同值（A1 1.71s / A2 P50=168.1s / A4 0ms·4 通道）——同 seed 同代码确定性复现，非抽查

## sha 对账结论（任务书前置项 · 三态）

| 项 | 结果 |
|---|---|
| 线上部署物 v15（`cmv7kaen8001kjofi5p7qyb2l` @ `762742c`） | main.mjs md5 `f3a6a6b4cd05daaba89ae6d1f35248a1`（LIVE 实取）· `__G2WS_BUILD` 内嵌计数 = **0** |
| 结论 | **「无法确认·需重部署」**——v15 部署物无内嵌构建 sha，无法自证构建 commit |
| 处置 | **构建 sha 注入基建已实施**（`tools/build.mjs` 注入 `__G2WS_BUILD={gitSha,specAnchor}`，确定性字段零时间戳；env 覆写必须 ≡ 真实 HEAD 否则 fail-closed 防伪锚）→ 重建 ×2 逐字节一致（确定性 PASS）→ 重部署 v16 后对账闭合（LIVE 内嵌 sha ≡ 发布 commit，见部署台账） |

## A1 · 首次核心正反馈（ac-a1-first-core-feedback · auto）→ **绿**

| 判据 id | 阈值 | 实测值 | 事件名 | 脚本路径 | 样本量 | 三态 |
|---|---|---|---|---|---|---|
| ac-a1-first-core-feedback | 首杀 ≤ firstCore.maxLatencySec(**10s**)；5 种子全部 ≤ mustReachBySec(**30s**)；回归预算 3s/20s | **1.71s**；5/5 全 ≤30s；预算保持 | `first_core_action_at`（计时起点）→ `first_kill.tick` | `tests/contract/ac-02-first30s.spec.mjs`（check 薄壳 `checks/ac-a1-first-core-feedback.mjs`） | 5 种子（DEFAULT_SEED+i） | **绿** |

## A2 · 单局时长带（ac-a2-run-duration-band · auto · 模拟局口径）→ **绿**

| 判据 id | 阈值 | 实测值 | 事件名 | 脚本路径 | 样本量 | 三态 |
|---|---|---|---|---|---|---|
| ac-a2-run-duration-band | P50 ∈ [p50MinSec(**90**), p50MaxSec(**180**)]s；P90 ≤ p90MaxSec(**300**)s；结局 ∈ {victory, timeout} | **P50=168.1s ∈[90,180] ✓**；P90=168.1s ≤300 ✓；victory 20/20 ✓ | `run_end.run_duration_ms`（每局一条）+ `run_end.reason` | `tools/duration-log.mjs`（check 薄壳 `checks/ac-a2-run-duration-band.mjs` → `ac-03-run-duration.spec.mjs`） | **20/20 完整局（= runDuration.sampleSeeds 满）** | **绿** |

**A2 样本量进度**：20/20（模拟局面满额）；真人局面按 v1.4 retestProtocol② 归 A3 口径，不进 A2 分母（不混算）。分布面 P50=P90=168.1s 系确定性 bot 方差≈0（既有知情项），真人方差面开放、不阻塞机判。

## A4 · 反馈延迟与通道（ac-a4-feedback-channels · auto）→ **绿**

| 判据 id | 阈值 | 实测值 | 事件名 | 脚本路径 | 样本量 | 三态 |
|---|---|---|---|---|---|---|
| ac-a4-feedback-channels | feedback_latency_ms ≤ latencyBudgetMs(**100ms**)；每操作通道 ≥ minChannelsPerOp(**2**) | **max 0ms**（kernel 同 tick）；**min 4 通道**（flash/particles/pickup-spawn/hud-kills，flash=90ms） | `feedback_latency_ms.latencyMs` + `.channels[]`（逐操作） | `tests/contract/ac-05-hit-feedback.spec.mjs`（面1 延迟/面2 通道/面4 fx 绑定/面5 帧采样） | 逐操作全采样 + 帧采样 n=3750 | **绿** |
| 〃 扩面：fx 绑定（v1.3 面4） | 通道全绑 spec.assets fx 件 | 全绑 ✓ | 〃 | 〃 面4（`assets/manifest.json#feedbackChannels`） | 3 fx 件 | **绿** |
| 〃 扩面：帧耗时（v1.3 面5） | P95 ≤ frameBudgetMs(**16ms**) | **P95=0.001–0.002ms** | 〃 | 〃 面5（hrtime 逐帧） | n=3750 帧 | **绿** |

## A3 · 自然重开意愿（ac-a3-restart-willingness · manual+auto · 真人局口径）→ **未判定·待采**

| 判据 id | 阈值 | 实测值 | 事件名 | 脚本路径 | 样本量 | 三态 |
|---|---|---|---|---|---|---|
| ac-a3-restart-willingness | 结论面：5 名试玩 ≥3 人自然重开 ≥2 局且理由原文非空；机制面：重开链路+量表 schema 在档 | 机制面 **PASS**（重开 0ms + 全复位 + 结算三信息 + 模板 schema）；结论面 **0/5 回填** | `restart_clicked{count,atMs}`（仅附录旁证，不进判定） | `tests/contract/ac-04-restart-loop.spec.mjs`（check 薄壳 `checks/ac-a3-restart-willingness.mjs`） | 真人 0/5 | **未判定·待采**（按 v1.4 retestProtocol①②：无绑 sha 真人证据 → 待采，不判红不判绿，不烧冻结余量） |

## 配套判据（同轮复采，全部绿）

| 判据 id | 结果 | 摘要 |
|---|---|---|
| ac-a5-guidance-first-action | 绿 | hint_shown@0ms → 首操作 @48ms，48−0 ≤ 5000ms 窗 ✓（文案三方同名逐字） |
| ac-a4b-restart-click-counter | 绿 | restart_clicked count 1→2 真实点击驱动 ✓ |
| det-1 / perf-1 / tex-1 / anchor-1 / loop-1 / fv-pend / ac-art-1..4 / ac-14 / ac-15 | 绿 | run-all 全量 16 PASS / 0 FAIL / 1 PEND（PEND = ac-a3 结论面，如实挂起） |

## 原始事件计数对照（复采局 · det-1 同 seed 双局逐字节一致断言内）

| 事件 | 计数/值 | 对照 |
|---|---|---|
| `first_kill.tick` | A1 主种子 1.71s（107 tick 换算） | ≡ R1 轮逐字节 |
| `run_end.run_duration_ms` ×20 | P50=P90=168.096s · victory 20/20 | ≡ R1 轮逐字节 |
| `hint_shown` | @0ms · text「拖动队长移动 · 队员自动作战」 | 三方同名机判 |
| `first_tap` | once @32ms | ≡ R1 轮 |
| `first_loop_complete` | @7040ms | ≡ R1 轮 |
| `restart_clicked` | count 1→2（结算态真实点击） | ≡ R1 轮 |
| det-1 局面快照 | tick 10506 · kills 218 · xp 436 · wave 7 · ups[fireRate×2,damage×2,recruit,…] | 双局逐字节一致 |

## 汇总（三态口径）

| 判据 | 三态 | 判定依据 |
|---|---|---|
| A1 | ✅ 绿 | 绑 sha 机判实测 ≤ 阈值 |
| A2 | ✅ 绿（模拟局，样本满 20/20） | 绑 sha 机判实测带内 |
| A4 | ✅ 绿（含 fx 绑定 + 帧采样扩面） | 绑 sha 机判实测 ≤ 阈值 |
| A3 | ⏳ 未判定·待采 | 真人局 0/5，结论面无证据（机制面绿）；不烧冻结余量 |
