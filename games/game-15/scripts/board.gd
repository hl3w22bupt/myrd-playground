extends Node2D
## 棋盘控制器：持牌（BoardLogic 生成）、光标、选择配对、提示、洗牌与绘制。
## 输入三通道统一收口：键盘光标（move_* + confirm）、鼠标点击、移动端触摸
## （emulate_mouse_from_touch 默认开启 → 触摸会合成鼠标事件，这里只处理鼠标，
##  避免一次点按被 touch+mouse 双通道各消费一次）。
## 规则判定全部委托 BoardLogic（纯逻辑层），本文件只管状态迁移与表现。

const W: int = 6
const H: int = 8
const TYPE_COUNT: int = 10
const INVALID_CELL := Vector2i(-1, -1)
## 布局：HUD 顶部预留 / 底部按钮预留（设计分辨率 720x1280，expand 兼容更矮更宽窗口）。
const TOP_RESERVE: float = 200.0
const BOTTOM_RESERVE: float = 190.0
const SIDE_MARGIN: float = 28.0
## 消除连线显示时长（秒）。
const PATH_SHOW_SECONDS: float = 0.45

## 光标移动（键盘「玩家能移动」的行为信号）。
signal cursor_moved(cell: Vector2i)
## 选中状态变化（参数：当前选中格，无选中 = INVALID_CELL）。
signal selection_changed(cell: Vector2i)
## 可感知反馈文案（不可消除 / 不同车种 / 洗牌 / 提示 / 死局…），main 订阅显示。
signal feedback(text: String)
## 玩家请求重开（R 键），main 订阅统一处理。
signal restart_requested
## 棋盘清空（本局过关）。
signal board_cleared

var cells: PackedInt32Array = PackedInt32Array()
var tile_nodes: Dictionary = {}
var cursor_cell: Vector2i = Vector2i.ZERO
var selected_cell: Vector2i = INVALID_CELL
var cell_px: float = 96.0
var board_origin: Vector2 = Vector2.ZERO

var _rng := RandomNumberGenerator.new()
var _path_points: Array[Vector2] = []
var _path_left: float = 0.0

@onready var _tile_scene: PackedScene = preload("res://scenes/tile.tscn")


func _ready() -> void:
	_rng.randomize()
	new_game()


## 开新局（重开共用）：重新生成可解棋盘并重建图块。
func new_game() -> void:
	for node in tile_nodes.values():
		node.queue_free()
	tile_nodes.clear()
	cells = BoardLogic.generate(W, H, TYPE_COUNT, _rng)
	_layout()
	for idx in cells.size():
		if cells[idx] != BoardLogic.EMPTY:
			_spawn_tile(Vector2i(idx % W, idx / W))
	selected_cell = INVALID_CELL
	_path_points.clear()
	_path_left = 0.0
	cursor_cell = _first_occupied_cell()
	GameState.configure_run(W * H / 2, TYPE_COUNT)
	feedback.emit("点选两张相同车种且可连通的图块消除")


## 剩余图块数（= 剩余对数 × 2）。
func remaining_tiles() -> int:
	var count: int = 0
	for value in cells:
		if value != BoardLogic.EMPTY:
			count += 1
	return count


## 随机取一对当前可连通的同车种格（提示与冒烟共用）；无可连对返回空数组。
func find_hint_pair() -> Array:
	var pairs: Array = BoardLogic.collect_connectable_pairs(W, H, cells)
	if pairs.is_empty():
		return []
	return pairs[_rng.randi_range(0, pairs.size() - 1)]


func clear_selection() -> void:
	if selected_cell != INVALID_CELL:
		var tile := _tile_at(selected_cell)
		if tile != null:
			tile.set_selected(false)
	selected_cell = INVALID_CELL
	selection_changed.emit(selected_cell)


