extends Node
## 自动加载单例（autoload）：跨场景共享的全局状态（难度 / 分数 / 倒计时 / 胜负状态机）+ 数值调参区。
##
## 注册方式：project.godot 的 [autoload] 段写 `GameState="*res://autoload/game_state.gd"`。
## `*` 前缀 = 单例模式（全局唯一）；脚本必须 extends Node，否则无法挂到场景树根部。
##
## 规范（见技能包 SKILL.md「GDScript 规范」「调参工作台」）：
## - autoload 只放「状态 + 纯逻辑」，不放场景/节点引用；
## - 跨场景通信一律走信号，禁止 autoload 反向持有场景节点；
## - 可调数值集中在调参区：变量 + TUNING_META 成对声明，键名与 spec.numeric 对应，
##   消费方（board.gd / main.gd）只读变量、禁止散落魔数。

## ── 难度等级（验收标准 5：至少 2 档不同棋盘规模）──
## 棋盘规模与格子尺寸在这里集中声明；board.gd 只读不抄数值。
const DIFFICULTIES: Dictionary = {
	&"easy": {"label": "轻松 4×4", "cols": 4, "rows": 4, "cell_size": 100.0},
	&"hard": {"label": "挑战 6×6", "cols": 6, "rows": 6, "cell_size": 78.0},
}
const DEFAULT_DIFFICULTY: StringName = &"easy"

enum State { MENU, PLAYING, WON, LOST }

## 分数变化信号：场景层订阅它刷新 UI，而不是主动轮询。
signal score_changed(score: int)
## 剩余时间变化信号（float 秒）。
signal time_changed(time_left: float)
## 胜负状态切换信号（MENU → PLAYING → WON / LOST）。
signal state_changed(new_state: State)
## 难度选择变化信号（菜单层订阅以刷新按钮选中态与说明文案）。
signal difficulty_changed(difficulty: StringName)

## ── 数值调参区（SKILL.md §3C 调参工作台的 spec.numeric 对接面）──
## 默认值 = spec.numeric 的当前定稿；试玩调参经 apply_tuning 覆盖，定稿回写 spec 后更新这里。
var start_time_easy: float = 90.0
var start_time_hard: float = 180.0
var match_points: float = 10.0

## 可调键的元数据：键名 → {min, max, step}。调参面板按它生成滑杆，apply_tuning 按它钳制。
const TUNING_META: Dictionary = {
	&"start_time_easy": {"min": 30.0, "max": 240.0, "step": 5.0},
	&"start_time_hard": {"min": 60.0, "max": 360.0, "step": 5.0},
	&"match_points": {"min": 1.0, "max": 50.0, "step": 1.0},
}

var difficulty: StringName = DEFAULT_DIFFICULTY
var score: int = 0
var time_left: float = 90.0
var state: State = State.MENU
## 最近一次消除的实际得分（信号消费方直接读，避免再传一路参数）。
var last_match_points: int = 0


func _ready() -> void:
	_apply_web_tuning()


## 每物理帧由主场景驱动一次；只在 PLAYING 状态倒计时（菜单/结算界面时间冻结）。
func tick(delta: float) -> void:
	if state != State.PLAYING:
		return
	time_left = maxf(time_left - delta, 0.0)
	time_changed.emit(time_left)
	if time_left <= 0.0:
		lose_game()


## 当前难度的一局总时长（秒）。
func start_time() -> float:
	return start_time_hard if difficulty == &"hard" else start_time_easy


## 菜单里切换难度（只改选择不开局）；非法难度忽略（fail-safe 保持现值）。
func select_difficulty(new_difficulty: StringName) -> void:
	if not DIFFICULTIES.has(new_difficulty):
		return
	difficulty = new_difficulty
	difficulty_changed.emit(difficulty)


## 开始一局：锁定难度并整体复位（菜单「开始游戏」按钮的唯一入口）。
func start_game(new_difficulty: StringName) -> void:
	if not DIFFICULTIES.has(new_difficulty):
		new_difficulty = DEFAULT_DIFFICULTY
	difficulty = new_difficulty
	_reset_run()
	difficulty_changed.emit(difficulty)
	state = State.PLAYING
	state_changed.emit(state)


## 重开：同难度再来一局（结算面板「再来一局」与 R 键共用）。
func reset() -> void:
	_reset_run()
	state = State.PLAYING
	state_changed.emit(state)


## 返回菜单（结算面板「返回菜单」按钮入口）。
func to_menu() -> void:
	state = State.MENU
	state_changed.emit(state)


func add_score(amount: int) -> void:
	score += amount
	score_changed.emit(score)


## 一次成功消除的计分入口：读调参区的 match_points，把实际分值留在 last_match_points。
func award_match() -> void:
	last_match_points = int(match_points)
	add_score(last_match_points)


## 全部卡片消除完毕时由棋盘调用；只在 PLAYING 状态生效（幂等）。
func win_game() -> void:
	if state != State.PLAYING:
		return
	state = State.WON
	state_changed.emit(state)


## 倒计时归零时由 tick() 调用；只在 PLAYING 状态生效（幂等）。
func lose_game() -> void:
	if state != State.PLAYING:
		return
	state = State.LOST
	state_changed.emit(state)


## 对局内复位：分数清零、时间回满（state 由调用方决定）。
func _reset_run() -> void:
	score = 0
	time_left = start_time()
	score_changed.emit(score)
	time_changed.emit(time_left)


## 应用调参覆盖（调参面板与壳页面 __GAME_TUNING__ 桥共用的唯一入口）：
## 只认 TUNING_META 声明的键、按 min/max 钳制；返回实际生效的键名列表。
func apply_tuning(overrides: Dictionary) -> PackedStringArray:
	var applied := PackedStringArray()
	for key: String in overrides:
		var meta: Dictionary = TUNING_META.get(StringName(key), {})
		if meta.is_empty() or get(key) == null:
			continue
		var raw: Variant = overrides[key]
		if not (raw is float or raw is int):
			continue
		set(key, clampf(float(raw), meta["min"], meta["max"]))
		applied.append(key)
	return applied


## Web 调参桥读入：壳页面在引擎加载前把 URL ?tuning=<JSON> 解析到 window.__GAME_TUNING__，
## 这里在启动时应用。桌面/无头环境桥不工作（eval 返回 null），自动跳过（冒烟不受影响）。
## JavaScriptBridge 经 Engine.get_singleton 动态取用，不做编译期平台引用。
func _apply_web_tuning() -> void:
	if not Engine.has_singleton("JavaScriptBridge"):
		return
	var bridge: Object = Engine.get_singleton("JavaScriptBridge")
	var result: Variant = bridge.call("eval", "JSON.stringify(window.__GAME_TUNING__ || null)")
	if result == null:
		return
	var raw := str(result)
	if raw.is_empty() or raw == "null":
		return
	var parsed: Variant = JSON.parse_string(raw)
	if parsed is Dictionary:
		apply_tuning(parsed)
