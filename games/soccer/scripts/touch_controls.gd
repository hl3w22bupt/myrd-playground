class_name TouchControls
extends CanvasLayer
## 触摸操作层（v2 迭代）：左侧虚拟摇杆（八方向 + 幅度调速）+ 右侧射门/传球/切换按钮。
##
## 架构不变式（SKILL.md §3A）：本层是 InputMap 动作的「生产者」——
##   - 摇杆：把手指向量分解为 move_left/right/up/down 四动作的 strength，
##     经 Input.action_press(action, strength) 注入，Footballer 的 Input.get_vector 零改动；
##   - 按钮：注入 InputEventAction（Input.parse_input_event），与键盘走同一条
##     Main._unhandled_input 路径 —— 游戏逻辑层不知道触摸的存在；
##   - 多点触控：摇杆与按钮各自跟踪触点 index，双指同时按压互不干扰；
##   - 可见性：只由 DisplayServer.is_touchscreen_available()（或显式 force_visible）决定，
##     桌面键盘环境整层隐藏、零干扰。
##
## 子控件（全屏绘制 Control）在 _ready() 用代码构建：绘制型 UI 无外部资源引用，
## 不进 .tscn（遵守「场景文件最小手写」的工程纪律）。

## 摇杆当前输出向量（各分量 -1..1，长度 ≤ 1；零向量 = 未触摸）。
var joystick_vector: Vector2 = Vector2.ZERO
## 显式强制显示（触屏可用性之上；冒烟测试与「设置里手动开启」用）。
var force_visible: bool = false

## 摇杆几何（画布 1280x720 坐标系；canvas_items 拉伸下各分辨率等比映射）。
const JOY_CENTER: Vector2 = Vector2(150.0, 566.0)
const JOY_BASE_RADIUS: float = 88.0
const JOY_KNOB_RADIUS: float = 36.0
## 按钮 → 中心/半径（射门最大最靠顺手位）。
const BUTTON_LAYOUT: Dictionary = {
	&"shoot": { "center": Vector2(1150.0, 566.0), "radius": 60.0 },
	&"pass": { "center": Vector2(1014.0, 620.0), "radius": 46.0 },
	&"switch_player": { "center": Vector2(1014.0, 478.0), "radius": 46.0 },
}
## 摇杆可接管的按下区域半径（略大于基座，手感容差）。
const JOY_GRAB_RADIUS: float = JOY_BASE_RADIUS * 1.35
const MOVE_ACTIONS: Array[StringName] = [&"move_left", &"move_right", &"move_up", &"move_down"]

var _joy_index: int = -1
var _joy_touch_pos: Vector2 = Vector2.ZERO
## 触点 index → 动作名（多点触控：不同手指可各按一个按钮）。
var _button_indices: Dictionary = {}
var _canvas: Control


func _ready() -> void:
	layer = 10
	_canvas = Control.new()
	_canvas.name = "TouchCanvas"
	_canvas.set_anchors_preset(Control.PRESET_FULL_RECT)
	_canvas.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_canvas.draw.connect(_on_canvas_draw)
	add_child(_canvas)
	update_visibility()


func update_visibility() -> void:
	visible = force_visible or DisplayServer.is_touchscreen_available()


func _exit_tree() -> void:
	_release_joystick()
	for index in _button_indices.keys():
		_release_action(_button_indices[index])
	_button_indices.clear()


## ---- 输入处理（只认 InputEventScreenTouch / InputEventScreenDrag） ----

func _unhandled_input(event: InputEvent) -> void:
	if not visible:
		return
	var touch := event as InputEventScreenTouch
	if touch != null:
		if touch.pressed:
			_handle_touch_press(touch.index, touch.position)
		else:
			_handle_touch_release(touch.index)
		return
	var drag := event as InputEventScreenDrag
	if drag != null and drag.index == _joy_index:
		_set_joystick_from(drag.position)


func _handle_touch_press(index: int, pos: Vector2) -> void:
	# 摇杆：仅第一根落在基座区域内的手指接管（第二根手指不抢控）。
	if _joy_index == -1 and pos.distance_to(JOY_CENTER) <= JOY_GRAB_RADIUS:
		_joy_index = index
		_joy_touch_pos = pos
		_set_joystick_from(pos)
		return
	# 按钮：落在某按钮圆内且该按钮未被其它手指按住。
	for action: StringName in BUTTON_LAYOUT:
		if _button_indices.values().has(action):
			continue
		if pos.distance_to(button_center(action)) <= button_radius(action):
			_button_indices[index] = action
			_press_action(action)
			return


func _handle_touch_release(index: int) -> void:
	if index == _joy_index:
		_release_joystick()
	if _button_indices.has(index):
		_release_action(_button_indices[index])
		_button_indices.erase(index)
	_redraw()


## ---- 摇杆 → 移动动作的 strength 分解 ----

