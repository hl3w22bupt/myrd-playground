class_name Player
extends CharacterBody2D
## 玩家角色：四方向移动的探针载具（拾取 key 片段用）。
##
## 规范要点（见 SKILL.md「GDScript 规范」）：
## - class_name 唯一，且与文件名一致的职责（Player.gd → class_name Player）；
## - 输入只读 InputMap 动作名（project.godot [input] 已注册），禁止硬编码 keycode；
## - 对外只发信号，不直接操作 UI 节点（UI 在 Main 场景里订阅）。

## 玩家位置变化时发出；参数用类型标注（Vector2），订阅方可静态核对。
signal moved(position: Vector2)

## 碰撞形状半宽/半高（player.tscn 的 RectangleShape2D 为 24x24）。
const HALF_EXTENT: Vector2 = Vector2(12.0, 12.0)
## 可活动场地范围（场景坐标）。限制探针不跑出 640x360 视口，随机输入也不会把它推出画面。
@export var arena_rect: Rect2 = Rect2(0.0, 0.0, 640.0, 360.0)


func _physics_process(_delta: float) -> void:
	var direction := Input.get_vector("move_left", "move_right", "move_up", "move_down")
	# 速度来自 GameState 调参区（SKILL.md §3C：可调数值不散落魔数，试玩可调）。
	velocity = direction * GameState.move_speed
	move_and_slide()
	_clamp_to_arena()
	if direction != Vector2.ZERO:
		moved.emit(global_position)


## 把中心点夹在场地内（留出自身半宽），避免跑到可视区外「隐身」。
func _clamp_to_arena() -> void:
	var minimum: Vector2 = arena_rect.position + HALF_EXTENT
	var maximum: Vector2 = arena_rect.end - HALF_EXTENT
	global_position = global_position.clamp(minimum, maximum)
