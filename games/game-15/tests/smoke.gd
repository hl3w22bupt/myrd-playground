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
## 覆盖面（模板五项 → 本玩法映射，对应需求验收标准机判化）：
##   1. 场景可实例化（main.tscn → Board → tile.tscn 接线未断裂，48 块图块就位）
##   2. autoload 已注册且带约定信号（GameState）
##   3. InputMap 动作注册 + 键位契约 + 注入输入后光标真的移动（「玩家能移动」：
##      连连看的可控对象是选择光标，位移断言落在 cursor_cell 上）
##   4. 核心交互生效：confirm 选中 → 同车种可连通对消除（计分/图鉴/进度信号）；
##      连通规则构造用例（0/1/2 拐点连通、3 拐点不通、被阻挡不通）；
##      生成器可解性（多种子整局贪心清空）；不同车种负例反馈
##   5. 胜负可达：贪心消除至清空 → game_won + 过关覆盖层；重开动作 → 整局复位
##
## ⚠️ 输入注入分两个阶段、互不重叠（见 references/error-signatures.md E-08）：
##   噪声相位只注入原始事件（Key/Mouse/Touch），断言相位注入 InputEventAction。

## ── 噪声相位（输入鲁棒性门禁的逐游戏语义层）──
const NOISE_FRAMES: int = 30
## 每次注入动作事件后等待派发的帧数。
const WAIT_FRAMES: int = 3
## 总帧数上限（超过即出报告；smoke.sh 另有 --quit-after 兜底）。
## 必须大于重开轮询的最坏窗口（注入点 ~48 tick + 120 tick 超时），否则兜底会先于超时把
## 「未验证完」误报成 PASS。
const TOTAL_FRAMES: int = 200

## 「无选中」哨兵格（与 board.gd 的 INVALID_CELL 同值）。
const INVALID := Vector2i(-1, -1)

const REQUIRED_ACTIONS: Array[StringName] = [
	&"move_left", &"move_right", &"move_up", &"move_down", &"confirm",
	&"hint", &"shuffle", &"restart",
]

## 键位契约：动作 → 键表承诺的物理键，必须全部绑定（与 project.godot [input] 对应）。
const KEY_CONTRACT: Dictionary = {
	&"move_left": [KEY_A, KEY_LEFT],
	&"move_right": [KEY_D, KEY_RIGHT],
	&"move_up": [KEY_W, KEY_UP],
	&"move_down": [KEY_S, KEY_DOWN],
	&"confirm": [KEY_SPACE, KEY_ENTER],
	&"hint": [KEY_H],
	&"shuffle": [KEY_G],
	&"restart": [KEY_R],
}

var _failures: PackedStringArray = []
var _frames: int = 0
var _finished: bool = false

var _board: Node2D
var _main: Node2D
var _win_layer: CanvasLayer

var _cursor_moved_seen: bool = false
var _selection_seen: bool = false
var _feedback_seen: bool = false
var _score_seen: bool = false
var _progress_seen: bool = false
var _collected_seen: bool = false
var _game_won_seen: bool = false

var _cursor_origin: Vector2i
## 重开条件轮询：-1 = 未在等待；≥0 = 已注入 restart、等待复位生效的 tick 计数。
var _restart_poll_ticks: int = -1


func _ready() -> void:
	# headless 无垂直同步：限到 60 FPS 让 --quit-after 的帧兜底有意义（模板同款）。
	Engine.max_fps = 60
	_check_static()
	_check_path_rules()
	if _board != null:
		_check_generator()


