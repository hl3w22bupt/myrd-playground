class_name PuzzleLogic
extends RefCounted
## 光路谜阵 纯玩法逻辑：元件开口、旋转、光束传播、星级规则。
##
## 不继承 Node、不持有场景引用 —— 全部是可无头机判的纯函数（冒烟场景直接调用断言）。
## 方向编码：0=上 1=右 2=下 3=左；DIR_VEC[i] = 该方向在网格上的步进向量。

const DIR_UP: int = 0
const DIR_RIGHT: int = 1
const DIR_DOWN: int = 2
const DIR_LEFT: int = 3

const DIR_VEC: Array[Vector2i] = [
	Vector2i(0, -1), Vector2i(1, 0), Vector2i(0, 1), Vector2i(-1, 0),
]

## 元件类型（与 levels.gd 的 "type" 字段对应）。
const TYPE_STRAIGHT: String = "straight"  # 直管：rot=0 时开口 [右, 左]
const TYPE_CORNER: String = "corner"      # 弯管：rot=0 时开口 [上, 右]
const TYPE_SOURCE: String = "source"      # 光源：固定，开口 = 射出方向
const TYPE_SINK: String = "sink"          # 终点接收器：固定，开口 = 接受方向
const TYPE_WALL: String = "wall"          # 墙：阻挡，光进入即中断
const TYPE_EMPTY: String = "empty"        # 空格：不导光，光进入即中断

## 各类型 rot=0 基准开口（顺时针旋转 r 次后开口 = (dir + r) % 4）。
const BASE_OPENINGS: Dictionary = {
	TYPE_STRAIGHT: [DIR_RIGHT, DIR_LEFT],
	TYPE_CORNER: [DIR_UP, DIR_RIGHT],
	TYPE_SOURCE: [DIR_RIGHT],
	TYPE_SINK: [DIR_LEFT],
	TYPE_WALL: [],
	TYPE_EMPTY: [],
}

## 元件朝向状态：type + rot（0~3）→ 当前开口集合。
static func openings_for(piece_type: String, rot: int) -> Array:
	var base: Array = BASE_OPENINGS.get(piece_type, [])
	var result: Array = []
	for dir: int in base:
		result.append((dir + rot) % 4)
	return result


## 顺时针旋转 90°（玩家每次点击 / confirm 只走一步）。
static func rotated_clockwise(rot: int) -> int:
	return (rot + 1) % 4


## 从初始朝向转到目标朝向所需的最少点击数（只允许顺时针，k ∈ {0,1,2,3}）。
static func clicks_between(init_rot: int, target_rot: int) -> int:
	return (target_rot - init_rot + 4) % 4


## 星级规则（需求 §星级规则）：
##   1 星 = 通关；2 星 = moves ≤ ceil(par × 1.5)；3 星 = 以最优解步数通关。
static func stars_for(moves: int, par: int) -> int:
	if moves <= par:
		return 3
	if moves <= int(ceil(par * 1.5)):
		return 2
	return 1


## 光束传播（BFS，支持多路分叉扩展）。
## cells: Dictionary[Vector2i] -> {type: String, rot: int}（关卡当前状态）。
## source_cell + source_dir：光从光源射出的方向。
## 返回 {solved: bool, segments: Array[[Vector2i, Vector2i]], hits_wall: bool}：
##   segments 为光束折线段（格中心坐标），供渲染层直接绘制。
static func propagate(cells: Dictionary, source_cell: Vector2i, source_dir: int, sink_open: int) -> Dictionary:
	var segments: Array = []
	var start: Vector2i = source_cell + DIR_VEC[source_dir]
	var queue: Array = [[start, source_dir]]
	var visited: Dictionary = {}
	var solved: bool = false
	var hits_wall: bool = false

	while not queue.is_empty():
		var entry: Array = queue.pop_front()
		var cell: Vector2i = entry[0]
		var travel_dir: int = entry[1]
		var key := Vector3i(cell.x, cell.y, travel_dir)
		if visited.has(key):
			continue
		visited[key] = true

		var piece: Dictionary = cells.get(cell, {})
		var piece_type: String = piece.get("type", TYPE_EMPTY)
		if piece_type == TYPE_SINK:
			# 终点：光行进方向的反向必须对准终点开口才算接收成功。
			segments.append([cell - DIR_VEC[travel_dir], cell])
			if (travel_dir + 2) % 4 == sink_open:
				solved = true
			continue
		if piece_type == TYPE_WALL or piece_type == TYPE_EMPTY:
			hits_wall = hits_wall or piece_type == TYPE_WALL
			segments.append([cell - DIR_VEC[travel_dir], cell])
			continue

		# 元件入口开口 = 光行进方向的反向；入口不通 → 光被外壳挡住。
		var openings: Array = openings_for(piece_type, piece.get("rot", 0))
		var entry_side: int = (travel_dir + 2) % 4
		if not (entry_side in openings):
			segments.append([cell - DIR_VEC[travel_dir], cell])
			continue

		segments.append([cell - DIR_VEC[travel_dir], cell])
		# 出口：直管 = 对向；弯管/多口 = 除入口外的全部开口（多路分叉天然支持）。
		for out_dir: int in openings:
			if out_dir == entry_side:
				continue
			var next_cell: Vector2i = cell + DIR_VEC[out_dir]
			queue.append([next_cell, out_dir])

	return {"solved": solved, "segments": segments, "hits_wall": hits_wall}
