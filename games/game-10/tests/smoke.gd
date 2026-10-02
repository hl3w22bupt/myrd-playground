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
## 断言覆盖（玩法闭环 + 本次晃动需求的可无头判定代理断言）：
##   A. 配置层：加速晃动幅度/频率 ≤ 改动前基线的 50%；加速特效时长 ≥10 秒（参数对比口径）
##   B. 玩法层：开局 → 跳跃移动 → 拾取金币 → 拾取加速星提速 → 撞障碍 game over → 重开
##   C. 晃动层：加速期间相机偏移峰值 ≤ 配置幅度（实测降晃）；game over 精确单晃
##      （计数恰 +1、峰值不超终局幅度、加速微抖先关不叠加）、结束后 ≥3 游戏秒
##      逐帧 offset == Vector2.ZERO（零残余抖动）；重开可再次单晃（可重触发）
##
## ⚠️ 输入注入分阶段互不重叠（error-signatures E-08）：parse_input_event 与
##    action_press 不同帧使用，避免缓冲冲刷清掉按下状态。

## ── 阶段帧表（60fps；Engine.max_fps 已限 60，process 帧 ≈ 物理帧）──
const NOISE_FRAMES: int = 24
const START_FRAME: int = NOISE_FRAMES + 1              ## 注入 confirm：READY → RUNNING
const RUNNING_CHECK_FRAME: int = START_FRAME + 10
const JUMP_FRAME: int = 36
const JUMP_CHECK_FRAME: int = JUMP_FRAME + 10
const JUMP_RELEASE_FRAME: int = JUMP_FRAME + 11
const LAND_CHECK_FRAME: int = 78
const COIN_FRAME: int = 72
const COIN_CHECK_FRAME: int = COIN_FRAME + 4
const BOOST_FRAME: int = 80
const BOOST_CHECK_FRAME: int = BOOST_FRAME + 4
const ACCEL_WINDOW_FRAMES: int = 60                    ## 加速微抖观测窗（1 秒）
const HIT_FRAME: int = 146                             ## 加速期间制造 game over
const TERMINAL_CHECK_FRAME: int = HIT_FRAME + 3
const TERMINAL_WINDOW_FRAMES: int = 24                 ## ≥ 单晃时长 0.3s = 18 帧
const STILLNESS_FRAME: int = 174                       ## 起 time_scale=6，压缩观测 3 游戏秒
const STILLNESS_TICKS: int = 35                        ## 35 tick × 0.1s = 3.5 游戏秒
const RESTART_FRAME: int = STILLNESS_FRAME + STILLNESS_TICKS + 1
const RESTART_CHECK_FRAME: int = RESTART_FRAME + 4
const HIT2_FRAME: int = 216                            ## 二次终局：验证单晃可重触发
const REARM_CHECK_FRAME: int = HIT2_FRAME + 2
const TOTAL_FRAMES: int = REARM_CHECK_FRAME + 2

const MIN_JUMP_RISE_PX: float = 20.0
## 晃动峰值判定余量（sin 有界，理论峰值=幅度）。
const AMP_SLACK_PX: float = 0.01
## 加速降晃验收线：幅度/频率 ≤ 基线 50%。
const ACCEL_REDUCTION_RATIO: float = 0.5

const REQUIRED_ACTIONS: Array[StringName] = [
	&"move_left", &"move_right", &"move_up", &"move_down", &"confirm", &"jump",
]

## 键位契约：动作 → 键表承诺的物理键，**必须全部绑定**（AND 语义，逐键核对）。
const KEY_CONTRACT: Dictionary = {
	&"move_left": [KEY_A, KEY_LEFT],
	&"move_right": [KEY_D, KEY_RIGHT],
	&"move_up": [KEY_W, KEY_UP],
	&"move_down": [KEY_S, KEY_DOWN],
	&"confirm": [KEY_SPACE, KEY_ENTER],
	&"jump": [KEY_SPACE, KEY_UP, KEY_W],
}

