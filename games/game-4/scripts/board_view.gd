class_name BoardView
extends Node2D
## 棋盘视图：装载关卡、维护管子朝向、重算光束、渲染与点击拾取。
##
## 规范要点：
## - 对外只发信号（rotate_requested / level_loaded），旋转计步与胜负判定由 Main 编排
##   （Main 订阅后走 GameState.register_rotation，视图层不直接改全局状态）；
## - 玩法数值（格边长、原点）集中为常量；状态为纯数据（Dictionary），可被无头断言。

## 旋转请求（点击 / confirm 键），参数：目标格子坐标。
signal rotate_requested(cell: Vector2i)
## 关卡装载完成（参数：关卡数据；Cursor 订阅它归位）。
signal level_loaded(level: Dictionary)

const CELL: float = 96.0
const GRID_W: int = 5
const GRID_H: int = 5
## 棋盘在设计分辨率 1280x720 内居中（顶部留 HUD 行）。
const BOARD_ORIGIN: Vector2 = Vector2((1280.0 - CELL * GRID_W) / 2.0, (720.0 - CELL * GRID_H) / 2.0 + 24.0)

## 颜色（极简几何美术路线，不依赖外部素材）。
const COLOR_BOARD: Color = Color(0.09, 0.11, 0.18, 1.0)
const COLOR_GRID: Color = Color(1.0, 1.0, 1.0, 0.07)
const COLOR_PIPE: Color = Color(0.55, 0.75, 1.0, 1.0)
const COLOR_SOURCE: Color = Color(1.0, 0.85, 0.3, 1.0)
const COLOR_SINK_OFF: Color = Color(0.45, 0.55, 0.65, 1.0)
const COLOR_SINK_ON: Color = Color(0.35, 1.0, 0.55, 1.0)
const COLOR_WALL: Color = Color(0.22, 0.22, 0.26, 1.0)
const COLOR_BEAM: Color = Color(1.0, 0.95, 0.4, 0.95)
const COLOR_BEAM_GLOW: Color = Color(1.0, 0.9, 0.3, 0.25)

## 当前关卡数据（LevelSet.LEVELS 的一项）。
var level: Dictionary = {}
## 可旋转管子的当前朝向：cell -> rot。
var rots: Dictionary = {}
## 最近一次光束结果（PuzzleLogic.propagate 返回值）。
var beam: Dictionary = {}

@onready var cursor: Cursor = $Cursor


func _ready() -> void:
	if not level.is_empty():
		_recompute_beam()


## 装载关卡：按 init_rot 重建朝向表，光标归位于光源旁第一根管（或棋盘中心）。
func load_level(new_level: Dictionary) -> void:
	level = new_level
	rots.clear()
	for pipe: Dictionary in new_level["pipes"]:
		rots[pipe["cell"]] = int(pipe["init_rot"])
	_recompute_beam()
	queue_redraw()
	var start_cell: Vector2i = _default_cursor_cell()
	level_loaded.emit(new_level)
	cursor.place_at(start_cell)


## 默认光标落点：第一根可旋转管（冒烟按确定性依赖它），没有则棋盘中心。
func _default_cursor_cell() -> Vector2i:
	var pipes: Array = level.get("pipes", [])
	if not pipes.is_empty():
		return pipes[0]["cell"]
	return Vector2i(GRID_W / 2, GRID_H / 2)


## 是否在网格内。
func is_inside_grid(cell: Vector2i) -> bool:
	return cell.x >= 0 and cell.x < GRID_W and cell.y >= 0 and cell.y < GRID_H


## 该格是否为可旋转管道。
func is_pipe_at(cell: Vector2i) -> bool:
	return rots.has(cell)


## 格子中心（Board 局部坐标）。
func cell_center(cell: Vector2i) -> Vector2:
	return BOARD_ORIGIN + Vector2(cell) * CELL + Vector2(CELL, CELL) * 0.5


## 局部坐标 → 格子；不在网格内返回 Vector2i(-1, -1)。
func local_to_cell(local: Vector2) -> Vector2i:
	var offset: Vector2 = local - BOARD_ORIGIN
	var cell := Vector2i(int(floor(offset.x / CELL)), int(floor(offset.y / CELL)))
	if is_inside_grid(cell):
		return cell
	return Vector2i(-1, -1)


## 当前棋盘完整状态快照（供 PuzzleLogic / GameState.register_rotation 消费）。
func current_cells() -> Dictionary:
	if level.is_empty():
		return {}
	var cells: Dictionary = LevelSet.build_cells(level, false)
	for cell: Vector2i in rots:
		cells[cell] = {"type": _pipe_type_at(cell), "rot": rots[cell]}
	return cells


func _pipe_type_at(cell: Vector2i) -> String:
	for pipe: Dictionary in level.get("pipes", []):
		if pipe["cell"] == cell:
			return pipe["type"]
	return PuzzleLogic.TYPE_EMPTY


## 旋转一格：可旋转管才转（顺时针 90°），成功返回 true 并重算光束。
func rotate_at(cell: Vector2i) -> bool:
	if not is_pipe_at(cell):
		return false
	rots[cell] = PuzzleLogic.rotated_clockwise(rots[cell])
	_recompute_beam()
	queue_redraw()
	return true


