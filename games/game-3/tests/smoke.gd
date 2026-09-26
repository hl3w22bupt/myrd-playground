extends Node
## 无头冒烟自检（headless smoke）——《疾风忍者跑》机器可判定的「游戏能不能跑且玩得动」。
##
## 运行方式（由 scripts/smoke.sh 封装）：
##   godot --headless --path <工程目录> tests/smoke.tscn
##
## 判定协议（smoke.sh 按此断言退出码与日志）：
##   通过 → stdout 打印 `GODOT_SMOKE: PASS ...`，进程退出码 0
##   失败 → stderr 打印 `GODOT_SMOKE: FAIL <原因>`（每条一行），进程退出码 1
##
## 覆盖面（任务验收的四项 + SKILL.md 五项基线）：
##   1. 主场景可实例化（main.tscn → player.tscn / level.gd 接线未断裂）
##   2. autoload GameState 已注册且带约定信号（score_changed / game_won / game_lost）
##   3. InputMap 动作已注册、物理键绑定逐键核对（键位契约）
##   4. 玩家能移动：不注入任何输入也自动向前奔跑（跑酷核心）
##   5. 核心交互生效：跳跃 + 二段跳（jumped 信号、跳跃计数、离地位移）+ 收集飞镖（加分）
##   6. 负向可达：撞尖刺 → game_lost + 结算文案
##   7. 重开可用：restart 动作 → 分数清零 / 状态回 PLAYING / 玩家回出生点
##   8. 正向可达：跑进终点旗 → game_won + 结算文案
##
## ⚠️ 输入注入全部走 InputEventAction（不与 Input.action_press 混帧，E-08）；
##    噪声相位只注入原始事件（Key/Mouse/Touch），不污染动作级断言（模板既有约定）。

## ── 噪声相位（输入鲁棒性门禁的逐游戏语义层，模板内置，逐项保留）──
## 正式断言前注入一段确定种子的对抗输入：悬挂手势、孤儿释放、双指抢控、乱键。
const NOISE_FRAMES: int = 20

## 分阶段里程碑（物理帧）：噪声 → 自动奔跑 → 跳跃/二段跳 → 收集 → 撞刺失败 → 重开 → 过关。
const RUN_START_FRAME: int = NOISE_FRAMES + 1          # 21：记录奔跑起点
const RUN_END_FRAME: int = 41                          # 41：断言位移，并按下跳跃
const JUMP2_FRAME: int = 45                            # 45：断言一段跳，并按第二次（二段跳）
const DOUBLE_ASSERT_FRAME: int = 49                    # 49：断言二段跳生效
const TELEPORT_DART_FRAME: int = 51                    # 51：把玩家放到第一枚飞镖上
const COLLECT_ASSERT_FRAME: int = 58                   # 58：断言飞镖收集 + 加分
const TELEPORT_SPIKE_FRAME: int = 60                   # 60：把玩家放到第一簇尖刺上
const LOSE_ASSERT_FRAME: int = 67                      # 67：断言 game_lost + 失败文案
const RESTART_FRAME: int = 69                          # 69：注入 restart 动作
const RESTART_ASSERT_FRAME: int = 74                   # 74：断言重开复位
const TELEPORT_GOAL_FRAME: int = 76                    # 76：把玩家放到终点旗前
const WIN_ASSERT_FRAME: int = 88                       # 88：断言 game_won + 胜利文案
const TOTAL_FRAMES: int = 92                           # 报告兜底（smoke.sh 另有 --quit-after）

## 判定阈值。
const MIN_RUN_DISTANCE: float = 40.0                   # 20 帧自动奔跑的理论位移 = 80px
const MIN_JUMP_RISE: float = 4.0                       # 起跳后至少上升 4px（重力未拉回）
const RESTART_X_TOLERANCE: float = 120.0               # 重开 5 帧内玩家仍应在出生点附近

## InputMap 必须注册的动作。
const REQUIRED_ACTIONS: Array[StringName] = [
	&"move_left", &"move_right", &"move_up", &"move_down", &"confirm", &"jump", &"restart",
]

