# Godot 工程规则（随 minimal-2d 模板复制，随本工程生效，不得删除）

本工程钉死：**Godot 4.x + GDScript 2.0**。任何 Godot 3 写法都是缺陷 —— 预期运行
`godot --headless --path . tests/smoke.tscn` 必须退出码 0 且断言全过。
改动后跑：`python3 <技能目录>/scripts/preflight.py .`，再跑冒烟门禁。

## 高频版本污染对照（Godot 3 → Godot 4，preflight P11 机判）

| Godot 3（不要写） | Godot 4（必须写） |
|---|---|
| `onready var hp` | `@onready var hp` |
| `export var speed` / `export(int) var speed` | `@export var speed: int` |
| `yield(get_tree().create_timer(1), "timeout")` | `await get_tree().create_timer(1).timeout` |
| `connect("pressed", self, "_on_x")` | `pressed.connect(_on_x)` |
| `KinematicBody2D` / `KinematicBody` | `CharacterBody2D` / `CharacterBody3D` |
| 裸 `Spatial` / 裸 `RigidBody` | `Node3D` / `RigidBody3D` |
| `move_and_slide(vel, Vector2.UP)` | 先 `velocity = …`，再无参 `move_and_slide()` |
| `load("res://x.tscn").instance()` | `.instantiate()` |
| `PoolVector2Array` / `Pool*Array` | `PackedVector2Array` / `Packed*Array` |
| `Tween` 节点 / `Tween.new()` / `interpolate_property()` | `create_tween()` + `tween_property()` |

## 分工边界

- **脚本（.gd）可以放心生成**：文本、可静态检查、可无头验证。
- **场景（.tscn）禁止从零整段生成**：`[ext_resource]` id 与 `uid://` 引用错了会**静默损坏**
  （不报错、运行期才黑屏）。新建场景 = 从现有场景/模板场景复制后改最小属性块；
  修改 = 只动必要属性行，`load_steps` 必须与资源数一致。
- 全部成员变量与函数签名标注类型（`var speed: float = 300.0`），把一类运行时故障提前成解析错误。
- 节点引用优先 `%唯一名`（`unique_name_in_owner = true`），不要写长路径 `$UI/HudLabel` ——
  重构时路径引用会悄悄断，唯一名不会。

## 本工程的固定接线（破坏 = 黑屏）

`project.godot` 的 `run/main_scene`、`[autoload] GameState`、`[input]` 动作映射，
以及 `tests/smoke.tscn|gd` 冒烟场景 —— 移植新玩法时逐项保留。

## 本工程（星尘收集者）补充接线

- `[autoload]` 顺序：`GameConfig`（数值配置，**必须先于 GameState 注册**）→ `GameState`（分数/护盾/最高分/结算状态机）。
- 数值唯一来源：`config/gameplay.cfg`（收集加分 / 扣盾 / 初始护盾 / 无敌帧 / 星尘陨石数量与速度 / 难度梯度 / 胜利目标 / 里程碑步长）—— 改配置即生效，不改代码。
- 玩法闭环：`StarDust.collected` → main 加分 + 飘字 + 延迟补位；`Asteroid` 碰撞 → `Player.take_hit()`（无敌帧防重复扣血）→ `GameState.apply_hit()` → 护盾归 0 弹失败结算面板（本局得分 + 历史最高分，`user://stardust_save.cfg` 持久化）。
- 难度梯度：分数每跨过 `difficulty_step` → main `_apply_difficulty` 上调陨石常驻上限与速度倍率（封顶见配置），重开复位 0 级。
- 胜利终局：得分达 `score_target`（0 = 无尽模式）→ `GameState.game_won` → 同一结算面板标题切「目标达成 · 胜利！」。
- 里程碑反馈：分数每跨过 `milestone_step`（0 = 关闭）→ UI CanvasLayer 的 `%MilestoneLabel` 庆祝横幅。
- 重开入口：结算面板「重新开始」按钮 / confirm 动作（空格/回车）→ `GameState.start_game()` 重置分数护盾并重铺战场（难度同时复位）。
- 本地复跑门禁：`bash games/game-2/verify.sh`（preflight + smoke(GODOT_SMOKE_FRAMES=240) + fuzz，只调用 std-skills/godot-game-dev/scripts/ 判定脚本）。
