extends Node
## GameState：跨场景全局状态 + 本作唯一数值口径（需求 cmujmowd6003bm99i5zjlwlzz）。
##
## 数值全部出自统一配置 config/game_config.json（验收 5：改配置重开一局即生效，不改代码）：
##   V = V0 × (1 + 0.10 × N)，封顶 2.0x；封顶后每颗水晶 +50 分；被陨石击中 N 清零回 V0，1s 无敌。
## 配置缺失/损坏时回退内置默认值并告警，保证工程总能跑起来。

signal score_changed(score: int)
signal hp_changed(hp: int)
signal speed_changed(speed_px_s: float)
signal crystal_streak_changed(streak: int)
signal player_hit(hp: int)
signal run_started()
signal run_ended(result: Dictionary)

enum Phase { READY, PLAYING, ENDED }

## 内置默认配置（与 config/game_config.json 同源；文件缺失或字段缺失时兜底）。
const DEFAULT_CONFIG: Dictionary = {
	"speed": {"base": 100.0, "step": 0.10, "cap": 2.0, "capBonusScore": 50},
	"hit": {"hp": 3, "invincibleSec": 1.0},
	"run": {"timeLimitSec": 120.0, "scorePerSecAtBase": 10.0},
	"player": {"moveSpeed": 260.0, "marginPx": 16.0},
	"crystal": {"spawnIntervalSec": 1.1, "spawnJitterSec": 0.4, "tightenSlope": 0.10, "fallFactor": 1.0},
	"meteor": {
		"spawnIntervalSec": 0.8, "spawnJitterSec": 0.3, "tightenSlope": 0.06, "shipClearancePx": 80.0,
		"types": [
			{"key": "red", "color": "#FF4D5E", "radiusMin": 22.0, "radiusMax": 28.0, "relativeSpeed": 0.85, "swayAmpPx": 0.0, "swayFreqHz": 0.0, "weight": 0.40},
			{"key": "yellow", "color": "#FFD24A", "radiusMin": 14.0, "radiusMax": 18.0, "relativeSpeed": 1.0, "swayAmpPx": 40.0, "swayFreqHz": 1.6, "weight": 0.35},
			{"key": "blue", "color": "#4DB8FF", "radiusMin": 10.0, "radiusMax": 14.0, "relativeSpeed": 1.3, "swayAmpPx": 0.0, "swayFreqHz": 0.0, "weight": 0.25},
		],
	},
	"visual": {
		"bg": "#0B0B22", "band1": "#1B1040", "band2": "#122A4D",
		"meteorOutline": "#0E0E20", "crystal": "#7FF6E8", "starCount": 90,
	},
}

const CONFIG_PATH: String = "res://config/game_config.json"

var config: Dictionary = {}
var phase: int = Phase.READY
var hp: int = 3
var crystal_streak: int = 0
var total_crystals: int = 0
var score: float = 0.0
var run_time_sec: float = 0.0
var max_speed_px_s: float = 0.0
var invincible_until_sec: float = -1.0
var last_result: Dictionary = {}


func _ready() -> void:
	load_config()


## 读取统一数值配置：整体以默认值打底，再深合并 JSON 覆盖项。
func load_config() -> void:
	config = DEFAULT_CONFIG.duplicate(true)
	if not FileAccess.file_exists(CONFIG_PATH):
		push_warning("game_config.json 缺失，使用内置默认配置")
		return
	var file := FileAccess.open(CONFIG_PATH, FileAccess.READ)
	if file == null:
		push_warning("game_config.json 打开失败，使用内置默认配置")
		return
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	if typeof(parsed) != TYPE_DICTIONARY:
		push_warning("game_config.json 解析失败，使用内置默认配置")
		return
	_merge_config(config, parsed)


func _merge_config(base: Dictionary, override: Dictionary) -> void:
	for key: String in override:
		var value: Variant = override[key]
		if value is Dictionary and base.get(key) is Dictionary:
			_merge_config(base[key], value)
		else:
			base[key] = value


# ── 提速口径（唯一基准，全部由配置驱动）──

func speed_base() -> float:
	return float(config["speed"]["base"])


