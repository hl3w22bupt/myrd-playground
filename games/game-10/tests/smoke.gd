extends Node
## 无头冒烟自检（headless smoke）—— 机器可判定的「游戏能不能跑」。
##
## 运行方式（由 scripts/smoke.sh 封装）：
##   godot --headless --path <工程目录> tests/smoke.tscn
##
## 判定协议（smoke.sh 按此断言退出码与日志）：
##   通过 → stdout 打印 `GODOT_SMOKE: PASS ...`，进程退出码 0
##   失败 → stderr 打印 `GODOT_SMOKE: FAIL <原因>`（每条一行），进程退出码 1
##
## 覆盖面（模板七项 + 本游戏四项验收代理断言）：
##   1. 主场景可实例化（main.tscn 接线未断裂，conductor/四轨装配完成）
##   2. autoload 已注册且带约定信号（GameState / Juice）
##   3. InputMap 动作已注册、物理键绑定正确（键位契约逐键核对）
##   4. 玩家能玩：谱面真的在滚动（音符随歌曲时钟下落）——「能动」的游戏侧等价断言
##   5. 核心交互生效：注入轨道按键 → PERFECT 判定落定 + 分数/连击/判定信号全到达
##   6. 胜负可达：时钟快进到谱面终点 → 整局结束信号 + 结算面板可见
##   7. 重开可用：restart 动作 → 状态全部清零、新谱面开跑、结算面板收起
##   8. 结果性事件真的挂了反馈（Juice.events 非空，SKILL.md §3B）
##   9. 调参协议可判（TUNING_META 非空、apply_tuning 钳制与未知键拒绝，§3C）
##  10. 谱面校验通过（时间升序/轨道合法/同轨最小间隔，AC3 代理断言）
##
## ⚠️ 输入注入分阶段互不重叠（references/error-signatures.md E-08）：
##   噪声相位只投原始事件（Key/Mouse/Touch），动作级断言在噪声之后的独立相位做。

## ── 噪声相位：正式断言前注入确定种子的对抗输入（悬挂手势/孤儿释放/乱键）──
const NOISE_FRAMES: int = 30

## 各阶段帧号（物理帧，60Hz；Engine.max_fps=60 让 process:physics ≈ 1:1）。
const SCROLL_START_FRAME: int = NOISE_FRAMES + 1    # 把时钟拨到首个音符下落途中
const SCROLL_END_FRAME: int = SCROLL_START_FRAME + 10   # 记录两次音符 y，断言下落
const HIT_SETUP_FRAME: int = SCROLL_END_FRAME + 1   # 冻结时钟到首个音符判定点
const HIT_INJECT_FRAME: int = HIT_SETUP_FRAME + 1   # 注入轨道按键
const HIT_ASSERT_FRAME: int = HIT_INJECT_FRAME + 4  # 断言判定/分数/连击/反馈
const FINISH_SETUP_FRAME: int = HIT_ASSERT_FRAME + 1  # 时钟拨到谱面终点并解除冻结
const FINISH_ASSERT_FRAME: int = FINISH_SETUP_FRAME + 3  # 断言结束 + 结算面板
const RESTART_FRAME: int = FINISH_ASSERT_FRAME + 2  # 注入 restart 动作
const TOTAL_FRAMES: int = RESTART_FRAME + 6         # 重开断言 + 报告

## 判定「谱面真的在滚动」的最小位移（像素；10 物理帧 × 380px/s ≈ 63px，留余量）。
const MIN_FALL_DISTANCE: float = 30.0

const REQUIRED_ACTIONS: Array[StringName] = [
	&"lane_1", &"lane_2", &"lane_3", &"lane_4",
	&"confirm", &"restart", &"diff_prev", &"diff_next",
]

## 键位契约：动作 → 键表承诺的物理键，必须全部绑定（AND 语义，见模板 smoke 说明）。
const KEY_CONTRACT: Dictionary = {
	&"lane_1": [KEY_D],
	&"lane_2": [KEY_F],
	&"lane_3": [KEY_J],
	&"lane_4": [KEY_K],
	&"confirm": [KEY_SPACE, KEY_ENTER],
	&"restart": [KEY_R],
	&"diff_prev": [KEY_LEFT],
	&"diff_next": [KEY_RIGHT],
}

