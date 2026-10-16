# r4 程序线复跑门禁证据（2026-09-27 11:07–11:14 · 程序）

> 背景：r4 冲刺 N1–N5 已由前序执行收口（见 `../r4-neon-juice-20260927-n5/`）。本轮为**提交前独立复跑**，
> 期间发现并修复 `scripts/contract-check-stack-tower.mjs`（裸调用契约门禁）对 spec v1.2 导出形状的三处失配
> （详见 blockers.md 本轮段）。修复后 8 道门禁全绿，证据如下（每条 = 命令 + 日期 + exit + 输出摘要）。

| # | 门禁 | 命令（cwd=games/stack-tower，除注明外） | 日期时间 | exit | 输出摘要 |
|---|---|---|---|---|---|
| 1 | typecheck | `npx tsc -p tsconfig.json --noEmit` | 2026-09-27 11:08:08 | 0 | 零错误输出 |
| 2 | 契约 run-all | `node tests/contract/run-all.mjs` | 2026-09-27 11:08:3x | 0 | `PASS 31 / FAIL 0 / not-runnable 0 （共 31）` |
| 3 | P0 资产逐件查表 | `node tests/assets-neon-check.mjs` | 2026-09-27 11:08:4x | 0 | `RESULT: PASS (13/13)`（a08–a20，hex±5/禁描边/渐变二值/几何±10%） |
| 4 | perf 相对判（两层制 CI 层） | `node tests/perf-relative-check.mjs` | 2026-09-27 11:08:52 | 0 | 当前 P95=9.0631ms/2000帧 vs 基线 8.3353ms → +8.73%（容差 ±10%）；绝对阈值（P95≤16.6ms/峰值≥55fps）按真机口径单列 CI 不判 |
| 5 | 既有资产运行时（M2.1 链） | `node tests/assets-check.mjs` | 2026-09-27 11:09:0x | 0 | `PASS (browser)`：9 项资产请求全 200、fallback 404 全挂仍可玩 |
| 6 | 端到端冒烟 | `node tests/smoke.mjs` | 2026-09-27 11:09:2x | 0 | `PASS (browser)`：画布 480×720、3 连落块 分数 45、R 重开清零、零页面错误 |
| 7 | 壳形态模拟（R1③） | `node tests/shell-sim.mjs` | 2026-09-27 11:09:4x | 0 | `PASS (shell-sim)`：SW 控制页面 scope=/apps/stack-tower-3/、断网 reload 可玩（分数 35）；U7 NOTE 维持立案（案 E） |
| 8 | 裸调用契约门禁（本轮修复项） | `node scripts/contract-check-stack-tower.mjs`（cwd=repo root） | 2026-09-27 11:10–11:12 | 0 | `RESULT: PASS（spec ↔ 工程一致）`：A 段 platformSpecId=cmuj5f6ik00hkm9l64r5uickm v4 approved；B 段 31/32 PASS + acc-a7 显式 not-runnable（spec 挂账背书）；C 段 8↔9 元素（e09 折入核验）+ 23↔31 契约文件 + run-all 聚合全量核对；D 段 20/20 实体（含 3 锚点）+ kernel 纯净 10 文件；E 段 20/20 资产全 generated |
| 9 | 契约 run-all（驳回①修复后复跑） | `node tests/contract/run-all.mjs` | 2026-09-27 11:44:26 | 0 | `PASS 31 / FAIL 0 / not-runnable 0`；acc-j1 以 spec 口径实跑：`390x844=310ms · 360x640=166ms（throttle 4x）` PASS |
| 10 | 裸调用契约门禁（驳回①修复后复跑） | `node scripts/contract-check-stack-tower.mjs`（cwd=repo root） | 2026-09-27 11:5x（第二次） | 0 | `RESULT: PASS（spec ↔ 工程一致）`（B 段 31/32 + acc-a7 挂起；其余同 8 号）；第一次复跑曾现 acc-j5 瞬时 FAIL（状态断言非时序判据，独立复跑 3/3 PASS），见 §驳回处置 |
| 11 | 端到端冒烟（驳回处置后提交前） | `node tests/smoke.mjs` | 2026-09-27 11:5x | 0 | `PASS (browser)`：3 连落块 分数 45、R 重开清零、零页面错误 |

