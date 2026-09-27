extends Node
## 自动加载单例 GameState：跨场景共享的对局状态 + 纯逻辑（SKILL.md「GDScript 规范」）。
##
## 数值调参区：键名与知识基准《玩法设计基准：速度正反馈曲线与星云视觉》的
## 「数值配置节」逐键对应（speed.base / combo.windowSec / boost.durationSec …），
## 改数值 = 改配置，重开局生效；实现层不允许散落魔数。
##
## 规范：autoload 只放状态与纯逻辑，不持有场景节点；对外只发信号。

## 分数变化（收集水晶 / 倍率结算后）。
signal score_changed(score: int)
## 能量水晶累计数变化。
signal crystals_changed(count: int)
## 护盾格数变化（受击 / 重开）。
signal shield_changed(shield: int)
## 连击数变化（收集 / 超窗清零 / 受击清零）。
signal combo_changed(combo: int)
## 加速态开关与剩余时长变化。
signal boost_changed(active: bool, time_left: float)
## 飞船当前前进速度变化（HUD/星云滚动/陨石速度都读它）。
signal speed_changed(speed: float)
## 对局结束（护盾归零），参数为本局结算快照。
##（信号名不得与状态变量 game_over 同名，GDScript 禁止同名声明。）
signal game_finished(stats: Dictionary)

## ── 数值调参区（知识基准「数值配置节」）──────────────────────────
## 可变量而非 const：§3C 调参工作台硬契约 —— 壳页面把 URL ?tuning=<json> 解析进
## window.__GAME_TUNING__，这里 _ready() 时读取并按 TUNING_META 钳制覆盖（见下方调参桥）。
## 未传参 / 非导出平台 = 保持字面默认值，行为与 const 时代完全一致。
var SPEED_BASE: float = 100.0            ## speed.base 基础前进速度 px/s
var SPEED_BOOST_MUL: float = 1.35        ## speed.boostMul 加速态倍率（+35% ≥ 验收 +30%）
var SPEED_EASE_OUT_SEC: float = 1.5      ## speed.easeOutSec 加速退出缓动
var COMBO_WINDOW_SEC: float = 4.0        ## combo.windowSec 连击窗口
var COMBO_TRIGGER: int = 5               ## combo.trigger 触发加速的连击数
var BOOST_DURATION_SEC: float = 8.0      ## boost.durationSec 加速初始时长
var BOOST_EXTEND_SEC: float = 2.0        ## boost.extendSec 加速态内每颗水晶续时
var BOOST_CAP_SEC: float = 15.0          ## boost.capSec 加速总时长上限
var BOOST_SCORE_MULTIPLIER: int = 2      ## boost.scoreMultiplier 加速态得分倍率
var SCORE_PER_CRYSTAL: int = 10          ## score.crystal 单颗水晶分值
var SHIELD_MAX: int = 3                  ## shield.max 护盾格数
var SHIELD_INVINCIBLE_SEC: float = 1.0   ## shield.invincibleSec 受击无敌时长
var METEOR_SPAWN_INTERVAL_BASE: float = 2.0   ## meteor.spawnIntervalBase
var METEOR_SPAWN_DECAY: float = 0.88          ## meteor.spawnDecay 每档生成间隔系数
var METEOR_SPAWN_JITTER: float = 0.2          ## meteor.spawnJitter ±20%
var METEOR_CAP_BASE: int = 3                  ## meteor.capBase 同屏上限基数
var METEOR_CAP_STEP: int = 2                  ## meteor.capStep 每档增量
var METEOR_BOOST_CAP_ADD: int = 2             ## meteor.boostCapAdd 加速态上限修正
var METEOR_BOOST_INTERVAL_MUL: float = 0.85   ## meteor.boostIntervalMul 加速态间隔修正
var DIFFICULTY_STEP_SEC: float = 30.0    ## difficulty.stepSec 每档秒数
var DIFFICULTY_MAX: int = 6              ## difficulty.max 档位封顶
var CRYSTAL_INTERVAL_SEC: float = 1.1    ## crystal.intervalSec
var CRYSTAL_JITTER_SEC: float = 0.4      ## crystal.jitterSec ±0.4s
var CRYSTAL_MAX_ON_SCREEN: int = 4       ## crystal.maxOnScreen
var CRYSTAL_MIN_ON_SCREEN: int = 1       ## crystal.minOnScreen
var CRYSTAL_FORCE_SPAWN_AFTER_SEC: float = 3.0  ## crystal.forceSpawnAfterSec 保底刷新
var PLAYER_LATERAL_SPEED: float = 300.0  ## player.lateralSpeed 横移速度 px/s
var SPAWN_AVOID_SHIP_BAND: float = 80.0  ## spawn.avoidShipBand 防刷脸杀判定带
var SPAWN_MIN_GAP_RADIUS_MUL: float = 1.5       ## spawn.minGapRadiusMul 生成间距系数

