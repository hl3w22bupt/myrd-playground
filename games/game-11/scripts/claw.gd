class_name Claw
extends Node3D
## 夹爪（3D）：摇杆平移（XZ 平面）→ 下爪 → 闭合抓取 → 提起 → 自动返回取物口 → 松爪。
##
## 规范要点：
## - 输入只读 InputMap 动作名（move_left/right/up/down），数值只读 GameState 调参区；
## - 对外只发信号（moved / cycle_finished / grab_resolved / slipped），UI 反馈由主场景订阅后挂 Juice；
## - 状态机推进全部在 _physics_process，headless 冒烟可分帧驱动断言；
## - 抓取判定：爪头球形邻域内最近的空闲娃娃，按 夹力/体重 掷骰（debug_always_grab 测试接缝）。

signal moved(position: Vector3)
## 一个抓取周期结束：grabbed=true = 娃娃被送进取物口上方松开。
signal cycle_finished(grabbed: bool)
## 抓取判定结果（闭合瞬间）：抓到 / 空爪 —— 主场景据此挂即时反馈。
signal grab_resolved(grabbed: bool)
## 中途滑落（夹持不稳，娃娃掉回机台）。
signal slipped(position: Vector3)

enum ClawState { IDLE, DROPPING, GRABBING, RAISING, RETURNING, RELEASING }

## 下爪深度（米）：从龙门架到娃娃堆高度。
const HEAD_DROP_DEPTH: float = 1.28
## 闭合 / 松爪时长（秒）。
const GRAB_TIME: float = 0.3
const RELEASE_TIME: float = 0.24
## 爪子平移的活动范围夹边（米，防卡死角）。
const EDGE_MARGIN: float = 0.06
## 移动伺服音效节流（秒）。
const MOVE_SFX_INTERVAL: float = 0.22

var state: int = ClawState.IDLE
## 可移动范围（XZ 平面：x=世界 X，y=世界 Z；主场景 _ready 注入）。
var field_rect: Rect2 = Rect2(-0.55, -0.4, 1.1, 0.82)
## 取物口悬停点（世界坐标，主场景注入）。
var pit_point: Vector3 = Vector3.ZERO
## 娃娃容器（抓取判定遍历用，主场景注入）。
var dolls: Node3D = null
## 测试接缝：true 时跳过滑落掷骰（冒烟需要确定性抓取；运行时恒为 false）。
var debug_always_grab: bool = false

var head_drop: float = 0.0
var arm_close: float = 0.0
var held_doll: Doll = null

var _grab_timer: float = 0.0
var _will_slip: bool = false
var _cycle_grabbed: bool = false
var _move_sfx_cd: float = 0.0
var _rng := RandomNumberGenerator.new()

## 视觉节点（_ready 代码搭建）。
var _head: Node3D
var _cable: MeshInstance3D
var _arm_pivots: Array[Node3D] = []
var _head_mat: StandardMaterial3D
var _tip_mat: StandardMaterial3D


func _ready() -> void:
	_rng.randomize()
	_build_visuals()


func claw_state_name() -> String:
	return ClawState.keys()[state]


## 复位到待命态（开局/重开时由主场景调用）：松开爪上娃娃、收拢爪头。
func reset_state() -> void:
	if held_doll != null:
		var doll := held_doll
		held_doll = null
		doll.release(false)
	state = ClawState.IDLE
	head_drop = 0.0
	arm_close = 0.0
	_will_slip = false
	_cycle_grabbed = false
	_sync_visual()


func effective_speed() -> float:
	return GameState.claw_speed * float(GameState.current_claw()["speed_mult"])


func effective_radius() -> float:
	return GameState.current_claw()["radius"]


## 爪头（下爪末端）的世界坐标：抓取判定与挂娃娃都锚在这里。
func head_position() -> Vector3:
	return global_position + Vector3(0.0, -head_drop * HEAD_DROP_DEPTH, 0.0)


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
	_move_sfx_cd = maxf(_move_sfx_cd - delta, 0.0)
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
	_sync_visual()


func _process_idle(delta: float) -> void:
	var direction := Input.get_vector("move_left", "move_right", "move_up", "move_down")
	if direction == Vector2.ZERO:
		return
	var speed := effective_speed()
	var next := position + Vector3(direction.x, 0.0, direction.y) * speed * delta
	var min_edge := field_rect.position + Vector2(EDGE_MARGIN, EDGE_MARGIN)
	var max_edge := field_rect.end - Vector2(EDGE_MARGIN, EDGE_MARGIN)
	position = Vector3(clampf(next.x, min_edge.x, max_edge.x), position.y, clampf(next.z, min_edge.y, max_edge.y))
	if _move_sfx_cd <= 0.0:
		_move_sfx_cd = MOVE_SFX_INTERVAL
		Juice.sfx(&"move")
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
	_carry_held_doll()
	if head_drop <= 0.0:
		if held_doll != null and _will_slip:
			# 夹持不稳：提起瞬间滑落，娃娃掉回机台（交还物理，随机翻滚）。
			var doll := held_doll
			held_doll = null
			doll.release(false)
			slipped.emit(global_position)
		state = ClawState.RETURNING


func _process_returning(delta: float) -> void:
	var step := effective_speed() * delta
	var to_pit := Vector3(pit_point.x - global_position.x, 0.0, pit_point.z - global_position.z)
	if to_pit.length() <= step:
		global_position = Vector3(pit_point.x, global_position.y, pit_point.z)
		state = ClawState.RELEASING
		_grab_timer = 0.0
	else:
		global_position += to_pit.normalized() * step
	_carry_held_doll()


