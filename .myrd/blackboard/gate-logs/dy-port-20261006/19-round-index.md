# 19 号轮 — HEAD 态全链复核（2026-10-06 · 游戏美术执行 · 只读复核轮）

> 触发：本任务书再次派发，黑板已收口（N1–N5 全 ✅）。按「不装绿 + 重跑取证不认转抄」口径，
> 本轮**不重做任何冻结交付物**，只在 HEAD 提交态重跑全部机器门禁复核黑板声明，取证归档为 19 号轮。
> 取证纪律（沿 17 号）：g2 仓 HEAD=`cfb733c` 零脏文件 + run 仓零脏文件态下执行，stdout 落 /tmp 后归档本目录。

## 复核命令与结果（全部 HEAD 态实跑）

| # | 命令（g2 仓根执行） | 结果 | 日志 |
|---|---|---|---|
| a | `G2_SPEC_PATH=<run仓>/.myrd/spec/g2-blocks/design-spec.json node scripts/contract-check.mjs` | **18/18 PASS**，锚 `302e6336…` 不降，J1=177.3ms ≤400 | 19a |
| b | `node tests/run-all.mjs` | 八组台账全 PASS，exit=0 | 19b |
| c | `node tests/dy/run-all-dy.mjs` | **3/3 条目查绿**（runtime 10 + share 6 + submission 10 = 26 行，RED=0） | 19c |
| d | `node tests/dy/dy-smoke.mjs` | **PASS**：guide 293ms/23 帧 ≤400/240 · J1=155.2ms · 613 手自然炉冷 · 零错误 | 19d |
| e | `G2_REPO_ONE_ROOT=<run仓> node tools/qa-dy-port-recheck.mjs` | **14/14 无红 VERDICT: APPROVE-READY，exit=0** | 19e |

- 冒烟运行间抖动：guide 228→293ms、17→23 帧（均在预算内，与 18 号逐位同分布）；
  证据 JSON（`docs/evidence/dy-smoke-report.json`、`docs/platform/dy/qa-dy-port-verdict.json`）按 18 号口径**还原未提交**，今日绿证以 19d/19e 日志为准。
- 附带失败调用留痕（非产品证据，不归档编号件）：复检器首次调用缺 `G2_REPO_ONE_ROOT` → exit 3「缺 G2_REPO_ONE_ROOT」（显式失败不装绿，补参后 19e 通过）。

## N3 素材专项复核（美术本职 · 四项机判全绿）

| 项 | 机判口径 | 结果 |
|---|---|---|
| 派生零漂移 | icon：`assets/release/icons/icon-512.png` == `assets/dy/dy-icon-512.png` == `8a971534…`（A-01）；share：源件 == `assets/dy/` == `export/dy/assets/` 三面全等 `c705aaa6…`（A-07） | ✅ EQUAL |
| 物理隔离 | `git diff fe5fd38..HEAD -- assets/release assets/wx assets/palette` = **空**；变更面仅 `assets/dy/` + `docs/platform/dy/` | ✅ 零触碰 |
| 规格合规 | 截图 ×3 实测 780×1688（=390×844 @2x）；icon 512×512；卡 720×1280（dy-diff-09） | ✅ 全中 |
| 截图对账 | manifest 逐件 sha256+bytes 全等 3/3；同批判据 `c9d7bffb…` @ `0feac16`；三张 state 现读互异（连击张 score=160/chain=1，非摆拍） | ✅ 3/3 |

## 结论

HEAD 态全链复核**零回归**：v1.1 锚不降 + dy 新增段绿 + 先红后绿在案 + P95 配对判定在档 + N4 复检器 HEAD 态第三次独立复现 APPROVE-READY（15 号 / 17 号 / 19 号）。
黑板收口态维持不变：**approve-ready 包 + 材料清单 dy 段 v2 已就绪，等主人拍板**。本轮零改交付物、零触碰 v1.2 冻结面 / wx 冻结包 / stack-tower。
