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
## 覆盖面（对应 SKILL.md「冒烟场景必须断言什么」五项 + 本玩法验收）：
##   1. 主场景可实例化（main.tscn → Board → Cursor 接线未断裂）
##   2. autoload 已注册且带约定信号（moves_changed / level_changed / level_solved）
##   3. InputMap 动作已注册、物理键绑定正确（键位契约逐键核对），
##      且注入 move 动作后光标真的移动（物理 + 脚本生效）
##   4. 信号真的到达订阅方（Cursor.moved / GameState.level_solved）
##   5. 核心交互生效：confirm 旋转光标所在管 → 光路接通 → 通关星级 = 3（第 1 关 par=1）
##   6. 胜负可达：第一关按最优解 1 步通关；关卡契约机判 3 关全部「target 朝向必可解」
##   7. 重开可用：reset 动作归零步数/朝向/通关态，可再次通关
##
## ⚠️ 输入注入分两个通道、互不重叠（references/error-signatures.md E-08）：
##   移动断言用 Input.action_press（强度通道，Input.get_vector 读取），
##   旋转/重开断言用 Input.parse_input_event（事件通道，_unhandled_input 接收），
##   两者分帧执行，避免缓冲冲刷清掉按下状态。
##
## ⚠️ 噪声相位会真实触发旋转（随机点击/乱键可能提前打通第 1 关）：
##   噪声结束后先 GameState.reset_level() 归零开局，再开始正式断言。

## ── 噪声相位（输入鲁棒性门禁的逐游戏语义层）──
## 正式断言前注入一段确定种子的对抗输入：悬挂手势、孤儿释放、双指抢控、乱键、乱点。
const NOISE_FRAMES: int = 30

## 帧时刻表（状态机锚点；smoke.sh 另有 --quit-after 240 兜底）。
const RESET_FRAME: int = NOISE_FRAMES + 1            # 31：清噪声污染，干净开局
const PRESS_UP_FRAME: int = NOISE_FRAMES + 2         # 32：开始移动断言（向上）
const UP_ASSERT_FRAME: int = PRESS_UP_FRAME + 10     # 42：断言上移一格，掉头向下
const DOWN_ASSERT_FRAME: int = UP_ASSERT_FRAME + 11  # 53：断言回到起点
const ROTATE_FRAME: int = DOWN_ASSERT_FRAME + 1      # 54：confirm 旋转（1 步最优解）
const SOLVED_ASSERT_FRAME: int = ROTATE_FRAME + 4    # 58：断言通关 + 3 星
const RESET_ACTION_FRAME: int = SOLVED_ASSERT_FRAME + 1  # 59：reset 动作重开
const REOPEN_ASSERT_FRAME: int = RESET_ACTION_FRAME + 4  # 63：断言重开归零
const REPLAY_FRAME: int = REOPEN_ASSERT_FRAME + 1    # 64：再次 confirm 旋转
const TOTAL_FRAMES: int = REPLAY_FRAME + 4           # 68：断言再次通关 → 报告

## 判定「真的移动了」的格子步数（1 格）。
const MIN_MOVE_CELL: int = 1

const REQUIRED_ACTIONS: Array[StringName] = [
	&"move_left", &"move_right", &"move_up", &"move_down", &"confirm", &"reset",
]

## 键位契约：动作 → 键表承诺的物理键，**必须全部绑定**（与 project.godot [input] 对应）。
## 逐键核对（AND）：文档键表写「W / ↑」就是承诺两个键都能用。
const KEY_CONTRACT: Dictionary = {
	&"move_left": [KEY_A, KEY_LEFT],
	&"move_right": [KEY_D, KEY_RIGHT],
	&"move_up": [KEY_W, KEY_UP],
	&"move_down": [KEY_S, KEY_DOWN],
	&"confirm": [KEY_SPACE, KEY_ENTER],
	&"reset": [KEY_R],
}

var _failures: PackedStringArray = []
var _frames: int = 0
var _finished: bool = false
var _main: Node2D
var _board: BoardView
var _cursor: Cursor
var _cursor_origin: Vector2i = Vector2i(-1, -1)
var _moved_seen: bool = false
var _solved_seen: bool = false
var _solved_stars: int = 0


func _ready() -> void:
	# headless 没有垂直同步，限 60 FPS 让 process 帧 : 物理帧 ≈ 1:1，--quit-after 兜底才有意义。
	Engine.max_fps = 60
	_static_assertions()
	_level_contract_assertions()


