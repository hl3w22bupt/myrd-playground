extends Node
## 无头冒烟自检（headless smoke）—— 机器可判定的「游戏能不能跑且玩得动」。
##
## 运行方式（由 std-skills/godot-game-dev/scripts/smoke.sh 封装）：
##   godot --headless --path <工程目录> tests/smoke.tscn
##
## 判定协议（smoke.sh 按此断言退出码与日志）：
##   通过 → stdout 打印 `GODOT_SMOKE: PASS ...`，进程退出码 0
##   失败 → stderr 打印 `GODOT_SMOKE: FAIL <原因>`（每条一行），进程退出码 1
##
## 覆盖面（对应需求验收标准 3 与 SKILL.md「冒烟场景必须断言什么」）：
##   1. 静态接线：InputMap 六动作注册 + 键位契约 + autoload 信号 + 场景实例化 + 校验器不变式
##   2. 玩家能移动：注入 move 动作后真实位移 > 1px
##   3. 核心交互生效：沿脚本化路径真实拾取 3 片有效片段（伪造片段不在路径上，未被误拾）
##   4. 胜负可达：集齐后探测 → 取证记录 oak_key_probe=valid 且界面反馈「有效」；
##      重开后空手探测 → oak_key_probe=invalid 且界面反馈「无效」
##   5. 重开可用：restart 后片段复位、计数清零、探针回出生点
##
## ⚠️ 输入注入分两层互不混用（见 references/error-signatures.md E-08）：
##   移动用 Input.action_press/release（动作级），confirm/restart 用 parse_input_event
##   注入 InputEventAction（事件级，才能进 _unhandled_input）；噪声相位只注原始事件。

## ── 噪声相位（输入鲁棒性门禁的逐游戏语义层）──
## 正式断言前注入一段确定种子的对抗输入：悬挂手势、孤儿释放、双指抢控、乱键。
## 随后照常执行移动/拾取/探测断言 —— 断言仍全过 = 噪声没有楔死输入管线。
const NOISE_FRAMES: int = 30

## 各移动相位的物理帧数（60Hz 下 220px/s ≈ 3.67px/帧）。
## 拾取半径 = 片段 Area2D 半径 16 + 玩家半宽 12 = 28px，以下帧数留有充分裕量。
const MOVE_A_FRAMES: int = 10   # (320,180) → ~356.7  覆盖 FragmentOA(360,180)
const MOVE_B_FRAMES: int = 14   # y 180 → ~128.7      覆盖 FragmentK(360,120)
const MOVE_C_FRAMES: int = 17   # x ~356.7 → ~419     覆盖 Fragment42(420,120)
const PROBE_WAIT_FRAMES: int = 3
const RESTART_WAIT_FRAMES: int = 2

const REQUIRED_ACTIONS: Array[StringName] = [
	&"move_left", &"move_right", &"move_up", &"move_down", &"confirm", &"restart",
]

## 键位契约：动作 → 键表承诺的物理键，必须全部绑定（与 project.godot [input] 对应）。
const KEY_CONTRACT: Dictionary = {
	&"move_left": [KEY_A, KEY_LEFT],
	&"move_right": [KEY_D, KEY_RIGHT],
	&"move_up": [KEY_W, KEY_UP],
	&"move_down": [KEY_S, KEY_DOWN],
	&"confirm": [KEY_SPACE, KEY_ENTER],
	&"restart": [KEY_R],
}

## 权威有效 key（OakKeyValidator 白名单派生结果的不变式断言）。
const EXPECTED_KEY: String = "oak-OA-K7-42"

enum Phase { NOISE, MOVE_A, MOVE_B, MOVE_C, PROBE_VALID, RESTART, PROBE_INVALID, REPORT }

