class_name Player
extends CharacterBody2D
## 玩家「酷跑小子」（spec entity: player）：横向自动奔跑 + 跳跃/二段跳/滑铲
## + 三道具状态（磁铁/护盾/冲刺）+ 无敌帧 + 碾怪 + 坠坑/碰撞死亡。
##
## 规范要点（见 SKILL.md「GDScript 规范」）：
## - 输入只读 InputMap 动作名（project.godot [input] 的 jump/slide），禁止硬编码 keycode；
## - 对外只发信号，不直接操作 UI 节点（UI 在 Main 场景里订阅）；
## - 数值读 GameState 调参区（spec.numeric 键名），不写死魔数；
## - 注释承诺的碰撞余量必须与常量推导一致（碰撞包络教训）：
##   站立盒 64 高（y∈[-32,32]），滑铲盒 36 高（脚底对齐）；低飞怪盒底离地 52px：
##   站立顶部 64 > 52 必撞、滑铲 36 < 52 必过、单跳顶点 168.75 > 怪顶 140 可越。

## 玩家位置变化时发出（主场景据此推进距离与 HUD）。
signal moved(position: Vector2)
## 玩家死亡时发出（cause: "hazard" 碰撞 / "fall" 坠坑）。
signal died(cause: StringName)
## 道具状态变化（转发给 HUD 订阅，见 GameState.powerup_changed）。
signal powerup_changed(kind: StringName, remaining_seconds: float)

## 动作名（与 project.godot [input] 注册一致）。
const ACTION_JUMP := &"jump"
const ACTION_SLIDE := &"slide"

## 道具种类（与 pickup_box.gd 的 KIND_* 一致）。
const POWERUP_MAGNET := &"magnet"
const POWERUP_SHIELD := &"shield"
const POWERUP_DASH := &"dash"

var active: bool = false
## 本跳已用的跳跃段数（1 = 单跳，2 = 二段跳封顶，acc-02）。
var jumps_used: int = 0
## 滑铲剩余时长（> 0 即处于滑铲态，碰撞盒已切到低盒）。
var slide_timer: float = 0.0
## 磁铁剩余时长（> 0 时吸附半径内金币）。
var magnet_timer: float = 0.0
## 护盾剩余层数（> 0 时抵挡一次碰撞，坠坑除外）。
var shield_charges: int = 0
## 冲刺剩余时长（> 0 时速度 ×dashSpeedMultiplier、无敌、碾怪）。
var dash_timer: float = 0.0
## 受击无敌剩余时长（破盾后短暂无敌，防连续碰撞秒死）。
var hurt_invincible_timer: float = 0.0

var _coyote_timer: float = 0.0
var _jump_buffer_timer: float = 0.0
## 死亡原因（重开时复位）。
var _death_cause: StringName = &""
## 跑步帧累加器（帧表驱动：run_frame = int(累加值) % RUN_FRAME_COUNT）。
var _run_frame_accum: float = 0.0
## 滚动（滑铲）帧累加器。
var _roll_frame_accum: float = 0.0
## 卡通美术层与生效期特效层（_ready 拼装，见 player_art.gd / player_fx.gd）。
var _art: PlayerArt = null
var _fx: PlayerFx = null

@onready var _stand_shape: CollisionShape2D = $StandShape
@onready var _slide_shape: CollisionShape2D = $SlideShape


func _ready() -> void:
	add_to_group(&"player")
	_art = PlayerArt.new()
	_art.name = "Art"
	add_child(_art)
	_fx = PlayerFx.new()
	_fx.name = "Fx"
	add_child(_fx)


