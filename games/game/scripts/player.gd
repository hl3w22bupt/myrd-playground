class_name Player
extends Node2D
## 玩家可控光标：四方向移动（InputMap 动作）+ 选中/交换糖果（核心交互的输入端）。
##
## 规范要点（见 SKILL.md「GDScript 规范」）：
## - 输入只读 InputMap 动作名（project.godot [input] 已注册），禁止硬编码 keycode；
## - 对外只发信号，不直接操作 UI / 棋盘：交换请求交给 Main 转发给 Board 裁决；
## - 位置同步：光标是 Board 的子节点，cell_to_position 给出格子中心（本地坐标）。

## 光标所在格变化（网格坐标），Main/冒烟场景订阅。
signal cell_changed(cell: Vector2i)
## 进入选中状态（参数 = 被选中的格），用于高亮与冒烟断言。
signal selection_changed(selected_cell: Vector2i)
## 请求交换两格（已保证相邻且不是同一格），Board 负责判定能否三消。
signal swap_requested(from_cell: Vector2i, to_cell: Vector2i)

## 光标框：普通态白色、选中态金色（带呼吸脉冲）、出错态红色（0.35s 渐隐）。
const FRAME_COLOR_IDLE: Color = Color(1.0, 1.0, 1.0, 0.9)
const FRAME_COLOR_SELECTED: Color = Color(1.0, 0.84, 0.2, 1.0)
const FRAME_COLOR_ERROR: Color = Color(1.0, 0.3, 0.25, 1.0)
## 光标框半边长（略小于 CELL/2 = 48，框住整颗糖果：外接半径 38，余量 48−44=4px/边）。
const FRAME_HALF: float = 44.0
## 选中态呼吸脉冲速率（rad/s）与振幅（alpha 摆动幅度）。
const PULSE_SPEED: float = 6.0
const PULSE_ALPHA_AMPLITUDE: float = 0.35
## 无效交换红闪时长（秒）。
const ERROR_FLASH_SEC: float = 0.35
## 光标框四角标记半径。
const CORNER_DOT_RADIUS: float = 4.0

## ---- 触摸 / 鼠标统一指针手势（「点按-点按」与「滑动」两种交换手势）----
## 两套事件归一到同一状态机：移动端真实触摸走 InputEventScreenTouch / ScreenDrag，
## 桌面鼠标走 InputEventMouseButton / MouseMotion。移动端 emulate_mouse_from_touch
## （默认开）会让真实触摸再产出一份鼠标镜像事件 —— 用 _pointer_is_mouse 区分来源，
## 保证一次物理操作只被处理一次（触摸路径优先，镜像鼠标事件只做消费不重复起手）。
## 滑动：按住糖果拖过阈值（≈半格）即向位移主轴方向的相邻格发起交换；
## 点按：按下→抬起位移小于阈值视为点按，走与 confirm 相同的两段语义。
const SWIPE_TRIGGER_DISTANCE: float = 42.0
## 鼠标手势的伪触点 index（真实触点 index ≥ 0，取 -1 绝不冲突）。
const MOUSE_POINTER_INDEX: int = -1

## 当前所在格（列 x、行 y）。
var grid_pos: Vector2i = Vector2i.ZERO
## 网格边界（由 Main 通过 setup 注入，光标不依赖 Board 类型即可钳制）。
var bounds: Vector2i = Vector2i(6, 6)
## 是否处于「已选中一格、等待交换」状态。
var has_selection: bool = false
## 被选中的格（未选中时为 (-1, -1) 哨兵值）。
var selected_cell: Vector2i = Vector2i(-1, -1)
## 呼吸脉冲相位与红闪剩余时长（_process 推进）。
var _pulse_phase: float = 0.0
var _error_flash_left: float = 0.0
## 指针手势状态（触摸与鼠标共用一套）：跟踪中的触点 index / 是否鼠标来源 /
## 按下点（视口坐标）/ 按下格 / 本次手势是否已按滑动处理。
var _pointer_active: bool = false
var _pointer_index: int = MOUSE_POINTER_INDEX
var _pointer_is_mouse: bool = false
var _pointer_press_pos: Vector2 = Vector2.ZERO
var _pointer_press_cell: Vector2i = Vector2i(-1, -1)
var _pointer_swiped: bool = false


