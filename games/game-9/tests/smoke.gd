extends Node
## 无头冒烟自检（headless smoke）—— game-9《推箱子点亮方块解谜》机器判定层。
##
## 运行方式（由 std-skills/godot-game-dev/scripts/smoke.sh 封装）：
##   godot --headless --path <工程目录> tests/smoke.tscn
##
## 判定协议（smoke.sh 按此断言退出码与日志）：
##   通过 → stdout 打印 `GODOT_SMOKE: PASS ...`，进程退出码 0
##   失败 → stderr 打印 `GODOT_SMOKE: FAIL <原因>`（每条一行），进程退出码 1
##
## 覆盖面（模板五项 + 本玩法验收口径 AC1–AC5，逐条可无头判定）：
##   1. 场景可实例化（main.tscn → player.tscn / BoardView 接线未断裂）
##   2. autoload GameState 已注册且带约定信号；关卡数 ≥ 5（AC4）
##   3. InputMap 动作已注册、物理键绑定逐键核对（键位契约），且注入输入后角色真的动了
##   4. 信号真的到达订阅方（Player.moved / GameState.steps·lit·won·deadlock）
##   5. AC1 推动规则：推动双方各进 1 格；顶墙 / 顶方块无效且角色不位移；不可拉动
##   6. AC2 点亮与通关：方块入槽同帧点亮且保持常亮；全部点亮即 won，
##      通关弹层在 ≤1000ms（设计值 300ms）内出现，且结算展示步数与评级
##   7. AC3 撤销与重开：Undo 精确回退一步（角色/方块/点亮/步数同步还原），
##      Restart 完整恢复初始布局；通关后 confirm 进入下一关
##   8. AC4 关卡可解性（引擎内机判）：逐关回放 sokoban_levels.gd 落盘的见证解
##      （tools/level_solver.py --paths 生成），每关必须通关、步数 == par、
##      回放全程不得误报死锁
##   9. 死锁判定（失败反馈）：角死锁必报、在槽角不报、开阔局面不报；
##      真实关卡里把方块顶进角后 deadlock_changed 通知 UI，Undo 可脱离死锁态
##  10. AC5 响应延迟：移动输入 → 步数/HUD 刷新 ≤ 12 帧（200ms，spec.numeric.perf）
##  11. 触屏滑动：越过 24px 阈值的一次滑动恰好步进 1 格（touchSwipeThresholdPx）
##
## ⚠️ 输入注入分阶段、互不重叠（error-signatures E-08）：
##   headless 下 `Input.parse_input_event()` 的缓冲冲刷会清掉 `Input.action_press()`
##   的按下状态，同帧混用会让「移动断言」假失败。

## ── 阶段划分 ──
const PHASE_NOISE: int = 0
const PHASE_MOVE: int = 1
const PHASE_SWIPE: int = 2
const PHASE_LOGIC: int = 3
const PHASE_WIN_WAIT: int = 4
const PHASE_NEXT: int = 5
const PHASE_DONE: int = 6

## 噪声相位帧数：正式断言前注入确定种子的对抗输入（悬挂手势 / 孤儿释放 / 乱键）。
const NOISE_FRAMES: int = 30
## 阶段一：按住 move_right 让角色步进的帧数。
const MOVE_FRAMES: int = 12
## AC5 响应预算：spec.numeric.perf.maxInputResponseMs = 200ms ≈ 60FPS 下 12 帧。
const RESPONSE_BUDGET_FRAMES: int = 12
## 阶段二：触屏滑动断言的相位帧数（注入 press → 第 2 帧注入 drag → 等待释放与步进）。
const SWIPE_FRAMES: int = 12
## 滑动注入的触点下标：避开噪声相位使用的 0/1，防止互相回收触点。
const SWIPE_TOUCH_INDEX: int = 7
## 滑动起点：屏幕中上（远离左下摇杆热区 24..160 × 400..536 与右下按钮排）。
const SWIPE_START: Vector2 = Vector2(500.0, 280.0)
## 滑动位移（像素）：> spec.numeric.input.touchSwipeThresholdPx = 24。
const SWIPE_DRAG_PX: float = 48.0
## 通关弹层出现预算：300ms 设计值 + 余量，门禁口径 ≤1000ms ≈ 60 帧。
const WIN_WAIT_FRAMES: int = 60
## 注入 confirm 后等待「进入下一关」生效的帧数。
const NEXT_FRAMES: int = 6
## 判定「真的动了」的最小位移（像素）。
const MIN_MOVE_DISTANCE: float = 1.0

