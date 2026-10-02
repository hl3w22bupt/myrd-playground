extends Node
## 无头冒烟自检（headless smoke）—— 接苹果（game-11）机器可判定的「能不能跑且玩得动」。
##
## 运行方式（由 scripts/smoke.sh 封装）：
##   godot --headless --path <工程目录> tests/smoke.tscn
##
## 判定协议（smoke.sh 按此断言退出码与日志）：
##   通过 → stdout 打印 `GODOT_SMOKE: PASS ...`，进程退出码 0
##   失败 → stderr 打印 `GODOT_SMOKE: FAIL <原因>`（每条一行），进程退出码 1
##
## 断言覆盖（需求验收标准中可无头判定的部分，逐项对应）：
##   1. 场景可实例化（main.tscn → player.tscn 接线未断裂，Player 找得到）
##   2. autoload 已注册且带约定信号（score_changed / lives_changed / state_changed / game_over）
##   3. InputMap 动作已注册、物理键绑定正确（键位契约逐键 AND），注入输入后果篮真的动了
##   4. 信号真的到达订阅方（Player.moved / GameState.score_changed / game_over）
##   5. 开局入口可用（confirm 动作 → state 变 PLAYING，开始面板隐藏）
##   6. 核心交互生效（接住 +1 分；漏接 -1 生命；难度随得分可观测递增）
##   7. 胜负可达（生命耗尽 → GAME_OVER + 结算面板可见 + 最高分落盘）
##   8. 重开可用（confirm → 回 PLAYING，分数/生命重置，结算面板隐藏）
##
## ⚠️ 输入注入分阶段互不重叠（见 references/error-signatures.md E-08）：
##   `Input.parse_input_event()` 的缓冲冲刷会清掉 `Input.action_press()` 的按下状态，
##   两者同帧混用会让「移动断言」假失败 —— confirm 注入与移动阶段之间隔了多帧。

## ── 噪声相位（输入鲁棒性门禁的逐游戏语义层，模板内置，保留）──
## 正式断言前注入一段确定种子的对抗输入：悬挂手势（按下不抬起）、孤儿释放（抬起无按下）、
## 双指抢控、乱键。随后照常执行移动/收集断言 —— 断言仍全过 = 噪声没有楔死输入管线。
const NOISE_FRAMES: int = 30

## ── 各相位帧预算（总预算远小于 GODOT_SMOKE_FRAMES=240）──
const START_FRAMES: int = 6          # 注入 confirm 后等待状态翻转
const MOVE_FRAMES: int = 10          # 按住 move_right 的帧数
const CATCH_FRAMES: int = 10         # 等待 Area2D 重叠判定 + 信号送达
const MISS_FRAMES_MAX: int = 45      # 等待苹果落到底线（漏接）
const EXHAUST_FRAMES: int = 4        # 等待 game_over 信号与结算面板刷新
const RESTART_FRAMES: int = 6        # 注入 confirm 后等待重开
const TOTAL_FRAMES: int = NOISE_FRAMES + START_FRAMES + MOVE_FRAMES + CATCH_FRAMES \
		+ MISS_FRAMES_MAX + EXHAUST_FRAMES + RESTART_FRAMES + 6

## 判定「真的移动了」的最小位移（px）：BASKET_SPEED=340，10 帧理论位移 ≈ 57px。
const MIN_MOVE_DISTANCE: float = 20.0
## 漏接相位的下落加速（px/s）：把等待压进帧预算，不改变玩法语义。
const MISS_FALL_SPEED: float = 900.0
## 漏接相位的苹果出生点：远离果篮（移动相位后果篮在右侧半场）。
const MISS_APPLE_POS := Vector2(40, -20)

const REQUIRED_ACTIONS: Array[StringName] = [
	&"move_left", &"move_right", &"move_up", &"move_down", &"confirm",
]

## 键位契约：动作 → 键表承诺的物理键，**必须全部绑定**（与 project.godot [input] 对应）。
## 逐键核对（AND）而非「绑了其中一个就算过」：键表写「A / ←」就是承诺两个键都能用。
const KEY_CONTRACT: Dictionary = {
	&"move_left": [KEY_A, KEY_LEFT],
	&"move_right": [KEY_D, KEY_RIGHT],
	&"move_up": [KEY_W, KEY_UP],
	&"move_down": [KEY_S, KEY_DOWN],
	&"confirm": [KEY_SPACE, KEY_ENTER],
}

