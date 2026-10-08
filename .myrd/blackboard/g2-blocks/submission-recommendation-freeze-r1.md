# submission-recommendation-freeze-r1.md — 《提审建议书》（封版就绪冲刺第 1 批 · 2026-10-08）

> 出具：主策划（整合五节点产物；本文件只汇总与给建议，**提审按钮归主人**）
> 一句话结论：**材料面全部就绪（spec 链 v7 + 契约三绿 + 红线三树 6/6 + 物料矩阵齐）；渠道提审被两件事挡住——① 平台线未 rebase 到 v1.2（包内容还是 v1.1 面貌）② 真机轨未跑。两者解法已备，等主人三个输入。**

## 一、spec 面：链 v7 封版包（N1）

| 项 | 状态 |
|---|---|
| 链 v7 `cmuyvvhql0043m93eu777kop8` [draft]（parent=v6，version+1 零覆盖） | ✅ 在链 |
| 四项增量（三锚点实体 / 九事件表 / DoD 三层门待校准 / 候选池 1·2） | ✅ 全折入 |
| 基线修复：找回 v5/v6 未继承的 v4 手感轮全量（逐字节全等守卫） | ✅ 十三守卫全绿 |
| numeric 红线：既有组零改动；`uxProposal` 仅提案态 | ✅ 守卫④机判 |
| 拍板包 | `.myrd/blackboard/g2-blocks/approve-ready-freeze-r1.md` |

**建议**：请主人 approve 链 v7（approve 后封版基线成立，v1.3 实现轮可开工）。

## 二、实现面：埋点落地零玩法 diff（N4）

| 项 | 状态 |
|---|---|
| 9 事件模块 `src/telemetry/analytics.ts`（wx=reportEvent / dy=reportAnalytics / web=缓冲+sendBeacon+flush 兜底；不自建第三方 SDK） | ✅ 源仓 `a70d194` |
| main.ts 接线 | **31 行纯新增 / 0 删除 / 0 改行**（numstat 机判 + R3 红线检查盯防） |
| 双向断言：spec 事件表 ↔ 代码镜像 ↔ call site | ✅ ac-29 PASS（Mode B） |
| 契约三态：Mode A 18/18 · Mode B(v7) 26 PASS/0 FAIL/3 PEND · PEND 通道显式披露 | ✅ EXIT=0（复核轮 `1e3eff4` 复跑确认，原文 `freeze-sprint-r1-recheck-20261008/01..02`） |
| 零玩法 diff 机判 | ✅ 自基线 `6d3db6a..HEAD` src/ 删除行合计=0（numstat 复核 `09-n4-numstat-recheck.log`） |

## 三、QA 三章证据（N2 + N3）

**章 1 · 契约三处实跑**（`gate-logs/freeze-sprint-r1-20261008/n2-1*.log`）：web v1.2 主线 @`5e7f2e5` 18/18 EXIT=0；wx @`4fba03a` 18/18 EXIT=0；dy @`023e583` 18/18 EXIT=0。
**章 2 · wx 包哈希对照**（`n2-2-wx-hash-table.log`）：正确基线复核（含 `src/platform/wx/` 六件）@`4fba03a`，双跑 EXIT=0，31 件 151,768 B，包聚合哈希 `b947f290…`；dy 侧红线报告 178,793 B / 30 件 ≤4MB。
**章 3 · 红线自查 + 断言指认 + diff 清单**（`n2-5-redline-{web,wx,dy}.json` + `n2-4-guide-assertions.md` + `n2-5-v11-to-v12-diffstat.log`）：三树 6/6 全绿（kernel 平台 API=0 / 一号仓零引用 / 埋点零玩法 diff / 冻结值抽查 / 包体预算 / 原生 API 零越界）；v1.1→v1.2 逐文件 diff 在档。
> **复核轮更正（2026-10-08 · F6）**：红线自查工具已迁出源仓 → `.myrd/blackboard/g2-blocks/tools/redline-selfcheck.mjs`（原 `scripts/redline-selfcheck.mjs` @`b8ac090` 触发 ac-18 守卫，Mode A 曾 17/18 RED，源仓 `1e3eff4` 修复）；三树 6/6 于 web `1e3eff4` / wx `4fba03a` / dy `023e583` 复跑确认（原文 `freeze-sprint-r1-recheck-20261008/04..08`）。web 主线 Mode A 效力边界自 `5e7f2e5` 推至 `1e3eff4`。
**真机轨**（`n3-smoke-report.json`）：通用 8 项 + wx 5 项 + dy 4 项清单与机读报告框架就绪，**全部 not_run（真机未到位，不执行不造假）**。

