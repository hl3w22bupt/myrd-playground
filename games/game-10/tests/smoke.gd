extends Node
## 无头冒烟自检（headless smoke）—— game-10「流星收集」的机器判定。
##
## 运行方式（由 scripts/smoke.sh 封装）：godot --headless --path . tests/smoke.tscn
## 判定协议：通过 → print("GODOT_SMOKE: PASS ...") + quit(0)；失败 → printerr("GODOT_SMOKE: FAIL <原因>") + quit(1)。
##
## 模板七项断言（SKILL.md §4.3，移植逐项保留）：
##   1. 主场景可实例化  2. autoload 已注册且带约定信号  3. InputMap 动作 + 键位契约 + 注入输入真的移动
##   4. 信号到达订阅方  5. 失败给可读原因  6. 结果性事件挂了 Juice 反馈  7. 调参协议可判
##
## 需求《冒烟愿晶 · game-10 流星收集》验收标准 → 冒烟断言映射：
##   验收1 流星限时消失且不计数 → LIFE 阶段：观测一颗新生流星超时渐隐，expired_count ≥1 且 score 不变
##   验收2 存在期内点击即收集、进度实时更新 → TAP 阶段：注入 ScreenTouch 到流星位置，score +1 且 HUD 含「已收集 x/3」
##   验收3 满三颗立即胜利结算 → WIN 阶段：won 即 victory_layer 可见，文案含「收集三颗即胜」与「达成」
##   验收4 漏收不回退、不判负、可继续 → LIFE 断言 score 不回退 + 生成持续（TAP/RESTART 阶段仍有新星）+ 无失败终止条件
##   验收5 托管全程无人干预取胜 → WIN 阶段仅注入一次 toggle_autopilot，之后零输入直到胜利（AUTOPILOT_WIN）
##   重开入口 → RESTART 阶段：confirm 重开后 score=0/结算隐藏/流星重新生成
##
## ⚠️ 输入注入分帧（error-signatures E-08）：action_press 与 parse_input_event 不在同帧混用。
## ⚠️ 测试加速：Engine.time_scale = 4（--quit-after 数的是 process 帧；4× 时间缩放让
##   240 帧预算覆盖「生成→超时消失→收集→托管三连收→重开」的完整游戏时间）。
##   加速只压缩等待，不改变任何断言语义；游戏逻辑全部走物理帧游戏时间，缩放下自洽。

## ── 噪声相位（输入鲁棒性）：确定种子对抗事件序打在前，行为断言在后 ──
const NOISE_FRAMES: int = 30
## 阶段一：按住 move_right 验证位移的帧数。
const MOVE_FRAMES: int = 10
## 阶段二：移动玩家到场地角落（远离后续流星生成点，避免干扰观测）的帧数。
const CORNER_FRAMES: int = 40
## 单阶段等待上限（帧）：超出即按超时给出可读失败。
const WAIT_SPAWN_MAX: int = 30
const WAIT_EXPIRE_MAX: int = 60
const WIN_WAIT_MAX: int = 90
## 事件注入后的生效等待帧数。
const SETTLE_FRAMES: int = 4
## 总帧数上限（--quit-after 240 兜底之前自行报告，保证失败可诊断）。
const TOTAL_FRAMES: int = 230
## 测试时间缩放（见文件头说明）。
const TEST_TIME_SCALE: float = 4.0

const REQUIRED_ACTIONS: Array[StringName] = [
	&"move_left", &"move_right", &"move_up", &"move_down", &"confirm", &"toggle_autopilot",
]

## 键位契约：动作 → 键表承诺的物理键，逐键核对（AND 语义，见模板说明）。
const KEY_CONTRACT: Dictionary = {
	&"move_left": [KEY_A, KEY_LEFT],
	&"move_right": [KEY_D, KEY_RIGHT],
	&"move_up": [KEY_W, KEY_UP],
	&"move_down": [KEY_S, KEY_DOWN],
	&"confirm": [KEY_SPACE, KEY_ENTER],
	&"toggle_autopilot": [KEY_T],
}

