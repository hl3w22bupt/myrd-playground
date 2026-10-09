# V1.3 首批 N2 程序线独立复检（2026-10-09 · 游戏 · 新执行轨迹，不沿用前轮证据）

> 复检口径（沿 A 轮/B1 轮判例）：实现已在源仓 `feat/v1.3-nearmiss-settlement` @ `2738599`（基点 `6d3db6a` = v1.2 发布 commit）；
> 本轮**实跑全部门禁拿本轨迹自己的证据**，不引用前轮 run 的输出；源仓复跑后已恢复树净（复跑覆写的 3 个跟踪件已 checkout 还原，归档批次不变）。
> 每件证据 = 四要素头（命令/执行目录/UTC/EXIT）+ stdout 原文，见同目录 01–06 号日志。

## 结论：九项复检全绿，零新缺陷，零代码改动

| # | 复检项 | 命令 | 实测 | 结果 |
|---|---|---|---|---|
| 1 | 契约三态（Mode A/B/C） | `node scripts/check-v13.mjs` | **18 / 25 / 29+1PEND** 全符 · EXIT=0（01 号） | ✅ |
| 2 | 工程门禁八件 | `npm run gate` | ①–⑧ 全 PASS · EXIT=0（02 号） | ✅ |
| 3 | 浏览器冒烟 | `node tools/smoke.mjs` | SMOKE PASS · **J1=180.5ms ≤ 400ms** · 结算页三区块 ✓ · near-miss 构造面 ✓ · 重开同源 ✓ · 控制台零错误（03 号） | ✅ |
| 4 | P95 同机双跑对（基线 `6d3db6a` vs HEAD） | `node tools/perf-report.mjs` 双侧 | 归档对：基准 P95 **27.1ms = 27.1ms** 零退化；规格跑 73.57 ≤ 73.825 亦零退化（04/05 号）。另两组预备对同向：基准 33.9/33.49 → 32.84/26.41，三对全零退化 | ✅ |
| 5 | 聚合器确定性 | `node tools/aggregate-nearmiss.mjs` ×2 + `cmp` | 双跑输出**逐字节一致**；每数字带三标注（contractId + aggregator + pendingOnlineReview）（06 号） | ✅ |
| 6 | 判定器口径抽读（对照链 v8 六条修补） | 人工读 `src/render/nearmiss.ts` | ①行列同权（axisParity≠row-col-equal 即抛）· ①末态口径（同逻辑帧末态，契约化注释+调用方约束）· ①频控（per-row 1/局 + global ≤3/局，planShow/applyShow 分离）· ②零强反馈通道（模块无强反馈面）· ③个人最佳边界（=0 或 <PB×0.5 → edge 降级）· 三档音效用途表（tier=2 变体派生，freq 镜像 + durationScale=0.5，零手抄） | ✅ |
| 7 | 结算页槽位/文案编号 | `grep` 源码对 spec | `result-slot-score/chain/moves/attribution/action-restart/action-daily` + `nm-copy-*`/`sl-copy-*` 与链 v8 element id **逐一对应**；埋点 payload 带 `runSeq`+`seed`+`internal` | ✅ |
| 8 | v1.3 diff 路径隔离（红线：v1.2 冻结范围零接触） | `git diff --name-only 6d3db6a..HEAD` | 51 路径全落白名单（build/src/assets/tools/tests/docs/scripts/package.json/.github）；`platform/`·`export/`·wx·dy **命中 0**（06 号） | ✅ |
| 9 | 内测包同批复核 | 逐件 sha256 对 `build/` | `export/web-v13-beta` 30 文件 ≡ HEAD build **逐件全等**；`e79e1ee..2738599` 的 build/ diff 为空（同批判据成立） | ✅ |

## 交叉印证（QA 通道，不重做只对账）

- N4 verdict（前轮 QA 产出 `docs/evidence/qa-v13-batch/verdict.json`）：**APPROVE-READY · 9 checks**（Q1–Q9）——与本轮 1–9 项逐项同向（Q9 P95 对 26.1=26.1 为前轮同机对原文；本轮独立复跑另得 27.1=27.1，结论一致）。
- spec 链平台实查（本轮，经平台 DB 只读通道）：链 v8 `cmv0aoxtt004gm9vigjmn09bh` = **draft**（等待主人 approve）；链 v7 及更早全部 superseded——与黑板「approved 资质以平台链为准 / approve 归主人」口径一致。

## 红线复核

- **DoD 只首轮校准不改生效阈值**：链 v8 `ac-30` 四门槛数值（D1≥30%/D7≥10%/局均≥3min/重开率≥40%）与链 v7 逐字节全等（QA Q5 实判）；报告全文措辞机判零命中（无「已达标」类结论）。
- **样本未回收如实披露**：首轮校准样本量 0，报告不出校准值（无数据不出数）。
- **内测工具不进提审包**：聚合脚本/`__G2_INTERNAL`/`__G2_NM_LOG` 字面量零进 wx/dy 面（本轮第 8 项路径隔离 + QA Q6/Q7 双通道）。

## 环境备注

- node v26.7.0；perf 基线侧在 `/tmp/g2-perf-baseline` 临时 worktree（`6d3db6a`）实跑，`G2_SPEC_PATH` 钉工作区 approved v1.1 导出件（HEAD 侧走同源发现器，同件）。
- 复检为只读动作：源仓零新 commit（`feat/v1.3-nearmiss-settlement` 终点仍为 `2738599`）；黑板三件（levels/blockers/assets）随本目录归档同步落账于一号仓。
