class_name TouchSwipe
extends Control
## 触屏手势 → InputMap 动作生产者（SKILL §3A：触摸控件只生产动作，游戏逻辑零改动）：
## 点按 / 上滑 = jump；下滑 = slide。桌面无触摸事件时完全不触发。
## 用 _unhandled_input 跟踪触点（手指滑出控件后事件仍到达，_gui_input 会丢拖动轨迹）。
##
## 释放必须延迟一帧：同帧注入 press+release 会让 is_action_just_pressed 丢边沿
## （error-signatures E-08 同源问题 —— 动作按下状态须跨过一次刷新）。

## 判定滑动的最小位移（px）。
const SWIPE_THRESHOLD_PX: float = 36.0

## 正在跟踪的触点：index → 起点。
var _active_touches: Dictionary = {}
## 已在本触点上发过 slide 的 index（一次触摸只滑铲一次，防连发）。
var _slide_fired: Dictionary = {}
## 待释放动作队列：{action, release_frame}。
var _pending_releases: Array[Dictionary] = []


func _process(_delta: float) -> void:
	var now: int = Engine.get_process_frames()
	for item: Dictionary in _pending_releases:
		if now > int(item["release_frame"]):
			_inject_raw(StringName(item["action"]), false)
			_pending_releases.erase(item)


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		var touch := event as InputEventScreenTouch
		if touch.pressed:
			_active_touches[touch.index] = touch.position
			_slide_fired.erase(touch.index)
		else:
			var start: Vector2 = _active_touches.get(touch.index, touch.position)
			_active_touches.erase(touch.index)
			var delta: Vector2 = touch.position - start
			if _slide_fired.has(touch.index):
				return
			if delta.y <= -SWIPE_THRESHOLD_PX or delta.length() < SWIPE_THRESHOLD_PX:
				_inject(&"jump")
	elif event is InputEventScreenDrag:
		var drag := event as InputEventScreenDrag
		if not _active_touches.has(drag.index):
			return
		var delta: Vector2 = drag.position - _active_touches[drag.index]
		if delta.y >= SWIPE_THRESHOLD_PX and not _slide_fired.has(drag.index):
			_slide_fired[drag.index] = true
			_inject(&"slide")


## 注入按下（下一 process 帧自动释放，保证 just_pressed 边沿可读）。
func _inject(action: StringName) -> void:
	_inject_raw(action, true)
	_pending_releases.append({
		"action": action,
		"release_frame": Engine.get_process_frames() + 1,
	})


func _inject_raw(action: StringName, pressed: bool) -> void:
	var event := InputEventAction.new()
	event.action = action
	event.pressed = pressed
	Input.parse_input_event(event)