func _physics_process(_delta: float) -> void:
	if _finished:
		return
	_frames += 1
	if _failures.is_empty():
		if _frames <= NOISE_FRAMES:
			_inject_noise_frame()
		elif _frames == NOISE_FRAMES + 2:
			_begin_behavior_phase()
		elif _frames == NOISE_FRAMES + 2 + WAIT_FRAMES:
			_assert_cursor_moved()
			_stage_first_selection()
		elif _frames == NOISE_FRAMES + 2 + WAIT_FRAMES * 2:
			_assert_first_selection()
			_stage_second_selection()
		elif _frames == NOISE_FRAMES + 2 + WAIT_FRAMES * 3:
			_assert_pair_eliminated()
			_run_negative_case()
		elif _frames == NOISE_FRAMES + 2 + WAIT_FRAMES * 5:
			_run_win_phase()
		elif _frames == NOISE_FRAMES + 3 + WAIT_FRAMES * 5:
			_assert_win_phase()
			_press_action(&"restart")
			_restart_poll_ticks = 0
	# 重开断言用条件轮询而非固定帧距：注入事件按「迭代」派发（每次迭代 flush 一次），
	# 而胜负相位的大计算帧会触发物理帧追赶突发（一次迭代连跑多个 tick），
	# 固定帧距可能整个落在同一次迭代里（事件尚未派发）→ 偶发假失败。
	if _restart_poll_ticks >= 0 and _failures.is_empty():
		_restart_poll_ticks += 1
		if _board.remaining_tiles() == _board.W * _board.H and not GameState.won:
			_restart_poll_ticks = -1
			_assert_restart()
		elif _restart_poll_ticks > 120:
			_restart_poll_ticks = -1
			_failures.append("重开动作在 120 物理帧内未生效（restart 动作未接线或 new_game 未复位）")
	if _frames >= TOTAL_FRAMES or not _failures.is_empty():
		_finished = true
		_report()


## ── 静态与逻辑断言（_ready 内同步执行）─────────────────────

func _check_static() -> void:
	for action in REQUIRED_ACTIONS:
		if not InputMap.has_action(action):
			_failures.append("InputMap 缺少动作 %s（project.godot [input] 未注册）" % action)
	_check_key_bindings()
	var game_state := get_tree().root.get_node_or_null("GameState")
	if game_state == null:
		_failures.append("autoload GameState 未注册（project.godot [autoload] 缺失）")
	else:
		for signal_name in ["score_changed", "progress_changed", "collected_changed", "hints_changed", "game_won"]:
			if not game_state.has_signal(signal_name):
				_failures.append("autoload GameState 缺少信号 %s" % signal_name)
		game_state.score_changed.connect(_on_score_changed)
		game_state.progress_changed.connect(_on_progress_changed)
		game_state.collected_changed.connect(_on_collected_changed)
		game_state.game_won.connect(_on_game_won)
	_main = get_tree().root.find_child("Main", true, false) as Node2D
	if _main == null:
		_failures.append("场景树找不到 Main（tests/smoke.tscn 未实例化 main.tscn）")
	_board = get_tree().root.find_child("Board", true, false) as Node2D
	if _board == null:
		_failures.append("场景树找不到 Board（main.tscn 未挂 board.gd）")
		return
	if _board.get_script() == null:
		_failures.append("Board 节点未挂上脚本（board.gd 编译失败或场景接线断裂）——后续行为断言无意义")
		return
	_board.cursor_moved.connect(_on_cursor_moved)
	_board.selection_changed.connect(_on_selection_changed)
	_board.feedback.connect(_on_feedback)
	_win_layer = _main.get_node("%WinLayer") as CanvasLayer
	if _win_layer == null:
		_failures.append("Main 场景缺少 %WinLayer（过关覆盖层未接线）")
	if _board.tile_nodes.size() != _board.W * _board.H:
		_failures.append("开局图块数 %d ≠ %d（生成或重建图块接线断裂）" % [
			_board.tile_nodes.size(), _board.W * _board.H,
		])
	if _board.remaining_tiles() != _board.W * _board.H:
		_failures.append("开局棋盘存在空格（生成器未铺满）")


