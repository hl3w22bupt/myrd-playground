extends Node
## 无头冒烟自检（headless smoke）—— 机器可判定的「游戏能不能跑」。
##
## 运行方式（由 docs/skills/godot-game-dev/scripts/smoke.sh 封装）：
##   godot --headless --path <工程目录> tests/smoke.tscn
##
## 判定协议（smoke.sh 按此断言退出码与日志）：
##   通过 → stdout 打印 `GODOT_SMOKE: PASS ...`，进程退出码 0
##   失败 → stderr 打印 `GODOT_SMOKE: FAIL <原因>`（每条一行），进程退出码 1
##
## 覆盖面（对应本目标验收标准的七项）：
##   1. 玩家能移动：注入 move_right → 光标 grid_pos / 节点位置真的变了，cell_changed 送达
##   2. 核心交互生效：选中 → 相邻交换 → 三消收集 → 加分 + 扣步（Board.candies_collected 送达）
##   3. 死局守卫生效：构造模 5 交错死局 → ensure_solvable 洗出「无现成三连 + 必有可行交换」的盘，
##      Board.shuffled 送达（玩家永不卡死）
##   4. 计分规则回归：score_for_wave 纯函数锁具体数值（四连/五连加成、连锁倍率）；强制四连盘走
##      真实结算管线，last_max_run / last_wave_count / 分数下界三重核对
##   5. 难度梯度：target/moves 阶梯纯函数单调性（L1→L6 目标分严格递增、步数非增）
##   6. 胜负可达且反馈明确：胜利遮罩 → confirm 过关进下一关（level/target/moves 按阶梯重算，
##      level_changed 送达、HUD 刷新）；第 3 关步数耗尽判负，GAME OVER + 结算分数如实呈现
##   7. 重开可用：注入 restart → 分数/步数/关卡/棋盘/光标/遮罩全部复位，game_restarted 送达
##   外加模板五项：场景可实例化、autoload 注册、InputMap + 键位契约、信号到达、可读失败原因
##
## ⚠️ 输入注入全走 Input.parse_input_event（InputEventAction），并按帧分段（error-signatures E-08）：
##   headless 下 parse_input_event 的缓冲冲刷会清掉 Input.action_press 的状态，
##   本场景从不用 action_press，所有注入间隔 ≥4 帧，互不重叠。

## 键位契约之外还需注册的动作（与 project.godot [input] 对应）。
const REQUIRED_ACTIONS: Array[StringName] = [
	&"move_left", &"move_right", &"move_up", &"move_down", &"confirm", &"restart",
]

## 键位契约：动作 → 键表承诺的物理键，**必须全部绑定**（逐键 AND，见 error-signatures E-12）。
const KEY_CONTRACT: Dictionary = {
	&"move_left": [KEY_A, KEY_LEFT],
	&"move_right": [KEY_D, KEY_RIGHT],
	&"move_up": [KEY_W, KEY_UP],
	&"move_down": [KEY_S, KEY_DOWN],
	&"confirm": [KEY_SPACE, KEY_ENTER],
	&"restart": [KEY_R],
}

## 帧阶段表（Engine.max_fps = 60 下 process : 物理 ≈ 1:1；--quit-after 兜底 240 帧）。
const FRAME_MOVE: int = 1
const FRAME_MOVE_CHECK: int = 5
const FRAME_SELECT: int = 7
const FRAME_SELECT_CHECK: int = 11
const FRAME_SWAP: int = 15
const FRAME_SWAP_CHECK: int = 19
const FRAME_DEADLOCK: int = 21
const FRAME_DEADLOCK_CHECK: int = 23
const FRAME_SCORING: int = 25
const FRAME_SCORING_CHECK: int = 27
const FRAME_WIN: int = 29
const FRAME_ADVANCE: int = 31
const FRAME_ADVANCE_CHECK: int = 33
const FRAME_LOSE: int = 35
const FRAME_LOSE_CHECK: int = 37
const FRAME_RESTART: int = 39
const FRAME_RESTART_CHECK: int = 44
## 总帧数上限（超过即出报告，防止死循环；smoke.sh 另有 --quit-after 兜底）。
const TOTAL_FRAMES: int = 90
## 强制四连结算用的固定种子（重力补充由此确定，断言只取下界仍需可复现的运行环境）。
const SCORING_RNG_SEED: int = 20260905

