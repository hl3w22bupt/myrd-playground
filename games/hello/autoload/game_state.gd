extends Node
## 自动加载单例（autoload）：跨场景共享的全局状态（《hello》收集计数 + 关卡梯度 + 胜负判定）。
##
## 注册方式：project.godot 的 [autoload] 段写 `GameState="*res://autoload/game_state.gd"`。
## `*` 前缀 = 单例模式（全局唯一）；脚本必须 extends Node，否则无法挂到场景树根部。
##
## 规范（见技能包 SKILL.md「GDScript 规范」）：
## - autoload 只放「状态 + 纯逻辑」，不放场景/节点引用；
## - 跨场景通信一律走信号，禁止 autoload 反向持有场景节点；
## - 命名用 PascalCase 单例名，成员变量 snake_case。

## 分数变化信号：场景层订阅它刷新 UI，而不是主动轮询。
signal score_changed(score: int)
## 一局（本关）目标全部达成时发出；订阅方（Main）展示过关结算与「下一关」提示。
signal game_won(score: int)
## 本关时限归零仍未收满时发出；订阅方（Main）展示失败结算与「重来」提示。
signal game_over(score: int)
## 新一关开始（含首次 _ready 与胜/败后的开局）时发出；订阅方（Main）刷新 HUD 与场地。
signal level_started(level: int, target: int, time_limit: float)

## ── 难度梯度调参区（对应需求「单局短平快」「难度有梯度」）──
## 第 1 关：30 秒内收集 4 件；此后每关目标 +1 件、时限 -4 秒，到顶后保持不变。
## 上限取场上收集物总数（main.tscn 摆 6 件）：目标再多就收不满，梯度失效。
const BASE_TARGET: int = 4
const MAX_TARGET: int = 6
const BASE_TIME: float = 30.0
const MIN_TIME: float = 18.0
const TIME_STEP: float = 4.0
## 数值到顶的关卡（第 3 关起 target=6 / 时限 18s，梯度封顶）。
const MAX_LEVEL: int = 3

## ── 调参桥（§3C 调参工作台硬契约的游戏侧）──
## 壳页把 URL 参数 tuning 解析进 window.__GAME_TUNING__，这里在启动时读取并覆盖下面的
## 可调参数（只认 TUNING_META 声明的键、按 min/max 钳制）。缺壳页那一层时键不存在 →
## 全部保持默认值，行为与未接调参桥完全一致（桌面/冒烟门禁不受影响）。
## TUNING_META 是唯一入口清单：键不在里面 = 拒绝，防止 URL 乱注入任意成员。
const TUNING_META: Dictionary = {
	"base_target": {"min": 1.0, "max": 6.0},
	"base_time": {"min": 10.0, "max": 90.0},
	"time_step": {"min": 0.0, "max": 10.0},
	"min_time": {"min": 5.0, "max": 90.0},
}

## 可调参数（初值 = 上面的常量；base_target 钳在 MAX_TARGET 内，目标不超过场上件数）。
var base_target: int = BASE_TARGET
var base_time: float = BASE_TIME
var time_step: float = TIME_STEP
var min_time: float = MIN_TIME

var level: int = 1
var target: int = BASE_TARGET
var time_limit: float = BASE_TIME
var time_left: float = BASE_TIME
var score: int = 0
var won: bool = false
var over: bool = false


func _ready() -> void:
	_apply_tuning()
	start_level(1)


## 第 lv 关的收集目标与时限（纯函数：梯度常量的唯一推导处，Main/冒烟只读结果）。
func target_for_level(lv: int) -> int:
	return mini(MAX_TARGET, base_target + (lv - 1))


func time_for_level(lv: int) -> float:
	return maxf(min_time, base_time - (lv - 1) * time_step)


## 读壳页注入的 window.__GAME_TUNING__ 覆盖可调参数（仅 Web 平台；JSON 值非法/越界按钳制处理）。
func _apply_tuning() -> void:
	if not OS.has_feature("web"):
		return
	var raw: Variant = JavaScriptBridge.eval(
		"window.__GAME_TUNING__ ? JSON.stringify(window.__GAME_TUNING__) : ''", true)
	if raw == null or str(raw).is_empty():
		return
	var parsed: Variant = JSON.parse_string(str(raw))
	if typeof(parsed) != TYPE_DICTIONARY:
		return
	for key: String in TUNING_META:
		if not (parsed as Dictionary).has(key):
			continue
		var bounds: Dictionary = TUNING_META[key]
		var value: float = clampf(
			float((parsed as Dictionary)[key]),
			float(bounds["min"]), float(bounds["max"]))
		match key:
			"base_target":
				base_target = int(round(value))
			"base_time":
				base_time = value
			"time_step":
				time_step = value
			"min_time":
				min_time = value


## 开一关：清零本关计数与胜负标记，按关卡号推导目标/时限，并广播开局。
func start_level(lv: int) -> void:
	level = lv
	target = target_for_level(lv)
	time_limit = time_for_level(lv)
	time_left = time_limit
	score = 0
	won = false
	over = false
	score_changed.emit(score)
	level_started.emit(level, target, time_limit)


## 每物理帧由场景层驱动倒计时；won/over 后冻结（结算画面时间不走）。
func tick(delta: float) -> void:
	if won or over:
		return
	time_left = maxf(0.0, time_left - delta)
	if time_left <= 0.0:
		over = true
		game_over.emit(score)


## 收集到物品时由场景层调用；达到 target 触发一次胜利（won 后不再累计）。
func add_score(amount: int) -> void:
	if won or over:
		return
	score += amount
	score_changed.emit(score)
	if score >= target:
		won = true
		game_won.emit(score)


## 过关后开下一关（confirm 触发，Main 同时重摆场地）；梯度到顶后数值保持封顶值。
func advance_level() -> void:
	start_level(level + 1)


## 失败后从第 1 关重来（confirm 触发，Main 同时重摆场地）。
func restart_run() -> void:
	start_level(1)
