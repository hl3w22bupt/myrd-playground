extends Node
## 自动加载单例（autoload）：跨场景共享的比赛全局状态（纯状态 + 纯逻辑，不持有场景节点）。
##
## 注册方式：project.godot 的 [autoload] 段写 `GameState="*res://autoload/game_state.gd"`。
## `*` 前缀 = 单例模式（全局唯一）；脚本必须 extends Node，否则无法挂到场景树根部。
##
## 规范（见技能包 SKILL.md「GDScript 规范」）：
## - autoload 只放「状态 + 纯逻辑」，不放场景/节点引用；
## - 跨场景通信一律走信号，禁止 autoload 反向持有场景节点；
## - 数值调参字段集中在此（与策划案 numeric 键位对应），改参数不改代码。

## 比分变化信号：场景层订阅它刷新 UI，而不是主动轮询。
signal score_changed(home_score: int, away_score: int)
## 比赛结束信号（全场打完时发出一次）。
signal match_finished(home_score: int, away_score: int)
## 比赛阶段变化信号（开球 / 进行中 / 死球重发 / 中场 / 结束）。
signal phase_changed(new_phase: int)
## 难度变化信号（HUD 订阅刷新文案；Main 订阅后客队 AI 下一帧即按新梯度行动）。
signal difficulty_changed(difficulty: int)
## 比赛时长档变化信号（HUD 订阅刷新文案；计时映射即时按新档换算）。
signal match_length_changed(real_seconds: float)

## 比赛阶段。
enum Phase { KICKOFF, PLAYING, RESTART, HALFTIME, FINISHED }

## 难度档（有梯度：只缩放客队 AI，主队玩家操作永不缩放）。
enum Difficulty { EASY, NORMAL, HARD }

## ---- 数值调参区（可配置项；改数值不改代码） ----
## 模拟时长：一场标准比赛 90 分钟。
const MATCH_SIM_MINUTES: float = 90.0
## 全场真实时长三档（秒）：短场 / 标准 / 长场。策划案默认 3~5 分钟 → 默认取标准 240。
const MATCH_LENGTH_OPTIONS: Array[float] = [120.0, 240.0, 360.0]
const MATCH_LENGTH_NAMES: Array[String] = ["短场 2 分钟", "标准 4 分钟", "长场 6 分钟"]

## 主队（玩家队）AI 基准值：难度变化不影响本队。
const HOME_AI_SPEED: float = 1.0        ## 移速系数
const HOME_PRESS_COUNT: int = 2         ## 同时上抢人数
const HOME_SHOOT_RANGE: float = 300.0   ## AI 起脚距离（像素）
const HOME_GK_REACT: float = 0.85       ## 门将站位跟随速度系数
const HOME_TACKLE_TIME: float = 0.25    ## 贴身抢断所需时间（秒）

## 客队 AI 梯度表（下标 = Difficulty）：简单 → 普通 → 困难逐级增强。
const DIFFICULTY_NAMES: Array[String] = ["简单", "普通", "困难"]
const DIFFICULTY_AI_SPEED: Array[float] = [0.84, 1.0, 1.1]
const DIFFICULTY_PRESS_COUNT: Array[int] = [1, 2, 3]
const DIFFICULTY_SHOOT_RANGE: Array[float] = [230.0, 300.0, 350.0]
const DIFFICULTY_GK_REACT: Array[float] = [0.72, 0.85, 0.92]
const DIFFICULTY_TACKLE_TIME: Array[float] = [0.4, 0.28, 0.2]

var home_score: int = 0
var away_score: int = 0
## 本场已进行的真实秒数（由 Main 推进，这里只存状态）。
var elapsed: float = 0.0
var phase: int = Phase.KICKOFF
## 当前难度与时长档（设置类状态：重开一场不清零，跨局保留）。
var difficulty: int = Difficulty.NORMAL
var match_length_index: int = 1


## 全场真实时长（秒）= 当前档位选项；上下半场各一半。
func match_real_seconds() -> float:
	return MATCH_LENGTH_OPTIONS[match_length_index]