var _failures: PackedStringArray = []
var _frames: int = 0
var _finished: bool = false

var _main: Node
var _board: Board
var _cursor: Player
var _overlay: ColorRect

var _origin_pos: Vector2 = Vector2.ZERO
var _origin_cell: Vector2i = Vector2i.ZERO
var _cursor_moved_seen: bool = false
var _selection_seen: bool = false
var _score_changed_seen: bool = false
var _moves_changed_seen: bool = false
var _candies_collected_seen: bool = false
var _win_seen: bool = false
var _lose_seen: bool = false
var _restarted_seen: bool = false
var _shuffled_seen: bool = false
var _level_changed_seen: bool = false

var _swap_a: Vector2i = Vector2i.ZERO
var _swap_b: Vector2i = Vector2i.ZERO
var _swap_dir_action: StringName = &"move_right"
var _score_before: int = 0
var _moves_before: int = 0
var _score_before_scoring: int = 0


func _ready() -> void:
	# headless 没有垂直同步，process 帧率可跑到几百上千 FPS，而物理固定 60Hz。
	# 限到 60 FPS 让 --quit-after 的帧数兜底有意义（协程跑得完再退出）。
	Engine.max_fps = 60

	for action in REQUIRED_ACTIONS:
		if not InputMap.has_action(action):
			_failures.append("InputMap 缺少动作 %s（project.godot [input] 未注册）" % action)
	_check_key_bindings()

	var game_state_node := get_tree().root.get_node_or_null("GameState")
	if game_state_node == null:
		_failures.append("autoload GameState 未注册（project.godot [autoload] 缺失）")
	else:
		for signal_name in ["score_changed", "moves_changed", "game_ended", "game_restarted", "level_changed"]:
			if not game_state_node.has_signal(signal_name):
				_failures.append("autoload GameState 缺少信号 %s" % signal_name)
		game_state_node.score_changed.connect(_on_score_changed)
		game_state_node.moves_changed.connect(_on_moves_changed)
		game_state_node.game_ended.connect(_on_game_ended)
		game_state_node.game_restarted.connect(_on_game_restarted)
		game_state_node.level_changed.connect(_on_level_changed)

	_main = get_tree().root.find_child("Main", true, false)
	if _main == null:
		_failures.append("场景树找不到 Main（tests/smoke.tscn 未实例化 scenes/main.tscn）")
		return
	_board = _main.find_child("Board", true, false) as Board
	if _board == null:
		_failures.append("主场景找不到 Board（scenes/main.tscn 缺少 Board 节点或 board.gd 未挂载）")
	else:
		_board.candies_collected.connect(_on_candies_collected)
		_board.shuffled.connect(_on_board_shuffled)
	_cursor = _main.find_child("Player", true, false) as Player
	if _cursor == null:
		_failures.append("主场景找不到 Player 光标（Board 下未实例化 player.tscn，或 player.gd 未挂载）")
	else:
		_cursor.cell_changed.connect(_on_cursor_cell_changed)
		_cursor.selection_changed.connect(_on_selection_changed)
		_origin_pos = _cursor.position
		_origin_cell = _cursor.grid_pos
	_overlay = _main.find_child("Overlay", true, false) as ColorRect
	if _overlay == null:
		_failures.append("主场景找不到 Overlay 胜负遮罩（scenes/main.tscn 缺少 %Overlay）")


