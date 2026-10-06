extends Node
## 无头冒烟自检（headless smoke）—— 机器可判定的「抓娃娃机能不能跑且玩得动」。
##
## 判定协议（scripts/smoke.sh 按此断言退出码与日志）：
##   通过 → stdout 打印 `GODOT_SMOKE: PASS ...`，进程退出码 0
##   失败 → stderr 打印 `GODOT_SMOKE: FAIL <原因>`（每条一行），进程退出码 1
##
## 断言覆盖（模板七项 + 玩法闭环）：
##   1. 主场景可实例化（Claw / Machine / Dolls×8 接线完整）
##   2. autoload GameState 已注册且带约定信号
##   3. InputMap 动作注册 + 键位契约 + 注入输入后爪子真的动了
##   4. 信号真的到达订阅方（Claw.moved / GameState.score_changed）
##   5. 核心交互生效：下爪 → 闭合抓取 → 娃娃入取物口 → 得分（确定性：debug_always_grab + 调速）
##   6. 结果性事件挂了反馈（Juice.events 非空）
##   7. 调参协议可判（TUNING_META 非空、钳制与未知键拒绝，检查后恢复原值）
##   8. 胜负可达 + 重开可用（达标 → RESULT(won) → confirm 重开 → PLAYING 且分数归零）
##
## ⚠️ 输入注入分阶段互不重叠（E-08）：action_press 与 parse_input_event 分帧做。

const NOISE_FRAMES: int = 30
const MOVE_FRAMES: int = 10
## 等待爪子状态机离开/回到 IDLE 的帧数上限（加速后一个抓取周期 ~80 帧）。
const CYCLE_WAIT_FRAMES: int = 150
## 结算/重开断言的宽限帧。
const RESULT_WAIT_FRAMES: int = 10
const MIN_MOVE_DISTANCE: float = 1.0

const REQUIRED_ACTIONS: Array[StringName] = [
	&"move_left", &"move_right", &"move_up", &"move_down", &"confirm", &"switch_claw",
]

const KEY_CONTRACT: Dictionary = {
	&"move_left": [KEY_A, KEY_LEFT],
	&"move_right": [KEY_D, KEY_RIGHT],
	&"move_up": [KEY_W, KEY_UP],
	&"move_down": [KEY_S, KEY_DOWN],
	&"confirm": [KEY_SPACE, KEY_ENTER],
	&"switch_claw": [KEY_TAB],
}

enum Phase { NOISE, MOVE, DROP_WAIT, CATCH_WAIT, RESULT_WAIT, DONE }

var _failures: PackedStringArray = []
var _frames: int = 0
var _phase: int = Phase.NOISE
var _phase_frame: int = 0
var _claw: Claw
var _game_state: Node
var _origin: Vector2 = Vector2.ZERO
var _moved_seen: bool = false
var _score_seen: bool = false
var _phase_result_seen: bool = false
var _grab_seen: bool = false
var _cycle_seen: bool = false
var _won_seen: bool = false
var _restart_seen: bool = false
var _drop_accepted: bool = false
var _saved_tuning: Dictionary = {}


func _ready() -> void:
	Engine.max_fps = 60
	for action in REQUIRED_ACTIONS:
		if not InputMap.has_action(action):
			_failures.append("InputMap 缺少动作 %s（project.godot [input] 未注册）" % action)
	_check_key_bindings()

	_game_state = get_tree().root.get_node_or_null("GameState")
	if _game_state == null:
		_failures.append("autoload GameState 未注册（project.godot [autoload] 缺失）")
	else:
		for signal_name in ["score_changed", "coins_changed", "phase_changed", "claw_switched"]:
			if not _game_state.has_signal(signal_name):
				_failures.append("autoload GameState 缺少信号 %s" % signal_name)
		_game_state.score_changed.connect(_on_score_changed)
		_game_state.phase_changed.connect(_on_phase_changed)
		_check_tuning_protocol(_game_state)

	_claw = get_tree().root.find_child("Claw", true, false) as Claw
	if _claw == null:
		_failures.append("场景树找不到 Claw（main.tscn 未实例化 claw.tscn，或实例名不是 Claw）")
	else:
		_claw.moved.connect(_on_claw_moved)
		_claw.grab_resolved.connect(_on_grab_resolved)
		_claw.cycle_finished.connect(_on_cycle_finished)
		_origin = _claw.global_position
		# 确定性抓取：跳过滑落掷骰（运行时恒为 false，仅冒烟打开）。
		_claw.debug_always_grab = true

	var dolls := get_tree().root.find_child("Dolls", true, false)
	if dolls == null or dolls.get_child_count() < Doll.KINDS.size():
		var count := dolls.get_child_count() if dolls != null else -1
		_failures.append("布货断言：Dolls 下娃娃 %d 只 < 娃娃库 %d 种（开局布货缺失）" % [count, Doll.KINDS.size()])

	if _game_state != null:
		# 提速：把爪子速度/下爪速度顶到 TUNING_META 上限，让一个抓取周期压进 ~100 帧。
		var bank: Dictionary = _game_state.get("TUNING_META")
		for key: String in ["claw_speed", "drop_speed"]:
			var key_name := StringName(key)
			if not bank.has(key_name):
				continue
			var probe_meta: Dictionary = bank[key_name]
			_saved_tuning[key] = _game_state.get(key)
			_game_state.set(key, float(probe_meta["max"]))


