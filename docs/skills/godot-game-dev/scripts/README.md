# godot-game-dev 门禁脚本（docs/skills 只读副本）

本目录是 `std-skills/godot-game-dev/scripts/` 三个门禁脚本的**只读镜像副本**，
用于把验收/文档侧的脚本调用路径（`docs/skills/godot-game-dev/scripts/…`）与
技能包原件对齐。

## 权威来源（Single Source of Truth）

| 脚本 | 副本路径（本目录） | 权威原件（唯一可修改处） |
| --- | --- | --- |
| `preflight.py` | `docs/skills/godot-game-dev/scripts/preflight.py` | `std-skills/godot-game-dev/scripts/preflight.py` |
| `smoke.sh` | `docs/skills/godot-game-dev/scripts/smoke.sh` | `std-skills/godot-game-dev/scripts/smoke.sh` |
| `resolve-godot.sh` | `docs/skills/godot-game-dev/scripts/resolve-godot.sh` | `std-skills/godot-game-dev/scripts/resolve-godot.sh` |

> **不要直接编辑本目录下的任何脚本。** 所有修改必须落在
> `std-skills/godot-game-dev/scripts/` 原件上，然后用 `cp -p` 原样覆盖本目录副本
> （保留可执行位），保证两边逐字节一致。

## 各脚本用途与用法

### `preflight.py` —— 前置一致性检查（无需 Godot，纯机判）

在真正运行游戏之前，把「跨文件不一致、场景接线断裂、资源路径悬空」这类必然
导致黑屏的问题拦下来（P1–P13 共 13 项检查，详见脚本头部 docstring）。

```bash
python3 docs/skills/godot-game-dev/scripts/preflight.py <工程目录>   # 默认当前目录
```

退出码：`0` = 通过；`1` = 发现问题；`2` = 不是 Godot 工程（缺 `project.godot`）。
需要 Python 3.8+。

### `smoke.sh` —— 无头冒烟门禁（「游戏能不能跑」的机器判定通道）

```bash
bash docs/skills/godot-game-dev/scripts/smoke.sh <工程目录> [场景路径]
```

环境变量：`GODOT_BIN`（Godot 可执行文件）、`GODOT_SMOKE_FRAMES`（帧数兜底，
默认 120）、`GODOT_SMOKE_SCENE`（冒烟场景）等，详见脚本头部注释。
退出码：`0` = 通过；`1` = 冒烟失败；`2` = 环境不可用。

### `resolve-godot.sh` —— 解析 Godot 可执行文件（全技能包唯一实现）

解析顺序：`GODOT_BIN` > `PATH` 里的 `godot` > `/Applications/Godot.app` >
`~/tools/godot`。找不到时 stderr 给安装指引并退出码 `2`。

```bash
GODOT_BIN="$(bash docs/skills/godot-game-dev/scripts/resolve-godot.sh)"
```

## 同步校验

验收时可逐字节比对副本与原件（应无输出）：

```bash
for f in preflight.py smoke.sh resolve-godot.sh; do
  diff -q "std-skills/godot-game-dev/scripts/$f" "docs/skills/godot-game-dev/scripts/$f"
done
```
