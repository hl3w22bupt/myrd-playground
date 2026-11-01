# playtest_driver —— 机器人试玩门禁的运行时驱动（由 scripts/playtest.sh 生成并运行）。
#
# 职责（通用层，只依赖模板协议：GameState / Juice 两个 autoload）：
#   1. 多种子各跑一局：实例化主场景，注入确定种子的随机输入流（bot 玩家）；
#   2. 全程采样两路时间序列：得分事件（GameState.score_changed）与反馈事件
#      （Juice.feedback_fired）——这是「好玩下限」的两个通用可判锚点；
#   3. 每局结算代理指标并与阈值比对：首次奖励时间、最长无反馈窗口、反馈事件密度、
#      局间结果方差（防「伪重玩」——换种子结果完全一样）；
#   4. 指标逐条机判，全部可读地写进日志，供 agent 按签名修复、供调参轮对照。
#
# 判定协议（包装脚本 playtest.sh 按此断言）：
#   GODOT_PLAYTEST: PASS  → 通过
#   GODOT_PLAYTEST: FAIL <原因> → 失败（逐条）
#   GODOT_PLAYTEST_METRICS: <单行 JSON> → 指标明细（工作流/调参轮可消费）
#
# 阈值来源（优先级从高到低）：环境变量 GODOT_PLAYTEST_FRAMES（局时长）→
# 工程内 tests/playtest.json（frames_per_run + thresholds）→ 本文件内置默认。
# 阈值与 spec.content 对齐的纪律见 SKILL.md §4.5：frames_per_run = 60 × 单局目标秒数。
#
# 边界：本驱动不判「好玩」（那是人 + playtest 验收节点的职责），只机判节奏类代理指标的
# 下限——反馈断档、开局无奖励、局间零差异这类「确定性可拦」的问题。
extends Node

## 每局物理帧数（60 tick = 1 秒游戏时间），默认 900 = 15 秒/局。
const DEFAULT_FRAMES_PER_RUN: int = 900
## 默认种子（3 局可复现；换种子属人工专项）。
const DEFAULT_SEEDS: Array[int] = [20260913, 20260914, 20260915]
## 内置默认阈值（可被 tests/playtest.json 的 thresholds 覆盖）。
const DEFAULT_THRESHOLDS: Dictionary = {
	"first_reward_seconds_max": 10.0,      # 开局多久内必须出现第一次得分事件；-1 = 不判
	"feedback_gap_seconds_max": 10.0,      # 最长无反馈窗口
	"feedback_events_min_per_run": 2,      # 每局反馈事件下限（反馈密度）
	"seed_outcomes_min_distinct": 1,       # 局间不同结果数下限；>1 才硬判（默认 1 = 只记录）
}

enum Phase { SETUP, PLAY, REPORT }

var _frames_per_run: int = DEFAULT_FRAMES_PER_RUN
var _thresholds: Dictionary = DEFAULT_THRESHOLDS.duplicate(true)
var _thresholds_source: String = "built-in"
var _seeds: Array[int] = DEFAULT_SEEDS.duplicate()
var _rng := RandomNumberGenerator.new()
var _main_scene: Node = null
var _packed: PackedScene = null
var _game_state: Node = null
var _juice: Node = null
var _has_score_signal: bool = false
var _has_feedback_signal: bool = false
var _actions: Array[StringName] = []

var _run_index: int = -1
var _phase: Phase = Phase.SETUP
var _tick: int = 0
var _sampling: bool = false
var _reward_ticks: Array[int] = []
var _feedback_ticks: Array[int] = []
var _run_results: Array[Dictionary] = []
var _failures: PackedStringArray = []
var _done: bool = false