func _set_joystick_from(pos: Vector2) -> void:
	_joy_touch_pos = pos
	var offset := pos - JOY_CENTER
	if offset.length() > JOY_BASE_RADIUS:
		offset = offset.normalized() * JOY_BASE_RADIUS
	joystick_vector = offset / JOY_BASE_RADIUS
	_apply_joystick_actions()


## 每物理帧重申 strength：Input.parse_input_event 的缓冲冲刷会清掉
## action_press 状态（error-signatures E-08），手指停住不动时也要保持输出。
func _physics_process(_delta: float) -> void:
	if _joy_index != -1:
		_apply_joystick_actions()


func _apply_joystick_actions() -> void:
	_set_move_strength(&"move_right", maxf(0.0, joystick_vector.x))
	_set_move_strength(&"move_left", maxf(0.0, -joystick_vector.x))
	_set_move_strength(&"move_down", maxf(0.0, joystick_vector.y))
	_set_move_strength(&"move_up", maxf(0.0, -joystick_vector.y))


func _set_move_strength(action: StringName, strength: float) -> void:
	if strength > 0.0:
		Input.action_press(action, strength)
	else:
		Input.action_release(action)


func _release_joystick() -> void:
	_joy_index = -1
	_joy_touch_pos = Vector2.ZERO
	joystick_vector = Vector2.ZERO
	for action in MOVE_ACTIONS:
		Input.action_release(action)


## ---- 按钮 → 离散动作事件（与键盘同一条 _unhandled_input 路径） ----

func _press_action(action: StringName) -> void:
	var event := InputEventAction.new()
	event.action = action
	event.pressed = true
	Input.parse_input_event(event)
	_redraw()


func _release_action(action: StringName) -> void:
	var event := InputEventAction.new()
	event.action = action
	event.pressed = false
	Input.parse_input_event(event)
	_redraw()


## 重绘触摸层（queue_redraw 在子控件上，CanvasLayer 自身不可绘制）。
func _redraw() -> void:
	if _canvas != null:
		_canvas.queue_redraw()


## ---- 查询（冒烟断言 / 调试用） ----

func button_center(action: StringName) -> Vector2:
	return BUTTON_LAYOUT[action]["center"]


func button_radius(action: StringName) -> float:
	return BUTTON_LAYOUT[action]["radius"]


func is_action_held(action: StringName) -> bool:
	return _button_indices.values().has(action)


## ---- 绘制 ----

func _on_canvas_draw() -> void:
	var font: Font = _canvas.get_theme_default_font()
	var font_size: int = _canvas.get_theme_default_font_size()
	# 摇杆：基座 + 指示环 + 玩法侧。
	_canvas.draw_circle(JOY_CENTER, JOY_BASE_RADIUS, Color(1.0, 1.0, 1.0, 0.10))
	_canvas.draw_arc(JOY_CENTER, JOY_BASE_RADIUS, 0.0, TAU, 48, Color(1, 1, 1, 0.45), 2.5)
	_canvas.draw_arc(JOY_CENTER, JOY_BASE_RADIUS * 0.5, 0.0, TAU, 40, Color(1, 1, 1, 0.16), 1.5)
	var knob: Vector2 = JOY_CENTER + joystick_vector * JOY_BASE_RADIUS
	var knob_color: Color = Color(0.95, 0.95, 0.98, 0.85) if _joy_index != -1 \
		else Color(0.95, 0.95, 0.98, 0.55)
	_canvas.draw_circle(knob, JOY_KNOB_RADIUS, knob_color)
	# 动作按钮：按住加亮。
	for action: StringName in BUTTON_LAYOUT:
		var center: Vector2 = button_center(action)
		var radius: float = button_radius(action)
		var held := is_action_held(action)
		var fill := Color(0.98, 0.35, 0.30, 0.62) if held else Color(0.98, 0.35, 0.30, 0.34)
		if action == &"switch_player":
			fill = Color(0.30, 0.62, 0.98, 0.62) if held else Color(0.30, 0.62, 0.98, 0.34)
		elif action == &"pass":
			fill = Color(0.30, 0.85, 0.45, 0.62) if held else Color(0.30, 0.85, 0.45, 0.34)
		_canvas.draw_circle(center, radius, fill)
		_canvas.draw_arc(center, radius, 0.0, TAU, 48, Color(1, 1, 1, 0.55), 2.0)
		if font != null:
			var label := _button_label(action)
			var width := font.get_string_size(label, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x
			_canvas.draw_string(font, center + Vector2(-width * 0.5, font_size * 0.36),
				label, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, Color(1, 1, 1, 0.92))


func _button_label(action: StringName) -> String:
	match action:
		&"shoot":
			return "射门"
		&"pass":
			return "传球"
		&"switch_player":
			return "切换"
	return String(action)
