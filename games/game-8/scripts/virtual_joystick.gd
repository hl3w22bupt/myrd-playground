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
## 判定区外扩（px）：手指落点允许比可见底盘再宽 40px（720 宽画布下 ≈ 22px 视口余量），
## 贴边操作与快速滑动不脱靶（v5 修复：原 136px 热区在移动视口仅 ≈74 CSS px，边缘 3px 即丢触点）。
const HIT_PADDING: float = 40.0

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


## ⚠️ v5 修复（线上 B 缺陷根因）：必须在 _input 而非 _unhandled_input 处理 ScreenTouch——
## Godot 4 的 Viewport 会在 GUI 阶段按位置把 ScreenTouch 消费掉（命中本节点这个 Control，
## 转成模拟鼠标事件进 _gui_input），走 _unhandled_input 的分支永远收不到「按下」事件，
## 摇杆从不接管触点 = 移动端移动全失效（headless 用 Input.actionPress 注入，覆盖不到此路径）。
## _input 在事件链最前端，先于 GUI；接管后 set_input_as_handled 阻止触摸再被当作鼠标点击。
func _input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		if event.pressed and _touch_index == -1:
			# 初始按下必须落在摇杆判定区（含外扩余量）内才接管该触点。
			if _hit_rect().has_point(_to_local(event.position)):
				_touch_index = event.index
				_accept_and_update(event.position)
		elif not event.pressed and event.index == _touch_index:
			_accept_and_update(event.position)
			_release()
	elif event is InputEventScreenDrag and event.index == _touch_index:
		_accept_and_update(event.position)


## 判定区 = 控件矩形向四周外扩 HIT_PADDING（局部坐标口径）。
func _hit_rect() -> Rect2:
	return Rect2(Vector2(-HIT_PADDING, -HIT_PADDING), size + Vector2(HIT_PADDING * 2.0, HIT_PADDING * 2.0))


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


## ⚠️ v5.5：必须用状态 API（action_press/action_release）而非 parse_input_event。
## 线上真机实锤（「只有下有效」）：每次更新连发 4 个 InputEventAction 事件时，
## web 端输入缓冲冲刷只让**最后一个**（恰是 move_down）存活——上/左/右全部丢失。
## 键盘不受影响（真实按键事件），headless 冒烟测不出（注入路径不同）。
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
	draw_circle(_center + _output * BASE_RADIUS, STICK_RADIUS, stick_color)
