class_name TapAdvanceLayer
extends Control
## 点按推进层：覆盖游戏画面的透明控件，把「画面内点按」合成为 tap_advance 动作事件。
##
## 规范要点（见 SKILL.md「移动端触摸规范」架构不变式）：
## - 触摸控件是动作的「生产者」：点按 → InputEventAction(tap_advance) → 引擎输入管线，
##   游戏逻辑（main.gd 相位机）只认 InputMap 动作名；
## - 独立动作而非复用 confirm：choice 相位下「点空白」必须不结算（防误触选错），
##   main 据此区分「点按」与「键盘/触屏按钮的确认」；
## - mouse_filter=STOP 消费空白点按；选项按钮/摇杆/确认按钮的命中优先级更高
##   （更高 CanvasLayer 或更晚绘制的兄弟节点先命中），不会被本层拦截；
## - 移动端一次点按会同时产生 ScreenTouch 与合成 Mouse 事件（emulate_mouse_from_touch），
##   用 DEBOUNCE_MS 折叠成一次推进（80ms < 100ms 点按响应要求）。

const DEBOUNCE_MS: int = 80

var _last_tap_ms: int = -1000


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP


func _gui_input(event: InputEvent) -> void:
	var tapped: bool = false
	if event is InputEventScreenTouch and event.pressed:
		tapped = true
	elif event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and event.pressed:
		tapped = true
	if not tapped:
		return
	var now_ms: int = Time.get_ticks_msec()
	if now_ms - _last_tap_ms < DEBOUNCE_MS:
		return
	_last_tap_ms = now_ms
	accept_event()
	var ev := InputEventAction.new()
	ev.action = &"tap_advance"
	ev.pressed = true
	Input.parse_input_event(ev)
