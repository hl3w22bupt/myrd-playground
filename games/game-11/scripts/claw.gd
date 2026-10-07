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
## 跟随爪型变色的网格（_sync_visual 只改这些的共享材质，不再整体覆盖 override）。
var _tinted: Array[MeshInstance3D] = []
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


## ── 视觉（画质 v2 专项三：夹爪多部件拼装 + 圆滑着色）──
## 滑车（滚轮+螺栓）→ 吊缆 → 缆夹 → 爪头（颈柱/环座/圆盘）→ 每臂（胶囊上臂 →
## 肘关节球 → 锥形下指 → 指尖胶垫）。曲面件用 Capsule/Sphere/Cylinder，无硬棱盒子。

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

## 爪臂分段锚点（沿 pivot -Y 向下）。
const UPPER_ARM_LEN: float = 0.22
const LOWER_FINGER_LEN: float = 0.17
const ELBOW_Y: float = -UPPER_ARM_LEN
const FINGER_Y: float = -(UPPER_ARM_LEN + LOWER_FINGER_LEN * 0.5)
const TIP_Y: float = -(UPPER_ARM_LEN + LOWER_FINGER_LEN)

var _joint_mat: StandardMaterial3D
var _chrome_mat: StandardMaterial3D


func _build_visuals() -> void:
	var claw_id: StringName = GameState.current_claw()["id"]
	var claw_color := CLAW_COLORS.get(claw_id, Color(0.9, 0.9, 0.9)) as Color
	# 材质分级：镀铬爪色 / 深色关节金属 / 橡胶指尖 / 银灰滑车。
	_head_mat = _metal(claw_color, 0.20)
	_head_mat.metallic_specular = 0.75
	_tip_mat = _rubber(claw_color.darkened(0.55))
	_joint_mat = _metal(Color(0.32, 0.33, 0.38), 0.32)
	_chrome_mat = _metal(Color(0.88, 0.89, 0.92), 0.26)
	_chrome_mat.metallic_specular = 0.8
	_build_carriage()
	_cable = MeshInstance3D.new()
	var cable_mesh := CylinderMesh.new()
	cable_mesh.top_radius = 0.008
	cable_mesh.bottom_radius = 0.008
	cable_mesh.height = 1.0
	cable_mesh.radial_segments = 16
	_cable.mesh = cable_mesh
	_cable.material_override = _rubber(Color(0.16, 0.16, 0.18))
	add_child(_cable)
	_head = Node3D.new()
	add_child(_head)
	_build_head()
	var yaws: Array[float] = TWIN_YAW if claw_id == &"twin" or claw_id == &"scissor" else TRIPLE_YAW
	for yaw in yaws:
		_build_arm(yaw, claw_id)
	_sync_visual()


## 滑车：主体 + 沿梁滚轮（横向圆柱）+ 两颗螺栓 + 侧导靴。
func _build_carriage() -> void:
	var body := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = Vector3(0.18, 0.10, 0.14)
	body.mesh = box
	body.material_override = _chrome_mat
	add_child(body)
	var roller := MeshInstance3D.new()
	var roller_cyl := CylinderMesh.new()
	roller_cyl.top_radius = 0.028
	roller_cyl.bottom_radius = 0.028
	roller_cyl.height = 0.20
	roller_cyl.radial_segments = 24
	roller.mesh = roller_cyl
	roller.rotation.x = PI / 2.0
	roller.position = Vector3(0.0, 0.062, 0.0)
	roller.material_override = _joint_mat
	add_child(roller)
	for dx in [-0.075, 0.075]:
		var bolt := MeshInstance3D.new()
		var bolt_sphere := SphereMesh.new()
		bolt_sphere.radius = 0.016
		bolt_sphere.height = 0.032
		bolt_sphere.radial_segments = 16
		bolt_sphere.rings = 8
		bolt.mesh = bolt_sphere
		bolt.position = Vector3(dx, -0.03, 0.075)
		bolt.material_override = _joint_mat
		add_child(bolt)