func _ready() -> void:
	Engine.max_fps = 60  # 与 smoke 同理：headless 限帧让 --quit-after 的兜底有意义
	_load_config()
	_resolve_seeds()
	var main_scene_path: String = ProjectSettings.get_setting("application/run/main_scene", "")
	if main_scene_path == "":
		print("GODOT_PLAYTEST: FAIL 工程未设置 application/run/main_scene，试玩无从加载游戏")
		_done = true
		get_tree().quit(1)
		return
	_packed = load(main_scene_path)
	if _packed == null:
		print("GODOT_PLAYTEST: FAIL 主场景加载失败: ", main_scene_path)
		_done = true
		get_tree().quit(1)
		return
	for action in InputMap.get_actions():
		if not String(action).begins_with("ui_"):
			_actions.append(action)
	_game_state = get_tree().root.get_node_or_null("GameState")
	_juice = get_tree().root.get_node_or_null("Juice")
	if _game_state == null:
		_failures.append("autoload GameState 未注册（模板协议缺失，见 SKILL.md §4.5）")
	if _juice == null:
		_failures.append("autoload Juice 未注册（反馈单例缺失，按 SKILL.md §3B 补模板协议）")
	if _game_state != null and _game_state.has_signal("score_changed"):
		_has_score_signal = true
		_game_state.score_changed.connect(_on_score_changed)
	if _juice != null and _juice.has_signal("feedback_fired"):
		_has_feedback_signal = true
		_juice.feedback_fired.connect(_on_feedback_fired)
	print("[playtest] seeds=%s frames_per_run=%d thresholds=%s (source: %s) score_signal=%s feedback_signal=%s actions=%d main=%s" % [
		_seeds, _frames_per_run, JSON.stringify(_thresholds), _thresholds_source,
		_has_score_signal, _has_feedback_signal, _actions.size(), main_scene_path])
	if _actions.is_empty():
		_failures.append("InputMap 没有任何自定义动作（游戏没有注册输入，bot 无从游玩）")


func _physics_process(_delta: float) -> void:
	if _done or not _failures.is_empty():
		if not _done:
			_done = true
			_report()
		return
	match _phase:
		Phase.SETUP:
			_begin_run()
		Phase.PLAY:
			_play_tick()
		Phase.REPORT:
			_end_run()


## 开局：释放上一局场景、重实例化、重置状态与采样窗口。
## 同帧先 queue_free 旧场景再挂新场景 —— 旧场景本帧末被释放；
## 采样闸门（_sampling）保证 SETUP 期的杂散信号不进窗口。
func _begin_run() -> void:
	_run_index += 1
	if _main_scene != null and is_instance_valid(_main_scene):
		_main_scene.queue_free()
	_main_scene = _packed.instantiate()
	get_tree().root.add_child(_main_scene)
	if _game_state.has_method("reset"):
		_game_state.call("reset")
	if _juice.has_method("clear_events"):
		_juice.call("clear_events")
	_reward_ticks.clear()
	_feedback_ticks.clear()
	_sampling = false
	_rng.seed = _seeds[_run_index]
	_tick = 0
	_phase = Phase.PLAY


## bot 玩家：与 fuzz 同源的对抗事件流（动作/触摸/鼠标/按键 + 悬挂手势/孤儿释放），
## 确定种子驱动 —— 同种子同事件序，门禁可复现。
func _play_tick() -> void:
	_tick += 1
	if _tick == 1:
		_sampling = true  # 新场景已入树，从本帧起采样
	_inject_bot_events()
	if _tick >= _frames_per_run:
		_phase = Phase.REPORT