func _physics_process(_delta: float) -> void:
	if _finished:
		return
	_frames += 1
	# 任一断言失败立即收口（后续阶段依赖前序状态，继续跑只会产生噪声失败）。
	if not _failures.is_empty():
		_finish()
		return
	match _frames:
		FRAME_MOVE:
			_inject_action(&"move_right")
		FRAME_MOVE_CHECK:
			_check_cursor_moved()
		FRAME_SELECT:
			_inject_action(&"confirm")
		FRAME_SELECT_CHECK:
			_check_selected_and_step_to_b()
		FRAME_SWAP:
			_inject_action(&"confirm")
		FRAME_SWAP_CHECK:
			_check_swap_resolved()
		FRAME_DEADLOCK:
			_run_deadlock_scenario()
		FRAME_DEADLOCK_CHECK:
			_check_deadlock_resolved()
		FRAME_SCORING:
			_run_scoring_scenario()
		FRAME_SCORING_CHECK:
			_check_scoring()
		FRAME_WIN:
			_run_win_scenario()
		FRAME_ADVANCE:
			_inject_action(&"confirm")
		FRAME_ADVANCE_CHECK:
			_check_advanced()
		FRAME_LOSE:
			_run_lose_scenario()
		FRAME_LOSE_CHECK:
			_check_lose()
		FRAME_RESTART:
			_inject_action(&"restart")
		FRAME_RESTART_CHECK:
			_check_restarted()
			_finish()
			return
	if _frames >= TOTAL_FRAMES:
		_finish()


## 阶段 1 断言：注入 move_right 后光标真的动了（网格坐标 + 节点位置 + 信号三重核对），
## 随后把光标瞬移到一组「必定三消」的交换对起点，为交互阶段做准备。
func _check_cursor_moved() -> void:
	if _cursor == null:
		return
	if _cursor.grid_pos == _origin_cell:
		_failures.append("玩家不能移动：注入 move_right 后光标 grid_pos 仍为 %s（InputMap 动作未生效或 _unhandled_input 未接线）" % _origin_cell)
	if _cursor.position.distance_to(_origin_pos) < 1.0:
		_failures.append("光标节点位置未随网格移动（视觉同步断裂：_sync_position 未生效）")
	if not _cursor_moved_seen:
		_failures.append("信号 Player.cell_changed 未到达订阅方：连接断裂或从未 emit")
	var pair := _board.find_valid_swap()
	if pair.size() < 2:
		_failures.append("棋盘上找不到任何可行三消交换（find_valid_swap 为空）：开局填充或匹配检测有缺陷")
		return
	_swap_a = pair[0]
	_swap_b = pair[1]
	_cursor.set_cell(_swap_a)
	_score_before = GameState.score
	_moves_before = GameState.moves_left


## 阶段 2 断言：confirm 后进入选中态；再向交换对终点注入一步方向。
func _check_selected_and_step_to_b() -> void:
	if _cursor == null:
		return
	if not _cursor.has_selection:
		_failures.append("核心交互失效：注入 confirm 后光标未进入选中态（Player._handle_confirm 未生效）")
	if not _selection_seen:
		_failures.append("信号 Player.selection_changed 未到达订阅方")
	var direction: Vector2i = _swap_b - _swap_a
	if direction == Vector2i.RIGHT:
		_swap_dir_action = &"move_right"
	elif direction == Vector2i.DOWN:
		_swap_dir_action = &"move_down"
	elif direction == Vector2i.LEFT:
		_swap_dir_action = &"move_left"
	else:
		_swap_dir_action = &"move_up"
	_inject_action(_swap_dir_action)


