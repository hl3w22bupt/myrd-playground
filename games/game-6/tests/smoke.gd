extends Node
## 无头冒烟自检（headless smoke）—— 跑酷骨架「能不能跑且玩得动」的机器判定。
##
## 运行方式（由 std-skills/godot-game-dev/scripts/smoke.sh 封装）：
##   godot --headless --path <工程目录> tests/smoke.tscn
## 判定协议（smoke.sh 按此双断言）：
##   通过 → stdout 打印 `GODOT_SMOKE: PASS ...`，进程退出码 0
##   失败 → stderr 打印 `GODOT_SMOKE: FAIL <原因>`（每条一行），进程退出码 1
##
## 断言覆盖（脚手架节点要求 + 模板五项最低标准）：
##   1. 主场景可实例化（main.tscn → player/coin/obstacle 接线未断裂）
##   2. autoload GameState 已注册且带约定信号（score_changed / coins_changed / run_ended）
##   3. InputMap 动作已注册 + 物理键绑定逐键核对（键位契约）+ 注入输入后对象真的动了
##   4. 信号真的到达订阅方（moved / score_changed / coins_changed / run_ended）
##   5. 玩法闭环：自动奔跑位移 → 滑铲生效 → 撞障碍死亡（负）→ 按钮重开 → 跳跃越障 →
##      收集达标判胜（正）——「玩家能移动、核心交互生效、胜负可达、重开可用」
##
## ⚠️ 输入注入只用 Input.parse_input_event（不与 Input.action_press 同帧混用，
##   见 references/error-signatures.md E-08）；先释放再按下，避免噪声相位的
##   按键残留吞掉 just_pressed 边沿。

## ── 噪声相位：正式断言前注入确定种子的对抗输入（模板同源），验证输入管线不被楔死 ──
const NOISE_FRAMES: int = 30

## RUN_A（负向局）：重开后不跳，撞障碍应判负。滑铲注入点（相对重开帧）。
const SLIDE_RELEASE_AT: int = 8
const SLIDE_PRESS_AT: int = 9
const SLIDE_CHECK_AT: int = 16
const AUTORUN_CHECK_AT: int = 20
## 自动奔跑位移断言的最小位移（px）。
const MIN_MOVE_DISTANCE: float = 100.0
## 障碍物中心 x（与 scenes/main.tscn 的 Obstacle1 position.x 一致）。
const OBSTACLE_X: float = 470.0
## RUN_B（正向局）：越过障碍的起跳触发线（玩家 x ≥ 该值即注入跳跃；
## 起跳点 300 → 弧线 300..540，在 B1 金币(560)前落地，越障与收集都留足裕度）。
const JUMP_TRIGGER_X: float = 300.0
## 跳跃后判定离地的最低高度（站立中心 y=268，上升 ≥10px 即视为离地）。
const AIRBORNE_MAX_Y: float = 258.0
## 阶段帧预算（60FPS 物理帧；正常流程 ~192 帧完成）。
## TOTAL_FRAME_BUDGET 必须显著小于 smoke.sh 的 --quit-after 240 兜底：
## 物理帧比 process 帧滞后数帧，预算贴满会被兜底先杀 → 既无 PASS 也无 FAIL。
const RUN_A_DEADLINE: int = 130
const RUN_B_DEADLINE: int = 115
const TOTAL_FRAME_BUDGET: int = 210

enum Phase { NOISE, RUN_A, BETWEEN, RUN_B, DONE }

const REQUIRED_ACTIONS: Array[StringName] = [
	&"move_left", &"move_right", &"move_up", &"move_down", &"confirm",
	&"jump", &"slide",
]

## 键位契约：动作 → 键表承诺的物理键，逐键核对（AND 语义，见模板 smoke.gd 说明）。
const KEY_CONTRACT: Dictionary = {
	&"move_left": [KEY_A, KEY_LEFT],
	&"move_right": [KEY_D, KEY_RIGHT],
	&"move_up": [KEY_W, KEY_UP],
	&"move_down": [KEY_S, KEY_DOWN],
	&"confirm": [KEY_SPACE, KEY_ENTER],
	&"jump": [KEY_W, KEY_UP, KEY_SPACE],
	&"slide": [KEY_S, KEY_DOWN],
}

var _failures: PackedStringArray = []
var _frames: int = 0
var _phase: Phase = Phase.NOISE
var _phase_started_at: int = 0
var _slide_check_done: bool = false
var _autorun_check_done: bool = false
var _jump_released: bool = false
var _jump_injected: bool = false
var _airborne_seen: bool = false

var _player: Player
var _main: RunnerMain
var _origin_x: float = 0.0
var _moved_seen: bool = false
var _score_seen: bool = false
var _coins_seen: bool = false
var _run_ended_seen: bool = false
var _reported: bool = false


