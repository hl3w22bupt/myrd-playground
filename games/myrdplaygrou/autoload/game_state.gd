extends Node
## 自动加载单例（autoload）：全局对局状态 + 关卡表 + 数值调参区。
##
## 注册方式：project.godot 的 [autoload] 段写 `GameState="*res://autoload/game_state.gd"`。
## `*` 前缀 = 单例模式（全局唯一）；脚本必须 extends Node，否则无法挂到场景树根部。
##
## 规范（见技能包 SKILL.md「GDScript 规范」「调参工作台」）：
## - autoload 只放「状态 + 纯逻辑」，不放场景/节点引用；
## - 跨场景通信一律走信号，禁止 autoload 反向持有场景节点；
## - 可调数值集中在本文件调参区：变量 + TUNING_META 成对声明，键名与 spec.numeric 对应，
##   消费方（defender.gd / zombie.gd 等）只读变量、禁止散落魔数。

## 阳光余额变化（布防消耗、产出增加都会发）；场景层订阅它刷新 HUD。
signal sun_changed(sun: int)
## 本局累计产出（阳光总收入）变化；机器人试玩门禁（playtest）以此锚定「开局正反馈」。
signal score_changed(score: int)
## 生命（防线被突破次数）变化。
signal lives_changed(lives: int)
## 波次推进（wave 为 0 起索引，wave_count 为总数）。
signal wave_changed(wave: int, wave_count: int)
## 对局终局：true = 通关（全部波次守完），false = 失败（生命耗尽）。
signal game_ended(won: bool)
## 开局（选关或重开）。
signal level_started(level_index: int)

## ── 对局常量（初始经济 / 防线容错）──
const START_SUN: int = 150
const START_LIVES: int = 3
## 每击杀一只僵尸的阳光奖励。
const KILL_SUN: int = 10

## ── 对局状态 ──
## 当前阳光余额（布防货币）。
var sun: int = START_SUN
## 本局累计阳光总收入（= score，时间产出 + 击杀产出 + 天降阳光）。
var score: int = 0
## 剩余生命（僵尸突破防线 -1，归零失败）。
var lives: int = START_LIVES
## 当前关卡（LEVELS 的 0 起索引）。
var level_index: int = 0
## 当前波次（0 起索引；wave_count() 为本关总波数）。
var wave_index: int = 0
## 对局进行中（false = 选关界面 / 结算界面）。
var running: bool = false

## ── 数值调参区（SKILL.md §3C 调参工作台的 spec.numeric 对接面）──
## 默认值 = spec.numeric 的当前定稿；试玩调参经 apply_tuning 覆盖，定稿回写 spec 后更新这里。
## 全部用 float：apply_tuning 走 set() + clampf，类型统一避免 set() 的整型转换歧义。
var sun_trickle_interval: float = 3.0
var sun_trickle_amount: float = 5.0
var sky_sun_interval: float = 6.0
var sky_sun_value: float = 25.0
var defender_cost: float = 50.0
var defender_hp: float = 100.0
var fire_interval: float = 0.9
var projectile_damage: float = 10.0
var projectile_speed: float = 420.0
var cursor_move_speed: float = 520.0

## 可调键的元数据：键名 → {min, max, step}。调参面板按它生成滑杆，apply_tuning 按它钳制。
## 新增可调数值 = 上面加变量 + 这里加一行，两处都在本文件。
const TUNING_META: Dictionary = {
	&"sun_trickle_interval": {"min": 1.0, "max": 10.0, "step": 0.5},
	&"sun_trickle_amount": {"min": 0.0, "max": 30.0, "step": 1.0},
	&"sky_sun_interval": {"min": 2.0, "max": 15.0, "step": 0.5},
	&"sky_sun_value": {"min": 5.0, "max": 60.0, "step": 5.0},
	&"defender_cost": {"min": 10.0, "max": 150.0, "step": 5.0},
	&"defender_hp": {"min": 30.0, "max": 400.0, "step": 10.0},
	&"fire_interval": {"min": 0.15, "max": 3.0, "step": 0.05},
	&"projectile_damage": {"min": 2.0, "max": 60.0, "step": 1.0},
	&"projectile_speed": {"min": 120.0, "max": 900.0, "step": 20.0},
	&"cursor_move_speed": {"min": 120.0, "max": 900.0, "step": 20.0},
}