enum Phase {
	NOISE, MOVE, CORNER, LIFE_WAIT_SPAWN, LIFE_WAIT_EXPIRE,
	TAP_WAIT_SPAWN, TAP_COLLECT, AUTOPILOT_ON, AUTOPILOT_WIN,
	RESTART_TOGGLE, RESTART_CONFIRM, RESTART_WAIT_SPAWN, REPORT,
}

var _failures: PackedStringArray = []
var _frames: int = 0
var _phase: Phase = Phase.NOISE
var _phase_frames: int = 0
var _finished: bool = false

var _main: Node2D
var _player: Player
var _hud: Label
var _victory_layer: CanvasLayer
var _victory_label: Label
var _meteors: Node2D

var _origin: Vector2 = Vector2.ZERO
var _moved_seen: bool = false
var _score_seen: bool = false
var _score_at_life_start: int = 0
var _expired_at_life_start: int = 0
var _score_at_tap: int = 0
var _tap_target: Meteor
var _noise_rng := RandomNumberGenerator.new()


func _ready() -> void:
	# headless 无垂直同步：限帧让 process:physics ≈ 1:1（×time_scale 缩放），--quit-after 兜底才有意义。
	Engine.max_fps = 60
	Engine.time_scale = TEST_TIME_SCALE

	for action in REQUIRED_ACTIONS:
		if not InputMap.has_action(action):
			_failures.append("InputMap 缺少动作 %s（project.godot [input] 未注册）" % action)
	_check_key_bindings()

	var game_state := get_tree().root.get_node_or_null("GameState")
	if game_state == null:
		_failures.append("autoload GameState 未注册（project.godot [autoload] 缺失）")
	elif not game_state.has_signal("score_changed"):
		_failures.append("autoload GameState 缺少信号 score_changed")
	else:
		game_state.score_changed.connect(_on_score_changed)
		_check_tuning_protocol(game_state)

	_main = get_tree().root.find_child("Main", true, false) as Node2D
	if _main == null:
		_failures.append("场景树找不到 Main（tests/smoke.tscn 未实例化 scenes/main.tscn）")
	else:
		_player = _main.get_node_or_null("Player") as Player
		_hud = _main.find_child("HudLabel", true, false) as Label
		_victory_layer = _main.find_child("VictoryLayer", true, false) as CanvasLayer
		_victory_label = _main.find_child("VictoryLabel", true, false) as Label
		_meteors = _main.get_node_or_null("Meteors") as Node2D
		if _player == null:
			_failures.append("Main 场景树找不到 Player（main.tscn 未实例化 player.tscn）")
		else:
			_player.moved.connect(_on_player_moved)
			_origin = _player.global_position
		if _meteors == null:
			_failures.append("Main 场景树找不到 Meteors 容器（流星生成/清理断言无从做起）")
		if _hud == null:
			_failures.append("Main 场景树找不到 HudLabel（收集进度 UI 断言无从做起）")
		if _victory_layer == null or _victory_label == null:
			_failures.append("Main 场景树找不到 VictoryLayer/VictoryLabel（胜利结算断言无从做起）")
		# 冻结主场景逻辑直到噪声/移动断言完成：防止噪声相位的随机点击提前收集流星、
		# 抢跑胜利，破坏后续分阶段断言的前提（解冻在 LIFE 阶段入口）。
		_main.set_physics_process(false)


