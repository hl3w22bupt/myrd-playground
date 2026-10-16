# R1 复测三态分流收口轮 · 绑新 sha 补采报告（2026-10-16 · 游戏程序）

> 署名：游戏程序（主策划工作室代行节点）· **绑定 sha：`4eccaf293b11052041860ff7b0ee3141975258fd`**（补采时工作区 HEAD，干净源面）
> 契约输入：spec **v1.4（链 v6 `cmv8xcexk0009m9dj6ev1dj0r` · approved · 唯一）**导出件 `.myrd/spec/wheat-squad/design-spec.json`（2026-10-16 链锚核 DEEP_EQUAL=True 零漂移）
> 前置地基：`docs/r1re-sha-reconciliation-20261016.md`（旧三点链不成立 → 全量「未判定·待采」→ 本轮补采）；分流表 `docs/r1re-triage-table-20261016.md`
> 原始输出归档：`.myrd/blackboard/wheat-squad/gate-logs/r1re-recheck-20261016/05..07`（各带命令/UTC/退出码）
> 确定性红线：本次补采与 R1 轮（`f0fca52` 采样、`7b45b44` 复采）实测值**逐项同值**（A1 1.71s / A2 P50=168.096s / A4 0ms·4 通道）——同 seed 同代码确定性复现

## 一、A2 事件链计数面（本轮任务书新增口径 · start→end 链）

| 项 | 值 |
|---|---|
| 工具 | `tools/r1re-a2-chain-count.mjs`（game.ts 装配面真实 step 驱动 · 遥测直读，禁自算替代） |
| 结果 | **20/20 链完整**（每局恰 1 条 `run_start` 且其后恰 1 条 `run_end`，链长=2 有序）· P50=168.1s ∈[90,180] · P90=168.1s ≤300 · **victory 20/20** · 带内=true |
| 口径纪律 | 全部模拟局（DEFAULT_SEED+i），**禁混真人局**（真人面归 ac-a3，retestProtocol② 不混算）；ac-a3 机制面 check 与契约判定面（checks/ac-a2 → ac-03 spec）零改动 |
| 落档 | `qa/r1re-a2-chain-log-2026-10-16.json`（逐种子链 + durationMs ≡ tick×16ms 断言 + binding.gitSha=本报告绑定 sha） |
| 双面对拍 | 内核面（duration-log/run-all ac-a2）P50=168.096s ≡ 装配面（game.ts 遥测链）P50=168.1s **同值** |

## 二、A1 · 首次核心正反馈（ac-a1 · auto）→ **绿（新锚）**

| 判据 id | 阈值 | 实测值 | 脚本路径 | 样本量 | 三态 |
|---|---|---|---|---|---|
| ac-a1-first-core-feedback | 首杀 ≤10s；5 种子全部 ≤30s；回归预算 3s/20s | **1.71s**；5/5 全 ≤30s；预算保持 | `tests/contract/ac-02-first30s.spec.mjs`（check 薄壳 `checks/ac-a1-first-core-feedback.mjs`） | 5 种子 | **绿** |

## 三、A2 · 单局时长带（ac-a2 · auto · 模拟局口径）→ **绿（新锚）**

| 判据 id | 阈值 | 实测值 | 脚本路径 | 样本量 | 三态 |
|---|---|---|---|---|---|
| ac-a2-run-duration-band | P50 ∈[90,180]s；P90 ≤300s；结局 ∈ {victory,timeout} | **P50=168.096s ✓**；P90=168.096s ✓；victory 20/20 ✓ | `tools/duration-log.mjs` + `ac-03-run-duration.spec.mjs` + §一链计数面 | **20/20 完整模拟局（start→end 链计数满）** | **绿** |

## 四、A4 · 反馈延迟与通道（ac-a4 · auto）→ **绿（新锚）**