var _failures: PackedStringArray = []
var _frames: int = 0
var _finished: bool = false
var _main: Node2D
var _player: Player
var _camera: ScreenShake

var _jumped_seen: bool = false
var _score_seen: bool = false
var _accel_max_amp: float = 0.0
var _accel_sign_changes: int = 0
var _accel_prev_x: float = 0.0
var _accel_held_whole_window: bool = true
var _terminal_max_amp: float = 0.0
var _stillness_ticks: int = 0
var _origin_y: float = 0.0


func _ready() -> void:
	# headless 无垂直同步：限 60 FPS 让 process 帧 : 物理帧 ≈ 1:1，--quit-after 兜底才有意义。
	Engine.max_fps = 60

	for action in REQUIRED_ACTIONS:
		if not InputMap.has_action(action):
			_failures.append("InputMap 缺少动作 %s（project.godot [input] 未注册）" % action)
	_check_key_bindings()
	_check_shake_config()
	_check_tuning_bridge()

	var game_state := get_tree().root.get_node_or_null("GameState")
	if game_state == null:
		_failures.append("autoload GameState 未注册（project.godot [autoload] 缺失）")
	else:
		for signal_name in ["score_changed", "state_changed", "speed_changed", "distance_changed"]:
			if not game_state.has_signal(signal_name):
				_failures.append("autoload GameState 缺少信号 %s" % signal_name)
		game_state.score_changed.connect(_on_score_changed)

	_main = get_node_or_null("Main")
	if _main == null:
		_failures.append("冒烟场景未实例化主场景（tests/smoke.tscn 缺少 Main 子节点）")
		_finished = true
		return
	_player = _main.get_node_or_null("Player") as Player
	_camera = _main.get_node_or_null("GameCamera") as ScreenShake
	if _player == null:
		_failures.append("主场景找不到 Player（main.tscn 未实例化 player.tscn）")
	else:
		_player.jumped.connect(_on_player_jumped)
	if _camera == null:
		_failures.append("主场景找不到 GameCamera（ScreenShake 相机缺失，晃动无处生效）")


