class_name VirtualJoystick
extends Control
## 虚拟摇杆：在 `_input` 阶段接管触点，把拖动向量经 Input.action_press 注入引擎动作。
##
## 迭代修复（红队 bug：移动端方向键全失灵，知识 82e419bb §2.1 E-18）：
## 旧实现挂在 `_unhandled_input` —— 触摸事件分发顺序固定为 `_input → GUI 命中 → _unhandled`，
## 本控件 mouse_filter=STOP 时，落在自身矩形内的触摸会在 GUI 命中阶段被消费，
## 永远到不了 `_unhandled_input` → 真机上摇杆整体推不动（headless 门禁全绿、真机必挂型缺陷）。
## 修复后规范（知识 82e419bb §2.2）：
## - `_input` 是引擎里唯一保证先于 GUI 命中的阶段，触摸在这里接管；
## - 初始按下必须落在摇杆矩形内才接管；接管后滑出矩形照常续跟（拖拽不失联）；
## - `is_visible_in_tree()` 守卫：隐藏的摇杆（桌面端 TouchUI 不可见）不得抢按任何触摸；
## - `set_input_as_handled()` 同时阻断后续 GUI 与 unhandled 消费，防二次交互；
## - 保留 `mouse_filter=STOP`：让 emulate_mouse_from_touch 合成出的鼠标事件在 GUI 层
##   被摇杆吃掉，不漏成第二次交互（与 _input 接管互补，不冲突）；
## - 单指跟踪：第二根手指不抢控（touch_index 单值）。
##
## 输出路线（E-17 硬约束，保留）：Input.action_press/action_release —— 不能经
## parse_input_event 注入 InputEventAction（同帧多动作互踩清零，斜向结构性失效）。

const BASE_RADIUS: float = 56.0
const STICK_RADIUS: float = 26.0
## 摇杆死区（知识 82e419bb §二.2 建议 0.15~0.25）：死区内视为无输入，防手抖漂移。
const DEADZONE_RATIO: float = 0.2

## 触点相对基座中心的归一化向量（y 向下为正，与 Input.get_vector 口径一致）。
## 键盘照常独立工作；Player 侧 (键盘 + 摇杆).limit_length(1.0) 汇合，非零者生效。
var vector: Vector2 = Vector2.ZERO

var _touch_index: int = -1

@onready var _center: Vector2 = size / 2.0


func _ready() -> void:
	custom_minimum_size = Vector2(BASE_RADIUS, BASE_RADIUS) * 2.0
	_center = size / 2.0
	# 保留 STOP（见文件头第 5 条）：合成鼠标事件在 GUI 层被本控件吃掉。
	mouse_filter = Control.MOUSE_FILTER_STOP
	queue_redraw()


## `_input` 阶段处理触摸：先于 GUI 命中，摇杆才有机会接管落在自己矩形内的触点。
func _input(event: InputEvent) -> void:
	if not is_visible_in_tree():
		return
	if event is InputEventScreenTouch:
		if event.pressed:
			# 初始按下必须落在摇杆区域内才接管该触点；单指跟踪，第二根手指不抢控。
			if _touch_index == -1 and Rect2(Vector2.ZERO, size).has_point(_to_local(event.position)):
				_touch_index = event.index
				_accept_and_update(event.position)
		elif event.index == _touch_index:
			_accept_and_update(event.position)
			_release()
	elif event is InputEventScreenDrag and event.index == _touch_index:
		_accept_and_update(event.position)


func _accept_and_update(viewport_pos: Vector2) -> void:
	# 接管后阻断 GUI 与 unhandled 的后续消费（合成鼠标的第二次交互由此防住）。
	get_viewport().set_input_as_handled()
	_update_output(_to_local(viewport_pos))


## 视口坐标 → 本控件局部坐标（控件位于 CanvasLayer 内，用 canvas 变换换算）。
func _to_local(viewport_pos: Vector2) -> Vector2:
	return get_global_transform_with_canvas().affine_inverse() * viewport_pos


func _notification(what: int) -> void:
	# 场景树退出时清零向量，避免残留输入卡住移动。
	if what == NOTIFICATION_EXIT_TREE:
		_release()


func _update_output(touch_pos: Vector2) -> void:
	var offset: Vector2 = touch_pos - _center
	var length: float = offset.length()
	if length > BASE_RADIUS:
		offset = offset.normalized() * BASE_RADIUS
		length = BASE_RADIUS
	var ratio: float = length / BASE_RADIUS
	# 死区外输出归一化向量（模长 ≤ 1）；死区内归零。y 向下为正，交 Player 统一消费。
	vector = offset / BASE_RADIUS if ratio >= DEADZONE_RATIO else Vector2.ZERO
	queue_redraw()


func _release() -> void:
	_touch_index = -1
	vector = Vector2.ZERO
	queue_redraw()
	_emit_move_actions()


## 把摇杆向量分解为 4 个方向动作的 strength 注入引擎；
## Input.get_vector 会读取 strength，游戏侧拿到的是模拟量方向。
func _emit_move_actions() -> void:
	_emit_action(MOVE_ACTIONS.left, -_output.x if _output.x < 0.0 else 0.0)
	_emit_action(MOVE_ACTIONS.right, _output.x if _output.x > 0.0 else 0.0)
	_emit_action(MOVE_ACTIONS.up, -_output.y if _output.y < 0.0 else 0.0)
	_emit_action(MOVE_ACTIONS.down, _output.y if _output.y > 0.0 else 0.0)


func _emit_action(action: StringName, strength: float) -> void:
	if strength > 0.0:
		Input.action_press(action, clampf(strength, 0.0, 1.0))
	else:
		Input.action_release(action)


func _draw() -> void:
	var base_color := Color(1.0, 1.0, 1.0, 0.15)
	var stick_color := Color(1.0, 1.0, 1.0, 0.45)
	draw_circle(_center, BASE_RADIUS, base_color)
	draw_arc(_center, BASE_RADIUS, 0.0, TAU, 48, Color(1.0, 1.0, 1.0, 0.35), 2.0)
	draw_circle(_center + vector * (BASE_RADIUS - STICK_RADIUS), STICK_RADIUS, stick_color)