func _ready() -> void:
	# headless 没有垂直同步：限到 60FPS 让 process 帧 : 物理帧 ≈ 1:1，
	# --quit-after 的帧预算兜底才有意义（模板实测坑，勿删）。
	Engine.max_fps = 60

	for action in REQUIRED_ACTIONS:
		if not InputMap.has_action(action):
			_failures.append("InputMap 缺少动作 %s（project.godot [input] 未注册）" % action)
	_check_key_bindings()

	var game_state := get_tree().root.get_node_or_null("GameState")
	if game_state == null:
		_failures.append("autoload GameState 未注册（project.godot [autoload] 缺失）")
	else:
		for signal_name in ["score_changed", "coins_changed", "run_ended"]:
			if not game_state.has_signal(signal_name):
				_failures.append("autoload GameState 缺少信号 %s" % signal_name)
		game_state.score_changed.connect(_on_score_changed)
		game_state.coins_changed.connect(_on_coins_changed)
		game_state.run_ended.connect(_on_run_ended)

	_player = get_tree().root.find_child("Player", true, false) as Player
	if _player == null:
		_failures.append("场景树找不到 Player（main.tscn 未实例化 player.tscn，或实例名不是 Player）")
	else:
		_player.moved.connect(_on_player_moved)

	var main_node := get_tree().root.find_child("Main", true, false) as RunnerMain
	if main_node == null:
		_failures.append("场景树找不到 Main（smoke.tscn 未实例化 main.tscn）")
	else:
		_main = main_node


func _physics_process(_delta: float) -> void:
	if _phase == Phase.DONE:
		return
	_frames += 1

	if _failures.is_empty():
		match _phase:
			Phase.NOISE:
				_inject_noise_frame()
				if _frames >= NOISE_FRAMES:
					# 噪声结束后立即重开：丢弃噪声局，进入干净的负向局。
					_enter_phase(Phase.RUN_A)
					_main.restart_run()
					_origin_x = _player.global_position.x
			Phase.RUN_A:
				_tick_run_a()
			Phase.BETWEEN:
				_tick_between()
			Phase.RUN_B:
				_tick_run_b()
			Phase.DONE:
				pass

	if _frames >= TOTAL_FRAME_BUDGET:
		_failures.append("冒烟未在 %d 帧预算内完成（当前阶段 %s）—— 帧预算或阶段推进卡死" % [
			TOTAL_FRAME_BUDGET, Phase.keys()[_phase],
		])
	if not _failures.is_empty() or _phase == Phase.DONE:
		_phase = Phase.DONE
		_report()


func _enter_phase(phase: Phase) -> void:
	_phase = phase
	_phase_started_at = _frames


## ── RUN_A：负向局（不跳）—— 自动奔跑位移 + 滑铲生效 + 撞障碍判负 ──
func _tick_run_a() -> void:
	var rel: int = _frames - _phase_started_at
	if rel == SLIDE_RELEASE_AT:
		_release_action(&"slide")
	elif rel == SLIDE_PRESS_AT:
		_press_action(&"slide")
	elif rel == SLIDE_CHECK_AT and not _slide_check_done:
		_slide_check_done = true
		if not _player.is_sliding():
			_failures.append("注入 slide 动作后玩家未进入滑铲态（player.gd 未读 InputMap 动作 slide）")
	elif rel == AUTORUN_CHECK_AT and not _autorun_check_done:
		_autorun_check_done = true
		var travelled: float = _player.global_position.x - _origin_x
		if travelled < MIN_MOVE_DISTANCE:
			_failures.append("自动奔跑 %d 帧位移 %.2fpx < %.2fpx：跑酷内核（velocity.x）未生效" % [
				AUTORUN_CHECK_AT, travelled, MIN_MOVE_DISTANCE,
			])
	if rel > RUN_A_DEADLINE:
		_failures.append("负向局 %d 帧内未撞上障碍（x=%.0f 处）触发死亡：碰撞/死亡链路断裂" % [
			RUN_A_DEADLINE, OBSTACLE_X,
		])
		_finish()


func _tick_between() -> void:
	if _frames - _phase_started_at < 2:
		return
	# 重开走「结算页按钮」的真实信号路径（断言重开接线，而不是直接调方法）。
	_main.restart_button.pressed.emit()
	if GameState.coins != 0 or GameState.score != 0:
		_failures.append("重开后金币/得分未清零（GameState.start_run 未复位）：%d/%d" % [
			GameState.coins, GameState.score,
		])
	if GameState.run_active == false:
		_failures.append("重开后 run_active 为 false：新局未启动")
	if _main.settle_panel.visible:
		_failures.append("重开后结算页仍可见（restart_run 未隐藏 SettlePanel）")
	_enter_phase(Phase.RUN_B)


