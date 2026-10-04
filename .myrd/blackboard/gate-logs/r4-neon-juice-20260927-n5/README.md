# r4 N5 门禁证据（2026-09-27 · 四要素补正版）

> 原始落盘：2026-09-27 10:52–10:53（目录时间戳）。七道门禁当时判定 7/7 全绿，**但证据文件未达
> spec v1.2 content.evidence 四要素条款（文件名+日期+命令+输出摘要）**：1 号原件 0 字节（全缺，无效），
> 2–7 号仅有输出摘要、缺命令与执行时刻头。2026-09-27 驳回③立案，本节即补正登记；完整四要素复跑链
> = `../r4-neon-juice-20260927-prog-recheck/`（同口径命令于 2026-09-27 11:07–11:14 复跑，8 文件
> README 表格逐条含命令+日期+exit+摘要，且含驳回①修复后的 acc-j1 spec 口径复跑）。

## 门禁命令补录（原日志缺命令头的补正）

| # | 门禁 | 命令（cwd=games/stack-tower，除注明） | 原判定 | 输出摘要（原件内） |
|---|---|---|---|---|
| 1 | typecheck | `npx tsc -p tsconfig.json --noEmit` | exit=0（README 原行） | **原件 0 字节，无摘要——证据无效**（见下节） |
| 2 | 契约 run-all 31 条 | `node tests/contract/run-all.mjs` | PASS | `PASS 31 / FAIL 0 / not-runnable 0 （共 31）` |
| 3 | P0 资产逐件查表 | `node tests/assets-neon-check.mjs` | PASS | `RESULT: PASS (13/13)` |
| 4 | perf 相对判（两层制 CI 层） | `node tests/perf-relative-check.mjs` | PASS | P95=7.2744ms vs 基线 8.3353ms → -12.73%（容差 ±10%），绝对阈值真机单列 |
| 5 | 既有资产运行时（M2.1 链） | `node tests/assets-check.mjs` | PASS | `RESULT: PASS (browser)`：9 项资产 200 + 404 fallback 可玩 |
| 6 | 端到端冒烟 | `node tests/smoke.mjs` | PASS | `PASS (browser)`：画布就绪、3 连落块、R 重开清零、零页面错误 |
| 7 | 壳形态模拟（R1③） | `node tests/shell-sim.mjs` | PASS | `PASS (shell-sim)`：SW scope 页面目录形态、断网 reload 可玩；U7 NOTE 维持立案 |

## 证据条款补正（驳回③ · 2026-09-27）

- **1-typecheck.log 原件 0 字节 = 该条 N5 门禁证据无效**（缺命令/日期/输出摘要三要素）。
  处置：原件保留原样不涂改（见同目录 `1-typecheck.log`，文件内补记行留痕）；**本条证据转移登记至
  `../r4-neon-juice-20260927-prog-recheck/1-typecheck.log`**（2026-09-27 11:08:08，命令
  `npx tsc -p tsconfig.json --noEmit`，exit=0，四要素完整）。N5 门禁「typecheck 绿」的判定因此
  **以补正链为准**：原执行无法回溯取证，不复原状、不冒认原始输出。
- **2–7 号：输出摘要与 RESULT 行完整、命令与时刻缺失**。命令已在上表补录（与项目脚本逐一对应可复核）；
  执行时刻仅能以目录时间戳锚定到 2026-09-27 10:52–10:53。四要素完整替代证据 =
  `../r4-neon-juice-20260927-prog-recheck/` 2–7 号日志（2026-09-27 11:08–11:09 复跑，同命令同口径，
  除 perf 数值自然波动外判定一致）。
- **acc-j1 特别登记（驳回①）**：N5 时点的 acc-j1 契约实现**不符合 spec 实验口径**
  （缺 `LAB_CPU_THROTTLE_X=4` 节流注入、仅 390x844 单视口），N5「四判据全绿」中该条在 spec 口径下
  未证立。修复与复测见 `../r4-neon-juice-20260927-prog-recheck/` §驳回①修复记录。
- 失实表述一并更正：blockers.md 头部原「七文件每文件含命令+日期+输出摘要」不成立，已更正。
