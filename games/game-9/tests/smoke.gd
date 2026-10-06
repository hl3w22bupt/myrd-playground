extends Node
## 无头冒烟自检（headless smoke）—— 机器可判定的「游戏能不能跑、玩得动、胜负可达、可重开」。
##
## 运行方式（由 scripts/smoke.sh 封装）：
##   godot --headless --path <工程目录> tests/smoke.tscn
##
## 判定协议（smoke.sh 按此断言退出码与日志）：
##   通过 → stdout 打印 `GODOT_SMOKE: PASS ...`，进程退出码 0
##   失败 → stderr 打印 `GODOT_SMOKE: FAIL <原因>`（每条一行），进程退出码 1
##
## 断言覆盖（scaffold 四项 + 洗牌有解）：
##   1. 玩家能移动：注入 move_right 后位移 ≥ 1px，Player.moved 信号到达订阅方
##   2. 核心交互生效：confirm 选中光标所在卡；find_any_match 给出的配对必然消除（计分 +10）
##   3. 胜负可达：倒计时归零 → LOST（结算面板弹出）；逐对消除至清盘 → WON
##   4. 重开可用：败/胜后 restart_game() 均回到 PLAYING、16 张卡、0 分
##   5. 洗牌必有解：每次 board_shuffled 后 has_any_match() 必为 true（多次触发验证）
##
## ⚠️ 输入注入分两个阶段、互不重叠（见 references/error-signatures.md E-08）：
##   headless 下 `Input.parse_input_event()` 的缓冲冲刷会清掉 `Input.action_press()`
##   设置的按下状态，两者同帧混用会让「移动断言」假失败。

## ── 噪声相位（输入鲁棒性门禁的逐游戏语义层）──
## 正式断言前注入一段确定种子的对抗输入：悬挂手势、孤儿释放、双指抢控、乱键。
const NOISE_FRAMES: int = 30
## 阶段一：按住 move_right 让玩家（光标）移动的帧数。
const MOVE_FRAMES: int = 10
## 判定「真的移动了」的最小位移（像素）。
const MIN_MOVE_DISTANCE: float = 1.0
## 胜局消除循环的最大配对次数（4x4 = 8 对，留余量）。
const MAX_WIN_ITERS: int = 12

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

enum Phase {
	NOISE, MOVE, SELECT_SETUP, SELECT_CHECK, MATCH_ACT, MATCH_CHECK,
	LOSE_ARM, LOSE_CHECK, RESTART1_CHECK, WIN_LOOP, WIN_CHECK, RESTART2_CHECK, REPORT,
}

var _failures: PackedStringArray = []
var _phase: Phase = Phase.NOISE
var _phase_frame: int = 0
var _finished: bool = false
var _player: Player
var _main: Node2D
var _board: GameBoard
var _result_panel: ColorRect
var _origin: Vector2 = Vector2.ZERO
var _moved_seen: bool = false
var _score_seen: bool = false
var _selection_seen: bool = false
var _state_seen: bool = false
var _shuffles_seen: int = 0
var _selected_cell: Vector2i = Vector2i.ZERO
var _last_selection_cell: Vector2i = Vector2i(-9, -9)
var _win_iters: int = 0

## 噪声相位：确定种子随机事件（原始事件，不含 InputEventAction）。
var _noise_rng := RandomNumberGenerator.new()


func _ready() -> void:
	# headless 无垂直同步：限 60 FPS 让 process 帧 : 物理帧 ≈ 1:1，--quit-after 兜底才有意义。
	Engine.max_fps = 60

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
		game_state.state_changed.connect(_on_state_changed)

	_main = get_tree().root.find_child("Main", true, false) as Node2D
	if _main == null:
		_failures.append("场景树找不到 Main（smoke.tscn 未实例化 main.tscn）")
		_finish()
		return
	_board = _main.get_node("Board") as GameBoard
	_player = _main.get_node("Player") as Player
	_result_panel = _main.get_node("%ResultPanel") as ColorRect
	if _board == null:
		_failures.append("Main 下找不到 Board（GameBoard 棋盘未挂载）")
	if _player == null:
		_failures.append("Main 下找不到 Player（main.tscn 未实例化 player.tscn）")
	else:
		_player.moved.connect(_on_player_moved)
		_origin = _player.global_position
	if _board != null:
		_board.selection_changed.connect(_on_selection_changed)
		_board.board_shuffled.connect(_on_board_shuffled)


