class_name Claw
extends Node2D
## 夹爪（玩家可控角色）：摇杆平移 → 下爪 → 闭合抓取 → 提起 → 自动返回取物口 → 松爪。
##
## 规范要点：
## - 输入只读 InputMap 动作名（move_left/right/up/down），数值只读 GameState 调参区；
## - 对外只发信号（moved / cycle_finished），UI 反馈由主场景订阅后挂 Juice；
## - 状态机推进全部在 _physics_process，headless 冒烟可分帧驱动断言。

signal moved(position: Vector2)
## 一个抓取周期结束：grabbed=true = 娃娃被送进取物口上方松开。
signal cycle_finished(grabbed: bool)
## 抓取判定结果（闭合瞬间）：抓到 / 空爪 —— 主场景据此挂即时反馈。
signal grab_resolved(grabbed: bool)
## 中途滑落（夹持不稳，娃娃掉回机台）。
signal slipped(position: Vector2)

enum ClawState { IDLE, DROPPING, GRABBING, RAISING, RETURNING, RELEASING }

## 视觉下爪深度（像素）。
const HEAD_DROP_DEPTH: float = 96.0
## 闭合 / 松爪时长（秒）。
const GRAB_TIME: float = 0.28
const RELEASE_TIME: float = 0.22
## 爪子平移的活动范围夹边（防抖动余量）。
const EDGE_MARGIN: float = 26.0

var state: int = ClawState.IDLE
## 可移动范围（机台玻璃区，主场景 _ready 注入）。
var field_rect: Rect2 = Rect2(0, 0, 720, 1280)
## 取物口悬停点（世界坐标，主场景注入）。
var pit_point: Vector2 = Vector2.ZERO
## 娃娃容器（抓取判定遍历用，主场景注入）。
var dolls: Node2D = null
## 测试接缝：true 时跳过滑落掷骰（冒烟需要确定性抓取；运行时恒为 false）。
var debug_always_grab: bool = false

var head_drop: float = 0.0
var arm_close: float = 0.0
var held_doll: Doll = null

var _grab_timer: float = 0.0
var _will_slip: bool = false
var _cycle_grabbed: bool = false
var _rng := RandomNumberGenerator.new()


func _ready() -> void:
	_rng.randomize()


func claw_state_name() -> String:
	return ClawState.keys()[state]


## 复位到待命态（开局/重开时由主场景调用）：松开爪上娃娃、收拢爪头。
func reset_state() -> void:
	if held_doll != null:
		var doll := held_doll
		held_doll = null
		doll.release(global_position + Vector2(0.0, 30.0), false)
	state = ClawState.IDLE
	head_drop = 0.0
	arm_close = 0.0
	_will_slip = false
	_cycle_grabbed = false


func effective_speed() -> float:
	return GameState.claw_speed * GameState.current_claw()["speed_mult"]


func effective_radius() -> float:
	return GameState.current_claw()["radius"]


## 爪头（下爪末端）的世界坐标：抓取判定与挂娃娃都锚在这里。
func head_position() -> Vector2:
	return global_position + Vector2(0.0, head_drop * HEAD_DROP_DEPTH)


## 尝试下爪：IDLE + 进行中 + 币足才成立；返回是否受理。
func try_drop() -> bool:
	if state != ClawState.IDLE or not GameState.spend_coin():
		return false
	state = ClawState.DROPPING
	_cycle_grabbed = false
	_will_slip = false
	held_doll = null
	return true


func _physics_process(delta: float) -> void:
	match state:
		ClawState.IDLE:
			_process_idle(delta)
		ClawState.DROPPING:
			_process_dropping(delta)
		ClawState.GRABBING:
			_process_grabbing(delta)
		ClawState.RAISING:
			_process_raising(delta)
		ClawState.RETURNING:
			_process_returning(delta)
		ClawState.RELEASING:
			_process_releasing(delta)
	queue_redraw()


func _process_idle(delta: float) -> void:
	var direction := Input.get_vector("move_left", "move_right", "move_up", "move_down")
	if direction == Vector2.ZERO:
		return
	var speed := effective_speed()
	position += direction * speed * delta
	position = position.clamp(
		field_rect.position + Vector2(EDGE_MARGIN, EDGE_MARGIN),
		field_rect.end - Vector2(EDGE_MARGIN, EDGE_MARGIN)
	)
	moved.emit(global_position)


func _process_dropping(delta: float) -> void:
	head_drop = minf(head_drop + delta * GameState.drop_speed / HEAD_DROP_DEPTH, 1.0)
	if head_drop >= 1.0:
		state = ClawState.GRABBING
		_grab_timer = 0.0


func _process_grabbing(delta: float) -> void:
	_grab_timer += delta
	arm_close = minf(arm_close + delta / GRAB_TIME, 1.0)
	if arm_close >= 1.0 and _grab_timer >= GRAB_TIME:
		_resolve_grab()
		state = ClawState.RAISING


func _process_raising(delta: float) -> void:
	head_drop = maxf(head_drop - delta * GameState.drop_speed / HEAD_DROP_DEPTH, 0.0)
	if head_drop <= 0.0:
		if held_doll != null and _will_slip:
			# 夹持不稳：提起瞬间滑落，娃娃掉回机台。
			var doll := held_doll
			held_doll = null
			doll.release(global_position + Vector2(0.0, 30.0), false)
			slipped.emit(global_position)
		state = ClawState.RETURNING


