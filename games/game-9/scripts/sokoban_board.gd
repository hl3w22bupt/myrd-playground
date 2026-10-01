class_name SokobanBoard
extends RefCounted
## 推箱子棋盘纯逻辑：解析 ASCII 关卡、推动判定、点亮状态、快照（Undo 用）。
##
## 这一层不持有任何节点 —— 状态与规则集中于此，无头冒烟可以直接构造并逐条断言
## （需求 AC1 推动规则、AC2 点亮与通关、AC3 撤销/重开都在这层可判定）。
##
## 规则（需求 cmupsx443003om9dh5dwd5w9u / spec.numeric）：
##   - 玩家每次移动 1 格（player.moveDistanceCells=1）；
##   - 目标格是墙 → 本次移动无效、角色不位移；
##   - 目标格是方块 → 方块前方是墙或另一方块 → 本次移动无效、双方均不位移；
##   - 方块只能推不能拉（block.pullable=false），推动同步移动 1 格（pushDistanceCells=1）；
##   - 方块进入接线槽（点亮目标格）该格立即点亮且保持常亮（lightOnEnterMs=0、onceLitStaysLit=true）；
##   - 全部接线槽都有方块驻留 = 通关（is_solved，与求解器/spec parMoves 同口径）。

const CHAR_WALL: String = "#"
const CHAR_FLOOR: String = "."
const CHAR_BOX: String = "$"
const CHAR_BOX_ON_TARGET: String = "*"
const CHAR_PLAYER: String = "@"
## spec 编码里 + 只表示接线槽（点亮目标格），不叠加玩家；玩家只有 @。
const CHAR_TARGET: String = "+"

## 网格尺寸（含墙），单位：格。
var size: Vector2i = Vector2i.ZERO
## 玩家所在格。
var player: Vector2i = Vector2i.ZERO
## 墙体 / 可行走地面 / 接线槽 / 蓄能方块 / 已点亮接线槽：Vector2i -> true。
var walls: Dictionary = {}
var floors: Dictionary = {}
var targets: Dictionary = {}
var boxes: Dictionary = {}
var lit: Dictionary = {}


## 从 ASCII 布局重建棋盘（Restart / 关卡切换都会走这里）。
func setup(layout: String) -> void:
	walls = {}
	floors = {}
	targets = {}
	boxes = {}
	lit = {}
	player = Vector2i.ZERO
	var lines: PackedStringArray = layout.split("\n")
	size = Vector2i(0, lines.size())
	for y: int in lines.size():
		var line: String = lines[y]
		size.x = maxi(size.x, line.length())
		for x: int in line.length():
			var cell := Vector2i(x, y)
			match line[x]:
				CHAR_WALL:
					walls[cell] = true
				CHAR_BOX:
					floors[cell] = true
					boxes[cell] = true
				CHAR_BOX_ON_TARGET:
					floors[cell] = true
					boxes[cell] = true
					targets[cell] = true
					lit[cell] = true
				CHAR_PLAYER:
					floors[cell] = true
					player = cell
				CHAR_TARGET:
					floors[cell] = true
					targets[cell] = true
				CHAR_FLOOR:
					floors[cell] = true
				_:
					pass  # 其余字符（空白/布局外）按不可通行区域处理


func is_wall(cell: Vector2i) -> bool:
	return walls.has(cell)


## 该格是否可站人 / 可被方块占用（布局内非墙格）。
func is_playable(cell: Vector2i) -> bool:
	return floors.has(cell)


func box_count() -> int:
	return boxes.size()


func target_count() -> int:
	return targets.size()


func lit_count() -> int:
	return lit.size()


## 通关判定：全部接线槽都有方块驻留（合闸完成）。
##
## 判据口径必须与策划案 AC4 / parMoves 的求解器（tools/level_solver.py）一致：
## 「每关存在一条把所有方块推上接线槽的通关路径」，最优步数以驻留口径计。
## 点亮（lit）是入场即常亮的视觉记忆（onceLitStaysLit），方块被推离后该槽依然亮着，
## 但不参与通关判定 —— 否则最优路径中途「全部点亮过一次」就会被误判通关提前停走
## （level-05 见证解第 35 步即触发，冒烟回放断言实测拦下）。
func is_solved() -> bool:
	if targets.is_empty():
		return false
	for cell: Variant in targets:
		if not boxes.has(cell):
			return false
	return true


func is_lit(cell: Vector2i) -> bool:
	return lit.has(cell)


## 角死锁判定（单格）：该格上的方块被两面正交的不可通行格夹住且不在接线槽上。
##
## 可靠性论证（无假阳性，冒烟负例断言依赖它）：推箱子的唯一失败态是「局面已不可通关」，
## 这里只判可证明无解的情形 —— 方块要被推动，玩家必须站在推方向的另一侧、且目标格可通行；
## 若方块上/下任一侧与左/右任一侧都不可通行（角），则上下两个推方向的目标格是墙、
## 左右两个推方向的发力位是墙，四个方向全部不可能，方块永远无法再动。
## 不在槽上的角死锁方块 ⇒ 本关再无通关路径。
func is_deadlocked_cell(cell: Vector2i) -> bool:
	if not boxes.has(cell) or targets.has(cell):
		return false
	var vertical_blocked := not is_playable(cell + Vector2i.UP) or not is_playable(cell + Vector2i.DOWN)
	var horizontal_blocked := not is_playable(cell + Vector2i.LEFT) or not is_playable(cell + Vector2i.RIGHT)
	return vertical_blocked and horizontal_blocked


## 本局是否已死锁：存在一个不在接线槽上的角死锁方块（AC 口径的「失败反馈」依据）。
func is_deadlocked() -> bool:
	for cell: Variant in boxes:
		if is_deadlocked_cell(cell):
			return true
	return false


## 尝试向 dir 移动 1 格。返回 true = 本次移动生效（含推动）。
func try_move(dir: Vector2i) -> bool:
	if is_solved():
		return false  # 通关后停住，等玩家选择下一关 / 重开
	var next_cell := player + dir
	if not is_playable(next_cell):
		return false
	if boxes.has(next_cell):
		var box_next := next_cell + dir
		if not is_playable(box_next) or boxes.has(box_next):
			return false  # 方块被顶到墙或另一方块：本次移动无效，双方均不位移
		boxes.erase(next_cell)
		boxes[box_next] = true
		if targets.has(box_next):
			lit[box_next] = true  # 合闸：立即点亮且保持常亮
	player = next_cell
	return true


## 撤销用快照：角色、方块、点亮状态（步数由 GameState 一并存取）。
func snapshot() -> Dictionary:
	return {
		"player": player,
		"boxes": boxes.keys(),
		"lit": lit.keys(),
	}


func restore(data: Dictionary) -> void:
	player = data["player"]
	boxes = {}
	for cell: Variant in data["boxes"]:
		boxes[cell] = true
	lit = {}
	for cell: Variant in data["lit"]:
		lit[cell] = true
