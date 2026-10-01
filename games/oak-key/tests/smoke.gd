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
## 覆盖面（对应需求验收标准 3 与 SKILL.md「冒烟场景必须断言什么」七项）：
##   1. 静态接线：InputMap 六动作 + 键位契约（逐键 AND）+ autoload 信号 + 校验器不变式
##      + 难度梯度不变式（波次数=3、伪造片段逐波递增、时限逐波递减）
##   2. 玩家能移动：注入 move 动作后真实位移 > 1px
##   3. 核心交互生效：三波各沿脚本化路线真实拾取 3 片有效片段（伪造片段巡逻带不在路线上）
##   4. 胜负可达：三波探测 valid → 胜利结算面板；重开后连续空手探测 → 信度 3→0 → 失败结算面板
##   5. 超时路径：时限缩放调到 0.05 → 计时归零 → 信度 -1 + 本波片段重铺（新玩法面）
##   6. 重开可用：胜利结算后 R 重开 → 波次/信度/面板全部复位
##   7. 反馈完备（§3B）：结果性事件后 Juice.events 非空；调参协议可判（§3C：钳制/未知键拒绝）
##
## ⚠️ 输入注入分两层互不混用（references/error-signatures.md E-08）：
##   移动用 Input.action_press/release（动作级），confirm/restart 用 parse_input_event
##   注入 InputEventAction（事件级，才能进 _unhandled_input）；噪声相位只注原始事件。
##
## ── 路线与帧数推导（注释承诺必须与常量推导一致）─────────────────────
##   速度 = GameState.move_speed = 220 px/s；物理 60Hz → 3.6667 px/帧。
##   拾取包络 = 片段 CircleShape2D 半径 16 + 玩家半宽 12 = 28px（中心距）。
##   每段路线 11 帧 = 40.3px：片段布点间距 41px，玩家沿线穿过片段中心，
##   距片段 ≤28px 的窗口在段内第 ~4 帧出现 —— 必拾取、且与相邻片段（41px 外）不相交，
##   拾取顺序严格等于路线顺序（组装顺序 OA→K7→42 由路线保证）。

## ── 噪声相位（输入鲁棒性门禁的逐游戏语义层）──
## 正式断言前注入一段确定种子的对抗输入：悬挂手势、孤儿释放、双指抢控、乱键。
## 随后照常执行移动/拾取/探测断言 —— 断言仍全过 = 噪声没有楔死输入管线。
const NOISE_FRAMES: int = 30

const LEG_FRAMES: int = 11        # 每段路线 11 物理帧 = 40.3px（见文件头推导）
const PROBE_WAIT_FRAMES: int = 3  # 探测反馈同帧渲染，3 帧覆盖输入冲刷
const RESTART_WAIT_FRAMES: int = 2
const TIMEOUT_WAIT_FRAMES: int = 78  # 时限缩放 0.05 → 第 1 波 1.25s = 75 物理帧 + 3 帧裕量

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

## 每波片段总数（真实 + 伪造，与 main.gd WAVE_LAYOUTS / GameState.WAVES 对应）。
const WAVE_FRAGMENT_COUNTS: Array[int] = [4, 5, 6]

enum Phase {
	NOISE, TIMEOUT_TUNE, TIMEOUT_WAIT, RETUNE,
	W1_A, W1_B, W1_C, PROBE_W1,
	W2_A, W2_B, W2_C, PROBE_W2,
	W3_A, W3_B, W3_C, PROBE_W3,
	RESTART, PROBE_I1, PROBE_I2, PROBE_I3, REPORT,
}

