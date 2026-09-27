# blocked 上报：game-7《星云穿行》试玩验收——门禁脚本 playtest.sh 未随模板仓库预置

- **status**: blocked
- **run**: cmujmvljj003wm99im2o1jq1r（workspace run-cmujmvljj003wm99im2o1jq1r）
- **目标**: cmujmfy0r002im99i3inkbu6i（需求 cmujmowd6003bm99i5zjlwlzz，game-7 星云穿行）
- **托管应用**: cmujmfvha002gm99i1lpbo1fr（slug: game-7）
- **分支**: myrd/games-goal-cmujmfy0r002im99i3inkbu6i（HEAD 1396804）
- **仓库**: https://github.com/hl3w22bupt/myrd-playground.git
- **节点**: 小游戏工坊第四步「试玩验收」（试玩验收包 + 四问量表 + 调参工作台入口 + tuning 回写）

## blocked detail（按节点纪律原文回写）

> 模板仓库未预置门禁脚本：std-skills/godot-game-dev/scripts/playtest.sh；请运维把模板仓库补上技能资产。

## 前置核查结果（本节点第一步 + 硬约束核查）

| 核查项 | 结果 |
| --- | --- |
| 部署产物 liveUrl（goal artifacts） | ✅ 存在：`liveUrl=https://leomac-studio.tail49399e.ts.net/apps/game-7/`（op=run_workflow / artifactType=hosted_app，deploymentId=cmujp6rmj005em99imb5my7cw，gitRef=目标分支 a620bd3）——本项不缺 |
| `.myrd/routines.yaml` 含 id=godot-smoke | ✅ 存在，与 `std-skills/godot-game-dev/references/godot-smoke-routine.md` 参数化模板同源——本项不缺 |
| std-skills/godot-game-dev/scripts/preflight.py | ✅ 已提交 |
| std-skills/godot-game-dev/scripts/smoke.sh | ✅ 已提交 |
| std-skills/godot-game-dev/scripts/input-fuzz.sh | ✅ 已提交 |
| std-skills/godot-game-dev/scripts/resolve-godot.sh | ✅ 已提交 |
| std-skills/godot-game-dev/scripts/playtest.sh | ❌ **缺失（blocked 唯一根因）** |

## 缺失证据（三重复核，均为否；2026-09-27 复核）

1. 工作区 `ls std-skills/godot-game-dev/scripts/` 仅有：gate-selftest.sh、input-fuzz.sh、input_fuzz_driver.gd、preflight.py、preflight_selftest.py、resolve-godot.sh、smoke.sh —— **无 playtest.sh**。
2. `git log --all -- std-skills/godot-game-dev/scripts/playtest.sh` 为空 —— 该文件从未进入本仓库任何本地 ref。
3. `git ls-tree origin/main std-skills/godot-game-dev/scripts/` —— 远端 main（模板仓库现状）同样没有 playtest.sh，运维尚未补齐。
4. `.gitignore` 未排除该路径，非忽略问题。
5. 仓库内权威技能文档 `std-skills/godot-game-dev/SKILL.md` 将 `scripts/playtest.sh` 列为门禁资产（「机器人试玩门禁」：bot 多局游玩，机判节奏类代理指标下限）；仓库内 `.myrd/routines.yaml` 的 godot-smoke routine 亦无 playtest step——与模板同源地缺。

注：平台注入的阅读副本 `.myrd-platform/.claude/skills/godot-game-dev/scripts/playtest.sh`（含 playtest_driver.gd）确实存在，但按节点纪律「判定只认仓库内路径 std-skills/godot-game-dev/scripts/，不得把注入目录当判定脚本来源，也不得现场改写仓库内脚本」，因此不采用、不复制、不自造。

## 本节点因此停止的事（不产出清单）

- 未产出「试玩验收包」（op=playtest_kit）：试玩指引、四问结构化量表、调参工作台入口（`<liveUrl>?tuning=1`）均未回写。
- 未回写任何试玩结论——量表本就只能来自用户，不存在可编造的结果。
- 未执行 tuning 回写（该步本就以「收到用户量表结论 + 调参 URL」为前提）。
- 未改动仓库内门禁脚本与 `.myrd/routines.yaml`。

## 处置与恢复条件

- 已回写：本报告（仓库 docs/）+ goal.artifacts 追加一条 op=playtest_kit / status=blocked 条目（PATCH 合并，不覆盖既有 create_requirement / write_knowledge / run_workflow 三条产物）。
- 恢复条件：运维把 playtest.sh（及 playtest_driver.gd，如属门禁一部分）预置进模板仓库 myrd-playground 的 `std-skills/godot-game-dev/scripts/` → 本目标分支同步后重跑本节点 → liveUrl 已就绪，直接产出试玩验收包并把四问量表交还用户试玩。
- 关联记录：`docs/game-7-deploy-checkpoint.md`（部署自测与 preflight/smoke/input-fuzz 三门禁全绿记录）、`docs/game-7-blocked-report.md`（前序脚手架节点对同一缺失的首报）。