## 连通规则构造用例（需求验收标准 2 的机判化）。
func _check_path_rules() -> void:
	var w: int = 4
	var h: int = 4
	# 0 拐点：同一行直连（中间格为空）。
	var same_row := _board_from_string(w, h, [
		"0.0.",
		"....",
		"....",
		"....",
	])
	if BoardLogic.find_path(w, h, same_row, Vector2i(0, 0), Vector2i(2, 0)).is_empty():
		_failures.append("连通规则：同行无阻挡应 0 拐点连通，实测不通")
	# 1 拐点：直角路径，转角格为空。
	var one_turn := _board_from_string(w, h, [
		"0...",
		".0..",
		"....",
		"....",
	])
	if BoardLogic.find_path(w, h, one_turn, Vector2i(0, 0), Vector2i(1, 1)).is_empty():
		_failures.append("连通规则：1 拐点直角路径应连通，实测不通")
	# 2 拐点：双转角绕行。
	var two_turns := _board_from_string(w, h, [
		"00..",
		".0..",
		".0..",
		"....",
	])
	if BoardLogic.find_path(w, h, two_turns, Vector2i(0, 0), Vector2i(1, 2)).is_empty():
		_failures.append("连通规则：2 拐点双转角路径应连通，实测不通")
	# 阻挡后绕行：同行被 (1,0) 阻断，但经下方空行 2 拐点可达。
	var detour := _board_from_string(w, h, [
		"00.0",
		"....",
		"....",
		"....",
	])
	if BoardLogic.find_path(w, h, detour, Vector2i(0, 0), Vector2i(3, 0)).is_empty():
		_failures.append("连通规则：同行被阻但存在 2 拐点绕行路径应连通，实测不通（空格判定过严）")
	# 拐点与直连通道全被占：≤2 拐点不可达（判定不得过松）。
	var sealed := _board_from_string(w, h, [
		"00..",
		".0..",
		".10.",
		".1..",
	])
	if not BoardLogic.find_path(w, h, sealed, Vector2i(0, 0), Vector2i(2, 2)).is_empty():
		_failures.append("连通规则：通道全被占时应不可连通，实测连通（判定过松）")
	# 直角转角被占：1 拐点路径的两个候选转角格均为图块。
	var corner_blocked := _board_from_string(w, h, [
		"00..",
		"00..",
		"....",
		"....",
	])
	if not BoardLogic.find_path(w, h, corner_blocked, Vector2i(1, 0), Vector2i(0, 1)).is_empty():
		_failures.append("连通规则：转角格被占时应不可连通，实测连通（空格判定失效）")


## 生成器可解性：多种子生成的整局都能被贪心策略清空（保证存在可行解）。
func _check_generator() -> void:
	for seed_value in [1, 20260913, 987654321]:
		var rng := RandomNumberGenerator.new()
		rng.seed = seed_value
		var cells := BoardLogic.generate(_board.W, _board.H, _board.TYPE_COUNT, rng)
		if not BoardLogic.is_greedy_solvable(_board.W, _board.H, cells):
			_failures.append("生成器可解性：种子 %d 生成的棋盘无法贪心清空（不保证存在可行解）" % seed_value)


## ── 行为相位 ───────────────────────────────────────────────

func _begin_behavior_phase() -> void:
	_board.clear_selection()
	_cursor_origin = _board.cursor_cell
	if _cursor_origin.x < _board.W - 1:
		_press_action(&"move_right")
	else:
		_press_action(&"move_left")


func _assert_cursor_moved() -> void:
	var expected := _cursor_origin + Vector2i(1, 0)
	if _cursor_origin.x >= _board.W - 1:
		expected = _cursor_origin + Vector2i(-1, 0)
	if _board.cursor_cell != expected:
		_failures.append("光标未移动：期望 %s 实际 %s（move 动作未生效或光标逻辑断裂）" % [
			expected, _board.cursor_cell,
		])
	if not _cursor_moved_seen:
		_failures.append("信号 Board.cursor_moved 未到达订阅方：连接断裂或从未 emit")