var _failures: PackedStringArray = []
var _frames: int = 0
var _finished: bool = false
var _main: Node2D
var _conductor: Conductor
var _scroll_note: RhythmNote
var _scroll_origin_y: float = 0.0
var _judgment_seen: bool = false
var _score_zero_seen: bool = false
var _noise_rng := RandomNumberGenerator.new()


func _ready() -> void:
	# headless 没有垂直同步：限帧让 process:physics ≈ 1:1，--quit-after 兜底才有意义。
	Engine.max_fps = 60
	_check_input_map()
	var game_state := get_tree().root.get_node_or_null("GameState")
	if game_state == null:
		_failures.append("autoload GameState 未注册（project.godot [autoload] 缺失）")
	else:
		for signal_name in ["score_changed", "combo_changed", "judgment_recorded", "game_finished"]:
			if not game_state.has_signal(signal_name):
				_failures.append("autoload GameState 缺少信号 %s" % signal_name)
		game_state.judgment_recorded.connect(_on_judgment_recorded)
		game_state.score_changed.connect(_on_score_changed)
		_check_tuning_protocol(game_state)
	if get_tree().root.get_node_or_null("Juice") == null:
		_failures.append("autoload Juice 未注册（反馈单例缺失，SKILL.md §3B）")
	if GameState.DIFFICULTY_TABLE.size() < 4:
		_failures.append("难度分级：DIFFICULTY_TABLE 只有 %d 档（需求要求 ≥4 档）" % GameState.DIFFICULTY_TABLE.size())
	_main = get_tree().root.find_child("Main", true, false) as Node2D
	if _main == null:
		_failures.append("场景树找不到 Main（main.tscn 未被 smoke.tscn 实例化）")
		_finished = true
		_report()
		return
	_conductor = _main.get("conductor") as Conductor
	if _conductor == null:
		_failures.append("Main.conductor 未装配（歌曲时钟缺失，玩法无从运行）")
	elif _conductor.lanes.size() != 4:
		_failures.append("轨道装配：%d 条 ≠ 4 条（Main._build_stage 未建满四轨）" % _conductor.lanes.size())


func _physics_process(_delta: float) -> void:
	if _finished:
		return
	_frames += 1
	if _failures.is_empty():
		if _frames <= NOISE_FRAMES:
			_inject_noise_frame()
		elif _frames == SCROLL_START_FRAME:
			_setup_scroll_phase()
		elif _frames == SCROLL_END_FRAME:
			_assert_chart_scrolling()
		elif _frames == HIT_SETUP_FRAME:
			_setup_hit_phase()
		elif _frames == HIT_INJECT_FRAME:
			_inject_lane_hit()
		elif _frames == HIT_ASSERT_FRAME:
			_assert_hit_registered()
		elif _frames == FINISH_SETUP_FRAME:
			_setup_finish_phase()
		elif _frames == FINISH_ASSERT_FRAME:
			_assert_game_finished()
		elif _frames == RESTART_FRAME:
			_inject_action(&"restart")
		elif _frames == TOTAL_FRAMES:
			_assert_restarted()
	if _frames >= TOTAL_FRAMES or not _failures.is_empty():
		_finished = true
		_report()


## ── 相位 4：谱面滚动（「玩家能玩」的运动断言）──

func _setup_scroll_phase() -> void:
	if _conductor == null or _conductor.lanes.is_empty():
		return
	_conductor.song_time = 3.0  # 拨到首个音符（3.8s）下落途中，激活循环下帧生效


func _assert_chart_scrolling() -> void:
	if _conductor == null:
		return
	if not _conductor.validation_error.is_empty():
		_failures.append(_conductor.validation_error)
	var note0_lane: int = int(_conductor.get_note(0)["lane"])
	var notes: Array[RhythmNote] = _conductor.lanes[note0_lane].active_notes_snapshot()
	if notes.is_empty():
		_failures.append("谱面滚动断言：轨道 %d 在时钟 %.2fs 时没有活跃音符（激活循环未生效）" % [
			note0_lane, _conductor.song_time])
		return
	_scroll_note = notes[0]
	_scroll_origin_y = _scroll_note.position.y
	if _scroll_note.position.y >= Conductor.JUDGMENT_Y:
		_failures.append("谱面滚动断言：音符 y=%.0f 不在判定线上方（时钟与位置关系断裂）" % _scroll_note.position.y)