const BEST_SAVE_PATH: String = "user://nebula_crystal_run.cfg"

## ── 调参桥（§3C 调参工作台硬契约）────────────────────────────────
## 键名 = 知识基准「数值配置节」的配置键；值 = 成员变量名 + 钳制区间 + 类型。
## 只认这张表声明的键，URL 里多出来的键一律忽略；数值按 min/max 钳制后覆盖成员变量。
const TUNING_META: Dictionary = {
	"speed.base": {"prop": "SPEED_BASE", "min": 40.0, "max": 400.0, "type": "float"},
	"speed.boostMul": {"prop": "SPEED_BOOST_MUL", "min": 1.0, "max": 3.0, "type": "float"},
	"speed.easeOutSec": {"prop": "SPEED_EASE_OUT_SEC", "min": 0.0, "max": 5.0, "type": "float"},
	"combo.windowSec": {"prop": "COMBO_WINDOW_SEC", "min": 1.0, "max": 10.0, "type": "float"},
	"combo.trigger": {"prop": "COMBO_TRIGGER", "min": 2.0, "max": 20.0, "type": "int"},
	"boost.durationSec": {"prop": "BOOST_DURATION_SEC", "min": 1.0, "max": 30.0, "type": "float"},
	"boost.extendSec": {"prop": "BOOST_EXTEND_SEC", "min": 0.0, "max": 10.0, "type": "float"},
	"boost.capSec": {"prop": "BOOST_CAP_SEC", "min": 1.0, "max": 60.0, "type": "float"},
	"boost.scoreMultiplier": {"prop": "BOOST_SCORE_MULTIPLIER", "min": 1.0, "max": 10.0, "type": "int"},
	"score.crystal": {"prop": "SCORE_PER_CRYSTAL", "min": 1.0, "max": 100.0, "type": "int"},
	"shield.max": {"prop": "SHIELD_MAX", "min": 1.0, "max": 9.0, "type": "int"},
	"shield.invincibleSec": {"prop": "SHIELD_INVINCIBLE_SEC", "min": 0.0, "max": 5.0, "type": "float"},
	"meteor.spawnIntervalBase": {"prop": "METEOR_SPAWN_INTERVAL_BASE", "min": 0.3, "max": 10.0, "type": "float"},
	"meteor.spawnDecay": {"prop": "METEOR_SPAWN_DECAY", "min": 0.5, "max": 1.0, "type": "float"},
	"meteor.spawnJitter": {"prop": "METEOR_SPAWN_JITTER", "min": 0.0, "max": 0.5, "type": "float"},
	"meteor.capBase": {"prop": "METEOR_CAP_BASE", "min": 1.0, "max": 20.0, "type": "int"},
	"meteor.capStep": {"prop": "METEOR_CAP_STEP", "min": 0.0, "max": 10.0, "type": "int"},
	"meteor.boostCapAdd": {"prop": "METEOR_BOOST_CAP_ADD", "min": 0.0, "max": 10.0, "type": "int"},
	"meteor.boostIntervalMul": {"prop": "METEOR_BOOST_INTERVAL_MUL", "min": 0.3, "max": 1.0, "type": "float"},
	"difficulty.stepSec": {"prop": "DIFFICULTY_STEP_SEC", "min": 5.0, "max": 120.0, "type": "float"},
	"difficulty.max": {"prop": "DIFFICULTY_MAX", "min": 1.0, "max": 20.0, "type": "int"},
	"crystal.intervalSec": {"prop": "CRYSTAL_INTERVAL_SEC", "min": 0.2, "max": 5.0, "type": "float"},
	"crystal.jitterSec": {"prop": "CRYSTAL_JITTER_SEC", "min": 0.0, "max": 2.0, "type": "float"},
	"crystal.maxOnScreen": {"prop": "CRYSTAL_MAX_ON_SCREEN", "min": 1.0, "max": 20.0, "type": "int"},
	"crystal.minOnScreen": {"prop": "CRYSTAL_MIN_ON_SCREEN", "min": 0.0, "max": 10.0, "type": "int"},
	"crystal.forceSpawnAfterSec": {"prop": "CRYSTAL_FORCE_SPAWN_AFTER_SEC", "min": 0.5, "max": 15.0, "type": "float"},
	"player.lateralSpeed": {"prop": "PLAYER_LATERAL_SPEED", "min": 50.0, "max": 900.0, "type": "float"},
	"spawn.avoidShipBand": {"prop": "SPAWN_AVOID_SHIP_BAND", "min": 0.0, "max": 300.0, "type": "float"},
	"spawn.minGapRadiusMul": {"prop": "SPAWN_MIN_GAP_RADIUS_MUL", "min": 1.0, "max": 4.0, "type": "float"},
}