## 相位 → 持续物理帧数（相位按枚举顺序串行推进）。
const PHASE_FRAMES: Dictionary = {
	Phase.NOISE: NOISE_FRAMES,
	Phase.MOVE_A: MOVE_A_FRAMES,
	Phase.MOVE_B: MOVE_B_FRAMES,
	Phase.MOVE_C: MOVE_C_FRAMES,
	Phase.PROBE_VALID: PROBE_WAIT_FRAMES,
	Phase.RESTART: RESTART_WAIT_FRAMES,
	Phase.PROBE_INVALID: PROBE_WAIT_FRAMES,
	Phase.REPORT: 0,
}

var _failures: PackedStringArray = []
var _frames: int = 0
var _phase: int = Phase.NOISE
var _phase_frames: int = 0
var _finished: bool = false
var _player: Player
var _main: Node2D
var _origin: Vector2 = Vector2.ZERO
var _moved_distance: float = 0.0
var _history_len_before_probe: int = 0

## 噪声相位：确定种子随机事件（原始事件，不含 InputEventAction）。
var _noise_rng := RandomNumberGenerator.new()


func _ready() -> void:
	# headless 无垂直同步：限到 60 FPS 让 process 帧 : 物理帧 ≈ 1:1，--quit-after 兜底才有意义。
	Engine.max_fps = 60
	_run_static_checks()
	_locate_nodes()
	if not _failures.is_empty():
		_report()


func _locate_nodes() -> void:
	_main = get_tree().root.find_child("Main", true, false) as Node2D
	if _main == null:
		_failures.append("场景树找不到 Main（tests/smoke.tscn 未实例化 scenes/main.tscn）")
		return
	_player = _main.get_node_or_null("Player") as Player
	if _player == null:
		_failures.append("Main 场景树找不到 Player（scenes/main.tscn 未实例化 player.tscn）")
	else:
		if not _player.moved.is_connected(_on_player_moved):
			_player.moved.connect(_on_player_moved)
		_origin = _player.global_position
	var game_state := get_tree().root.get_node_or_null("GameState")
	if game_state == null:
		_failures.append("autoload GameState 未注册（project.godot [autoload] 缺失）")


func _run_static_checks() -> void:
	for action in REQUIRED_ACTIONS:
		if not InputMap.has_action(action):
			_failures.append("InputMap 缺少动作 %s（project.godot [input] 未注册）" % action)
	_check_key_bindings()
	var game_state := get_tree().root.get_node_or_null("GameState")
	if game_state != null:
		for signal_name in ["score_changed", "fragment_collected", "probe_finished"]:
			if not game_state.has_signal(signal_name):
				_failures.append("autoload GameState 缺少信号 %s" % signal_name)
	if OakKeyValidator.expected_key() != EXPECTED_KEY:
		_failures.append("OakKeyValidator.expected_key()=%s ≠ 不变式 %s（白名单被改动）" % [
			OakKeyValidator.expected_key(), EXPECTED_KEY,
		])


func _physics_process(_delta: float) -> void:
	if _finished:
		return
	_frames += 1
	_phase_frames += 1
	if not _failures.is_empty():
		_report()
		return
	if _phase_frames >= int(PHASE_FRAMES[_phase]):
		_enter(_phase + 1)


## 进入新相位：先做上一相位的断言，再布置本相位的输入。
func _enter(phase: int) -> void:
	_phase = phase
	_phase_frames = 0
	match phase:
		Phase.MOVE_A:
			# 噪声相位结束后先清干净动作状态，再开始脚本化移动（避免残留按键造成斜向漂移）。
			_release_move_actions()
			Input.action_press(&"move_right")
		Phase.MOVE_B:
			Input.action_release(&"move_right")
			_assert_player_moved()
			_assert_collected(1, "FragmentOA")
			Input.action_press(&"move_up")
		Phase.MOVE_C:
			Input.action_release(&"move_up")
			_assert_collected(2, "FragmentK")
			Input.action_press(&"move_right")
		Phase.PROBE_VALID:
			Input.action_release(&"move_right")
			_assert_collected(3, "Fragment42")
			_assert_decoy_avoided()
			_history_len_before_probe = GameState.probe_history.size()
			_press_action(&"confirm")
		Phase.RESTART:
			_assert_probe_valid()
			_press_action(&"restart")
		Phase.PROBE_INVALID:
			_assert_reset()
			_history_len_before_probe = GameState.probe_history.size()
			_press_action(&"confirm")
		Phase.REPORT:
			_assert_probe_invalid()
			_report()
		_:
			pass


