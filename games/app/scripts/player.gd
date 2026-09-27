class_name Player
extends CharacterBody2D
## 玩家飞船：沿航路自动前进（表现上世界向下滚动），玩家四方向操控位置。
##
## 规范要点（SKILL.md「GDScript 规范」）：
## - 输入只读 InputMap 动作名（project.godot [input] 已注册），禁止硬编码 keycode；
## - 横移速度用 GameState 调参区常量（player.lateralSpeed = 300px/s，验收 1）；
## - 对外只发信号（moved），不直接操作 UI。

## 玩家位置变化时发出；订阅方（main）刷新 HUD。
signal moved(position: Vector2)

const PLAYFIELD_SIZE: Vector2 = Vector2(720.0, 1280.0)
const PLAYFIELD_MARGIN: float = 28.0


func _physics_process(_delta: float) -> void:
	if GameState.game_over:
		velocity = Vector2.ZERO
		return
	var direction := Input.get_vector("move_left", "move_right", "move_up", "move_down")
	velocity = direction * GameState.PLAYER_LATERAL_SPEED
	move_and_slide()
	global_position = global_position.clamp(
		Vector2(PLAYFIELD_MARGIN, PLAYFIELD_MARGIN),
		Vector2(PLAYFIELD_SIZE.x - PLAYFIELD_MARGIN, PLAYFIELD_SIZE.y - PLAYFIELD_MARGIN),
	)
	if direction != Vector2.ZERO:
		moved.emit(global_position)