func _process(delta: float) -> void:
	if has_selection:
		_pulse_phase += delta * PULSE_SPEED
	if _error_flash_left > 0.0:
		_error_flash_left = maxf(_error_flash_left - delta, 0.0)
	if has_selection or _error_flash_left > 0.0:
		queue_redraw()


## 无效交换反馈：红闪 + 抖动一帧（Main 在 try_swap 失败时调用）。
func flash_error() -> void:
	_error_flash_left = ERROR_FLASH_SEC
	queue_redraw()


## 注入网格边界并复位到左上角（Main._ready 调用一次）。
func setup(cols: int, rows: int) -> void:
	bounds = Vector2i(cols, rows)
	reset_position()


## 重开时复位：回原点、清选中态、清指针手势状态。
## ⚠️ 实测回归（第二关第一次滑动被吞）：光标复位若不清指针状态机，上一关「手势中致胜」
## 留下的 _pointer_active/_pointer_swiped 会跨关存活 —— 新关第一根手指 begin 抢不到、
## move 被 _pointer_swiped 短路，整个手势被吞。过关/重开/开局都走本函数，一处收口。
func reset_position() -> void:
	grid_pos = Vector2i.ZERO
	has_selection = false
	selected_cell = Vector2i(-1, -1)
	_sync_position()
	queue_redraw()
	_pointer_reset()


## 程序化移到某格（冒烟场景驱动用，等价一次瞬移）。
func set_cell(cell: Vector2i) -> void:
	grid_pos = cell
	_sync_position()


func _unhandled_input(event: InputEvent) -> void:
	# 指针事件先做手势状态簿记（begin/move/end），再谈输入门控：
	# 致胜滑动会在交换结算管线（try_swap → add_score → check_end）内同步把 outcome
	# 变成 WIN —— 同一次手势的抬起事件带着「胜负已分」到达。若这里按 is_playing
	# 提前丢弃事件，release 整条被吞，指针状态机（_pointer_active/_pointer_swiped/
	# _pointer_press_cell）带脏状态跨关，下一关第一次按住滑动从此失灵。
	# 状态簿记永远执行；「能否产生游戏动作」由各动作入口（_swipe_swap/_tap_at/
	# 方向键/confirm）用 is_playing 门控，胜负已分后不再产生新交换/选中。
	if _handle_pointer(event):
		# 指针事件就地消费（含触摸派生的鼠标镜像事件），不再上抛给 Main。
		get_viewport().set_input_as_handled()
		return
	# 未开始（开始按钮前）或胜负已分后冻结对局输入（开始/重开/过关由 Main 处理）。
	if not GameState.is_playing():
		return
	if event.is_action_pressed("move_left"):
		_try_move(Vector2i.LEFT)
	elif event.is_action_pressed("move_right"):
		_try_move(Vector2i.RIGHT)
	elif event.is_action_pressed("move_up"):
		_try_move(Vector2i.UP)
	elif event.is_action_pressed("move_down"):
		_try_move(Vector2i.DOWN)
	elif event.is_action_pressed("confirm"):
		_handle_confirm()
	else:
		return
	# 本节点消费掉的输入就地标记已处理，事件不再向上传给 Main。
	# ⚠️ 实测回归：缺这一句时，「触发胜利的那次 confirm」会在同一事件里继续传给
	# Main 的过关分支（check_end 在交换结算内同步执行，事件派发中途 outcome 已变 WIN），
	# 玩家直接跳过胜利画面进下一关 —— 胜负反馈被吞掉。
	get_viewport().set_input_as_handled()


## 尝试向 direction 移一格；越界则原地不动（棋盘边缘钳制）。
func _try_move(direction: Vector2i) -> void:
	var next := grid_pos + direction
	if next.x < 0 or next.y < 0 or next.x >= bounds.x or next.y >= bounds.y:
		return
	grid_pos = next
	_sync_position()
	cell_changed.emit(grid_pos)