## ── 相位 5：核心交互（轨道按键 → 判定）──

func _setup_hit_phase() -> void:
	if _conductor == null or _scroll_note == null:
		return
	_conductor.paused = true          # 冻结歌曲时钟（结算页同款暂停语义）
	var note0: Dictionary = _conductor.get_note(0)
	_conductor.song_time = float(note0["time"])  # 时钟正对首个音符 → 理应 PERFECT
	# 滚动相位通常已激活该音符；万一没有（极端帧序）才手动补激活，保持 conductor 状态一致。
	var lane: Lane = _conductor.lanes[int(note0["lane"])]
	if lane.active_notes_snapshot().is_empty():
		lane.activate_note(0)


func _inject_lane_hit() -> void:
	if _conductor == null:
		return
	_inject_action(StringName("lane_%d" % (int(_conductor.get_note(0)["lane"]) + 1)))


func _assert_hit_registered() -> void:
	if not _judgment_seen:
		_failures.append("核心交互断言：正对音符按键未产生任何判定（lane.press → judgment_recorded 链路断裂）")
	if GameState.perfect_count < 1:
		_failures.append("核心交互断言：PERFECT 计数 %d < 1（±50ms 窗口内按键未记 PERFECT）" % GameState.perfect_count)
	if GameState.score < GameState.SCORE_PERFECT:
		_failures.append("核心交互断言：分数 %d < %d（PERFECT 未按权重计分）" % [GameState.score, GameState.SCORE_PERFECT])
	if GameState.combo != 1:
		_failures.append("核心交互断言：连击 %d ≠ 1（首次命中未累计 combo）" % GameState.combo)
	if Juice.events.is_empty():
		_failures.append("反馈断言：命中结果事件没有触发任何 Juice 反馈（SKILL.md §3B，如确实移除反馈请同步更新本断言）")


## ── 相位 6：胜负可达 ──

func _setup_finish_phase() -> void:
	if _conductor == null:
		return
	_conductor.song_time = _conductor.song_end_time() + 0.1
	_conductor.paused = false  # 解除冻结，下一物理帧触发终局收口 + finished


func _assert_game_finished() -> void:
	if _conductor != null and _conductor.playing:
		_failures.append("胜负可达断言：时钟已过谱面终点但局未结束（conductor.finished 链路断裂）")
	var results: PanelContainer = _main.get("results_panel")
	if results == null or not results.visible:
		_failures.append("胜负可达断言：整局结束后结算面板未显示（game_finished → results_panel 断裂）")


## ── 相位 7：重开可用 ──

func _assert_restarted() -> void:
	if GameState.score != 0 or GameState.combo != 0 or GameState.max_combo != 0:
		_failures.append("重开断言：restart 后 score/combo/max_combo = %d/%d/%d 未清零" % [
			GameState.score, GameState.combo, GameState.max_combo])
	if GameState.perfect_count != 0 or GameState.miss_count != 0:
		_failures.append("重开断言：restart 后判定计数未清零（P%d M%d）" % [
			GameState.perfect_count, GameState.miss_count])
	if _conductor != null and not _conductor.playing:
		_failures.append("重开断言：restart 后新谱面未开跑（conductor.restart 未复位 playing）")
	if not _score_zero_seen:
		_failures.append("重开断言：未收到复位后的 score_changed(0) 信号（GameState.reset 广播断裂）")
	var results: PanelContainer = _main.get("results_panel")
	if results != null and results.visible:
		_failures.append("重开断言：restart 后结算面板未收起")


## ── 通用注入与契约断言 ──

func _inject_action(action: StringName) -> void:
	var event := InputEventAction.new()
	event.action = action
	event.pressed = true
	Input.parse_input_event(event)


func _check_input_map() -> void:
	for action in REQUIRED_ACTIONS:
		if not InputMap.has_action(action):
			_failures.append("InputMap 缺少动作 %s（project.godot [input] 未注册）" % action)
	for action: StringName in KEY_CONTRACT:
		if not InputMap.has_action(action):
			continue
		var expected: Array = KEY_CONTRACT[action]
		var bound: Array[Key] = []
		for event in InputMap.action_get_events(action):
			var key := event as InputEventKey
			if key != null and key.physical_keycode != KEY_NONE:
				bound.append(key.physical_keycode)
		if not _contains_all(expected, bound):
			_failures.append("键位契约：动作 %s 未绑全键表承诺的物理键（期望全部 %s，实际 %s）" % [
				action, _key_labels(expected), _key_labels(bound)])