func _physics_process(_delta: float) -> void:
	if _finished:
		return
	_frames += 1

	if _failures.is_empty():
		if _frames <= NOISE_FRAMES:
			_inject_noise_frame()
		elif _frames == START_FRAME:
			_press_action(&"confirm")
		elif _frames == RUNNING_CHECK_FRAME:
			if GameState.state != GameState.State.RUNNING:
				_failures.append("注入 confirm 后未进入 RUNNING（开局流程断裂）")
		elif _frames == JUMP_FRAME:
			_origin_y = _player.position.y
			Input.action_press(&"jump")
		elif _frames == JUMP_CHECK_FRAME:
			var rise: float = _origin_y - _player.position.y
			if rise < MIN_JUMP_RISE_PX:
				_failures.append("按跳跃 %d 帧后上升 %.1fpx < %.1fpx：jump 动作未驱动玩家" % [
					JUMP_CHECK_FRAME - JUMP_FRAME, rise, MIN_JUMP_RISE_PX,
				])
			if not _jumped_seen:
				_failures.append("信号 Player.jumped 未到达订阅方：连接断裂或从未 emit")
		elif _frames == JUMP_RELEASE_FRAME:
			Input.action_release(&"jump")
		elif _frames == LAND_CHECK_FRAME:
			if absf(_player.position.y - Player.FLOOR_Y) > 0.5:
				_failures.append("跳跃后未落回地面（y=%.1f ≠ %.1f）：重力/落地钳制失效" % [
					_player.position.y, Player.FLOOR_Y,
				])
		elif _frames == COIN_FRAME:
			_main.spawn_pickup_at("coin", _player.position)
		elif _frames == COIN_CHECK_FRAME:
			if GameState.score != GameState.COIN_SCORE or not _score_seen:
				_failures.append("金币拾取未生效（score=%d，信号到达=%s）：拾取链路断裂" % [
					GameState.score, _score_seen,
				])
		elif _frames == BOOST_FRAME:
			_main.spawn_pickup_at("boost", _player.position)
		elif _frames == BOOST_CHECK_FRAME:
			if not GameState.is_speeding():
				_failures.append("拾取加速星后未进入加速特效（start_speeding 未生效）")
		elif _frames >= BOOST_CHECK_FRAME and _frames < BOOST_CHECK_FRAME + ACCEL_WINDOW_FRAMES:
			_measure_accel_frame()
		elif _frames == BOOST_CHECK_FRAME + ACCEL_WINDOW_FRAMES:
			_assert_accel_window()
		elif _frames == HIT_FRAME:
			if not GameState.is_speeding():
				_failures.append("加速特效未持续（时长 %ss < 观测窗 %ss）" % [
					GameState.ACCEL_DURATION_S, ACCEL_WINDOW_FRAMES / 60.0,
				])
			_main.spawn_obstacle_at(_player.position)
		elif _frames == TERMINAL_CHECK_FRAME:
			_assert_terminal_triggered()
		elif _frames > TERMINAL_CHECK_FRAME and _frames <= TERMINAL_CHECK_FRAME + TERMINAL_WINDOW_FRAMES:
			_measure_terminal_frame()
		elif _frames == TERMINAL_CHECK_FRAME + TERMINAL_WINDOW_FRAMES + 1:
			_assert_terminal_settled()
			if _failures.is_empty():
				Engine.time_scale = 6.0  # 压缩时间：35 tick ≈ 3.5 游戏秒
		elif _frames > STILLNESS_FRAME and _frames < RESTART_FRAME:
			_measure_stillness_frame()
		elif _frames == RESTART_FRAME:
			Engine.time_scale = 1.0
			var observed_s: float = float(_stillness_ticks) * 0.1
			if observed_s < 3.0:
				_failures.append("静止观测仅 %.1f 游戏秒 < 3.0（观测窗不足）" % observed_s)
			_press_action(&"confirm")  # game over 界面 → 重开
		elif _frames == RESTART_CHECK_FRAME:
			_assert_restarted()
		elif _frames == HIT2_FRAME:
			_main.spawn_obstacle_at(_player.position)
		elif _frames == REARM_CHECK_FRAME:
			if _camera.terminal_shake_count != 2:
				_failures.append("二次 game over 未重新单晃（累计 %d ≠ 2）：重开后晃动未复位" % _camera.terminal_shake_count)

	if _frames >= TOTAL_FRAMES or not _failures.is_empty():
		_finished = true
		_report()


## ── 配置层验收（参数对比口径，无需运行即可判）──────────────────
func _check_shake_config() -> void:
	var accel: Dictionary = GameState.shake_params(&"accel")
	var terminal: Dictionary = GameState.shake_params(&"game_over")
	var baseline: Dictionary = GameState.SHAKE_LEGACY_BASELINE
	var accel_amp: float = float(accel.get("amplitude_px", 0.0))
	var accel_hz: float = float(accel.get("frequency_hz", 0.0))
	var base_amp: float = float(baseline.get("accel_amplitude_px", 0.0))
	var base_hz: float = float(baseline.get("accel_frequency_hz", 0.0))
	if accel_amp > base_amp * ACCEL_REDUCTION_RATIO + AMP_SLACK_PX:
		_failures.append("加速晃动幅度 %.2fpx > 基线 %.2fpx 的 50%%：降晃不达标" % [accel_amp, base_amp])
	if accel_hz > base_hz * ACCEL_REDUCTION_RATIO + 0.01:
		_failures.append("加速晃动频率 %.1fHz > 基线 %.1fHz 的 50%%：降晃不达标" % [accel_hz, base_hz])
	if GameState.ACCEL_DURATION_S < 10.0:
		_failures.append("加速特效时长 %.1fs < 10s（验收口径不满足）" % GameState.ACCEL_DURATION_S)
	if float(terminal.get("duration_s", 1.0)) > 0.5:
		_failures.append("终局单晃时长 %.2fs > 0.5s：不够短促" % float(terminal.get("duration_s", 1.0)))


