class_name Player
extends CharacterBody2D
## 玩家飞船：星云中的四向移动 + 受击无敌闪烁 + 引擎尾焰（速度感反馈）。
##
## 输入只读 InputMap 动作名（键盘 WASD/方向键直连；触摸由虚拟摇杆注入同一组动作），
## 移动速度与活动边界出自调参区变量（GameState.move_speed / player_margin，config 同步）。
##
## 碰撞盒余量推导（验收 2：碰撞盒误差 ≤ 角色宽度 10%）：
##   视觉箭头（player.tscn Body）包围盒 22×22 → 角色宽度 22px；
##   碰撞矩形 20×20 → 误差 2px ≈ 宽度的 9%，且略小于视觉（玩家有利余量，被撞判定更宽容）。

signal moved(position: Vector2)

const BLINK_FREQ_HZ: float = 8.0
## 引擎尾焰参数：颜色同飞船蓝，强度随档位放大（提速可感知的表现层反馈）。
const TRAIL_LIFETIME_SEC: float = 0.28
const TRAIL_COLOR: Color = Color(0.5, 0.8, 1.0, 0.75)
const TRAIL_VELOCITY_MIN_AT_V0: float = 24.0
const TRAIL_VELOCITY_MAX_AT_V0: float = 52.0

var _trail: CPUParticles2D


func _ready() -> void:
	motion_mode = CharacterBody2D.MOTION_MODE_FLOATING
	_build_engine_trail()


## 引擎尾焰：代码构建（不新增 .tscn，遵守「场景不凭空生成」纪律）；
## 无 Camera2D / 无贴图依赖，headless 与 Web 导出均安全。
func _build_engine_trail() -> void:
	_trail = CPUParticles2D.new()
	_trail.name = "EngineTrail"
	_trail.emitting = true
	_trail.amount = 26
	_trail.lifetime = TRAIL_LIFETIME_SEC
	_trail.local_coords = false
	_trail.direction = Vector2(0, 1)
	_trail.spread = 14.0
	_trail.gravity = Vector2.ZERO
	_trail.initial_velocity_min = TRAIL_VELOCITY_MIN_AT_V0
	_trail.initial_velocity_max = TRAIL_VELOCITY_MAX_AT_V0
	_trail.scale_amount_min = 1.0
	_trail.scale_amount_max = 2.4
	_trail.color = TRAIL_COLOR
	_trail.position = Vector2(0, 11)
	add_child(_trail)


func _physics_process(_delta: float) -> void:
	var direction := Input.get_vector("move_left", "move_right", "move_up", "move_down")
	velocity = direction * GameState.player_move_speed()
	move_and_slide()
	_clamp_to_viewport()
	if direction != Vector2.ZERO:
		moved.emit(global_position)
	_update_blink()
	_update_trail_boost()


## 尾焰强度随档位：速度越快喷流越急（「收水晶→提速」的身体反馈，HUD 之外的第二通道）。
func _update_trail_boost() -> void:
	var boost: float = GameState.speed_multiplier()
	_trail.initial_velocity_min = TRAIL_VELOCITY_MIN_AT_V0 * boost
	_trail.initial_velocity_max = TRAIL_VELOCITY_MAX_AT_V0 * boost


## 活动范围限制在可视区域内（需求验收 1：屏幕可视范围内四向移动；
## 边界钳制保证推到边上不卡死角、不飞出屏）。
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
