# oak-key 直通车硬前置核验报告

- 核验时间：2026-10-02
- 核验人：直通车子 agent（仓库与门禁硬前置核验）
- 结论：**三项硬前置全部满足，不 blocked，后续节点可开工**

## 工作区状态

- 工作区：`/Users/leo/.myrd/workspaces/cmupsflsc001om9dhnv8ad9xg/run-goal-cmupsfn0q001um9dhlko9t5e0`
- 实际分支：`myrd/oak-key-goal-cmupsfn0q001um9dhlko9t5e0`（任务描述写 main，以实际为准）
- 远端：`https://github.com/hl3w22bupt/myrd-playground.git`

## 核验结果

### ① 仓库可达 — PASS

| 检查项 | 结果 | 证据 |
| --- | --- | --- |
| 本地 work tree | 正常 | `git rev-parse --is-inside-work-tree` = true |
| 远端可达 | 成功 | `git ls-remote --heads origin` 退出码 0（GIT_TERMINAL_PROMPT=0 非交互） |
| main 分支存在 | 存在 | `a15f66b6d91ffb5bc81cd2692ab0a58412f60cb2 refs/heads/main` |

### ② games/oak-key 可落位 — PASS

| 检查项 | 结果 |
| --- | --- |
| 路径未被 git 追踪占用 | `git ls-tree -r HEAD` 中无 `games/oak-key`（games/ 下仅 `games/game/`） |
| 远端无同名/相关分支 | `ls-remote --heads \| grep -i oak` 无命中 |
| .gitignore 不忽略该路径 | 仅忽略 node_modules/dist/coverage/*.local/.DS_Store/.gstack/.myrd-platform |
| 目录可创建可写 | 探测性 `mkdir -p games/oak-key` + 写入成功，探测后已清理，`git status` 无残留 |

### ③ std-skills/godot-game-dev/scripts 判定脚本预置 — PASS

脚本清单（全部在位）：

| 脚本 | 用途 | 核验证据 |
| --- | --- | --- |
| `smoke.sh` | 无头冒烟门禁 | 语法 `bash -n` 通过；参数化 `smoke.sh <工程目录>`，退出码 0/1/2 |
| `preflight.py` | 前置一致性检查 P1-P13 | 语法通过；**对 templates/minimal-2d 实跑 PASS（13 类检查全过，23 文件）** |
| `gate-selftest.sh` | 门禁有效性自检 | **实跑 PASS：D1-D5 五类注入缺陷全部被拦且原因可读**（D6-D8 对模板工程不适用自动 SKIP） |
| `resolve-godot.sh` | Godot 二进制解析 | 实跑退出码 0，解析到 PATH 中 `godot` = **4.3.stable.official** |
| `input-fuzz.sh` | 输入模糊测试 | 在位 |
| `input_fuzz_driver.gd` | 模糊测试驱动 | 在位 |

接线核验：`.myrd/routines.yaml` 的 `godot-smoke` routine 四个 step（godot-availability / preflight / headless-smoke / input-fuzz）全部指向 `std-skills/godot-game-dev/scripts/`，无迁移动前旧路径（docs/skills）残留。

## 附带发现（不阻塞，供后续节点参考）

1. **`godot-smoke` 默认参数指向不存在的工程**：`routines.yaml` 中 `gamePath: games/godot-coin-rush` 在本仓库不存在（games/ 下仅 `game`）。后续门禁节点必须显式传 `gamePath: games/oak-key`，否则 headless-smoke/preflight 会失败。
2. **`game-contract` routine 引用的 `scripts/contract-check.mjs` 不存在**（仓库根无 `scripts/` 目录）。若后续需要跑契约门禁，需先落地该脚本。
3. **工作区存在 `.myrd-platform/` 下既有未提交改动**（18 个文件，技能包与模板相关）。本核验未触碰这些文件；后续节点提交时注意只 add 自己的产物，避免误卷入。
4. gate-selftest 默认参照工程 `games/godot-coin-rush` 同样不存在，跑自检需显式传 `std-skills/godot-game-dev/templates/minimal-2d`。

## 对后续节点的交接要点

- 工程落位路径直接用 `games/oak-key`，无需迁移或改名。
- 冒烟门禁调用方式（与 routines.yaml 一致）：
  ```bash
  GODOT_SMOKE_FRAMES=240 GODOT_BIN="$(bash std-skills/godot-game-dev/scripts/resolve-godot.sh)" \
    bash std-skills/godot-game-dev/scripts/smoke.sh games/oak-key
  ```
- 断言场景约定：工程内放 `tests/smoke.tscn` 会被 smoke.sh 自动选中；否则回退 `run/main_scene`（宽松判定需显式 `GODOT_SMOKE_ALLOW_WEAK=1`，门禁禁用）。