## 陨石速度系数 k(D)：档位表 D1..D6 → 0.9x..1.4x（知识基准 2.1）。
const METEOR_SPEED_COEFF_STEP: float = 0.1
const METEOR_SPEED_COEFF_D1: float = 0.9

## ── 对局状态 ──
var score: int = 0
var crystals: int = 0
var shield: int = SHIELD_MAX
var combo: int = 0
var boost_active: bool = false
var boost_time_left: float = 0.0
var invincible_time: float = 0.0
var run_time: float = 0.0             ## 本局存活时长（秒）
var speed: float = SPEED_BASE         ## 当前前进速度（含加速与退出缓动）
var multiplier: int = 1               ## 当前得分倍率（加速态 2x，退出线性回落）
var game_over: bool = false
var running: bool = false
var best_score: int = 0

var _combo_timer: float = 0.0
var _ease_time_left: float = 0.0      ## 加速退出缓动剩余时间
var _speed_before_ease: float = SPEED_BASE


func _ready() -> void:
	_load_best()
	_apply_url_tuning()


## ── 调参桥：window.__GAME_TUNING__ → 调参区覆盖（Web 导出生效，其余平台空操作）──

## 读取壳页面在引擎加载前解析好的 URL ?tuning=<json>（缺页/未传参/解析失败 → null）。
func _read_url_tuning() -> Variant:
	if not OS.has_feature("web") or not ClassDB.class_exists("JavaScriptBridge"):
		return null
	var raw: String = str(JavaScriptBridge.eval("JSON.stringify(window.__GAME_TUNING__ || null)", true))
	if raw.is_empty() or raw == "null" or raw == "undefined":
		return null
	return JSON.parse_string(raw)


## 只认 TUNING_META 声明的键；数值按 min/max 钳制后写入对应成员变量（改配置重开局生效）。
func _apply_url_tuning() -> void:
	var tuning: Variant = _read_url_tuning()
	if typeof(tuning) != TYPE_DICTIONARY:
		return
	for key: String in TUNING_META.keys():
		if not (tuning as Dictionary).has(key):
			continue
		var meta: Dictionary = TUNING_META[key]
		var raw_value: Variant = (tuning as Dictionary)[key]
		if typeof(raw_value) != TYPE_FLOAT and typeof(raw_value) != TYPE_INT:
			continue
		var clamped: float = clampf(float(raw_value), float(meta["min"]), float(meta["max"]))
		set(meta["prop"], int(clamped) if meta["type"] == "int" else clamped)
		print("[GameState] tuning override %s = %s" % [key, str(get(meta["prop"]))])


## 每局开始 / 重开：全部状态归零，最高分保留（验收 5）。
func reset() -> void:
	score = 0
	crystals = 0
	shield = SHIELD_MAX
	combo = 0
	boost_active = false
	boost_time_left = 0.0
	invincible_time = 0.0
	run_time = 0.0
	speed = SPEED_BASE
	multiplier = 1
	game_over = false
	running = true
	_combo_timer = 0.0
	_ease_time_left = 0.0
	score_changed.emit(score)
	crystals_changed.emit(crystals)
	shield_changed.emit(shield)
	combo_changed.emit(combo)
	boost_changed.emit(false, 0.0)
	speed_changed.emit(speed)


## 与 playtest 门禁驱动约定的 reset 入口同义（保持显式命名）。
func start_run() -> void:
	reset()


func _physics_process(delta: float) -> void:
	if not running or game_over:
		return
	run_time += delta
	## 连击窗口：超窗清零（不扣已得分）。
	if combo > 0:
		_combo_timer -= delta
		if _combo_timer <= 0.0:
			combo = 0
			combo_changed.emit(combo)
	## 加速态倒计时。
	if boost_active:
		boost_time_left -= delta
		if boost_time_left <= 0.0:
			_end_boost()
	## 受击无敌帧。
	if invincible_time > 0.0:
		invincible_time = maxf(0.0, invincible_time - delta)
	_update_speed(delta)


## 难度档位 D(t) = min(6, 1 + floor(t / 30))（知识基准 2.1）。
func difficulty() -> int:
	return mini(DIFFICULTY_MAX, 1 + int(run_time / DIFFICULTY_STEP_SEC))


## 陨石速度系数 k(D) = 0.9 + 0.1 × (D − 1)。
func meteor_speed_coeff() -> float:
	return METEOR_SPEED_COEFF_D1 + METEOR_SPEED_COEFF_STEP * float(difficulty() - 1)