const REQUIRED_ACTIONS: Array[StringName] = [
	&"move_left", &"move_right", &"move_up", &"move_down", &"confirm",
	&"undo", &"restart", &"next_level", &"prev_level",
]

## 键位契约：动作 → 键表承诺的物理键，**必须全部绑定**（与 project.godot [input] 对应）。
## 逐键核对（AND）而非「绑了其中一个就算过」：文档写「Z / 退格」就是承诺两个键都能用。
const KEY_CONTRACT: Dictionary = {
	&"move_left": [KEY_A, KEY_LEFT],
	&"move_right": [KEY_D, KEY_RIGHT],
	&"move_up": [KEY_W, KEY_UP],
	&"move_down": [KEY_S, KEY_DOWN],
	&"confirm": [KEY_SPACE, KEY_ENTER],
	&"undo": [KEY_Z, KEY_BACKSPACE],
	&"restart": [KEY_R],
	&"next_level": [KEY_N],
	&"prev_level": [KEY_P],
}

var _failures: PackedStringArray = []
var _frames: int = 0
var _phase: int = PHASE_NOISE
var _phase_deadline: int = NOISE_FRAMES
var _finished: bool = false

var _main: Node2D
var _player: Player
var _win_overlay: CanvasLayer
var _touch_ui: CanvasLayer
var _hud_label: Label
var _win_label: Label
var _origin_cell: Vector2i = Vector2i.ZERO
var _origin_position: Vector2 = Vector2.ZERO
var _target_level_index: int = 0
## AC5：动作注入帧 → 首次步进帧（二者差 = 响应延迟帧数）。
var _press_frame: int = -1
var _first_step_frame: int = -1
## 滑动相位计数与起点格。
var _swipe_frame: int = 0
var _swipe_origin_cell: Vector2i = Vector2i.ZERO

var _moved_seen: bool = false
var _steps_seen: bool = false
var _lit_seen: bool = false
var _won_seen: bool = false
var _deadlock_seen: bool = false
var _noise_rng := RandomNumberGenerator.new()


func _ready() -> void:
	# headless 无垂直同步：限到 60 FPS 让 process 帧 : 物理帧 ≈ 1:1，
	# --quit-after 的兜底才有意义（模板 tests/smoke.gd 同款）。
	Engine.max_fps = 60

	for action in REQUIRED_ACTIONS:
		if not InputMap.has_action(action):
			_failures.append("InputMap 缺少动作 %s（project.godot [input] 未注册）" % action)
	_check_key_bindings()

	var game_state := get_tree().root.get_node_or_null("GameState")
	if game_state == null:
		_failures.append("autoload GameState 未注册（project.godot [autoload] 缺失）")
	else:
		for signal_name in ["level_loaded", "board_changed", "steps_changed", "lit_changed", "level_won", "deadlock_changed"]:
			if not game_state.has_signal(signal_name):
				_failures.append("autoload GameState 缺少信号 %s" % signal_name)
		if game_state.level_count() < 5:
			_failures.append("内置关卡数 %d < 5（需求要求至少 5 关，AC4）" % game_state.level_count())
		game_state.steps_changed.connect(_on_steps_changed)
		game_state.lit_changed.connect(_on_lit_changed)
		game_state.level_won.connect(_on_level_won)
		game_state.deadlock_changed.connect(_on_deadlock_changed)

	_main = get_tree().root.find_child("Main", true, false) as Node2D
	if _main == null:
		_failures.append("场景树找不到 Main（main.tscn 未被冒烟场景实例化，或实例名不是 Main）")
		_finish()
		return
	_player = _main.get_node_or_null("Player") as Player
	if _player == null:
		_failures.append("Main 下找不到 Player（main.tscn 未实例化 player.tscn，或实例名不是 Player）")
	_win_overlay = _main.get_node_or_null("%WinOverlay") as CanvasLayer
	if _win_overlay == null:
		_failures.append("Main 缺少 %%WinOverlay（通关弹层未在 main.tscn 里声明或未设 unique_name_in_owner）")
	_win_label = _main.get_node_or_null("%WinLabel") as Label
	if _win_label == null:
		_failures.append("Main 缺少 %%WinLabel（结算文本节点缺失，无法断言步数与评级展示）")
	_hud_label = _main.get_node_or_null("%HudLabel") as Label
	if _hud_label == null:
		_failures.append("Main 缺少 %%HudLabel（HUD 文本节点缺失，无法断言步数 / par / 失败反馈展示）")
	_touch_ui = _main.get_node_or_null("TouchUI") as CanvasLayer
	if _touch_ui == null:
		_failures.append("Main 缺少 TouchUI（触摸层缺失，触屏滑动断言无法执行）")
	_player.moved.connect(_on_player_moved)


