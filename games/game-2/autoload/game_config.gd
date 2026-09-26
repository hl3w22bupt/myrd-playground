extends Node
## 数值配置单例（autoload，注册名 GameConfig）：玩法数值的唯一运行时来源。
##
## 规范要点：
## - 只放「配置 + 纯逻辑」，不放场景/节点引用（同 autoload/game_state.gd）；
## - 不声明 class_name：autoload 单例名与 class_name 同名会触发
##   preflight P4（hides an autoload singleton）；
## - 必须在 [autoload] 里注册在 GameState 之前：GameState 依赖本单例的数值。

## 配置文件路径：改这里的数值即可调游戏，无需改代码（需求验收标准 5）。
const CONFIG_PATH: String = "res://config/gameplay.cfg"

## 收集一颗星尘的得分（默认 +1）。
var score_per_crystal: int = 1
## 撞上一次陨石扣除的护盾（默认 -1）。
var damage_per_hit: int = 1
## 初始护盾点数（默认 3）。
var initial_shield: int = 3
## 受击后的无敌帧时长（秒）。
var invincibility_seconds: float = 0.8
## 场上星尘常驻数量。
var max_crystals: int = 6
## 场上陨石常驻数量。
var max_asteroids: int = 5
## 陨石漂移速度下限（像素/秒）。
var asteroid_speed_min: float = 40.0
## 陨石漂移速度上限（像素/秒）。
var asteroid_speed_max: float = 110.0
## 玩家飞船移速（像素/秒）。
var player_speed: float = 240.0
## 星尘被收集后补位延迟（秒）。
var respawn_delay_seconds: float = 1.5

## ── 难度梯度（本节点新增）──
## 每收集多少分提升一级难度（0 = 关闭梯度，恒定难度）。
var difficulty_step: int = 8
## 每提升一级难度，陨石常驻数量增加多少。
var difficulty_asteroids_per_level: int = 1
## 难度提升后陨石常驻数量的封顶（梯度的天花板，防止刷满屏幕）。
var difficulty_asteroids_cap: int = 10
## 每提升一级难度，陨石漂移速度乘以的增量比例（线性叠加后封顶）。
var difficulty_speed_per_level: float = 0.15
## 难度提升后陨石速度的倍率封顶（相对 asteroid_speed_min/max 基准）。
var difficulty_speed_cap_scale: float = 1.8

## ── 胜利目标（本节点新增）──
## 本局得分达到该值即触发胜利结算（面板 + 可重开）；0 = 无尽模式，
## 唯一终局回到需求口径「护盾耗尽本轮结束」。
var score_target: int = 20

## ── 里程碑反馈（本节点新增）──
## 每收集多少分弹出一次里程碑庆祝横幅（0 = 关闭）。
var milestone_step: int = 10


func _ready() -> void:
	apply_config_file()
	apply_tuning_bridge()


## ── 调参桥（§3C 调参工作台硬契约，消费端）──
## 壳页面在引擎加载前把 URL 参数 `?tuning=<json>` 解析进 `window.__GAME_TUNING__`；
## 本单例在 Web 构建启动时读取它覆盖调参区数值。协议约束：
## - 只认 TUNING_META 声明的键（未知键一律忽略，防止壳端注入任意字段）；
## - 数值按 TUNING_META 的 min/max 钳制（越界值落到边界）；
## - 类型跟随本单例对应成员的声明类型（int/float 显式转换）；
## - 仅 Web 构建生效（OS.has_feature("web")），桌面/无头冒烟零影响；
## - 解析失败静默回退内置/配置文件数值，绝不让调参桥变成启动故障点。
const TUNING_META: Dictionary = {
	"score_per_crystal": {"min": 1.0, "max": 10.0},
	"damage_per_hit": {"min": 1.0, "max": 3.0},
	"initial_shield": {"min": 1.0, "max": 10.0},
	"invincibility_seconds": {"min": 0.2, "max": 3.0},
	"max_crystals": {"min": 1.0, "max": 12.0},
	"max_asteroids": {"min": 0.0, "max": 14.0},
	"asteroid_speed_min": {"min": 10.0, "max": 200.0},
	"asteroid_speed_max": {"min": 20.0, "max": 400.0},
	"player_speed": {"min": 80.0, "max": 600.0},
	"respawn_delay_seconds": {"min": 0.0, "max": 5.0},
	"difficulty_step": {"min": 2.0, "max": 50.0},
	"difficulty_asteroids_per_level": {"min": 0.0, "max": 5.0},
	"difficulty_asteroids_cap": {"min": 0.0, "max": 20.0},
	"difficulty_speed_per_level": {"min": 0.0, "max": 1.0},
	"difficulty_speed_cap_scale": {"min": 1.0, "max": 4.0},
	"score_target": {"min": 0.0, "max": 200.0},
	"milestone_step": {"min": 0.0, "max": 100.0},
}