func _physics_process(delta: float) -> void:
	if not active:
		if _death_cause != &"":
			# 死亡表现：保留重力让身体弹飞坠落（不再自动奔跑）。
			velocity.y += GameState.tuning_value(&"gravityPxPerSec2") * delta
			velocity.x = move_toward(velocity.x, 0.0, 400.0 * delta)
			move_and_slide()
			rotation += 6.0 * delta
		return

	_tick_powerups(delta)

	# 横向自动奔跑（跑酷内核：玩家只决定跳与滑）；冲刺期 ×dashSpeedMultiplier。
	var run_speed: float = GameState.speed_for_distance(GameState.distance_m)
	if dash_timer > 0.0:
		run_speed *= GameState.tuning_value(&"dashSpeedMultiplier")
	velocity.x = run_speed

	# 重力 + 土狼时间/跳跃缓冲（spec §3.2 手感参数）。
	if is_on_floor():
		_coyote_timer = GameState.tuning_value(&"coyoteTimeSeconds")
		jumps_used = 0
	else:
		_coyote_timer = maxf(_coyote_timer - delta, 0.0)
		velocity.y += GameState.tuning_value(&"gravityPxPerSec2") * delta

	_jump_buffer_timer = maxf(_jump_buffer_timer - delta, 0.0)
	if Input.is_action_just_pressed(ACTION_JUMP):
		_jump_buffer_timer = GameState.tuning_value(&"jumpBufferSeconds")
	if _jump_buffer_timer > 0.0:
		_try_jump()

	_tick_slide(delta)
	move_and_slide()
	moved.emit(global_position)
	_update_visuals(delta)

	# 坠坑死亡：低于地面线 deathFallPx 判坠（护盾不防坠坑，spec §3.4）。
	if global_position.y > GameState.GROUND_LINE_Y + GameState.tuning_value(&"deathFallPx"):
		die(&"fall")


func _try_jump() -> void:
	var can_jump: bool = false
	if is_on_floor() or _coyote_timer > 0.0:
		velocity.y = GameState.tuning_value(&"jumpVelocityPxPerSec")
		jumps_used = 1
		can_jump = true
	elif jumps_used < 2:
		velocity.y = GameState.tuning_value(&"doubleJumpVelocityPxPerSec")
		jumps_used = 2
		can_jump = true
	if can_jump:
		_jump_buffer_timer = 0.0
		_coyote_timer = 0.0
		_end_slide()


func _tick_slide(delta: float) -> void:
	if Input.is_action_just_pressed(ACTION_SLIDE) and is_on_floor():
		slide_timer = GameState.tuning_value(&"slideDurationSeconds")
	if slide_timer > 0.0:
		slide_timer = maxf(slide_timer - delta, 0.0)
	_apply_slide_shape(slide_timer > 0.0)


## 站立盒 / 滑铲低盒切换（低盒锚定脚底：position 下移半高差）。
func _apply_slide_shape(sliding: bool) -> void:
	_stand_shape.set_deferred("disabled", sliding)
	_slide_shape.set_deferred("disabled", not sliding)


func _end_slide() -> void:
	slide_timer = 0.0


## ── 道具（spec entity: powerup-magnet/shield/dash）──
## 拾取入口：效果数值全部来自 GameState 调参区（acc-04）。
func apply_powerup(kind: StringName) -> void:
	match kind:
		POWERUP_MAGNET:
			magnet_timer = GameState.tuning_value(&"magnetDurationSeconds")
		POWERUP_SHIELD:
			shield_charges = int(GameState.tuning_value(&"shieldCharges"))
		POWERUP_DASH:
			dash_timer = GameState.tuning_value(&"dashDurationSeconds")
		_:
			return
	powerup_changed.emit(kind, _remaining_of(kind))


func _tick_powerups(delta: float) -> void:
	if magnet_timer > 0.0:
		magnet_timer = maxf(magnet_timer - delta, 0.0)
		if magnet_timer == 0.0:
			powerup_changed.emit(POWERUP_MAGNET, 0.0)
	if dash_timer > 0.0:
		dash_timer = maxf(dash_timer - delta, 0.0)
		if dash_timer == 0.0:
			powerup_changed.emit(POWERUP_DASH, 0.0)
	if hurt_invincible_timer > 0.0:
		hurt_invincible_timer = maxf(hurt_invincible_timer - delta, 0.0)