func speed_step() -> float:
	return float(config["speed"]["step"])


func speed_cap() -> float:
	return float(config["speed"]["cap"])


func cap_bonus_score() -> int:
	return int(config["speed"]["capBonusScore"])


## 档位倍率：1 + step × N，封顶 cap。
func speed_multiplier() -> float:
	return minf(1.0 + speed_step() * float(crystal_streak), speed_cap())


## 实际速度 px/s = V0 × 档位。
func speed() -> float:
	return speed_base() * speed_multiplier()


## HUD 档位文案（如 1.0x / 1.5x / 2.0x）。
func speed_label() -> String:
	return "%.1fx" % speed_multiplier()


func cap_reached() -> bool:
	return speed_multiplier() >= speed_cap()


func invincible_active() -> bool:
	return phase == Phase.PLAYING and run_time_sec < invincible_until_sec


func invincible_remaining_sec() -> float:
	return maxf(0.0, invincible_until_sec - run_time_sec)


func player_move_speed() -> float:
	return float(config["player"]["moveSpeed"])


func player_margin() -> float:
	return float(config["player"]["marginPx"])


func score_int() -> int:
	return int(score)


## ── 运行状态机 ──

## 拾取水晶：未封顶 → N+1 提速；已封顶 → 每颗 +50 分（纯增量）。
func collect_crystal() -> void:
	if phase != Phase.PLAYING:
		return
	total_crystals += 1
	if cap_reached():
		add_score_raw(float(cap_bonus_score()))
		return
	crystal_streak += 1
	max_speed_px_s = maxf(max_speed_px_s, speed())
	crystal_streak_changed.emit(crystal_streak)
	speed_changed.emit(speed())


## 被陨石击中：HP-1、N 清零回 V0、1s 无敌闪烁；HP 归零立即结算失败。
func take_hit() -> void:
	if phase != Phase.PLAYING or invincible_active():
		return
	hp -= 1
	crystal_streak = 0
	invincible_until_sec = run_time_sec + float(config["hit"]["invincibleSec"])
	player_hit.emit(hp)
	hp_changed.emit(hp)
	crystal_streak_changed.emit(0)
	speed_changed.emit(speed())
	if hp <= 0:
		finish_run("destroyed")


## 每物理帧推进：存活计时 + 得分增速（score/s = 10 × 档位）+ 终点判定。
func tick(delta: float) -> void:
	if phase != Phase.PLAYING:
		return
	run_time_sec += delta
	add_score_raw(float(config["run"]["scorePerSecAtBase"]) * speed_multiplier() * delta)
	if run_time_sec >= float(config["run"]["timeLimitSec"]):
		run_time_sec = float(config["run"]["timeLimitSec"])
		finish_run("arrived")


## 内部计分：整数部分变化才广播，避免每帧刷信号。
func add_score_raw(amount: float) -> void:
	if amount == 0.0:
		return
	var before := score_int()
	score += amount
	if score_int() != before:
		score_changed.emit(score_int())


## 开局（重开同用）：重读配置（验收 5）→ 清空单局状态 → 广播 run_started。
func start_run() -> void:
	load_config()
	hp = int(config["hit"]["hp"])
	crystal_streak = 0
	total_crystals = 0
	score = 0.0
	run_time_sec = 0.0
	max_speed_px_s = speed_base()
	invincible_until_sec = -1.0
	last_result = {}
	phase = Phase.PLAYING
	hp_changed.emit(hp)
	speed_changed.emit(speed())
	crystal_streak_changed.emit(0)
	score_changed.emit(score_int())
	run_started.emit()


## 单局结算：reason = "arrived"（到终点，胜）/ "destroyed"（生命归零，败）。
func finish_run(reason: String) -> void:
	if phase != Phase.PLAYING:
		return
	phase = Phase.ENDED
	last_result = {
		"reason": reason,
		"survivedSec": snappedf(run_time_sec, 0.1),
		"crystals": total_crystals,
		"maxSpeedMultiplier": snappedf(max_speed_px_s / speed_base(), 0.1),
		"maxSpeedPxS": snappedf(max_speed_px_s, 1.0),
		"score": score_int(),
	}
	run_ended.emit(last_result)
