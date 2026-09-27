extends Node
## 自动加载单例（autoload）：跑酷单局的全局状态 + 数值调参区。
##
## 注册方式：project.godot 的 [autoload] 段写 `GameState="*res://autoload/game_state.gd"`。
## 规范（见技能包 SKILL.md「GDScript 规范」）：
## - autoload 只放「状态 + 纯逻辑」，不放场景/节点引用；
## - 场景层订阅信号刷新 UI，而不是主动轮询；
## - 数值键名与 .myrd/spec/design-spec.json 的 spec.numeric 对齐（策划案 §3），
##   改数值 = 先改策划案（revisions 新版本）再同步这里，禁止两头各改各的。

## ── 信号（发布方只 emit，订阅方在场景 _ready 里集中连接）──
## 得分变化（距离分 + 金币分重算后都会触发）。
signal score_changed(score: int)
## 金币数变化。
signal coins_changed(coins: int)
## 单局结束（win = 是否达成收集目标）。
signal run_ended(win: bool, score: int, coins: int, distance_m: float)

## ── 数值调参区（spec.numeric 键名对照见行尾注释）──
const PIXELS_PER_METER: float = 40.0            # pixelsPerMeter
const RUN_SPEED_PX_PER_SEC: float = 320.0       # runSpeedBasePxPerSec
const GRAVITY_PX_PER_SEC2: float = 2400.0       # gravityPxPerSec2
const JUMP_VELOCITY_PX_PER_SEC: float = -900.0  # jumpVelocityPxPerSec
const DOUBLE_JUMP_VELOCITY_PX_PER_SEC: float = -820.0  # doubleJumpVelocityPxPerSec
const COYOTE_TIME_SECONDS: float = 0.08         # coyoteTimeSeconds
const JUMP_BUFFER_SECONDS: float = 0.1          # jumpBufferSeconds
const SLIDE_DURATION_SECONDS: float = 0.6       # slideDurationSeconds
const HITBOX_STAND_WIDTH_PX: float = 44.0       # hitboxStandWidthPx
const HITBOX_STAND_HEIGHT_PX: float = 64.0      # hitboxStandHeightPx
const HITBOX_SLIDE_HEIGHT_PX: float = 36.0      # hitboxSlideHeightPx
const COIN_VALUE: int = 1                       # coinValue
const SCORE_PER_METER: int = 2                  # scorePerMeter
const SCORE_PER_COIN: int = 10                  # scorePerCoin
const SAVE_KEY: String = "game6_save_v1"        # saveKey（本地存档键）

## 脚手架期收集目标：吃满 6 枚金币判「胜」。
## 注意：正式版按策划案改为「无限跑 + 距离/得分结算」，此键随实现节点移除。
const WIN_COIN_GOAL: int = 6

## ── 单局状态 ──
var score: int = 0
var coins: int = 0
var distance_m: float = 0.0
var run_active: bool = false
var last_run_win: bool = false
## 历史最高分（本地持久化，跨会话保留）。
var best_score: int = 0


func _ready() -> void:
	load_progress()


## 单局开始：清零计数并置运行态（由主场景 restart_run() 调用）。
func start_run() -> void:
	score = 0
	coins = 0
	distance_m = 0.0
	run_active = true
	score_changed.emit(score)
	coins_changed.emit(coins)


## 单局结束：幂等（重复调用只结算一次），刷新最高分并持久化。
func end_run(win: bool) -> void:
	if not run_active:
		return
	run_active = false
	last_run_win = win
	if score > best_score:
		best_score = score
		save_progress()
	run_ended.emit(win, score, coins, distance_m)


## 拾取一枚金币：计数 + 加分 + 达标判胜。
func add_coin() -> void:
	if not run_active:
		return
	coins += COIN_VALUE
	coins_changed.emit(coins)
	_recalculate_score()
	if coins >= WIN_COIN_GOAL:
		end_run(true)


## 距离推进（主场景随玩家位移刷新）。
func set_distance(meters: float) -> void:
	if meters > distance_m:
		distance_m = meters
		_recalculate_score()


func _recalculate_score() -> void:
	var next_score: int = int(distance_m) * SCORE_PER_METER + coins * SCORE_PER_COIN
	if next_score != score:
		score = next_score
		score_changed.emit(score)


## ── 本地持久化（最高分；ConfigFile 落 user://，headless 亦可写）──
func save_progress() -> bool:
	var config := ConfigFile.new()
	config.set_value("save", "best_score", best_score)
	return config.save("user://%s.cfg" % SAVE_KEY) == OK


func load_progress() -> void:
	var config := ConfigFile.new()
	if config.load("user://%s.cfg" % SAVE_KEY) == OK:
		best_score = int(config.get_value("save", "best_score", 0))