func _remaining_of(kind: StringName) -> float:
	match kind:
		POWERUP_MAGNET:
			return magnet_timer
		POWERUP_DASH:
			return dash_timer
		_:
			return -1.0


## 是否处于「吸附金币」状态（磁铁生效中，或冲刺坐骑吸附）。
func is_attracting() -> bool:
	return magnet_timer > 0.0 or dash_timer > 0.0


func is_dashing() -> bool:
	return dash_timer > 0.0


func is_sliding() -> bool:
	return slide_timer > 0.0


## ── 碰撞裁决（主场景 hazard 命中时调用；返回结果供反馈用）──
## 冲刺 → 碾毁障碍（+30 分，主场景计分）；护盾 → 破盾 + 无敌帧；其余 → 死亡。
func hit_hazard() -> StringName:
	if not active:
		return &"ignore"
	if is_dashing():
		return &"smash"
	if hurt_invincible_timer > 0.0:
		return &"ignore"
	if shield_charges > 0:
		shield_charges -= 1
		hurt_invincible_timer = GameState.tuning_value(&"hurtInvincibleSeconds")
		SfxBank.play(&"shield", self)
		return &"shield_break"
	die(&"hazard")
	return &"death"


## 死亡：停控、弹飞（幂等）；慢动作由主场景处理。
func die(cause: StringName = &"hazard") -> void:
	if not active:
		return
	active = false
	_death_cause = cause
	_end_slide()
	magnet_timer = 0.0
	dash_timer = 0.0
	velocity = Vector2(velocity.x * 0.25, -520.0)
	SfxBank.play(&"death", self)
	died.emit(cause)


## 重开：回到出生点由主场景设置位置后调用，恢复运行态与站立盒。
func reset_for_run() -> void:
	velocity = Vector2.ZERO
	jumps_used = 0
	slide_timer = 0.0
	magnet_timer = 0.0
	shield_charges = 0
	dash_timer = 0.0
	hurt_invincible_timer = 0.0
	_death_cause = &""
	_coyote_timer = 0.0
	_jump_buffer_timer = 0.0
	rotation = 0.0
	active = true
	_run_frame_accum = 0.0
	_roll_frame_accum = 0.0
	_apply_slide_shape(false)
	modulate = Color(1, 1, 1, 1)


## ── 表现层（迭代需求 ②：帧表驱动卡通动画，帧表在 PlayerArt）──
## 状态 → 帧表：跑 = 8 帧循环（帧率随移速）、滞空 = 3 姿态（升/顶/落）、
## 滑铲 = 6 帧滚动；死亡 = 后仰旋转（_physics_process 死亡分支已转根节点 rotation）。
## 特效层（PlayerFx）按计时器自行显隐 —— 倒计时归零特效与增益同步消失。
func _update_visuals(delta: float) -> void:
	if _art == null:
		return
	if is_sliding():
		_roll_frame_accum += delta * 14.0
		_art.set_roll_frame(int(_roll_frame_accum) % PlayerArt.ROLL_FRAME_COUNT)
	elif not is_on_floor():
		var pose: int = 0
		if velocity.y > 160.0:
			pose = 2
		elif absf(velocity.y) <= 160.0:
			pose = 1
		_art.set_jump_pose(pose)
	else:
		_run_frame_accum += delta * clampf(velocity.x / 40.0, 4.0, 18.0)
		_art.set_run_frame(int(_run_frame_accum) % PlayerArt.RUN_FRAME_COUNT)
	_update_invincible_flash()


## 破盾无敌帧闪烁（半透明呼吸）；护盾在身上时挂淡蓝描边色。
func _update_invincible_flash() -> void:
	if hurt_invincible_timer > 0.0:
		var blink: float = 0.55 + 0.45 * sin(hurt_invincible_timer * 40.0)
		modulate = Color(1, 1, 1, blink)
	elif is_dashing():
		modulate = Color(1.35, 1.15, 0.7, 1.0)
	elif shield_charges > 0:
		modulate = Color(0.75, 0.92, 1.25, 1.0)
	else:
		modulate = Color(1, 1, 1, 1)
