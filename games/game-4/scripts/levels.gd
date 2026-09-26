class_name LevelSet
extends RefCounted
## 关卡数据表（单一事实源）：首发渐难 10 关，难度递进（网格 5x5 → 7x6、
## 管数 1 → 13、第 5 关起引入分光三通 tee、墙体数量与路径长度同步增长）。
##
## 数据约定：
##   source_cell/source_dir —— 光源所在格与射出方向（PuzzleLogic 方向编码）；
##   sink_cell/sink_open    —— 终点所在格与开口方向（光行进方向的反向 = sink_open 时接收）；
##   walls                  —— 墙体（阻挡物，光进入即中断，不可旋转、不可穿透）；
##   pipes                  —— 可旋转管道：init_rot = 关卡初始朝向，target_rot = 最优解朝向；
##   par                    —— 参考步数（最优解）= Σ min_clicks_between(朝向类型, init_rot,
##                             target_rot)，由 par_of() 推导，不手填（手填会与朝向数据漂移）；
##                             直管按 180° 等效朝向计步（spec.numeric 拍板 ①，见 PuzzleLogic）。
##
## 已推演约束（冒烟场景 levels 契约断言机判，全部 10 关逐关检查）：
##   1) 所有管子转到 target_rot 后 propagate 必 solved（关卡有解）；
##   2) 初始朝向下 propagate 必不 solved（关卡未提前通关）；
##   3) par > 0，且 par 随关卡序号非递减（难度梯度机判）。
##
## spec.numeric 拍板落地（2026-09-27，依据 qa/tuning-data.json + qa/TUNING_NOTES.md §二）：
##   - 参考步数修真：par_of 改用等效朝向感知计步（拍板项 ①），星级阈值随真 par 收敛；
##   - 难度曲线回正：修真后第 4/5/8 关 par 回落（8→6 / 6→8 倒挂、10→9），仅调整这三关
##     部分管子的 init_rot（初始朝向，不动 target_rot / 布局 / 墙体），把参考步数曲线
##     抬回非递减：[1, 2, 8, 8, 8, 8, 10, 10, 11, 12]。
##   - 附注：有界 BFS 搜索在个别关（如「分光三通」）能找到比「各管转到 target_rot」
##     更短的替代走法；par 口径 = 设计解朝向的最少点击数，玩家用更少步数通关仍得 3 星，
##     与「星级只升不降」不冲突。逐关实测数据见 qa/tuning-data.json。

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
		"name": "三连直道",
		"w": 5, "h": 5,
		"source_cell": Vector2i(0, 2), "source_dir": 1,
		"sink_cell": Vector2i(4, 2), "sink_open": 3,
		"walls": [Vector2i(2, 0), Vector2i(2, 4)],
		"pipes": [
			{"cell": Vector2i(1, 2), "type": "straight", "init_rot": 3, "target_rot": 0},
			{"cell": Vector2i(2, 2), "type": "straight", "init_rot": 2, "target_rot": 0},
			{"cell": Vector2i(3, 2), "type": "straight", "init_rot": 3, "target_rot": 0},
		],
	},
	{
		"name": "转角初见",
		"w": 5, "h": 5,
		"source_cell": Vector2i(0, 2), "source_dir": 1,
		"sink_cell": Vector2i(4, 2), "sink_open": 3,
		"walls": [Vector2i(2, 2)],
		"pipes": [
			{"cell": Vector2i(1, 2), "type": "corner", "init_rot": 1, "target_rot": 3},
			{"cell": Vector2i(1, 1), "type": "corner", "init_rot": 0, "target_rot": 1},
			{"cell": Vector2i(2, 1), "type": "straight", "init_rot": 3, "target_rot": 0},
			{"cell": Vector2i(3, 1), "type": "corner", "init_rot": 0, "target_rot": 2},
			{"cell": Vector2i(3, 2), "type": "corner", "init_rot": 2, "target_rot": 0},
		],
	},
	{
		"name": "绕墙而行",
		"w": 5, "h": 5,
		"source_cell": Vector2i(0, 4), "source_dir": 1,
		"sink_cell": Vector2i(4, 0), "sink_open": 3,
		"walls": [Vector2i(2, 1), Vector2i(2, 2), Vector2i(2, 3)],
		"pipes": [
			{"cell": Vector2i(1, 4), "type": "straight", "init_rot": 3, "target_rot": 0},
			{"cell": Vector2i(2, 4), "type": "straight", "init_rot": 3, "target_rot": 0},
			{"cell": Vector2i(3, 4), "type": "corner", "init_rot": 1, "target_rot": 3},
			{"cell": Vector2i(3, 3), "type": "straight", "init_rot": 0, "target_rot": 1},
			{"cell": Vector2i(3, 2), "type": "straight", "init_rot": 2, "target_rot": 1},
			{"cell": Vector2i(3, 1), "type": "straight", "init_rot": 0, "target_rot": 1},
			{"cell": Vector2i(3, 0), "type": "corner", "init_rot": 0, "target_rot": 1},
		],
	},
	{
		"name": "分光三通",
		"w": 5, "h": 5,
		"source_cell": Vector2i(2, 0), "source_dir": 2,
		"sink_cell": Vector2i(4, 4), "sink_open": 0,
		"walls": [Vector2i(3, 1), Vector2i(1, 2)],
		"pipes": [
			{"cell": Vector2i(2, 1), "type": "straight", "init_rot": 0, "target_rot": 1},
			{"cell": Vector2i(2, 2), "type": "tee", "init_rot": 0, "target_rot": 2},
			{"cell": Vector2i(2, 3), "type": "corner", "init_rot": 2, "target_rot": 0},
			{"cell": Vector2i(3, 3), "type": "straight", "init_rot": 1, "target_rot": 0},
			{"cell": Vector2i(4, 3), "type": "corner", "init_rot": 0, "target_rot": 2},
		],
	},
	{
		"name": "双折回廊",
		"w": 6, "h": 5,
		"source_cell": Vector2i(0, 2), "source_dir": 1,
		"sink_cell": Vector2i(5, 2), "sink_open": 3,
		"walls": [Vector2i(3, 2), Vector2i(1, 4)],
		"pipes": [
			{"cell": Vector2i(1, 2), "type": "corner", "init_rot": 2, "target_rot": 3},
			{"cell": Vector2i(1, 1), "type": "straight", "init_rot": 0, "target_rot": 1},
			{"cell": Vector2i(1, 0), "type": "corner", "init_rot": 0, "target_rot": 1},
			{"cell": Vector2i(2, 0), "type": "straight", "init_rot": 2, "target_rot": 0},
			{"cell": Vector2i(3, 0), "type": "straight", "init_rot": 3, "target_rot": 0},
			{"cell": Vector2i(4, 0), "type": "corner", "init_rot": 1, "target_rot": 2},
			{"cell": Vector2i(4, 1), "type": "straight", "init_rot": 0, "target_rot": 1},
			{"cell": Vector2i(4, 2), "type": "corner", "init_rot": 2, "target_rot": 0},
		],
	},
	{
		"name": "分光择路",
		"w": 6, "h": 5,
		"source_cell": Vector2i(0, 0), "source_dir": 1,
		"sink_cell": Vector2i(5, 4), "sink_open": 0,
		"walls": [Vector2i(2, 2), Vector2i(4, 1), Vector2i(0, 3)],
		"pipes": [
			{"cell": Vector2i(1, 0), "type": "straight", "init_rot": 3, "target_rot": 0},
			{"cell": Vector2i(2, 0), "type": "corner", "init_rot": 1, "target_rot": 2},
			{"cell": Vector2i(2, 1), "type": "tee", "init_rot": 3, "target_rot": 0},
			{"cell": Vector2i(3, 1), "type": "corner", "init_rot": 2, "target_rot": 3},
			{"cell": Vector2i(3, 0), "type": "corner", "init_rot": 0, "target_rot": 1},
			{"cell": Vector2i(4, 0), "type": "straight", "init_rot": 3, "target_rot": 0},
			{"cell": Vector2i(5, 0), "type": "corner", "init_rot": 1, "target_rot": 2},
			{"cell": Vector2i(5, 1), "type": "straight", "init_rot": 0, "target_rot": 1},
			{"cell": Vector2i(5, 2), "type": "straight", "init_rot": 0, "target_rot": 1},
			{"cell": Vector2i(5, 3), "type": "straight", "init_rot": 0, "target_rot": 1},
		],
	},
	{
		"name": "回环折阵",
		"w": 7, "h": 5,
		"source_cell": Vector2i(0, 2), "source_dir": 1,
		"sink_cell": Vector2i(6, 2), "sink_open": 3,
		"walls": [Vector2i(3, 2), Vector2i(5, 1), Vector2i(5, 3), Vector2i(1, 0)],
		"pipes": [
			{"cell": Vector2i(1, 2), "type": "corner", "init_rot": 1, "target_rot": 3},
			{"cell": Vector2i(1, 1), "type": "corner", "init_rot": 0, "target_rot": 1},
			{"cell": Vector2i(2, 1), "type": "straight", "init_rot": 3, "target_rot": 0},
			{"cell": Vector2i(3, 1), "type": "straight", "init_rot": 3, "target_rot": 0},
			{"cell": Vector2i(4, 1), "type": "corner", "init_rot": 1, "target_rot": 2},
			{"cell": Vector2i(4, 2), "type": "tee", "init_rot": 0, "target_rot": 3},
			{"cell": Vector2i(5, 2), "type": "straight", "init_rot": 1, "target_rot": 0},
		],
	},
	{
		"name": "长蛇引光",
		"w": 7, "h": 6,
		"source_cell": Vector2i(0, 5), "source_dir": 1,
		"sink_cell": Vector2i(6, 0), "sink_open": 2,
		"walls": [Vector2i(2, 3), Vector2i(3, 1), Vector2i(5, 4), Vector2i(1, 1)],
		"pipes": [
			{"cell": Vector2i(1, 5), "type": "straight", "init_rot": 3, "target_rot": 0},
			{"cell": Vector2i(2, 5), "type": "straight", "init_rot": 3, "target_rot": 0},
			{"cell": Vector2i(3, 5), "type": "straight", "init_rot": 3, "target_rot": 0},
			{"cell": Vector2i(4, 5), "type": "corner", "init_rot": 2, "target_rot": 3},
			{"cell": Vector2i(4, 4), "type": "straight", "init_rot": 0, "target_rot": 1},
			{"cell": Vector2i(4, 3), "type": "straight", "init_rot": 2, "target_rot": 1},
			{"cell": Vector2i(4, 2), "type": "corner", "init_rot": 0, "target_rot": 1},
			{"cell": Vector2i(5, 2), "type": "straight", "init_rot": 3, "target_rot": 0},
			{"cell": Vector2i(6, 2), "type": "corner", "init_rot": 1, "target_rot": 3},
			{"cell": Vector2i(6, 1), "type": "straight", "init_rot": 0, "target_rot": 1},
		],
	},
	{
		"name": "终局光阵",
		"w": 7, "h": 6,
		"source_cell": Vector2i(0, 0), "source_dir": 1,
		"sink_cell": Vector2i(6, 0), "sink_open": 2,
		"walls": [
			Vector2i(3, 2), Vector2i(0, 2), Vector2i(4, 0), Vector2i(1, 4),
			Vector2i(3, 5), Vector2i(5, 0),
		],
		"pipes": [
			{"cell": Vector2i(1, 0), "type": "straight", "init_rot": 3, "target_rot": 0},
			{"cell": Vector2i(2, 0), "type": "corner", "init_rot": 1, "target_rot": 2},
			{"cell": Vector2i(2, 1), "type": "straight", "init_rot": 0, "target_rot": 1},
			{"cell": Vector2i(2, 2), "type": "tee", "init_rot": 1, "target_rot": 0},
			{"cell": Vector2i(2, 3), "type": "straight", "init_rot": 3, "target_rot": 1},
			{"cell": Vector2i(2, 4), "type": "corner", "init_rot": 0, "target_rot": 0},
			{"cell": Vector2i(3, 4), "type": "straight", "init_rot": 0, "target_rot": 0},
			{"cell": Vector2i(4, 4), "type": "corner", "init_rot": 0, "target_rot": 3},
			{"cell": Vector2i(4, 3), "type": "straight", "init_rot": 0, "target_rot": 1},
			{"cell": Vector2i(4, 2), "type": "corner", "init_rot": 1, "target_rot": 1},
			{"cell": Vector2i(5, 2), "type": "straight", "init_rot": 3, "target_rot": 0},
			{"cell": Vector2i(6, 2), "type": "corner", "init_rot": 2, "target_rot": 3},
			{"cell": Vector2i(6, 1), "type": "straight", "init_rot": 1, "target_rot": 1},
		],
	},
]


## 关卡总数。
static func count() -> int:
	return LEVELS.size()


## 越界安全的关卡读取。
static func level_at(index: int) -> Dictionary:
	return LEVELS[clampi(index, 0, LEVELS.size() - 1)]


## 参考步数（最优解 par）：每管从 init_rot 转到 target_rot 的最少点击数之和
## （直管按 180° 等效朝向计步，见 PuzzleLogic.min_clicks_between）。
static func par_of(level: Dictionary) -> int:
	var total: int = 0
	for pipe: Dictionary in level["pipes"]:
		total += PuzzleLogic.min_clicks_between(
			pipe["type"], int(pipe["init_rot"]), int(pipe["target_rot"]))
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