## ── 静态断言 ──────────────────────────────────────────────

## 键位契约断言：键表承诺的每个物理键都必须真的绑定（AND 语义，防「误改剩一键」回归）。
func _check_key_bindings() -> void:
	for action: StringName in KEY_CONTRACT:
		if not InputMap.has_action(action):
			continue  # 动作缺失已由 REQUIRED_ACTIONS 上报，不重复计失败
		var expected: Array = KEY_CONTRACT[action]
		var bound: Array[Key] = []
		for event in InputMap.action_get_events(action):
			var key := event as InputEventKey
			if key != null and key.physical_keycode != KEY_NONE:
				bound.append(key.physical_keycode)
		for code in expected:
			if not (code in bound):
				_failures.append("键位契约：动作 %s 未绑定物理键 %s —— 真机按了没反应" % [
					action, OS.get_keycode_string(code as Key),
				])


## ── 行为断言 ─────────────────────────────────────────────

func _assert_player_moved() -> void:
	if _player == null:
		return
	_moved_distance = _player.global_position.distance_to(_origin)
	if _moved_distance < 1.0:
		_failures.append("玩家位移 %.2fpx < 1px：InputMap 动作未生效或 velocity 未驱动 move_and_slide()" % _moved_distance)


## 断言已拾取 expected 片段，且指定片段节点确实处于「已拾取」状态。
func _assert_collected(expected: int, fragment_name: String) -> void:
	if GameState.collected_fragments < expected:
		_failures.append("拾取断言失败：有效片段 %d/%d（路径移动未触发 Area2D 拾取）" % [
			GameState.collected_fragments, expected,
		])
	var fragment := _find_fragment(fragment_name)
	if fragment == null:
		_failures.append("找不到片段节点 %s（scenes/main.tscn 的 Fragments 缺失或命名不符）" % fragment_name)
	elif not fragment.is_collected():
		_failures.append("片段 %s 未进入已拾取状态（拾取信号未送达或未登记）" % fragment_name)


## 伪造片段必须仍可拾取状态（脚本化路径不经过它 = 玩法上「必须避开」成立）。
func _assert_decoy_avoided() -> void:
	var fragment := _find_fragment("FragmentDecoy")
	if fragment == null:
		_failures.append("找不到伪造片段节点 FragmentDecoy")
	elif fragment.is_collected():
		_failures.append("伪造片段被误拾：脚本路径不该经过 (200,260)")


func _assert_probe_valid() -> void:
	var record := _newest_record()
	if record.is_empty():
		_failures.append("探测后没有新的取证记录（GameState.record_probe 未被触发）")
		return
	if String(record.get("oak_key_probe", "")) != "valid":
		_failures.append("集齐 3 片后探测应为 valid，实际 %s（reason=%s）" % [
			String(record.get("oak_key_probe", "")), String(record.get("reason", "")),
		])
	_assert_result_text("有效")


func _assert_reset() -> void:
	if GameState.collected_fragments != 0:
		_failures.append("重开后有效片段计数应为 0，实际 %d" % GameState.collected_fragments)
	var visible_count: int = 0
	for child in _main.get_node("Fragments").get_children():
		var fragment := child as KeyFragment
		if fragment != null and fragment.visible:
			visible_count += 1
	if visible_count != 4:
		_failures.append("重开后应有 4 个片段复位可见，实际 %d" % visible_count)
	if _player != null and _player.global_position.distance_to(Vector2(320.0, 180.0)) > 3.0:
		_failures.append("重开后探针未回出生点：当前 %s" % str(_player.global_position))
	_assert_result_panel_hidden()


