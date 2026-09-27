class_name Player
extends CharacterBody2D
## 玩家「酷跑小子」：横向自动奔跑 + 跳跃/二段跳 + 滑铲的跑酷骨架。
##
## 规范要点（见 SKILL.md「GDScript 规范」）：
## - 输入只读 InputMap 动作名（project.godot [input] 的 jump/slide），禁止硬编码 keycode；
## - 对外只发信号，不直接操作 UI 节点（UI 在 Main 场景里订阅）；
## - 数值读 GameState 调参区（spec.numeric 键名），不写死魔数。

## 玩家位置变化时发出（主场景据此推进距离与 HUD）。
signal moved(position: Vector2)
## 玩家死亡时发出（碰障碍 / 坠出世界）。
signal died

## 动作名（与 project.godot [input] 注册一致）。
const ACTION_JUMP := &"jump"
const ACTION_SLIDE := &"slide"

var active: bool = false
## 本跳已用的跳跃段数（1 = 单跳，2 = 二段跳封顶）。
var jumps_used: int = 0
## 滑铲剩余时长（> 0 即处于滑铲态，碰撞盒已切到低盒）。
var slide_timer: float = 0.0

var _coyote_timer: float = 0.0
var _jump_buffer_timer: float = 0.0

@onready var _stand_shape: CollisionShape2D = $StandShape
@onready var _slide_shape: CollisionShape2D = $SlideShape


func _physics_process(delta: float) -> void:
	if not active:
		velocity = Vector2.ZERO
		return

	# 横向自动奔跑（跑酷内核：玩家只决定跳与滑）。
	velocity.x = GameState.RUN_SPEED_PX_PER_SEC

	# 重力 + 土狼时间/跳跃缓冲（spec §3.2 手感参数）。
	if is_on_floor():
		_coyote_timer = GameState.COYOTE_TIME_SECONDS
		jumps_used = 0
	else:
		_coyote_timer = maxf(_coyote_timer - delta, 0.0)
		velocity.y += GameState.GRAVITY_PX_PER_SEC2 * delta

	_jump_buffer_timer = maxf(_jump_buffer_timer - delta, 0.0)
	if Input.is_action_just_pressed(ACTION_JUMP):
		_jump_buffer_timer = GameState.JUMP_BUFFER_SECONDS
	if _jump_buffer_timer > 0.0:
		_try_jump()

	_tick_slide(delta)
	move_and_slide()
	moved.emit(global_position)

	# 坠出世界（坑洞类死亡的兜底，脚手架期防穿）。
	if global_position.y > 2000.0:
		die()


func _try_jump() -> void:
	var can_jump: bool = false
	if is_on_floor() or _coyote_timer > 0.0:
		velocity.y = GameState.JUMP_VELOCITY_PX_PER_SEC
		jumps_used = 1
		can_jump = true
	elif jumps_used < 2:
		velocity.y = GameState.DOUBLE_JUMP_VELOCITY_PX_PER_SEC
		jumps_used = 2
		can_jump = true
	if can_jump:
		_jump_buffer_timer = 0.0
		_coyote_timer = 0.0
		_end_slide()


func _tick_slide(delta: float) -> void:
	if Input.is_action_just_pressed(ACTION_SLIDE) and is_on_floor():
		slide_timer = GameState.SLIDE_DURATION_SECONDS
	if slide_timer > 0.0:
		slide_timer = maxf(slide_timer - delta, 0.0)
	_apply_slide_shape(slide_timer > 0.0)


## 站立盒 / 滑铲低盒切换（低盒锚定脚底：position 下移半高差）。
func _apply_slide_shape(sliding: bool) -> void:
	_stand_shape.set_deferred("disabled", sliding)
	_slide_shape.set_deferred("disabled", not sliding)


func _end_slide() -> void:
	slide_timer = 0.0


## 是否处于滑铲态（冒烟断言用）。
func is_sliding() -> bool:
	return slide_timer > 0.0


## 死亡：停控、冻结位移（幂等）。
func die() -> void:
	if not active:
		return
	active = false
	_end_slide()
	velocity = Vector2.ZERO
	died.emit()


## 重开：回到出生点由主场景设置位置后调用，恢复运行态与站立盒。
func reset_for_run() -> void:
	velocity = Vector2.ZERO
	jumps_used = 0
	slide_timer = 0.0
	_coyote_timer = 0.0
	_jump_buffer_timer = 0.0
	active = true
	_apply_slide_shape(false)