## confirm / 点按共用的两段语义：
## 未选中 → 选中当前格；点同一格 → 取消选中；相邻 → 发起交换；非相邻 → 改选新格。
func _handle_confirm() -> void:
	if not has_selection:
		_select_current()
		return
	if selected_cell == grid_pos:
		_clear_selection()
		return
	if _are_cells_adjacent(selected_cell, grid_pos):
		swap_requested.emit(selected_cell, grid_pos)
	_clear_selection()


func _select_current() -> void:
	has_selection = true
	selected_cell = grid_pos
	selection_changed.emit(selected_cell)
	queue_redraw()


func _clear_selection() -> void:
	has_selection = false
	selected_cell = Vector2i(-1, -1)
	queue_redraw()


func _are_cells_adjacent(a: Vector2i, b: Vector2i) -> bool:
	return absi(a.x - b.x) + absi(a.y - b.y) == 1


## ---- 统一指针手势状态机（触摸 ScreenTouch/Drag 与鼠标 MouseButton/Motion）----

## 入口：能识别为指针事件的都返回 true（消费掉，含不该由本手势处理的镜像事件）。
## ⚠️ 实测（emulate_mouse_from_touch 默认开）：一次真实触摸会先投递「鼠标镜像事件」
## 再投递 ScreenTouch —— 真实触摸按下时若手势还是鼠标镜像源，必须接管（触摸优先），
## 后续拖动/抬起走真实触摸路径；镜像事件只被消费，不再重复起手/收尾。
func _handle_pointer(event: InputEvent) -> bool:
	var touch := event as InputEventScreenTouch
	if touch != null:
		if touch.pressed:
			# 已有真实触点在跟踪：第二根手指不抢控（与摇杆规范一致的 touch_index 策略）。
			if not _pointer_active or _pointer_is_mouse:
				_pointer_begin(touch.index, false, touch)
			return true
		if _pointer_active and touch.index == _pointer_index and not _pointer_is_mouse:
			_pointer_end(touch)
		return _pointer_active
	var drag := event as InputEventScreenDrag
	if drag != null:
		if _pointer_active and drag.index == _pointer_index and not _pointer_is_mouse:
			_pointer_move(drag.position)
		return _pointer_active
	var mouse_button := event as InputEventMouseButton
	if mouse_button != null and mouse_button.button_index == MOUSE_BUTTON_LEFT:
		if mouse_button.pressed:
			if not _pointer_active:
				_pointer_begin(MOUSE_POINTER_INDEX, true, mouse_button)
		elif _pointer_active and _pointer_is_mouse:
			_pointer_end(mouse_button)
		return true
	var mouse_motion := event as InputEventMouseMotion
	if mouse_motion != null and _pointer_active and _pointer_is_mouse:
		_pointer_move(mouse_motion.position)
		return true
	return false


func _pointer_begin(index: int, is_mouse: bool, event: InputEvent) -> void:
	_pointer_active = true
	_pointer_index = index
	_pointer_is_mouse = is_mouse
	_pointer_press_pos = _event_position(event)
	_pointer_press_cell = _cell_at(event)
	_pointer_swiped = false


## 拖动：位移过阈值即按主轴方向发起一次交换（一次手势至多一次）。
func _pointer_move(viewport_pos: Vector2) -> void:
	if _pointer_swiped:
		return
	var offset := viewport_pos - _pointer_press_pos
	if offset.length() < SWIPE_TRIGGER_DISTANCE:
		return
	_pointer_swiped = true
	if not _in_bounds(_pointer_press_cell):
		return
	_swipe_swap(_pointer_press_cell, _pointer_press_cell + _dominant_direction(offset))


## 抬起：未按滑动处理则视为一次点按（位移过小的轻点不会误触交换）。
func _pointer_end(event: InputEvent) -> void:
	var swiped := _pointer_swiped
	_pointer_reset()
	if swiped:
		return
	_tap_at(_cell_at(event))


