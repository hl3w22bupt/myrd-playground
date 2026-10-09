extends Node
## 自动加载单例（autoload）：跨场景共享的全局状态 + 数值调参区。
##
## 注册方式：project.godot 的 [autoload] 段写 `GameState="*res://autoload/game_state.gd"`。
## `*` 前缀 = 单例模式（全局唯一）；脚本必须 extends Node，否则无法挂到场景树根部。
##
## 规范（见技能包 SKILL.md「GDScript 规范」「调参工作台」）：
## - autoload 只放「状态 + 纯逻辑」，不放场景/节点引用；
## - 跨场景通信一律走信号，禁止 autoload 反向持有场景节点；
## - 可调数值集中在本文件的调参区：变量 + TUNING_META 成对声明，键名与 spec.numeric 对应，
##   消费方只读变量、禁止散落魔数。

## 分数变化信号：场景层订阅它刷新 UI，而不是主动轮询。
signal score_changed(score: int)
## 连击变化（combo=0 表示刚被 MISS 清零）。
signal combo_changed(combo: int, max_combo: int)
## 一次判定落定（judgment 取 BeatJudge.Judgment 的 int 值）。
signal judgment_recorded(judgment: int)
## 一局结束（cleared = 达成通关线）。
signal game_finished(cleared: bool)

## ── 难度分级（同一曲目 4 档：下落速度与 note 密度区分）──
## fall_speed_px_s：音符下落速度；note_interval_s：谱面内相邻音符的最小时间间隔。
const DIFFICULTY_TABLE: Array[Dictionary] = [
	{"name": "Easy", "fall_speed_px_s": 300.0, "note_interval_s": 1.10},
	{"name": "Normal", "fall_speed_px_s": 380.0, "note_interval_s": 0.85},
	{"name": "Hard", "fall_speed_px_s": 470.0, "note_interval_s": 0.62},
	{"name": "Expert", "fall_speed_px_s": 560.0, "note_interval_s": 0.46},
]
const DIFFICULTY_COUNT: int = 4

## 判定得分权重（AC5：Perfect=100 / Good=60，可人工复算）。
const SCORE_PERFECT: int = 100
const SCORE_GOOD: int = 60
## 通关线：命中率（(perfect + good) / 总音符数）达到即视为 cleared。
const CLEAR_ACCURACY: float = 0.6

## 设置持久化路径（延迟校准偏移、难度选择；重启后仍生效）。
const SETTINGS_PATH := "user://settings.cfg"

var score: int = 0
var combo: int = 0
var max_combo: int = 0
var perfect_count: int = 0
var good_count: int = 0
var miss_count: int = 0
## 本局音符总数（由谱面生成后写入，用于结算命中率）。
var total_notes: int = 0

var difficulty: int = 1

## ── 数值调参区（SKILL.md §3C 调参工作台的 spec.numeric 对接面）──
## 判定窗口（毫秒，以音频/歌曲时钟为基准）：PERFECT ±50ms，GOOD ±100ms（需求验收口径）。
var perfect_window_ms: float = 50.0
var good_window_ms: float = 100.0
## 全局下落速度倍率（难度表数值 × 该倍率）。
var note_speed_scale: float = 1.0
## 延迟校准偏移（毫秒，±300ms、步长 10ms；持久化，重启仍生效）。
var calibration_offset_ms: float = 0.0

const TUNING_META: Dictionary = {
	&"perfect_window_ms": {"min": 30.0, "max": 80.0, "step": 5.0},
	&"good_window_ms": {"min": 60.0, "max": 150.0, "step": 10.0},
	&"note_speed_scale": {"min": 0.5, "max": 2.0, "step": 0.05},
	&"calibration_offset_ms": {"min": -300.0, "max": 300.0, "step": 10.0},
}


func _ready() -> void:
	_load_settings()
	_apply_web_tuning()


## ── 一局流程 ──

## 局开始（谱面就绪）：清空本局计数。
func begin_run(total: int) -> void:
	total_notes = total
	reset_counts()
	score_changed.emit(score)


## 命中一次（PERFECT / GOOD）：累计 combo 与分数。
func register_hit(judgment: int) -> void:
	if judgment == 0:  # BeatJudge.Judgment.PERFECT
		perfect_count += 1
		score += SCORE_PERFECT
	else:
		good_count += 1
		score += SCORE_GOOD
	combo += 1
	max_combo = maxi(max_combo, combo)
	judgment_recorded.emit(judgment)
	score_changed.emit(score)
	combo_changed.emit(combo, max_combo)


## MISS（漏按 / 超窗）：combo 立即清零。
func register_miss(judgment: int = 2) -> void:
	miss_count += 1
	combo = 0
	judgment_recorded.emit(judgment)
	combo_changed.emit(combo, max_combo)


## 一局结束：cleared = 命中率达标。
func finish() -> bool:
	var hit := perfect_count + good_count
	var accuracy := float(hit) / float(maxi(total_notes, 1))
	var cleared := accuracy >= CLEAR_ACCURACY
	game_finished.emit(cleared)
	return cleared


## 复位（重开 / 试玩驱动换局调用）：清零本局全部状态。
func reset() -> void:
	score = 0
	combo = 0
	max_combo = 0
	reset_counts()
	score_changed.emit(score)
	combo_changed.emit(combo, max_combo)


func reset_counts() -> void:
	perfect_count = 0
	good_count = 0
	miss_count = 0


func difficulty_name() -> String:
	var entry: Dictionary = DIFFICULTY_TABLE[clampi(difficulty, 0, DIFFICULTY_COUNT - 1)]
	return String(entry["name"])


func fall_speed_px_s() -> float:
	var entry: Dictionary = DIFFICULTY_TABLE[clampi(difficulty, 0, DIFFICULTY_COUNT - 1)]
	return float(entry["fall_speed_px_s"]) * note_speed_scale


func note_interval_s() -> float:
	var entry: Dictionary = DIFFICULTY_TABLE[clampi(difficulty, 0, DIFFICULTY_COUNT - 1)]
	return float(entry["note_interval_s"])


## ── 延迟校准（±300ms、步长 10ms，持久化）──

func add_calibration(delta_ms: float) -> void:
	calibration_offset_ms = clampf(
		roundf((calibration_offset_ms + delta_ms) / 10.0) * 10.0, -300.0, 300.0)
	save_settings()
	score_changed.emit(score)  # 复用分数信号让 HUD 刷新校准显示


func set_difficulty(value: int) -> void:
	difficulty = clampi(value, 0, DIFFICULTY_COUNT - 1)
	save_settings()


func save_settings() -> void:
	var cfg := ConfigFile.new()
	cfg.set_value("input", "calibration_offset_ms", calibration_offset_ms)
	cfg.set_value("game", "difficulty", difficulty)
	cfg.save(SETTINGS_PATH)


func _load_settings() -> void:
	var cfg := ConfigFile.new()
	if cfg.load(SETTINGS_PATH) != OK:
		return
	calibration_offset_ms = clampf(float(cfg.get_value("input", "calibration_offset_ms", 0.0)),
		-300.0, 300.0)
	difficulty = clampi(int(cfg.get_value("game", "difficulty", 1)), 0, DIFFICULTY_COUNT - 1)


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