## 核心交互：选中 / 换选 / 取消 / 配对消除（键盘 confirm 与点击/触摸共用入口）。
func select_cell(cell: Vector2i) -> void:
	if not BoardLogic.in_bounds(W, H, cell) or cells[BoardLogic.cell_index(W, cell)] == BoardLogic.EMPTY:
		return
	if selected_cell == cell:
		clear_selection()
		feedback.emit("已取消选择")
		return
	var type_id: int = cells[BoardLogic.cell_index(W, cell)]
	if selected_cell == INVALID_CELL:
		selected_cell = cell
		_tile_at(cell).set_selected(true)
		selection_changed.emit(cell)
		feedback.emit("已选中 %s，再选一张相同车种" % _tile_at(cell).type_name())
		return
	var selected_type: int = cells[BoardLogic.cell_index(W, selected_cell)]
	if selected_type != type_id:
		_flash_mismatch(cell)
		feedback.emit("不同车种无法配对：%s ≠ %s" % [_tile_at(selected_cell).type_name(), _tile_at(cell).type_name()])
		return
	var path: Array[Vector2i] = BoardLogic.find_path(W, H, cells, selected_cell, cell)
	if path.is_empty():
		_flash_mismatch(cell)
		feedback.emit("无法连通（拐点超过 2 或被未消除图块阻挡）")
		return
	_eliminate(selected_cell, cell, type_id, path)


func request_hint() -> void:
	if GameState.won or remaining_tiles() == 0:
		return
	if not GameState.use_hint():
		feedback.emit("提示次数已用完（每局 %d 次）" % GameState.TOTAL_HINTS)
		return
	var pair: Array = find_hint_pair()
	if pair.is_empty():
		# 死局：自动洗牌后再提示（需求：死局自动洗牌或给出提示，两者都做）。
		_shuffle_remaining(true)
		pair = find_hint_pair()
	if pair.is_empty():
		feedback.emit("提示：当前棋盘没有可连通对")
		return
	for cell in pair:
		_tile_at(cell).show_hint()
	feedback.emit("提示：高亮了一对可连通的同车种图块（剩余 %d 次）" % GameState.hints_left)


func request_shuffle() -> void:
	if GameState.won or remaining_tiles() == 0:
		return
	_shuffle_remaining(false)


func move_cursor(delta: Vector2i) -> void:
	var target: Vector2i = cursor_cell + delta
	if not BoardLogic.in_bounds(W, H, target):
		return
	cursor_cell = target
	cursor_moved.emit(cursor_cell)
	queue_redraw()


func get_cell_center(cell: Vector2i) -> Vector2:
	return board_origin + Vector2(cell.x * cell_px + cell_px / 2.0, cell.y * cell_px + cell_px / 2.0)


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("move_left"):
		move_cursor(Vector2i(-1, 0))
	elif event.is_action_pressed("move_right"):
		move_cursor(Vector2i(1, 0))
	elif event.is_action_pressed("move_up"):
		move_cursor(Vector2i(0, -1))
	elif event.is_action_pressed("move_down"):
		move_cursor(Vector2i(0, 1))
	elif event.is_action_pressed("confirm"):
		select_cell(cursor_cell)
	elif event.is_action_pressed("hint"):
		request_hint()
	elif event.is_action_pressed("shuffle"):
		request_shuffle()
	elif event.is_action_pressed("restart"):
		restart_requested.emit()
	elif event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		var local: Vector2 = make_input_local(event).position
		var cell := Vector2i(int((local.x - board_origin.x) / cell_px), int((local.y - board_origin.y) / cell_px))
		select_cell(cell)


## 消除一对：画连线、摘牌、计入 GameState，并处理过关 / 死局自动洗牌。
func _eliminate(a: Vector2i, b: Vector2i, type_id: int, path: Array[Vector2i]) -> void:
	_path_points.clear()
	for cell in path:
		_path_points.append(get_cell_center(cell))
	_path_left = PATH_SHOW_SECONDS
	clear_selection()
	cells[BoardLogic.cell_index(W, a)] = BoardLogic.EMPTY
	cells[BoardLogic.cell_index(W, b)] = BoardLogic.EMPTY
	_tile_at(a).queue_free()
	_tile_at(b).queue_free()
	tile_nodes.erase(a)
	tile_nodes.erase(b)
	GameState.register_match(type_id)
	queue_redraw()
	if GameState.remaining_pairs == 0:
		board_cleared.emit()
		return
	if BoardLogic.collect_connectable_pairs(W, H, cells).is_empty():
		_shuffle_remaining(true)