## 点按-点按交换：光标随点按格移动，再走 confirm 的两段语义。
func _tap_at(cell: Vector2i) -> void:
	# 游戏动作入口门控：胜负已分后的点按只做手势簿记收口，不再移动光标/改选中
	#（遮罩上的按钮走 GUI 输入，到不了这里，开始/重开/过关交互不受影响）。
	if not GameState.is_playing():
		return
	if not _in_bounds(cell):
		return
	grid_pos = cell
	_sync_position()
	cell_changed.emit(grid_pos)
	_handle_confirm()


## 滑动交换：光标移到起手格并请求与主轴方向相邻格交换（无效交换由 Main 反馈红闪）。
func _swipe_swap(from_cell: Vector2i, to_cell: Vector2i) -> void:
	# 游戏动作入口门控：胜负已分后拖动只推进手势簿记（_pointer_swiped 已置位，
	# 抬起按滑动收口），不再发起新交换 —— 事件派发中途判胜时（致胜滑动），
	# 交换结算在 is_playing 仍为真时已执行完毕，这里拦的是其后的重复动作。
	if not GameState.is_playing():
		return
	grid_pos = from_cell
	_sync_position()
	cell_changed.emit(grid_pos)
	_clear_selection()
	swap_requested.emit(from_cell, to_cell)


## 位移主轴方向：棋盘无旋转缩放，方向符号与坐标系无关；对角拖动取绝对值较大轴。
func _dominant_direction(offset: Vector2) -> Vector2i:
	if absf(offset.x) >= absf(offset.y):
		return Vector2i.RIGHT if offset.x > 0.0 else Vector2i.LEFT
	return Vector2i.DOWN if offset.y > 0.0 else Vector2i.UP


## 事件位置 → 棋盘格坐标：用 Board.make_input_local 一步完成
## 「窗口 → 视口（stretch/expand）→ 画布 → 棋盘局部」的逆变换链，不手算缩放。
func _cell_at(event: InputEvent) -> Vector2i:
	var board := get_parent() as Board
	if board == null:
		return Vector2i(-1, -1)
	var local := board.make_input_local(event)
	return Vector2i(floori(local.position.x / Board.CELL), floori(local.position.y / Board.CELL))


func _event_position(event: InputEvent) -> Vector2:
	var positioned := event as InputEventFromWindow
	if positioned != null:
		return positioned.position
	return Vector2.ZERO


func _in_bounds(cell: Vector2i) -> bool:
	return cell.x >= 0 and cell.y >= 0 and cell.x < bounds.x and cell.y < bounds.y


func _pointer_reset() -> void:
	_pointer_active = false
	_pointer_index = MOUSE_POINTER_INDEX
	_pointer_is_mouse = false
	_pointer_swiped = false


## 把节点位置对齐到所在格中心（父节点是 Board，本地坐标即棋盘坐标）。
func _sync_position() -> void:
	var board: Board = get_parent() as Board
	if board != null:
		position = board.cell_to_position(grid_pos)


func _draw() -> void:
	var half: float = FRAME_HALF
	var rect := Rect2(-half, -half, half * 2.0, half * 2.0)
	var color: Color = FRAME_COLOR_IDLE
	if _error_flash_left > 0.0:
		color = FRAME_COLOR_ERROR
	elif has_selection:
		# 呼吸脉冲：alpha 在 [1−振幅, 1] 区间正弦摆动，相位静止时回满。
		var pulse := 1.0 - PULSE_ALPHA_AMPLITUDE * (0.5 + 0.5 * sin(_pulse_phase))
		color = Color(FRAME_COLOR_SELECTED, pulse)
	draw_rect(rect, color, false, 4.0)
	# 四角小标记：普通态也有，帮助玩家在密集棋盘上锁定光标。
	for corner in [Vector2(-1, -1), Vector2(1, -1), Vector2(-1, 1), Vector2(1, 1)]:
		var anchor := Vector2(corner.x * half, corner.y * half)
		draw_circle(anchor, CORNER_DOT_RADIUS, color)