## 静态接线断言：场景树 / autoload / InputMap / 键位契约。
func _static_assertions() -> void:
	for action in REQUIRED_ACTIONS:
		if not InputMap.has_action(action):
			_failures.append("InputMap 缺少动作 %s（project.godot [input] 未注册）" % action)
	_check_key_bindings()

	var game_state := get_tree().root.get_node_or_null("GameState")
	if game_state == null:
		_failures.append("autoload GameState 未注册（project.godot [autoload] 缺失）")
	else:
		for signal_name in ["moves_changed", "level_changed", "level_solved"]:
			if not game_state.has_signal(signal_name):
				_failures.append("autoload GameState 缺少信号 %s" % signal_name)
		game_state.level_solved.connect(_on_level_solved)

	_main = get_tree().root.find_child("Main", true, false) as Node2D
	if _main == null:
		_failures.append("场景树找不到 Main（smoke.tscn 未实例化 main.tscn）")
		return
	_board = _main.get_node_or_null("Board") as BoardView
	if _board == null:
		_failures.append("Main 下找不到 Board（main.tscn 未挂 board_view.gd）")
		return
	_cursor = _board.get_node_or_null("Cursor") as Cursor
	if _cursor == null:
		_failures.append("Board 下找不到 Cursor（main.tscn 未挂 cursor.gd）")
	elif not _cursor.moved.is_connected(_on_cursor_moved):
		_cursor.moved.connect(_on_cursor_moved)


## 关卡契约断言（纯逻辑，不依赖帧循环）：
## 每关「全部管子转到 target_rot 必可解」「初始朝向必未通关」「par 与朝向数据一致」。
func _level_contract_assertions() -> void:
	for index: int in range(LevelSet.count()):
		var level: Dictionary = LevelSet.level_at(index)
		var cells_solved: Dictionary = LevelSet.build_cells(level, true)
		var result_solved: Dictionary = PuzzleLogic.propagate(
			cells_solved, level["source_cell"], level["source_dir"], level["sink_open"])
		if not result_solved["solved"]:
			_failures.append("关卡契约：第 %d 关全部管子转到 target_rot 后光路未接通（关卡无解）" % [index + 1])
		var cells_initial: Dictionary = LevelSet.build_cells(level, false)
		var result_initial: Dictionary = PuzzleLogic.propagate(
			cells_initial, level["source_cell"], level["source_dir"], level["sink_open"])
		if result_initial["solved"]:
			_failures.append("关卡契约：第 %d 关初始朝向已通关（初始状态设计错误）" % [index + 1])
		var par: int = LevelSet.par_of(level)
		if par <= 0:
			_failures.append("关卡契约：第 %d 关最优解步数 par=%d 非正（数据漂移）" % [index + 1, par])
		if index == 0 and par != 1:
			_failures.append("关卡契约：第 1 关 par=%d，冒烟依赖「1 步最优解」断言 3 星" % par)


func _physics_process(_delta: float) -> void:
	if _finished:
		return
	_frames += 1

	if _failures.is_empty():
		if _frames <= NOISE_FRAMES:
			_inject_noise_frame()
		elif _frames == RESET_FRAME:
			_clean_start()
		elif _frames == PRESS_UP_FRAME:
			_cursor_origin = _cursor.grid_pos
			Input.action_press(&"move_up")
		elif _frames == UP_ASSERT_FRAME:
			Input.action_release(&"move_up")
			_assert_cursor_moved(Vector2i(0, -MIN_MOVE_CELL))
			Input.action_press(&"move_down")
		elif _frames == DOWN_ASSERT_FRAME:
			Input.action_release(&"move_down")
			_assert_cursor_moved(Vector2i.ZERO)
		elif _frames == ROTATE_FRAME:
			_press_action(&"confirm")
		elif _frames == SOLVED_ASSERT_FRAME:
			_assert_solved()
		elif _frames == RESET_ACTION_FRAME:
			_press_action(&"reset")
		elif _frames == REOPEN_ASSERT_FRAME:
			_assert_reopened()
		elif _frames == REPLAY_FRAME:
			_press_action(&"confirm")
		elif _frames == TOTAL_FRAMES:
			_assert_replay()

	if _frames >= TOTAL_FRAMES or not _failures.is_empty():
		_finished = true
		_report()


## 清掉噪声相位对开局的污染：重置第 1 关，并断言干净开局状态。
func _clean_start() -> void:
	_moved_seen = false
	_solved_seen = false
	GameState.reset_level()
	if GameState.moves != 0:
		_failures.append("开局断言：reset 后步数 %d != 0" % GameState.moves)
	if GameState.solved:
		_failures.append("开局断言：reset 后 solved 仍为 true")
	if _board.rots.get(_board.level["pipes"][0]["cell"], -1) != _board.level["pipes"][0]["init_rot"]:
		_failures.append("开局断言：第 1 关管子朝向未回到 init_rot（重开未复位棋盘）")
	if _board.beam.get("solved", true):
		_failures.append("开局断言：初始光路已接通（开局即通关）")


