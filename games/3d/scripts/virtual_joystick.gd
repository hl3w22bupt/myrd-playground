class_name VirtualJoystick
extends Control
## 虚拟摇杆：把手指拖动向量合成为 InputEventAction（带 strength）注入引擎。
##
## 规范要点（见 SKILL.md「移动端触摸规范」）：
## - 触摸控件是动作的「生产者」，经 Input.parse_input_event 注入 InputMap 动作；
## - 游戏逻辑（如 player.gd）仍然只用 Input.get_vector 读动作，二者互不感知；
## - 纯代码 _draw 绘制，不依赖图片素材，模板复制即用。

const BASE_RADIUS: float = 56.0
const STICK_RADIUS: float = 26.0
## 摇杆偏离超过该比例视为有效输入（复用 InputMap 默认 deadzone 概念）。
const DEADZONE_RATIO: float = 0.25

## 移动动作名，与 project.godot [input] 注册保持一致。
const MOVE_ACTIONS := {
	"left": &"move_left",
	"right": &"move_right",
	"up": &"move_up",
	"down": &"move_down",
}

var _touch_index: int = -1
var _output: Vector2 = Vector2.ZERO

@onready var _center: Vector2 = size / 2.0


func _ready() -> void:
	custom_minimum_size = Vector2(BASE_RADIUS, BASE_RADIUS) * 2.0
	_center = size / 2.0
	queue_redraw()


## 用 _unhandled_input 而非 _gui_input：拖动事件在手指滑出控件矩形后仍需持续接收，
## _gui_input 只在指针位于控件内时投递，会丢拖动轨迹。
func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		if event.pressed and _touch_index == -1:
			# 初始按下必须落在摇杆区域内才接管该触点。
			if Rect2(Vector2.ZERO, size).has_point(_to_local(event.position)):
				_touch_index = event.index
				_accept_and_update(event.position)
		elif not event.pressed and event.index == _touch_index:
			_accept_and_update(event.position)
			_release()
	elif event is InputEventScreenDrag and event.index == _touch_index:
		_accept_and_update(event.position)


func _accept_and_update(viewport_pos: Vector2) -> void:
	get_viewport().set_input_as_handled()
	_update_output(_to_local(viewport_pos))


## 视口坐标 → 本控件局部坐标（控件位于 CanvasLayer 内，用 canvas 变换换算）。
func _to_local(viewport_pos: Vector2) -> Vector2:
	return get_global_transform_with_canvas().affine_inverse() * viewport_pos


func _notification(what: int) -> void:
	# 场景树退出时清空动作状态，避免残留 pressed 事件卡住移动。
	if what == NOTIFICATION_EXIT_TREE:
		_release()


func _update_output(touch_pos: Vector2) -> void:
	var offset: Vector2 = touch_pos - _center
	var length: float = offset.length()
	if length > BASE_RADIUS:
		offset = offset.normalized() * BASE_RADIUS
		length = BASE_RADIUS
	var ratio: float = length / BASE_RADIUS
	_output = offset / BASE_RADIUS if ratio >= DEADZONE_RATIO else Vector2.ZERO
	queue_redraw()
	_emit_move_actions()


func _release() -> void:
	_touch_index = -1
	_output = Vector2.ZERO
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
	var ev := InputEventAction.new()
	ev.action = action
	ev.pressed = strength > 0.0
	ev.strength = clampf(strength, 0.0, 1.0)
	Input.parse_input_event(ev)


func _draw() -> void:
	var base_color := Color(1.0, 1.0, 1.0, 0.15)
	var stick_color := Color(1.0, 1.0, 1.0, 0.45)
	draw_circle(_center, BASE_RADIUS, base_color)
	draw_arc(_center, BASE_RADIUS, 0.0, TAU, 48, Color(1.0, 1.0, 1.0, 0.35), 2.0)
	draw_circle(_center + _output * BASE_RADIUS, STICK_RADIUS, stick_color)
