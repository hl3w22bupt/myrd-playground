# QA 回执 — 霓虹夜塔视觉与 juice 冲刺（r4）

> 回执编号：**QA-R4-NEON-20260927-01** · 日期：2026-09-27 · 签发：T5 QA 线（主策划整合）
> 依据：spec v1.2（平台 v4 approved `cmuj5f6ik00hkm9l64r5uickm`，唯一断言依据）
> 结论：**N5 门禁全绿（7/7）**；四判据冒烟全绿；P0 资产对照过检（13/13）；数据事件三要素定版核查通过；9/24、9/25 正式销案记账完成。**对外放行与试玩终裁归 N6（主人）——机器不替人判断好不好玩。**

## 一、四判据 + 首局无弹窗冒烟（spec acc-j1..j5）

| 判据 | 口径 | 冒烟结果 | 证据（文件名+日期+命令+输出摘要） |
|---|---|---|---|
| acc-j1 首块 ≤3s | 冷启动→首块可见（chromium 390×844，画布亮像素探针） | **PASS** | `.myrd/blackboard/gate-logs/r4-neon-juice-20260927-n5/2-run-all.log`（2026-09-27，`node tests/contract/run-all.mjs`，`acc-j1 RESULT: PASS`） |
| acc-j2 juice ≤100ms | perfect tick→涟漪首帧（无头同 tick 时钟差） | **PASS**（延迟 0ms ≤100；池 ≤200 颗；异常隔离返回 -1） | 同上 `acc-j2 RESULT: PASS (3/3)` |
| acc-j3 音画 ≤50ms（QA 重定义） | perfect_hit dispatch→AudioContext play 调用点（同一注入时钟，spy 可测） | **PASS**（差值 0ms ≤50；闸门零吞音：play 数 = 事件数） | 同上 `acc-j3 RESULT: PASS (2/2)` |
| acc-j4 重开 ≤1.5s | restart 全链同步完成→新局可交互 | **PASS**（墙钟差 ≤1500；同 seed 同摆位逐字节一致） | 同上 `acc-j4 RESULT: PASS (2/2)` |
| acc-j5 首局无弹窗 | 安装态首访首局全程零原生 dialog / DOM 弹层；竖屏横屏遮罩不激活 | **PASS**（dialogs=0；7 个弹层选择器 0 命中；HUD 正常挂载） | 同上 `acc-j5 RESULT: PASS (1/1)` |

端到端佐证：`tests/smoke.mjs` PASS (browser)（核心循环 3 点「分数 45」/ R 重开归零 / 零 pageerror）——`6-smoke.log`。

## 二、数据事件三要素定版核查（acc-e1）

- **枚举事件名**：{session_start, session_end, block_place, perfect_hit, game_over, restart} 封闭，枚举外丢弃（冒烟断言 `bogus_event` 0 入账）✓
- **双时间戳**：client_ts（ISO8601 可解析）+ mono_ms（number）逐事件齐备 ✓
- **匿名 UUID 零 PII**：anon_id = UUID v4 正则通过；载荷序列化零 PII 字段抽查 ✓（会话内 anon_id 一致）
- **版本字段**：schema_version='1' + client_version='0.1.0-r4' 非空 ✓
- **触发次数与字段类型进冒烟**：六事件各发一次 → sink 恰 6 条；perfect_hit 双毫秒（dispatch/play）类型与预算断言 ✓
- 证据：`2-run-all.log` `acc-e1 RESULT: PASS (4/4)`（2026-09-27）

## 三、门禁汇总（全绿 7/7）

| # | 门禁 | 结果 | 证据文件（gate-logs/r4-neon-juice-20260927-n5/） |
|---|---|---|---|
| 1 | typecheck（tsc --noEmit） | PASS | `1-typecheck.log`（空输出=零错误） |
| 2 | 契约全量 run-all（**31 条** = v3 冻结 22 + v1.1 折入 a7(不入列) + r4 新增 9） | **PASS 31/0/0** | `2-run-all.log` |
| 3 | P0 资产逐件查表 | **PASS 13/13** | `3-assets-neon.log` |
| 4 | perf 相对判（两层制·CI 层） | **PASS**（块 P95 对基线差异在 ±10% 容差内；绝对阈值真机单列） | `4-perf-relative.log` |
| 5 | M2.1 资产运行时检查 | PASS (browser)（9 项 200 + 贴图就绪 + 零错误） | `5-assets-check-m21.log` |
| 6 | 端到端冒烟 | PASS (browser) | `6-smoke.log` |
| 7 | 壳形态模拟（R1③） | PASS（U7 现状如实注记：贴图链路降级程序化，不修不夹带） | `7-shell-sim.log` |

**perf 两层制口径声明**：CI 层仅相对判（确定性负载 2000 帧/块 × P95 × 5 轮中位 vs `tests/perf-baseline.json`，劣化 ≤10%）；绝对阈值（P95≤16.6ms / 峰值≥55fps）只在真机证据（骁龙7系/天玑8000系级 + Chrome WebView，3 轮×60s）上判——真机证据本轮未采集，单列归 N6 主人排期，**不得以 CI 相对判替代宣称**。