## ── 关卡表（难度平缓递增：相邻关卡任意一项增幅 ≤ 30%，验收硬约束）──
## 波数 +20%/+16.7%；僵尸血量 +20%/+19.4%；速度 +19.2%/+16.1%；
## 出怪间隔 -9.4%/-10.3%（时间越短压力越大）；啃咬 dps +20%/+16.7%。
const LEVELS: Array[Dictionary] = [
	{"name": "初春草地", "waves": 5, "zombies_per_wave": 4, "zombie_hp": 30.0, "zombie_speed": 26.0, "spawn_interval": 3.2, "eat_dps": 10.0},
	{"name": "盛夏庭院", "waves": 6, "zombies_per_wave": 4, "zombie_hp": 36.0, "zombie_speed": 31.0, "spawn_interval": 2.9, "eat_dps": 12.0},
	{"name": "暮秋防线", "waves": 7, "zombies_per_wave": 4, "zombie_hp": 43.0, "zombie_speed": 36.0, "spawn_interval": 2.6, "eat_dps": 14.0},
]


func _ready() -> void:
	_apply_web_tuning()


## 本关配置（LEVELS 只读快照）。
func level() -> Dictionary:
	return LEVELS[clampi(level_index, 0, LEVELS.size() - 1)]


## 本关总波数。
func wave_count() -> int:
	return int(level().get("waves", 1))


## 每波僵尸数。
func zombies_per_wave() -> int:
	return int(level().get("zombies_per_wave", 1))


## 开局（选关进入或失败/胜利后重开当前关）：重置对局状态并广播。
func start_level(index: int) -> void:
	level_index = clampi(index, 0, LEVELS.size() - 1)
	wave_index = 0
	sun = START_SUN
	score = 0
	lives = START_LIVES
	running = true
	level_started.emit(level_index)
	sun_changed.emit(sun)
	lives_changed.emit(lives)
	wave_changed.emit(wave_index, wave_count())


## 重开当前关（playtest 驱动在局间也调用本方法；模板协议保留无参签名）。
func reset() -> void:
	start_level(level_index)


## 阳光入账（时间产出 / 天降阳光 / 击杀奖励）：余额与累计产出一起推进。
func add_sun(amount: int) -> void:
	if amount <= 0:
		return
	sun += amount
	score += amount
	sun_changed.emit(sun)
	score_changed.emit(score)


## 布防扣费：余额不足返回 false（调用方给失败反馈），成功扣款并广播。
func spend_sun(amount: int) -> bool:
	if amount > sun:
		return false
	sun -= amount
	sun_changed.emit(sun)
	return true


## 防线被突破：生命 -1；归零即失败（running 置否，广播终局）。
func lose_life() -> int:
	if not running:
		return lives
	lives = maxi(lives - 1, 0)
	lives_changed.emit(lives)
	if lives <= 0:
		running = false
		game_ended.emit(false)
	return lives


## 一波守完：推进波次；最后一波守完即通关（running 置否，广播终局）。
func complete_wave() -> void:
	if not running:
		return
	wave_index += 1
	if wave_index >= wave_count():
		running = false
		game_ended.emit(true)
	else:
		wave_changed.emit(wave_index, wave_count())


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
## 注意：JavaScriptBridge 单例在桌面二进制也存在但 eval 恒为 null —— 判空而非只判注册；
## 经 Engine.get_singleton 动态取用，不做编译期平台引用。
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
