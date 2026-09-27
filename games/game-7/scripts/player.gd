class_name Player
extends CharacterBody2D
## 玩家飞船：星云中的四向移动 + 受击无敌闪烁。
##
## 输入只读 InputMap 动作名（键盘 WASD/方向键直连；触摸由虚拟摇杆注入同一组动作），
## 移动速度与活动边界出自统一配置（config.player.*）。

signal moved(position: Vector2)

const BLINK_FREQ_HZ: float = 8.0


func _ready() -> void:
	motion_mode = CharacterBody2D.MOTION_MODE_FLOATING


func _physics_process(_delta: float) -> void:
	var direction := Input.get_vector("move_left", "move_right", "move_up", "move_down")
	velocity = direction * GameState.player_move_speed()
	move_and_slide()
	_clamp_to_viewport()
	if direction != Vector2.ZERO:
		moved.emit(global_position)
	_update_blink()


## 活动范围限制在可视区域内（需求验收 1：屏幕可视范围内四向移动）。
func _clamp_to_viewport() -> void:
	var rect := get_viewport_rect()
	var margin: float = GameState.player_margin()
	global_position = global_position.clamp(
		rect.position + Vector2(margin, margin),
		rect.end - Vector2(margin, margin)
	)


## 受击后 1s 无敌闪烁（需求验收 2）。
func _update_blink() -> void:
	if GameState.invincible_active():
		var phase := absf(sin(GameState.run_time_sec * BLINK_FREQ_HZ * TAU))
		modulate.a = 0.3 + 0.7 * phase
	else:
		modulate.a = 1.0


## 重开时由 Main 归位。
func reset_to(pos: Vector2) -> void:
	global_position = pos
	velocity = Vector2.ZERO
	modulate.a = 1.0
