extends Node
## 自动加载单例（autoload）：跑酷全局状态 —— 分数与胜负状态机。
##
## 注册方式：project.godot 的 [autoload] 段写 `GameState="*res://autoload/game_state.gd"`。
## `*` 前缀 = 单例模式（全局唯一）；脚本必须 extends Node，否则无法挂到场景树根部。
##
## 规范（见 SKILL.md「GDScript 规范」）：
## - autoload 只放「状态 + 纯逻辑」，不放场景/节点引用；
## - 跨场景通信一律走信号，禁止 autoload 反向持有场景节点；
## - 数值调参集中在常量区，键名与策划案 numeric 段对应。

## 分数变化：场景层订阅它刷新 HUD，而不是主动轮询。
signal score_changed(score: int)
## 局内状态切换（PLAYING → WON/LOST → PLAYING）：HUD 据此显式提示。
signal state_changed(state: int)
## 坚持跑到底（碰到终点旗）时发出，参数为含过关奖励的最终分。
signal game_won(final_score: int)
## 掉进深坑或撞上尖刺时发出，参数为本局已收集的飞镖数。
signal game_lost(final_score: int)

## 局内状态：奔跑中 / 已过关 / 已失败。
enum State { PLAYING, WON, LOST }

## ── 数值调参区（集中一处，改参数不改逻辑）──
## 每枚飞镖的得分。
const DART_SCORE: int = 1
## 过关奖励：坚持跑到底额外加的分。
const WIN_BONUS: int = 10

## §3C 调参工作台桥（游戏侧声明）：可通过 URL `?tuning=<json>` 覆盖的键与钳制区间。
## 壳页面在引擎加载前把 URL 参数解析进 `window.__GAME_TUNING__`；本单例启动时读取，
## 只认这里声明的键（其余忽略）并按 min/max 钳制 —— 试玩调好的参数因此可用 URL 复现。
## 手感键由 Player 在 _ready 时按同名键取用（见 player.gd 运行期值区）。
const TUNING_META: Dictionary = {
	"dart_score": {"min": 1, "max": 10},
	"win_bonus": {"min": 0, "max": 50},
	"run_speed": {"min": 120.0, "max": 480.0},
	"jump_velocity_abs": {"min": 260.0, "max": 900.0},
	"gravity": {"min": 700.0, "max": 2800.0},
	"max_jumps": {"min": 1, "max": 3},
	"coyote_frames": {"min": 0, "max": 20},
	"jump_buffer_frames": {"min": 0, "max": 20},
}

var score: int = 0
var state: int = State.PLAYING
## 跨局留存：历史最高分与累计过关次数（reset() 不清这两项）。
var best_score: int = 0
var runs_finished: int = 0
## 生效调参（键 → 钳制后的值）。空字典 = 全部用常量默认（无头/桌面直开时的常态）。
var tuning: Dictionary = {}


func _ready() -> void:
	tuning = _load_browser_tuning()


## 读取壳页面注入的 `window.__GAME_TUNING__`（Web 平台才有 JavaScriptBridge）：
## 只认 TUNING_META 声明的键，按 min/max 钳制；引擎外环境或解析失败一律返回空字典。
func _load_browser_tuning() -> Dictionary:
	if not ClassDB.class_exists("JavaScriptBridge") or not Engine.has_singleton("JavaScriptBridge"):
		return {}
	var bridge: Object = Engine.get_singleton("JavaScriptBridge")
	var raw: String = str(bridge.eval("JSON.stringify(window.__GAME_TUNING__ || null)", true))
	if raw == "" or raw == "null" or raw == "undefined":
		return {}
	var parsed: Variant = JSON.parse_string(raw)
	if typeof(parsed) != TYPE_DICTIONARY:
		return {}
	var effective: Dictionary = {}
	for key: String in TUNING_META:
		if not parsed.has(key):
			continue
		var value: float = float(parsed[key])
		var bounds: Dictionary = TUNING_META[key]
		effective[key] = clampf(value, float(bounds["min"]), float(bounds["max"]))
	return effective


## 生效的每枚飞镖得分（URL 调参覆盖 DART_SCORE，未调参时等于常量）。
func dart_score_value() -> int:
	return int(tuning.get("dart_score", DART_SCORE))


## 生效的过关奖励（URL 调参覆盖 WIN_BONUS，未调参时等于常量）。
func win_bonus_value() -> int:
	return int(tuning.get("win_bonus", WIN_BONUS))


func add_score(amount: int) -> void:
	# 只有奔跑中的局才能加分：胜负已定后碰到的飞镖不计（避免结算界面数字漂移）。
	if state != State.PLAYING:
		return
	score += amount
	score_changed.emit(score)


## 坚持跑到底：结算过关（加分奖励 + 发信号）。重复触发是空操作（先判状态）。
func register_win() -> void:
	if state != State.PLAYING:
		return
	score += win_bonus_value()
	state = State.WON
	runs_finished += 1
	best_score = maxi(best_score, score)
	score_changed.emit(score)
	state_changed.emit(state)
	game_won.emit(score)


## 掉坑 / 撞尖刺：结算失败。重复触发是空操作。
func register_loss() -> void:
	if state != State.PLAYING:
		return
	state = State.LOST
	best_score = maxi(best_score, score)
	state_changed.emit(state)
	game_lost.emit(score)


## 重开一局：清空局内数值、回到奔跑中（跨局留存项保留）。
func reset() -> void:
	score = 0
	state = State.PLAYING
	# 调参工作台生效通道：壳页 ?tuning=1 面板拖滑杆只更新 window.__GAME_TUNING__，
	# 每局重开时在此重新读取 →「拖动 → R 重开一局即生效」。未调参/无头/桌面直开
	# 返回 {} 幂等（全走常量默认），不改任何默认值，关卡与冒烟断言口径不变。
	tuning = _load_browser_tuning()
	score_changed.emit(score)
	state_changed.emit(state)