func _physics_process(_delta: float) -> void:
	if _finished:
		return
	_frames += 1
	if not _failures.is_empty():
		_finish()
		return

	match _phase:
		PHASE_NOISE:
			_inject_noise_frame()
			if _frames >= _phase_deadline:
				_enter_move_phase()
		PHASE_MOVE:
			if _first_step_frame < 0 and GameState.steps > 0:
				_first_step_frame = _frames  # AC5：从注入到生效的延迟采样点
			if _frames >= _phase_deadline:
				_finish_move_phase()
		PHASE_SWIPE:
			_swipe_frame += 1
			if _swipe_frame == 2:
				_inject_swipe_drag()
			if _frames >= _phase_deadline:
				_finish_swipe_phase()
		PHASE_LOGIC:
			_run_logic_assertions()
			if _failures.is_empty():
				_reach_win_state()
			if _failures.is_empty():
				_enter_phase(PHASE_WIN_WAIT, WIN_WAIT_FRAMES)
			else:
				_finish()
		PHASE_WIN_WAIT:
			if _frames >= _phase_deadline:
				_finish_win_wait_phase()
		PHASE_NEXT:
			if _frames >= _phase_deadline:
				_finish_next_phase()
		PHASE_DONE:
			_finish()


## ── 噪声相位：确定种子随机事件（原始事件，不含 InputEventAction）──
## 断言前先打对抗输入：悬挂手势、孤儿释放、双指抢控、乱键（含 Z/R/N/P 换关键）。
## 断言仍全过 = 噪声没有楔死输入管线、没有把局面搞成不可恢复。
func _inject_noise_frame() -> void:
	if _frames == 1:
		_noise_rng.seed = 20260913  # 门禁要求可复现：同种子同事件序
	var roll := _noise_rng.randf()
	var pos := Vector2(_noise_rng.randf_range(0, 800), _noise_rng.randf_range(0, 560))
	if roll < 0.28:
		var t := InputEventScreenTouch.new()
		t.index = _noise_rng.randi_range(0, 1)
		t.position = pos
		t.pressed = true
		Input.parse_input_event(t)
	elif roll < 0.42:
		var t2 := InputEventScreenTouch.new()
		t2.index = _noise_rng.randi_range(0, 1)
		t2.position = pos
		t2.pressed = false
		Input.parse_input_event(t2)
	elif roll < 0.56:
		var d := InputEventScreenDrag.new()
		d.index = _noise_rng.randi_range(0, 1)
		d.position = pos
		d.relative = Vector2(_noise_rng.randf_range(-40, 40), _noise_rng.randf_range(-40, 40))
		Input.parse_input_event(d)
	elif roll < 0.74:
		var mb := InputEventMouseButton.new()
		mb.button_index = MOUSE_BUTTON_LEFT
		mb.position = pos
		mb.pressed = _noise_rng.randf() < 0.5
		Input.parse_input_event(mb)
	else:
		var k := InputEventKey.new()
		k.physical_keycode = [
			KEY_A, KEY_D, KEY_W, KEY_S, KEY_SPACE, KEY_ENTER, KEY_Z, KEY_BACKSPACE, KEY_R, KEY_N, KEY_P,
		][_noise_rng.randi_range(0, 10)]
		k.pressed = _noise_rng.randf() < 0.5
		Input.parse_input_event(k)


## ── 阶段一：注入移动输入，断言角色真的动了 ──
func _enter_move_phase() -> void:
	GameState.load_level(0)  # 噪声相位可能按过 R/N/P，先把局面拉回 level-01 初始态
	_release_move_actions()  # 噪声相位可能留下悬挂的移动动作（摇杆/滑动层），先清零
	_origin_cell = GameState.board.player
	_origin_position = _player.global_position
	_press_frame = _frames
	_first_step_frame = -1
	_phase_deadline = _frames + MOVE_FRAMES
	_phase = PHASE_MOVE
	Input.action_press(&"move_right")


