# freeze-sprint-r1-recheck-20261008 — 封版冲刺第 1 批 · 程序线复核轮（守卫缺陷修复）

> 复核人：游戏程序（2026-10-08）。触发原因：任务重派后的「不采信台账、实跑复核」纪律。
> 结论：**抓到并修复 1 个真实缺陷**（详见 §一），修复后六门全绿，冲刺交付面恢复成立。

## 一、缺陷与修复（本轮唯一实质变更）

| 项 | 内容 |
|---|---|
| 缺陷 | 前轮 N2⑤ 交付件 `scripts/redline-selfcheck.mjs` 随 `b8ac090` 入源仓后，**Mode A 契约 17/18 RED**——该文件注释含 `export/wx`、`export/tt` 字面量，触发 ac-18 仓库范围守卫（spec 冻结条款：「仓库内任何提交不得引用（games/stack-tower、export/wx、export/tt…）越界即红」） |
| 漏检根因 | 前轮三绿证据（`freeze-sprint-r1-20261008/n2-1a*.log`）全部出在 `5e7f2e5`；封版脚本 `b8ac090` 提交在后，提交后未复跑契约——归档红线报告 `tree.commit=5e7f2e5` 可证 |
| 修法裁定 | **不采用** ci/scope-policy.json 自豁免（等于替 spec 改验收语义，违反红线「不替策划案做设计决策」）；该工具本为 wx/dy/web 三树通用审计件，**重定位出源仓** → `.myrd/blackboard/g2-blocks/tools/redline-selfcheck.mjs`（树根 `--root`/`REDLINE_ROOT` 参数化），源仓回归零引用（仓内零引用机判：全仓 grep 仅自身） |
| 修复提交 | 源仓 main `1e3eff4`「fix(ci): 移除跨树红线自查工具出源仓——根因 ac-18 冻结条款字面冲突」 |
| 语义守恒 | 六项检查（R1–R6）判定逻辑逐条等价迁移；移除原实现里「脚本自豁免」hack（R2 恢复策略单源，审计工具不再有免检面）；R2 全仓扫描沿用 v1 口径（跳过 export 目录，148 文件可比） |

## 二、修复后复跑（全部原文在档，命令+退出码同行）

| # | 门禁 | 树/提交 | 结果 |
|---|---|---|---|
| 01 | Mode A 契约（v1.1 approved 基线 18 条） | web main `1e3eff4` | **18 PASS / 0 FAIL / 0 PEND · EXIT=0** |
| 02 | Mode B 契约（链 v7 封版件 29 条） | web main `1e3eff4` | **26 PASS / 0 FAIL / 3 PEND（显式挂起）· EXIT=0**（PEND=ac-30/31/32，approve 后转正式契约件） |
| 03 | smoke 冒烟门禁 | web main `1e3eff4` | **SMOKE: PASS · EXIT=0**（浏览器可开+核心循环可玩+SW 激活+manifest+控制台零错误） |
| 04 | 红线自查 web | web main `1e3eff4` | **6/6 PASS**（R1–R6 全绿，R4 钉 approved spec） |
| 05 | 红线自查 wx | wx/port-v1.1 `4fba03a` | **6/6 PASS**（R5 实测 wx 包体 ≤4MB） |
| 06 | 红线自查 dy | dy/port-v1.1 `023e583` | **6/6 PASS**（R5 实测 dy 包体 ≤4MB） |
| 07 | 契约 wx | wx/port-v1.1 `4fba03a` | **CONTRACT: PASS · EXIT=0** |
| 08 | 契约 dy | dy/port-v1.1 `023e583` | **CONTRACT: PASS · EXIT=0** |
| 09 | N4 零玩法 diff numstat 复核 | 源仓 main | `a70d194` = main.ts **31增/0删** + analytics.ts 194增/0删 + ac-29 断言 94增/0删；自基线 `6d3db6a..HEAD` src/ **删除行合计=0 / 新增=225** |

## 三、对前轮证据的效力判定

- `freeze-sprint-r1-20261008/` 原归档证据**全部有效**（其 tree.commit 均为实跑时点真值），但「web 主线 Mode A 18/18」的效力边界 = `5e7f2e5`，不含 `b8ac090`；本轮 01 号件把效力边界推到 `1e3eff4`。
- 《提审建议书》§二/§三 引述的本项证据以本目录为准（已同步回写 `submission-recommendation-freeze-r1.md`）。
- N3 真机轨状态不变：**not_run（真机未到位，不执行不造假）**，「可提审」结论仍被真机轨与主人三输入挡住。