## 键位契约：动作 → 键表承诺的物理键，**必须全部绑定**（AND 语义，见模板 E-12 说明）。
const KEY_CONTRACT: Dictionary = {
	&"jump": [KEY_SPACE, KEY_W, KEY_UP],
	&"confirm": [KEY_ENTER, KEY_SPACE],
	&"restart": [KEY_R, KEY_ENTER],
	&"move_left": [KEY_A, KEY_LEFT],
	&"move_right": [KEY_D, KEY_RIGHT],
	&"move_up": [KEY_W, KEY_UP],
	&"move_down": [KEY_S, KEY_DOWN],
}

var _failures: PackedStringArray = []
var _frames: int = 0
var _finished: bool = false

var _main: Node2D
var _player: Player
var _level: GameLevel
var _state_label: Label

## 信号到达标记（「信号真的到达订阅方」断言层）。
var _moved_seen: bool = false
var _jumped_seen: bool = false
var _score_seen: bool = false
var _dart_seen: bool = false
var _lost_seen: bool = false
var _won_seen: bool = false
var _goal_seen: bool = false

## 阶段间采样。
var _run_origin_x: float = 0.0
var _pre_jump_y: float = 0.0
var _pre_jump_count: int = 0

## 噪声相位：确定种子随机事件（同种子同事件序，门禁可复现）。
var _noise_rng := RandomNumberGenerator.new()


func _ready() -> void:
	# headless 没有垂直同步：限 60 FPS 让 process : physics ≈ 1:1，--quit-after 兜底才有意义。
	Engine.max_fps = 60

	for action in REQUIRED_ACTIONS:
		if not InputMap.has_action(action):
			_failures.append("InputMap 缺少动作 %s（project.godot [input] 未注册）" % action)
	_check_key_bindings()

	var game_state := get_tree().root.get_node_or_null("GameState")
	if game_state == null:
		_failures.append("autoload GameState 未注册（project.godot [autoload] 缺失）")
	else:
		for signal_name in ["score_changed", "game_won", "game_lost", "state_changed"]:
			if not game_state.has_signal(signal_name):
				_failures.append("autoload GameState 缺少信号 %s" % signal_name)
		game_state.score_changed.connect(_on_score_changed)
		game_state.game_won.connect(_on_game_won)
		game_state.game_lost.connect(_on_game_lost)

	_main = get_node_or_null("Main") as Node2D
	if _main == null:
		_failures.append("冒烟场景里找不到 Main 实例（tests/smoke.tscn 未实例化 scenes/main.tscn）")
		_finish_early()
		return
	_player = _main.get_node_or_null("Player") as Player
	if _player == null:
		_failures.append("Main 场景树找不到 Player（main.tscn 未实例化 player.tscn，或脚本未挂 Player）")
	else:
		_player.moved.connect(_on_player_moved)
		_player.jumped.connect(_on_player_jumped)
	_level = _main.get_node_or_null("Level") as GameLevel
	if _level == null:
		_failures.append("Main 场景树找不到 Level（main.tscn 未挂 scripts/level.gd 的 Level 节点）")
	else:
		_level.dart_collected.connect(_on_dart_collected)
		_level.goal_reached.connect(_on_goal_reached)
	_state_label = _main.find_child("StateLabel", true, false) as Label
	if _state_label == null:
		_failures.append("Main 场景树找不到 StateLabel（结算文案没有落点）")

	# 噪声种子固定：门禁可复现。
	_noise_rng.seed = 20260926


func _physics_process(_delta: float) -> void:
	if _finished:
		return
	_frames += 1

	if _frames <= NOISE_FRAMES:
		_inject_noise_frame()
	elif _frames == RUN_START_FRAME:
		_run_origin_x = _player.global_position.x
	elif _frames == RUN_END_FRAME:
		_assert_auto_run()
		_pre_jump_y = _player.global_position.y
		_pre_jump_count = _player.jumps_used
		_press_action(&"jump")
	elif _frames == JUMP2_FRAME:
		_assert_first_jump()
		_press_action(&"jump")
	elif _frames == DOUBLE_ASSERT_FRAME:
		_assert_double_jump()
	elif _frames == TELEPORT_DART_FRAME and _level != null:
		_player.global_position = _level.DART_SPOTS[0]
	elif _frames == COLLECT_ASSERT_FRAME:
		_assert_dart_collected()
	elif _frames == TELEPORT_SPIKE_FRAME and _level != null:
		_player.global_position = Vector2(
			_level.SPIKE_XS[0], _level.GROUND_TOP_Y - 13.0)
	elif _frames == LOSE_ASSERT_FRAME:
		_assert_lost()
	elif _frames == RESTART_FRAME:
		_press_action(&"restart")
	elif _frames == RESTART_ASSERT_FRAME:
		_assert_restarted()
	elif _frames == TELEPORT_GOAL_FRAME and _level != null:
		_player.global_position = Vector2(_level.GOAL_X - 20.0, 150.0)
	elif _frames == WIN_ASSERT_FRAME:
		_assert_won()

	if _frames >= TOTAL_FRAMES or not _failures.is_empty():
		_report()