## 阶段 3 断言：第二次 confirm 完成交换 → 三消收集 → 加分 + 扣步。
func _check_swap_resolved() -> void:
	if GameState.score <= _score_before:
		_failures.append("核心交互失效：交换后分数未增加（%d → %d），Board.try_swap 三消结算或 GameState.add_score 断裂" % [
			_score_before, GameState.score,
		])
	if GameState.moves_left != _moves_before - 1:
		_failures.append("有效交换未消耗步数（%d → %d，期望 %d）：GameState.use_move 未被调用" % [
			_moves_before, GameState.moves_left, _moves_before - 1,
		])
	if GameState.level != 1:
		_failures.append("输入事件重入：触发交换的同一 confirm 被传给 Main 的过关分支（期望仍为第 1 关，实际 level=%d）—— Player 消费输入后未 set_input_as_handled" % GameState.level)
	if not _candies_collected_seen:
		_failures.append("信号 Board.candies_collected 未发出：三消收集链路断裂")
	if not _score_changed_seen:
		_failures.append("信号 GameState.score_changed 未到达订阅方：加分链路断裂")
	if not _moves_changed_seen:
		_failures.append("信号 GameState.moves_changed 未到达订阅方：扣步链路断裂")


## 阶段 4：死局守卫 —— 构造「模 5 交错盘」（types[x][y] = (x + 2y) mod 5，行列均无相邻同色，
## 数学上任何相邻交换都无法形成三连）强制触发死局，ensure_solvable 必须洗出一手可解棋盘。
func _run_deadlock_scenario() -> void:
	for x in Board.COLS:
		for y in Board.ROWS:
			_board.types[x][y] = (x + 2 * y) % Board.CANDY_KINDS
	if not _board.find_valid_swap().is_empty():
		_failures.append("死局构造失效：模 5 交错盘被判定存在可行交换，死局守卫断言覆盖不到真实死局")
		return
	if _board.find_matches().is_empty() == false:
		_failures.append("死局构造失效：交错盘存在现成三连，未构成真正的无解盘面")
		return
	_board.ensure_solvable()


## 阶段 4 断言：洗牌后必须「有可行交换 + 无现成三连」，且 shuffled 信号到达订阅方。
func _check_deadlock_resolved() -> void:
	if not _shuffled_seen:
		_failures.append("死局守卫失效：死局盘调用 ensure_solvable 后未发出 Board.shuffled 信号（洗牌链路断裂）")
	if _board.find_valid_swap().is_empty():
		_failures.append("死局守卫失效：洗牌后棋盘仍无可行交换，玩家会永久卡死（SHUFFLE_ATTEMPTS/兜底布局失效）")
	if not _board.find_matches().is_empty():
		_failures.append("死局洗牌质量缺陷：洗出了现成三连（应为无现成三连的可解盘）")