func _process_returning(delta: float) -> void:
	var step := effective_speed() * delta
	var to_pit := pit_point - global_position
	if to_pit.length() <= step:
		global_position = pit_point
		state = ClawState.RELEASING
		_grab_timer = 0.0
	else:
		global_position += to_pit.normalized() * step
	# 挂着的娃娃跟随爪头。
	if held_doll != null:
		held_doll.global_position = head_position() + Vector2(0.0, 26.0)


func _process_releasing(delta: float) -> void:
	_grab_timer += delta
	arm_close = maxf(arm_close - delta / RELEASE_TIME, 0.0)
	if arm_close <= 0.0 and _grab_timer >= RELEASE_TIME:
		if held_doll != null:
			var doll := held_doll
			held_doll = null
			_cycle_grabbed = true
			# 松在取物口正上方：落进取物口（主场景订阅 Doll.caught 入账）。
			doll.release(pit_point + Vector2(0.0, 58.0), true)
		state = ClawState.IDLE
		cycle_finished.emit(_cycle_grabbed)
		GameState.check_coins_exhausted()


## 闭合判定：半径内最近的空闲娃娃；掷骰决定是否夹稳。
func _resolve_grab() -> void:
	var target := _nearest_idle_doll()
	if target == null:
		grab_resolved.emit(false)
		return
	var weight := float(target.kind.get("weight", 1.0))
	var power := float(GameState.current_claw()["power"])
	var success_prob := clampf(power / weight, 0.05, 0.97)
	var grabbed := debug_always_grab or _rng.randf() <= success_prob
	if grabbed:
		held_doll = target
		_will_slip = false
		target.grab()
		grab_resolved.emit(true)
	else:
		_will_slip = true
		grab_resolved.emit(false)


func _nearest_idle_doll() -> Doll:
	if dolls == null:
		return null
	var best: Doll = null
	var best_dist := effective_radius()
	for child in dolls.get_children():
		var doll := child as Doll
		if doll == null or doll.state != Doll.DollState.IDLE:
			continue
		var dist := head_position().distance_to(doll.global_position)
		var reach := best_dist + doll.radius * 0.35
		if dist <= reach:
			best_dist = maxf(dist - doll.radius * 0.35, 1.0)
			best = doll
	return best


## ── 绘制：吊缆 + 滑车 + 爪头 + 爪臂（爪型决定臂数与配色）──

const CLAW_COLORS: Dictionary = {
	&"triple": Color(1.0, 0.82, 0.28),
	&"twin": Color(0.95, 0.42, 0.36),
	&"scissor": Color(0.45, 0.85, 0.95),
}


func _draw() -> void:
	var claw_id: StringName = GameState.current_claw()["id"]
	var metal := CLAW_COLORS.get(claw_id, Color(0.9, 0.9, 0.9)) as Color
	var head := Vector2(0.0, head_drop * HEAD_DROP_DEPTH)
	# 吊缆 + 滑车。
	draw_line(Vector2.ZERO, head, Color(0.75, 0.78, 0.82, 0.9), 3.0)
	draw_circle(Vector2.ZERO, 10.0, Color(0.55, 0.58, 0.64))
	draw_circle(Vector2.ZERO, 6.0, Color(0.85, 0.87, 0.9))
	# 爪头（球关节）。
	draw_circle(head, 9.0, metal.darkened(0.25))
	# 爪臂：side ∈ {-1,0,1} 决定左右中；spread 张开 0.5rad → 闭合 0.06rad。
	var spread := lerpf(0.5, 0.06, arm_close)
	match claw_id:
		&"twin":
			_draw_arm(head, -1.0, spread, metal, 10.0)
			_draw_arm(head, 1.0, spread, metal, 10.0)
		&"scissor":
			_draw_blade(head, -1.0, spread, metal)
			_draw_blade(head, 1.0, spread, metal)
		_:
			_draw_arm(head, -1.0, spread, metal, 8.0)
			_draw_arm(head, 0.0, spread, metal, 8.0)
			_draw_arm(head, 1.0, spread, metal, 8.0)


## 弯折爪臂：近段向外斜，远段向内收拢（像真机爪指）。screen 坐标 +y 向下。
func _draw_arm(head: Vector2, side: float, spread: float, color: Color, width: float) -> void:
	var dir1 := Vector2(0.0, 1.0).rotated(side * spread * 0.55)
	var dir2 := Vector2(0.0, 1.0).rotated(side * spread * 0.12).rotated(side * 0.22)
	var knee := head + dir1 * 36.0
	var tip := knee + dir2 * 30.0
	draw_line(head, knee, color, width)
	draw_line(knee, tip, color.lightened(0.15), width * 0.85)
	draw_circle(tip, width * 0.55, color.darkened(0.2))


## 剪刀爪刀刃：细长三角，闭合时双刃交叠。
func _draw_blade(head: Vector2, side: float, spread: float, color: Color) -> void:
	var dir := Vector2(0.0, 1.0).rotated(side * spread * 0.8)
	var tip := head + dir * 54.0
	var edge := dir.orthogonal() * 7.0
	draw_polygon(
		PackedVector2Array([head + edge, head - edge, tip]),
		PackedColorArray([color, color, color.lightened(0.3)])
	)