## 四、红线自查报告（汇总）

| 红线 | 核销 |
|---|---|
| 不触 stack-tower | ✅ R2 三树零引用机判；本轮全部 git 变更仅在 g2-blocks 源仓与本运行分支白名单路径 |
| 新游戏线零投入 | ✅ 未触碰 game-9/pixel-fives 等线；本运行分支已从 game-9 线重置回工作区累积线（零丢失，blockers.md 基线区披露） |
| 埋点零玩法 diff | ✅ 31/0/0 numstat + R3 机判 |
| numeric 不改生效值 | ✅ 十三守卫④ + R4 抽查；`uxProposal` 提案态不进读路面 |
| spec 版本链 version+1 零覆盖 | ✅ v1..v6 六行在链 + v6 锚 `bcc46580…` 零接触 |
| approve 归主人 | ✅ v7 落 draft；PEND 3 条显式挂起不装绿 |

## 五、物料矩阵（N5）

《物料代差清单》平台×包版本×用途逐格三态（沿用/重制/冻结候审）+ 风格卡 v1.2 实测固化回写 assets.md + 素材归档挂来源 commit + 三平台共用分享卡模板骨架 + wx 侵权比对（无冲突）+ dy 克制版分享文案 ×3。
落点：`gate-logs/freeze-sprint-r1-20261008/matrix/material-matrix.md` + `assets.md` 登记区。

## 六、rebase v1.2 方案（平台线升级路径 · 建议采纳）

**现状**：wx/dy 移植线分叉自 `fe5fd38`（v1.1 末梢）——**当前 wx/dy 包不含 v1.2 手感轮（链 v4 七项 + feel pack）与 N4 埋点**。提审若用现包 = 提审的是 v1.1 面貌，与「封版就绪」目标不符。

**建议路径（顺序执行，每步门禁前置）**：
1. 主人 approve 链 v7 → 封版基线成立；
2. wx 线：`git merge main`（或 rebase）→ 解冲突预期小（wx 平台段五件与 feel 增量文件不相交）→ 复跑 contract Mode A + Mode B(v7) + build-wx 双跑哈希 → 出新包哈希对照表（N2② 同口径）；
3. dy 线：同上（platform/dy 五件 + 写案校准保留）→ dy 组包 + 哈希；
4. N3 真机轨跑新包（报告包哈希槽位替换为新值）；
5. 全 pass → QA 出具「可提审」→ **主人拍板提审**（wx/dy 提审状态与版号/资质为主人侧输入）。

## 七、主人侧待输入（单列，不阻塞成员侧产出）

| # | 事项 | 阻塞什么 |
|---|---|---|
| 1 | **链 v7 approve**（拍板包 §四） | 封版基线成立 / v1.3 实现轮开工 |
| 2 | **真机**（iOS+Android 各 ≥1 台 + 执行方式） | N3 真机轨 → 「可提审」结论 |
| 3 | **渠道提审状态 + 版号/资质结论**（wx/dy 各自提审口径） | 提审动作本身（团队材料已备） |
| 4 | 沿挂裁决：G-Q1（daily 倒拨语义）/ G-Q2（渠道分享业务参数）/ Q-D4（daily 完成谓词）/ Q4（A-10 留白取向） | 随下一轮 spec 修订或渠道开辟 |

## 八、v1.3 五条 gate（挂 blockers.md，此处登记口径）

| gate | 通过判据 |
|---|---|
| G1 spec 封版基线 | 链 v7 approved（主人 approve 落卷） |
| G2 实现零回归 | Mode A 18/18 + Mode B(v7) 全 PASS（PEND 3 条显式披露不计 FAIL）+ SMOKE PASS + P95 不退化 |
| G3 平台线对齐 | wx/dy rebase v1.2 后各自契约 + 组包 + 哈希对照表全绿 |
| G4 真机冒烟 | 通用 8 项 + 平台特有项全 pass（机读报告包哈希交叉一致） |
| G5 主人提审拍板 | G1–G4 全绿 + 版号/资质结论 → 主人按下提审按钮 |

（本建议书为呈批材料；「好不好玩」与提审终裁归主人。）