## 应用壳页注入的调参覆盖（仅 Web；无注入时是零副作用空操作）。
func apply_tuning_bridge() -> void:
	if not OS.has_feature("web"):
		return
	var raw: Variant = null
	if ClassDB.class_exists("JavaScriptBridge"):
		raw = JavaScriptBridge.eval(
			"window.__GAME_TUNING__ ? JSON.stringify(window.__GAME_TUNING__) : ''", true)
	if raw == null or String(raw).is_empty():
		return
	var overrides: Variant = JSON.parse_string(String(raw))
	if typeof(overrides) != TYPE_DICTIONARY:
		push_warning("GameConfig: __GAME_TUNING__ 不是对象，忽略调参覆盖")
		return
	var applied: int = 0
	for key: String in TUNING_META.keys():
		if not overrides.has(key):
			continue
		var meta: Dictionary = TUNING_META[key]
		var current: Variant = get(key)
		var value: Variant = overrides[key]
		if typeof(value) != TYPE_FLOAT and typeof(value) != TYPE_INT:
			continue
		var clamped: float = clampf(float(value), float(meta["min"]), float(meta["max"]))
		if typeof(current) == TYPE_INT:
			set(key, int(round(clamped)))
		elif typeof(current) == TYPE_FLOAT:
			set(key, clamped)
		applied += 1
	print("GameConfig: 调参桥已应用 %d 项覆盖（共 %d 项可调）" % [applied, TUNING_META.size()])


## 从 CONFIG_PATH 读入数值；缺文件/缺键时保留上方内置默认值，不视为致命错误。
func apply_config_file() -> void:
	var config := ConfigFile.new()
	if config.load(CONFIG_PATH) != OK:
		push_warning("GameConfig: 读不到 %s，使用内置默认数值" % CONFIG_PATH)
		return
	score_per_crystal = config.get_value("gameplay", "score_per_crystal", score_per_crystal)
	damage_per_hit = config.get_value("gameplay", "damage_per_hit", damage_per_hit)
	initial_shield = config.get_value("gameplay", "initial_shield", initial_shield)
	invincibility_seconds = config.get_value("gameplay", "invincibility_seconds", invincibility_seconds)
	max_crystals = config.get_value("gameplay", "max_crystals", max_crystals)
	max_asteroids = config.get_value("gameplay", "max_asteroids", max_asteroids)
	asteroid_speed_min = config.get_value("gameplay", "asteroid_speed_min", asteroid_speed_min)
	asteroid_speed_max = config.get_value("gameplay", "asteroid_speed_max", asteroid_speed_max)
	player_speed = config.get_value("gameplay", "player_speed", player_speed)
	respawn_delay_seconds = config.get_value("gameplay", "respawn_delay_seconds", respawn_delay_seconds)
	difficulty_step = config.get_value("gameplay", "difficulty_step", difficulty_step)
	difficulty_asteroids_per_level = config.get_value(
		"gameplay", "difficulty_asteroids_per_level", difficulty_asteroids_per_level)
	difficulty_asteroids_cap = config.get_value(
		"gameplay", "difficulty_asteroids_cap", difficulty_asteroids_cap)
	difficulty_speed_per_level = config.get_value(
		"gameplay", "difficulty_speed_per_level", difficulty_speed_per_level)
	difficulty_speed_cap_scale = config.get_value(
		"gameplay", "difficulty_speed_cap_scale", difficulty_speed_cap_scale)
	score_target = config.get_value("gameplay", "score_target", score_target)
	milestone_step = config.get_value("gameplay", "milestone_step", milestone_step)