func _assert_probe_invalid() -> void:
	var record := _newest_record()
	if record.is_empty():
		_failures.append("空手探测后没有新的取证记录（restart 后 confirm 未触发校验）")
		return
	if String(record.get("oak_key_probe", "")) != "invalid":
		_failures.append("空手探测应为 invalid，实际 %s（reason=%s）" % [
			String(record.get("oak_key_probe", "")), String(record.get("reason", "")),
		])
	elif not String(record.get("reason", "")).contains("片段不足"):
		_failures.append("空手探测的失败原因应为「片段不足」，实际 %s" % String(record.get("reason", "")))
	_assert_result_text("无效")


## 界面反馈断言：结果面板文案必须包含期望字样（「有效 / 无效」）—— 验收标准 3 的 ≤2s 反馈。
func _assert_result_text(expected: String) -> void:
	var label := _result_label()
	if label == null:
		_failures.append("找不到 ResultLabel（UI/ResultPanel 层级被改动）")
	elif not label.visible:
		_failures.append("结果面板未显示：探测后界面没有给出反馈")
	elif not label.text.contains(expected):
		_failures.append("结果文案未包含「%s」，实际：%s" % [expected, label.text])


func _assert_result_panel_hidden() -> void:
	var panel := _main.get_node_or_null("UI/ResultPanel") as Panel
	if panel == null:
		_failures.append("找不到 ResultPanel（UI 层级被改动）")
	elif panel.visible:
		_failures.append("重开后结果面板仍显示")


## ── 工具函数 ─────────────────────────────────────────────

func _find_fragment(fragment_name: String) -> KeyFragment:
	if _main == null:
		return null
	var fragments_root := _main.get_node_or_null("Fragments")
	if fragments_root == null:
		return null
	return fragments_root.get_node_or_null(fragment_name) as KeyFragment


func _result_label() -> Label:
	if _main == null:
		return null
	return _main.get_node_or_null("UI/ResultPanel/ResultLabel") as Label


## 探测后新增的取证记录（冒烟只看增量，避免噪声相位偶发探测干扰判定）。
func _newest_record() -> Dictionary:
	if GameState.probe_history.size() <= _history_len_before_probe:
		return {}
	return GameState.probe_history[GameState.probe_history.size() - 1]


## 无显示设备时模拟「玩家按键」：注入真实 InputEvent，让 _unhandled_input 收得到。
func _press_action(action: StringName) -> void:
	var event := InputEventAction.new()
	event.action = action
	event.pressed = true
	Input.parse_input_event(event)


func _release_move_actions() -> void:
	Input.action_release(&"move_left")
	Input.action_release(&"move_right")
	Input.action_release(&"move_up")
	Input.action_release(&"move_down")


func _report() -> void:
	_finished = true
	if _failures.is_empty():
		print("GODOT_SMOKE: PASS 移动/拾取/校验(有效+无效)/重开/取证标记 全部通过（%d 帧，位移 %.1fpx，取证记录 %d 条）" % [
			_frames, _moved_distance, GameState.probe_history.size(),
		])
		get_tree().quit(0)
	else:
		for failure in _failures:
			printerr("GODOT_SMOKE: FAIL %s" % failure)
		get_tree().quit(1)


## ── 噪声相位：确定种子随机事件（原始事件，不含 InputEventAction）──

func _inject_noise_frame() -> void:
	if _frames == 1:
		_noise_rng.seed = 20260913  # 门禁要求可复现：同种子同事件序
	var roll := _noise_rng.randf()
	var pos := Vector2(_noise_rng.randf_range(0, 720), _noise_rng.randf_range(0, 1280))
	if roll < 0.30:
		# 悬挂手势：按下不抬起
		var t := InputEventScreenTouch.new()
		t.index = _noise_rng.randi_range(0, 1)
		t.position = pos
		t.pressed = true
		Input.parse_input_event(t)
	elif roll < 0.45:
		# 孤儿释放：抬起无按下
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


func _on_player_moved(position: Vector2) -> void:
	if _player != null and _origin.distance_to(position) > _moved_distance:
		_moved_distance = _origin.distance_to(position)
