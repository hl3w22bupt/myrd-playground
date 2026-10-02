extends Node
## 自动加载单例（autoload）：跨场景共享的全局状态 + 全部调参配置。
##
## 注册方式：project.godot 的 [autoload] 段写 `GameState="*res://autoload/game_state.gd"`。
##
## 规范（见技能包 SKILL.md「GDScript 规范」）：
## - autoload 只放「状态 + 纯逻辑」，不放场景/节点引用；
## - 跨场景通信一律走信号，禁止 autoload 反向持有场景节点；
## - 所有数值调参（含晃动参数）集中在常量区，改配置即生效，不需要动业务逻辑代码。

## 分数变化信号：场景层订阅它刷新 UI，而不是主动轮询。
signal score_changed(score: int)
## 距离变化信号（整数米跨越时发出）。
signal distance_changed(distance_m: float)
## 速度变化信号：active=true 进入加速特效，false 结束（含 game over/通关时被强制结束）。
signal speed_changed(multiplier: float, active: bool)
## 局内状态变化信号：订阅方据此切换 UI / 触发终局单晃。
signal state_changed(new_state: State, old_state: State)

enum State { READY, RUNNING, GAME_OVER, WIN }

## ── 玩法调参（集中配置）─────────────────────────────────────────
const BASE_SPEED_PX_S: float = 220.0
const ACCEL_MULTIPLIER: float = 1.6
## 加速特效持续时间：验收要求 ≥10 秒（真机体感口径）。
const ACCEL_DURATION_S: float = 10.0
## 通关距离（米）。
const WIN_DISTANCE_M: float = 500.0
## 像素 → 米换算。
const PX_PER_M: float = 10.0
## 单枚金币得分。
const COIN_SCORE: int = 10

## ── 晃动集中配置（本工程唯一的晃动参数源；改这里即可，禁止在业务代码里写晃动魔数）──
## 改动前基线（真机体感反馈「加速期间头晕、game over 晃动拖沓」时留档）：
## 加速抖动 6.0px / 12Hz 全程等幅；game over 连续晃 3 次。
## 验收口径：加速晃动幅度 ≤ 基线的 50%（≤3.0px）；game over 精确晃 1 次。
const SHAKE_LEGACY_BASELINE: Dictionary = {
	"accel_amplitude_px": 6.0,
	"accel_frequency_hz": 12.0,
	"game_over_repeats": 3,
}
## 当前生效参数。accel：加速特效期间的持续微抖（幅度小、频率低，肉眼几乎不察）。
## game_over：终局单晃 —— 短促一次，结束后 offset 精确归零，不再有任何残余抖动。
const SHAKE_CONFIG: Dictionary = {
	"accel": {
		"amplitude_px": 1.2,
		"frequency_hz": 5.0,
	},
	"game_over": {
		"amplitude_px": 7.0,
		"frequency_hz": 16.0,
		"duration_s": 0.3,
	},
}

var state: State = State.READY
var score: int = 0
var distance_m: float = 0.0
var speed_multiplier: float = 1.0
var game_over_count: int = 0

var _speeding_left_s: float = 0.0


## 读取晃动参数（唯一入口；scene_shake.gd 与冒烟断言都经由它取参）。
func shake_params(kind: StringName) -> Dictionary:
	var params: Variant = SHAKE_CONFIG.get(String(kind), {})
	return params as Dictionary


func is_speeding() -> bool:
	return speed_multiplier > 1.0


func current_speed_px() -> float:
	return BASE_SPEED_PX_S * speed_multiplier


## 每帧推进局内计时/距离（仅 RUNNING 状态生效；由主场景驱动）。
func tick_run(delta: float) -> void:
	if state != State.RUNNING:
		return
	if is_speeding():
		_speeding_left_s -= delta
		if _speeding_left_s <= 0.0:
			_end_speeding()
	var previous := distance_m
	distance_m += current_speed_px() * delta / PX_PER_M
	if int(distance_m) != int(previous):
		distance_changed.emit(distance_m)
	if distance_m >= WIN_DISTANCE_M:
		_finish(State.WIN)


## 进入加速特效（拾取加速星触发）。
func start_speeding() -> void:
	if state != State.RUNNING:
		return
	_speeding_left_s = ACCEL_DURATION_S
	if not is_speeding():
		speed_multiplier = ACCEL_MULTIPLIER
		speed_changed.emit(speed_multiplier, true)


## 触发 game over：终结加速（不叠加晃动），状态切 GAME_OVER（沿状态边沿只走一次）。
func trigger_game_over() -> void:
	if state != State.RUNNING:
		return
	game_over_count += 1
	_finish(State.GAME_OVER)


## 开始新一局：清零数值并切 RUNNING。
func start_run() -> void:
	score = 0
	distance_m = 0.0
	_speeding_left_s = 0.0
	if is_speeding():
		speed_multiplier = 1.0
		speed_changed.emit(1.0, false)
	score_changed.emit(score)
	distance_changed.emit(distance_m)
	_finish(State.RUNNING)


func add_score(amount: int) -> void:
	score += amount
	score_changed.emit(score)


## 加速结束（自然到期 / 被终局终结）：速度回落并广播，业务层据此关闭加速微抖。
func _end_speeding() -> void:
	_speeding_left_s = 0.0
	speed_multiplier = 1.0
	speed_changed.emit(speed_multiplier, false)


## 状态收口：离开 RUNNING 前先终结加速，保证「game over 时加速微抖先关、终局单晃后启」。
func _finish(next: State) -> void:
	if state == State.RUNNING and next != State.RUNNING and is_speeding():
		_end_speeding()
	var old := state
	state = next
	state_changed.emit(next, old)