func _contains_all(expected: Array, bound: Array[Key]) -> bool:
	for key in expected:
		if not (key in bound):
			return false
	return true


func _key_labels(keys: Array) -> String:
	var labels: PackedStringArray = []
	for code in keys:
		labels.append("%s(%d)" % [OS.get_keycode_string(code as Key), code])
	return "[%s]" % ", ".join(labels)


## 噪声相位：确定种子随机事件（原始事件，不含 InputEventAction）——模板同款。
func _inject_noise_frame() -> void:
	if _frames == 1:
		_noise_rng.seed = 20260913
	var roll := _noise_rng.randf()
	var pos := Vector2(_noise_rng.randf_range(0, 720), _noise_rng.randf_range(0, 1280))
	if roll < 0.30:
		var t := InputEventScreenTouch.new()
		t.index = _noise_rng.randi_range(0, 3)
		t.position = pos
		t.pressed = true
		Input.parse_input_event(t)
	elif roll < 0.45:
		var t2 := InputEventScreenTouch.new()
		t2.index = _noise_rng.randi_range(0, 3)
		t2.position = pos
		t2.pressed = false
		Input.parse_input_event(t2)
	elif roll < 0.60:
		var d := InputEventScreenDrag.new()
		d.index = _noise_rng.randi_range(0, 3)
		d.position = pos
		d.relative = Vector2(_noise_rng.randf_range(-40, 40), _noise_rng.randf_range(-40, 40))
		Input.parse_input_event(d)
	elif roll < 0.80:
		var mb := InputEventMouseButton.new()
		mb.button_index = MOUSE_BUTTON_LEFT
		mb.position = pos
		mb.pressed = _noise_rng.randf() < 0.5
		Input.parse_input_event(mb)
	else:
		var k := InputEventKey.new()
		k.physical_keycode = [KEY_A, KEY_D, KEY_W, KEY_S, KEY_SPACE, KEY_ENTER][_noise_rng.randi_range(0, 5)]
		k.pressed = _noise_rng.randf() < 0.5
		Input.parse_input_event(k)


## 调参协议（SKILL.md §3C）：检查完必须恢复原状，不得污染被测状态。
func _check_tuning_protocol(game_state: Node) -> void:
	var meta: Variant = game_state.get("TUNING_META")
	if not (meta is Dictionary) or (meta as Dictionary).is_empty():
		_failures.append("调参协议：GameState.TUNING_META 为空或不可读（数值调参区必须声明至少一个可调键）")
		return
	var original: Variant = game_state.get("perfect_window_ms")
	var applied: PackedStringArray = game_state.call("apply_tuning",
		{"perfect_window_ms": 99999.0, "tuning_bogus_key": 1})
	if not applied.has("perfect_window_ms"):
		_failures.append("调参协议：apply_tuning 未应用已声明键 perfect_window_ms（应用逻辑断裂）")
	if applied.has("tuning_bogus_key"):
		_failures.append("调参协议：apply_tuning 应用了未声明键 tuning_bogus_key（必须只认 TUNING_META 声明的键）")
	var window: Variant = game_state.get("perfect_window_ms")
	if not (window is float or window is int) or float(window) > 80.0:
		_failures.append("调参协议：perfect_window_ms=%s 超出 TUNING_META.max=80（钳制缺失）" % [window])
	if applied.has("perfect_window_ms") and original != null:
		game_state.set("perfect_window_ms", original)


func _report() -> void:
	if _failures.is_empty():
		print("GODOT_SMOKE: PASS 场景实例化/autoload/InputMap+键位契约/谱面滚动/轨道判定/胜负可达/重开/反馈/调参/谱面校验 全部通过")
		get_tree().quit(0)
	else:
		for failure in _failures:
			printerr("GODOT_SMOKE: FAIL %s" % failure)
		get_tree().quit(1)


func _on_judgment_recorded(_judgment: int) -> void:
	_judgment_seen = true


func _on_score_changed(score: int) -> void:
	if score == 0 and _frames > RESTART_FRAME - 4:
		_score_zero_seen = true
