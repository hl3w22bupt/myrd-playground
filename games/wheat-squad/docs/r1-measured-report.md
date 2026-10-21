# R1 打磨轮 · A1/A2/A4 实测报告（2026-10-14 · 游戏程序）

> 署名：游戏程序（主策划工作室代行节点）· **绑定 sha：`f0fca5222d86a2a6709e32f612f9ca4bcd416e84`**（spec v1.3 approved 合入后的 HEAD，实测全部在该 HEAD 工作区新鲜实跑）
> 定稿口径：spec **v1.3（链 v5 `cmv7hekf3000mjofivl4ebhdf` · approved · 唯一）**导出件 `.myrd/spec/wheat-squad/design-spec.json`
> 原始输出归档：`.myrd/blackboard/wheat-squad/gate-logs/r1-converge-20261014/03·04·05`（各带 UTC、HEAD sha、退出码）
> sha 三点核对前提（`docs/r1-program-batch.md` ①）：**HEAD ≠ 线上包**（线上 v13@`76954ca` 为旧构建）已如实登记——本报告为 HEAD 本地 headless 机判实测，不宣称线上实测；线上复测待 N7 重部署。

## A1 · 首次核心正反馈（ac-a1 · auto）→ **判定：达标**

| 项 | 值 | 来源事件 / 脚本 |
|---|---|---|
| 计时起点 | `first_core_action_at.atMs`（首次拖动队长，tick×FIXED_STEP_MS(16)） | `src/game.ts#telemetry`（ac-14 剥注释三方同名机判） |
| 首杀延迟 | **1.71s ≤ firstCore.maxLatencySec(10s)** ✓ | `first_kill.tick` − 起点对应 tick，换算脚本 `tests/contract/ac-02-first30s.spec.mjs`（EXIT=0） |
| 5 种子首杀 ≤30s | **5/5 全达**（firstCore.sampleSeeds=5） ✓ | 同上（种子 = DEFAULT_SEED+i） |
| 回归预算 | 3s/20s 保持 ✓ | 同上 |

## A2 · 单局时长带（ac-a2 · auto）→ **判定：达标（20 完整局样本）**

| 项 | 值 | 来源事件 / 脚本 |
|---|---|---|
| 样本量 | **20 完整局**（= numeric.runDuration.sampleSeeds，任务书 ≥20 门槛逐字满足） | 每局一条 `run_end.run_duration_ms`（run_start→结算） |
| P50 | **168.1s ∈ [p50MinSec 90, p50MaxSec 180]** ✓ | 计算脚本 `tools/duration-log.mjs`（种子 = DEFAULT_SEED+i，与 ac-03 同源） |
| P90 | **168.1s ≤ p90MaxSec(300)** ✓ | 同上 |
| 结局面 | **victory 20/20**（判定面 {victory, timeout}） ✓ | `run_end.reason` |
| 分布面保留 | P50=P90=168.1s——确定性 bot 下方差≈0（N7 G1 既有知情项），真人分布面待试玩样本，**不阻塞机判达标** | 同上 |

## A4 · 反馈延迟与通道（ac-a4 · auto）→ **判定：达标**

| 项 | 值 | 来源事件 / 脚本 |
|---|---|---|
| 反馈延迟 | **max 0ms ≤ latencyBudgetMs(100ms)** ✓（kernel 同 tick 记 0） | `feedback_latency_ms.latencyMs`，脚本 `tests/contract/ac-05-hit-feedback.spec.mjs` 面1 |
| 每操作通道 | **min 4 ≥ minChannelsPerOp(2)** ✓（击杀 op：flash/particles/pickup-spawn/hud-kills） | `feedback_latency_ms.channels[]` 逐操作集合，同上面2 |
| 通道↔资产绑定（R1 新增面4） | 发射通道 **全绑 fx 件**（fx-kill-burst/fx-hit-shock/fx-hud-channels，spec.assets v1.3 登记） ✓ | `assets/manifest.json#feedbackChannels`，同上面4 |
| 帧耗时采样（R1 新增面5） | **n=3750 帧，P95=0.002ms ≤ frameBudgetMs(16ms)** ✓ | stepSim 逐帧 hrtime 采样（种子 DEFAULT_SEED+900，前 60s 窗），同上面5 |

## A3 · 自然重开意愿（ac-a3 · manual+auto）→ **判定：机制面达标 · 结论面「未判定·待采」**

- 机制面（机判）：重开链路 + 量表模板列 schema 在档（ac-04 EXIT=0，基线 `01-verify-sh-full.log` 16/0 内）✓
- 结论面（人工）：**记录 0/5，本轮无真人证据——按任务书红线如实记「未判定·待采」，不得虚报**。
- 采集前置：线上包 v13 为旧构建（无 v1.2 埋点 9 键），正式试玩排在 **N7 重部署之后**（旁证时间线与 v1.2 口径一致）；`restart_clicked` 仅作附录旁证不进判定。

## 汇总

| 判据 | 判定 | 证据 |
|---|---|---|
| A1 | ✅ 达标（机判） | `04-a1-a4-fresh.log` |
| A2 | ✅ 达标（20 完整局机判；真人方差面开放） | `05-a2-duration-fresh.log` |
| A4 | ✅ 达标（含 fx 绑定 + 帧采样两面） | `04-a1-a4-fresh.log` |
| A3 | ⏳ 结论面未判定·待采（机制面 ✅） | 试玩记录卡待回填（重新部署后开启采集） |
| A5 / a4b | ✅（v1.2 起入契约，本轮门禁 16/0 内复现） | `01·02 verify 全量` |