func _process_releasing(delta: float) -> void:
	_grab_timer += delta
	arm_close = maxf(arm_close - delta / RELEASE_TIME, 0.0)
	if arm_close <= 0.0 and _grab_timer >= RELEASE_TIME:
		if held_doll != null:
			var doll := held_doll
			held_doll = null
			_cycle_grabbed = true
			# 松在取物口正上方：交还物理，落进取物口（Machine.pit_area body_entered 入账）。
			doll.release(true)
		state = ClawState.IDLE
		cycle_finished.emit(_cycle_grabbed)
		GameState.check_coins_exhausted()


## 挂着的娃娃跟随爪头（冻结态直接写全局位置）。
func _carry_held_doll() -> void:
	if held_doll != null:
		held_doll.global_position = head_position() + Vector3(0.0, -(held_doll.radius * 0.9 + 0.03), 0.0)
		held_doll.rotation.y += 0.01


## 闭合判定：球形邻域内最近的空闲娃娃；掷骰决定是否夹稳（夹力/体重）。
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
		var dist := head_position().distance_to(doll.global_position + Vector3(0.0, doll.radius * 0.25, 0.0))
		if dist <= best_dist + doll.radius * 0.35:
			best = doll
	return best


## ── 视觉：滑车 + 吊缆 + 爪头 + 爪臂（爪型决定臂数/形状/配色）──

const CLAW_COLORS: Dictionary = {
	&"triple": Color(1.0, 0.82, 0.28),
	&"twin": Color(0.95, 0.42, 0.36),
	&"scissor": Color(0.45, 0.85, 0.95),
}
## 三爪的圆周分布角。
const TRIPLE_YAW: Array[float] = [-2.094, 0.0, 2.094]
const TWIN_YAW: Array[float] = [-1.571, 1.571]
## 臂张开 / 闭合的倾角（弧度）。
const SPREAD_OPEN: float = 0.42
const SPREAD_CLOSED: float = 0.05


func _build_visuals() -> void:
	var carriage := MeshInstance3D.new()
	var cart_mesh := BoxMesh.new()
	cart_mesh.size = Vector3(0.2, 0.11, 0.16)
	carriage.mesh = cart_mesh
	carriage.material_override = _metal(Color(0.92, 0.9, 0.86), 0.3)
	add_child(carriage)
	_cable = MeshInstance3D.new()
	var cable_mesh := CylinderMesh.new()
	cable_mesh.top_radius = 0.008
	cable_mesh.bottom_radius = 0.008
	cable_mesh.height = 1.0
	_cable.mesh = cable_mesh
	_cable.material_override = _metal(Color(0.6, 0.62, 0.66), 0.5)
	add_child(_cable)
	_head = Node3D.new()
	add_child(_head)
	var head_ball := MeshInstance3D.new()
	var ball := SphereMesh.new()
	ball.radius = 0.05
	ball.height = 0.1
	head_ball.mesh = ball
	_head.add_child(head_ball)
	var claw_id: StringName = GameState.current_claw()["id"]
	var claw_color := CLAW_COLORS.get(claw_id, Color(0.9, 0.9, 0.9)) as Color
	_head_mat = _metal(claw_color, 0.25)
	_tip_mat = _metal(claw_color.darkened(0.3), 0.35)
	var yaws: Array[float] = TRIPLE_YAW if claw_id != &"twin" else TWIN_YAW
	if claw_id == &"scissor":
		yaws = TWIN_YAW
	for yaw in yaws:
		var pivot := Node3D.new()
		pivot.rotation = Vector3(SPREAD_OPEN, yaw, 0.0)
		_head.add_child(pivot)
		var arm := MeshInstance3D.new()
		var box := BoxMesh.new()
		if claw_id == &"scissor":
			box.size = Vector3(0.05, 0.36, 0.012)
		else:
			box.size = Vector3(0.028, 0.34, 0.016)
		arm.mesh = box
		arm.position = Vector3(0.0, -0.18, 0.0)
		arm.material_override = _head_mat
		pivot.add_child(arm)
		var tip := MeshInstance3D.new()
		var tip_ball := SphereMesh.new()
		tip_ball.radius = 0.018
		tip_ball.height = 0.036
		tip.mesh = tip_ball
		tip.position = Vector3(0.0, -0.35, 0.0)
		tip.material_override = _tip_mat
		pivot.add_child(tip)
		_arm_pivots.append(pivot)
	_sync_visual()


func _metal(color: Color, rough: float) -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.metallic = 0.75
	mat.roughness = rough
	return mat


## 每帧把状态量同步到视觉节点：缆长、爪头高度、臂张合、爪型配色。
func _sync_visual() -> void:
	if _head == null:
		return
	var drop_len := head_drop * HEAD_DROP_DEPTH
	_head.position = Vector3(0.0, -drop_len, 0.0)
	_cable.scale = Vector3(1.0, maxf(drop_len, 0.01), 1.0)
	_cable.position = Vector3(0.0, -drop_len / 2.0, 0.0)
	var spread := lerpf(SPREAD_OPEN, SPREAD_CLOSED, arm_close)
	for pivot in _arm_pivots:
		pivot.rotation.x = spread
	var claw_id: StringName = GameState.current_claw()["id"]
	var color := CLAW_COLORS.get(claw_id, Color(0.9, 0.9, 0.9)) as Color
	if _head_mat != null and _head_mat.albedo_color != color:
		_head_mat.albedo_color = color
		_tip_mat.albedo_color = color.darkened(0.3)
		for pivot in _arm_pivots:
			for child in pivot.get_children():
				(child as MeshInstance3D).material_override = _head_mat