## ── 断言 ──

func _assert_auto_run() -> void:
	if _player == null:
		return
	var travelled: float = _player.global_position.x - _run_origin_x
	if travelled < MIN_RUN_DISTANCE:
		_failures.append(
			"玩家 %d 帧内自动奔跑位移 %.2fpx < %.2fpx：_physics_process 未驱动 velocity.x" % [
				RUN_END_FRAME - RUN_START_FRAME, travelled, MIN_RUN_DISTANCE])
	if not _moved_seen:
		_failures.append("信号 Player.moved 未到达订阅方：连接断裂或从未 emit")


func _assert_first_jump() -> void:
	if _player == null:
		return
	var rise: float = _pre_jump_y - _player.global_position.y
	if _player.jumps_used < _pre_jump_count + 1:
		_failures.append("按下 jump 后跳跃计数未增加（%d → %d）：跳跃输入未生效" % [
			_pre_jump_count, _player.jumps_used])
	if rise < MIN_JUMP_RISE:
		_failures.append("按下 jump 后 %.2f 帧内上升 %.2fpx < %.2fpx：跳跃没有让玩家离地" % [
			JUMP2_FRAME - RUN_END_FRAME, rise, MIN_JUMP_RISE])
	if not _jumped_seen:
		_failures.append("信号 Player.jumped 未到达订阅方：连接断裂或 try_jump 未 emit")


func _assert_double_jump() -> void:
	if _player == null:
		return
	if _player.jumps_used < _pre_jump_count + 2:
		_failures.append("空中再按 jump 后跳跃计数 %d，未达到二段跳（应 ≥ %d）：MAX_JUMPS 或输入路径断裂" % [
			_player.jumps_used, _pre_jump_count + 2])


func _assert_dart_collected() -> void:
	if GameState.score < 1:
		_failures.append("玩家压在飞镖上 %d 帧仍未加分（score=%d）：飞镖 Area2D 未检测到玩家或 dart_collected 接线断裂" % [
			COLLECT_ASSERT_FRAME - TELEPORT_DART_FRAME, GameState.score])
	if not _dart_seen:
		_failures.append("信号 Level.dart_collected 未到达订阅方：连接断裂或从未 emit")
	if not _score_seen:
		_failures.append("信号 GameState.score_changed 未到达订阅方：Main 未订阅或 add_score 未 emit")


func _assert_lost() -> void:
	if GameState.state != GameState.State.LOST:
		_failures.append("撞上尖刺后状态未变为 LOST（当前 %d）：hazard_hit → register_loss 链路断裂" % GameState.state)
	if not _lost_seen:
		_failures.append("信号 GameState.game_lost 未到达订阅方：Main 未订阅 game_lost")
	if _state_label != null and (not _state_label.visible or not _state_label.text.contains("失败")):
		_failures.append("失败后结算文案未显示「失败」：StateLabel 未被 _on_game_lost 刷新")


func _assert_restarted() -> void:
	if GameState.state != GameState.State.PLAYING:
		_failures.append("重开后状态未回到 PLAYING（当前 %d）：restart_run 未调 GameState.reset" % GameState.state)
	if GameState.score != 0:
		_failures.append("重开后分数未清零（当前 %d）：GameState.reset 未生效" % GameState.score)
	if _player != null and absf(_player.global_position.x - Player.START_POSITION.x) > RESTART_X_TOLERANCE:
		_failures.append("重开后玩家未回到出生点（x=%.1f，期望 %.1f±%.0f）：player.respawn 未生效" % [
			_player.global_position.x, Player.START_POSITION.x, RESTART_X_TOLERANCE])
	if _state_label != null and _state_label.visible:
		_failures.append("重开后结算文案仍显示：restart_run 未隐藏 StateLabel")