func _physics_process(_delta: float) -> void:
	if _phase == Phase.DONE:
		return
	_frames += 1
	_phase_frame += 1
	if not _failures.is_empty():
		_report()
		return
	match _phase:
		Phase.NOISE:
			_inject_noise_frame()
			if _phase_frame >= NOISE_FRAMES:
				_next_phase(Phase.MOVE)
				Input.action_press(&"move_right")
		Phase.MOVE:
			if _phase_frame >= MOVE_FRAMES:
				Input.action_release(&"move_right")
				_assert_player_moved()
				_stage_dramatic_drop()
				_press_action(&"confirm")
				_next_phase(Phase.DROP_WAIT)
		Phase.DROP_WAIT:
			if _claw.claw_state_name() != "IDLE":
				_drop_accepted = true
			if _phase_frame == 12 and not _drop_accepted:
				_failures.append("下爪未受理：confirm 注入后爪子没有进入 DROPPING（动作未接线 / 币不足 / 状态机锁死）")
				_report()
				return
			if _claw.claw_state_name() == "IDLE" and _drop_accepted and _phase_frame > 12:
				# 松爪后娃娃还有 ~33 帧落体动画才触发 caught —— 进入等分阶段再断言。
				_next_phase(Phase.CATCH_WAIT)
		Phase.CATCH_WAIT:
			if _score_seen or _phase_frame >= 48:
				_assert_cycle_result()
				_drive_win_and_restart()
				_next_phase(Phase.RESULT_WAIT)
		Phase.RESULT_WAIT:
			if _phase_frame >= RESULT_WAIT_FRAMES:
				_assert_restart()
				_report()


func _next_phase(phase: int) -> void:
	_phase = phase
	_phase_frame = 0


## ── 噪声相位（输入鲁棒性：对抗事件序打在前，玩法断言在后）──
const NOISE_SEED: int = 20260913
var _noise_rng := RandomNumberGenerator.new()


func _inject_noise_frame() -> void:
	if _frames == 1:
		_noise_rng.seed = NOISE_SEED
	var roll := _noise_rng.randf()
	var pos := Vector2(_noise_rng.randf_range(0, 720), _noise_rng.randf_range(0, 1280))
	if roll < 0.30:
		var t := InputEventScreenTouch.new()
		t.index = _noise_rng.randi_range(0, 1)
		t.position = pos
		t.pressed = true
		Input.parse_input_event(t)
	elif roll < 0.45:
		var t2 := InputEventScreenTouch.new()
		t2.index = _noise_rng.randi_range(0, 1)
		t2.position = pos
		t2.pressed = false
		Input.parse_input_event(t2)
	elif roll < 0.60:
		var d := InputEventScreenDrag.new()
		d.index = _noise_rng.randi_range(0, 1)
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
		k.physical_keycode = [KEY_A, KEY_D, KEY_W, KEY_S, KEY_SPACE, KEY_ENTER, KEY_TAB][_noise_rng.randi_range(0, 6)]
		k.pressed = _noise_rng.randf() < 0.5
		Input.parse_input_event(k)


## 无显示设备时模拟「玩家按键」：注入真实 InputEvent，让 _unhandled_input 收得到。
func _press_action(action: StringName) -> void:
	var event := InputEventAction.new()
	event.action = action
	event.pressed = true
	Input.parse_input_event(event)


## 键位契约断言：键表承诺的物理键必须全部绑定（AND 语义，见模板 E-12 教训）。
func _check_key_bindings() -> void:
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
				action, _key_labels(expected), _key_labels(bound),
			])


func _contains_all(expected: Array, bound: Array[Key]) -> bool:
	for key in expected:
		if not (key in bound):
			return false
	return true


