extends Node
## 自动加载单例（autoload）：抓娃娃机全局状态 + 局态机 + 夹爪注册表 + 数值调参区。
##
## 注册方式：project.godot 的 [autoload] 段写 `GameState="*res://autoload/game_state.gd"`。
## 规范（见 SKILL.md）：autoload 只放「状态 + 纯逻辑」，不放场景/节点引用；
## 跨场景通信一律走信号；可调数值集中在调参区（变量 + TUNING_META 成对声明）。

## 分数变化（抓到娃娃入账 / 重开归零）。
signal score_changed(score: int)
## 游戏币变化（每次下爪消耗 1 枚）。
signal coins_changed(coins: int)
## 夹爪切换（id + 中文名，UI 与爪子绘制方订阅）。
signal claw_switched(claw_id: StringName, claw_name: String)
## 局态变化：进入 PLAYING / RESULT（won=是否达成目标）。
signal phase_changed(phase: int, won: bool)

## 局态：READY 未开局（预留）/ PLAYING 进行中 / RESULT 结算。
enum Phase { READY, PLAYING, RESULT }

## 夹爪注册表：3 种爪型，属性差异化（radius_mult 抓取半径 / power_mult 夹持稳定 / speed_mult 移动速度）。
## 需求验收 1：同一娃娃用不同爪型，成功率与表现必须可感知地不同。
const CLAW_TYPES: Array[Dictionary] = [
	{"id": &"triple", "name": "标准三爪", "radius_mult": 1.0, "power_mult": 1.0, "speed_mult": 1.0},
	{"id": &"twin", "name": "强力双爪", "radius_mult": 0.9, "power_mult": 1.5, "speed_mult": 0.92},
	{"id": &"scissor", "name": "剪刀爪", "radius_mult": 0.78, "power_mult": 0.78, "speed_mult": 1.2},
]

var phase: int = Phase.READY
var score: int = 0
var coins: int = 5
## 本局已抓到并落入取物口的娃娃数。
var dolls_collected: int = 0
## 背包/展示柜：本局抓到的娃娃名（结算与 HUD 展示用）。
var collected_names: PackedStringArray = []
var last_won: bool = false
## 当前夹爪下标（switch_claw 循环切换）。
var claw_index: int = 0
## 本局剩余时间（秒），_process 倒计时；PLAYING 才走表。
var time_left: float = 75.0

## ── 数值调参区（SKILL.md §3C 调参工作台的 spec.numeric 对接面）──
## 注意：全部声明为 float —— apply_tuning 经 set() 写入，float 写进 int 变量会运行报错。
var claw_speed: float = 300.0
var drop_speed: float = 420.0
var grab_radius: float = 52.0
var grab_stability: float = 0.8
var round_seconds: float = 75.0
var target_dolls: float = 3.0
var coins_start: float = 5.0

## 可调键的元数据：键名 → {min, max, step}。调参面板按它生成滑杆，apply_tuning 按它钳制。
const TUNING_META: Dictionary = {
	&"claw_speed": {"min": 80.0, "max": 600.0, "step": 10.0},
	&"drop_speed": {"min": 120.0, "max": 900.0, "step": 10.0},
	&"grab_radius": {"min": 16.0, "max": 90.0, "step": 2.0},
	&"grab_stability": {"min": 0.2, "max": 1.0, "step": 0.05},
	&"round_seconds": {"min": 30.0, "max": 180.0, "step": 5.0},
	&"target_dolls": {"min": 1.0, "max": 8.0, "step": 1.0},
	&"coins_start": {"min": 1.0, "max": 12.0, "step": 1.0},
}


func _ready() -> void:
	_apply_web_tuning()


## 局内倒计时（PLAYING 才走表；时间耗尽未达标 = 失败）。
func _process(delta: float) -> void:
	if phase != Phase.PLAYING:
		return
	time_left = maxf(time_left - delta, 0.0)
	if time_left <= 0.0:
		finish(false)


## 当前夹爪定义（含调参区基础值 × 爪型倍率后的有效参数）。
func current_claw() -> Dictionary:
	var base: Dictionary = CLAW_TYPES[claw_index]
	return {
		"id": base["id"],
		"name": base["name"],
		"radius": grab_radius * float(base["radius_mult"]),
		"power": grab_stability * float(base["power_mult"]),
		"speed_mult": float(base["speed_mult"]),
	}


func switch_claw() -> void:
	claw_index = (claw_index + 1) % CLAW_TYPES.size()
	var claw: Dictionary = CLAW_TYPES[claw_index]
	claw_switched.emit(claw["id"], claw["name"])


## 开局/重开：清状态、补币、回满时间，广播 phase_changed(PLAYING)。
## 场景层订阅它重摆娃娃、复位爪子。
func start_round() -> void:
	phase = Phase.PLAYING
	last_won = false
	score = 0
	coins = int(coins_start)
	dolls_collected = 0
	collected_names = PackedStringArray()
	time_left = round_seconds
	score_changed.emit(score)
	coins_changed.emit(coins)
	phase_changed.emit(phase, last_won)


## 下爪消耗 1 枚币；币不足返回 false（调用方给失败反馈，不抛错）。
func spend_coin() -> bool:
	if phase != Phase.PLAYING or coins <= 0:
		return false
	coins -= 1
	coins_changed.emit(coins)
	return true


## 娃娃落入取物口：入账 + 进背包；达标即胜。
func collect_doll(doll_name: String, doll_score: int) -> void:
	if phase != Phase.PLAYING:
		return
	dolls_collected += 1
	score += doll_score
	collected_names.append(doll_name)
	score_changed.emit(score)
	if dolls_collected >= int(target_dolls):
		finish(true)


## 结算：只有 PLAYING 能结算，防重复 finish。
func finish(won: bool) -> void:
	if phase != Phase.PLAYING:
		return
	phase = Phase.RESULT
	last_won = won
	phase_changed.emit(phase, won)


## 抓取周期结束后的败局判定：币尽且未达标 → 失败（爪子空闲时才判，避免打断空中周期）。
func check_coins_exhausted() -> void:
	if phase == Phase.PLAYING and coins <= 0 and dolls_collected < int(target_dolls):
		finish(false)


## 机器人试玩门禁的局间重置（playtest_driver 约定方法名）。
func reset() -> void:
	start_round()


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
