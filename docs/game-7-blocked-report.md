# blocked 上报：game-7《星云穿行》门禁脚本缺失（playtest.sh）

- **status**: blocked
- **run**: cmujmvljj003wm99im2o1jq1r（workspace run-cmujmvljj003wm99im2o1jq1r）
- **目标**: cmujmfy0r002im99i3inkbu6i / 需求 cmujmowd6003bm99i5zjlwlzz（game-7 星云穿行）
- **托管应用**: cmujmfvha002gm99i1lpbo1fr（slug: game-7）
- **分支**: myrd/game-7-goal-cmujmfy0r002im99i3inkbu6i（HEAD a15f66b = origin/main）
- **仓库**: https://github.com/hl3w22bupt/myrd-playground.git

## blocked detail（按节点纪律原文回写）

> 模板仓库未预置门禁脚本：std-skills/godot-game-dev/scripts/playtest.sh；请运维把模板仓库补上技能资产。

## 缺失证据（三重复核，均为否）

1. 工作区 `ls std-skills/godot-game-dev/scripts/` 仅有：gate-selftest.sh、input-fuzz.sh、input_fuzz_driver.gd、preflight.py、preflight_selftest.py、resolve-godot.sh、smoke.sh —— **无 playtest.sh**。
2. `git log --all --oneline -- std-skills/godot-game-dev/scripts/playtest.sh` 为空 —— 该文件**从未进入仓库任何历史**。
3. `git ls-tree origin/main std-skills/godot-game-dev/scripts/` —— 远端 main 同样没有 playtest.sh。
4. 仓库内权威技能文档（std-skills/godot-game-dev/SKILL.md 与 references/*）全文无 playtest 引用。
5. `.gitignore` 未排除该路径（排除的是 node_modules/dist/coverage/*.local/.DS_Store/.gstack/.myrd-platform），非忽略问题。

注：平台注入的阅读副本 `.myrd-platform/.claude/skills/godot-game-dev/scripts/playtest.sh`（及 playtest_driver.gd）确实存在，但按节点纪律「判定脚本只能来自项目仓库，不得把注入目录当判定脚本来源，也不得从注入目录复制脚本充当仓库资产、更不得自行编写」，因此不采用、不复制、不自造。

## 环境与其余门禁资产状态（均正常，唯缺此一项）

| 资产 | 状态 |
| --- | --- |
| std-skills/godot-game-dev/scripts/preflight.py | ✅ 已提交 |
| std-skills/godot-game-dev/scripts/smoke.sh | ✅ 已提交 |
| std-skills/godot-game-dev/scripts/resolve-godot.sh | ✅ 已提交，实跑 exit=0（Godot 可用） |
| std-skills/godot-game-dev/scripts/input-fuzz.sh | ✅ 已提交 |
| std-skills/godot-game-dev/scripts/playtest.sh | ❌ **缺失（blocked 唯一根因）** |
| std-skills/godot-game-dev/templates/minimal-2d/ | ✅ 已提交（含全局中文字体 assets/fonts） |
| .myrd/routines.yaml（含 id=godot-smoke） | ✅ 已提交，按纪律未改动 |

## 处置

- 按节点纪律「来源不可得 → 立即停止并回写 status=blocked，绝不要自己造」，本节点**未**创建 games/game-7/ 工程、未改动门禁配置、未绕过门禁。
- 本地自检命令 5 条中有 1 条（`bash std-skills/godot-game-dev/scripts/playtest.sh games/game-7`）因脚本不存在无法执行，「提交前先自己跑一遍」的前置条件不成立，故不进入脚手架与提交游戏代码阶段。

## 恢复条件（解锁后本节点可继续）

1. 运维把 playtest.sh（及其驱动 playtest_driver.gd，如属门禁的一部分）预置进模板仓库 `std-skills/godot-game-dev/scripts/`，随仓库下发。
2. 重跑本节点：校验五脚本齐备 → 以 templates/minimal-2d 复制出 games/game-7 → 实现玩法骨架 + tests/smoke → verify.sh → 本地五条自检命令全绿（GODOT_SMOKE / GODOT_FUZZ / GODOT_PLAYTEST 均 PASS）→ commit & push 本分支。
