class_name TouchSwipe
extends Control
## 触屏滑动 → 单步移动（spec.numeric.input.touchSwipeThresholdPx = 24）。
##
## 规范要点（godot-game-dev SKILL.md「移动端触摸规范」）：
## - 触摸控件是动作的「生产者」：滑动越过阈值后，把主轴方向注成 InputMap 动作，
##   游戏逻辑（player.gd）仍然只用 Input.get_vector 读动作，二者互不感知；
## - 一次手势只触发一步：动作 press 保持 HOLD_FRAMES 帧（≈33ms）后释放，
##   远短于长按重复间隔 KEY_REPEAT_INTERVAL_MS（150ms），所以恰好步进 1 格；
## - 本控件挂在 TouchUI 的最前（子节点顺序最前）：_unhandled_input 按树序的
##   逆序投递，摇杆 / 动作按钮先收到事件，它们 set_input_as_handled 之后
##   滑动层不会再看到这个触点 —— 摇杆与滑动互不抢控。

## spec.numeric.input.touchSwipeThresholdPx：滑动越过该距离才算一次有效滑动。
const SWIPE_THRESHOLD_PX: float = 24.0
## 动作 press 保持帧数：60FPS 下 ≈33ms < 150ms 长按重复间隔 ⇒ 恰好 1 步。
const HOLD_FRAMES: int = 2

## 移动动作名，与 project.godot [input] 注册保持一致。
const MOVE_ACTIONS := {
	"left": &"move_left",
	"right": &"move_right",
	"up": &"move_up",
	"down": &"move_down",
}

var _touch_index: int = -1
var _start_position: Vector2 = Vector2.ZERO
var _fired: bool = false
var _active_action: StringName = &""
var _release_countdown: int = 0
## 所属 CanvasLayer（TouchUI）：可见性守卫必须看层开关，Control 自己的
## is_visible_in_tree() 不感知 CanvasLayer.visible（层隐藏时它仍可能返回 true）。
var _layer: CanvasLayer


func _ready() -> void:
	mouse_filter = MOUSE_FILTER_IGNORE  # 全屏热区不得挡住其它 GUI 事件
	var node: Node = self
	while node != null and _layer == null:
		_layer = node as CanvasLayer
		node = node.get_parent()
	set_process(false)


func _process(_delta: float) -> void:
	if _active_action == &"":
		set_process(false)
		return
	_release_countdown -= 1
	if _release_countdown <= 0:
		Input.action_release(_active_action)
		_active_action = &""


func _unhandled_input(event: InputEvent) -> void:
	if _layer != null and not _layer.visible:
		return  # 桌面键盘环境下触摸层整体隐藏，滑动不参与输入
	if not is_visible_in_tree():
		return
	if event is InputEventScreenTouch:
		if event.pressed and _touch_index == -1:
			_touch_index = event.index
			_start_position = event.position
			_fired = false
		elif not event.pressed and event.index == _touch_index:
			_touch_index = -1
			if not _fired:
				_try_fire(event.position - _start_position)  # 快速轻扫：抬手时补判一次
	elif event is InputEventScreenDrag and event.index == _touch_index and not _fired:
		_try_fire(event.position - _start_position)  # 越过阈值立即触发，响应更跟手


## 位移向量越过阈值 → 取主轴方向注入一步（推箱子不允许斜走）。
func _try_fire(delta: Vector2) -> void:
	if delta.length() < SWIPE_THRESHOLD_PX:
		return
	_fired = true
	var action: StringName
	if absf(delta.x) > absf(delta.y):
		action = MOVE_ACTIONS.right if delta.x > 0.0 else MOVE_ACTIONS.left
	else:
		action = MOVE_ACTIONS.down if delta.y > 0.0 else MOVE_ACTIONS.up
	_active_action = action
	_release_countdown = HOLD_FRAMES
	Input.action_press(action)
	set_process(true)
	get_viewport().set_input_as_handled()


## 场景树退出时释放残留动作，避免按住状态卡住移动。
func _exit_tree() -> void:
	if _active_action != &"":
		Input.action_release(_active_action)
		_active_action = &""