## 结算当前局：算局内指标 → 收集违约 → 进入下一局或总报告。
func _end_run() -> void:
	var first_reward: Variant = _first_of(_reward_ticks)
	var max_gap := _max_feedback_gap_seconds()
	var feedback_count := _feedback_ticks.size()
	var last_score: Variant = _last_score()
	var outcome := "score=%s|fb=%d" % [str(last_score) if last_score != null else "na", feedback_count]
	_run_results.append({
		"run": _run_index + 1,
		"seed": _seeds[_run_index],
		"first_reward_seconds": first_reward,
		"max_feedback_gap_seconds": max_gap,
		"feedback_events": feedback_count,
		"outcome": outcome,
	})
	# 局级阈值（逐条、可读；first_reward 阈值 < 0 = 显式关闭）
	var first_max: Variant = _thresholds["first_reward_seconds_max"]
	if _has_score_signal and typeof(first_max) == TYPE_FLOAT and float(first_max) >= 0.0:
		if first_reward == null:
			_failures.append("第 %d 局整局无任何得分事件（阈值 first_reward ≤ %ss）—— 核心循环没有可以被 bot 触发的正反馈" % [
				_run_index + 1, first_max])
		elif float(first_reward) > float(first_max):
			_failures.append("第 %d 局首次得分 %.1fs > 阈值 %ss —— 开局正反馈太晚" % [
				_run_index + 1, float(first_reward), first_max])
	var events_min: Variant = _thresholds["feedback_events_min_per_run"]
	if feedback_count < int(events_min):
		_failures.append("第 %d 局反馈事件 %d < 下限 %d —— 反馈密度不足（玩起来是哑的，见 §3B）" % [
			_run_index + 1, feedback_count, events_min])
	var gap_max: Variant = _thresholds["feedback_gap_seconds_max"]
	if float(max_gap) > float(gap_max):
		_failures.append("第 %d 局最长无反馈窗口 %.1fs > 阈值 %ss —— 节奏断档" % [
			_run_index + 1, max_gap, gap_max])
	if _run_index + 1 >= _seeds.size():
		_check_run_variance()
		_report()
		_done = true
		return
	_phase = Phase.SETUP


## 局间方差：结果签名（最终得分 + 反馈数）完全相同的局数太多 = 换种子换不出差异，
## 「重玩性」声明存疑。默认阈值 1 = 只记录不硬判；声明了重玩钩子的游戏把
## tests/playtest.json 的 seed_outcomes_min_distinct 设为 2。
func _check_run_variance() -> void:
	var distinct := {}
	for result in _run_results:
		distinct[result["outcome"]] = true
	var min_distinct: Variant = _thresholds["seed_outcomes_min_distinct"]
	if distinct.size() < int(min_distinct):
		_failures.append("%d 局结果签名完全相同（去重后 %d 种 < 下限 %d）—— 换种子无差异，重玩性声明与实现不符" % [
			_seeds.size(), distinct.size(), min_distinct])


func _report() -> void:
	var metrics := {
		"runs": _run_results,
		"frames_per_run": _frames_per_run,
		"thresholds": _thresholds,
		"thresholds_source": _thresholds_source,
	}
	print("GODOT_PLAYTEST_METRICS: ", JSON.stringify(metrics))
	if _failures.is_empty():
		print("GODOT_PLAYTEST: PASS %d 局全部通过（节奏代理指标在阈值内，明细见 METRICS 行）" % _seeds.size())
		get_tree().quit(0)
	else:
		for failure in _failures:
			printerr("GODOT_PLAYTEST: FAIL ", failure)
		get_tree().quit(1)


## ── 采样与指标 ──

func _on_score_changed(score: int) -> void:
	if _sampling:
		_reward_ticks.append(_tick)
	# 最终得分直接从状态读，不经信号（信号丢了也判得出「局间无差异」）


func _on_feedback_fired(_kind: StringName) -> void:
	if _sampling:
		_feedback_ticks.append(_tick)


func _last_score() -> Variant:
	if _game_state == null or not _has_score_signal:
		return null
	var value: Variant = _game_state.get("score")
	return value if (value is float or value is int) else null


## 首次得分时刻（秒）；无得分事件返回 null。
func _first_of(ticks: Array[int]) -> Variant:
	if ticks.is_empty():
		return null
	return ticks[0] / 60.0


## 最长无反馈窗口（秒）：开局→首个事件、事件间隔、末事件→收局，取最大。
## 反馈计数被 Juice 的 events 环形上限截断无影响 —— 这里走的是信号计数，不是数组长度。
func _max_feedback_gap_seconds() -> float:
	if _feedback_ticks.is_empty():
		return _frames_per_run / 60.0
	var gap := float(_feedback_ticks[0])  # 开局到首个反馈
	for i in range(1, _feedback_ticks.size()):
		var delta := float(_feedback_ticks[i] - _feedback_ticks[i - 1])
		if delta > gap:
			gap = delta
	var tail := float(_frames_per_run - _feedback_ticks[_feedback_ticks.size() - 1])
	if tail > gap:
		gap = tail
	return gap / 60.0