## ── 调参桥（§3C）桌面可机判的一半：白名单 + 钳制 + 副本语义 + 复位 ──
func _check_tuning_bridge() -> void:
	var applied: PackedStringArray = GameState.apply_tuning({
		"shake_accel_amplitude_px": 99.0,
		"shake_accel_frequency_hz": 2.0,
		"not_a_tuning_key": 1.0,
		"shake_game_over_duration_s": "x",
	})
	if applied.size() != 2:
		_failures.append("调参桥白名单/类型过滤失效（applied=%s，应只收 2 个数值键）" % [applied])
	var accel: Dictionary = GameState.shake_params(&"accel")
	if not is_equal_approx(float(accel.get("amplitude_px", 0.0)), 3.0):
		_failures.append("调参覆盖未钳到验收上界（accel amplitude=%.2f ≠ 3.0）" % float(accel.get("amplitude_px", 0.0)))
	if not is_equal_approx(float(accel.get("frequency_hz", 0.0)), 2.0):
		_failures.append("调参覆盖未生效（accel frequency=%.1f ≠ 2.0）" % float(accel.get("frequency_hz", 0.0)))
	var default_duration: float = float(GameState.SHAKE_CONFIG["game_over"]["duration_s"])
	if not is_equal_approx(float(GameState.shake_params(&"game_over").get("duration_s", 0.0)), default_duration):
		_failures.append("未覆盖键被意外改动（duration_s 应保持 %s）" % str(default_duration))
	if not is_equal_approx(float(GameState.SHAKE_CONFIG["accel"]["amplitude_px"]), 1.2):
		_failures.append("SHAKE_CONFIG 常量被调参改写（覆盖必须落在副本上）")
	GameState.clear_tuning()
	if not is_equal_approx(float(GameState.shake_params(&"accel").get("amplitude_px", 0.0)), 1.2):
		_failures.append("clear_tuning 未恢复默认（accel amplitude ≠ 1.2）")


## ── 加速微抖观测窗 ──
func _measure_accel_frame() -> void:
	if not GameState.is_speeding() or not _camera.rumble_active:
		_accel_held_whole_window = false
	var amp: float = maxf(absf(_camera.offset.x), absf(_camera.offset.y))
	_accel_max_amp = maxf(_accel_max_amp, amp)
	if signf(_camera.offset.x) != signf(_accel_prev_x) and _camera.offset.x != 0.0:
		_accel_sign_changes += 1
	_accel_prev_x = _camera.offset.x


func _assert_accel_window() -> void:
	var bound: float = float(GameState.shake_params(&"accel").get("amplitude_px", 0.0)) + AMP_SLACK_PX
	if not _accel_held_whole_window:
		_failures.append("加速微抖在观测窗内中断（speeding/rumble 标志被提前关闭）")
	if _accel_max_amp > bound:
		_failures.append("加速期间相机偏移峰值 %.2fpx > 配置幅度上限 %.2fpx：晃动超调" % [_accel_max_amp, bound])
	if _accel_sign_changes > 14:
		_failures.append("加速微抖 %d 次过零（观测 1s，5Hz 应约 10 次）：频率失控" % _accel_sign_changes)


## ── 终局单晃 ──
func _assert_terminal_triggered() -> void:
	if GameState.state != GameState.State.GAME_OVER:
		_failures.append("撞障碍后未进入 GAME_OVER（胜负判定断裂）")
		return
	if _camera.terminal_shake_count != 1:
		_failures.append("game over 触发的晃动次数 %d ≠ 1：终局单晃被破坏" % _camera.terminal_shake_count)
	if GameState.is_speeding() or _camera.rumble_active:
		_failures.append("game over 时加速微抖未先关闭：存在晃动叠加源")