func _physics_process(_delta: float) -> void:
	if _finished:
		return
	_frames_step()


func _frames_step() -> void:
	_phase_frame += 1
	if not _failures.is_empty():
		_finish()
		return
	match _phase:
		Phase.NOISE:
			_inject_noise_frame()
			if _phase_frame >= NOISE_FRAMES:
				_release_all_actions()
				_begin(Phase.MOVE)
		Phase.MOVE:
			if _phase_frame == 1:
				Input.action_press(&"move_right")
			if _phase_frame >= MOVE_FRAMES:
				Input.action_release(&"move_right")
				_assert_player_moved()
				_begin(Phase.SELECT_SETUP)
		Phase.SELECT_SETUP:
			# 噪声相位的随机点击/按键可能提前触发配对，先重发一局保证断言基线确定。
			_main.call("restart_game")
			# 光标传送到确定有卡片的格子，注入 confirm 后应精确选中该格。
			_selected_cell = _first_occupied_cell()
			if _selected_cell == GameBoard.NO_SELECTION:
				_failures.append("棋盘发牌后没有任何卡片（setup 未生效）")
				_finish()
				return
			_board.clear_selection()
			_last_selection_cell = Vector2i(-9, -9)
			_player.global_position = _board.world_from_cell(_selected_cell)
			_press_action(&"confirm")
			_begin(Phase.SELECT_CHECK)
		Phase.SELECT_CHECK:
			if _phase_frame >= 2:
				if _last_selection_cell != _selected_cell:
					_failures.append("confirm 注入后未精确选中光标所在格 %s（实际最后选中 %s）—— 选中链路断裂" % [
						_selected_cell, _last_selection_cell,
					])
				_board.clear_selection()
				_begin(Phase.MATCH_ACT)
		Phase.MATCH_ACT:
			var pair := _board.find_any_match()
			if pair.size() != 2:
				_failures.append("发牌后找不到任何可消除对（has_any_match 应为真）")
				_finish()
				return
			_board.select_cell(pair[0])
			_board.select_cell(pair[1])
			_begin(Phase.MATCH_CHECK)
		Phase.MATCH_CHECK:
			if _phase_frame >= 2:
				if _board.remaining_count() != GameBoard.COLS * GameBoard.ROWS - 2:
					_failures.append("配对后剩余卡片 %d ≠ %d（消除未生效）" % [
						_board.remaining_count(), GameBoard.COLS * GameBoard.ROWS - 2,
					])
				if not _score_seen:
					_failures.append("消除后未收到 GameState.score_changed（计分链路断裂）")
				_begin(Phase.LOSE_ARM)
		Phase.LOSE_ARM:
			GameState.time_left = 0.05
			_begin(Phase.LOSE_CHECK)
		Phase.LOSE_CHECK:
			if _phase_frame >= 8:
				if GameState.state != GameState.State.LOST:
					_failures.append("倒计时归零后状态应为 LOST，实际 %d（失败判定不可达）" % GameState.state)
				if _result_panel == null or not _result_panel.visible:
					_failures.append("失败后结算面板未弹出（胜负反馈缺失）")
				_begin(Phase.RESTART1_CHECK)
		Phase.RESTART1_CHECK:
			_main.call("restart_game")
			_begin(Phase.WIN_LOOP)
		Phase.WIN_LOOP:
			if _phase_frame == 1:
				if GameState.state != GameState.State.PLAYING or _board.remaining_count() != GameBoard.COLS * GameBoard.ROWS \
						or GameState.score != 0:
					_failures.append("重开后未复位：state=%d 剩余=%d 得分=%d（重开入口不可用）" % [
						GameState.state, _board.remaining_count(), GameState.score,
					])
					_finish()
					return
			_win_step()
		Phase.WIN_CHECK:
			if _phase_frame >= 2:
				if _board.remaining_count() != 0:
					_failures.append("全部配对后棋盘未清空（剩余 %d 张，通关不可达）" % _board.remaining_count())
				if GameState.state != GameState.State.WON:
					_failures.append("清盘后状态应为 WON，实际 %d（通关判定不可达）" % GameState.state)
				_begin(Phase.RESTART2_CHECK)
		Phase.RESTART2_CHECK:
			if _phase_frame == 1:
				_main.call("restart_game")
			if _phase_frame >= 2:
				if GameState.state != GameState.State.PLAYING or _board.remaining_count() != GameBoard.COLS * GameBoard.ROWS:
					_failures.append("通关后重开未复位（重开入口在胜局下不可用）")
				_begin(Phase.REPORT)
		Phase.REPORT:
			_finish()