## 视图触发的旋转请求（鼠标点击）；confirm 键的请求由 Main 直接发起，同样汇入此信号。
func request_rotate(cell: Vector2i) -> void:
	rotate_requested.emit(cell)


## 用当前朝向重算光束（实时预览）。
func _recompute_beam() -> void:
	if level.is_empty():
		beam = {}
		return
	beam = PuzzleLogic.propagate(
		current_cells(), level["source_cell"], level["source_dir"], level["sink_open"])


func _unhandled_input(event: InputEvent) -> void:
	var click := event as InputEventMouseButton
	if click == null:
		return
	if not (click.pressed and click.button_index == MOUSE_BUTTON_LEFT):
		return
	var cell: Vector2i = local_to_cell(get_local_mouse_position())
	if is_inside_grid(cell):
		request_rotate(cell)
		get_viewport().set_input_as_handled()


func _draw() -> void:
	_draw_board_base()
	_draw_pieces()
	_draw_beam()


func _draw_board_base() -> void:
	var size := Vector2(CELL * GRID_W, CELL * GRID_H)
	draw_rect(Rect2(BOARD_ORIGIN - Vector2(10, 10), size + Vector2(20, 20)), COLOR_BOARD)
	for x: int in range(GRID_W + 1):
		var from := Vector2(BOARD_ORIGIN.x + x * CELL, BOARD_ORIGIN.y)
		draw_line(from, from + Vector2(0, size.y), COLOR_GRID, 2.0)
	for y: int in range(GRID_H + 1):
		var from_v := Vector2(BOARD_ORIGIN.x, BOARD_ORIGIN.y + y * CELL)
		draw_line(from_v, from_v + Vector2(size.x, 0), COLOR_GRID, 2.0)


func _draw_pieces() -> void:
	if level.is_empty():
		return
	for wall: Vector2i in level["walls"]:
		_draw_wall(wall)
	_draw_source(level["source_cell"], level["source_dir"])
	_draw_sink(level["sink_cell"], level["sink_open"])
	for pipe: Dictionary in level["pipes"]:
		_draw_pipe(pipe["cell"], pipe["type"], rots.get(pipe["cell"], pipe["init_rot"]))


func _draw_wall(cell: Vector2i) -> void:
	var top_left: Vector2 = BOARD_ORIGIN + Vector2(cell) * CELL + Vector2(6, 6)
	var inner := Vector2(CELL, CELL) - Vector2(12, 12)
	draw_rect(Rect2(top_left, inner), COLOR_WALL)
	draw_rect(Rect2(top_left, inner), COLOR_GRID, false, 2.0)


func _draw_source(cell: Vector2i, dir: int) -> void:
	var center := cell_center(cell)
	draw_circle(center, 26.0, COLOR_SOURCE)
	draw_circle(center, 12.0, COLOR_BOARD)
	var tip: Vector2 = center + PuzzleLogic.DIR_VEC[dir] * 40.0
	var side_a: Vector2 = center + Vector2(PuzzleLogic.DIR_VEC[dir]).rotated(2.2) * 26.0
	var side_b: Vector2 = center + Vector2(PuzzleLogic.DIR_VEC[dir]).rotated(-2.2) * 26.0
	draw_colored_polygon(PackedVector2Array([tip, side_a, side_b]), COLOR_SOURCE)


func _draw_sink(cell: Vector2i, open_dir: int) -> void:
	var center := cell_center(cell)
	var color: Color = COLOR_SINK_ON if beam.get("solved", false) else COLOR_SINK_OFF
	var half: float = 30.0
	draw_rect(Rect2(center - Vector2(half, half), Vector2(half, half) * 2.0), color, false, 6.0)
	# 开口标记：开口方向一侧画短亮条。
	var gate: Vector2 = center + PuzzleLogic.DIR_VEC[open_dir] * (half + 4.0)
	var gate_perp: Vector2 = Vector2(PuzzleLogic.DIR_VEC[open_dir]).rotated(PI * 0.5) * 14.0
	draw_line(gate - gate_perp, gate + gate_perp, color, 6.0)
	draw_circle(center, 8.0, color)


func _draw_pipe(cell: Vector2i, piece_type: String, rot: int) -> void:
	var center := cell_center(cell)
	var openings: Array = PuzzleLogic.openings_for(piece_type, rot)
	for dir: int in openings:
		var edge: Vector2 = center + PuzzleLogic.DIR_VEC[dir] * (CELL * 0.5)
		draw_line(center, edge, COLOR_PIPE, 18.0)
	for dir: int in openings:
		var edge: Vector2 = center + PuzzleLogic.DIR_VEC[dir] * (CELL * 0.5)
		draw_circle(edge, 9.0, COLOR_PIPE)
	draw_circle(center, 14.0, COLOR_PIPE)
	draw_circle(center, 6.0, COLOR_BOARD)


func _draw_beam() -> void:
	if level.is_empty() or not beam.has("segments"):
		return
	for segment: Array in beam["segments"]:
		var from: Vector2 = cell_center(segment[0])
		var to: Vector2 = cell_center(segment[1])
		draw_line(from, to, COLOR_BEAM_GLOW, 16.0)
		draw_line(from, to, COLOR_BEAM, 6.0)