func _measure_terminal_frame() -> void:
	var amp: float = maxf(absf(_camera.offset.x), absf(_camera.offset.y))
	_terminal_max_amp = maxf(_terminal_max_amp, amp)
	if _camera.terminal_shake_count != 1:
		_failures.append("终局晃动期间计数变为 %d：出现了重复晃动" % _camera.terminal_shake_count)


func _assert_terminal_settled() -> void:
	var bound: float = float(GameState.shake_params(&"game_over").get("amplitude_px", 0.0)) + AMP_SLACK_PX
	if _terminal_max_amp > bound:
		_failures.append("终局晃动峰值 %.2fpx > 配置幅度 %.2fpx：单晃被放大/叠加" % [_terminal_max_amp, bound])
	if _camera.terminal_shake_count != 1:
		_failures.append("终局晃动结束后累计 %d 次 ≠ 1：game over 后出现了额外晃动" % _camera.terminal_shake_count)


## ── 终局后静止（≥3 游戏秒零残余）──
func _measure_stillness_frame() -> void:
	_stillness_ticks += 1
	if _camera.offset != Vector2.ZERO:
		_failures.append("game over 单晃结束后第 %d tick 相机偏移 %s ≠ 零：存在残余抖动" % [
			_stillness_ticks, _camera.offset,
		])
	if _camera.terminal_shake_count != 1:
		_failures.append("静止观测期出现新晃动（累计 %d）：单晃后仍有重复触发" % _camera.terminal_shake_count)


## ── 重开 ──
func _assert_restarted() -> void:
	if GameState.state != GameState.State.RUNNING:
		_failures.append("game over 界面注入 confirm 后未重开（state=%s）" % GameState.state)
	if GameState.score != 0:
		_failures.append("重开后分数未清零（%d）" % GameState.score)
	if _camera.offset != Vector2.ZERO:
		_failures.append("重开后相机偏移 %s ≠ 零：新一局带入了旧晃动" % _camera.offset)
	if _camera.terminal_shake_count != 1:
		_failures.append("重开不应触发晃动（累计 %d ≠ 1）" % _camera.terminal_shake_count)


## ── 基础设施（与模板一致）────────────────────────────────────
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


func _report() -> void:
	if _failures.is_empty():
		var base_amp: float = float(GameState.SHAKE_LEGACY_BASELINE.get("accel_amplitude_px", 0.0))
		var reduction: float = (1.0 - _accel_max_amp / base_amp) * 100.0 if base_amp > 0.0 else 0.0
		print("GODOT_SMOKE: PASS 场景/autoload/键位契约/移动/拾取/胜负/重开 全部通过；" \
			+ "加速晃动峰值 %.2fpx（基线 %.1fpx，实测降 %.0f%%）、过零 %d 次；" % [_accel_max_amp, base_amp, reduction, _accel_sign_changes] \
			+ "终局单晃 %d 次、峰值 %.2fpx、静止 %d tick（%.1f 游戏秒）零残余" % [
				_camera.terminal_shake_count, _terminal_max_amp, _stillness_ticks, float(_stillness_ticks) * 0.1,
			])
		get_tree().quit(0)
	else:
		for failure in _failures:
			printerr("GODOT_SMOKE: FAIL %s" % failure)
		get_tree().quit(1)


func _on_player_jumped() -> void:
	_jumped_seen = true


func _on_score_changed(_score: int) -> void:
	_score_seen = true


## ── 噪声相位（输入鲁棒性：对抗事件序后断言照常通过）──
var _noise_rng := RandomNumberGenerator.new()


func _inject_noise_frame() -> void:
	if _frames == 1:
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