## 移动断言：光标相对 origin 精确移动 expected_offset 格。
func _assert_cursor_moved(expected_offset: Vector2i) -> void:
	if _cursor == null:
		return
	var actual: Vector2i = _cursor.grid_pos - _cursor_origin
	if actual != expected_offset:
		_failures.append("移动断言：光标位移 %s != 期望 %s（InputMap 动作未生效或 _physics_process 未驱动光标）" % [
			actual, expected_offset,
		])


## 通关断言：1 步最优解 → 3 星，信号到达订阅方，光束确实接通。
func _assert_solved() -> void:
	if not _moved_seen:
		_failures.append("信号 Cursor.moved 未到达订阅方：连接断裂或从未 emit")
	if not _solved_seen:
		_failures.append("信号 GameState.level_solved 未到达订阅方：confirm 旋转后光路未接通（核心交互失效）")
		return
	if _solved_stars != 3:
		_failures.append("星级断言：第 1 关以最优解 %d 步通关应得 3 星，实际 %d 星（stars_for 规则错误）" % [
			GameState.moves, _solved_stars,
		])
	if not _board.beam.get("solved", false):
		_failures.append("光束断言：通关后 board.beam.solved 仍为 false（视图层光束预览未更新）")


## 重开断言：reset 动作后步数/朝向/通关态全部归零。
func _assert_reopened() -> void:
	if GameState.moves != 0:
		_failures.append("重开断言：reset 动作后步数 %d != 0" % GameState.moves)
	if GameState.solved:
		_failures.append("重开断言：reset 动作后 solved 仍为 true")
	if _board.rots.get(_board.level["pipes"][0]["cell"], -1) != _board.level["pipes"][0]["init_rot"]:
		_failures.append("重开断言：reset 动作后管子朝向未复位")


## 复玩断言：重开后再次 confirm 可再次通关（重开入口真实可用）。
func _assert_replay() -> void:
	if not GameState.solved:
		_failures.append("复玩断言：重开后再旋转未能通关（重开入口不可用或旋转失效）")


func _report() -> void:
	if _failures.is_empty():
		print("GODOT_SMOKE: PASS 场景实例化/autoload/键位契约/光标移动/旋转交互/通关星级/重开复玩 全部通过")
		get_tree().quit(0)
	else:
		for failure in _failures:
			printerr("GODOT_SMOKE: FAIL %s" % failure)
		get_tree().quit(1)


func _on_level_solved(stars: int, _moves: int, _par: int) -> void:
	_solved_seen = true
	_solved_stars = stars


func _on_cursor_moved(_grid_pos: Vector2i) -> void:
	_moved_seen = true


## 噪声相位：确定种子随机事件（原始事件，不含 InputEventAction）。
var _noise_rng := RandomNumberGenerator.new()


func _inject_noise_frame() -> void:
	if _frames == 1:
		_noise_rng.seed = 20260926  # 门禁要求可复现：同种子同事件序
	var roll := _noise_rng.randf()
	var pos := Vector2(_noise_rng.randf_range(0, 1280), _noise_rng.randf_range(0, 720))
	if roll < 0.25:
		# 悬挂手势：按下不抬起
		var t := InputEventScreenTouch.new()
		t.index = _noise_rng.randi_range(0, 1)
		t.position = pos
		t.pressed = true
		Input.parse_input_event(t)
	elif roll < 0.40:
		# 孤儿释放：抬起无按下
		var t2 := InputEventScreenTouch.new()
		t2.index = _noise_rng.randi_range(0, 1)
		t2.position = pos
		t2.pressed = false
		Input.parse_input_event(t2)
	elif roll < 0.55:
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
		k.physical_keycode = [KEY_A, KEY_D, KEY_W, KEY_S, KEY_SPACE, KEY_R][_noise_rng.randi_range(0, 5)]
		k.pressed = _noise_rng.randf() < 0.5
		Input.parse_input_event(k)


## 无显示设备时模拟「玩家按键」：注入真实 InputEvent，让 _unhandled_input 收得到。
## （Input.action_press 只改动作强度，不产生 InputEvent，触发不了 _unhandled_input。）
func _press_action(action: StringName) -> void:
	var event := InputEventAction.new()
	event.action = action
	event.pressed = true
	Input.parse_input_event(event)


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
