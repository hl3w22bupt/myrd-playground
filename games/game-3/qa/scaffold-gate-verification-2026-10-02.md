# 脚手架门禁复验记录（scaffold 节点重入，2026-10-02）

本节点（godot 工程脚手架 + 门禁可跑）重入执行。结论：**目标分支上脚手架与门禁资产已齐备，
四门禁本地全绿，无需改动工程代码**。本记录为该结论的机判证据存档。

## 一、门禁资产校验（只校验、不产出）

判定器唯一来源 = 仓库内 `std-skills/godot-game-dev/scripts/`，逐个 `git ls-files` 确认已提交且不在 .gitignore：

| 脚本 | 状态 |
|---|---|
| `preflight.py` | 已提交 |
| `smoke.sh` | 已提交 |
| `resolve-godot.sh` | 已提交 |
| `input-fuzz.sh` | 已提交 |
| `playtest.sh` | 已提交 |

- 工程文件：`games/game-3/project.godot`、`games/game-3/tests/smoke.tscn|smoke.gd`、`games/game-3/verify.sh` 均存在。
- `verify.sh` 只调用上述四个判定脚本（preflight → smoke → fuzz → playtest），未重实现任何检查逻辑。
- `.myrd/routines.yaml` 已含 `id: godot-smoke` routine —— 本节点未改动它（gamePath 由 preHookParams 传入）。
- `project.godot` 的 `[gui] theme/custom_font`（Noto Sans SC 全局中文字体）原样保留（preflight P13 拦截项）。

> 备注：本仓库 `main` 与旧工作流分支的 `std-skills/` 缺 `playtest.sh`（平台注入目录里的同名脚本是阅读副本，
> 不作判定来源）；目标分支 `myrd/games-goal-cmuieq51k002cm9gysxbyppv7` 已由模板仓库预置齐全。
> 本节点全部产出与验证均在目标分支进行。

## 二、四门禁本地机判结果（与 .myrd/routines.yaml godot-smoke 同源命令）

环境：Godot 4.3.stable.official.77dcf97d8（`resolve-godot.sh` 退出码 0）

| # | 门禁 | 命令 | 退出码 | 判定标记 |
|---|---|---|---|---|
| 1 | preflight | `python3 std-skills/godot-game-dev/scripts/preflight.py games/game-3` | 0 | `PREFLIGHT: PASS`（13 类，57 个工程文件） |
| 2 | smoke | `GODOT_SMOKE_FRAMES=240 GODOT_BIN=… bash std-skills/godot-game-dev/scripts/smoke.sh games/game-3` | 0 | `godot-smoke: PASS` + 日志 `GODOT_SMOKE: PASS` |
| 3 | input-fuzz | `GODOT_BIN=… bash std-skills/godot-game-dev/scripts/input-fuzz.sh games/game-3` | 0 | `GODOT_FUZZ: PASS seed=20260913 batches=6` |
| 4 | playtest | `GODOT_BIN=… bash std-skills/godot-game-dev/scripts/playtest.sh games/game-3` | 0 | `GODOT_PLAYTEST: PASS`（3 局 × 900/1200 帧） |

工程根入口 `bash games/game-3/verify.sh` 端到端复跑：**退出码 0**，
`verify: PASS preflight + smoke + input-fuzz + playtest 全部通过`。

冒烟日志原始标记（节选）：

```
GODOT_SMOKE: PASS 关卡几何/场景实例化/autoload/键位契约/手感契约(v2=12帧)/自动奔跑/跳跃二段跳/
土狼跳/跳跃缓冲/收集飞镖+反馈/撞刺失败+震屏/重开复位/跑底过关+留存/冻结停跑/Juice反馈总线/重开防误触 全部通过
```

覆盖本节点要求的四类断言：玩家能移动（自动奔跑/跳跃/二段跳）、核心交互生效（收集飞镖+反馈）、
胜负可达（撞刺失败 / 跑底过关）、重开可用（重开复位 / 重开防误触）。

## 三、结论

- 脚手架完成标准逐项满足：门禁脚本在仓库内、`project.godot` 与 `tests/smoke.tscn` 存在、本地门禁退出码 0 且含 PASS 标记。
- 应用名/主场景标题 = 《疾风忍者跑》（`project.godot` `config/name`、`scenes/main.tscn` 标题 Label 一致）。
- 本节点零工程代码改动，仅新增本记录文档；目标分支保持四门禁全绿。