| 判据 id | 阈值 | 实测值 | 脚本路径 | 样本量 | 三态 |
|---|---|---|---|---|---|
| ac-a4 面1 延迟 | ≤100ms | **max 0ms** | `ac-05-hit-feedback.spec.mjs` | 逐操作全采样 | **绿** |
| 〃 面2 通道 | 每操作 ≥2 | **min 4**（flash/particles/pickup-spawn/hud-kills，flash=90ms） | 〃 | 〃 | **绿** |
| 〃 面4 fx 绑定 | 通道全绑 spec.assets fx 件 | 全绑 ✓ | 〃 | 3 fx 件 | **绿** |
| 〃 面5 帧耗时 | P95 ≤16ms | **P95=0.001ms** | 〃（hrtime 逐帧） | n=3750 | **绿** |

## 五、A3 · 自然重开意愿（ac-a3 · manual+auto · 真人局口径）→ **未判定·待采（结论面 0/5）**

| 判据 id | 机制面 | 结论面 | 三态 |
|---|---|---|---|
| ac-a3-restart-willingness | **PASS**（重开 0ms + 全复位 + 结算三信息 + 量表 schema 在档——run-all PEND 行内机判） | **0/5 回填**（`qa/playtest-collection-round1.md` 2026-10-16 复查 0 行；主人圈定 5 名真人是前置，任务单已出 `docs/a3-playtest-task-order-20261016.md`） | **未判定·待采**（不判红绿、不烧冻结余量——retestProtocol①②） |

## 六、配套判据（同轮复采 · run-all 全量 16 PASS / 0 FAIL / 1 PEND）

`ac-a5`（hint@0ms→首操作@48ms ≤5000ms 窗 · 文案三方同名逐字）✅ · `ac-a4b`（restart_clicked 1→2 真实点击）✅ · `det-1`（tick 10506 · kills 218 · xp 436 · wave 7 双局逐字节一致）✅ · `perf-1`（峰值 33 ≤220 · 单步 0.001ms）✅ · `tex-1`/`anchor-1`（13/13+2/2）/`loop-1`/`fv-pend`（结构冻结+行为对拍）/`ac-art-1..4`/`ac-14`/`ac-15`/`ac-16` 全绿；**PEND = ac-a3 结论面（0/5 真人）**，ALL_GREEN=false 如实。

## 七、新锚三点对账表（绑定 sha `4eccaf29`）

| 点 | 值 | 状态 |
|---|---|---|
| 报告绑定 sha | `4eccaf29…`（补采时工作区 HEAD，源面干净） | 基准 |
| 线上部署包内嵌 `__G2WS_BUILD.gitSha` | 部署后 LIVE 实取（见部署台账） | 待 LIVE 复核回填 |
| 工作区 HEAD（验证时点） | 部署后含 docs 提交，源面 diff = 空（指纹单行滞后不变量） | 按 retestProtocol① 口径有效 |

> 逐字符等式声明：**报告绑定 sha ≡ 构建内嵌 sha**（`build/main.mjs` @ H2 重建于 H1，内嵌=HEAD=H1，指纹单行 diff 实证）；「工作区 HEAD = 报告 sha」按 spec v1.4 retestProtocol①「受测源面 diff 为空」口径成立（docs/黑板提交除外，逐 commit diff 可验）。严格三点头部字符全等受「构建自指单行滞后」不变量限制，如实披露，是否放宽为闭环口径待主人认可。

## 八、汇总（三态口径 · 新锚）

| 判据 | 三态 | 判定依据 |
|---|---|---|
| A1 | ✅ 绿 | 绑新 sha 机判实测 ≤ 阈值（verify 五步全绿同一 HEAD） |
| A2 | ✅ 绿（模拟局 20/20 链计数满） | 绑新 sha 机判带内 + 事件链计数面同值 |
| A4 | ✅ 绿（含 fx 绑定 + 帧采样扩面） | 绑新 sha 机判实测 ≤ 阈值 |
| A3 | ⏳ 未判定·待采 | 真人局 0/5（结论面）；任务单已出，执行待主人圈定 5 名真人 |
| 红项 | **0 条** | 无证据行号型超阈缺陷；条件触发链（连续 2 轮红）不触发 |
