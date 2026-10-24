# 双轨轮复测报告 · 三点重锚 + 固化连跑（2026-10-17 · 游戏程序）

> 署名：游戏程序（主策划工作室代行节点）· **绑定 sha：`994525799e0842f518166846824753a8ad7fcbc7`**（采样/构建时点工作区 HEAD）
> 契约输入：spec **v1.4（链 v6 `cmv8xcexk0009m9dj6ev1dj0r` · approved · 唯一）**导出件 `.myrd/spec/wheat-squad/design-spec.json`
> 前置地基：A1 三方对账（`gate-logs/dualtrack-20261017/00-a1-sha-sources.log`）= ②LIVE≡③10/16报告绑 `4eccaf29` 全等、①工作区 HEAD `98d1fbe` 不等 → 按任务口径全量「未判定·待采」+ **当轮执行采样计划**（本报告即采样计划产物）
> 原始输出：`.myrd/blackboard/wheat-squad/gate-logs/dualtrack-20261017/00..05`（各带命令/UTC/退出码）

## 一、A1 复核 · 新锚三点对账表（绑定 sha `9945257`）

| 点 | 值 | 状态 |
|---|---|---|
| 报告绑定 sha（=采样/构建时点 HEAD） | `994525799e0842f518166846824753a8ad7fcbc7` | 基准 |
| 线上部署包内嵌 `__G2WS_BUILD.gitSha` | `994525799e0842f518166846824753a8ad7fcbc7`（**v23 `cmvbqnwl…` 继任单 running @ 发布 commit `c325b27` LIVE 实取**，UTC 2026-10-17T01:53:48Z） | **≡ 报告绑定 sha 逐字符全等 ✓** |
| 工作区 HEAD（复核时点） | `c325b2791963b55b7113909d4568741d4b2e6f7d` 及其后证据提交 | 相对绑定点 `git diff 9945257..HEAD -- src tests tools ci spec.json` = **空**（retestProtocol① 源面零漂移口径有效；「构建自指单行滞后」不变量如实维持披露，严格闭环口径仍待主人认可） |

**LIVE 三点自测（v23）**：①`/gw` title=麦浪小队 ✓ ②LIVE `main.mjs` md5 `53eaebce53e49be5170b82989b018f80` ≡ 本仓 build **逐字节** ✓ ③内嵌 sha ≡ 报告绑定 sha ✓ + specAnchor=`cmv8xcexk@v6:approved` ✓；**WS-LIVE-SMOKE PASS**（ready→拖动击杀 2→victory 167s→console 零错误，`LIVE_SMOKE_EXIT=0`）。A3 真人试玩采集面 = **v23 LIVE @ 绑定 sha `9945257`**。

## 二、门禁固化连跑（QA「同一 HEAD 连续两次实跑一致」口径）

| 次 | UTC | 命令 | 退出码 | 判定面 |
|---|---|---|---|---|
| run3 | 2026-10-17T01:41± | `cd games/wheat-squad && bash verify.sh` | VERIFY_EXIT=0 | 16 PASS / 0 FAIL / 1 PEND |
| run4 | 同 HEAD 随后 | 同上 | VERIFY_EXIT=0 | 16 PASS / 0 FAIL / 1 PEND，**判定面逐字节一致**（两次输出 diff 判定行零差异；冒烟墙钟 `first_loop_complete` 7744/7760ms 级微差属浏览器定时器抖动，判定均 PASS 窗内） |
| 先期佐证 run1/2 | 01:3x | 同上 @ HEAD `98d1fbe` | VERIFY_EXIT=0 ×2 | 同值（跨两 HEAD 判定面同值，因源面零交集） |

**固化成立（非 flaky）**：spec acceptance 16 条 ↔ `tests/contract/checks/` 16 件同名薄壳在盘实跑全过（统一契约对账 56/0 + SCOPE-GUARD 双模式 PASS）。

## 三、判据判定表（绑新 sha `9945257` 实跑）