func _finish_move_phase() -> void:
	Input.action_release(&"move_right")
	var travelled: float = _player.global_position.distance_to(_origin_position)
	if travelled < MIN_MOVE_DISTANCE:
		_failures.append("角色 %d 帧内位移 %.2fpx < %.2fpx：InputMap 动作未生效或玩家脚本未驱动步进" % [
			MOVE_FRAMES, travelled, MIN_MOVE_DISTANCE,
		])
	if GameState.board.player == _origin_cell:
		_failures.append("角色逻辑格未变化（%s → %s）：移动输入没有落到 GameState.try_move" % [
			_origin_cell, GameState.board.player,
		])
	if GameState.steps < 1:
		_failures.append("步数计数为 %d：移动生效但 steps_changed 未累计（AC 口径：每位移 1 格计 1 步）" % GameState.steps)
	if not _moved_seen:
		_failures.append("信号 Player.moved 未到达订阅方：连接断裂或从未 emit")
	if not _steps_seen:
		_failures.append("信号 GameState.steps_changed 未到达订阅方：连接断裂或从未 emit")
	# AC5 响应延迟：注入动作 → 首次步进 ≤ 12 帧（200ms，spec.numeric.perf.maxInputResponseMs）
	if _first_step_frame < 0:
		_failures.append("AC5：注入移动输入后 %d 帧内未见步数变化，无法度量响应延迟" % MOVE_FRAMES)
	elif _first_step_frame - _press_frame > RESPONSE_BUDGET_FRAMES:
		_failures.append("AC5 响应延迟：%d 帧（≈%.0fms）> 预算 %d 帧（200ms）" % [
			_first_step_frame - _press_frame,
			(_first_step_frame - _press_frame) * 1000.0 / 60.0,
			RESPONSE_BUDGET_FRAMES,
		])
	# AC5 界面响应：HUD 步数与目标步数必须已随移动刷新（信号驱动的同步更新）
	if _hud_label != null:
		if not _hud_label.text.contains(str(GameState.steps)):
			_failures.append("AC5 界面响应：HUD 未随移动刷新步数（文本未包含 %d）" % GameState.steps)
		if not _hud_label.text.contains("目标步数"):
			_failures.append("HUD 未展示目标步数（spec.numeric.difficulty.parMoves 的展示依据，最优步数挑战 / 结算评级都靠它）")
	if _failures.is_empty():
		_enter_swipe_phase()
	else:
		_finish()


## 释放全部移动动作：噪声 / 摇杆 / 滑动层可能留下按住状态，进入断言相位前必须清零。
func _release_move_actions() -> void:
	for action: StringName in [&"move_left", &"move_right", &"move_up", &"move_down"]:
		Input.action_release(action)


## ── 阶段二：触屏滑动 → 恰好 1 步（spec.numeric.input.touchSwipeThresholdPx = 24）──
## level-01 初始局面：玩家 (2,2)，正上方 (2,1) 是空地 → 向上滑动应恰好走到 (2,1)。
func _enter_swipe_phase() -> void:
	GameState.load_level(0)
	_release_move_actions()
	_swipe_origin_cell = GameState.board.player
	if _touch_ui != null:
		_touch_ui.visible = true  # headless 桌面环境默认隐藏；滑动断言需要触摸层参与输入
	_swipe_frame = 0
	_enter_phase(PHASE_SWIPE, SWIPE_FRAMES)
	var press := InputEventScreenTouch.new()
	press.index = SWIPE_TOUCH_INDEX
	press.position = SWIPE_START
	press.pressed = true
	Input.parse_input_event(press)


func _inject_swipe_drag() -> void:
	var drag := InputEventScreenDrag.new()
	drag.index = SWIPE_TOUCH_INDEX
	drag.position = SWIPE_START + Vector2(0.0, -SWIPE_DRAG_PX)
	drag.relative = Vector2(0.0, -SWIPE_DRAG_PX)
	Input.parse_input_event(drag)