enum Phase { NOISE, START, MOVE, CATCH, MISS, EXHAUST, RESTART, REPORT }

var _failures: PackedStringArray = []
var _phase: Phase = Phase.NOISE
var _phase_frame: int = 0
var _frames: int = 0
var _finished: bool = false

var _main: MainGame
var _player: Player
var _origin: Vector2 = Vector2.ZERO
var _miss_apple: Apple

var _moved_seen: bool = false
var _score_seen: bool = false
var _state_playing_seen: bool = false
var _game_over_seen: bool = false

var _score_before_catch: int = 0
var _lives_before_miss: int = 0
var _score_at_game_over: int = 0


func _ready() -> void:
	# headless 没有垂直同步，process 帧率可跑到几百上千 FPS，而物理固定 60Hz。
	# `--quit-after N` 数的是 process 帧：限到 60 FPS 让 process 帧 : 物理帧 ≈ 1:1，
	# --quit-after 的兜底才有意义（模板既有做法，不得删除）。
	Engine.max_fps = 60

	for action in REQUIRED_ACTIONS:
		if not InputMap.has_action(action):
			_failures.append("InputMap 缺少动作 %s（project.godot [input] 未注册）" % action)
	_check_key_bindings()

	var game_state := get_tree().root.get_node_or_null("GameState")
	if game_state == null:
		_failures.append("autoload GameState 未注册（project.godot [autoload] 缺失）")
	else:
		for signal_name in ["score_changed", "lives_changed", "state_changed", "game_over", "best_changed"]:
			if not game_state.has_signal(signal_name):
				_failures.append("autoload GameState 缺少信号 %s" % signal_name)
		game_state.score_changed.connect(_on_score_changed)
		game_state.state_changed.connect(_on_state_changed)
		game_state.game_over.connect(_on_game_over)

	_player = get_tree().root.find_child("Player", true, false) as Player
	if _player == null:
		_failures.append("场景树找不到 Player（main.tscn 未实例化 player.tscn，或实例名不是 Player）")
	else:
		_player.moved.connect(_on_player_moved)
		_origin = _player.global_position

	_main = get_tree().root.find_child("Main", true, false) as MainGame
	if _main == null:
		_failures.append("场景树找不到 Main（tests/smoke.tscn 未实例化 main.tscn）")


func _physics_process(_delta: float) -> void:
	if _finished:
		return
	_frames += 1
	_phase_frame += 1

	if _failures.is_empty():
		match _phase:
			Phase.NOISE:
				_inject_noise_frame()
				if _phase_frame >= NOISE_FRAMES:
					_enter_phase(Phase.START)
			Phase.START:
				if _phase_frame == 1:
					_press_action(&"confirm")
				elif _phase_frame >= START_FRAMES:
					_assert_game_started()
					_enter_phase(Phase.MOVE)
			Phase.MOVE:
				if _phase_frame == 1:
					Input.action_press(&"move_right")
				elif _phase_frame >= MOVE_FRAMES:
					Input.action_release(&"move_right")
					_assert_player_moved()
					_enter_phase(Phase.CATCH)
			Phase.CATCH:
				if _phase_frame == 1:
					_spawn_catch_apple()
				elif _phase_frame >= CATCH_FRAMES:
					_assert_apple_caught()
					_enter_phase(Phase.MISS)
			Phase.MISS:
				if _phase_frame == 1:
					_spawn_miss_apple()
				elif _lives_before_miss - GameState.lives >= 1 \
						or GameState.state == GameState.State.GAME_OVER:
					_assert_apple_missed()
					_enter_phase(Phase.EXHAUST)
				elif _phase_frame >= MISS_FRAMES_MAX:
					_assert_apple_missed()
					_enter_phase(Phase.EXHAUST)
			Phase.EXHAUST:
				if _phase_frame == 1:
					_exhaust_lives()
				elif _phase_frame >= EXHAUST_FRAMES:
					_assert_game_over()
					_enter_phase(Phase.RESTART)
			Phase.RESTART:
				if _phase_frame == 1:
					_press_action(&"confirm")
				elif _phase_frame >= RESTART_FRAMES:
					_assert_restarted()
					_enter_phase(Phase.REPORT)
			Phase.REPORT:
				_finished = true
				_report()
				return

	if _frames >= TOTAL_FRAMES or not _failures.is_empty():
		_finished = true
		_report()