| 判据编号 | 类型 | 阈值 | 实测（run3≡run4） | check 文件 | 三态 |
|---|---|---|---|---|---|
| ac-a1-first-core-feedback | auto | 首杀 ≤10s；5 种子 ≤30s；预算 3s/20s | **1.71s**；5/5 ≤30s；预算保持 | `checks/ac-a1-first-core-feedback.mjs` | **绿** |
| ac-a2-run-duration-band | auto·模拟局 | P50∈[90,180]s；P90≤300s；结局集 | **P50=168.096s ✓ · victory 20/20 · start→end 链 20/20**（kills 唯一值=4 种子敏感机判过） | `checks/ac-a2-run-duration-band.mjs` + `tools/r1re-a2-chain-count.mjs` | **绿** |
| ac-a3-restart-willingness | manual·真人局 | ≥4/5 真人重开 ≥2 局且理由原话非空 | 机制面 PASS（重开 0ms+全复位+结算三信息）；**结论面 0/5 回填** | `checks/ac-a3-restart-willingness.mjs`（PEND 行内机判）+ 记录卡 | **未判定·待采**（不判红绿不烧余量） |
| ac-a4-feedback-channels | auto | ≤100ms；≥2 通道；帧 P95≤16ms | **max 0ms · min 4 通道 · flash=90ms · fx 全绑 · n=3750 P95=0.001ms** | `checks/ac-a4-feedback-channels.mjs`（五面） | **绿** |
| ac-a5 / ac-a4b / det-1 / perf-1 / tex-1 / anchor-1 / loop-1 / fv-pend / ac-art-1..4 / ac-14 / ac-15 / ac-16 | auto | （spec v1.4 各 statement） | 全 PASS（det-1：tick 10506·kills 218·xp 436·wave 7 双局逐字节） | `checks/` 同名 12 件 | **绿** |

**合计 16 PASS / 0 FAIL / 1 PEND · ALL_GREEN=false（PEND=ac-a3 结论面 0/5 真人，如实）**

## 四、部署链与发现（如实披露）

| 项 | 值 |
|---|---|
| v21（外来，10/16T03:48Z） | `cmvafh9i1001em94lwu8osw8u` running @ commit `af399d7`——**该 commit 不在本仓任何本地历史**（`git log --all` 零命中），黑板此前的「采集面=v20」口径已过期；其服务字节与本轮 01:26Z 探测 md5 `67a60360`（4eccaf29 内嵌）同源 → A3 采集面字节等效性未破坏，**但坑位被外来单接管的治理面风险升级主人关注** |
| v22（本轮误窗） | POST 响应 HTTP=000（网关截断），按 504 判例 GET 复查发现已受理 **building**，单次受理未盲重发；其构建取到推送前远端 HEAD `98d1fbe`（旧产物）→ running 窗口如实登记，随即被 v23 接管 |
| **v23（本轮重锚）** | **`cmvbqnwlu002jm9axo2xszcp8` running/current @ 发布 commit `c325b27`**（gitRef=本分支 · manifestPath=games/wheat-squad/apphost.toml · mode=bundle · errorMessage=null）· 分支先推远端（`98d1fbe..c325b27` fast-forward）后发起 ✓ |

## 五、A2 分支判读（QA 核签）与 A3 分支执行

- **A2**：按 10/16 三态分流表逐判据复核 @ 新锚——绿必须「测试实跑绿」✓（§二§三实证）；红必附证据行号——**红 0 条**；结论 JSON 收口落黑板（`.myrd/blackboard/wheat-squad/a2-verdict-20261017.json`，QA-L3 双签号 QA-WS-DUAL-20261017-01）。
- **A3 互斥分支**：有红→R2？**否（红 0 条，R2 修复批 0 件，禁碰判据条款未触发）**。全绿→固化+提审就绪？**否（ac-a3 结论面未判定 0/5，非全绿——固化面已成立（§二），但「提审就绪」分支按任务口径要求全绿，不触发）**。→ 本轮轨道 A 终局 = **重锚闭环 + 固化维持 + A3 真人面挂起待主人**（升级事项维持：圈定 5 名真人，任务单 `docs/a3-playtest-task-order-20261016.md`，采集面=v23 LIVE @ `9945257`）。
- 治理预授权条款未触发（无「复测核心判据仍红」面）；「三轮不达」冻结计数器 0/3 维持（两轮未采既未消耗也未累积）。

## 六、上一轮遗留 F1/F2/F3 修正的 QA 复签（本报告 §三证据即复签基础）

- [x] **复签项 ①**（事件链证据失真修正）：修正版链日志在档且 ac-a2 判定值同值复现（P50=168.096s · victory 20/20 · 链 20/20）——本轮 run3/4 独立实跑确认
- [x] **复签项 ②**（修正轮未触 src）：本轮重锚亦零源面变更（diff 为空实证），绑定点演进 `4eccaf29`→`9945257` 经由全量重采而非沿用
- [x] **复签项 ③**（「全模拟局」证据基础）：以修正版链日志 + 本轮实跑为准，真人局仍 0 局零混入
- QA 复签：**QA-WS-DUAL-20261017-01 · verdict=F1FIX 三项复签通过，分流表 v2 终局在新锚下维持**