## acc-j1 记录（2026-09-27 驳回①更正版）

- **原表述更正**：本 README 初版写「测试实现与 spec acc-j1 语句一致」——**该表述失实**（驳回①成立）。
  当时实现**缺 `numeric.benchmark_device.LAB_CPU_THROTTLE_X=4` 的 CPU 节流注入**（`_browser.mjs` 无
  CDP 能力），且仅跑 390x844 单视口（`LAB_VIEWPORTS_PX` 声明 390x844/360x640 两档）→ 无节流下
  ≤3000ms 判据偏松，本目录 1–8 号证据中的 acc-j1 绿**在 spec 口径下未证立**。
- **修复（2026-09-27 驳回①）**：`_browser.mjs` 新增 `newBenchmarkPage()`（CDP
  `Emulation.setCPUThrottlingRate` 注入，goto 前生效）；`juice-acc-j1-first-block.spec.mjs` 重写为
  spec 口径——口径参数自 `loadSpec().spec.numeric.benchmark_device` 读入（不本地重定义），4x 节流 +
  双视口逐档测量逐档断言，两档全过才计绿；`performance.now()` 为墙钟，测得节流下用户体感冷启动。
- **spec 口径复测（4x throttle）**：单测 390x844=419ms · 360x640=163ms PASS；run-all 内
  390x844=310ms · 360x640=166ms PASS（9 号日志）。**节流真实生效反证**：20x 档位探针 242ms→599ms
  （2.5x 膨胀；注入若为 no-op 两者应相等）。
- **早前观测保留（负载敏感性，仍成立）**：11:10 门禁 8 首跑曾现 1 次 acc-j1 瞬时 FAIL（页内时钟
  超预算），与门禁 4 同期负载尖峰（perf +8.73% vs N5 首跑 -12.73%）同源；独立复跑 5/5 PASS。
  判据零放松：预算 3000ms、无重试。

## 驳回处置记录（2026-09-27 · 三项）

- **① 一致性 acc-j1**：成立，已修复（见上节）。方向 = 测试就范于 spec（spec 的
  content.benchmark 冻结条款明确「换节流档位/换视口必须先升策划案版本」——程序不得反向私改语义）。
- **② N6 物证标识**：成立。`docs/n6-master-decision-memo-r4.md` §二.1 首图定稿对象已由作废
  `01ea413e15e4c6ed…` 更正为现行 `098e28b7f1a29479…`（三处一致基准：`assets/reference/neon-night-quad-v1.manifest.json`
  + 实算 sha256 + `docs/style-card-neon-night-v1.md` §5 勘误 + `assets.md` §r4 复检）。
- **③ 证据条款**：成立。N5 `1-typecheck.log` 原件 0 字节无效（缺命令/日期/摘要）→ 原件保留 +
  文件内补记行留痕，typecheck 四要素证据转移至本目录 1 号（2026-09-27 11:08:08 exit=0）；N5 README
  重写为四要素补正版（2–7 号命令补录 + 证据转移登记）；blockers.md 头部失实表述已更正。
- **acc-j5 瞬时 FAIL 附记（如实）**：门禁 10 第一次复跑（11:4x）acc-j5 状态断言瞬时 FAIL 1 次
  （非时序判据），独立复跑 3/3 PASS，第二次门禁复跑 PASS。连同 acc-j1 负载敏感记录，浏览器级契约
  在门禁机连续重负载窗口存在偶发抖动——建议 QA 在空载窗口复核一轮；本轮未对测试加重试/豁免，
  判据语义零变更。

## E0 环境异常复核（2026-09-27 11:11:53）

- **OD 守护进程 127.0.0.1:7456 仍不可达**：通道① `curl -m 5 http://127.0.0.1:7456/` → `http_code=000`（connection refused）；
  通道② open-design MCP `get_active_context` → 原文报错 `cannot reach the Open Design daemon ... Start it with 'pnpm tools-dev'`。
  双通道独立复现 → **维持升级主人待修**，本轮验收物继续以 repo 文件 + hash 为准（不依赖 OD 画布，不降级为纸面件口径不变）。
- **cwd 非 repo root 异常：未复现**。`pwd` = `git rev-parse --show-toplevel` = 同一路径，一致。
