class_name GameBoard
extends Node2D
## 连连看棋盘：发牌 / 选中 / ≤2 转折连通判定 / 消除 / 死局自动洗牌（保证有解）。
##
## 规范要点（见 SKILL.md「GDScript 规范」）：
## - 只对外发信号，不直接操作 HUD（Main 场景订阅本类信号刷新 UI）；
## - 成员变量与函数签名全部标注类型；
## - 棋盘逻辑（有解判定、洗牌）为纯函数风格，可被冒烟场景无头驱动。

## 洗牌最大重试次数；仍无解时走「强制相邻对」兜底，保证新局面必然有可消除对。
const MAX_SHUFFLE_ATTEMPTS: int = 200
## 空棋盘外圈也算可通行通道（经典连连看规则：路径可以绕出棋盘外）。
const BORDER: int = 1

const COLS: int = 4
const ROWS: int = 4
const CELL_SIZE: float = 100.0
const BOARD_ORIGIN: Vector2 = Vector2(70.0, 240.0)
## 车型表：8 种汽车元素，scaffold 用 4x4（8 对）；6x6 大棋盘在实现节点扩展。
const CAR_TYPES: Array[String] = ["轿车", "跑车", "卡车", "赛车", "警车", "救护车", "消防车", "出租车"]
const CAR_COLORS: Array[Color] = [
	Color(0.36, 0.52, 0.78, 1), Color(0.80, 0.36, 0.36, 1), Color(0.38, 0.66, 0.48, 1),
	Color(0.78, 0.62, 0.30, 1), Color(0.42, 0.44, 0.72, 1), Color(0.80, 0.45, 0.58, 1),
	Color(0.40, 0.62, 0.66, 1), Color(0.58, 0.58, 0.62, 1),
]

signal tiles_changed(remaining: int)
signal match_made(cell_a: Vector2i, cell_b: Vector2i, points: int)
signal selection_changed(cell: Vector2i)
signal selection_rejected(cell: Vector2i)
signal board_shuffled()

const TILE_SCENE := preload("res://scenes/tile.tscn")
const NO_SELECTION: Vector2i = Vector2i(-1, -1)

var _grid: Dictionary = {}
var _selected: Vector2i = NO_SELECTION
var _cursor_cell: Vector2i = NO_SELECTION

@onready var _tiles_root: Node2D = $Tiles
@onready var _path_layer: PathLayer = $PathLayer


func _ready() -> void:
	setup()


## 重开入口：清场重发。types 逐对生成后整体洗牌，保证成对且布局随机。
func setup() -> void:
	_clear_tiles()
	_selected = NO_SELECTION
	_cursor_cell = NO_SELECTION
	var types: Array[int] = []
	var pairs: int = COLS * ROWS / 2
	for i in pairs:
		var type_index: int = i % CAR_TYPES.size()
		types.append(type_index)
		types.append(type_index)
	types.shuffle()
	for idx in types.size():
		@warning_ignore("integer_division")
		var cell := Vector2i(idx % COLS, idx / COLS)
		_spawn_tile(types[idx], cell)
	if not has_any_match():
		_reshuffle_until_solvable()
	tiles_changed.emit(remaining_count())


func remaining_count() -> int:
	return _grid.size()


func is_occupied(cell: Vector2i) -> bool:
	return _grid.has(cell) and _grid[cell] != null


## 格子 → 世界坐标（格子中心）。
func world_from_cell(cell: Vector2i) -> Vector2:
	return BOARD_ORIGIN + Vector2(cell) * CELL_SIZE + Vector2(CELL_SIZE, CELL_SIZE) * 0.5


## 世界坐标 → 格子；越界返回 (-1,-1)。
func cell_from_world(world_pos: Vector2) -> Vector2i:
	var local := to_local(world_pos)
	var offset: Vector2 = local - BOARD_ORIGIN
	var cell := Vector2i(int(floor(offset.x / CELL_SIZE)), int(floor(offset.y / CELL_SIZE)))
	if cell.x < 0 or cell.x >= COLS or cell.y < 0 or cell.y >= ROWS:
		return NO_SELECTION
	return cell


