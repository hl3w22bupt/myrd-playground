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

## ── 数值调参区（SKILL.md §3C 调参工作台）──
## 可调数值 = 变量（默认值 = 需求验收基线：目标 20 个 / 限时 60 秒）+ TUNING_META（min/max/step）
## 成对声明；名称保留大写与历史一致（tests/smoke.gd 直接引用）。
## apply_tuning() 是唯一应用入口：只认 META 声明的键、按范围钳制、返回生效键列表；
## Web 端启动时 _apply_web_tuning() 读壳页面调参桥（window.__GAME_TUNING__）覆盖默认值；
## 桌面/无头环境桥不存在，自动跳过 —— 冒烟与本地运行不受影响。
## 新增可调数值 = 加一个变量 + 在 TUNING_META 加一行。
## TUNING_META：变量名 → {min, max, step}（调参面板按它生成滑杆，apply_tuning 按它钳制）。
const TUNING_META: Dictionary = {
	"TARGET_SCORE": {"min": 5.0, "max": 60.0, "step": 1.0},
	"TIME_LIMIT": {"min": 15.0, "max": 180.0, "step": 5.0},
	"MAX_COLLECTIBLES": {"min": 1.0, "max": 20.0, "step": 1.0},
	"SPAWN_INTERVAL_START": {"min": 0.3, "max": 3.0, "step": 0.05},
	"SPAWN_INTERVAL_MIN": {"min": 0.2, "max": 2.0, "step": 0.05},
	"LIFETIME_START": {"min": 2.0, "max": 15.0, "step": 0.5},
	"LIFETIME_MIN": {"min": 1.0, "max": 10.0, "step": 0.5},
}
## 单局目标收集量（需求验收基线 3：收集 20 个即通关）。
var TARGET_SCORE: int = 20
## 单局时限秒数（需求验收基线 3：限时 60 秒）。
var TIME_LIMIT: float = 60.0
## 场上同屏可收集物上限（少于该数时由生成器补充）。
var MAX_COLLECTIBLES: int = 6
## 可收集物补充刷新间隔秒数（开局值；随难度梯度收紧到 SPAWN_INTERVAL_MIN）。
var SPAWN_INTERVAL_START: float = 0.8
## 刷新间隔下限（难度封顶时的值，保证后期仍可读、可反应）。
var SPAWN_INTERVAL_MIN: float = 0.45
## 可收集物寿命（开局值，秒）：超时未收集即过期消失，逼玩家主动追着收。
var LIFETIME_START: float = 6.0
## 可收集物寿命下限（秒）：难度封顶时仍留出可追的距离。
var LIFETIME_MIN: float = 3.0
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
	# 调参桥（SKILL.md §3C）：Web 端读壳页面在引擎加载前写入的 window.__GAME_TUNING__。
	# 桌面/无头环境无此桥，函数内部直接返回 —— 冒烟断言始终基于默认值，不受影响。
	_apply_web_tuning()


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


## ── 调参应用（SKILL.md §3C 调参工作台唯一应用入口）──
## 只认 TUNING_META 声明的键（未声明键拒绝）、按 min/max 钳制，返回实际生效的键列表。
## 调参面板（scripts/tuning_panel.gd）拖滑杆与 Web 启动读桥共用本函数。
func apply_tuning(values: Dictionary) -> Array[String]:
	var applied: Array[String] = []
	for key: String in values:
		if not TUNING_META.has(key):
			continue  # 未声明的键一律拒绝：调参不能改到玩法逻辑或存档字段
		var meta: Dictionary = TUNING_META[key]
		var clamped: float = clampf(float(values[key]), float(meta["min"]), float(meta["max"]))
		set(key, _cast_tuned_value(key, clamped))
		applied.append(key)
	_normalize_tuning_order()
	if applied.has("TIME_LIMIT"):
		# 改时限立即生效：本局剩余时间重置为新时限（调参台是开发工具，语义直观优先）。
		time_left = TIME_LIMIT
		time_changed.emit(time_left)
	return applied


## 把钳制后的浮点值转回变量自身类型（整型变量取整，其余保持浮点）。
func _cast_tuned_value(key: String, value: float) -> Variant:
	var current: Variant = get(key)
	if typeof(current) == TYPE_INT:
		return int(roundf(value))
	return value


## 保序约束：下限值不允许高于开局值（否则难度梯度断言的单调性被破坏）。
func _normalize_tuning_order() -> void:
	SPAWN_INTERVAL_MIN = minf(SPAWN_INTERVAL_MIN, SPAWN_INTERVAL_START)
	LIFETIME_MIN = minf(LIFETIME_MIN, LIFETIME_START)


## Web 调参桥消费端：壳页面在引擎加载前把 URL ?tuning=<JSON> 写进 window.__GAME_TUNING__，
## 这里读回并应用。非 Web 平台（桌面/无头）没有 JavaScriptBridge 语义，直接返回。
func _apply_web_tuning() -> void:
	if not OS.has_feature("web"):
		return
	var raw: Variant = JavaScriptBridge.eval(
		"window.__GAME_TUNING__ ? JSON.stringify(window.__GAME_TUNING__) : null", true
	)
	if raw == null or typeof(raw) != TYPE_STRING:
		return
	var parsed: Variant = JSON.parse_string(raw)
	if typeof(parsed) != TYPE_DICTIONARY:
		return
	var applied := apply_tuning(parsed)
	if not applied.is_empty():
		print("[game-8] 已应用 URL 调参: ", ", ".join(applied))


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
