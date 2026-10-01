class_name BoardView
extends Node2D
## 棋盘渲染：地面 / 墙体 / 接线槽（点亮态）/ 蓄能方块，全部 Polygon2D 色块，零外部素材。
##
## 只订阅 GameState 信号重绘自己，不持有玩法逻辑（规则都在 SokobanBoard）：
## - board_changed(true)（载入 / 重开 / 撤销 / 换关）→ 重建全部瓦片；
## - board_changed(false)（一次增量移动）→ 只刷新方块位置与接线槽点亮态。
## 玩家角色不在本视图里 —— 它是独立节点（Player），由 Main 负责复位对齐。

const CELL: int = GameState.CELL_SIZE_PX
const CELL_INSET: float = 2.0

const FLOOR_COLOR := Color(0.14, 0.15, 0.21)
const WALL_COLOR := Color(0.36, 0.4, 0.52)
const TARGET_OFF_COLOR := Color(0.2, 0.24, 0.34)
const TARGET_ON_COLOR := Color(1.0, 0.83, 0.28)
const BOX_COLOR := Color(0.33, 0.62, 1.0)
const BOX_ON_TARGET_COLOR := Color(1.0, 0.6, 0.14)

var _target_nodes: Dictionary = {}
var _box_nodes: Dictionary = {}


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
	for cell: Variant in board.boxes:
		var box := _add_tile(cell, 6.0, BOX_COLOR)
		_box_nodes[cell] = box
	_refresh()


## 只刷新动态外观：接线槽点亮色 + 方块位置（方块会移动，节点按当前棋盘重建，≤5 个）。
func _refresh() -> void:
	var board := GameState.board
	for cell: Variant in _target_nodes:
		var tile: Polygon2D = _target_nodes[cell]
		tile.color = TARGET_ON_COLOR if board.is_lit(cell) else TARGET_OFF_COLOR
	for cell: Variant in _box_nodes:
		var stale: Polygon2D = _box_nodes[cell]
		stale.queue_free()
	_box_nodes = {}
	for cell: Variant in board.boxes:
		var box := _add_tile(cell, 6.0, BOX_ON_TARGET_COLOR if board.is_lit(cell) else BOX_COLOR)
		_box_nodes[cell] = box


func _add_tile(cell: Vector2i, inset: float, color: Color) -> Polygon2D:
	var tile := Polygon2D.new()
	tile.color = color
	var half: float = float(CELL) / 2.0 - inset
	tile.position = Vector2(cell) * float(CELL) + Vector2(half + inset, half + inset)
	tile.polygon = PackedVector2Array([
		Vector2(-half, -half), Vector2(half, -half), Vector2(half, half), Vector2(-half, half),
	])
	add_child(tile)
	return tile
