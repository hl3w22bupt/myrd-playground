extends Node
## 《牛牛打游戏》全局状态单例（autoload）：收集进度 / 限时胜负 / 本地持久化。
##
## 注册方式：project.godot 的 [autoload] 段写 `GameState="*res://autoload/game_state.gd"`。
## 规范要点（见 SKILL.md「GDScript 规范」）：
## - autoload 只放「状态 + 纯逻辑」，不持有任何场景节点；
## - 对外只发信号（score_changed / time_changed / phase_changed / best_changed），
##   场景层（main.gd）订阅它们刷新 UI，禁止反向轮询 UI；
## - 数值调参集中在下方常量区（对应需求验收基线：目标 20 个 / 限时 60 秒），
##   改数值 = 改这里，不改玩法代码。

## 单局阶段：进行中 / 通关 / 失败。
enum Phase { RUNNING, WON, LOST }

## ── 数值调参区 ──
## 单局目标收集量（需求验收基线 3：收集 20 个即通关）。
const TARGET_SCORE: int = 20
## 单局时限秒数（需求验收基线 3：限时 60 秒）。
const TIME_LIMIT: float = 60.0
## 场上同屏可收集物上限（少于该数时由生成器补充）。
const MAX_COLLECTIBLES: int = 6
## 可收集物补充刷新间隔秒数（开局值；随难度梯度收紧到 SPAWN_INTERVAL_MIN）。
const SPAWN_INTERVAL_START: float = 0.8
## 刷新间隔下限（难度封顶时的值，保证后期仍可读、可反应）。
const SPAWN_INTERVAL_MIN: float = 0.45
## 可收集物寿命（开局值，秒）：超时未收集即过期消失，逼玩家主动追着收。
const LIFETIME_START: float = 6.0
## 可收集物寿命下限（秒）：难度封顶时仍留出可追的距离。
const LIFETIME_MIN: float = 3.0
## 物品临期闪烁警示的剩余寿命阈值（秒）。
const LIFETIME_WARN_SECONDS: float = 1.5
## 持久化文件（收集进度与历史最高分）。
const SAVE_PATH: String = "user://niuniu_game8_save.json"

## 本局阶段。
var phase: int = Phase.RUNNING
## 本局已收集数量。
var score: int = 0
## 本局剩余时间（秒）。
var time_left: float = TIME_LIMIT
## 历史最高单局收集数（持久化）。
var best_score: int = 0
## 累计收集总数（持久化，跨局累加）。
var total_collected: int = 0

## 收集计数变化：场景层订阅它刷新 HUD 计数。
signal score_changed(score: int)
## 剩余时间变化：场景层订阅它刷新倒计时。
signal time_changed(time_left: float)
## 胜负阶段变化：场景层订阅它弹出/收起结算面板。
signal phase_changed(phase: int)
## 历史最佳变化：场景层订阅它刷新最佳成绩展示。
signal best_changed(best: int)


func _ready() -> void:
	load_progress()


## 收集判定计数入口：由场景层在「角色触碰到可收集物」时调用。
## 非进行中阶段忽略（结算面板弹出后不再计数），达标即判定通关。
func add_score(amount: int) -> void:
	if phase != Phase.RUNNING:
		return
	score += amount
	total_collected += amount
	score_changed.emit(score)
	if score >= TARGET_SCORE:
		_set_phase(Phase.WON)


## 限时推进入口：由主场景每帧调用（仅进行中阶段消耗时间），归零即判定失败。
func tick_time(delta: float) -> void:
	if phase != Phase.RUNNING:
		return
	time_left = maxf(time_left - delta, 0.0)
	time_changed.emit(time_left)
	if time_left <= 0.0:
		_set_phase(Phase.LOST)


## 一键重开：清零本局进度并回到进行中（场景层负责重置场上实体与角色位置）。
func start_run() -> void:
	score = 0
	time_left = TIME_LIMIT
	phase = Phase.RUNNING
	score_changed.emit(score)
	time_changed.emit(time_left)
	phase_changed.emit(phase)


## ── 难度梯度 ──
## 以「本局已收集数」为自变量的线性爬坡：0 → 宽松（开局值），TARGET_SCORE → 紧张（下限值）。
## 做成纯函数便于冒烟无头断言（难度单调递增、有界），也便于后续数值表化。
func difficulty_ratio() -> float:
	return clampf(float(score) / float(maxi(TARGET_SCORE - 1, 1)), 0.0, 1.0)


## 当前难度下的可收集物补充刷新间隔（秒）：收集越多刷得越快，节奏逐级收紧。
func spawn_interval_now() -> float:
	return lerpf(SPAWN_INTERVAL_START, SPAWN_INTERVAL_MIN, difficulty_ratio())


## 当前难度下新生成可收集物的寿命（秒）：收集越少留存越久，后期必须主动追着收。
func collectible_lifetime_now() -> float:
	return lerpf(LIFETIME_START, LIFETIME_MIN, difficulty_ratio())


func _set_phase(next_phase: int) -> void:
	if phase == next_phase:
		return
	phase = next_phase
	if next_phase != Phase.RUNNING:
		_record_run_result()
	phase_changed.emit(phase)


## 结算：刷新历史最佳并落盘（通关与失败都结算，失败也保留已收集的累计进度）。
func _record_run_result() -> void:
	if score > best_score:
		best_score = score
		best_changed.emit(best_score)
	save_progress()


## 本地持久化：收集进度（累计）与历史最高分写入 user:// JSON。
func save_progress() -> void:
	var data := {"best_score": best_score, "total_collected": total_collected}
	var file := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if file == null:
		return
	file.store_string(JSON.stringify(data))
	file.close()


## 启动时读回持久化数据；文件缺失/损坏时保持默认值（首次游玩或存档清空）。
func load_progress() -> void:
	if not FileAccess.file_exists(SAVE_PATH):
		return
	var file := FileAccess.open(SAVE_PATH, FileAccess.READ)
	if file == null:
		return
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	file.close()
	if typeof(parsed) != TYPE_DICTIONARY:
		return
	var data: Dictionary = parsed
	best_score = int(data.get("best_score", 0))
	total_collected = int(data.get("total_collected", 0))