## 单半场真实时长（秒）。
func half_real_seconds() -> float:
	return match_real_seconds() * 0.5


## 当前比赛分钟数（把真实秒数映射到 0~90 模拟分钟）。
func sim_minute() -> int:
	return clampi(int(floor(elapsed / match_real_seconds() * MATCH_SIM_MINUTES)), 0, 90)


## ---- 难度 / 时长设置（纯状态 + 纯逻辑，场景层订阅信号刷新 UI） ----

## 设置难度（越界钳制到合法档）并广播。
func set_difficulty(value: int) -> void:
	difficulty = clampi(value, 0, DIFFICULTY_NAMES.size() - 1)
	difficulty_changed.emit(difficulty)


## 循环切换难度：简单 → 普通 → 困难 → 简单。
func cycle_difficulty() -> void:
	set_difficulty((difficulty + 1) % DIFFICULTY_NAMES.size())


## 设置时长档（越界钳制到合法档）并广播。
func set_match_length(index: int) -> void:
	match_length_index = clampi(index, 0, MATCH_LENGTH_NAMES.size() - 1)
	match_length_changed.emit(match_real_seconds())


## 循环切换时长档：短场 → 标准 → 长场 → 短场。
func cycle_match_length() -> void:
	set_match_length((match_length_index + 1) % MATCH_LENGTH_NAMES.size())


func difficulty_name() -> String:
	return DIFFICULTY_NAMES[difficulty]


func match_length_name() -> String:
	return MATCH_LENGTH_NAMES[match_length_index]


## 某队 AI 移速系数：主队恒为基准，客队按难度档取值。
func ai_speed_factor(team: int) -> float:
	return HOME_AI_SPEED if team == 0 else DIFFICULTY_AI_SPEED[difficulty]


## 某队同时上抢人数。
func ai_press_count(team: int) -> int:
	return HOME_PRESS_COUNT if team == 0 else DIFFICULTY_PRESS_COUNT[difficulty]


## 某队 AI 起脚距离（像素）。
func ai_shoot_range(team: int) -> float:
	return HOME_SHOOT_RANGE if team == 0 else DIFFICULTY_SHOOT_RANGE[difficulty]


## 某队门将站位跟随速度系数（扑救反应：数值越小越迟钝）。
func ai_gk_react(team: int) -> float:
	return HOME_GK_REACT if team == 0 else DIFFICULTY_GK_REACT[difficulty]


## 某队贴身抢断所需时间（秒）：越短越凶。
func ai_tackle_time(team: int) -> float:
	return HOME_TACKLE_TIME if team == 0 else DIFFICULTY_TACKLE_TIME[difficulty]


## 当前半场（1 = 上半场，2 = 下半场）。
func current_half() -> int:
	return 1 if elapsed < half_real_seconds() else 2


## 某队进球（team: 0 = 主队，1 = 客队），更新比分并广播。
func add_goal(team: int) -> void:
	if team == 0:
		home_score += 1
	else:
		away_score += 1
	score_changed.emit(home_score, away_score)


## 切换比赛阶段并广播。
func set_phase(new_phase: int) -> void:
	phase = new_phase
	phase_changed.emit(new_phase)


## 全场结束：置阶段并发一次性信号。
func finish_match() -> void:
	phase = Phase.FINISHED
	phase_changed.emit(Phase.FINISHED)
	match_finished.emit(home_score, away_score)


## 重开整场比赛：清零比分与计时，回到开球阶段。
func reset_match() -> void:
	home_score = 0
	away_score = 0
	elapsed = 0.0
	phase = Phase.KICKOFF
	score_changed.emit(home_score, away_score)
	phase_changed.emit(Phase.KICKOFF)


## 主队视角的结果文本（胜 / 平 / 负）。
func result_for_home() -> String:
	if home_score > away_score:
		return "主队胜"
	elif home_score < away_score:
		return "客队胜"
	return "平局"
