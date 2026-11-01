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

## 数值调参纪律（见 SKILL.md §3C）

- 可调数值只放 `autoload/game_state.gd` 调参区：变量 + `TUNING_META`（min/max/step）成对声明，
  键名与 `spec.numeric` 对应；消费方读变量，禁止散落魔数（模板示例：`move_speed`）。
- 数值默认值 = spec.numeric 定稿；试玩调参走 URL `?tuning=`（壳页面桥 → `apply_tuning`）
  或游戏内调参面板，**定稿必须回写 spec（revisions API）再改默认值**，禁止两头各改各的。

## 本工程的固定接线（破坏 = 黑屏）

`project.godot` 的 `run/main_scene`、`[autoload] GameState`、`[autoload] Juice`、`[input]` 动作映射，
以及 `tests/smoke.tscn|gd` 冒烟场景 —— 移植新玩法时逐项保留。

## 反馈完备性（Juice，见 SKILL.md §3B）

- 结果性事件（得分/收集/命中/失败/确认/升级）至少挂 1 条 `Juice` 反馈
  （`pop`/`flash`/`shake`/`hit_stop`/`sfx`），挂在**结果事件的处理函数**上，
  不挂在输入处理上 —— 冒烟第 6 项断言会拦「反馈接线断了」。
- `Juice.sfx(&"名")` 的调用点先钉住，音效资产后补（SFX_BANK 注册一行即出声）。
- 删除 Juice 单例必须同步删全部调用点（preflight P14 拦「引用了但没注册」）。