## 陨石生成间隔：base × 0.88^(D−1)，加速态 ×0.85；外部再叠 ±20% 抖动。
func meteor_spawn_interval() -> float:
	var value := METEOR_SPAWN_INTERVAL_BASE * pow(METEOR_SPAWN_DECAY, float(difficulty() - 1))
	if boost_active:
		value *= METEOR_BOOST_INTERVAL_MUL
	return value


## 陨石同屏上限 cap(D) = 3 + 2D，加速态 +2（知识基准 2.2）。
func meteor_cap() -> int:
	var cap := METEOR_CAP_BASE + METEOR_CAP_STEP * difficulty()
	if boost_active:
		cap += METEOR_BOOST_CAP_ADD
	return cap


## 收集一颗水晶：连击 → 加速态触发/续时 → 计分（验收 3 的状态机入口）。
func register_crystal_collected() -> void:
	if game_over:
		return
	combo += 1
	_combo_timer = COMBO_WINDOW_SEC
	if combo >= COMBO_TRIGGER:
		_trigger_or_extend_boost()
	crystals += 1
	score += SCORE_PER_CRYSTAL * multiplier
	crystals_changed.emit(crystals)
	score_changed.emit(score)
	combo_changed.emit(combo)


## 飞船被陨石击中：护盾 −1、连击清零、短暂无敌；返回是否真的扣了盾。
func take_hit() -> bool:
	if game_over or is_invincible():
		return false
	shield -= 1
	combo = 0
	_combo_timer = 0.0
	invincible_time = SHIELD_INVINCIBLE_SEC
	shield_changed.emit(shield)
	combo_changed.emit(combo)
	if shield <= 0:
		_finish_game()
	return true


func is_invincible() -> bool:
	return invincible_time > 0.0


## 结算快照（验收 2：得分 / 水晶数 / 存活时长 / 历史最高分）。
func stats() -> Dictionary:
	return {
		"score": score,
		"crystals": crystals,
		"run_time": run_time,
		"best_score": best_score,
	}


## ── 内部：加速态 ──

func _trigger_or_extend_boost() -> void:
	if boost_active:
		## 加速态内每颗水晶 +2.0s 续时，剩余时长封顶 15.0s（知识基准 1.2）。
		boost_time_left = minf(boost_time_left + BOOST_EXTEND_SEC, BOOST_CAP_SEC)
	else:
		boost_active = true
		boost_time_left = BOOST_DURATION_SEC
		_ease_time_left = 0.0
		multiplier = BOOST_SCORE_MULTIPLIER
	boost_changed.emit(boost_active, boost_time_left)


func _end_boost() -> void:
	boost_active = false
	boost_time_left = 0.0
	_speed_before_ease = speed
	_ease_time_left = SPEED_EASE_OUT_SEC
	boost_changed.emit(false, 0.0)


## 速度推进：加速态恒 1.35x；退出走 1.5s cubic ease-out 回落，禁止跳变（知识基准 1.2）。
func _update_speed(delta: float) -> void:
	if boost_active:
		var target := SPEED_BASE * SPEED_BOOST_MUL
		if not is_equal_approx(speed, target):
			speed = target
			multiplier = BOOST_SCORE_MULTIPLIER
			speed_changed.emit(speed)
		return  ## 加速态内不进回落逻辑（否则达标帧会被误拍回基础速度）
	if _ease_time_left > 0.0:
		_ease_time_left = maxf(0.0, _ease_time_left - delta)
		var t := 1.0 - _ease_time_left / SPEED_EASE_OUT_SEC
		t = clampf(t, 0.0, 1.0)
		var p := 1.0 - pow(1.0 - t, 3.0)
		speed = _speed_before_ease + (SPEED_BASE - _speed_before_ease) * p
		multiplier = BOOST_SCORE_MULTIPLIER + int(round(float(1 - BOOST_SCORE_MULTIPLIER) * p))
		if _ease_time_left <= 0.0:
			speed = SPEED_BASE
			multiplier = 1
		speed_changed.emit(speed)
	elif not is_equal_approx(speed, SPEED_BASE):
		speed = SPEED_BASE
		multiplier = 1
		speed_changed.emit(speed)


func _finish_game() -> void:
	game_over = true
	running = false
	if score > best_score:
		best_score = score
		_save_best()
	game_finished.emit(stats())


## ── 最高分持久化 ──

func _load_best() -> void:
	var config := ConfigFile.new()
	if config.load(BEST_SAVE_PATH) == OK:
		best_score = int(config.get_value("record", "best_score", 0))


func _save_best() -> void:
	var config := ConfigFile.new()
	config.set_value("record", "best_score", best_score)
	config.save(BEST_SAVE_PATH)
