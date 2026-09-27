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

## acc-j1 负载敏感性记录（如实，不放松判据）

- 门禁 8 首跑（11:10 前后，紧随门禁 2–7 连续执行后）出现 1 次 acc-j1 瞬时 FAIL：
  `冷启动 → 首块可见 ≤3000ms` 页内时钟超预算——与门禁 4 同期观测到的机器负载尖峰同源
  （perf 相对判本轮 +8.73%，较 N5 首跑 -12.73% 明显劣化，判读为环境噪声非代码回归）。
- 独立复跑：3 连跑 = FAIL/PASS/PASS（恰为负载回落窗口）；随后 5 连跑 = **5/5 PASS**。
- 判据口径未做任何放松：无重试、预算仍为 `theme.FIRST_BLOCK_BUDGET_MS(3000)`、页内时钟口径不变；
  测试实现与 spec acc-j1 语句一致，属环境抖动记录，不构成门禁豁免。
- 建议（QA 参考）：acc-j1 类浏览器级冷启动判据在门禁机上宜避开连续重负载窗口执行，或空载复跑一轮取证。

## E0 环境异常复核（2026-09-27 11:11:53）

- **OD 守护进程 127.0.0.1:7456 仍不可达**：通道① `curl -m 5 http://127.0.0.1:7456/` → `http_code=000`（connection refused）；
  通道② open-design MCP `get_active_context` → 原文报错 `cannot reach the Open Design daemon ... Start it with 'pnpm tools-dev'`。
  双通道独立复现 → **维持升级主人待修**，本轮验收物继续以 repo 文件 + hash 为准（不依赖 OD 画布，不降级为纸面件口径不变）。
- **cwd 非 repo root 异常：未复现**。`pwd` = `git rev-parse --show-toplevel` = 同一路径，一致。