## 阶段 5：计分与难度梯度的纯函数断言（无随机，锁具体数值）+ 强制四连走真实结算管线。
func _run_scoring_scenario() -> void:
	# 计分公式：基础分、四连/五连加成、连锁波次倍率（回归锁：改规则必须改断言）。
	var cases: Array = [
		[3, 1, 3, 3 * Board.POINTS_PER_CANDY],
		[4, 1, 4, 4 * Board.POINTS_PER_CANDY + Board.FOUR_RUN_BONUS],
		[5, 1, 5, 5 * Board.POINTS_PER_CANDY + Board.FIVE_RUN_BONUS],
		[3, 2, 3, 3 * Board.POINTS_PER_CANDY * 2],
		[4, 3, 5, 4 * Board.POINTS_PER_CANDY * 3 + Board.FIVE_RUN_BONUS],
	]
	for case in cases:
		var got: int = Board.score_for_wave(case[0], case[1], case[2])
		if got != case[3]:
			_failures.append("计分公式回归：score_for_wave(%d, %d, %d) = %d，期望 %d（加成/倍率规则被破坏）" % [
				case[0], case[1], case[2], got, case[3],
			])
	# 难度阶梯：L1 数值与常量一致；L1→L6 目标分严格递增、步数非增（梯度必须存在）。
	if GameState.target_for_level(1) != GameState.TARGET_SCORE:
		_failures.append("难度梯度失效：第 1 关目标分 %d != TARGET_SCORE %d" % [
			GameState.target_for_level(1), GameState.TARGET_SCORE,
		])
	if GameState.moves_for_level(1) != GameState.START_MOVES:
		_failures.append("难度梯度失效：第 1 关步数 %d != START_MOVES %d" % [
			GameState.moves_for_level(1), GameState.START_MOVES,
		])
	for stage in range(1, 6):
		if GameState.target_for_level(stage + 1) <= GameState.target_for_level(stage):
			_failures.append("难度梯度失效：第 %d→%d 关目标分未递增（%d → %d），无难度曲线" % [
				stage, stage + 1, GameState.target_for_level(stage), GameState.target_for_level(stage + 1),
			])
		if GameState.moves_for_level(stage + 1) > GameState.moves_for_level(stage):
			_failures.append("难度梯度失效：第 %d→%d 关步数未收紧（%d → %d）" % [
				stage, stage + 1, GameState.moves_for_level(stage), GameState.moves_for_level(stage + 1),
			])
	# 强制四连结算：种子固定 → 重力补充确定；先铺交错盘隔离干扰，再改出唯一的一处四连。
	# 前置复位到对局态：若阶段 3 的交换恰好大连锁直接获胜（合法游戏行为），
	# outcome 会停在 WIN，add_score 的对局态守卫会把本阶段结算拦成 0 分 ——
	# 计分断言必须与「前序阶段是否恰好获胜」解耦。
	GameState.start_game()
	_score_before_scoring = GameState.score
	_board.rng.seed = SCORING_RNG_SEED
	for x in Board.COLS:
		for y in Board.ROWS:
			_board.types[x][y] = (x + 2 * y) % Board.CANDY_KINDS
	for x in 4:
		_board.types[x][0] = 2
	_board._resolve_cascades()


## 阶段 5 断言：四连盘走真实结算管线后，长连被识别、分数走计分公式（连锁只增不减，取下界）。
func _check_scoring() -> void:
	var gained: int = GameState.score - _score_before_scoring
	if _board.last_max_run < 4:
		_failures.append("长连加成失效：强制四连盘 last_max_run = %d（期望 ≥ 4），_max_run_length 检测断裂" % _board.last_max_run)
	var wave_floor: int = Board.score_for_wave(4, 1, 4)
	if gained < wave_floor:
		_failures.append("结算管线断裂：四连盘实得 %d < 公式下界 %d（_resolve_cascades 未走 score_for_wave）" % [
			gained, wave_floor,
		])
	if _board.last_wave_count < 1:
		_failures.append("结算管线断裂：last_wave_count = %d（期望 ≥ 1），波次统计未更新" % _board.last_wave_count)
	if gained % Board.POINTS_PER_CANDY != 0:
		_failures.append("计分异常：实得 %d 不是单颗分 %d 的整数倍（计分路径混入非公式来源）" % [
			gained, Board.POINTS_PER_CANDY,
		])


## 阶段 6：胜利可达 —— 直接调用加分函数把分数推到目标（SKILL.md 第 7 节的合法姿势），
## check_end 必须判胜且遮罩显示。
## 阶段 6：胜利可达 —— 复位到对局态后直接把分数推到目标（SKILL.md 第 7 节的合法姿势），
## check_end 必须判胜且遮罩显示。先复位保证阶段确定性：不依赖前序阶段是否恰好已获胜。
func _run_win_scenario() -> void:
	GameState.start_game()
	GameState.score = GameState.target_score
	GameState.check_end()
	if GameState.outcome != GameState.Outcome.WIN:
		_failures.append("胜负不可达：分数达标后 GameState.check_end 未判胜（outcome=%s）" % GameState.outcome)
	if not _win_seen:
		_failures.append("信号 GameState.game_ended(\"win\") 未到达订阅方：胜利判定链路断裂")
	if _overlay != null and not _overlay.visible:
		_failures.append("胜利后遮罩未显示（main.gd _on_game_ended 未生效）")


