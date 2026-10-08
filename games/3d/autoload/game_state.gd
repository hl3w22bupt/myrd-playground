extends Node
## 自动加载单例（autoload）：对局状态 + 计分规则 + 数值调参区。
##
## 注册方式：project.godot 的 [autoload] 段写 `GameState="*res://autoload/game_state.gd"`。
## `*` 前缀 = 单例模式（全局唯一）；脚本必须 extends Node，否则无法挂到场景树根部。
##
## 规范（见技能包 SKILL.md「GDScript 规范」「调参工作台」）：
## - autoload 只放「状态 + 纯逻辑」，不放场景/节点引用；
## - 跨场景通信一律走信号，禁止 autoload 反向持有场景节点；
## - 可调数值集中在本文件的调参区：变量 + TUNING_META 成对声明，键名与 spec.numeric 对应，
##   消费方（blade.gd / fruit.gd / main.gd）只读变量、禁止散落魔数。

## 分数变化（每切中 1 个苹果发一次）；场景层订阅它刷新 HUD，而不是主动轮询。
signal score_changed(score: int)
## 一刀连击结算（同一刀切中 ≥2 个苹果时）：count = 该刀苹果数，bonus = 连击加成分。
signal swing_combo(count: int, bonus: int)
## 对局结束：reason = &"bomb"（切中炸弹）或 &"time_up"（60 秒计时归零）。
signal round_ended(reason: StringName, stats: Dictionary)
## 破纪录：局末总分 > 历史最高分时发出。
signal record_broken(best: int)

## ── 对局状态 ──
var score: int = 0
var round_active: bool = false
var apples_sliced: int = 0        ## 本局切中苹果数
var missed_fruits: int = 0        ## 本局漏接（落出屏幕）的抛出物数 —— 不扣分，只计统计
var max_swing_combo: int = 0      ## 本局最高单刀连击数
var best_score: int = 0           ## 历史最高分（user:// 持久化，跨局保留）
var record_broken_this_round: bool = false

## ── 单刀连击判定：同一刀 = 相邻两次切中间隔 < combo_window 秒 ──
var _swing_count: int = 0
var _swing_expire_at: float = -1.0

const BEST_SCORE_PATH: String = "user://highscore.cfg"
const BEST_SCORE_KEY: String = "best_score"

## ── 数值调参区（SKILL.md §3C 调参工作台的 spec.numeric 对接面）──
## 默认值 = spec.numeric 的当前定稿；试玩调参经 apply_tuning 覆盖，定稿回写 spec 后更新这里。
var round_seconds: float = 60.0          ## 单局时长（需求：60 秒）
var apple_points: float = 10.0           ## 每切中 1 个苹果 +10
var combo_bonus_pair: float = 10.0       ## 一刀两果额外 +10（该刀合计 +30）
var combo_bonus_many: float = 20.0       ## 一刀三果及以上额外 +20（三果合计 +50）
var combo_window: float = 0.4            ## 「同一刀」的判定窗口（秒）
var bomb_ratio: float = 0.15             ## 抛出物中炸弹占比（需求：约 15%）
var spawn_interval_early: float = 1.5    ## 0-20s 抛出间隔
var spawn_interval_mid: float = 1.0      ## 20-40s 抛出间隔
var spawn_interval_late: float = 0.7     ## 40-60s 抛出间隔
var gravity: float = 12.0                ## 抛出物重力加速度
var throw_speed_min: float = 13.5        ## 抛出初速下限（决定抛物线顶点高度）
var throw_speed_max: float = 16.0        ## 抛出初速上限
var blade_speed: float = 26.0            ## 键盘/摇杆模式下刀锋移动速度（要能追上抛物线里的苹果）

## 可调键的元数据：键名 → {min, max, step}。调参面板按它生成滑杆，apply_tuning 按它钳制。
## 新增可调数值 = 上面加变量 + 这里加一行，两处都在本文件。
const TUNING_META: Dictionary = {
	&"round_seconds": {"min": 30.0, "max": 120.0, "step": 5.0},
	&"apple_points": {"min": 5.0, "max": 50.0, "step": 1.0},
	&"combo_bonus_pair": {"min": 0.0, "max": 40.0, "step": 1.0},
	&"combo_bonus_many": {"min": 0.0, "max": 60.0, "step": 1.0},
	&"combo_window": {"min": 0.2, "max": 1.0, "step": 0.05},
	&"bomb_ratio": {"min": 0.0, "max": 0.5, "step": 0.01},
	&"spawn_interval_early": {"min": 0.4, "max": 3.0, "step": 0.1},
	&"spawn_interval_mid": {"min": 0.3, "max": 2.5, "step": 0.1},
	&"spawn_interval_late": {"min": 0.2, "max": 2.0, "step": 0.1},
	&"gravity": {"min": 5.0, "max": 30.0, "step": 0.5},
	&"throw_speed_min": {"min": 9.0, "max": 20.0, "step": 0.5},
	&"throw_speed_max": {"min": 10.0, "max": 24.0, "step": 0.5},
	&"blade_speed": {"min": 4.0, "max": 40.0, "step": 1.0},
}


