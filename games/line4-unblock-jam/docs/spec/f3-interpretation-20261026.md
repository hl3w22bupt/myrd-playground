# F3 判读细则（数值化定死版）+ id↔落点对照表 — line4-unblock-jam（2026-10-26 · 策划件）

> 上游：spec 链 v2 approved `cmvlrc0ma001tm94ialxeykjn`（numeric.telemetry 三列 + measurement 采样量定死）。
> 本文职责：把「判读」数值化到**字段级**（HUD 字段 / N 局数 / 通过区间），QA 与冒烟只对表执行，不现场发挥。
> 数值单源：全部读 `src/generated/spec-data.mjs`（≡ spec numeric），本文零第二数值面。

## 一、F3 判读三要素（数值化）

### 1. N 局数与种子带（定死）

| 项 | 数值 | 单源锚 |
|---|---|---|
| 冒烟局数 N | **20** | `numeric.measurement.smokeN=20` |
| 种子带 | **seeds 42..61（闭区间，逐局连续）** | `numeric.measurement.sampling`（生成件 `NUMERIC.smokeSeeds='42..61'`） |
| 帧采样 | 20 局全量帧（每局每帧入样） | 同上 |
| 真人样本 | 5 名（a3 记录卡，机器不代采 · 单列待采不计绿） | spec acc-a3-restart-willingness |

### 2. HUD 判读字段（F1~F4 · `src/dev/hud.ts` 模型 = 唯一判读面）

| HUD 字段 | 判读含义 | 数值来源 |
|---|---|---|
| F1 `drag_end/car_exit/complete` | g-01 三步事件计数 | 事件流实计数 |
| F1 `g-01 [拖/驶/通]` | 三步达成态（✓/…） | 会话层 g01 状态 |
| F1 `60s 余 Ns` | 引导窗口余量（秒） | 内核 elapsedMs 对 `firstGuideWindowSec=60` |
| F2 `phase/move/combo/pending` | 局态与计数名人读数 | kernel/session 只读口 |
| F2 `红轮预算 a/b` | budgetUsed/redRoundStepBudget | 12 = `numeric.redRoundStepBudget` |
| F3 `局 k/20 seed=S seeds=42..61 采样帧=F` | 冒烟进度与证据锚 | NUMERIC 直读 |
| F4 `时钟源/设备档/p95/fps_min` | 测量口径自述 | `performance.now()` 差分 · 中端 60fps |

### 3. 通过区间（六键逐键 · 全部实算非抄数）

| telemetry 键 | 通过区间 | 判读执行位 | 本轮实测 |
|---|---|---|---|
| `first60s_guide_done_rate` | **≥0.90（≥18/20）** | `tools/smoke-playable.mjs` ② | **1.00（20/20）PASS** |
| `car_exit_latency_ms_p95` | **≤100ms** | 同上 ⑤（headless 同帧机制面）+ web HUD F4 | 0.05ms（机制面同帧）PASS |
| `combo_pending_violations` | **=0（逐局事件流审计）** | 同上 ③（`auditComboStream` 逐局切分） | 0（55 帧/20 局）PASS |
| `frame_time_p95_ms` | **≤16** | acc-06 ③（headless 全量帧）+ web HUD F4 | acc-06 PASS（本机实跑） |
| `fps_min` | **≥55（中端档）** | acc-06 ④（16ms 预算→≥55fps 下限） | acc-06 PASS |
| `session_complete_rate_bot` | **≥0.85（≥17/20）** | `tools/smoke-playable.mjs` ②（同源通关计数） | 1.00（20/20）PASS |

> 单列待采（不计绿不阻塞，终裁归主人）：`acc-a3-restart-willingness`（5 名真人，0/5）。

## 二、id↔落点对照表（四方对照：acceptance id → check 文件 → 断言要点 → 资产/落点）

| id | check 文件 | 断言要点（实跑断言数见门禁日志） | 关联落点 |
|---|---|---|---|
| acc-01-seeded-determinism | `tests/contract/checks/acc-01-seeded-determinism.mjs` | 双跑逐字节一致（默认 seed + 42..61）· 全谱系可解 · 解序列稳定 · 数值锚来自生成件 | `director.ts` · `spec-data.mjs` |
| g-01-first-60s-guide | `tests/contract/checks/g-01-first-60s-guide.mjs` | 20 局 bot 达成率 ≥0.90 · 三步事件可判 | a04-guide-hand · `src/main.ts` 引导面 |
| acc-02-exit-feedback-latency | `tests/contract/checks/acc-02-exit-feedback-latency.mjs` | 判定帧→反馈同帧 · p95 ≤100ms · 三通道名写死 · assets.md §四 表头在位 | `exit.ts` · `render.ts`（burst/pop 预算） |
| acc-03-combo-pending-invariant | `tests/contract/checks/acc-03-combo-pending-invariant.mjs` | pending 零增量 · settle 通道唯一 · 20 局事件流 violations=0 | `session.ts` · `combo.ts` |
| acc-04-red-round-boundaries | `tests/contract/checks/acc-04-red-round-boundaries.mjs` | 进入/完成/失败三谓词边界值机判 · 驶出不豁免超预算 | `director.ts` · `game.ts` |
| acc-05-no-external-texture | `tests/contract/checks/acc-05-no-external-texture.mjs` | src/ 零位图引用 · 8 色白名单 · 重生成 hash 不变 | `theme.ts` · `assets/manifest.json` |
| acc-06-perf-caps | `tests/contract/checks/acc-06-perf-caps.mjs` | 实体峰值 ≤60 · 单步 16ms · 帧采样 p95 ≤16 · fps_min ≥55 · PEND 组键显式 | `loop.ts` · F4 面 |
| acc-07-telemetry-key-parity | `tests/contract/checks/acc-07-telemetry-key-parity.mjs` | hub 键集合 ≡ numeric.telemetry 三列 · 旁路键拒绝 | `telemetry.ts` · `spec-data.mjs` |
| acc-a3-restart-willingness | manual（a3 记录卡） | 5 名真人 ≥4 正向重开动机 + 原话留档 | 人工采集窗（deploy 后开） |

## 三、判读证据归档位

- 门禁证据：`.myrd/blackboard/gate-logs/line4-n4-verify-20261026/`（01 契约 29/0 · 02 套件逐件 · 03 冒烟 · 04/05 移植门禁 · 06 资产门禁 31 断言 · 07 构建 · 08 壳契约 · **09 可玩面 bot 冒烟 68 断言 = F3 六键实测载体**）。
- F3 数值化本文随冒烟记录同轮归档；冒烟输出尾行即判读结论（`PASS=68 FAIL=0` + 逐局 `seed:WIN(步数)`）。

—— 游戏策划（F3 细则与对照表）· 主策划（登记）· QA 复核：见 `docs/qa/n2-precheck-20261026.md` ② · 2026-10-26
