# R1 复测三态分流收口轮 · 绑新 sha 补采报告（2026-10-16 · 游戏程序）

> 署名：游戏程序（主策划工作室代行节点）· **绑定 sha：`4eccaf293b11052041860ff7b0ee3141975258fd`**（补采时工作区 HEAD，干净源面）
> 契约输入：spec **v1.4（链 v6 `cmv8xcexk0009m9dj6ev1dj0r` · approved · 唯一）**导出件 `.myrd/spec/wheat-squad/design-spec.json`（2026-10-16 链锚核 DEEP_EQUAL=True 零漂移）
> 前置地基：`docs/r1re-sha-reconciliation-20261016.md`（旧三点链不成立 → 全量「未判定·待采」→ 本轮补采）；分流表 `docs/r1re-triage-table-20261016.md`
> 原始输出归档：`.myrd/blackboard/wheat-squad/gate-logs/r1re-recheck-20261016/05..07`（各带命令/UTC/退出码）
> 确定性红线：本次补采与 R1 轮（`f0fca52` 采样、`7b45b44` 复采）实测值**逐项同值**（A1 1.71s / A2 P50=168.096s / A4 0ms·4 通道）——同 seed 同代码确定性复现

## 一、A2 事件链计数面（本轮任务书新增口径 · start→end 链）

| 项 | 值 |
|---|---|
| 工具 | `tools/r1re-a2-chain-count.mjs`（game.ts 装配面真实 step 驱动 · 遥测直读，禁自算替代）· **F1 驳回修正版（2026-10-16）**：装配后、首个 tick 消费前覆写 `cfg.rng=seededRng(seed)`——修正前 seed 只进标签未传装配，20 行实为同一种子复制（红证据 `gate-logs/r1re-f1-fix-20261016/00..02`） |
| 结果 | **20/20 链完整**（每局恰 1 条 `run_start` 且其后恰 1 条 `run_end`，链长=2 有序）· P50=168.1s ∈[90,180] · P90=168.1s ≤300 · **victory 20/20** · 带内=true · **种子敏感机判过（kills 唯一值=4 ≥2，fail-closed 断言）** |
| 口径纪律 | 全部模拟局（**20 真实种子 = DEFAULT_SEED+i 经 cfg.rng 装配生效**，样本意图 = spec ac-a2 statement `sampleSeeds(20) 种子局`），**禁混真人局**（真人面归 ac-a3，retestProtocol② 不混算）；ac-a3 机制面 check 与契约判定面（checks/ac-a2 → ac-03 判例经 helpers.driveRun 真实变 seed）零改动 |
| 落档 | `qa/r1re-a2-chain-log-2026-10-16.json`（逐种子链 + durationMs ≡ tick×16ms 断言 + 种子敏感披露 + binding.gitSha=重采时 HEAD `b086c6f`/链锚 v6 approved——F2 修正：绑定面改 loadSpecRow()，specChainId/Version/Status 不再 null） |
| 双面对拍 | 内核面（duration-log/run-all ac-a2）P50=168.096s ≡ 装配面（game.ts 遥测链）P50=168.1s **同值**；时长同值 = 仿真结构性质（victory 局时长由波次节拍 victoryWaves×wave.seconds 决定，种子敏感面在敌序列/击杀数——kills 唯一值=4 机判披露），非复制 |

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
| 线上部署包内嵌 `__G2WS_BUILD.gitSha` | `4eccaf293b11052041860ff7b0ee3141975258fd`（**v20 `cmvab0wd2000qm92cul589eyq` running @ 发布 commit `3828f49` LIVE 实取**） | **≡ 报告绑定 sha 逐字符全等 ✓**（`10/12` 号证据） |
| 工作区 HEAD（验证时点） | 部署后含 docs 提交，源面 diff = 空（指纹单行滞后不变量） | 按 retestProtocol① 口径有效 |

**LIVE 三点自测（v20）**：①`/gw` title=麦浪小队 ✓ ②LIVE `main.mjs` md5 `67a60360d82410d504cd96077ca31cb7` ≡ 发布 build **逐字节** ✓ ③内嵌 sha ≡ 报告绑定 sha ✓ + specAnchor=链 v6 approved ✓；**WS-LIVE-SMOKE PASS**（ready→拖动击杀 2→victory 167s→console 零错误，LIVE_SMOKE_EXIT=0）。⚠️ 首探（01:45:12Z，POST 后 71s）仍取到 v19 旧字节 = 运行面切换窗口，21s 后复探即新字节——如实留痕 `10/12` 号证据，非部署缺陷。A3 真人试玩采集面 = **v20 LIVE @ 报告绑定 sha**。