## 洗牌剩余图块：车种多重集不变，重排后必须仍可解（最多尝试 30 次）。
func _shuffle_remaining(auto: bool) -> void:
	var candidate := cells
	for attempt in 30:
		var next: PackedInt32Array = BoardLogic.shuffle_types(W, H, cells, _rng)
		candidate = next
		if BoardLogic.is_greedy_solvable(W, H, next):
			break
	cells = candidate
	rebuild_tiles()
	if auto:
		feedback.emit("死局！已自动洗牌（车种配对关系不变）")
	else:
		feedback.emit("已洗牌：剩余 %d 块重排，配对关系不变" % remaining_tiles())


## 按当前 cells 重建全部图块节点（洗牌 / 重开后调用）。
func rebuild_tiles() -> void:
	for node in tile_nodes.values():
		node.queue_free()
	tile_nodes.clear()
	for idx in cells.size():
		if cells[idx] != BoardLogic.EMPTY:
			_spawn_tile(Vector2i(idx % W, idx / W))
	if selected_cell != INVALID_CELL and cells[BoardLogic.cell_index(W, selected_cell)] == BoardLogic.EMPTY:
		selected_cell = INVALID_CELL
		selection_changed.emit(selected_cell)
	queue_redraw()


func _spawn_tile(cell: Vector2i) -> void:
	var tile: CarTile = _tile_scene.instantiate()
	tile.setup(cells[BoardLogic.cell_index(W, cell)], cell, cell_px)
	add_child(tile)
	tile_nodes[cell] = tile


func _tile_at(cell: Vector2i) -> CarTile:
	var node = tile_nodes.get(cell)
	return node as CarTile


func _flash_mismatch(cell: Vector2i) -> void:
	var tile := _tile_at(cell)
	if tile != null:
		tile.show_mismatch()
	var selected_tile := _tile_at(selected_cell)
	if selected_tile != null:
		selected_tile.show_mismatch()


func _first_occupied_cell() -> Vector2i:
	for idx in cells.size():
		if cells[idx] != BoardLogic.EMPTY:
			return Vector2i(idx % W, idx / W)
	return Vector2i.ZERO


## 依据视口计算格子尺寸与棋盘原点（竖屏优先，窗口比例变化时居中不裁切）。
func _layout() -> void:
	var vp: Vector2 = get_viewport_rect().size
	var usable_h: float = vp.y - TOP_RESERVE - BOTTOM_RESERVE
	cell_px = minf((vp.x - SIDE_MARGIN * 2.0) / W, usable_h / H)
	cell_px = minf(cell_px, 140.0)
	var board_size := Vector2(cell_px * W, cell_px * H)
	board_origin = Vector2((vp.x - board_size.x) / 2.0, TOP_RESERVE + (usable_h - board_size.y) / 2.0)


func _process(delta: float) -> void:
	if _path_left > 0.0:
		_path_left = maxf(_path_left - delta, 0.0)
		queue_redraw()


func _draw() -> void:
	if cells.is_empty():
		return
	var board_end := board_origin + Vector2(cell_px * W, cell_px * H)
	var board_rect := Rect2(board_origin, Vector2(cell_px * W, cell_px * H))
	draw_rect(board_rect.grow(10.0), Color(0.08, 0.10, 0.14, 0.85))
	# 网格淡线（帮助玩家对齐视线）。
	var grid_line := Color(1.0, 1.0, 1.0, 0.05)
	for x in W + 1:
		var gx: float = board_origin.x + x * cell_px
		draw_line(Vector2(gx, board_origin.y), Vector2(gx, board_end.y), grid_line, 1.0)
	for y in H + 1:
		var gy: float = board_origin.y + y * cell_px
		draw_line(Vector2(board_origin.x, gy), Vector2(board_end.x, gy), grid_line, 1.0)
	# 光标（呼吸描边）。
	if not GameState.won:
		var pulse: float = 0.55 + 0.35 * sin(Time.get_ticks_msec() / 300.0)
		draw_rect(Rect2(board_origin + Vector2(cursor_cell) * cell_px, Vector2(cell_px, cell_px)),
			Color(1, 1, 1, pulse), false, 3.0)
	# 消除连线（短暂显示路径走向）。
	if _path_left > 0.0 and _path_points.size() >= 2:
		var alpha: float = _path_left / PATH_SHOW_SECONDS
		draw_polyline(_path_points, Color(1.0, 0.9, 0.3, alpha), 6.0)
		for point in [_path_points[0], _path_points[_path_points.size() - 1]]:
			draw_circle(point, 8.0, Color(1.0, 0.9, 0.3, alpha))
