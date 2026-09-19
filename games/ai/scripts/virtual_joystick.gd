class_name VirtualJoystick
extends Control
## 虚拟摇杆：把手指拖动向量分解为四个移动动作的模拟强度（0..1）注入引擎。
##
## 规范要点（见 SKILL.md「移动端触摸规范」）：
## - 触摸控件是动作的「生产者」：把强度写入 InputMap 动作状态（Input.action_press），
##   游戏逻辑（如 player.gd）仍然只用 Input.get_vector 读动作，二者互不感知；
## - 纯代码 _draw 绘制，不依赖图片素材，模板复制即用。
##
## ⚠️ 输入阶段选择（headless 探针实测，Godot 4.3）：触摸事件先过 Viewport 的 GUI 命中，
## 本工程 UI 层有全屏 STOP 的 TapLayer（点按推进层），若摇杆在 _unhandled_input 里等事件，
## 落在摇杆矩形内的触摸会被 GUI 命中体系（更高层的 STOP 控件 / TapLayer）提前消费，
## 摇杆永远收不到自己的触摸，且该触摸会漏成 tap_advance 误推进剧情。
## 因此在 _input 阶段接管（引擎里唯一保证先于 GUI 命中的阶段）：
## - 初始按下仍必须落在摇杆矩形内才接管该触点（touch_index 跟踪，第二根手指不抢控）；
## - 接管后即 set_input_as_handled：TapLayer/兜底分支不会再看到这次触摸（防误触推进）；
## - 拖动/抬起按 index 续跟，手指滑出控件矩形后依然生效（_input 全事件可达，不丢轨迹）；
## - 保留 mouse_filter=STOP：emulate_mouse_from_touch 合成的鼠标事件由本控件在 GUI 层吃掉，
##   不会漏成 TapLayer 的第二次推进。

const BASE_RADIUS: float = 56.0
const STICK_RADIUS: float = 26.0
## 摇杆偏离超过该比例视为有效输入（复用 InputMap 默认 deadzone 概念）。
const DEADZONE_RATIO: float = 0.25

## 可配置触控参数（默认值；Main 在 _ready 从 data/spec/touch.json 注入覆盖，
## 改 JSON 即调摇杆手感 —— 触控参数作为可配置内容管理，不散落代码魔数）。
var base_radius: float = BASE_RADIUS
var stick_radius: float = STICK_RADIUS
var deadzone_ratio: float = DEADZONE_RATIO

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
	custom_minimum_size = Vector2(base_radius, base_radius) * 2.0
	_center = size / 2.0
	queue_redraw()


## 拖拽期间逐物理帧重申非零方向强度：对冲其它 InputEventAction（tap_advance / confirm）
## 被 parse 时引擎对 API 强度状态的清场（见 _emit_action 注释）——
## 真机上拖拽中第二根手指点按画面，移动不会掉帧。
func _physics_process(_delta: float) -> void:
	if _touch_index != -1:
		_reassert_pressed_actions()


func _reassert_pressed_actions() -> void:
	if _output.x < 0.0:
		Input.action_press(MOVE_ACTIONS.left, -_output.x)
	elif _output.x > 0.0:
		Input.action_press(MOVE_ACTIONS.right, _output.x)
	if _output.y < 0.0:
		Input.action_press(MOVE_ACTIONS.up, -_output.y)
	elif _output.y > 0.0:
		Input.action_press(MOVE_ACTIONS.down, _output.y)


## 摇杆不可见（桌面无触屏 / 非行动段相位）时不接管任何触摸 —— 桌面零回归的关键守卫。
func _input(event: InputEvent) -> void:
	if not is_visible_in_tree():
		return
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
	if length > base_radius:
		offset = offset.normalized() * base_radius
		length = base_radius
	var ratio: float = length / base_radius
	_output = offset / base_radius if ratio >= deadzone_ratio else Vector2.ZERO
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


## 把摇杆向量分解为 4 个方向动作的 strength 注入引擎；
## Input.get_vector 会读取 strength，游戏侧拿到的是模拟量方向。
##
## ⚠️ 注入通道选择（Godot 4.3 实测 + 源码核对 core/input/input.cpp）：
## 必须用 Input.action_press/action_release（API 路径，按动作独立的 api_pressed/api_strength），
## 不能用 Input.parse_input_event(InputEventAction)。后者在引擎里按「每动作一槽位」记状态：
## 任何 InputEventAction 被 parse 时都会在「所有动作」的槽位上写入自己的状态——同帧先后的
## 多个 InputEventAction（四方向同时非零 / 点按事件随后到达）会互相把对方清零，斜向拖拽
## 只剩最后一个轴有效（headless 探针实测复现）。API 路径按动作独立并入 cache，可四轴并行。
## 已知边界：其它 InputEventAction（tap_advance / confirm）被 parse 的那一帧会清掉 API 状态，
## 拖拽中的下一帧 drag 事件会立刻重新写入（真机连续拖拽下无感知）。
func _emit_action(action: StringName, strength: float) -> void:
	var clamped := clampf(strength, 0.0, 1.0)
	if clamped > 0.0:
		Input.action_press(action, clamped)
	else:
		Input.action_release(action)


func _draw() -> void:
	var base_color := Color(1.0, 1.0, 1.0, 0.15)
	var stick_color := Color(1.0, 1.0, 1.0, 0.45)
	draw_circle(_center, base_radius, base_color)
	draw_arc(_center, base_radius, 0.0, TAU, 48, Color(1.0, 1.0, 1.0, 0.35), 2.0)
	draw_circle(_center + _output * base_radius, stick_radius, stick_color)