## 桌面/触屏点选：触摸经 emulate_mouse_from_touch 统一转成鼠标左键。
func _unhandled_input(event: InputEvent) -> void:
	var mouse := event as InputEventMouseButton
	if mouse != null and mouse.button_index == MOUSE_BUTTON_LEFT and mouse.pressed:
		select_cell(cell_from_world(get_global_mouse_position()))


## 选中 / 配对入口（键盘 confirm 走光标所在格，鼠标点击走命中格）。
## 返回 true 表示该次操作改变了局面（选中、取消或消除）。
func select_cell(cell: Vector2i) -> bool:
	if GameState.state != GameState.State.PLAYING:
		return false
	if not is_occupied(cell):
		return false
	if _selected == NO_SELECTION:
		_select(cell)
		return true
	if _selected == cell:
		_deselect()
		return true
	var first: Vector2i = _selected
	var first_type: int = (_grid[first] as Tile).type_index
	if first_type == (_grid[cell] as Tile).type_index:
		var path := _find_path(first, cell)
		if not path.is_empty():
			_remove_pair(first, cell, path)
			return true
	_reject(cell)
	return false


## 清除当前选中（冒烟相位切换 / 外部复位用）。
func clear_selection() -> void:
	_deselect()


func _select(cell: Vector2i) -> void:
	_selected = cell
	(_grid[cell] as Tile).set_selected(true)
	selection_changed.emit(cell)


func _deselect() -> void:
	if _selected != NO_SELECTION and is_occupied(_selected):
		(_grid[_selected] as Tile).set_selected(false)
	_selected = NO_SELECTION
	selection_changed.emit(NO_SELECTION)


## 不可消除：保留先前选中，抖动提示后取消当次点击。
func _reject(cell: Vector2i) -> void:
	(_grid[cell] as Tile).shake()
	selection_rejected.emit(cell)


## 光标悬停高亮：Main 订阅 Player.moved 后调用。
func notify_cursor(cell: Vector2i) -> void:
	if cell == _cursor_cell:
		return
	if _cursor_cell != NO_SELECTION and is_occupied(_cursor_cell):
		(_grid[_cursor_cell] as Tile).set_cursor_hover(false)
	_cursor_cell = cell
	if cell != NO_SELECTION and is_occupied(cell):
		(_grid[cell] as Tile).set_cursor_hover(true)


## 找到任意一对可消除的卡片（冒烟与洗牌有解判定共用）。
func find_any_match() -> Array[Vector2i]:
	var cells := _occupied_cells()
	for i in cells.size():
		for j in range(i + 1, cells.size()):
			if (_grid[cells[i]] as Tile).type_index == (_grid[cells[j]] as Tile).type_index \
					and not _find_path(cells[i], cells[j]).is_empty():
				return [cells[i], cells[j]]
	return []


func has_any_match() -> bool:
	return not find_any_match().is_empty()


## ── 连通判定：≤2 次转折（≤3 段线），路径不穿过未消除卡片，可绕棋盘外圈 ──

## 可达 → 返回完整折线（含两端：[a]、[a,c1]、[a,c1,c2] 或直线 [a,b]）；不可达 → []。
func _find_path(a: Vector2i, b: Vector2i) -> Array[Vector2i]:
	if a == b:
		return []
	if (a.x == b.x or a.y == b.y) and _clear_segment(a, b):
		return [a, b]
	for corner: Vector2i in [Vector2i(a.x, b.y), Vector2i(b.x, a.y)]:
		if _is_passable(corner) and _clear_segment(a, corner) and _clear_segment(corner, b):
			return [a, corner, b]
	for row in range(-BORDER, ROWS + BORDER):
		var c1 := Vector2i(a.x, row)
		var c2 := Vector2i(b.x, row)
		if c1 != a and c2 != b and _is_passable(c1) and _is_passable(c2) \
				and _clear_segment(a, c1) and _clear_segment(c1, c2) and _clear_segment(c2, b):
			return [a, c1, c2, b]
	for col in range(-BORDER, COLS + BORDER):
		var c1 := Vector2i(col, a.y)
		var c2 := Vector2i(col, b.y)
		if c1 != a and c2 != b and _is_passable(c1) and _is_passable(c2) \
				and _clear_segment(a, c1) and _clear_segment(c1, c2) and _clear_segment(c2, b):
			return [a, c1, c2, b]
	return []