func _finish_swipe_phase() -> void:
	var release := InputEventScreenTouch.new()
	release.index = SWIPE_TOUCH_INDEX
	release.position = SWIPE_START + Vector2(0.0, -SWIPE_DRAG_PX)
	release.pressed = false
	Input.parse_input_event(release)
	if _touch_ui != null:
		_touch_ui.visible = false  # 还原桌面默认隐藏，后续相位不再有触摸输入
	var expected: Vector2i = _swipe_origin_cell + Vector2i.UP
	if GameState.board.player != expected:
		_failures.append("触屏滑动：向上滑动 %.0fpx（阈值 24px）后角色应在 %s，实际 %s（滑动阈值或手势层接线失效）" % [
			SWIPE_DRAG_PX, expected, GameState.board.player,
		])
	if GameState.steps != 1:
		_failures.append("触屏滑动：一次滑动应恰好步进 1 步，实际 %d 步（press 保持帧数须远小于 150ms 长按间隔）" % GameState.steps)
	if _failures.is_empty():
		_enter_phase(PHASE_LOGIC, 1)
	else:
		_finish()


## ── 阶段三：玩法规则断言（纯逻辑 + GameState，逐条对应 AC）──
func _run_logic_assertions() -> void:
	_assert_push_rules()
	_assert_deadlock_rules()
	_assert_win_and_undo_restart()
	_assert_level_roster()
	_assert_level_solutions()


## 死锁判定（失败反馈的机判依据）：角死锁必报、在槽角不报、开阔局面不报。
func _assert_deadlock_rules() -> void:
	# ① 角死锁：方块上/下与左/右各有一面墙、且不在槽上 → 必须判死锁
	var board := SokobanBoard.new()
	board.setup("#######\n#$....#\n#.....#\n#..@..#\n#######")
	_assert(board.boxes.has(Vector2i(1, 1)), "前置：角死锁布局解析失败，方块应在 (1,1)")
	_assert(board.is_deadlocked_cell(Vector2i(1, 1)), "角死锁：上左两面墙夹住的方块应判死锁")
	_assert(board.is_deadlocked(), "角死锁：存在不在槽上的死锁方块时，本关应判不可通关")
	# ② 同一个格子若在槽上（方块已点亮，无需再动）不得误报
	board.setup("#######\n#*....#\n#.....#\n#..@..#\n#######")
	_assert(board.boxes.has(Vector2i(1, 1)) and board.is_lit(Vector2i(1, 1)), "前置：槽上方块布局解析失败")
	_assert(not board.is_deadlocked_cell(Vector2i(1, 1)), "在槽上的方块即使贴角也不得误报死锁（onceLitStaysLit）")
	# ③ 开阔局面不得误报（否则可解关卡会被误判成失败）
	board.setup("#######\n#.....#\n#.@$.+#\n#.....#\n#######")
	_assert(not board.is_deadlocked(), "开阔局面不得误报死锁（推箱子的失败判定必须无假阳性）")
	# ④ 真实关卡：把 level-05 的方块顶进左上角 → 实时判死锁并给 UI 反馈，Undo 可脱离
	GameState.load_level(4)
	_deadlock_seen = false
	for direction: Vector2i in [Vector2i.LEFT, Vector2i.UP, Vector2i.LEFT, Vector2i.DOWN, Vector2i.LEFT, Vector2i.UP]:
		_assert(GameState.try_move(direction), "死锁铺路序列中的 %s 步应生效" % direction)
		if not _failures.is_empty():
			return
	_assert(GameState.deadlocked, "方块被顶进左上角（上左两面墙）后应实时判死锁")
	_assert(_deadlock_seen, "信号 GameState.deadlock_changed 未到达订阅方：失败状态没有通知 UI")
	if _hud_label != null:
		_assert(_hud_label.text.contains("卡死"), "死锁后 HUD 未给出失败反馈文案（按 R 重开 / Z 撤销）")
	_assert(not GameState.won, "死锁不是通关：won 不得被置位")
	_assert(GameState.undo(), "死锁局面下 Undo 应可回退")
	_assert(not GameState.deadlocked, "Undo 脱离死锁步后不得仍处于死锁态")


