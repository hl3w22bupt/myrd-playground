extends Node
## 自动加载单例（autoload）：光路谜阵 的跨场景全局状态。
##
## 注册方式：project.godot 的 [autoload] 段写 `GameState="*res://autoload/game_state.gd"`。
## 规范（见技能包 SKILL.md「GDScript 规范」）：
## - autoload 只放「状态 + 纯逻辑」，不放场景/节点引用；
## - 跨场景通信一律走信号，禁止 autoload 反向持有场景节点。

## 步数变化（每旋转一次管道 +1，撤销 -1，重开归零）。
signal moves_changed(moves: int)
## 关卡切换（含重开当前关：同一信号，订阅方按 index 重建棋盘）。
signal level_changed(level_index: int)
## 通关（参数：本关星数 1~3、步数、最优解步数）。
signal level_solved(stars: int, moves: int, par: int)
## 新解锁一关（参数：新解锁的关卡下标；用于 HUD 关卡条刷新与提示）。
signal level_unlocked(level_index: int)

const SAVE_PATH: String = "user://guanglu_save.cfg"
## 存档版本：字段结构变化时 +1，旧档直接丢弃重开档。
const SAVE_VERSION: int = 2

var level_index: int = 0
var moves: int = 0
var solved: bool = false
## 各关历史最高星级（只升不降，本地存档）。
var best_stars: Dictionary = {}
## 各关历史最少通关步数（0 = 尚未通关；本地存档，重玩刷星用）。
var best_moves: Dictionary = {}
## 已解锁的最大关卡下标（通关第 n 关解锁第 n+1 关；本地存档）。
var unlocked_max: int = 0


func _ready() -> void:
	load_save()


## 进入关卡（切关或重开共用）：步数清零、通关状态复位。
func start_level(index: int) -> void:
	level_index = clampi(index, 0, LevelSet.count() - 1)
	moves = 0
	solved = false
	level_changed.emit(level_index)
	moves_changed.emit(moves)


## 重开当前关（R 键 / 重开入口）。
func reset_level() -> void:
	start_level(level_index)


## 关卡是否已解锁（解锁进度门禁：第 n+1 关需先通关第 n 关）。
func is_unlocked(index: int) -> bool:
	return index >= 0 and index <= unlocked_max


## 请求进入关卡：锁着的关卡拒绝（返回 false，不切换、不 emit）。
func request_level(index: int) -> bool:
	if index < 0 or index >= LevelSet.count() or not is_unlocked(index):
		return false
	start_level(index)
	return true


## 通关后进入下一关；已是最后一关返回 false（不循环，结尾关卡给「全部通关」反馈）。
func advance_level() -> bool:
	return request_level(level_index + 1)


## 是否已到最后一关。
func is_last_level() -> bool:
	return level_index >= LevelSet.count() - 1


## 玩家旋转一次管道：步数 +1，并即时重算光路胜负。
## cells 为当前棋盘状态；命中终点返回星数（>0 表示本关首次判定通过）。
func register_rotation(cells: Dictionary, level: Dictionary) -> int:
	if solved:
		return 0
	moves += 1
	moves_changed.emit(moves)
	var par: int = LevelSet.par_of(level)
	var result: Dictionary = PuzzleLogic.propagate(
		cells, level["source_cell"], level["source_dir"], level["sink_open"])
	if result["solved"]:
		solved = true
		var stars: int = PuzzleLogic.stars_for(moves, par)
		_record_score(level_index, stars, moves)
		_unlock_next(level_index)
		level_solved.emit(stars, moves, par)
		return stars
	return 0


## 撤销一次旋转：步数 -1（下限 0），通关态不受影响（通关后由调用方屏蔽撤销）。
func register_undo() -> void:
	if moves <= 0:
		return
	moves -= 1
	moves_changed.emit(moves)


## 星级只升不降、步数纪录只减不增（需求 §星级规则），写入内存并存档。
func _record_score(index: int, stars: int, move_count: int) -> void:
	var previous_stars: int = best_stars.get(index, 0)
	var previous_moves: int = best_moves.get(index, 0)
	var dirty: bool = false
	if stars > previous_stars:
		best_stars[index] = stars
		dirty = true
	if previous_moves == 0 or move_count < previous_moves:
		best_moves[index] = move_count
		dirty = true
	if dirty:
		save()


## 通关第 index 关 → 解锁下一关（一次性 emit，重复通关不重复广播）。
func _unlock_next(index: int) -> void:
	var next_index: int = index + 1
	if next_index >= LevelSet.count() or next_index <= unlocked_max:
		return
	unlocked_max = next_index
	level_unlocked.emit(next_index)
	save()


## 清空本地进度（冒烟测试的密封开局用；也可作为玩家「重置存档」入口）。
func reset_progress() -> void:
	best_stars.clear()
	best_moves.clear()
	unlocked_max = 0
	save()


func save() -> void:
	var config := ConfigFile.new()
	config.set_value("meta", "version", SAVE_VERSION)
	config.set_value("progress", "best_stars", _encode_indexed(best_stars))
	config.set_value("progress", "best_moves", _encode_indexed(best_moves))
	config.set_value("progress", "unlocked_max", unlocked_max)
	config.save(SAVE_PATH)


func load_save() -> void:
	var config := ConfigFile.new()
	if config.load(SAVE_PATH) != OK:
		return
	if int(config.get_value("meta", "version", 0)) != SAVE_VERSION:
		return
	var encoded: Dictionary = config.get_value("progress", "best_stars", {})
	for key: String in encoded:
		best_stars[int(key)] = int(encoded[key])
	var encoded_moves: Dictionary = config.get_value("progress", "best_moves", {})
	for key_moves: String in encoded_moves:
		best_moves[int(key_moves)] = int(encoded_moves[key_moves])
	unlocked_max = clampi(int(config.get_value("progress", "unlocked_max", 0)), 0, LevelSet.count() - 1)


## Dictionary[int] -> Dictionary[String]（ConfigFile 只稳定支持字符串键）。
func _encode_indexed(source: Dictionary) -> Dictionary:
	var encoded: Dictionary = {}
	for index: int in source:
		encoded[str(index)] = source[index]
	return encoded
