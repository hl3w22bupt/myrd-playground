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
## 受击无敌期闪烁（知识基准 4.2：1.0s 无敌闪烁，期间无碰撞判定由 GameState 口径保证）。
## alpha 压在 0.35~0.75 区间，无敌期内永不到 1.0 —— 视觉与断言都稳定可辨。
const BLINK_ALPHA_MIN: float = 0.35
const BLINK_ALPHA_MAX: float = 0.75
const BLINK_HZ: float = 9.0

var _blink_time: float = 0.0


func _physics_process(delta: float) -> void:
	_tick_invincible_blink(delta)
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


## 无敌期闪烁：Juice.flash 的受击红闪（0.12s）结束后由这里接管透明度节奏；
## 无敌结束把 modulate 复位为不透明（正常态 alpha 不被本函数改写）。
func _tick_invincible_blink(delta: float) -> void:
	if GameState.is_invincible():
		_blink_time += delta
		var pulse := 0.5 + 0.5 * sin(TAU * BLINK_HZ * _blink_time)
		modulate.a = lerpf(BLINK_ALPHA_MIN, BLINK_ALPHA_MAX, pulse)
	elif _blink_time > 0.0:
		_blink_time = 0.0
		modulate.a = 1.0