## AC4 关卡可解性（引擎内机判）：逐关回放落盘的见证解，通关、步数 == par、全程无误报死锁。
func _assert_level_solutions() -> void:
	for index: int in GameState.level_count():
		var meta := SokobanLevels.level_at(index)
		var par: int = int(meta["par_moves"])
		var moves: Array[Vector2i] = SokobanLevels.parse_solution(meta["solution"])
		_assert(moves.size() == par, "关卡 %d 见证解长度 %d != par %d（落盘数据与求解器输出不一致）" % [
			index + 1, moves.size(), par,
		])
		GameState.load_level(index)
		var rejected_at: int = -1
		var false_deadlock: bool = false
		for step: int in moves.size():
			if not GameState.try_move(moves[step]):
				rejected_at = step
				break
			if GameState.board.is_deadlocked():
				false_deadlock = true  # 见证解全程可解 → 死锁判定中途报警即为误报
				break
		_assert(rejected_at < 0, "关卡 %d 见证解在第 %d 步被拒：推动规则与求解器规则不一致" % [index + 1, rejected_at + 1])
		_assert(not false_deadlock, "关卡 %d 见证解回放中途误报死锁：死锁判定不可靠" % (index + 1))
		_assert(GameState.won, "关卡 %d 见证解回放后未通关（AC4：每关必须存在通关路径）" % (index + 1))
		_assert(GameState.steps == par, "关卡 %d 回放步数 %d != par %d（难度梯度失真）" % [
			index + 1, GameState.steps, par,
		])
		_assert(GameState.board.lit_count() == GameState.board.target_count(),
			"关卡 %d 通关时点亮数应等于接线槽总数" % (index + 1))


## AC1 推动规则：在合成棋盘上逐情形核对（不依赖任何关卡布局的偶然性）。
func _assert_push_rules() -> void:
	# ① 推动生效 + 不可拉动：方块未入槽的布局，避免「通关后停走」干扰
	var board := SokobanBoard.new()
	board.setup("#######\n#.@$..#\n#######")
	_assert(board.player == Vector2i(2, 1) and board.box_count() == 1, "合成布局解析失败：玩家/方块初始格不对")
	_assert(board.try_move(Vector2i.RIGHT), "推动生效：向方块方向移动应成功")
	_assert(board.player == Vector2i(3, 1), "推动生效：角色应前进到原方块格")
	_assert(board.boxes.has(Vector2i(4, 1)), "推动生效：方块应同步前进 1 格到 %s" % Vector2i(4, 1))
	# ② 不可拉动：角色往回走，方块留在原地
	_assert(board.try_move(Vector2i.LEFT), "普通移动：向空地移动应成功")
	_assert(board.player == Vector2i(2, 1) and board.boxes.has(Vector2i(4, 1)),
		"不可拉动：角色回退时方块必须留在原格（block.pullable=false）")
	# ③ 推墙无效：角色不位移
	board.setup("#######\n#.@$..#\n#######")
	board.try_move(Vector2i.LEFT)  # 先离开墙边 → 角色到 (1,1)
	_assert(board.player == Vector2i(1, 1), "前置：角色应已移动到 (1,1)")
	_assert(not board.try_move(Vector2i.LEFT), "推墙：向墙方向移动应无效")
	_assert(board.player == Vector2i(1, 1), "推墙：无效移动时角色不得位移（AC1）")
	# ④ 顶到另一方块：双方均不位移
	board.setup("#######\n#.@$$.#\n#######")
	_assert(not board.try_move(Vector2i.RIGHT), "顶方块：前方方块再顶另一方块时移动应无效")
	_assert(board.player == Vector2i(2, 1), "顶方块：无效推动时角色不得位移")
	_assert(board.boxes.has(Vector2i(3, 1)) and board.boxes.has(Vector2i(4, 1)), "顶方块：两个方块均不得位移")
	# ⑤ 点亮与通关判定：方块入槽同帧点亮且保持常亮，唯一槽点亮即通关
	board.setup("#######\n#.@$+.#\n#######")
	_assert(board.targets.has(Vector2i(4, 1)), "合成布局解析失败：接线槽应在 (4,1)")
	_assert(board.try_move(Vector2i.RIGHT), "推动入槽：向方块方向移动应成功")
	_assert(board.is_lit(Vector2i(4, 1)), "点亮判定：方块进入接线槽的同一时刻该格应点亮（AC2）")
	_assert(board.is_solved(), "通关判定：唯一接线槽点亮后应判通关")
	_assert(not board.try_move(Vector2i.LEFT), "通关后移动应停走（玩法约定：用 Undo / Restart / 换关离开该状态）")


