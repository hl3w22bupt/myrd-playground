# 黑板共板合流冲突标记修复 · 证据档案（2026-10-15 · 游戏程序）

> 性质：R1 复测收口轮成果的 verify-claims 独立复核中发现的**黑板基础设施缺陷**修复（非关卡面/契约面变更，spec 零触碰）
> 起点 HEAD：`4f424e5fe4418fbb349eff804e415ea37adf582c`（R1 复测收口轮收口提交）

## 一、缺陷定性（红证据 → 00-red-evidence.txt）

- 同一合流提交（r1 成果线 `5a6b979` 合入 `c6f9ea4`）把**未解决的 git 合并冲突标记**带进了三份顶层共板文件，后续多轮提交（`7b45b44`/`813fa38`/`dce2d73`/`bcaa8f5`/`4f424e5`）仅改头部区段未触及标记，随库残留至今：
  - `.myrd/blackboard/levels.md`：标记行 1 / 133 / 145
  - `.myrd/blackboard/assets.md`：标记行 1 / 255 / 293
  - `.myrd/blackboard/blockers.md`：标记行 1 / 621 / 650
- 冲突形态三处同构：`<<<<<<< HEAD`（组合全景新版）… `=======` … `>>>>>>> 5a6b979`（game-9 旧版）。
- 影响：黑板机读/人读面被冲突标记污染（共板头部声明与正文结构断裂）；不影响游戏工程与契约面（build/tests/tools 零涉及）。

## 二、修复方式（零信息丢失机判前置 → 01-green-evidence.txt）

- 删除前机判：python 提取 theirs 侧全文（assets 37 行 / blockers 28 行 / levels 11 行）断言 `theirs_txt in 存档区文本` = True（三处 game-9 旧版内容均已在各自「【他线存档区】…原文零改动」段落完整归档）→ 删除 theirs 侧 + 三条标记行，保留 HEAD 侧。
- 修复量：levels.md（-13 行）· assets.md（336→296 行）· blockers.md（684→653 行）。
- 回查：`grep -rn '<<<<<<<|>>>>>>>|^=======$' --include='*.md'` → 全仓零残留；三文件首行均为正文标题（sanity）。

## 三、门禁运行链（非 flaky 三连）

| run | 树状态 | 结果 | 取证 |
|---|---|---|---|
| Run 1 | 修复前（干净树 @ 4f424e5） | 五步全 PASS：统契约 PASS · 16/0/1PEND · WS-SMOKE PASS（victory 167s ≡ 复测报告逐值）· 双 guard PASS | 对话输出留痕（本轮 verify-claims 基线） |
| Run 2 | 修复后未提交 | ⑤ 父仓足迹自检 FAIL（exit=1）：`[白名单外] M assets.md/blockers.md/levels.md` | 02-verify-run2.log |
| Run 3 | 白名单扩围后 | 五步全 PASS，`VERIFY_EXIT=0` | 03-verify-run3-after-policy-fix.log |

- Run 2 假红定性：**scope-policy 白名单滞后于任务书授权面**，非修复引入越界——任务书逐轮授权各线回写顶层共板（levels.md 台账 / blockers.md / assets.md），历轮提交 `dce2d73`/`bcaa8f5`/`4f424e5` 均有触碰而 `repoOne.allowedPreExistingModifiedPaths` 未收；门禁此前未暴露仅因「先提交后跑门禁」时序下 git status 为空。

## 四、策略扩围（最小面，同 commit 留痕）

- `games/wheat-squad/ci/scope-policy.json` → `repoOne.allowedPreExistingModifiedPaths` 追加三条**精确串**：`.myrd/blackboard/levels.md` / `.myrd/blackboard/blockers.md` / `.myrd/blackboard/assets.md`（带 `$note` 授权依据）。
- 刻意不放开 `.myrd/blackboard/` 目录前缀：他线子黑板（`g2-blocks/`、`next-line/`、`research/` 既有条目除外）维持禁触；`forbiddenTouchGlobs` 零改动。

## 五、如实性再证（04-strict-mode.log）

- `WS_CONTRACT_STRICT_GREEN=1` → `STRICT_EXIT=2`，16 PASS / 0 FAIL / **1 PEND（ac-a3 结论面 0/5）**——本轮文档面修复**未冲刷**「R1 未判定·挂起」判定口径，QA-WS-R1RE-20261015-01 唯一结论维持有效。

## 六、边界自查

- 本档案全部变更面 = `.myrd/blackboard/*.md`（共板三件）+ `games/wheat-squad/ci/scope-policy.json` + 本 gate-logs 目录；`games/wheat-squad/src|tests|tools`、`.myrd/spec/`、他线目录零触碰（Run 3 第 ⑤ 步 5 行 status 全在白名单内可证）。
- 证据绑 sha：本档案落盘时工作树修改基于 HEAD `4f424e5`，提交后以本 commit 为准回填。