func _enter_phase(phase: Phase) -> void:
	_phase = phase
	_phase_frame = 0


## ── 噪声相位：确定种子随机事件（原始事件，不含 InputEventAction）──
var _noise_rng := RandomNumberGenerator.new()


func _inject_noise_frame() -> void:
	if _phase_frame == 1:
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


## 无显示设备时模拟「玩家按键」：注入真实 InputEvent，让 _unhandled_input 收得到。
## （Input.action_press 只改动作强度，不产生 InputEvent，触发不了 _unhandled_input。）
func _press_action(action: StringName) -> void:
	var event := InputEventAction.new()
	event.action = action
	event.pressed = true
	Input.parse_input_event(event)


## ── 相位动作 ──
func _spawn_catch_apple() -> void:
	_score_before_catch = GameState.score
	_score_seen = false  # 开局 start_game 已广播过一次得分；这里只认「接住」这一次
	# 直接把苹果生成在果篮中心：断言「重叠 → 接住 → 计分」这条真实交互链路。
	_main.spawn_apple(_player.global_position)


func _spawn_miss_apple() -> void:
	_lives_before_miss = GameState.lives
	_miss_apple = _main.spawn_apple(MISS_APPLE_POS)
	# 加速下落把等待压进帧预算；落点远离果篮 → 走漏接分支。
	_miss_apple.fall_speed = MISS_FALL_SPEED


func _exhaust_lives() -> void:
	# 胜负可达：把剩余生命扣完（与漏接共用同一条 miss_apple 计分路径）。
	while GameState.lives > 0:
		GameState.miss_apple()
	_score_at_game_over = GameState.score


## ── 断言 ──
func _assert_game_started() -> void:
	if GameState.state != GameState.State.PLAYING:
		_failures.append("开局入口不可用：注入 confirm 后 state 仍为 %s（应为 PLAYING）" % GameState.state)
	if not _state_playing_seen:
		_failures.append("信号 GameState.state_changed 未到达订阅方：开局状态切换没有广播")
	if _main.get_node("%StartPanel").visible:
		_failures.append("开始面板未隐藏：开局入口没有收起 StartPanel")
	# 关掉环境生成，让后续「接住 / 漏接」断言只受本测试注入的苹果影响。
	_main.spawn_timer.stop()


func _assert_player_moved() -> void:
	if _player == null:
		return
	if not _moved_seen:
		_failures.append("信号 Player.moved 未到达订阅方：连接断裂或果篮从未 emit")
	var travelled: float = _player.global_position.distance_to(_origin)
	if travelled < MIN_MOVE_DISTANCE:
		_failures.append(
			"果篮 %d 帧内位移 %.2fpx < %.2fpx：InputMap 动作未生效或 _physics_process 未驱动 velocity" % [
				MOVE_FRAMES, travelled, MIN_MOVE_DISTANCE,
			]
		)


func _assert_apple_caught() -> void:
	if not _score_seen:
		_failures.append("信号 GameState.score_changed 未到达订阅方：接住苹果没有广播得分")
	if GameState.score != _score_before_catch + 1:
		_failures.append("接住判定失效：得分 %d 应为 %d + 1（Area2D 重叠 → 计分链路断裂）" % [
			GameState.score, _score_before_catch,
		])
	# 难度递增（需求第 4 条）：得分上升后，下落速度变快、生成间隔变短。
	if GameState.apple_fall_speed() <= GameState.APPLE_FALL_SPEED:
		_failures.append("难度曲线失效：得分 %d 时下落速度 %.1f 未高于初值 %.1f" % [
			GameState.score, GameState.apple_fall_speed(), GameState.APPLE_FALL_SPEED,
		])
	if GameState.spawn_interval() >= GameState.SPAWN_INTERVAL:
		_failures.append("难度曲线失效：得分 %d 时生成间隔 %.3f 未短于初值 %.3f" % [
			GameState.score, GameState.spawn_interval(), GameState.SPAWN_INTERVAL,
		])


func _assert_apple_missed() -> void:
	if GameState.lives != _lives_before_miss - 1:
		_failures.append("漏接判定失效：生命 %d 应为 %d - 1（苹果越线未扣生命）" % [
			GameState.lives, _lives_before_miss,
		])