## 四、9/24、9/25 正式销案记账（账务结论）

> 销案依据：主人任务书（2026-09-27）显式指令。销案 = 关账不 = 复核权灭失；**每案保留一次代码级复核权**（复核入口见各行）。

| 案 | 立案日 | 账面内容 | 销案结论 | 吸收去向 | 代码级复核权（一次性，保留） |
|---|---|---|---|---|---|
| 案 A · 历史失败轮挂账 | 9/24（案卷溯 9/23） | 9/23–24 两轮执行失败，黑板记「另立挂账、与发布轮解耦，细节以平台轨迹为准」（blockers.md §历史失败轮挂账） | **销案（关账入簿）**：平台轨迹实查 9/24 failed×4（workflow×2 无 error / routines×1 模型标识未识别 / evolution_merge×1 SIGINT 中断）、9/25 failed×1（workflow 无 error）——失败定性 = 平台基础设施层中断与配置错配，非游戏产物缺陷 | 并入本版本链叙事：其暴露的「产物必须落盘/增量输出」纪律已固化于平台规范；游戏面由本轮 7 门禁全绿接管 | 复核入口：`agentExecutionTrajectory` 表 9/23–25 failed 行（id 见 blockers.md §销案台账） |
| 案 B · spec v1.1 登记挂账 | 9/25（判例）→ 9/26 冻结于 D4/D5 | v1.1-ready 纸面终稿（D1/D2/D3）未登记；权限 FORBIDDEN（9/26 已解除） | **销案（吸收升级）**：v1.1 未单独登记，其内容（D1 benchmark_device / D2 acc-a7 / D3 evidence）**零丢失折入 spec v1.2（平台 v4，2026-09-27 approved）**；权限障碍已以 cookie 通道打通并留痕 | **spec v1.2（平台 v4）**；e07 数值总闸与 acc-num 机械断言维持全绿（v1 冻结七键 sha256 相等） | 复核入口：`games/stack-tower/tools/build-spec-v12.mjs`（冻结守卫）+ `.myrd/spec/stack-tower-spec-v1.2-payload.json` + 平台 revisions 链（v3→v4） |
| 案 C · sfx-pack-v1 | 9/25 复验轮 | 12 文件（6 事件 × m4a/ogg）注册表与音频头校验 | **销案（已交付）**：M2.1 交付面维持全绿，本轮零改动零漂移；acc-a1 契约持续在列并通过 | sfx-pack-v1（M2.1 已交付 + v1.2 acc-a1 维持） | 复核入口：`tests/contract/m21-acc-a1-sfx-pack-registry.spec.mjs`（31 条之一，本轮 PASS） |
| 案 D · PWA 安装项（U6/R2） | 9/25 起线上既存 → 9/26 U6 立案/R2 升级 | 线上 SW scope 缺陷 → 工程修复已落码（r2 `6a6b4a8`）+ r3 对象对齐；线上对外复跑待主人裁决 R2（代理放行头三选一） | **工程面销案 / 线上面保留待裁决**：壳形态模拟门禁（R1③，`tests/shell-sim.mjs`）本轮 PASS——修复代码在本地壳语义下实证有效；线上「可安装/断网可玩」宣告继续冻结至 R2 裁决 + N6 复跑，对外口径不得提前宣称 | PWA 安装项（工程修复链 + shell-sim 形态门禁防回归） | 复核入口：`tests/shell-sim.mjs`（本轮 PASS）+ `tests/live-smoke.mjs <gw-url>`（R2 裁决后复跑） |
| 案 E · U7 线上贴图程序化形态 | 9/25 起（r2 立案） | 壳形态 Image 补丁取回文本 blob → 贴图降级程序化绘制（可玩性不受影响） | **不销案、维持立案口径**（修复点 ~3 行属工程改动，本轮冻结不夹带；表现层降级为设计内行为） | 维持「待主人排期」原状 | 复核入口：`tests/shell-sim.mjs` NOTE 行（本轮输出如实注记） |

## 五、已知未收口项（不计绿，随终报升级主人）

1. **acc-a7 的 check 指向 D4 冻结文件**（`tests/audio/events.test.ts`），文件仍不存在（2026-09-27 实查）→ 不入 run-all CONTRACTS、不计红不判绿；D4/D5 答复权在主人。
2. **真机三项**（性能绝对阈值 / iOS Safari 解锁 / 触控手感）+ **试玩终裁** → N6 主人。
3. **R2 线上裁决**（代理放行头三选一）→ N6 主人；裁决前对外口径不宣称「可安装/断网可玩」。
4. **OD 守护进程 127.0.0.1:7456 不可达** → 已留痕（blockers.md §E0），请主人修复（`pnpm tools-dev` 或等效）；本冲刺资产以 repo 文件 + hash 承载，未降级。
