class_name Blade
extends Node3D
## 玩家可控刀锋：滑动切割的交互核心（3D 版「玩家角色」）。
##
## 规范要点（见 SKILL.md「GDScript 规范」「移动端触摸规范」）：
## - class_name 唯一，且与文件名一致的职责（blade.gd → class_name Blade）；
## - 输入只读 InputMap 动作名（project.godot [input] 已注册），禁止硬编码 keycode；
##   触摸/鼠标是「原生轨迹」输入（屏幕坐标 → 相机射线 → 切割平面交点），与动作并存；
## - 对外只发信号（moved / slashed），不直接操作 UI 节点（UI 在 Main 场景里订阅）；
## - 切割判定：刀痕线段与水果 Area3D 碰撞体求交（物理空间查询），一刀可贯穿多个苹果。
##
## 位置模型：_cursor_pos 是刀锋的唯一权威位置 ——
##   指针（鼠标左键拖动 / 触屏手指拖动）= 绝对设定；键盘/摇杆（move_* 动作）= 帧增量累积。
## 三路输入都汇成同一件事——「刀锋移动 + 刀刃生效（hot）」：
##   指针按住拖动：轨迹段即刀痕；
##   键盘/摇杆：移动即挥砍（虚拟摇杆注入的也是这些动作）；
##   confirm：原地挥砍一记（短脉冲），点按补刀与冒烟驱动共用。

## 切割平面内的活动范围（与世界/相机视野对齐，见 scenes/main.tscn 的 Camera3D）。
const PLAY_HALF_WIDTH: float = 2.9
const PLAY_Y_MIN: float = -5.4
const PLAY_Y_MAX: float = 5.0
## 判定「真的移动了」的最小位移（世界单位）。
const MOVE_EPSILON: float = 0.02
## confirm 原地挥砍脉冲的持续时间（秒）。
const SWING_PULSE_SEC: float = 0.18
## 刀痕判定盒的横截面厚度（世界单位）——覆盖相邻两枚苹果与轻微 z 抖动。
## 取值偏宽容：滑动切割的手感底线是「指哪切哪」，判定过窄会让滑动变成挫败。
const CUT_THICKNESS: float = 1.1
## 挥砍风声的最小间隔（秒）：一次连续挥砍只报一声，不刷屏。
const SWOOSH_MIN_INTERVAL: float = 0.35
## 刀痕拖尾点数。
const TRAIL_POINTS: int = 14

signal moved(position: Vector3)
signal slashed

var _pointer_hot: bool = false
var _cursor_pos: Vector3 = Vector3.ZERO
var _pulse_until: float = -1.0
var _last_pos: Vector3 = Vector3.ZERO
var _was_cutting: bool = false
var _last_swoosh_at: float = -1.0
var _trail := PackedVector3Array()

@onready var _cursor: MeshInstance3D = $Cursor
@onready var _trail_mesh: MeshInstance3D = $Trail


func _ready() -> void:
	_cursor_pos = position
	_last_pos = position
	_trail_mesh.mesh = ImmediateMesh.new()
	var glow := StandardMaterial3D.new()
	glow.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	glow.albedo_color = Color(0.55, 0.95, 1.0, 0.9)
	_trail_mesh.material_override = glow


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		var touch := event as InputEventScreenTouch
		if touch.pressed:
			_pointer_hot = true
			_apply_screen_pos(touch.position)
		else:
			_pointer_hot = false
	elif event is InputEventScreenDrag:
		var drag := event as InputEventScreenDrag
		_apply_screen_pos(drag.position)
	elif event is InputEventMouseButton:
		var mb := event as InputEventMouseButton
		if mb.button_index != MOUSE_BUTTON_LEFT:
			return
		if mb.pressed:
			_pointer_hot = true
			_apply_screen_pos(mb.position)
		else:
			_pointer_hot = false
	elif event is InputEventMouseMotion:
		var mm := event as InputEventMouseMotion
		if _pointer_hot or Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT):
			_apply_screen_pos(mm.position)
	elif event.is_action_pressed(&"confirm"):
		_pulse_until = _now_sec() + SWING_PULSE_SEC
		slashed.emit()


func _physics_process(delta: float) -> void:
	var from := _last_pos
	var key_dir := Input.get_vector(&"move_left", &"move_right", &"move_up", &"move_down")
	if key_dir != Vector2.ZERO:
		var speed: float = GameState.blade_speed
		_cursor_pos += Vector3(key_dir.x, key_dir.y, 0.0) * speed * delta
	var to := _clamp_to_play(_cursor_pos)
	var seg := to - from
	var hot := _pointer_hot or key_dir != Vector2.ZERO or _now_sec() < _pulse_until
	var cutting := hot and seg.length() > MOVE_EPSILON
	if cutting:
		_cut_along(from, to)
	elif hot and _now_sec() < _pulse_until:
		# 原地挥砍脉冲（confirm）：刀锋不动也以刀锋为圆心切一记。
		_cut_at_point(to)
	# 挥砍风声：切入「刀刃生效」状态的沿上发一声（限频）——滑动切割的核心操作反馈。
	if cutting and not _was_cutting and _now_sec() - _last_swoosh_at >= SWOOSH_MIN_INTERVAL:
		Juice.sfx(&"swoosh")
		_last_swoosh_at = _now_sec()
	_was_cutting = cutting
	position = to
	_last_pos = to
	_update_cursor_hot(hot)
	if moved_by_keys(key_dir) or seg.length() > MOVE_EPSILON:
		moved.emit(to)
		_push_trail(to)