func _assert_won() -> void:
	if GameState.state != GameState.State.WON:
		_failures.append("跑进终点旗后状态未变为 WON（当前 %d）：goal_reached → register_win 链路断裂" % GameState.state)
	if not _goal_seen:
		_failures.append("信号 Level.goal_reached 未到达订阅方：连接断裂或从未 emit")
	if not _won_seen:
		_failures.append("信号 GameState.game_won 未到达订阅方：Main 未订阅 game_won")
	if _state_label != null and (not _state_label.visible or not _state_label.text.contains("胜利")):
		_failures.append("过关后结算文案未显示「胜利」：StateLabel 未被 _on_game_won 刷新")


func _report() -> void:
	_finished = true
	if _failures.is_empty():
		print("GODOT_SMOKE: PASS 场景实例化/autoload/键位契约/自动奔跑/跳跃二段跳/收集飞镖/撞刺失败/重开/跑底过关 全部通过")
		get_tree().quit(0)
	else:
		for failure in _failures:
			printerr("GODOT_SMOKE: FAIL %s" % failure)
		get_tree().quit(1)


## 冒烟里 main 尚未就绪时也要给出结论（不能既无 PASS 也无 FAIL）。
func _finish_early() -> void:
	_finished = true
	_report()


## ── 输入注入 ──

## 注入真实 InputEventAction → _unhandled_input 收得到（Input.action_press 触发不了它）。
func _press_action(action: StringName) -> void:
	var event := InputEventAction.new()
	event.action = action
	event.pressed = true
	Input.parse_input_event(event)


## 键位契约断言：键表承诺的每个物理键都必须已绑定到该动作（AND 语义）。
func _check_key_bindings() -> void:
	for action: StringName in KEY_CONTRACT:
		if not InputMap.has_action(action):
			continue  # 动作缺失已由 REQUIRED_ACTIONS 上报，这里不重复计失败
		var expected: Array = KEY_CONTRACT[action]
		var bound: Array[Key] = []
		for event in InputMap.action_get_events(action):
			var key := event as InputEventKey
			if key != null and key.physical_keycode != KEY_NONE:
				bound.append(key.physical_keycode)
		if not _contains_all(expected, bound):
			_failures.append("键位契约：动作 %s 未绑全键表承诺的物理键（期望全部 %s，实际 %s）—— 缺的那个键真机按了没反应" % [
				action, _key_labels(expected), _key_labels(bound)])


func _contains_all(expected: Array, bound: Array[Key]) -> bool:
	for key in expected:
		if not (key in bound):
			return false
	return true


## 键码 → 可读键名（附数值，未映射键名会打印成私有区字形）。
func _key_labels(keys: Array) -> String:
	var labels: PackedStringArray = []
	for code in keys:
		labels.append("%s(%d)" % [OS.get_keycode_string(code as Key), code])
	return "[%s]" % ", ".join(labels)


## 噪声相位：确定种子对抗输入（只注入原始事件，不注入 InputEventAction）。
func _inject_noise_frame() -> void:
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
		k.physical_keycode = [KEY_A, KEY_D, KEY_W, KEY_S, KEY_SPACE, KEY_ENTER, KEY_R][_noise_rng.randi_range(0, 6)]
		k.pressed = _noise_rng.randf() < 0.5
		Input.parse_input_event(k)


## ── 信号到达标记 ──

func _on_player_moved(_position: Vector2) -> void:
	_moved_seen = true


func _on_player_jumped(_jump_count: int) -> void:
	_jumped_seen = true


func _on_score_changed(_score: int) -> void:
	_score_seen = true


func _on_dart_collected(_dart: Dart) -> void:
	_dart_seen = true


func _on_goal_reached() -> void:
	_goal_seen = true


func _on_game_won(_final_score: int) -> void:
	_won_seen = true


func _on_game_lost(_final_score: int) -> void:
	_lost_seen = true
