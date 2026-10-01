class_name SokobanLevels
extends RefCounted
## 关卡数据（单一事实源：approved 版策划案 GameDesignSpec v1 的 levels[] 原样落盘）。
##
## 布局字符集（spec 约定）：# 墙 · . 地面 · $ 蓄能方块 · + 接线槽（点亮目标格）· @ 玩家。
## 每关的可解性与最优步数已由 tools/level_solver.py（BFS/A* 推箱求解器）离线验证：
## 求得的最优玩家步数与 par_moves 完全一致（2 / 10 / 18 / 40 / 58），不存在不可通关关卡。
##
## `solution` = 求解器给出的通关见证解（U/D/L/R 玩家移动串，长度 == par_moves），
## 由 tools/level_solver.py --paths 生成并经 Python 侧重放验证后落盘。
## 冒烟门禁（tests/smoke.gd）逐关回放见证解 —— AC4「每关存在通关路径」由此变成
## 引擎内机判，而不是只信离线工具的一句话结论。

const LEVELS: Array[Dictionary] = [
	{
		"id": "level-01",
		"name": "01 · 通电初试",
		"par_moves": 2,
		"grid": "7x5",
		"layout": "#######\n#.....#\n#.@$.+#\n#.....#\n#######",
		"solution": "RR",
	},
	{
		"id": "level-02",
		"name": "02 · 绕后接线",
		"par_moves": 10,
		"grid": "8x7",
		"layout": "########\n#......#\n#.@$.+.#\n#......#\n#.$..+.#\n#......#\n########",
		"solution": "RRDLLLDRRR",
	},
	{
		"id": "level-03",
		"name": "03 · 双轴调度",
		"par_moves": 18,
		"grid": "10x10",
		"layout": "##########\n#........#\n#.@$.....#\n#...$.+..#\n#...+....#\n#........#\n#.....$..#\n#........#\n#..+.....#\n##########",
		"solution": "URDDURDLDDDDRRRUUU",
	},
	{
		"id": "level-04",
		"name": "04 · 四路合闸",
		"par_moves": 40,
		"grid": "10x10",
		"layout": "##########\n#...+....#\n#.$....$.#\n#...+....#\n####..####\n#........#\n#..$..$..#\n#....@...#\n#.+....+.#\n##########",
		"solution": "URURDDLLLULULDDUURRUURRRRULLLULDLDLULURR",
	},
	{
		"id": "level-05",
		"name": "05 · 总控机房",
		"par_moves": 58,
		"grid": "9x8",
		"layout": "#########\n#.......#\n#.$.$.$.#\n#...@...#\n#.$.#.$.#\n#..#.#..#\n#.+++++.#\n#########",
		"solution": "LLDDLDRRLLUUUUURDDDDLDRUUURRRRDDRDLUULUUURDDDDULUULLULDDDD",
	},
]


static func level_at(index: int) -> Dictionary:
	return LEVELS[posmod(index, LEVELS.size())]


## 见证解移动串 → 方向向量序列（未认识的字符直接报解析错误，避免静默错位）。
static func parse_solution(moves: String) -> Array[Vector2i]:
	var directions: Array[Vector2i] = []
	for move: String in moves:
		match move:
			"U":
				directions.append(Vector2i.UP)
			"D":
				directions.append(Vector2i.DOWN)
			"L":
				directions.append(Vector2i.LEFT)
			"R":
				directions.append(Vector2i.RIGHT)
			_:
				push_error("SokobanLevels.parse_solution：未知移动字符 %s" % move)
				return []
	return directions
