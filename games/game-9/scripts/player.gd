class_name Player
extends CharacterBody2D
## 玩家角色：四方向移动的 2D 骨架（俯视/平台皆可改造）。
##
## 规范要点（见 SKILL.md「GDScript 规范」）：
## - class_name 唯一，且与文件名一致的职责（Player.gd → class_name Player）；
## - 输入只读 InputMap 动作名（project.godot [input] 已注册），禁止硬编码 keycode；
## - 对外只发信号，不直接操作 UI 节点（UI 在 Main 场景里订阅）。

## 玩家位置变化时发出；参数用类型标注（Vector2），订阅方可静态核对。
signal moved(position: Vector2)

const SPEED: float = 220.0


func _physics_process(delta: float) -> void:
	var direction := Input.get_vector("move_left", "move_right", "move_up", "move_down")
	velocity = direction * SPEED
	move_and_slide()
	if direction != Vector2.ZERO:
		moved.emit(global_position)