## 爪头：缆夹 + 颈柱 + 环座（torus）+ 圆盘基座，全部曲面件。
func _build_head() -> void:
	var clamp_cyl := MeshInstance3D.new()
	var clamp_mesh := CylinderMesh.new()
	clamp_mesh.top_radius = 0.014
	clamp_mesh.bottom_radius = 0.014
	clamp_mesh.height = 0.05
	clamp_mesh.radial_segments = 16
	clamp_cyl.mesh = clamp_mesh
	clamp_cyl.material_override = _joint_mat
	_head.add_child(clamp_cyl)
	var neck := MeshInstance3D.new()
	var neck_mesh := CylinderMesh.new()
	neck_mesh.top_radius = 0.024
	neck_mesh.bottom_radius = 0.030
	neck_mesh.height = 0.07
	neck_mesh.radial_segments = 20
	neck.mesh = neck_mesh
	neck.position = Vector3(0.0, -0.055, 0.0)
	neck.material_override = _head_mat
	_tinted.append(neck)
	_head.add_child(neck)
	var collar := MeshInstance3D.new()
	var collar_torus := TorusMesh.new()
	collar_torus.inner_radius = 0.034
	collar_torus.outer_radius = 0.052
	collar.mesh = collar_torus
	collar.position = Vector3(0.0, -0.098, 0.0)
	collar.material_override = _head_mat
	_tinted.append(collar)
	_head.add_child(collar)
	var hub := MeshInstance3D.new()
	var hub_cyl := CylinderMesh.new()
	hub_cyl.top_radius = 0.042
	hub_cyl.bottom_radius = 0.042
	hub_cyl.height = 0.024
	hub_cyl.radial_segments = 24
	hub.mesh = hub_cyl
	hub.position = Vector3(0.0, -0.098, 0.0)
	hub.material_override = _chrome_mat
	_head.add_child(hub)


## 单条爪臂：上臂胶囊 → 肘关节球 → 锥形下指（跟爪色）→ 指尖胶垫（橡胶）。
## 剪刀爪下指压扁成刃（薄椭圆截面）；双爪上臂加粗。
func _build_arm(yaw: float, claw_id: StringName) -> void:
	var pivot := Node3D.new()
	pivot.rotation = Vector3(SPREAD_OPEN, yaw, 0.0)
	_head.add_child(pivot)
	_arm_pivots.append(pivot)
	var is_scissor := claw_id == &"scissor"
	var upper_radius := 0.020 if claw_id == &"twin" else 0.016
	var upper := MeshInstance3D.new()
	var upper_capsule := CapsuleMesh.new()
	upper_capsule.radius = upper_radius
	upper_capsule.height = UPPER_ARM_LEN + upper_radius * 2.0
	upper.mesh = upper_capsule
	upper.position = Vector3(0.0, -UPPER_ARM_LEN * 0.5, 0.0)
	upper.material_override = _head_mat
	_tinted.append(upper)
	pivot.add_child(upper)
	var elbow := MeshInstance3D.new()
	var elbow_sphere := SphereMesh.new()
	elbow_sphere.radius = upper_radius * 1.5
	elbow_sphere.height = upper_radius * 3.0
	elbow_sphere.radial_segments = 20
	elbow_sphere.rings = 10
	elbow.mesh = elbow_sphere
	elbow.position = Vector3(0.0, ELBOW_Y, 0.0)
	elbow.material_override = _joint_mat
	pivot.add_child(elbow)
	var finger := MeshInstance3D.new()
	if is_scissor:
		var blade := CapsuleMesh.new()
		blade.radius = 0.016
		blade.height = LOWER_FINGER_LEN + 0.032
		finger.mesh = blade
		finger.scale = Vector3(1.0, 1.0, 0.30)
	else:
		var cone := CylinderMesh.new()
		cone.top_radius = upper_radius * 0.85
		cone.bottom_radius = 0.005
		cone.height = LOWER_FINGER_LEN
		cone.radial_segments = 20
		finger.mesh = cone
	finger.position = Vector3(0.0, FINGER_Y, 0.0)
	finger.material_override = _head_mat
	_tinted.append(finger)
	pivot.add_child(finger)
	var tip := MeshInstance3D.new()
	var tip_ball := SphereMesh.new()
	tip_ball.radius = 0.009
	tip_ball.height = 0.018
	tip_ball.radial_segments = 14
	tip_ball.rings = 7
	tip.mesh = tip_ball
	tip.position = Vector3(0.0, TIP_Y, 0.0)
	tip.material_override = _tip_mat
	pivot.add_child(tip)


func _metal(color: Color, rough: float) -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.metallic = 1.0
	mat.roughness = rough
	return mat


func _rubber(color: Color) -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.metallic = 0.0
	mat.roughness = 0.88
	mat.metallic_specular = 0.3
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
		# 爪色只写共享材质的 albedo（_tinted 网格全部引用它），不再逐网格重设 override ——
		# 关节/指尖的独立材质由此不再被误覆盖。
		_head_mat.albedo_color = color
		_tip_mat.albedo_color = color.darkened(0.55)