func _physics_process(_delta: float) -> void:
	if _finished:
		return
	_frames += 1
	_phase_frames += 1
	if _frames >= TOTAL_FRAMES:
		_failures.append("冒烟在 %d 帧内未跑完（卡在阶段 %s）—— 帧预算或阶段等待上限不足" % [_frames, _phase])
		_report()
		return
	if not _failures.is_empty():
		_report()
		return
	match _phase:
		Phase.NOISE:
			_inject_noise_frame()
			if _phase_frames >= NOISE_FRAMES:
				_goto(Phase.MOVE)
				Input.action_press(&"move_right")
		Phase.MOVE:
			if _phase_frames >= MOVE_FRAMES:
				Input.action_release(&"move_right")
				_assert_player_moved()
				_goto(Phase.CORNER)
				Input.action_press(&"move_left")
		Phase.CORNER:
			if _phase_frames >= CORNER_FRAMES:
				Input.action_release(&"move_left")
				_goto(Phase.LIFE_WAIT_SPAWN)
				# 解冻主场景 + 收紧寿命/生成节奏（走真实调参入口 apply_tuning），
				# 让「生成→超时消失」在帧预算内可观测。
				_main.set_physics_process(true)
				var applied: PackedStringArray = GameState.apply_tuning({
					"meteor_lifetime": 1.5, "spawn_interval": 0.45,
				})
				if not (applied.has("meteor_lifetime") and applied.has("spawn_interval")):
					_failures.append("调参协议：apply_tuning 未生效 meteor_lifetime/spawn_interval（%s）" % [applied])
				_score_at_life_start = GameState.score
				_expired_at_life_start = _main.expired_count
		Phase.LIFE_WAIT_SPAWN:
			if _meteor_count() > 0:
				_goto(Phase.LIFE_WAIT_EXPIRE)
			elif _phase_frames >= WAIT_SPAWN_MAX:
				_failures.append("验收1：等待 %d 帧没有流星生成（main 未进入生成循环或 spawn_interval 失效）" % [WAIT_SPAWN_MAX])
		Phase.LIFE_WAIT_EXPIRE:
			if _main.expired_count > _expired_at_life_start:
				# 验收1：流星出现→渐隐消失→计数不变；验收4：漏收不回退。
				if GameState.score != _score_at_life_start:
					_failures.append("验收1：流星超时消失后 score %d != %d（未收集的流星被计入进度）" % [
						GameState.score, _score_at_life_start])
				_goto(Phase.TAP_WAIT_SPAWN)
			elif _phase_frames >= WAIT_EXPIRE_MAX:
				_failures.append("验收1：等待 %d 帧没有流星超时消失（meteor_lifetime 计时或 expired 信号断裂）" % [WAIT_EXPIRE_MAX])
		Phase.TAP_WAIT_SPAWN:
			var meteor := _most_durable_meteor()
			if meteor != null:
				_tap_target = meteor
				_score_at_tap = GameState.score
				_press_at(meteor.position)
				_goto(Phase.TAP_COLLECT)
			elif _phase_frames >= WAIT_SPAWN_MAX:
				_failures.append("验收2：等待 %d 帧没有可用流星供点击收集" % [WAIT_SPAWN_MAX])
		Phase.TAP_COLLECT:
			if _phase_frames >= SETTLE_FRAMES:
				if GameState.score != _score_at_tap + 1:
					_failures.append("验收2：点击流星位置后进度未 +1（%d → %d）：点击收集路径断裂" % [
						_score_at_tap, GameState.score])
				if _hud != null and not _hud.text.contains("已收集 %d/%d" % [GameState.score, GameState.WIN_TARGET]):
					_failures.append("验收2：HUD 未实时显示「已收集 %d/%d」（实际：%s）" % [
						GameState.score, GameState.WIN_TARGET, _hud.text])
				_goto(Phase.AUTOPILOT_ON)
		Phase.AUTOPILOT_ON:
			if _phase_frames == 1:
				# 验收5：托管模式的唯一一次人工输入 = 切换托管开关；此后到胜利零输入。
				GameState.apply_tuning({"autopilot_speed": 600.0, "spawn_interval": 0.5, "meteor_lifetime": 8.0})
				_press_action(&"toggle_autopilot")
			elif _phase_frames >= SETTLE_FRAMES:
				if not GameState.autopilot:
					_failures.append("验收5：注入 toggle_autopilot 后 GameState.autopilot 仍为 false（托管开关接线断裂）")
				_goto(Phase.AUTOPILOT_WIN)
		Phase.AUTOPILOT_WIN:
			if GameState.won:
				# 验收3 + 验收5：托管全程无人干预达成胜利，且立即展示胜利结算。
				if _victory_layer != null and not _victory_layer.visible:
					_failures.append("验收3：won=true 但胜利结算层不可见（_win 未展示 VictoryLayer）")
				if _victory_label != null and not (_victory_label.text.contains("收集三颗即胜") and _victory_label.text.contains("达成")):
					_failures.append("验收3：胜利文案未明确展示「收集三颗即胜」达成（实际：%s）" % [_victory_label.text])
				_goto(Phase.RESTART_TOGGLE)
				Input.action_release(&"toggle_autopilot")
			elif _phase_frames >= WIN_WAIT_MAX:
				_failures.append("验收5：托管 %d 帧未达成胜利（score=%d）—— 托管导航/收集闭环断裂" % [
					WIN_WAIT_MAX, GameState.score])
		Phase.RESTART_TOGGLE:
			if _phase_frames == 1:
				_press_action(&"toggle_autopilot")
			elif _phase_frames >= SETTLE_FRAMES:
				if GameState.autopilot:
					_failures.append("重开前置：再次注入 toggle_autopilot 后托管仍为 true（开关不可逆）")
				_goto(Phase.RESTART_CONFIRM)
		Phase.RESTART_CONFIRM:
			if _phase_frames == 1:
				_press_action(&"confirm")
			elif _phase_frames >= SETTLE_FRAMES:
				if GameState.score != 0:
					_failures.append("重开：confirm 后进度未归零（实际 %d）" % GameState.score)
				if GameState.won:
					_failures.append("重开：confirm 后 won 仍为 true（GameState.reset 未复位胜利）")
				if _victory_layer != null and _victory_layer.visible:
					_failures.append("重开：胜利结算层未隐藏")
				if _main.expired_count != 0:
					_failures.append("重开：本局「超时消失」计数未复位（实际 %d）" % _main.expired_count)
				_goto(Phase.RESTART_WAIT_SPAWN)
		Phase.RESTART_WAIT_SPAWN:
			if _meteor_count() > 0:
				_assert_feedback_fired()
				_report()
			elif _phase_frames >= WAIT_SPAWN_MAX:
				_failures.append("重开：重开后 %d 帧内没有新流星生成（游戏未继续）" % [WAIT_SPAWN_MAX])

	if _failures.is_empty() and _phase == Phase.RESTART_WAIT_SPAWN and _meteor_count() > 0:
		pass  # 已在分支内报告，防御性保留
	if not _failures.is_empty() and not _finished:
		_report()