## ── 配置装载 ──

func _load_config() -> void:
	var env_frames := OS.get_environment("GODOT_PLAYTEST_FRAMES")
	if env_frames != "" and int(env_frames) > 0:
		_frames_per_run = int(env_frames)
	var config_path := "res://tests/playtest.json"
	if not FileAccess.file_exists(config_path):
		return
	var parsed: Variant = JSON.parse_string(FileAccess.open(config_path, FileAccess.READ).get_as_text())
	if not (parsed is Dictionary):
		printerr("[playtest] WARN tests/playtest.json 不是 JSON 对象，忽略（阈值用内置默认）")
		return
	var config: Dictionary = parsed
	_thresholds_source = "tests/playtest.json"
	if not env_frames_set() and config.get("frames_per_run") is int and int(config["frames_per_run"]) > 0:
		_frames_per_run = int(config["frames_per_run"])
	var overrides: Variant = config.get("thresholds")
	if overrides is Dictionary:
		for key: String in overrides:
			if _thresholds.has(key):
				_thresholds[key] = overrides[key]
			else:
				printerr("[playtest] WARN 未知阈值键 %s（内置键集之外），忽略" % key)


func env_frames_set() -> bool:
	var env_frames := OS.get_environment("GODOT_PLAYTEST_FRAMES")
	return env_frames != "" and int(env_frames) > 0


func _resolve_seeds() -> void:
	var env_seeds := OS.get_environment("GODOT_PLAYTEST_SEEDS")
	if env_seeds == "":
		return
	var parsed_seeds: Array[int] = []
	for part in env_seeds.split(","):
		if int(part) > 0:
			parsed_seeds.append(int(part))
	if not parsed_seeds.is_empty():
		_seeds = parsed_seeds


## ── bot 输入注入（与 input_fuzz_driver 同源的对抗事件流，确定种子） ──

const EVENTS_PER_FRAME_MAX: int = 3


func _inject_bot_events() -> void:
	var count := _rng.randi_range(0, EVENTS_PER_FRAME_MAX)
	for i in count:
		var roll := _rng.randf()
		var pos := Vector2(_rng.randf_range(0, 720), _rng.randf_range(0, 1280))
		if roll < 0.35 and not _actions.is_empty():
			# 动作级按下/抬起（bot 的「操作」；55% 概率按下，形成有持续性的操作段）
			var action: StringName = _actions[_rng.randi_range(0, _actions.size() - 1)]
			var ev := InputEventAction.new()
			ev.action = action
			ev.pressed = _rng.randf() < 0.55
			ev.strength = 1.0
			Input.parse_input_event(ev)
		elif roll < 0.55:
			var t := InputEventScreenTouch.new()
			t.index = _rng.randi_range(0, 1)
			t.position = pos
			t.pressed = _rng.randf() < 0.5
			Input.parse_input_event(t)
		elif roll < 0.68:
			var d := InputEventScreenDrag.new()
			d.index = _rng.randi_range(0, 1)
			d.position = pos
			d.relative = Vector2(_rng.randf_range(-40, 40), _rng.randf_range(-40, 40))
			Input.parse_input_event(d)
		elif roll < 0.80:
			var mb := InputEventMouseButton.new()
			mb.button_index = MOUSE_BUTTON_LEFT
			mb.position = pos
			mb.pressed = _rng.randf() < 0.5
			Input.parse_input_event(mb)
		else:
			var k := InputEventKey.new()
			k.physical_keycode = [KEY_A, KEY_D, KEY_W, KEY_S, KEY_SPACE, KEY_ENTER, KEY_R, KEY_ESCAPE][_rng.randi_range(0, 7)]
			k.pressed = _rng.randf() < 0.5
			Input.parse_input_event(k)
