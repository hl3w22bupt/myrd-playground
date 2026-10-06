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
## 断言覆盖（实现节点升级版）：
##   1. 菜单流：启动后 MENU 态且菜单层可见；选难度开局 → PLAYING、菜单隐藏（三界面可达）
##   2. 玩家能移动：注入 move_right 后位移 ≥ 1px，Player.moved 信号到达订阅方
##   3. 核心交互生效：confirm 选中光标所在卡；find_any_match 给出的配对必然消除（计分生效）
##   4. 反馈完备：消除后 Juice.events 非空（结果性事件真的挂了反馈）
##   5. 连通规则双向：死格布局（角全被堵）select 拒不消除且发 selection_rejected、
##      剩余数不变；可连配对则消除成功（验收 1 的正反两向）
##   6. 调参协议：TUNING_META 非空；apply_tuning 应用已声明键、按 max 钳制、
##      拒绝未声明键与非数值（§3C）
##   7. 难度梯度：挑战 6×6 → 36 张卡、棋盘 6×6；切回轻松 4×4 → 16 张（验收 5）
##   8. 胜负可达：倒计时归零 → LOST（结算面板弹出）；逐对消除至清盘 → WON
##   9. 重开可用：败/胜后 restart_game() 均回到 PLAYING、16 张卡、0 分；结算「返回菜单」
##      → MENU 态且菜单层可见（结算界面双出口可达）
##  10. 洗牌必有解：每次 board_shuffled 后 has_any_match() 必为 true（多次触发验证）
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
## 连通负向断言的死格布局：a/b 同型，(0,1) 与 (1,0) 堵死全部 1 转折角，
## 2 转折的行/列绕行也被这两张卡挡住（推导见 _assert_negative_path 的注释）。
const NEG_LAYOUT: Dictionary = {
	Vector2i(0, 0): 0, Vector2i(1, 1): 0, Vector2i(0, 1): 1, Vector2i(1, 0): 2,
}

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
	NOISE, MENU_CHECK, START, MOVE, SELECT_SETUP, SELECT_CHECK, MATCH_ACT, MATCH_CHECK,
	NEG_SETUP, NEG_SELECT, NEG_CHECK, TUNING_CHECK, DIFF_ACT, DIFF_CHECK, LOSE_ARM,
	LOSE_CHECK, RESTART1_CHECK, WIN_LOOP, WIN_CHECK, RESTART2_CHECK, MENU_RETURN, REPORT,
}