func _goto(phase: Phase) -> void:
	_phase = phase
	_phase_frames = 0


func _meteor_count() -> int:
	if _meteors == null:
		return 0
	return _meteors.get_child_count()


## 挑剩余寿命最长的一颗可用流星：注入事件要跨帧投递，目标不能在投递期间过期。
func _most_durable_meteor() -> Meteor:
	if _meteors == null:
		return null
	var best: Meteor = null
	for child in _meteors.get_children():
		var meteor := child as Meteor
		if meteor == null or not meteor.is_collectible():
			continue
		if best == null or meteor.time_left() > best.time_left():
			best = meteor
	return best


## 噪声相位：确定种子随机事件（原始事件，不含 InputEventAction）。
func _inject_noise_frame() -> void:
	if _phase_frames == 1:
		_noise_rng.seed = 20260913  # 门禁要求可复现：同种子同事件序
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
		k.physical_keycode = [KEY_A, KEY_D, KEY_W, KEY_S, KEY_SPACE, KEY_ENTER][_noise_rng.randi_range(0, 5)]
		k.pressed = _noise_rng.randf() < 0.5
		Input.parse_input_event(k)


## 点击流星：注入真实 ScreenTouch（走 main._unhandled_input 的移动端主收集路径）。
## ⚠️ parse_input_event 的坐标是「窗口坐标」，引擎会按拉伸变换换算成内容坐标再投递
## （headless 哑窗口 64×64，内容 640×N，final_transform=0.1 → 注入坐标要乘回变换）。
## 游戏代码只消费投递后的内容坐标，与真实设备的触摸路径完全一致，不需要任何平台特判。
func _press_at(world_position: Vector2) -> void:
	var xform: Transform2D = _main.get_viewport().get_final_transform()
	var touch := InputEventScreenTouch.new()
	touch.index = 0
	touch.position = xform * world_position
	touch.pressed = true
	Input.parse_input_event(touch)


