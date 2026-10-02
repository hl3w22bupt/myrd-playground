class_name PointerFollowZone
extends Control
## 指针跟随区：把「鼠标水平移动 / 触屏水平拖动」翻译成果篮的目标 x，经信号发布。
##
## 规范要点（见 SKILL.md「移动端触摸规范」）：
## - 本控件是输入的「生产者」，只发 follow_target_changed / follow_ended 信号；
##   游戏逻辑（player.gd）不监听 InputEventScreenTouch/Drag，避免造出第二套平行输入路径；
## - 用 _unhandled_input 而非 _gui_input：手指滑出控件矩形后仍要继续收拖动轨迹
##   （mouse_filter 设为 IGNORE，按钮等 GUI 交互不受影响）；
## - 触点优先于鼠标：手指按住期间忽略鼠标移动，避免搁置的鼠标位置抢控；
## - 单触点跟踪（touch_index）：第二根手指不抢控，孤儿释放（抬起无按下）不误清。

## 目标 x 变化（鼠标移动或触屏拖动，已换算成游戏区坐标）。
signal follow_target_changed(x: float)
## 跟随结束（触点抬起），主场景据此停止指针驱动、交还键盘/摇杆。
signal follow_ended

var _touch_index: int = -1


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		if event.pressed:
			# 整屏都是拖动区（按下不要求落在矩形内），但只认第一个空闲触点。
			if _touch_index == -1:
				_touch_index = event.index
				_emit_target(event.position)
		elif event.index == _touch_index:
			_release()
	elif event is InputEventScreenDrag and event.index == _touch_index:
		_emit_target(event.position)
	elif event is InputEventMouseMotion and _touch_index == -1:
		# 鼠标无需点击即可跟随；触屏跟随时让位给触点。
		_emit_target(event.position)


func _notification(what: int) -> void:
	# 场景树退出时只重置本地触点跟踪，不发信号 —— 拆除期订阅方可能已被释放。
	if what == NOTIFICATION_EXIT_TREE:
		_touch_index = -1


func _emit_target(viewport_pos: Vector2) -> void:
	var local := get_global_transform_with_canvas().affine_inverse() * viewport_pos
	follow_target_changed.emit(local.x)


func _release() -> void:
	_touch_index = -1
	follow_ended.emit()