> 逐字符等式声明：**报告绑定 sha ≡ 构建内嵌 sha**（`build/main.mjs` @ H2 重建于 H1，内嵌=HEAD=H1，指纹单行 diff 实证）；「工作区 HEAD = 报告 sha」按 spec v1.4 retestProtocol①「受测源面 diff 为空」口径成立（docs/黑板提交除外，逐 commit diff 可验）。严格三点头部字符全等受「构建自指单行滞后」不变量限制，如实披露，是否放宽为闭环口径待主人认可。

## 八、汇总（三态口径 · 新锚）

| 判据 | 三态 | 判定依据 |
|---|---|---|
| A1 | ✅ 绿 | 绑新 sha 机判实测 ≤ 阈值（verify 五步全绿同一 HEAD） |
| A2 | ✅ 绿（模拟局 20/20 链计数满） | 绑新 sha 机判带内 + 事件链计数面同值 |
| A4 | ✅ 绿（含 fx 绑定 + 帧采样扩面） | 绑新 sha 机判实测 ≤ 阈值 |
| A3 | ⏳ 未判定·待采 | 真人局 0/5（结论面）；任务单已出，执行待主人圈定 5 名真人 |
| 红项 | **0 条** | 无证据行号型超阈缺陷；条件触发链（连续 2 轮红）不触发 |

## 九、QA 驳回修正记录（F1/F2/F3 · 2026-10-16 · 游戏程序 · 先红后绿）

> 驳回全文见 QA 反馈件；本段为程序侧逐条修正闭环，**分流表 QA 复签待 QA 节点执行**（程序不代签）。

| 项 | 驳回伤情（已核实属实） | 修正动作 | 红绿证据 |
|---|---|---|---|
| **F1** A2 链计数证据失真 | `tools/r1re-a2-chain-count.mjs:31-32` seed 只进标签；`src/game.ts` createGame 硬绑 DEFAULT_SEED 无 seed 形参；`src/kernel/sim.ts:80` void seed（真实种子面=cfg.rng）→ 链日志 20 行同一种子逐字节复制（durationMs 全=168096），§一「全部模拟局（DEFAULT_SEED+i）」失实，不符 ac-a2 statement `sampleSeeds(20) 种子局` 样本意图 | 采解锁动作第二路径（**不触 src**）：工具装配后、首个 tick 消费前覆写 `cfg.rng=seededRng(seed)`（≡契约 helpers.driveRun opts.seed 装配语义；sim 内全部随机消费点 `st.cfg.rng.next()`）真实重采 20 种子；新增种子敏感机判 fail-closed（kills 唯一值 <2 ⇒ 显式失败）；method 串与 §一同步如实改写 | 红：旧件备份 `00` + 旧工具复跑 `01` + 机检 FAIL exit=1 `02`；绿：重采 exit=0 `03`（20/20 链 · P50=168.1s · victory 20/20 · **kills 唯一值=4**）· 连跑二次判定面逐字节同值（仅 generatedAtUtc 时间戳行异）`06/07` 非 flaky |
| **F2** 链日志绑定三链字段 null | `loadSpec()` 回 `.spec` 内容面剥 `_platform` → binding.specChainId/Version/Status 恒 null | 绑定面改 `loadSpecRow()`（wrapped 全件）；重采后 binding = `cmv8xcexk0009m9dj6ev1dj0r` @ v6 `approved` 全非 null（见 03/06 号日志 binding 段） | 随 F1 重采件生效 |
| **F3** spec README 索引滞后（记账不阻塞） | `.myrd/spec/README.md` 未登记 wheat-squad spec 导出件与顶层 design-spec.json 门禁适配视图化 | 已补登记（本修正轮 commit 内 `.myrd/spec/README.md`） | 记账面，无门禁耦合 |

**未触 src 声明与部署对账不变**：本轮变更面 = `tools/` + `qa/` + `docs/` + 黑板，`src/tests/ci/assets/apphost/spec` 零 diff → 驳回条件句「若触 src 复跑 verify 全套并重部署」中重部署分支不触发。确定性重建零内容漂移证明：重建 vs LIVE 字节 diff = 仅 `__G2WS_BUILD.gitSha` 单行（构建自指滞后不变量，build.mjs 只写 HEAD sha 零时间戳），游戏逻辑字节逐字节全等，specAnchor v6 不变（`gate-logs/r1re-f1-fix-20261016/04`）。verify 五步全量复跑 **VERIFY_EXIT=0**（56/0 + 16/0/1PEND + SMOKE + 双 GUARD，`05`）——零回归，A1/A2/A4 绿判定维持绑 `4eccaf29`（src 面零变更，retestProtocol①「受测源面 diff 为空」口径不变）。