## AC2 通关判定 + AC3 撤销与重开（在真实关卡 level-01 上走一遍）。
func _assert_win_and_undo_restart() -> void:
	GameState.load_level(0)  # 噪声相位可能按过 N/P 换过关，显式回到 level-01
	var board := GameState.board
	_assert(GameState.level_index == 0 and GameState.steps == 0, "重开后应回到 level-01 且步数清零")
	_assert(board.player == Vector2i(2, 2), "level-01 初始玩家格应为 (2,2)，实际 %s" % board.player)
	_assert(board.boxes.has(Vector2i(3, 2)) and board.targets.has(Vector2i(5, 2)),
		"level-01 初始布局不符：方块应在 (3,2)、接线槽应在 (5,2)")

	# 推两步通关（求解器最优解 = 2 步，见 tools/level_solver.py）
	_assert(GameState.try_move(Vector2i.RIGHT), "第 1 步向右推动应生效")
	_assert(GameState.steps == 1, "第 1 步后步数应为 1，实际 %d" % GameState.steps)
	_assert(GameState.try_move(Vector2i.RIGHT), "第 2 步向右推动应生效")
	_assert(board.is_lit(Vector2i(5, 2)), "方块推入 (5,2) 接线槽后该格应点亮（AC2）")
	_assert(GameState.won, "最后一个接线槽点亮后应立即判通关（AC2）")
	_assert(_won_seen, "信号 GameState.level_won 未到达订阅方")
	_assert(board.lit_count() == 1 and board.target_count() == 1, "点亮进度应为 1/1")

	# Undo 精确回退一步：角色 / 方块 / 点亮 / 步数四项同步还原（AC3）
	_assert(GameState.undo(), "通关局面下 Undo 应回退一步")
	_assert(GameState.steps == 1, "Undo 后步数应还原为 1，实际 %d" % GameState.steps)
	_assert(GameState.board.player == Vector2i(3, 2), "Undo 后角色应回到 (3,2)，实际 %s" % GameState.board.player)
	_assert(GameState.board.boxes.has(Vector2i(4, 2)), "Undo 后方块应回到 (4,2)")
	_assert(not GameState.board.is_lit(Vector2i(5, 2)), "Undo 后 (5,2) 的点亮状态应一并还原")
	_assert(not GameState.won, "Undo 后不应停留在通关态")
	_assert(GameState.undo(), "第二步 Undo 应回退到初始局面")
	_assert(GameState.steps == 0 and GameState.board.player == Vector2i(2, 2), "两次 Undo 后应回到初始格与 0 步")
	_assert(not GameState.undo(), "撤销历史耗尽后 Undo 应返回 false（不产生任何位移）")
	_assert(GameState.board.player == Vector2i(2, 2), "空历史 Undo 不得改变角色位置")

	# Restart 完整恢复初始布局并清空步数与历史（AC3）
	GameState.restart()
	_assert(GameState.steps == 0 and not GameState.won, "Restart 后步数与通关态应复位")
	_assert(GameState.board.player == Vector2i(2, 2) and GameState.board.boxes.has(Vector2i(3, 2)),
		"Restart 后应完整恢复 level-01 初始布局")
	_assert(GameState.board.lit_count() == 0, "Restart 后点亮状态应清空")


## AC4 关卡册：关卡数 ≥5、难度递增（方块数 1→5）、每关都可载入且方块/槽数一致。
func _assert_level_roster() -> void:
	_assert(GameState.level_count() >= 5, "关卡数 %d < 5（AC4）" % GameState.level_count())
	var previous_boxes: int = 0
	for index: int in GameState.level_count():
		GameState.load_level(index)
		var board := GameState.board
		_assert(board.box_count() == board.target_count(),
			"关卡 %d 方块数 %d 与接线槽数 %d 不一致（无法通关的配置）" % [index + 1, board.box_count(), board.target_count()])
		_assert(board.box_count() > 0, "关卡 %d 没有方块，不构成可玩关卡" % (index + 1))
		_assert(board.box_count() >= previous_boxes, "关卡 %d 方块数未保持难度递增（1→5）" % (index + 1))
		previous_boxes = board.box_count()
	# 关卡选择：下一关 / 上一关（先回到第 1 关，遍历后索引停在最后一关）
	GameState.load_level(0)
	GameState.next_level()
	_assert(GameState.level_index == 1, "next_level 应进入第 2 关，实际 %d" % GameState.level_index)
	_assert(GameState.board.box_count() == 2, "第 2 关应有 2 个方块（难度递增），实际 %d" % GameState.board.box_count())
	GameState.prev_level()
	_assert(GameState.level_index == 0, "prev_level 应回到第 1 关，实际 %d" % GameState.level_index)
	GameState.next_level()
	GameState.next_level()
	_assert(GameState.level_index == 2, "连续 next_level 应推进到第 3 关，实际 %d" % GameState.level_index)


