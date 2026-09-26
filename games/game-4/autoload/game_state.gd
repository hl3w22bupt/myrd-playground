extends Node
## 自动加载单例（autoload）：光路谜阵 的跨场景全局状态。
##
## 注册方式：project.godot 的 [autoload] 段写 `GameState="*res://autoload/game_state.gd"`。
## 规范（见技能包 SKILL.md「GDScript 规范」）：
## - autoload 只放「状态 + 纯逻辑」，不放场景/节点引用；
## - 跨场景通信一律走信号，禁止 autoload 反向持有场景节点。

## 步数变化（每旋转一次管道 +1，重开归零）。
signal moves_changed(moves: int)
## 关卡切换（含重开当前关：同一信号，订阅方按 index 重建棋盘）。
signal level_changed(level_index: int)
## 通关（参数：本关星数 1~3、步数、最优解步数）。
signal level_solved(stars: int, moves: int, par: int)

const SAVE_PATH: String = "user://guanglu_save.cfg"
## 存档版本：字段结构变化时 +1，旧档直接丢弃重开档。
const SAVE_VERSION: int = 1

var level_index: int = 0
var moves: int = 0
var solved: bool = false
## 各关历史最高星级（只升不降，本地存档）。
var best_stars: Dictionary = {}


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
		_record_stars(level_index, stars)
		level_solved.emit(stars, moves, par)
		return stars
	return 0


## 星级只升不降（需求 §星级规则），写入内存并存档。
func _record_stars(index: int, stars: int) -> void:
	var previous: int = best_stars.get(index, 0)
	if stars > previous:
		best_stars[index] = stars
		save()


func save() -> void:
	var config := ConfigFile.new()
	config.set_value("meta", "version", SAVE_VERSION)
	var encoded: Dictionary = {}
	for index: int in best_stars:
		encoded[str(index)] = best_stars[index]
	config.set_value("progress", "best_stars", encoded)
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