## 阶段 7 断言：胜利遮罩上注入 confirm → 过关推进（新交互必须有专属断言拦截回归）。
func _check_advanced() -> void:
	if GameState.level != 2:
		_failures.append("过关交互失效：胜利后注入 confirm，level = %d（期望 2，main.gd _advance_level 未生效）" % GameState.level)
	if GameState.outcome != GameState.Outcome.PLAYING:
		_failures.append("过关交互失效：过关后 outcome = %s（期望 PLAYING，可直接继续对局）" % GameState.outcome)
	if GameState.score != 0:
		_failures.append("过关交互失效：过关后分数未清零（score=%d）" % GameState.score)
	if GameState.moves_left != GameState.moves_for_level(2):
		_failures.append("过关交互失效：过关后步数未按第 2 关阶梯重算（moves_left=%d，期望 %d）" % [
			GameState.moves_left, GameState.moves_for_level(2),
		])
	if GameState.target_score != GameState.target_for_level(2):
		_failures.append("难度梯度失效：过关后目标分未按第 2 关阶梯重算（target_score=%d，期望 %d）" % [
			GameState.target_score, GameState.target_for_level(2),
		])
	if not _level_changed_seen:
		_failures.append("信号 GameState.level_changed 未到达订阅方：过关链路断裂")
	if _overlay != null and _overlay.visible:
		_failures.append("过关交互失效：过关后胜负遮罩仍显示")
	var level_label := _main.find_child("LevelLabel", true, false) as Label
	if level_label != null and level_label.text != "LEVEL 2":
		_failures.append("关卡 HUD 未随过关刷新（LevelLabel.text=%s，期望 LEVEL 2）" % level_label.text)
	if _board != null:
		for column in _board.types:
			for value in column:
				if value == Board.EMPTY:
					_failures.append("过关交互失效：过关重填后棋盘存在空格（board.new_game 未生效）")
					return


## 阶段 8：失败可达 —— 切到第 3 关后把步数清零，check_end 必须判负
## （故意把 level 抬到 3，让阶段 9 的「重开回第 1 关」断言有真实区分度）。
func _run_lose_scenario() -> void:
	GameState.start_game()
	GameState.level = 3
	GameState.target_score = GameState.target_for_level(3)
	GameState.moves_left = GameState.moves_for_level(3)
	GameState.moves_left = 0
	GameState.check_end()
	if GameState.outcome != GameState.Outcome.LOSE:
		_failures.append("胜负不可达：步数耗尽后 GameState.check_end 未判负（outcome=%s）" % GameState.outcome)
	if not _lose_seen:
		_failures.append("信号 GameState.game_ended(\"lose\") 未到达订阅方：失败判定链路断裂")


## 阶段 8 断言：失败态的遮罩文案与结算分数要如实呈现。
func _check_lose() -> void:
	if _overlay != null and not _overlay.visible:
		_failures.append("失败后遮罩未显示（main.gd _on_game_ended 未覆盖 lose 分支）")
	var overlay_title := _main.find_child("OverlayTitle", true, false) as Label
	if overlay_title != null and overlay_title.text != "GAME OVER":
		_failures.append("失败文案缺失：OverlayTitle.text=%s（期望 GAME OVER，胜负反馈不明确）" % overlay_title.text)
	var overlay_score := _main.find_child("OverlayScore", true, false) as Label
	if overlay_score != null and overlay_score.text != "SCORE %d" % GameState.score:
		_failures.append("结算分数缺失：OverlayScore.text=%s（期望 SCORE %d）" % [overlay_score.text, GameState.score])


