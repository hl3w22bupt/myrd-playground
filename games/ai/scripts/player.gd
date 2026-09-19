class_name Player
extends CharacterBody2D
## 小李（玩家角色）：四方向移动的 2D 骨架（生存挑战里的追人方）。
##
## 规范要点（见 SKILL.md「GDScript 规范」）：
## - 输入只读 InputMap 动作名（project.godot [input] 已注册），禁止硬编码 keycode；
## - 对外只发信号，不直接操作 UI 节点（UI 在 Main 场景里订阅）；
## - 收集判定交给对方的 Area2D（ai_girlfriend.gd），本脚本不感知「谁在圈里」。

## 玩家位置变化时发出；参数用类型标注（Vector2），订阅方可静态核对。
signal moved(position: Vector2)

const SPEED: float = 220.0
## 活动边界（设计分辨率 640x360 内留出 HUD/边框安全带；越界钳制，出不去地图）。
const ARENA_MIN: Vector2 = Vector2(24.0, 30.0)
const ARENA_MAX: Vector2 = Vector2(616.0, 330.0)


func _physics_process(_delta: float) -> void:
	var direction := Input.get_vector("move_left", "move_right", "move_up", "move_down")
	velocity = direction * SPEED
	move_and_slide()
	global_position = global_position.clamp(ARENA_MIN, ARENA_MAX)
	if direction != Vector2.ZERO:
		moved.emit(global_position)