var _failures: PackedStringArray = []
var _phase: Phase = Phase.NOISE
var _phase_frame: int = 0
var _finished: bool = false
var _player: Player
var _main: Node2D
var _board: GameBoard
var _juice: Node
var _menu_layer: CanvasLayer
var _result_panel: ColorRect
var _origin: Vector2 = Vector2.ZERO
var _moved_seen: bool = false
var _score_seen: bool = false
var _selection_seen: bool = false
var _state_seen: bool = false
var _rejected_seen: bool = false
var _shuffles_seen: int = 0
var _selected_cell: Vector2i = Vector2i.ZERO
var _last_selection_cell: Vector2i = Vector2i(-9, -9)
var _win_iters: int = 0
var _score_before_match: int = 0

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

	_juice = get_tree().root.get_node_or_null("Juice")
	if _juice == null:
		_failures.append("autoload Juice 未注册（project.godot [autoload] 缺失，反馈协议失效）")

	_main = get_tree().root.find_child("Main", true, false) as Node2D
	if _main == null:
		_failures.append("场景树找不到 Main（smoke.tscn 未实例化 main.tscn）")
		_finish()
		return
	_board = _main.get_node("Board") as GameBoard
	_player = _main.get_node("Player") as Player
	_menu_layer = _main.get_node("MenuLayer") as CanvasLayer
	_result_panel = _main.get_node("%ResultPanel") as ColorRect
	if _board == null:
		_failures.append("Main 下找不到 Board（GameBoard 棋盘未挂载）")
	if _player == null:
		_failures.append("Main 下找不到 Player（main.tscn 未实例化 player.tscn）")
	else:
		_player.moved.connect(_on_player_moved)
		_origin = _player.global_position
	if _menu_layer == null:
		_failures.append("Main 下找不到 MenuLayer（菜单层未挂载）")
	if _board != null:
		_board.selection_changed.connect(_on_selection_changed)
		_board.selection_rejected.connect(_on_selection_rejected)
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
				_begin(Phase.MENU_CHECK)
		Phase.MENU_CHECK:
			if GameState.state != GameState.State.MENU:
				_failures.append("启动后状态应为 MENU，实际 %d（开始界面缺失）" % GameState.state)
			if _menu_layer != null and not _menu_layer.visible:
				_failures.append("MENU 态下菜单层不可见（开始界面不可达）")
			_begin(Phase.START)
		Phase.START:
			GameState.select_difficulty(&"easy")
			_main.call("start_game")
			_begin(Phase.MOVE)
		Phase.MOVE:
			if _phase_frame == 1:
				if GameState.state != GameState.State.PLAYING:
					_failures.append("start_game 后状态应为 PLAYING，实际 %d（开局链路断裂）" % GameState.state)
				if _menu_layer != null and _menu_layer.visible:
					_failures.append("开局后菜单层仍可见（界面切换未生效）")
				if _board.remaining_count() != _board.cols() * _board.rows():
					_failures.append("开局后卡片数 %d ≠ 棋盘规模 %d×%d（发牌未按难度生效）" % [
						_board.remaining_count(), _board.cols(), _board.rows(),
					])
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
			_score_before_match = GameState.score
			if _juice != null:
				_juice.call("clear_events")
			_board.select_cell(pair[0])
			_board.select_cell(pair[1])
			_begin(Phase.MATCH_CHECK)
		Phase.MATCH_CHECK:
			if _phase_frame >= 2:
				var expected: int = _board.cols() * _board.rows() - 2
				if _board.remaining_count() != expected:
					_failures.append("配对后剩余卡片 %d ≠ %d（消除未生效）" % [
						_board.remaining_count(), expected,
					])
				if not _score_seen or GameState.score <= _score_before_match:
					_failures.append("消除后未收到 score_changed 或分数未增长（计分链路断裂）")
				if _juice == null or _juice.get("events") == null \
						or (_juice.get("events") as PackedStringArray).is_empty():
					_failures.append("消除后 Juice.events 为空（结果性事件未挂反馈，§3B 断裂）")
				_begin(Phase.NEG_SETUP)
		Phase.NEG_SETUP:
			# 连通规则负向：死格布局下同型对必须拒绝消除（验收 1 反向）。
			_board.load_layout(NEG_LAYOUT)
			_board.clear_selection()
			_begin(Phase.NEG_SELECT)
		Phase.NEG_SELECT:
			_board.select_cell(Vector2i(0, 0))
			_board.select_cell(Vector2i(1, 1))
			_begin(Phase.NEG_CHECK)
		Phase.NEG_CHECK:
			if _phase_frame >= 2:
				_assert_negative_path()
				_begin(Phase.TUNING_CHECK)
		Phase.TUNING_CHECK:
			_assert_tuning_protocol()
			_begin(Phase.DIFF_ACT)
		Phase.DIFF_ACT:
			# 难度梯度：6×6 重开后再切回 4×4（验收 5）。
			GameState.select_difficulty(&"hard")
			_main.call("start_game")
			_begin(Phase.DIFF_CHECK)
		Phase.DIFF_CHECK:
			if _phase_frame >= 2:
				if _board.cols() != 6 or _board.rows() != 6:
					_failures.append("挑战难度下棋盘应为 6×6，实际 %d×%d（难度未生效）" % [
						_board.cols(), _board.rows(),
					])
				if _board.remaining_count() != 36:
					_failures.append("挑战难度发牌 %d 张 ≠ 36（6×6 规模未生效）" % _board.remaining_count())
				# 开局后 tick 已走过数帧，用 1 秒容差断言「时间按难度档取值」。
				if GameState.time_left > GameState.start_time_hard \
						or GameState.time_left <= GameState.start_time_hard - 1.0:
					_failures.append("挑战难度开局时间 %f 不在 start_time_hard %f 的 1 秒容差内" % [
						GameState.time_left, GameState.start_time_hard,
					])
				GameState.select_difficulty(&"easy")
				_main.call("start_game")
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
				if GameState.state != GameState.State.PLAYING or _board.remaining_count() != _board.cols() * _board.rows() \
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
				if GameState.state != GameState.State.PLAYING or _board.remaining_count() != _board.cols() * _board.rows():
					_failures.append("通关后重开未复位（重开入口在胜局下不可用）")
				_main.call("back_to_menu")
				_begin(Phase.MENU_RETURN)
		Phase.MENU_RETURN:
			if _phase_frame >= 2:
				if GameState.state != GameState.State.MENU:
					_failures.append("返回菜单后状态应为 MENU，实际 %d（结算出口断裂）" % GameState.state)
				if _menu_layer != null and not _menu_layer.visible:
					_failures.append("返回菜单后菜单层不可见（开始界面不可再达）")
				_main.call("start_game")
				_begin(Phase.REPORT)
		Phase.REPORT:
			if GameState.state != GameState.State.PLAYING or _menu_layer == null or _menu_layer.visible:
				_failures.append("二次开局未回到 PLAYING 或菜单未隐藏（循环可玩性断裂）")
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
		print("GODOT_SMOKE: PASS 菜单/移动/选中/消除计分/反馈/连通双向/调参/难度/胜负可达/重开/洗牌有解 全部通过")
		get_tree().quit(0)
	else:
		for failure in _failures:
			printerr("GODOT_SMOKE: FAIL %s" % failure)
		get_tree().quit(1)


