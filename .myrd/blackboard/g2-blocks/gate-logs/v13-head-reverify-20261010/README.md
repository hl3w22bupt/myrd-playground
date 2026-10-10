# v1.3 对账收口 · 主仓 HEAD 独立复证轮（2026-10-10 · 游戏程序）

## 为什么有这一轮

对账收口轮（`gate-logs/v13-a1-merge-20261010/`）的四件门禁证据绑定在 **merge commit `e4c65f9`**；
其后源仓 main 又前进一个提交 **`26ba1d9`**（A2+A3 收口归位：链 v9 入链器 + QA 正式审查报告 +
复检器同批证据 + 构建重建），**r5 部署面（deployment v15）正是从 `26ba1d9` build/ 导出**，
但当时未在 `26ba1d9` 归档全量门禁原文。本轮补齐：在**当前主仓 HEAD** 实跑全部门禁并归档原文，
使「A1-3 主仓 HEAD 复跑 + sha 绑定证据」对**部署所用的同一提交**成立。

## 复证口径

- **复证非重做**：零代码改动、零 spec 变更、零部署动作；冒烟覆写件 `.j1-evidence.json`
  复跑后已还原（源仓树净，`02` 尾行 `TREE_RESTORED_DIRTY=0`）。
- 绑定对象：源仓 `g2-blocks` 仓 main @ `26ba1d9a1c663edb53ad537777abf902fe6fd296`（树净）。
- 判据不放宽：与对账收口轮同一组命令、同一组预期值。

## 结论（全部原文在档）

| # | 项 | 命令 | 结果 | 原文 |
|---|---|---|---|---|
| 1 | HEAD 与树净 | `git rev-parse HEAD` + `git status --porcelain` | `26ba1d9…` · DIRTY=0 | `00` |
| 2 | 契约三态 + 根契约 | `node scripts/check-v13.mjs` + `node scripts/contract-check.mjs` | **18/25/29+1PEND 全 PASS** + 根契约 **18 PASS/0 FAIL** · EXIT=0 | `01` |
| 3 | 八门禁 | `npm run gate` | **①–⑧ 全 PASS · EXIT=0** | `02` |
| 4 | 冒烟（浏览器 CDP） | `node tools/smoke.mjs` | **SMOKE: PASS** · J1=**170.4ms** ≤400（4x throttle 390x844）· 结算页三区块 ✓ · near-miss 构造面 ✓ · 控制台零错误 | `02` |
| 5 | B2 预置件① 空壳冒烟 | `node templates/next-line-scaffold/tools/smoke.mjs` | **SCAFFOLD-SMOKE: PASS（4/4）** | `03` |
| 6 | 部署面三向绑定复证 | `diff -rq export/web build` | **逐字节相等（30 文件）** | `03` |
| 7 | 跨线零接触 | `git status` + `git diff --name-only HEAD~1 HEAD` 过滤 | **ZERO-TOUCH**（games/stack-tower · games/game · 根 apphost.toml 命中 0） | `03` |

## 与既有证据的关系

- `v13-a1-merge-20261010/00–04`（@ `e4c65f9`）：A1 四件同包 merge 的门禁证据 —— **继续有效**。
- `v13-a1-merge-20261010/05–06`（A2 复检 9/9 + 链 v9 入链）、`07`（r5 部署 LIVE 自测）—— **继续有效**。
- 本目录（@ `26ba1d9`）：补齐「部署所用提交 = 门禁实跑提交」的 sha 绑定闭环，供 QA/主人对账时逐件核对。