## 胜局步进：每物理帧消一对，直到清盘或超次。
func _win_step() -> void:
	_win_iters += 1
	if _board.remaining_count() == 0:
		_begin(Phase.WIN_CHECK)
		return
	if _win_iters > MAX_WIN_ITERS:
		_failures.append("消除循环超出 %d 次仍未清盘（剩余 %d 张）" % [MAX_WIN_ITERS, _board.remaining_count()])
		_finish()
		return
	var pair := _board.find_any_match()
	if pair.size() != 2:
		_failures.append("胜局循环中出现无可消除对的死局（洗牌有解保证失效）")
		_finish()
		return
	_board.select_cell(pair[0])
	_board.select_cell(pair[1])


func _begin(next: Phase) -> void:
	_phase = next
	_phase_frame = 0


func _finish() -> void:
	_finished = true
	if _failures.is_empty():
		print("GODOT_SMOKE: PASS 移动/选中/消除计分/胜负可达/重开/洗牌有解 全部通过")
		get_tree().quit(0)
	else:
		for failure in _failures:
			printerr("GODOT_SMOKE: FAIL %s" % failure)
		get_tree().quit(1)


func _first_occupied_cell() -> Vector2i:
	for y in GameBoard.ROWS:
		for x in GameBoard.COLS:
			var cell := Vector2i(x, y)
			if _board.is_occupied(cell):
				return cell
	return GameBoard.NO_SELECTION


## 无显示设备时模拟「玩家按键」：注入真实 InputEvent，让 _unhandled_input 收得到。
func _press_action(action: StringName) -> void:
	var event := InputEventAction.new()
	event.action = action
	event.pressed = true
	Input.parse_input_event(event)


## 清掉所有可能残留的按下状态，防止噪声期悬挂按键把光标拖离传送点。
func _release_all_actions() -> void:
	for action in REQUIRED_ACTIONS:
		Input.action_release(action)


func _inject_noise_frame() -> void:
	if _phase_frame == 1 and _phase == Phase.NOISE:
		_noise_rng.seed = 20260913  # 门禁要求可复现：同种子同事件序
	var roll := _noise_rng.randf()
	var pos := Vector2(_noise_rng.randf_range(0, 540), _noise_rng.randf_range(0, 960))
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


## 键位契约断言：目标键表 → project.godot [input] 的 physical_keycode。
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
	if travelled < MIN_MOVE_DISTANCE:
		_failures.append("玩家 %d 帧内位移 %.2fpx < %.2fpx：InputMap 动作未生效或 _physics_process 未驱动 velocity" % [
			MOVE_FRAMES, travelled, MIN_MOVE_DISTANCE,
		])
	if not _moved_seen:
		_failures.append("信号 Player.moved 未到达订阅方：连接断裂或从未 emit")


func _on_player_moved(_position: Vector2) -> void:
	_moved_seen = true


func _on_score_changed(_score: int) -> void:
	_score_seen = true


func _on_selection_changed(cell: Vector2i) -> void:
	_selection_seen = true
	_last_selection_cell = cell


func _on_state_changed(_new_state: int) -> void:
	_state_seen = true


func _on_board_shuffled() -> void:
	_shuffles_seen += 1
	# 验收标准 2：自动洗牌后的新局面必然存在可消除对（多次触发逐次验证）。
	if not _board.has_any_match():
		_failures.append("第 %d 次自动洗牌后仍无可消除对（洗牌有解保证失效）" % _shuffles_seen)
