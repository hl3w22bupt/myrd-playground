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
## 光标框半边长（略小于 CELL/2 = 36，框住整颗糖果：外接半径 29，余量 36−33=3px/边）。
const FRAME_HALF: float = 33.0
## 选中态呼吸脉冲速率（rad/s）与振幅（alpha 摆动幅度）。
const PULSE_SPEED: float = 6.0
const PULSE_ALPHA_AMPLITUDE: float = 0.35
## 无效交换红闪时长（秒）。
const ERROR_FLASH_SEC: float = 0.35

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


## 重开时复位：回原点、清选中态。
func reset_position() -> void:
	grid_pos = Vector2i.ZERO
	has_selection = false
	selected_cell = Vector2i(-1, -1)
	_sync_position()
	queue_redraw()


## 程序化移到某格（冒烟场景驱动用，等价一次瞬移）。
func set_cell(cell: Vector2i) -> void:
	grid_pos = cell
	_sync_position()


func _unhandled_input(event: InputEvent) -> void:
	# 胜负已分后冻结输入（重开/过关由 Main 处理 restart / confirm 动作）。
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


## confirm 的两段语义：第一次选中当前格，第二次对相邻格发起交换。
func _handle_confirm() -> void:
	if not has_selection:
		has_selection = true
		selected_cell = grid_pos
		selection_changed.emit(selected_cell)
		queue_redraw()
		return
	if selected_cell != grid_pos:
		swap_requested.emit(selected_cell, grid_pos)
	has_selection = false
	selected_cell = Vector2i(-1, -1)
	queue_redraw()


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
		draw_circle(anchor, 3.0, color)