## 把局面推回「level-01 刚通关」的状态，供通关弹层相位等待（求解器最优解 = 2 步）。
func _reach_win_state() -> void:
	GameState.load_level(0)
	_assert(GameState.try_move(Vector2i.RIGHT), "复推第 1 步应生效")
	_assert(GameState.try_move(Vector2i.RIGHT), "复推第 2 步应生效")
	_assert(GameState.won, "复推两步后应处于通关态（通关弹层相位的前置）")


## ── 阶段三：通关弹层出现（≤1000ms 口径）→ confirm 进入下一关 ──
func _finish_win_wait_phase() -> void:
	if not GameState.won:
		_failures.append("等待通关弹层时关卡不在通关态：前置断言阶段未把 level-01 推到通关")
	if _win_overlay == null:
		_failures.append("通关弹层节点缺失，无法判定 AC2 的 ≤1000ms 出现要求")
	elif not _win_overlay.visible:
		_failures.append("通关弹层在 %d 帧内未出现（要求 ≤1000ms ≈ 60 帧，设计值 300ms）" % WIN_WAIT_FRAMES)
	if not _lit_seen:
		_failures.append("信号 GameState.lit_changed 未到达订阅方：点亮进度没有通知 UI")
	# 结算展示（spec.numeric.win.showsStepCount + content.replayHooks 步数评级）
	if _win_label != null:
		if not _win_label.text.contains(str(GameState.steps)):
			_failures.append("通关结算未展示本关步数 %d（spec.numeric.win.showsStepCount = true）" % GameState.steps)
		if not _win_label.text.contains("⚡"):
			_failures.append("通关结算未展示步数评级 ⚡（spec.content.replayHooks：≤par ⚡⚡⚡ / ≤par×1.5 ⚡⚡ / 其余 ⚡）")
	if not _failures.is_empty():
		_finish()
		return
	_target_level_index = posmod(GameState.level_index + 1, GameState.level_count())
	_press_action(&"confirm")
	_enter_phase(PHASE_NEXT, NEXT_FRAMES)


func _finish_next_phase() -> void:
	if GameState.level_index != _target_level_index:
		_failures.append("通关后 confirm 应进入下一关（期望第 %d 关，实际第 %d 关）" % [
			_target_level_index + 1, GameState.level_index + 1,
		])
	_finish()


func _enter_phase(phase: int, frames: int) -> void:
	_phase = phase
	_phase_deadline = _frames + frames


## 无显示设备时模拟「玩家按键」：注入真实 InputEvent，让 _unhandled_input 收得到。
func _press_action(action: StringName) -> void:
	var event := InputEventAction.new()
	event.action = action
	event.pressed = true
	Input.parse_input_event(event)


## 键位契约断言：目标键表 → project.godot [input] 的 physical_keycode（AND 语义，逐键核对）。
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


func _assert(condition: bool, message: String) -> void:
	if not condition:
		_failures.append(message)


func _finish() -> void:
	if _finished:
		return
	_finished = true
	if _failures.is_empty():
		print("GODOT_SMOKE: PASS 场景实例化 / autoload / 键位契约 / 移动输入 / 推动规则 / 死锁判定 / 点亮通关 / Undo·Restart / 关卡切换 / 见证解回放(AC4) / 响应延迟(AC5) / 触屏滑动 全部通过")
		get_tree().quit(0)
	else:
		for failure in _failures:
			printerr("GODOT_SMOKE: FAIL %s" % failure)
		get_tree().quit(1)


func _on_player_moved(_world_position: Vector2) -> void:
	_moved_seen = true


func _on_steps_changed(_steps: int) -> void:
	_steps_seen = true


func _on_lit_changed(_lit_count: int, _total: int) -> void:
	_lit_seen = true


func _on_level_won(_level_index: int, _steps: int) -> void:
	_won_seen = true


func _on_deadlock_changed(_deadlocked: bool) -> void:
	_deadlock_seen = true