func _ready() -> void:
	_load_best_score()
	_apply_web_tuning()


## 开新局（main.gd _ready 与重开入口都会调用）：清零局内状态，保留历史最高分。
func begin_round() -> void:
	_reset_round_stats()
	round_active = true
	score_changed.emit(score)


## 结束当前局并结算历史最高分；reason = &"bomb" / &"time_up"。
func end_round(reason: StringName) -> void:
	if not round_active:
		return
	_flush_swing()
	round_active = false
	if score > best_score:
		best_score = score
		record_broken_this_round = true
		_save_best_score()
		record_broken.emit(best_score)
	round_ended.emit(reason, round_stats())


## 本局统计快照（结算面板展示用）。
func round_stats() -> Dictionary:
	return {
		"score": score,
		"apples": apples_sliced,
		"missed": missed_fruits,
		"max_combo": max_swing_combo,
		"best": best_score,
		"record_broken": record_broken_this_round,
	}


## 苹果漏接（落出屏幕）：不扣分，只计统计（需求「干扰物/统计」口径）。
func register_miss() -> void:
	if round_active:
		missed_fruits += 1


## 场景重置（重开按钮 / 冒烟与试玩驱动逐局复位）：清零局内统计。
## 注意：不动 round_active —— 对局生命周期只由 begin_round / end_round 管理。
## （试玩驱动在场景 _ready 之后才调 reset，若在此熄灭 round_active，新场景会停在「未开局」
##   状态直到下一份输入到来 —— 节奏门禁实测因此出现开局断档。）
func reset() -> void:
	score = 0
	apples_sliced = 0
	missed_fruits = 0
	max_swing_combo = 0
	record_broken_this_round = false
	_swing_count = 0
	_swing_expire_at = -1.0
	score_changed.emit(score)


func _reset_round_stats() -> void:
	score = 0
	round_active = false
	apples_sliced = 0
	missed_fruits = 0
	max_swing_combo = 0
	record_broken_this_round = false
	_swing_count = 0
	_swing_expire_at = -1.0


## ── 计分规则（需求「计分规则」节的唯一实现）──

## 切中 1 个苹果：+10 分立即入账；同一刀（combo_window 内）累加连击计数。
func register_apple_cut() -> void:
	if not round_active:
		return
	var now := _now_sec()
	if _swing_count > 0 and now > _swing_expire_at:
		_flush_swing()
	_swing_count += 1
	_swing_expire_at = now + combo_window
	if _swing_count > max_swing_combo:
		max_swing_combo = _swing_count
	apples_sliced += 1
	score += int(apple_points)
	score_changed.emit(score)


## 切中炸弹：本局立即结束（不计负分）。
func register_bomb_cut() -> void:
	if not round_active:
		return
	end_round(&"bomb")


## 计时归零（main.gd 的对局计时器调用）。
func register_time_up() -> void:
	if not round_active:
		return
	end_round(&"time_up")


## 立刻结算「当前刀」的连击加成（窗口自然到期时由 process 调用，局末强制冲账）。
func _flush_swing() -> void:
	if _swing_count <= 0:
		return
	var count := _swing_count
	_swing_count = 0
	_swing_expire_at = -1.0
	if count >= 3:
		var bonus := int(combo_bonus_many)
		score += bonus
		score_changed.emit(score)
		swing_combo.emit(count, bonus)
	elif count == 2:
		var bonus := int(combo_bonus_pair)
		score += bonus
		score_changed.emit(score)
		swing_combo.emit(count, bonus)


## 每帧推进连击窗口到期判定（main.gd._process 调用一次）。
func tick_swing_window() -> void:
	if _swing_count > 0 and _now_sec() > _swing_expire_at:
		_flush_swing()


func _now_sec() -> float:
	return float(Time.get_ticks_msec()) / 1000.0


## ── 历史最高分持久化（user://，本地存档）──

func _load_best_score() -> void:
	var config := ConfigFile.new()
	if config.load(BEST_SCORE_PATH) != OK:
		return
	var value: Variant = config.get_value("record", BEST_SCORE_KEY, 0)
	if value is int:
		best_score = value
	elif value is float:
		best_score = int(value)


func _save_best_score() -> void:
	var config := ConfigFile.new()
	config.set_value("record", BEST_SCORE_KEY, best_score)
	config.save(BEST_SCORE_PATH)


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