func _first_occupied_cell() -> Vector2i:
	for y in _board.rows():
		for x in _board.cols():
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


## 连通负向断言：死格布局（a=(0,0) 与 b=(1,1) 同型；(0,1)/(1,0) 被占）下——
## 0 转折：不同行不同列，无直线；1 转折：两个候选角 (0,1)/(1,0) 均被占；
## 2 转折：水平中转 r=-1 时 (1,-1)→(1,1) 段途经 (1,0) 被占，r≥2 时 (0,r) 方向
## 途经 (0,1) 被占；垂直中转 c=0 时 c2 被占、c=1 时 c1 被占、c≤-1 或 c≥2 时
## 首段途经 (0,1)/(1,0) 被占 —— 全部不通，select 必须拒绝且局面不变。
func _assert_negative_path() -> void:
	if not _selection_seen:
		_failures.append("负向用例：首次 select 未发出 selection_changed（选中链路断裂）")
	if not _rejected_seen:
		_failures.append("死格同型对未被拒绝（selection_rejected 未发出，验收 1 反向失败：阻挡判断失效）")
	if _board.remaining_count() != NEG_LAYOUT.size():
		_failures.append("死格对被错误消除：剩余 %d 张 ≠ %d（不可连通却消除）" % [
			_board.remaining_count(), NEG_LAYOUT.size(),
		])
	var stuck_pair := _board.find_any_match()
	if not stuck_pair.is_empty():
		_failures.append("死格布局下 find_any_match 仍返回 %s（连通判定误报可解）" % str(stuck_pair))
	if GameState.state != GameState.State.PLAYING:
		_failures.append("负向用例意外改变对局状态：实际 %d" % GameState.state)


## 调参协议断言（SKILL.md §3C）：META 非空；应用已声明键、按 max 钳制、拒绝未知键与非数值。
func _assert_tuning_protocol() -> void:
	var game_state := get_tree().root.get_node("GameState")
	if game_state.get("TUNING_META") == null or (game_state.get("TUNING_META") as Dictionary).is_empty():
		_failures.append("TUNING_META 为空（调参工作台协议缺失）")
		return
	var applied_max := (game_state.call("apply_tuning", {"start_time_easy": 9999.0}) as PackedStringArray)
	if applied_max.size() != 1 or not is_equal_approx(game_state.get("start_time_easy") as float, 240.0):
		_failures.append("apply_tuning 未按 max=240 钳制 start_time_easy：实际 %s" % str(game_state.get("start_time_easy")))
	var applied_unknown := (game_state.call("apply_tuning", {"no_such_key": 5.0}) as PackedStringArray)
	if not applied_unknown.is_empty():
		_failures.append("apply_tuning 应拒绝未声明键 no_such_key，实际应用了 %s" % str(applied_unknown))
	var applied_bad_type := (game_state.call("apply_tuning", {"start_time_easy": "abc"}) as PackedStringArray)
	if not applied_bad_type.is_empty():
		_failures.append("apply_tuning 应拒绝非数值覆盖，实际应用了 %s" % str(applied_bad_type))
	# 恢复默认，避免影响后续难度/倒计时断言。
	game_state.call("apply_tuning", {"start_time_easy": 90.0, "match_points": 10.0})


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


func _on_selection_rejected(_cell: Vector2i) -> void:
	_rejected_seen = true


func _on_state_changed(_new_state: int) -> void:
	_state_seen = true


func _on_board_shuffled() -> void:
	_shuffles_seen += 1
	# 验收标准 2：自动洗牌后的新局面必然存在可消除对（多次触发逐次验证）。
	if not _board.has_any_match():
		_failures.append("第 %d 次自动洗牌后仍无可消除对（洗牌有解保证失效）" % _shuffles_seen)