## ── RUN_B：正向局 —— 跳跃越障 + 收集达标判胜 ──
func _tick_run_b() -> void:
	var rel: int = _frames - _phase_started_at
	if not _jump_injected and _player.global_position.x >= JUMP_TRIGGER_X:
		if not _jump_released:
			_release_action(&"jump")
			_jump_released = true
		else:
			_press_action(&"jump")
			_jump_injected = true
	if _jump_injected and _player.global_position.y < AIRBORNE_MAX_Y:
		_airborne_seen = true
	if rel > RUN_B_DEADLINE:
		_failures.append("正向局 %d 帧内未达成收集目标判胜：金币 %d/%d，越障=%s" % [
			RUN_B_DEADLINE, GameState.coins, GameState.WIN_COIN_GOAL, _airborne_seen,
		])
		_finish()


func _finish() -> void:
	_phase = Phase.DONE
	_report()


## ── GameState.run_ended 到达订阅方后的逐局断言 ──
func _on_run_ended(win: bool, score: int, coins: int, distance_m: float) -> void:
	_run_ended_seen = true
	if _phase == Phase.RUN_A:
		if win:
			_failures.append("负向局（未跳跃）被判胜：障碍碰撞未触发死亡")
		if coins != 3:
			_failures.append("负向局死亡时金币应为 3（撞障碍前的一串），实际 %d：收集链路异常" % coins)
		if score <= 0:
			_failures.append("负向局死亡时得分应 > 0（距离分+金币分），实际 %d" % score)
		if distance_m <= 0.0:
			_failures.append("负向局死亡时距离应 > 0，实际 %.1f" % distance_m)
		_enter_phase(Phase.BETWEEN)
	elif _phase == Phase.RUN_B:
		if not win:
			_failures.append("正向局被判负：金币 %d/%d —— 跳跃越障或收集目标判定异常" % [
				coins, GameState.WIN_COIN_GOAL,
			])
		if coins < GameState.WIN_COIN_GOAL:
			_failures.append("胜利时金币 %d 未达目标 %d" % [coins, GameState.WIN_COIN_GOAL])
		if not _airborne_seen:
			_failures.append("正向局未观察到玩家离地：注入 jump 动作后玩家没有真的跳起")
		_finish()


## ── 无显示设备时模拟「玩家按键」：注入真实 InputEvent（模板同源）──
func _press_action(action: StringName) -> void:
	var event := InputEventAction.new()
	event.action = action
	event.pressed = true
	Input.parse_input_event(event)


func _release_action(action: StringName) -> void:
	var event := InputEventAction.new()
	event.action = action
	event.pressed = false
	Input.parse_input_event(event)


## 键位契约断言：目标键表 → project.godot [input] 的 physical_keycode（逐键 AND）。
func _check_key_bindings() -> void:
	for action: StringName in KEY_CONTRACT:
		if not InputMap.has_action(action):
			continue  # 动作缺失已由 REQUIRED_ACTIONS 断言上报
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
	if _reported:
		return
	_reported = true
	if not _moved_seen:
		_failures.append("信号 Player.moved 未到达订阅方：连接断裂或从未 emit")
	if not _score_seen:
		_failures.append("信号 GameState.score_changed 未到达订阅方")
	if not _coins_seen:
		_failures.append("信号 GameState.coins_changed 未到达订阅方")
	if not _run_ended_seen:
		_failures.append("信号 GameState.run_ended 未到达订阅方（胜负判定从未发生）")
	if _failures.is_empty():
		print("GODOT_SMOKE: PASS 场景实例化/自动奔跑/滑铲/收集/撞障碍判负/按钮重开/跳跃越障/达标判胜 全部通过")
		get_tree().quit(0)
	else:
		for failure in _failures:
			printerr("GODOT_SMOKE: FAIL %s" % failure)
		get_tree().quit(1)


func _on_player_moved(_position: Vector2) -> void:
	_moved_seen = true


func _on_score_changed(_score: int) -> void:
	_score_seen = true


func _on_coins_changed(_coins: int) -> void:
	_coins_seen = true


## ── 噪声相位：确定种子随机事件（原始事件，不含 InputEventAction，模板同源）──
var _noise_rng := RandomNumberGenerator.new()


func _inject_noise_frame() -> void:
	if _frames == 1:
		_noise_rng.seed = 20260913  # 门禁要求可复现：同种子同事件序
	var roll := _noise_rng.randf()
	var pos := Vector2(_noise_rng.randf_range(0, 960), _noise_rng.randf_range(0, 540))
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