## 阶段 9 断言：注入 restart 后全部复位（状态/分数/步数/关卡/棋盘/光标/遮罩）。
func _check_restarted() -> void:
	if GameState.outcome != GameState.Outcome.PLAYING:
		_failures.append("重开不可用：对局状态未复位（outcome=%s，期望 PLAYING）" % GameState.outcome)
	if GameState.score != 0:
		_failures.append("重开不可用：分数未清零（score=%d）" % GameState.score)
	if GameState.level != 1:
		_failures.append("重开不可用：关卡未回到第 1 关（level=%d，失败于第 3 关后重开应从零开始）" % GameState.level)
	if GameState.moves_left != GameState.moves_for_level(1):
		_failures.append("重开不可用：步数未按第 1 关复位（moves_left=%d，期望 %d）" % [
			GameState.moves_left, GameState.moves_for_level(1),
		])
	if not _restarted_seen:
		_failures.append("信号 GameState.game_restarted 未到达订阅方：重开链路断裂")
	if _cursor != null and _cursor.grid_pos != Vector2i.ZERO:
		_failures.append("重开不可用：光标未归位（grid_pos=%s）" % _cursor.grid_pos)
	if _overlay != null and _overlay.visible:
		_failures.append("重开不可用：胜负遮罩仍显示")
	var level_label := _main.find_child("LevelLabel", true, false) as Label
	if level_label != null and level_label.text != "LEVEL 1":
		_failures.append("重开不可用：关卡 HUD 未复位（LevelLabel.text=%s，期望 LEVEL 1）" % level_label.text)
	if _board != null:
		var empty_cells: int = 0
		for column in _board.types:
			for value in column:
				if value == Board.EMPTY:
					empty_cells += 1
		if empty_cells > 0:
			_failures.append("重开不可用：棋盘存在 %d 个空格（Board.new_game 未重填）" % empty_cells)


func _finish() -> void:
	if _finished:
		return
	_finished = true
	if _failures.is_empty():
		print("GODOT_SMOKE: PASS 场景实例化/键位契约/光标移动/选中交换收集/死局洗牌/计分加成/难度梯度/过关推进/胜负判定/重开复位 全部通过")
		get_tree().quit(0)
	else:
		for failure in _failures:
			printerr("GODOT_SMOKE: FAIL %s" % failure)
		get_tree().quit(1)


## 无显示设备时模拟「玩家按键」：注入真实 InputEvent，让 _unhandled_input 收得到。
## （Input.action_press 只改动作强度，不产生 InputEvent，触发不了 _unhandled_input。）
## ⚠️ 实测坑（Godot 4.6 headless）：parse_input_event 的事件滞留在缓冲区，
## headless DisplayServer 不逐帧冲刷 → 事件永远派发不出去（4.3 无此问题）。
## 注入后必须手动 Input.flush_buffered_events() 立即派发，断言才有确定性。
func _inject_action(action: StringName) -> void:
	var event := InputEventAction.new()
	event.action = action
	event.pressed = true
	Input.parse_input_event(event)
	Input.flush_buffered_events()


## 键位契约断言：目标键表 → project.godot [input] 的 physical_keycode（逐键 AND，E-12）。
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


## 键码 → 可读键名 + 数值（未映射键名会打私有区字形，数值才能定位）。
func _key_labels(keys: Array) -> String:
	var labels: PackedStringArray = []
	for code in keys:
		labels.append("%s(%d)" % [OS.get_keycode_string(code as Key), code])
	return "[%s]" % ", ".join(labels)


func _on_cursor_cell_changed(_cell: Vector2i) -> void:
	_cursor_moved_seen = true


func _on_selection_changed(_cell: Vector2i) -> void:
	_selection_seen = true


func _on_score_changed(_score: int) -> void:
	_score_changed_seen = true


func _on_moves_changed(_moves: int) -> void:
	_moves_changed_seen = true


func _on_candies_collected(_count: int) -> void:
	_candies_collected_seen = true


func _on_game_ended(outcome: String) -> void:
	if outcome == "win":
		_win_seen = true
	elif outcome == "lose":
		_lose_seen = true


func _on_game_restarted() -> void:
	_restarted_seen = true


func _on_board_shuffled() -> void:
	_shuffled_seen = true


func _on_level_changed(_level: int) -> void:
	_level_changed_seen = true