## 两点同行或同列，且「严格之间」的格子全空（棋盘外恒为空）。
func _clear_segment(p: Vector2i, q: Vector2i) -> bool:
	if p.x != q.x and p.y != q.y:
		return false
	var step: Vector2i = (q - p).sign()
	var cursor: Vector2i = p + step
	while cursor != q:
		if _is_blocked(cursor):
			return false
		cursor += step
	return true


## 棋盘内且有卡片 = 阻挡；棋盘内空格与棋盘外圈 = 可通行。
func _is_blocked(cell: Vector2i) -> bool:
	return is_occupied(cell)


func _is_passable(cell: Vector2i) -> bool:
	if cell.x < 0 or cell.x >= COLS or cell.y < 0 or cell.y >= ROWS:
		return true
	return not is_occupied(cell)


## ── 消除 / 洗牌 ──

func _remove_pair(a: Vector2i, b: Vector2i, cell_path: Array[Vector2i]) -> void:
	var points := PackedVector2Array()
	for cell in cell_path:
		points.append(world_from_cell(cell))
	_free_tile(a)
	_free_tile(b)
	_selected = NO_SELECTION
	GameState.add_score(GameState.MATCH_POINTS)
	_path_layer.show_path(points)
	match_made.emit(a, b, GameState.MATCH_POINTS)
	var remaining := remaining_count()
	tiles_changed.emit(remaining)
	if remaining == 0:
		GameState.win_game()
	elif not has_any_match():
		_shuffle_remaining()


## 死局自动洗牌：重排剩余卡片直到必有可消除对（含开局发牌死局与消除后死局）。
func _shuffle_remaining() -> void:
	_reshuffle_until_solvable()
	board_shuffled.emit()


## 重排直到必有可消除对；多次重试仍无解则强制把两张卡换成同型相邻兜底（必然 0 转折连通）。
func _reshuffle_until_solvable() -> void:
	var cells := _occupied_cells()
	var types: Array[int] = []
	for cell in cells:
		types.append((_grid[cell] as Tile).type_index)
	for _attempt in MAX_SHUFFLE_ATTEMPTS:
		_assign_types(cells, types, true)
		if has_any_match():
			return
	# 兜底：cells 至少 2 张（成对消除，剩余必为偶数），同型即必通。
	var fallback_type: int = types[0]
	_spawn_replace(cells[0], fallback_type)
	_spawn_replace(cells[1], fallback_type)


## 把 types 重排后写回 cells（shuffle=true 时打乱副本，不改动原数组）。
func _assign_types(cells: Array[Vector2i], types: Array[int], do_shuffle: bool) -> void:
	var order: Array[int] = []
	for i in types.size():
		order.append(i)
	if do_shuffle:
		order.shuffle()
	for i in cells.size():
		_spawn_replace(cells[i], types[order[i]])


## 洗牌即换型换位：直接改卡片类型并复位外观（不重建节点，动画状态干净）。
func _spawn_replace(cell: Vector2i, type_index: int) -> void:
	var tile := _grid[cell] as Tile
	tile.setup(type_index, cell, CAR_TYPES[type_index], CAR_COLORS[type_index])
	tile.set_selected(false)
	tile.set_cursor_hover(false)


func _occupied_cells() -> Array[Vector2i]:
	var cells: Array[Vector2i] = []
	for cell: Vector2i in _grid.keys():
		cells.append(cell)
	cells.sort()
	return cells


func _spawn_tile(type_index: int, cell: Vector2i) -> void:
	var tile := TILE_SCENE.instantiate() as Tile
	tile.position = world_from_cell(cell)
	_grid[cell] = tile
	_tiles_root.add_child(tile)
	tile.setup(type_index, cell, CAR_TYPES[type_index], CAR_COLORS[type_index])


func _free_tile(cell: Vector2i) -> void:
	var tile := _grid[cell] as Tile
	tile.set_selected(false)
	tile.pop()
	_grid.erase(cell)


func _clear_tiles() -> void:
	for cell: Vector2i in _grid.keys():
		var tile := _grid[cell] as Tile
		if is_instance_valid(tile):
			tile.queue_free()
	_grid.clear()
	if _tiles_root != null:
		for child in _tiles_root.get_children():
			child.queue_free()
