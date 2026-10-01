extends Node
## 自动加载单例（autoload）：关卡索引、棋盘状态、步数、撤销历史与胜负判定。
##
## 注册方式：project.godot 的 [autoload] 段写 `GameState="*res://autoload/game_state.gd"`。
## `*` 前缀 = 单例模式；脚本必须 extends Node，且不得声明 class_name（会与单例名冲突）。
##
## 规范（godot-game-dev SKILL.md）：
## - autoload 只放「状态 + 纯逻辑」（棋盘规则在 SokobanBoard），不持有场景节点；
## - 场景层（Main / BoardView / Player）订阅这里的信号刷新自己，反向依赖为零；
## - 数值调参集中在这一个调参区，键名与策划案 spec.numeric 一一对应 —— 改数值先改 spec。

## 关卡载入 / 切换完成（index 已按关卡数取模）。
signal level_loaded(level_index: int)
## 棋盘变化：reset = true 表示整体复位（载入 / 重开 / 撤销），false 表示一次增量移动。
signal board_changed(reset: bool)
## 步数变化（角色每位移 1 格计 1 步，推动与普通移动同价）。
signal steps_changed(steps: int)
## 点亮进度变化（接线槽合计闸数 / 总数）。
signal lit_changed(lit_count: int, total: int)
## 本关通关（最后一个接线槽点亮）。
signal level_won(level_index: int, steps: int)
## 死锁状态变化：true = 本关已无通关路径（方块被顶进角），UI 据此给失败反馈。
signal deadlock_changed(deadlocked: bool)

# ── 调参区（与策划案 spec.numeric 对应，改数值先改 spec 再同步这里）──
## numeric.grid.cellSizePx：单格边长（像素）。
const CELL_SIZE_PX: int = 48
## numeric.grid.moveAnimMs：角色一步的移动动画时长。
const MOVE_ANIM_MS: int = 110
## numeric.grid.pushAnimMs：方块被推动一步的移动动画时长（与角色同节奏，推起来不脱节）。
const PUSH_ANIM_MS: int = 110
## numeric.input.keyRepeatIntervalMs：长按方向的重复步进间隔。
const KEY_REPEAT_INTERVAL_MS: int = 150
## numeric.undo.historyLimit：撤销历史上限（单步撤销，scope=single-step）。
const HISTORY_LIMIT: int = 1000
## numeric.win.overlayDelayMs：通关弹层延迟（≤ overlayMaxDelayMs=1000）。
const WIN_OVERLAY_DELAY_MS: int = 300
## 视口布局常量：棋盘原点（project.godot 视口 800x560，按最大 10 列棋盘水平居中、顶部留 HUD）。
const BOARD_ORIGIN_PX: Vector2 = Vector2(160.0, 60.0)

## 当前关卡下标（SokobanLevels.LEVELS 的下标）。
var level_index: int = 0
## 本关已走步数。
var steps: int = 0
## 本关是否已通关（通关后移动停住，Undo / Restart / 换关可离开该状态）。
var won: bool = false
## 本关是否已死锁（无可通关路径）；Undo / Restart / 换关会重新评估。
var deadlocked: bool = false
## 各关最佳（最少）步数记录：level_index -> steps。通关时写入，用于结算评级与 HUD 展示
## （spec.content.replayHooks：最优步数挑战 / 步数评级）。
var best_steps: Dictionary = {}
## 棋盘（纯逻辑，见 scripts/sokoban_board.gd）。
var board: SokobanBoard = SokobanBoard.new()

var _history: Array[Dictionary] = []


func level_count() -> int:
	return SokobanLevels.LEVELS.size()


func level_meta() -> Dictionary:
	return SokobanLevels.level_at(level_index)


## 载入关卡（index 溢出时环绕，关卡选择可循环）。完整复位：布局 / 步数 / 撤销历史 / 胜负。
func load_level(index: int) -> void:
	level_index = posmod(index, level_count())
	board.setup(SokobanLevels.level_at(level_index)["layout"])
	steps = 0
	won = false
	_history = []
	_set_deadlocked(board.is_deadlocked())
	level_loaded.emit(level_index)
	lit_changed.emit(board.lit_count(), board.target_count())
	steps_changed.emit(steps)
	board_changed.emit(true)


func restart() -> void:
	load_level(level_index)


func next_level() -> void:
	load_level(level_index + 1)


func prev_level() -> void:
	load_level(level_index - 1)


## 单步撤销：精确回退一步（角色 / 方块 / 点亮状态 / 步数四项同步还原）。
func undo() -> bool:
	if _history.is_empty():
		return false
	var snapshot: Dictionary = _history.pop_back()
	board.restore(snapshot)
	steps = snapshot["steps"]
	won = snapshot["won"]
	_set_deadlocked(board.is_deadlocked())
	steps_changed.emit(steps)
	lit_changed.emit(board.lit_count(), board.target_count())
	board_changed.emit(true)
	return true


## 玩家请求向 dir 移动 1 格。返回 true = 移动生效（含推动）。
## 步数 / 点亮 / 通关判定都在这里收口，UI 与角色动画只订阅信号。
func try_move(dir: Vector2i) -> bool:
	if won:
		return false
	var snapshot := board.snapshot()
	snapshot["steps"] = steps
	snapshot["won"] = won
	if not board.try_move(dir):
		return false
	_history.push_back(snapshot)
	if _history.size() > HISTORY_LIMIT:
		_history.remove_at(0)
	steps += 1
	steps_changed.emit(steps)
	board_changed.emit(false)
	if board.lit_count() != int(snapshot["lit"].size()):
		lit_changed.emit(board.lit_count(), board.target_count())
	_set_deadlocked(board.is_deadlocked())
	if board.is_solved():
		won = true
		_record_best_steps()
		level_won.emit(level_index, steps)
	return true


## 本关目标步数（spec.numeric.difficulty.parMoves）。
func level_par() -> int:
	return int(level_meta()["par_moves"])


## 步数评级（spec.content.replayHooks：≤par ⚡⚡⚡，≤par×1.5 ⚡⚡，其余 ⚡）。
func rating_for(steps_value: int, par: int) -> String:
	if steps_value <= par:
		return "⚡⚡⚡"
	if steps_value <= int(ceil(par * 1.5)):
		return "⚡⚡"
	return "⚡"


## 已通关关卡的最佳步数（未通关返回 -1）。
func best_steps_at(level: int) -> int:
	if best_steps.has(level):
		return int(best_steps[level])
	return -1


func _record_best_steps() -> void:
	var previous: int = best_steps_at(level_index)
	if previous < 0 or steps < previous:
		best_steps[level_index] = steps


## 死锁状态收口：只在变化时发信号，UI 侧不用每步轮询。
func _set_deadlocked(value: bool) -> void:
	if deadlocked == value:
		return
	deadlocked = value
	deadlock_changed.emit(deadlocked)