## 相位 → 持续物理帧数（相位按枚举顺序串行推进）。
const PHASE_FRAMES: Dictionary = {
	Phase.NOISE: NOISE_FRAMES,
	Phase.TIMEOUT_TUNE: 1,
	Phase.TIMEOUT_WAIT: TIMEOUT_WAIT_FRAMES,
	Phase.RETUNE: 1,
	Phase.W1_A: LEG_FRAMES, Phase.W1_B: LEG_FRAMES, Phase.W1_C: LEG_FRAMES, Phase.PROBE_W1: PROBE_WAIT_FRAMES,
	Phase.W2_A: LEG_FRAMES, Phase.W2_B: LEG_FRAMES, Phase.W2_C: LEG_FRAMES, Phase.PROBE_W2: PROBE_WAIT_FRAMES,
	Phase.W3_A: LEG_FRAMES, Phase.W3_B: LEG_FRAMES, Phase.W3_C: LEG_FRAMES, Phase.PROBE_W3: PROBE_WAIT_FRAMES,
	Phase.RESTART: RESTART_WAIT_FRAMES,
	Phase.PROBE_I1: PROBE_WAIT_FRAMES, Phase.PROBE_I2: PROBE_WAIT_FRAMES, Phase.PROBE_I3: PROBE_WAIT_FRAMES,
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
	if get_tree().root.get_node_or_null("Juice") == null:
		_failures.append("autoload Juice 未注册（project.godot [autoload] 缺失，反馈断言无从谈起）")


func _run_static_checks() -> void:
	for action in REQUIRED_ACTIONS:
		if not InputMap.has_action(action):
			_failures.append("InputMap 缺少动作 %s（project.godot [input] 未注册）" % action)
	_check_key_bindings()
	var game_state := get_tree().root.get_node_or_null("GameState")
	if game_state != null:
		for signal_name in ["score_changed", "fragment_collected", "probe_finished", "wave_changed", "credibility_changed", "run_finished"]:
			if not game_state.has_signal(signal_name):
				_failures.append("autoload GameState 缺少信号 %s" % signal_name)
		_check_wave_gradient()
		_check_tuning_protocol(game_state)
	if OakKeyValidator.expected_key() != EXPECTED_KEY:
		_failures.append("OakKeyValidator.expected_key()=%s ≠ 不变式 %s（白名单被改动）" % [
			OakKeyValidator.expected_key(), EXPECTED_KEY,
		])


## 难度梯度不变式（SKILL.md §1A：数值只认 spec/配置单源）：3 波、伪造片段逐波递增、时限逐波递减。
func _check_wave_gradient() -> void:
	var waves: Array[Dictionary] = GameState.WAVES
	if waves.size() != 3:
		_failures.append("波次数应为 3（难度梯度），实际 %d" % waves.size())
		return
	for index in range(waves.size() - 1):
		var current: Dictionary = waves[index]
		var next: Dictionary = waves[index + 1]
		if int(next["decoys"]) <= int(current["decoys"]):
			_failures.append("难度梯度：第 %d 波伪造片段数（%d）未多于第 %d 波（%d）" % [
				index + 2, int(next["decoys"]), index + 1, int(current["decoys"]),
			])
		if float(next["time_seconds"]) >= float(current["time_seconds"]):
			_failures.append("难度梯度：第 %d 波时限（%.1fs）未短于第 %d 波（%.1fs）" % [
				index + 2, float(next["time_seconds"]), index + 1, float(current["time_seconds"]),
			])


func _physics_process(_delta: float) -> void:
	if _finished:
		return
	_frames += 1
	_phase_frames += 1
	if _phase == Phase.NOISE:
		_inject_noise_frame()
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
		Phase.TIMEOUT_TUNE:
			_release_move_actions()
			# 噪声相位的原始按键会真实驱动移动/探测（可能已拾取片段甚至扣过信度）：
			# 像玩家按 R 一样重开一局，把正式断言建立在干净的开局上。
			_main.restart_run()
			# 调参协议驱动超时路径：时限缩放压到下限附近，让 25s 波在帧预算内归零。
			var applied: PackedStringArray = GameState.apply_tuning({"wave_time_scale": 0.05})
			if not applied.has("wave_time_scale"):
				_failures.append("调参协议：apply_tuning 未应用 wave_time_scale（超时路径无法在帧预算内驱动）")
		Phase.RETUNE:
			_assert_wave_timeout()
			# 恢复时限缩放（apply_tuning 应即时重推当前波剩余时间，见 game_state.gd）。
			GameState.apply_tuning({"wave_time_scale": 1.0})
			if GameState.wave_time_left < 20.0:
				_failures.append("时限缩放恢复 1.0 后当前波剩余应回到标称预算，实际 %.1fs（调参未即时生效）" % GameState.wave_time_left)
		Phase.W1_A:
			Input.action_press(&"move_right")
		Phase.W1_B:
			Input.action_release(&"move_right")
			_assert_collected(1, "Fragment_OA")
			Input.action_press(&"move_up")
		Phase.W1_C:
			Input.action_release(&"move_up")
			_assert_collected(2, "Fragment_K7")
			Input.action_press(&"move_right")
		Phase.PROBE_W1:
			Input.action_release(&"move_right")
			_assert_collected(3, "Fragment_42")
			_assert_decoys_avoided(1)
			_begin_probe()
		Phase.W2_A:
			_assert_wave_advanced(2)
			Input.action_press(&"move_left")
		Phase.W2_B:
			Input.action_release(&"move_left")
			_assert_collected(1, "Fragment_OA")
			Input.action_press(&"move_up")
		Phase.W2_C:
			Input.action_release(&"move_up")
			_assert_collected(2, "Fragment_K7")
			Input.action_press(&"move_right")
		Phase.PROBE_W2:
			Input.action_release(&"move_right")
			_assert_collected(3, "Fragment_42")
			_assert_decoys_avoided(2)
			_begin_probe()
		Phase.W3_A:
			_assert_wave_advanced(3)
			Input.action_press(&"move_down")
		Phase.W3_B:
			Input.action_release(&"move_down")
			_assert_collected(1, "Fragment_OA")
			Input.action_press(&"move_right")
		Phase.W3_C:
			Input.action_release(&"move_right")
			_assert_collected(2, "Fragment_K7")
			Input.action_press(&"move_up")
		Phase.PROBE_W3:
			Input.action_release(&"move_up")
			_assert_collected(3, "Fragment_42")
			_assert_decoys_avoided(3)
			_begin_probe()
		Phase.RESTART:
			_assert_victory()
			_press_action(&"restart")
		Phase.PROBE_I1:
			_assert_fresh_run()
			_begin_probe()
		Phase.PROBE_I2:
			_assert_credibility_after_invalid(2)
			_begin_probe()
		Phase.PROBE_I3:
			_assert_credibility_after_invalid(1)
			_begin_probe()
		Phase.REPORT:
			_assert_defeat()
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


## 调参工作台协议（SKILL.md §3C，纯逻辑、无头可判）：
## TUNING_META 非空；apply_tuning 应用已声明键、拒绝未声明键、按 max 钳制。
## ⚠️ 检查完必须把调过的值恢复原状 —— 协议检查不得污染被测状态（gate-selftest D5 教训）。
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
		_failures.append("调参协议：GameState.TUNING_META 为空或不可读（数值调参区必须声明至少一个可调键，见 SKILL.md §3C）")


## ── 行为断言 ─────────────────────────────────────────────

func _assert_player_moved() -> void:
	if _player == null:
		return
	_moved_distance = _player.global_position.distance_to(_origin)
	if _moved_distance < 1.0:
		_failures.append("玩家位移 %.2fpx < 1px：InputMap 动作未生效或 velocity 未驱动 move_and_slide()" % _moved_distance)


## 断言已拾取 expected 片段，且指定片段节点确实处于「已拾取」状态。
func _assert_collected(expected: int, fragment_name: String) -> void:
	_assert_player_moved()
	if GameState.collected_fragments < expected:
		_failures.append("拾取断言失败：有效片段 %d/%d（路线移动未触发 Area2D 拾取，检查布点/帧数推导）" % [
			GameState.collected_fragments, expected,
		])
	var fragment := _find_fragment(fragment_name)
	if fragment == null:
		_failures.append("找不到片段节点 %s（本波未按布点生成或命名不符）" % fragment_name)
	elif not fragment.is_collected():
		_failures.append("片段 %s 未进入已拾取状态（拾取信号未送达或未登记）" % fragment_name)


## 本波伪造片段必须全部未被拾取（脚本路线不经过其巡逻带 = 「必须避开」玩法成立）。
func _assert_decoys_avoided(wave: int) -> void:
	if wave < 1 or wave > WAVE_FRAGMENT_COUNTS.size():
		_failures.append("伪造片段断言：波次 %d 越界" % wave)
		return
	var decoy_count: int = WAVE_FRAGMENT_COUNTS[wave - 1] - 3
	for decoy_index in decoy_count:
		var fragment := _find_fragment("FragmentDecoy_%d" % decoy_index)
		if fragment == null:
			_failures.append("第 %d 波找不到伪造片段 FragmentDecoy_%d" % [wave, decoy_index])
		elif fragment.is_collected():
			_failures.append("第 %d 波伪造片段 FragmentDecoy_%d 被误拾：脚本路线不该穿过其巡逻带" % [wave, decoy_index])


## 过波断言：波次推进 + 最近一次取证记录有效 + 界面给出「有效」反馈（验收标准 3 的 ≤2s 同帧达成）。
func _assert_wave_advanced(expected_wave: int) -> void:
	if GameState.wave != expected_wave:
		_failures.append("过波断言失败：当前第 %d 波，应为第 %d 波（有效探测未推进波次）" % [
			GameState.wave, expected_wave,
		])
	var record := _newest_record()
	if String(record.get("oak_key_probe", "")) != "valid":
		_failures.append("集齐 3 片后探测应为 valid，实际 %s（reason=%s）" % [
			String(record.get("oak_key_probe", "")), String(record.get("reason", "")),
		])
	_assert_result_text("有效")


## 超时路径断言：计时归零 → 信度 -1 + 本波重铺（片段复位、组装序列清空、局未结束）。
func _assert_wave_timeout() -> void:
	if GameState.run_over:
		_failures.append("超时不应直接终局（单次超时只扣 1 信度），但 run_over=true")
	if GameState.credibility != 2:
		_failures.append("超时后信度应为 2（3-1），实际 %d（超时未扣信度或重复扣）" % GameState.credibility)
	if GameState.collected_fragments != 0:
		_failures.append("超时重铺后有效片段计数应为 0，实际 %d" % GameState.collected_fragments)
	if GameState.wave_time_left <= 0.0:
		_failures.append("超时后本波应重新计时，剩余 %.2fs ≤ 0（重铺未恢复时限）" % GameState.wave_time_left)
	_assert_wave_fragments_visible(1)


## 每波片段可见数（真实 3 + 伪造 N）：波次生成与重铺后都应完整可见。
func _assert_wave_fragments_visible(wave: int) -> void:
	if _main == null:
		return
	var fragments_root := _main.get_node_or_null("Fragments")
	if fragments_root == null:
		_failures.append("找不到 Fragments 容器（scenes/main.tscn 层级被改动）")
		return
	var visible_count: int = 0
	for child in fragments_root.get_children():
		var fragment := child as KeyFragment
		if fragment != null and fragment.visible:
			visible_count += 1
	var expected: int = WAVE_FRAGMENT_COUNTS[wave - 1]
	if visible_count != expected:
		_failures.append("第 %d 波应有 %d 个片段可见，实际 %d（生成数量或重铺复位不对）" % [
			wave, expected, visible_count,
		])


func _assert_victory() -> void:
	if not GameState.run_over or GameState.run_outcome != &"victory":
		_failures.append("三波全过应为 victory 结局，实际 outcome=%s run_over=%s" % [
			GameState.run_outcome, GameState.run_over,
		])
	var label := _settlement_label()
	if label == null:
		_failures.append("找不到 SettlementLabel（UI/SettlementPanel 层级被改动）")
	elif not label.visible:
		_failures.append("胜利结算面板未显示")
	elif not label.text.contains("胜利"):
		_failures.append("胜利结算文案未包含「胜利」，实际：%s" % label.text)
	_assert_panel_hidden("UI/ResultPanel", "ResultPanel")


## 胜利结算重开后的新局状态：波次/信度复位、结算与结果面板都收起。
func _assert_fresh_run() -> void:
	if GameState.wave != 1:
		_failures.append("重开后应回到第 1 波，实际第 %d 波" % GameState.wave)
	if GameState.credibility != int(GameState.probe_credits):
		_failures.append("重开后信度应复位为 %d，实际 %d" % [int(GameState.probe_credits), GameState.credibility])
	_assert_panel_hidden("UI/SettlementPanel", "SettlementPanel")
	_assert_panel_hidden("UI/ResultPanel", "ResultPanel")


func _assert_credibility_after_invalid(expected: int) -> void:
	if GameState.credibility != expected:
		_failures.append("无效探测后信度应为 %d，实际 %d（扣信度路径断裂）" % [expected, GameState.credibility])
	var record := _newest_record()
	if record.is_empty():
		_failures.append("空手探测后没有新的取证记录（GameState.record_probe 未被触发）")
		return
	if String(record.get("oak_key_probe", "")) != "invalid":
		_failures.append("空手探测应为 invalid，实际 %s（reason=%s）" % [
			String(record.get("oak_key_probe", "")), String(record.get("reason", "")),
		])
	elif not String(record.get("reason", "")).contains("片段不足"):
		_failures.append("空手探测的失败原因应为「片段不足」，实际 %s" % String(record.get("reason", "")))


func _assert_defeat() -> void:
	if not GameState.run_over or GameState.run_outcome != &"defeat":
		_failures.append("信度归零应为 defeat 结局，实际 outcome=%s run_over=%s" % [
			GameState.run_outcome, GameState.run_over,
		])
	if GameState.credibility != 0:
		_failures.append("失败结算时信度应为 0，实际 %d" % GameState.credibility)
	var label := _settlement_label()
	if label == null:
		_failures.append("找不到 SettlementLabel（UI/SettlementPanel 层级被改动）")
	elif not label.visible:
		_failures.append("失败结算面板未显示")
	elif not label.text.contains("失败"):
		_failures.append("失败结算文案未包含「失败」，实际：%s" % label.text)
	# 反馈完备性（SKILL.md §3B）：整局下来结果性事件必须触发过反馈。
	if Juice.events.is_empty():
		_failures.append("反馈断言：拾取/探测/结算的结果事件没有触发任何 Juice 反馈"
			+ "（结果性事件必须挂 ≥1 条反馈；如确实移除了反馈，同步更新本断言）")


## 界面反馈断言：结果面板文案必须包含期望字样（「有效 / 无效」）。
func _assert_result_text(expected: String) -> void:
	var label := _result_label()
	if label == null:
		_failures.append("找不到 ResultLabel（UI/ResultPanel 层级被改动）")
	elif not label.visible:
		_failures.append("结果面板未显示：探测后界面没有给出反馈")
	elif not label.text.contains(expected):
		_failures.append("结果文案未包含「%s」，实际：%s" % [expected, label.text])


func _assert_panel_hidden(node_path: String, title: String) -> void:
	if _main == null:
		return
	var panel := _main.get_node_or_null(node_path) as Panel
	if panel == null:
		_failures.append("找不到 %s（UI 层级被改动）" % title)
	elif panel.visible:
		_failures.append("%s 应已收起，但仍显示" % title)


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


func _settlement_label() -> Label:
	if _main == null:
		return null
	return _main.get_node_or_null("UI/SettlementPanel/SettlementLabel") as Label


## 探测后新增的取证记录（冒烟只看增量，避免噪声相位偶发探测干扰判定）。
func _newest_record() -> Dictionary:
	if GameState.probe_history.size() <= _history_len_before_probe:
		return {}
	return GameState.probe_history[GameState.probe_history.size() - 1]


## 发起一次探测（记录取证历史基线 + 注入 confirm 事件）。
func _begin_probe() -> void:
	_history_len_before_probe = GameState.probe_history.size()
	_press_action(&"confirm")


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
		print("GODOT_SMOKE: PASS 移动/三波拾取/有效探测/过波/超时扣信度/胜利结算/重开/无效探测/失败结算/取证标记/反馈/调参协议 全部通过（%d 帧，位移 %.1fpx，取证记录 %d 条，波次 %d）" % [
			_frames, _moved_distance, GameState.probe_history.size(), GameState.wave,
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