func moved_by_keys(key_dir: Vector2) -> bool:
	return key_dir != Vector2.ZERO


## 把刀锋重置到指定位置（开局/重开用）：权威光标位、上一帧位、节点位置三者同步，
## 只改 position 会被 _physics_process 的 _cursor_pos 覆盖回去。
func reset_to(pos: Vector3) -> void:
	_cursor_pos = pos
	_last_pos = pos
	position = pos
	_pointer_hot = false
	_pulse_until = -1.0
	_trail.clear()


## 屏幕坐标 → 切割平面（z=0）交点：相机射线求交，桌面鼠标与触屏拖动共用。
func _apply_screen_pos(screen_pos: Vector2) -> void:
	var camera := get_viewport().get_camera_3d()
	if camera == null:
		return
	var origin := camera.project_ray_origin(screen_pos)
	var normal := camera.project_ray_normal(screen_pos)
	var plane := Plane(Vector3(0, 0, 1), 0.0)
	var hit: Variant = plane.intersects_ray(origin, normal)
	if hit != null:
		_cursor_pos = hit


func _clamp_to_play(pos: Vector3) -> Vector3:
	return Vector3(
		clampf(pos.x, -PLAY_HALF_WIDTH, PLAY_HALF_WIDTH),
		clampf(pos.y, PLAY_Y_MIN, PLAY_Y_MAX),
		clampf(pos.z, -0.2, 0.2)
	)


## 刀痕线段与水果碰撞体求交：命中即 slice（一刀可贯穿多个苹果 → 连击判定在 GameState）。
func _cut_along(from: Vector3, to: Vector3) -> void:
	var seg := to - from
	var length := seg.length()
	if length < MOVE_EPSILON:
		return
	var dir := seg / length
	var space := get_world_3d().direct_space_state
	if space == null:
		return
	var box := BoxShape3D.new()
	box.size = Vector3(length, CUT_THICKNESS, CUT_THICKNESS)
	var params := PhysicsShapeQueryParameters3D.new()
	params.shape = box
	params.transform = Transform3D(_segment_basis(dir), (from + to) * 0.5)
	params.collide_with_areas = true
	params.collide_with_bodies = false
	params.collision_mask = 1
	var hits := space.intersect_shape(params, 32)
	for hit in hits:
		var collider: Object = hit["collider"]
		if collider is Fruit:
			(collider as Fruit).slice(dir)


## 原地挥砍：以刀锋为圆心的球形切割查询（覆盖相邻/重叠的多个抛出物）。
func _cut_at_point(point: Vector3) -> void:
	var space := get_world_3d().direct_space_state
	if space == null:
		return
	var sphere := SphereShape3D.new()
	sphere.radius = CUT_THICKNESS * 0.5
	var params := PhysicsShapeQueryParameters3D.new()
	params.shape = sphere
	params.transform = Transform3D(Basis.IDENTITY, point)
	params.collide_with_areas = true
	params.collide_with_bodies = false
	params.collision_mask = 1
	var hits := space.intersect_shape(params, 32)
	for hit in hits:
		var collider: Object = hit["collider"]
		if collider is Fruit:
			(collider as Fruit).slice(Vector3(1, 0, 0))


## 线段方向的正交基（刀痕全在 z≈0 平面内，手工构造避免 looking_at 的平行上向量退化）。
func _segment_basis(dir: Vector3) -> Basis:
	var x_axis := dir.normalized()
	var y_axis := Vector3(0, 0, 1).cross(x_axis).normalized()
	var z_axis := x_axis.cross(y_axis).normalized()
	return Basis(x_axis, y_axis, z_axis)


func _update_cursor_hot(hot: bool) -> void:
	var material := _cursor.material_override as StandardMaterial3D
	if material == null:
		return
	material.albedo_color = Color(1.0, 0.9, 0.3, 1.0) if hot else Color(0.55, 0.95, 1.0, 0.9)


func _push_trail(point: Vector3) -> void:
	_trail.append(point)
	while _trail.size() > TRAIL_POINTS:
		_trail.remove_at(0)
	var mesh := _trail_mesh.mesh as ImmediateMesh
	if mesh == null:
		return
	mesh.clear_surfaces()
	if _trail.size() < 2:
		return
	mesh.surface_begin(Mesh.PRIMITIVE_LINE_STRIP)
	for trail_point in _trail:
		mesh.surface_add_vertex(trail_point)
	mesh.surface_end()


func _now_sec() -> float:
	return float(Time.get_ticks_msec()) / 1000.0