## 经输入管线完成一次配对：confirm 选中 A（本帧）→ 断言 → confirm 选中 B → 消除。
## 注意：注入事件是延迟派发的，cursor_cell 的变更必须与事件派发逐帧对齐，
## 否则两次 confirm 都会落在同一个格上（选中→同格取消），配对必然失败。
func _stage_first_selection() -> void:
	var pair: Array = _board.find_hint_pair()
	if pair.is_empty():
		_failures.append("核心交互前置失败：满盘棋盘找不到任何可连通对（生成器缺陷）")
		_pair_a = INVALID
		return
	_board.clear_selection()
	_pair_a = pair[0]
	_pair_b = pair[1]
	_board.cursor_cell = _pair_a
	_press_action(&"confirm")


func _assert_first_selection() -> void:
	if _pair_a == INVALID:
		return
	if _board.selected_cell != _pair_a:
		_failures.append("confirm 未选中光标格：期望 %s 实际 %s（confirm→select 管线断裂）" % [
			_pair_a, _board.selected_cell,
		])
		return
	if not _selection_seen:
		_failures.append("信号 Board.selection_changed 未到达订阅方（选中未广播）")


func _stage_second_selection() -> void:
	if _pair_a == INVALID:
		return
	_board.cursor_cell = _pair_b
	_press_action(&"confirm")


var _pair_a: Vector2i = INVALID
var _pair_b: Vector2i = INVALID


func _assert_pair_eliminated() -> void:
	if _pair_a == INVALID:
		return
	var a: Vector2i = _pair_a
	var b: Vector2i = _pair_b
	if _board.cells[BoardLogic.cell_index(_board.W, a)] != BoardLogic.EMPTY \
			or _board.cells[BoardLogic.cell_index(_board.W, b)] != BoardLogic.EMPTY:
		_failures.append("核心交互失效：同车种可连通对 %s/%s 未被消除（confirm→select 管线或配对逻辑断裂）" % [a, b])
		return
	if GameState.score <= 0:
		_failures.append("消除后 GameState.score 未增加（register_match 未生效）")
	if not _score_seen:
		_failures.append("信号 GameState.score_changed 未到达订阅方")
	if not _progress_seen:
		_failures.append("信号 GameState.progress_changed 未到达订阅方")
	if not _collected_seen:
		_failures.append("信号 GameState.collected_changed 未到达订阅方（图鉴未记账）")
	if GameState.collected.is_empty():
		_failures.append("图鉴为空：消除后车种未计入图鉴")
	if not _selection_seen:
		_failures.append("信号 Board.selection_changed 未到达订阅方（confirm 未走选中管线）")


## 负例：不同车种不可消除，且给出可感知反馈。
func _run_negative_case() -> void:
	var cells := _diff_type_pair()
	if cells.size() < 2:
		return
	var before_a: int = _board.cells[BoardLogic.cell_index(_board.W, cells[0])]
	var before_b: int = _board.cells[BoardLogic.cell_index(_board.W, cells[1])]
	_board.select_cell(cells[0])
	_board.select_cell(cells[1])
	var after_a: int = _board.cells[BoardLogic.cell_index(_board.W, cells[0])]
	var after_b: int = _board.cells[BoardLogic.cell_index(_board.W, cells[1])]
	if after_a != before_a or after_b != before_b:
		_failures.append("负例失效：不同车种图块被消除（配对未校验车种）")
	if not _feedback_seen:
		_failures.append("不可消除时未给出可感知反馈（Board.feedback 未 emit）")


## 找一对不同车种的已占格。
func _diff_type_pair() -> Array:
	var occupied: Array = []
	for idx in _board.cells.size():
		if _board.cells[idx] != BoardLogic.EMPTY:
			occupied.append(Vector2i(idx % _board.W, idx / _board.W))
	for i in occupied.size():
		for j in range(i + 1, occupied.size()):
			if _board.cells[BoardLogic.cell_index(_board.W, occupied[i])] \
					!= _board.cells[BoardLogic.cell_index(_board.W, occupied[j])]:
				return [occupied[i], occupied[j]]
	return []


