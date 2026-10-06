class_name CameraRig
extends Node3D
## 观察视角（3D）：有限的环绕旋转 + 缩放（验收 3：支持有限的视角旋转/缩放）。
##
## 规范要点：
## - 摇杆触点由 TouchUI 接管（set_input_as_handled），这里用 is_input_handled() 守卫，
##   玩爪子的手指永远不会转到镜头；屏幕其余区域拖动 = 环绕，双指 = 缩放（含滚轮）；
## - 旋转/缩放全部限位（环绕角/俯仰角/距离），不会转到柜体背面或穿进玻璃；
## - orbit()/zoom_by() 是纯逻辑入口，headless 冒烟可直接调用断言限位。

const PIVOT: Vector3 = Vector3(0.0, 0.62, 0.08)
## 限位：偏航 ±0.42 rad，俯仰 0.32~0.92 rad，距离 1.7~3.1 m。
const YAW_LIMIT: float = 0.42
const PITCH_MIN: float = 0.32
const PITCH_MAX: float = 0.92
const DIST_MIN: float = 1.7
const DIST_MAX: float = 3.1
## 拖动灵敏度（弧度/像素）与滚轮步长（米）。
const ORBIT_SENS: float = 0.005
const WHEEL_STEP: float = 0.22

var yaw: float = 0.0
var pitch: float = 0.62
var distance: float = 2.45

var _camera: Camera3D
var _touches: Dictionary = {}
var _mouse_dragging: bool = false


func _ready() -> void:
	_camera = Camera3D.new()
	_camera.fov = 52.0
	_camera.near = 0.05
	_camera.far = 40.0
	_camera.current = true
	add_child(_camera)
	_apply_transform()


func orbit(dx: float, dy: float) -> void:
	yaw = clampf(yaw - dx * ORBIT_SENS, -YAW_LIMIT, YAW_LIMIT)
	pitch = clampf(pitch + dy * ORBIT_SENS, PITCH_MIN, PITCH_MAX)
	_apply_transform()


func zoom_by(step: float) -> void:
	distance = clampf(distance + step, DIST_MIN, DIST_MAX)
	_apply_transform()


func camera() -> Camera3D:
	return _camera


func _apply_transform() -> void:
	if _camera == null:
		return
	var offset := Vector3(
		sin(yaw) * cos(pitch),
		sin(pitch),
		cos(yaw) * cos(pitch)
	) * distance
	_camera.position = PIVOT + offset
	_camera.look_at(PIVOT, Vector3.UP)


func _unhandled_input(event: InputEvent) -> void:
	if get_viewport().is_input_handled():
		return
	if event is InputEventScreenTouch:
		var touch := event as InputEventScreenTouch
		if touch.pressed:
			_touches[touch.index] = touch.position
		else:
			_touches.erase(touch.index)
	elif event is InputEventScreenDrag:
		var drag := event as InputEventScreenDrag
		if not _touches.has(drag.index):
			return
		_touches[drag.index] = drag.position
		if _touches.size() >= 2:
			# 双指：取当前两触点距离的变化量做缩放。
			var positions := _touches.values()
			var dist_now := (positions[0] as Vector2).distance_to(positions[1] as Vector2)
			var dist_prev := ((positions[0] as Vector2) - drag.relative).distance_to(((positions[1] as Vector2) - drag.relative))
			zoom_by((dist_prev - dist_now) * 0.004)
		else:
			orbit(drag.relative.x, drag.relative.y)
	elif event is InputEventMouseButton:
		var mb := event as InputEventMouseButton
		if mb.button_index == MOUSE_BUTTON_WHEEL_UP and mb.pressed:
			zoom_by(-WHEEL_STEP)
		elif mb.button_index == MOUSE_BUTTON_WHEEL_DOWN and mb.pressed:
			zoom_by(WHEEL_STEP)
		elif mb.button_index == MOUSE_BUTTON_LEFT:
			_mouse_dragging = mb.pressed
	elif event is InputEventMouseMotion and _mouse_dragging:
		var mm := event as InputEventMouseMotion
		orbit(mm.relative.x, mm.relative.y)


func _notification(what: int) -> void:
	if what == NOTIFICATION_EXIT_TREE:
		_touches.clear()
