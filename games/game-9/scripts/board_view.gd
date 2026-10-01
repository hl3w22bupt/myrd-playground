class_name BoardView
extends Node2D
## 棋盘渲染：地面 / 墙体 / 接线槽（点亮态）/ 蓄能方块，全部 Polygon2D 色块，零外部素材。
##
## 只订阅 GameState 信号重绘自己，不持有玩法逻辑（规则都在 SokobanBoard）：
## - board_changed(true)（载入 / 重开 / 撤销 / 换关）→ 重建全部瓦片；
## - board_changed(false)（一次增量移动）→ 只刷新方块位置与接线槽点亮态，
##   被推动的方块复用旧节点并按 spec.numeric.grid.pushAnimMs 补间到新格。
## 玩家角色不在本视图里 —— 它是独立节点（Player），由 Main 负责复位对齐。

const CELL: int = GameState.CELL_SIZE_PX
const CELL_INSET: float = 2.0

const FLOOR_COLOR := Color(0.14, 0.15, 0.21)
const WALL_COLOR := Color(0.36, 0.4, 0.52)
const TARGET_OFF_COLOR := Color(0.2, 0.24, 0.34)
const TARGET_ON_COLOR := Color(1.0, 0.83, 0.28)
const BOX_COLOR := Color(0.33, 0.62, 1.0)
const BOX_ON_TARGET_COLOR := Color(1.0, 0.6, 0.14)
## 死锁警示色：方块被顶进角、本关已无通关路径（SokobanBoard.is_deadlocked_cell）。
const DEADLOCK_COLOR := Color(0.86, 0.24, 0.24)

var _target_nodes: Dictionary = {}
var _box_nodes: Dictionary = {}
## 方块节点 instance_id -> Tween：复位 / 重建前统一终止，避免对已释放节点继续补间。
var _box_tweens: Dictionary = {}


func _ready() -> void:
	position = GameState.BOARD_ORIGIN_PX
	if not GameState.board_changed.is_connected(_on_board_changed):
		GameState.board_changed.connect(_on_board_changed)
	_rebuild()


func _on_board_changed(reset: bool) -> void:
	if reset:
		_rebuild()
	else:
		_refresh()


## 重建全部瓦片（关卡复位后调用）。
func _rebuild() -> void:
	_kill_box_tweens()
	for child in get_children():
		child.queue_free()
	_target_nodes = {}
	_box_nodes = {}
	var board := GameState.board
	for cell: Variant in board.floors:
		_add_tile(cell, CELL_INSET, FLOOR_COLOR)
	for cell: Variant in board.walls:
		_add_tile(cell, 0.0, WALL_COLOR)
	for cell: Variant in board.targets:
		var tile := _add_tile(cell, 8.0, TARGET_OFF_COLOR)
		_target_nodes[cell] = tile
	_refresh()


## 只刷新动态外观：接线槽点亮色 + 方块位置与状态色（方块节点尽量复用，≤5 个）。
func _refresh() -> void:
	var board := GameState.board
	for cell: Variant in _target_nodes:
		var tile: Polygon2D = _target_nodes[cell]
		tile.color = TARGET_ON_COLOR if board.is_lit(cell) else TARGET_OFF_COLOR
	var reused: Dictionary = {}
	var orphans: Array[Polygon2D] = []
	for cell: Variant in _box_nodes:
		if board.boxes.has(cell):
			reused[cell] = _box_nodes[cell]
		else:
			orphans.append(_box_nodes[cell])  # 唯一可能：这个方块刚被推离原格
	_box_nodes = reused
	for cell: Variant in board.boxes:
		var node: Polygon2D
		if _box_nodes.has(cell):
			node = _box_nodes[cell]
		elif not orphans.is_empty():
			node = orphans.pop_back()
			_tween_box(node, cell)  # 推动补间：按 pushAnimMs 滑到新格，而不是瞬移
		else:
			node = _add_tile(cell, 6.0, _box_color(cell))
		node.color = _box_color(cell)
		_box_nodes[cell] = node


## 方块状态色：死锁警示 > 已入槽点亮 > 常态。
func _box_color(cell: Vector2i) -> Color:
	var board := GameState.board
	if board.is_deadlocked_cell(cell):
		return DEADLOCK_COLOR
	return BOX_ON_TARGET_COLOR if board.is_lit(cell) else BOX_COLOR


func _tween_box(node: Polygon2D, cell: Vector2i) -> void:
	var target := _tile_center(cell)
	if node.position.distance_to(target) <= 1.0:
		return
	var previous: Tween = _box_tweens.get(node.get_instance_id()) as Tween
	if previous != null and previous.is_valid():
		previous.kill()  # 同一节点的旧补间作废，避免两个补间抢位置
	var tween := create_tween()
	tween.tween_property(node, "position", target, float(GameState.PUSH_ANIM_MS) / 1000.0)
	_box_tweens[node.get_instance_id()] = tween


func _kill_box_tweens() -> void:
	for value: Variant in _box_tweens.values():
		var tween := value as Tween
		if tween != null and tween.is_valid():
			tween.kill()
	_box_tweens = {}


## 格子中心（本节点局部坐标；_add_tile 与推动补间共用，保证同一套落点推导）。
func _tile_center(cell: Vector2i) -> Vector2:
	var half: float = float(CELL) / 2.0
	return Vector2(cell) * float(CELL) + Vector2(half, half)


func _add_tile(cell: Vector2i, inset: float, color: Color) -> Polygon2D:
	var tile := Polygon2D.new()
	tile.color = color
	var half: float = float(CELL) / 2.0 - inset
	tile.position = _tile_center(cell)
	tile.polygon = PackedVector2Array([
		Vector2(-half, -half), Vector2(half, -half), Vector2(half, half), Vector2(-half, half),
	])
	add_child(tile)
	return tile