## 胜负可达：贪心消除整局直到清空。
func _run_win_phase() -> void:
	_board.clear_selection() # 清掉负例残留的选中态，避免下一对被当成「换选」。
	var guard: int = 0
	while _board.remaining_tiles() > 0 and guard < _board.W * _board.H:
		guard += 1
		var pair: Array = _board.find_hint_pair()
		if pair.is_empty():
			_failures.append("胜负不可达：棋盘未清空且无可连对（死局未自动洗牌或生成器不可解）")
			return
		_board.select_cell(pair[0])
		_board.select_cell(pair[1])


func _assert_win_phase() -> void:
	if _board.remaining_tiles() != 0:
		_failures.append("胜负判定：棋盘未清空（剩余 %d 块）" % _board.remaining_tiles())
		return
	if not GameState.won:
		_failures.append("胜负判定：棋盘清空后 GameState.won 仍为 false")
	if not _game_won_seen:
		_failures.append("信号 GameState.game_won 未到达订阅方")
	if not GameState.collection_complete():
		_failures.append("图鉴判定：过关时图鉴未收齐（%d/%d）" % [GameState.collected.size(), GameState.total_types])
	if not _win_layer.visible:
		_failures.append("过关覆盖层未显示（main 未订阅 game_won）")


func _assert_restart() -> void:
	if _board.remaining_tiles() != _board.W * _board.H:
		_failures.append("重开失效：棋盘未复位（剩余 %d 块）" % _board.remaining_tiles())
	if GameState.score != 0:
		_failures.append("重开失效：分数未清零（%d）" % GameState.score)
	if GameState.won:
		_failures.append("重开失效：won 标记未复位")
	if GameState.hints_left != GameState.TOTAL_HINTS:
		_failures.append("重开失效：提示次数未复位（%d）" % GameState.hints_left)
	if _win_layer.visible:
		_failures.append("重开失效：过关覆盖层仍显示")


## ── 基建（模板同款：噪声注入 / 动作注入 / 键位契约 / 报告）────

var _noise_rng := RandomNumberGenerator.new()


func _inject_noise_frame() -> void:
	if _frames == 1:
		_noise_rng.seed = 20260913
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
		print("GODOT_SMOKE: PASS 场景实例化/autoload/键位契约/光标移动/配对消除/连通规则/可解生成/胜负/重开 全部通过")
		get_tree().quit(0)
	else:
		for failure in _failures:
			printerr("GODOT_SMOKE: FAIL %s" % failure)
		get_tree().quit(1)


func _on_cursor_moved(_cell: Vector2i) -> void:
	_cursor_moved_seen = true


func _on_selection_changed(_cell: Vector2i) -> void:
	_selection_seen = true


func _on_feedback(_text: String) -> void:
	_feedback_seen = true


func _on_score_changed(_score: int) -> void:
	_score_seen = true


func _on_progress_changed(_remaining: int, _total: int) -> void:
	_progress_seen = true


func _on_collected_changed(_type_id: int, _count: int, _total: int) -> void:
	_collected_seen = true


func _on_game_won() -> void:
	_game_won_seen = true


## 构造用例板：字符串行 → PackedInt32Array（'.' = 空，数字 = 车种编号）。
func _board_from_string(w: int, h: int, rows: Array[String]) -> PackedInt32Array:
	var cells := PackedInt32Array()
	cells.resize(w * h)
	cells.fill(BoardLogic.EMPTY)
	for y in h:
		var row: String = rows[y]
		for x in w:
			var ch := row.substr(x, 1)
			if ch != ".":
				cells[y * w + x] = int(ch)
	return cells