## 注入动作事件（触发 _unhandled_input 的动作分支）。
func _press_action(action: StringName) -> void:
	var event := InputEventAction.new()
	event.action = action
	event.pressed = true
	Input.parse_input_event(event)


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


func _key_labels(keys: Array) -> String:
	var labels: PackedStringArray = []
	for code in keys:
		labels.append("%s(%d)" % [OS.get_keycode_string(code as Key), code])
	return "[%s]" % ", ".join(labels)


func _assert_player_moved() -> void:
	if _player == null:
		return
	var travelled: float = _player.global_position.distance_to(_origin)
	if travelled < 1.0:
		_failures.append("玩家 %d 帧内位移 %.2fpx < 1px：InputMap 动作未生效或 _physics_process 未驱动 velocity" % [MOVE_FRAMES, travelled])


## 调参工作台协议（SKILL.md §3C）：TUNING_META 非空；apply_tuning 应用已声明键、
## 拒绝未声明键、按 max 钳制；检查完必须把调过的值恢复原状（不污染被测状态）。
func _check_tuning_protocol(game_state: Node) -> void:
	var meta: Variant = game_state.get("TUNING_META")
	if meta is Dictionary and not (meta as Dictionary).is_empty():
		var original_speed: Variant = game_state.get("move_speed")
		var applied: PackedStringArray = game_state.call("apply_tuning", {"move_speed": 99999.0, "tuning_bogus_key": 1})
		if not applied.has("move_speed"):
			_failures.append("调参协议：apply_tuning 未应用已声明键 move_speed（应用逻辑断裂）")
		if applied.has("tuning_bogus_key"):
			_failures.append("调参协议：apply_tuning 应用了未声明键 tuning_bogus_key（必须只认 TUNING_META 声明的键）")
		var speed: Variant = game_state.get("move_speed")
		if not (speed is float or speed is int) or float(speed) > 600.0:
			_failures.append("调参协议：move_speed=%s 超出 TUNING_META.max=600（钳制缺失）" % [speed])
		if applied.has("move_speed") and original_speed != null:
			game_state.set("move_speed", original_speed)
	else:
		_failures.append("调参协议：GameState.TUNING_META 为空或不可读（数值调参区必须声明至少一个可调键）")


func _assert_feedback_fired() -> void:
	if Juice.events.is_empty():
		_failures.append("反馈断言：收集/胜利的结果事件没有触发任何 Juice 反馈（SKILL.md §3B）")


func _report() -> void:
	if _finished:
		return
	_finished = true
	if not _moved_seen:
		_failures.append("信号 Player.moved 未到达订阅方：连接断裂或从未 emit")
	if not _score_seen:
		_failures.append("信号 GameState.score_changed 未到达订阅方：连接断裂或从未 emit")
	if _failures.is_empty():
		print("GODOT_SMOKE: PASS 场景实例化/autoload/键位契约/移动/限时消失不计数/点击收集/托管无人干预取胜/胜利结算/重开 全部通过")
		get_tree().quit(0)
	else:
		for failure in _failures:
			printerr("GODOT_SMOKE: FAIL %s" % failure)
		get_tree().quit(1)


func _on_player_moved(_position: Vector2) -> void:
	_moved_seen = true


func _on_score_changed(_score: int) -> void:
	_score_seen = true