## 调参工作台协议（SKILL.md §3C，纯逻辑、无头可判）：TUNING_META 非空；
## apply_tuning 应用已声明键、拒绝未声明键、按 max 钳制。
## ⚠️ 检查完必须把调过的值恢复原状 —— 协议检查不得污染被测状态。
func _check_tuning_protocol(game_state: Node) -> void:
	var meta: Variant = game_state.get("TUNING_META")
	if not (meta is Dictionary) or (meta as Dictionary).is_empty():
		_failures.append("调参协议：GameState.TUNING_META 为空或不可读（数值调参区必须声明至少一个可调键，见 SKILL.md §3C）")
		return
	var bank: Dictionary = meta as Dictionary
	var probe_key: String = String(bank.keys()[0])
	var probe_meta: Dictionary = bank[probe_key]
	var original: Variant = game_state.get(probe_key)
	var applied: PackedStringArray = game_state.call("apply_tuning", {probe_key: 999999.0, "tuning_bogus_key": 1})
	if not applied.has(probe_key):
		_failures.append("调参协议：apply_tuning 未应用已声明键 %s（应用逻辑断裂）" % probe_key)
	if applied.has("tuning_bogus_key"):
		_failures.append("调参协议：apply_tuning 应用了未声明键 tuning_bogus_key（必须只认 TUNING_META 声明的键）")
	var value: Variant = game_state.get(probe_key)
	if not (value is float or value is int) or float(value) > float(probe_meta["max"]):
		_failures.append("调参协议：%s=%s 超出 TUNING_META.max=%s（钳制缺失）" % [probe_key, value, probe_meta["max"]])
	if original != null:
		game_state.set(probe_key, original)


func _key_labels(keys: Array) -> String:
	var labels: PackedStringArray = []
	for code in keys:
		labels.append("%s(%d)" % [OS.get_keycode_string(code as Key), code])
	return "[%s]" % ", ".join(labels)


## ── 玩法断言 ──

func _assert_player_moved() -> void:
	if not _moved_seen:
		_failures.append("信号 Claw.moved 未到达订阅方：连接断裂或从未 emit")
	if _claw == null:
		return
	var travelled: float = _claw.global_position.distance_to(_origin)
	if travelled < MIN_MOVE_DISTANCE:
		_failures.append("爪子 %d 帧内位移 %.2fpx < %.2fpx：InputMap 动作未生效或 _physics_process 未驱动" % [
			MOVE_FRAMES, travelled, MIN_MOVE_DISTANCE,
		])


## 把爪子挪到第一只娃娃正上方（爪头落到娃娃身上），保证下爪必然命中。
func _stage_dramatic_drop() -> void:
	if _claw == null:
		return
	var dolls := get_tree().root.find_child("Dolls", true, false)
	if dolls == null or dolls.get_child_count() == 0:
		_failures.append("下爪前置失败：场景里没有娃娃可抓")
		return
	var doll := dolls.get_child(0) as Doll
	_claw.global_position = doll.global_position - Vector2(0.0, 96.0)


func _assert_cycle_result() -> void:
	if not _grab_seen:
		_failures.append("抓取周期没有产生 grab_resolved 信号：闭合判定未执行或信号未发出")
	if not _score_seen:
		_failures.append("确定性抓取后得分未变化：娃娃没有落进取物口或入账链路断裂（Doll.caught → main → GameState.collect_doll）")
	if not _cycle_seen:
		_failures.append("抓取周期没有以 cycle_finished 收口：状态机卡在中间态")


## 胜负可达：直接喂两只好娃娃凑满目标（默认 3，已抓 1）→ RESULT(won) → confirm 重开。
func _drive_win_and_restart() -> void:
	if _game_state == null:
		return
	var target := int(_game_state.target_dolls)
	var guard := 0
	while _game_state.phase == 1 and _game_state.dolls_collected < target and guard < 10:
		_game_state.collect_doll("冒烟补投", 10)
		guard += 1
	if _game_state.phase != 2:
		_failures.append("胜负断言：抓满 %d 只后没有进入 RESULT（win 判定断裂）" % target)
		return
	_press_action(&"confirm")


func _assert_restart() -> void:
	if not _won_seen:
		_failures.append("胜负断言：phase_changed 未报告 RESULT(won=true)，胜利不可达")
	if not _restart_seen:
		_failures.append("重开断言：结算画面按 confirm 后没有回到 PLAYING 且分数归零（重开入口失效）")


## ── 信号接收 ──

func _on_claw_moved(_position: Vector2) -> void:
	_moved_seen = true


func _on_score_changed(_score: int) -> void:
	_score_seen = true


func _on_grab_resolved(grabbed: bool) -> void:
	if grabbed:
		_grab_seen = true


func _on_cycle_finished(_grabbed: bool) -> void:
	_cycle_seen = true


func _on_phase_changed(phase: int, won: bool) -> void:
	if phase == 2 and won:
		_phase_result_seen = true
		_won_seen = true
	elif phase == 1 and _phase_result_seen:
		_restart_seen = true


## ── 报告 ──

func _report() -> void:
	_phase = Phase.DONE
	# 恢复调速与测试接缝，不污染被测状态。
	if _claw != null:
		_claw.debug_always_grab = false
	if _game_state != null:
		for key: String in _saved_tuning:
			_game_state.set(key, _saved_tuning[key])
	if _failures.is_empty():
		print("GODOT_SMOKE: PASS 场景实例化/autoload/输入映射/信号/移动/下爪抓取/胜负重开/反馈/调参协议 全部通过")
		get_tree().quit(0)
	else:
		for failure in _failures:
			printerr("GODOT_SMOKE: FAIL %s" % failure)
		get_tree().quit(1)
