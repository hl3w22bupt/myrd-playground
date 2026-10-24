# QA 预审回执 — spec v1.4（R1 复测收口轮 · 判读纪律增补）

> 回执 id：QA-WS-V14-20261015-01 · 日期：2026-10-15 · 审签：游戏 QA（主策划工作室代行节点）→ 主策划 approve
> 对象：链 v6 `cmv8xcexk0009m9dj6ev1dj0r`（draft → approve）· 父版 = 链 v5 `cmv7hekf3000mjofivl4ebhdf`（approved v1.3）
> 依据：meta.feedbackProtocol「QA 四要素联审（id/auto-manual/check 可跑/可判定）→ approve」+ 本轮任务书「交主策划 approve」授权

## 四要素联审（逐条）

| # | 要素 | 结论 | 证据 |
|---|---|---|---|
| 1 | id 集不变 | ✅ acceptance 16 条 id 集与 v1.3 深等（零增删） | `02-v14-approve.log` QA 预审行（accEq=true） |
| 2 | auto/manual 模式不变 | ✅ 零改动（acceptance 面逐字节冻结，建版器守卫机判） | `tools/build-spec-v1_4.mjs` FROZEN 六段守卫 PASS |
| 3 | check 可跑 | ✅ 16 条 check 路径全部在盘可执行（本轮 verify.sh 步①②复跑全绿） | `gate-logs/r2-recheck-20261015/04-v14-verify.log`（VERIFY_EXIT=0） |
| 4 | 可判定性 | ✅ 唯一增量 = meta.retestProtocol 三条款（sha 绑定/A2-A3 口径/连击纪律），均为判读纪律而非判据阈值——不新增不可判定条款 | payload `.myrd/spec/wheat-squad/design-spec-v1_4-payload.json` |

## 预审结论

**APPROVE-READY** → 主策划 approve（任务书明示授权「交主策划 approve」；approve 后三重回查 PASS：本版 approved + 范围 approved 唯一 + 链 v1..v5 superseded 零覆盖 + sortKeys 内容全等零漂移）。

## 红线核验（任务书「A1/A2/A4 阈值一律不动」）

- numeric 段深等 = true（含 firstCore.maxLatencySec(10s)/runDuration P50 90–180/P90 300/latencyBudgetMs(100ms) 等全部阈值键）——建版器 + 入链后回读双侧机判。
- acceptance 段深等 = true（A1–A5/a4b 语句含阈值字面零改动）。

## 附：通道实录

- POST `/api/v1/game-design-specs/cmv7hekf3000mjofivl4ebhdf/revisions` → **HTTP 201**（draft，version 5→6）
- POST `/api/v1/game-design-specs/cmv8xcexk0009m9dj6ev1dj0r/approve` → **HTTP 200**（approved）
- 平台语义留痕：revise 事务将父版 v5 置 superseded（v1..v5 全 superseded，零覆盖保序）；approve 事务保证同 scope approved 唯一。
- 工具误报留痕：approve 脚本内联 sortDeep 比对首报 DRIFT，经文件级复跑（heredoc）+ python 逐键类型严格 walk 双通道证为**执行伪影**（内容实际全等，len 16474 = 16474 零字符分歧）；后续比对一律用文件级脚本不复用内联 -e。
