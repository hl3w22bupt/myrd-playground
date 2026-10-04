# B1 上头循环轮 · 门禁证据（2026-09-29 · N4 QA）

> 审输入三件：approved spec v1.4（平台 v6）+ 实现/契约输出 + 冒烟记录。回执：`games/stack-tower/docs/qa-b1.md`（8 条拒绝线逐条判定）。
> 四要素口径：每份日志含日期 + 完整命令 + 输出摘要。

| # | 文件 | 命令 | 结果 |
|---|---|---|---|
| 1 | 1-numeric-freeze.log | `node scripts/check-numeric-freeze.mjs` + `numeric-acc-num-frozen-gate` + v1.3↔v1.4 深比 | PASS（diff 为空） |
| 2 | 2-seed-repro.log | acc-b2 + acc-b3 | PASS 2/2 |
| 3 | 3-persistence.log | acc-b5 + acc-b4 | PASS 2/2 |
| 4 | 4-idempotent-crash.log | acc-b7（可注入崩溃点） | PASS |
| 5 | 5-offline-loop.log | acc-b6 + smoke browser | PASS 2/2 |
| 6 | 6-telemetry-caliber.log | acc-b6 白名单双向 + acc-e1 核心不受影响 | PASS 2/2 |
| 7 | 7-verdict-words.log | acceptance 40 条模糊词扫描 | 命中 0 |
| 8 | 8-wx-unchanged.log | `git diff 487640c..HEAD -- wx export/wx` + `check-wx-bundle-size` | diff 空 + PASS |
| 9 | 9-run-all.log | `node tests/contract/run-all.mjs` | PASS 39 / FAIL 0 |
| 10 | 10-d1-d2-regression.log | acc-d1 + acc-d2 既有项回归 | PASS 4/4 + 2/2 |

**QA 结论：通过**。仅发布 PWA 增量；wx 包零变更不进本轮交付。
