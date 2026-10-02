class_name Player
extends CharacterBody2D
## 玩家角色：四方向移动的收集者（俯视 2D）。
##
## 规范要点（见 SKILL.md「GDScript 规范」）：
## - class_name 唯一，且与文件名一致的职责（player.gd → class_name Player）；
## - 输入只读 InputMap 动作名（project.godot [input] 已注册），禁止硬编码 keycode；
## - 对外只发信号，不直接操作 UI 节点（UI 在 Main 场景里订阅）。

## 玩家位置变化时发出；参数用类型标注（Vector2），订阅方可静态核对。
signal moved(position: Vector2)

const SPEED: float = 220.0
## 竞技场边界（对应 project.godot 视口 640x360，留出半身位）。
const ARENA_MIN: Vector2 = Vector2(12.0, 12.0)
const ARENA_MAX: Vector2 = Vector2(628.0, 348.0)


func _physics_process(_delta: float) -> void:
	var direction := Input.get_vector("move_left", "move_right", "move_up", "move_down")
	velocity = direction * SPEED
	move_and_slide()
	global_position = global_position.clamp(ARENA_MIN, ARENA_MAX)
	if direction != Vector2.ZERO:
		moved.emit(global_position)


## 复位/重开用瞬移：**必须在物理步内调用**（如 Main 的 _physics_process）。
## 在物理步外（如输入回调里）直接改 global_position，节点坐标立刻变、但物理服务端里
## 的 body 仍停在旧位置，要到下一次 move_and_slide 才同步 —— 期间入世界的 Area2D 会
## 撞上「残影位置」（冒烟实测：重开后玩家已回出生点，新的收集物仍被瞬间收集）。
func teleport_to(pos: Vector2) -> void:
	global_position = pos
	velocity = Vector2.ZERO
