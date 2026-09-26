class_name LevelSet
extends RefCounted
## 关卡数据表（单一事实源）：scaffold 首发渐难 3 关，后续迭代在此追加。
##
## 数据约定：
##   source_cell/source_dir —— 光源所在格与射出方向（PuzzleLogic 方向编码）；
##   sink_cell/sink_open    —— 终点所在格与开口方向（光行进方向的反向 = sink_open 时接收）；
##   walls                  —— 墙体（阻挡物，光进入即中断，不可旋转）；
##   pipes                  —— 可旋转管道：init_rot = 关卡初始朝向，target_rot = 最优解朝向；
##   par                    —— 最优解总步数 = Σ clicks_between(init_rot, target_rot)，由
##                             par_of() 推导，不手填（手填会与朝向数据漂移）。
##
## 已推演约束（冒烟场景 levels 契约断言机判）：
##   1) 所有管子转到 target_rot 后 propagate 必 solved（关卡有解）；
##   2) 初始朝向下 propagate 必不 solved（关卡未提前通关）。

const LEVELS: Array[Dictionary] = [
	{
		"name": "初试光线",
		"w": 5, "h": 5,
		"source_cell": Vector2i(0, 2), "source_dir": 1,
		"sink_cell": Vector2i(2, 2), "sink_open": 3,
		"walls": [],
		"pipes": [
			{"cell": Vector2i(1, 2), "type": "straight", "init_rot": 3, "target_rot": 0},
		],
	},
	{
		"name": "峰回路转",
		"w": 5, "h": 5,
		"source_cell": Vector2i(0, 2), "source_dir": 1,
		"sink_cell": Vector2i(4, 2), "sink_open": 3,
		"walls": [Vector2i(2, 2)],
		"pipes": [
			{"cell": Vector2i(1, 2), "type": "corner", "init_rot": 0, "target_rot": 3},
			{"cell": Vector2i(1, 1), "type": "corner", "init_rot": 0, "target_rot": 1},
			{"cell": Vector2i(2, 1), "type": "straight", "init_rot": 3, "target_rot": 0},
			{"cell": Vector2i(3, 1), "type": "corner", "init_rot": 0, "target_rot": 2},
			{"cell": Vector2i(3, 2), "type": "corner", "init_rot": 2, "target_rot": 0},
		],
	},
	{
		"name": "回环折阵",
		"w": 5, "h": 5,
		"source_cell": Vector2i(0, 0), "source_dir": 1,
		"sink_cell": Vector2i(2, 4), "sink_open": 3,
		"walls": [Vector2i(2, 1), Vector2i(2, 3)],
		"pipes": [
			{"cell": Vector2i(1, 0), "type": "straight", "init_rot": 1, "target_rot": 0},
			{"cell": Vector2i(2, 0), "type": "straight", "init_rot": 3, "target_rot": 0},
			{"cell": Vector2i(3, 0), "type": "corner", "init_rot": 0, "target_rot": 2},
			{"cell": Vector2i(3, 1), "type": "straight", "init_rot": 0, "target_rot": 1},
			{"cell": Vector2i(3, 2), "type": "corner", "init_rot": 1, "target_rot": 3},
			{"cell": Vector2i(2, 2), "type": "straight", "init_rot": 2, "target_rot": 0},
			{"cell": Vector2i(1, 2), "type": "corner", "init_rot": 3, "target_rot": 1},
			{"cell": Vector2i(1, 3), "type": "straight", "init_rot": 3, "target_rot": 1},
			{"cell": Vector2i(1, 4), "type": "corner", "init_rot": 1, "target_rot": 0},
		],
	},
]


## 关卡总数。
static func count() -> int:
	return LEVELS.size()


## 越界安全的关卡读取。
static func level_at(index: int) -> Dictionary:
	return LEVELS[clampi(index, 0, LEVELS.size() - 1)]


## 最优解步数（par）：每管从 init_rot 顺时针转到 target_rot 的点击数之和。
static func par_of(level: Dictionary) -> int:
	var total: int = 0
	for pipe: Dictionary in level["pipes"]:
		total += PuzzleLogic.clicks_between(pipe["init_rot"], pipe["target_rot"])
	return total


## 组装棋盘状态（cells 字典，供 PuzzleLogic.propagate 消费）。
## use_target=true 时全部管子取 target_rot（关卡可解性契约断言用）；
## use_target=false 时取 init_rot（真实开局状态）。
static func build_cells(level: Dictionary, use_target: bool) -> Dictionary:
	var cells: Dictionary = {}
	for y: int in range(level["h"]):
		for x: int in range(level["w"]):
			cells[Vector2i(x, y)] = {"type": PuzzleLogic.TYPE_EMPTY, "rot": 0}
	cells[level["source_cell"]] = {"type": PuzzleLogic.TYPE_SOURCE, "rot": 0}
	cells[level["sink_cell"]] = {"type": PuzzleLogic.TYPE_SINK, "rot": 0}
	for wall: Vector2i in level["walls"]:
		cells[wall] = {"type": PuzzleLogic.TYPE_WALL, "rot": 0}
	for pipe: Dictionary in level["pipes"]:
		var rot: int = pipe["target_rot"] if use_target else pipe["init_rot"]
		cells[pipe["cell"]] = {"type": pipe["type"], "rot": rot}
	return cells