func _assert_game_over() -> void:
	if GameState.state != GameState.State.GAME_OVER:
		_failures.append("胜负判定不可达：生命耗尽后 state 仍为 %s（应为 GAME_OVER）" % GameState.state)
	if not _game_over_seen:
		_failures.append("信号 GameState.game_over 未到达订阅方：结算没有广播")
	if not _main.get_node("%GameOverPanel").visible:
		_failures.append("结算面板未显示：生命耗尽后 GameOverPanel 仍隐藏")
	if GameState.best < _score_at_game_over:
		_failures.append("最高分未更新：best %d < 本局得分 %d" % [GameState.best, _score_at_game_over])
	if not FileAccess.file_exists(GameState.SAVE_PATH):
		_failures.append("最高分未持久化：找不到 %s（页面刷新后最高分会丢）" % GameState.SAVE_PATH)


func _assert_restarted() -> void:
	if GameState.state != GameState.State.PLAYING:
		_failures.append("重开不可用：结算界面注入 confirm 后 state 仍为 %s（应为 PLAYING）" % GameState.state)
	if GameState.score != 0:
		_failures.append("重开未清零本局得分：score=%d（应为 0）" % GameState.score)
	if GameState.lives != GameState.START_LIVES:
		_failures.append("重开未重置生命：lives=%d（应为 %d）" % [GameState.lives, GameState.START_LIVES])
	if _main.get_node("%GameOverPanel").visible:
		_failures.append("重开后结算面板仍显示：GameOverPanel 未隐藏")
	if GameState.best < _score_at_game_over:
		_failures.append("重开后最高分丢失：best %d < 重开前 %d" % [GameState.best, _score_at_game_over])


## ── 报告 ──
func _report() -> void:
	if _finished and _phase != Phase.REPORT and _failures.is_empty():
		# 帧预算耗尽时还没跑完所有相位：如实上报，不许伪装 PASS。
		_failures.append("帧预算 %d 内未跑完断言相位（停在 %s）：加大 GODOT_SMOKE_FRAMES" % [TOTAL_FRAMES, _phase])
	if _failures.is_empty():
		print("GODOT_SMOKE: PASS 场景实例化/autoload/键位契约/移动/开局/接住/漏接/胜负/重开 全部通过")
		get_tree().quit(0)
	else:
		for failure in _failures:
			printerr("GODOT_SMOKE: FAIL %s" % failure)
		get_tree().quit(1)


## ── 键位契约断言：目标键表 → project.godot [input] 的 physical_keycode ──
func _check_key_bindings() -> void:
	for action: StringName in KEY_CONTRACT:
		if not InputMap.has_action(action):
			continue  # 动作缺失已由 REQUIRED_ACTIONS 断言上报，这里不重复计失败
		var expected: Array = KEY_CONTRACT[action]
		var bound: Array[Key] = []
		for event in InputMap.action_get_events(action):
			var key := event as InputEventKey
			if key != null and key.physical_keycode != KEY_NONE:
				bound.append(key.physical_keycode)
		if not _contains_all(expected, bound):
			_failures.append("键位契约：动作 %s 未绑全键表承诺的物理键（期望全部 %s，实际 %s）—— 缺的那个键真机按了没反应" % [
				action, _key_labels(expected), _key_labels(bound),
			])


## 逐一核对 expected 里每个键都已在 bound 中（AND 语义）。
func _contains_all(expected: Array, bound: Array[Key]) -> bool:
	for key in expected:
		if not (key in bound):
			return false
	return true


## 键码 → 可读键名（"D" / "Left" / "Space"），同时附键码数值：
## 未映射键名会被引擎打印成私有区字形（终端里是乱码），数值才能定位。
func _key_labels(keys: Array) -> String:
	var labels: PackedStringArray = []
	for code in keys:
		labels.append("%s(%d)" % [OS.get_keycode_string(code as Key), code])
	return "[%s]" % ", ".join(labels)


## ── 信号订阅回调 ──
func _on_player_moved(_position: Vector2) -> void:
	_moved_seen = true


func _on_score_changed(_score: int) -> void:
	_score_seen = true


func _on_state_changed(state: int) -> void:
	if state == GameState.State.PLAYING:
		_state_playing_seen = true


func _on_game_over(_score: int, _best: int) -> void:
	_game_over_seen = true
