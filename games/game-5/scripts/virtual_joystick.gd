class_name VirtualJoystick
extends Control
## 虚拟摇杆（触屏移动主输入，迭代反馈 1 的修复本体）。
##
## 旧实现的两个致断根因（知识 82e419bb §二，E-18/E-19 实测钉死）：
##   E-18 旧代码在 _unhandled_input 接管触摸 —— 本控件 mouse_filter=STOP，落在自身
##        矩形内的触摸在 GUI 命中阶段就被消费，永远到不了 _unhandled_input → 「推不动」；
##   E-19 旧代码把摇杆向量拆成 4 个 InputEventAction 注入 —— 同帧多个动作事件互踩清零，
##        斜向只剩一个轴。移动输入禁止走 InputEventAction 转发。
##
## 正确形态（知识 82e419bb §二.2）：
##   - 在 _input 阶段消费 InputEventScreenTouch / ScreenDrag（唯一保证先于 GUI 命中的阶段），
##     接管后 set_input_as_handled() 同时阻断 GUI 与 unhandled；
##   - 摇杆只维护归一化向量 vector（死区 + 模长 clamp 1），不做任何移动；
##   - Player 侧统一移动向量出口把 Input.get_vector(键盘) 与本 vector 汇合（单一出口）；
##   - 单指跟踪（第二根手指不抢控）+ is_visible_in_tree 守卫（隐藏的摇杆不抢触摸）；
##   - 保留 mouse_filter=STOP：拦住 emulate_mouse_from_touch 合成出的鼠标事件，
##     不漏给下层造成二次交互。

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
	# STOP：吃掉触摸合成的鼠标事件（知识 82e419bb §二.2 第 4 条），不漏成第二次交互。
	mouse_filter = Control.MOUSE_FILTER_STOP
	# Player 的统一移动向量出口经 "joystick" 组找到本节点（不与场景层级耦合）。
	add_to_group("joystick")
	queue_redraw()


func _input(event: InputEvent) -> void:
	if not is_visible_in_tree():
		return
	if event is InputEventScreenTouch:
		if event.pressed:
			# 初始按下必须落在摇杆矩形内才接管；第二根手指不抢控（单指跟踪）。
			if _touch_index == -1 and Rect2(Vector2.ZERO, size).has_point(_to_local(event.position)):
				_touch_index = event.index
				get_viewport().set_input_as_handled()
				_update_output(_to_local(event.position))
		elif event.index == _touch_index:
			get_viewport().set_input_as_handled()
			_release()
	elif event is InputEventScreenDrag and event.index == _touch_index:
		# 接管后滑出矩形照常续跟（拖拽不失联）。
		get_viewport().set_input_as_handled()
		_update_output(_to_local(event.position))


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


func _draw() -> void:
	var base_color := Color(1.0, 1.0, 1.0, 0.15)
	var stick_color := Color(1.0, 1.0, 1.0, 0.45)
	draw_circle(_center, BASE_RADIUS, base_color)
	draw_arc(_center, BASE_RADIUS, 0.0, TAU, 48, Color(1.0, 1.0, 1.0, 0.35), 2.0)
	draw_circle(_center + vector * (BASE_RADIUS - STICK_RADIUS), STICK_RADIUS, stick_color)
