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
##   2. autoload 已注册且带约定信号（moves_changed / level_changed / level_solved / level_unlocked）
##   3. InputMap 动作已注册、物理键绑定正确（键位契约逐键核对，含 undo/Q/E），
##      且注入 move 动作后光标真的移动（物理 + 脚本生效）
##   4. 信号真的到达订阅方（Cursor.moved / GameState.level_solved）
##   5. 核心交互生效：confirm 旋转光标所在管 → 光路接通 → 通关星级 = 3（第 1 关 par=1）
##   6. 胜负可达：第一关按最优解 1 步通关；关卡契约机判全部 10 关「target 朝向必可解」
##      + 难度梯度（par 非递减）+ 光束永不穿透墙体 + 分光三通双路出射
##   7. 重开可用：reset 动作归零步数/朝向/通关态，可再次通关
##   8. 撤销可用：undo 回退步数与朝向、栈清空；通关后撤销被屏蔽
##   9. 解锁推进：通关解锁下一关；未解锁的关 request_level / level_next 一律拒绝
##  10. 多管关卡：第 2 关按最优解 4 步通关得 3 星，最少步数纪录落档
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

## ── 第二阶段（新玩法面）：撤销 / 解锁推进 / 多管关卡通关 / 分光 ──
const UNLOCK_ASSERT_FRAME: int = TOTAL_FRAMES + 1            # 69：通关后第 2 关已解锁、远关仍锁
const GOTO_L2_FRAME: int = UNLOCK_ASSERT_FRAME + 10          # 79：进入第 2 关（解锁推进）
const L2_LOADED_ASSERT_FRAME: int = GOTO_L2_FRAME + 4        # 83：断言第 2 关装载（关卡名/网格/光标落点）
const L2_ROTATE_FRAME: int = L2_LOADED_ASSERT_FRAME + 1      # 84：confirm 旋转第 2 关第一根管
const L2_ROTATE_ASSERT_FRAME: int = L2_ROTATE_FRAME + 4      # 88：断言计步 + 朝向 + 未误判通关
const L2_UNDO_FRAME: int = L2_ROTATE_ASSERT_FRAME + 1        # 89：undo 撤销这一步
const L2_UNDO_ASSERT_FRAME: int = L2_UNDO_FRAME + 4          # 93：断言步数与朝向回退、栈清空
const L2_SOLVE_FRAME: int = L2_UNDO_ASSERT_FRAME + 1         # 94：按最优解 4 步转完三根管
const L2_SOLVE_ASSERT_FRAME: int = L2_SOLVE_FRAME + 6        # 100：断言通关 3 星 + 解锁第 3 关
const L2_UNDO_BLOCKED_FRAME: int = L2_SOLVE_ASSERT_FRAME + 1 # 101：通关后按 undo 应被屏蔽
const L2_UNDO_BLOCKED_ASSERT: int = L2_UNDO_BLOCKED_FRAME + 4  # 105：断言步数/通关态未被改动
const L3_NAV_FRAME: int = L2_UNDO_BLOCKED_ASSERT + 1         # 106：level_next 进入第 3 关
const L3_NAV_ASSERT_FRAME: int = L3_NAV_FRAME + 4            # 110：断言切关生效（关卡/网格/解锁面）
const L3_LOCKED_FRAME: int = L3_NAV_ASSERT_FRAME + 1         # 111：level_next 越过未解锁关应被拒
const L3_LOCKED_ASSERT_FRAME: int = L3_LOCKED_FRAME + 4      # 115：断言仍停在第 3 关
const FINAL_FRAME: int = L3_LOCKED_ASSERT_FRAME + 1          # 116：全部断言完成 → 报告

const REQUIRED_ACTIONS: Array[StringName] = [
	&"move_left", &"move_right", &"move_up", &"move_down",
	&"confirm", &"reset", &"undo", &"level_prev", &"level_next",
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
	&"undo": [KEY_Z],
	&"level_prev": [KEY_Q],
	&"level_next": [KEY_E],
}

## 首发关卡数下限（需求 §关卡：首发至少 10 关）。
const MIN_LEVEL_COUNT: int = 10

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
	# 密封开局：清掉本机历史存档（解锁面/星级），保证「锁着的关拒绝进入」等断言可复现。
	GameState.reset_progress()
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
## 每关「全部管子转到 target_rot 必可解」「初始朝向必未通关」「par 与朝向数据一致」，
## 另加：首发关卡数下限、难度梯度（par 非递减）、分光件存在、光束永不穿透墙体。
func _level_contract_assertions() -> void:
	if LevelSet.count() < MIN_LEVEL_COUNT:
		_failures.append("关卡契约：首发仅 %d 关，低于需求下限 %d 关" % [LevelSet.count(), MIN_LEVEL_COUNT])
	var has_tee: bool = false
	var previous_par: int = 0
	for index: int in range(LevelSet.count()):
		var level: Dictionary = LevelSet.level_at(index)
		var cells_solved: Dictionary = LevelSet.build_cells(level, true)
		var result_solved: Dictionary = PuzzleLogic.propagate(
			cells_solved, level["source_cell"], level["source_dir"], level["sink_open"])
		if not result_solved["solved"]:
			_failures.append("关卡契约：第 %d 关全部管子转到 target_rot 后光路未接通（关卡无解）" % [index + 1])
		_assert_no_wall_penetration(cells_solved, result_solved, index, "target 朝向")
		var cells_initial: Dictionary = LevelSet.build_cells(level, false)
		var result_initial: Dictionary = PuzzleLogic.propagate(
			cells_initial, level["source_cell"], level["source_dir"], level["sink_open"])
		if result_initial["solved"]:
			_failures.append("关卡契约：第 %d 关初始朝向已通关（初始状态设计错误）" % [index + 1])
		_assert_no_wall_penetration(cells_initial, result_initial, index, "初始朝向")
		var par: int = LevelSet.par_of(level)
		if par <= 0:
			_failures.append("关卡契约：第 %d 关最优解步数 par=%d 非正（数据漂移）" % [index + 1, par])
		if par < previous_par:
			_failures.append("关卡契约：第 %d 关 par=%d 小于第 %d 关 par=%d（难度不递进）" % [
				index + 1, par, index, previous_par,
			])
		previous_par = par
		for pipe: Dictionary in level["pipes"]:
			if pipe["type"] == PuzzleLogic.TYPE_TEE:
				has_tee = true
		if index == 0 and par != 1:
			_failures.append("关卡契约：第 1 关 par=%d，冒烟依赖「1 步最优解」断言 3 星" % par)
	if not has_tee:
		_failures.append("关卡契约：全部关卡都没有分光三通（tee）——分光玩法面缺失")
	_tee_split_assertion()


## 光束不穿透实体：任何光束端点都不得落在墙体内部（停在元件表面的边界点不算）。
func _assert_no_wall_penetration(cells: Dictionary, result: Dictionary, index: int, state: String) -> void:
	for segment: Array in result["segments"]:
		for point: Vector2 in [segment[0], segment[1]]:
			var cell := Vector2i(floori(point.x), floori(point.y))
			if not cells.has(cell) or cells[cell]["type"] != PuzzleLogic.TYPE_WALL:
				continue
			var edge_distance: float = minf(
				minf(point.x - float(cell.x), float(cell.x) + 1.0 - point.x),
				minf(point.y - float(cell.y), float(cell.y) + 1.0 - point.y))
			if edge_distance > 0.01:
				_failures.append("关卡契约：第 %d 关（%s）光束端点 %s 深入墙体 %s 内部（穿透实体）" % [
					index + 1, state, point, cell,
				])


## 分光契约（合成棋盘，纯逻辑）：光进三通后必须同时出射「转向 + 直行」两路。
func _tee_split_assertion() -> void:
	var cells: Dictionary = {}
	for y: int in range(3):
		for x: int in range(4):
			cells[Vector2i(x, y)] = {"type": PuzzleLogic.TYPE_EMPTY, "rot": 0}
	cells[Vector2i(0, 1)] = {"type": PuzzleLogic.TYPE_SOURCE, "rot": 0}
	# tee rot=3 → 开口 {左, 上, 右}：光从左进，出上 + 右（直行）两路。
	cells[Vector2i(1, 1)] = {"type": PuzzleLogic.TYPE_TEE, "rot": 3}
	cells[Vector2i(2, 1)] = {"type": PuzzleLogic.TYPE_WALL, "rot": 0}
	var result: Dictionary = PuzzleLogic.propagate(cells, Vector2i(0, 1), PuzzleLogic.DIR_RIGHT, 3)
	if PuzzleLogic.openings_for(PuzzleLogic.TYPE_TEE, 0).size() != 3:
		_failures.append("分光契约：tee rot=0 应有 3 个开口（透射 + 反射双路），实际不符")
	# 光被挡/断口时停在元件表面（格边界上），floori 归格会把它归给相邻格，
	# 所以这里直接断言两路出射的精确停点：上路停在三通上方格的下边界，右路停在墙的左边界。
	var endpoints: Array[Vector2] = []
	for segment: Array in result["segments"]:
		for point: Vector2 in [segment[0], segment[1]]:
			endpoints.append(point)
	for expected_stop: Vector2 in [Vector2(1.5, 1.0), Vector2(2.0, 1.5)]:
		if not (expected_stop in endpoints):
			_failures.append("分光契约：光进入三通后未在 %s 出射（分光双路失效或被误挡）" % expected_stop)


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
		elif _frames == UNLOCK_ASSERT_FRAME:
			_assert_unlock_gating()
		elif _frames == GOTO_L2_FRAME:
			_goto_level(1)
		elif _frames == L2_LOADED_ASSERT_FRAME:
			_assert_level_loaded(1)
		elif _frames == L2_ROTATE_FRAME:
			_press_action(&"confirm")
		elif _frames == L2_ROTATE_ASSERT_FRAME:
			_assert_l2_rotated()
		elif _frames == L2_UNDO_FRAME:
			_press_action(&"undo")
		elif _frames == L2_UNDO_ASSERT_FRAME:
			_assert_l2_undone()
		elif _frames == L2_SOLVE_FRAME:
			_drive_l2_optimal_solve()
		elif _frames == L2_SOLVE_ASSERT_FRAME:
			_assert_l2_solved()
		elif _frames == L2_UNDO_BLOCKED_FRAME:
			_press_action(&"undo")
		elif _frames == L2_UNDO_BLOCKED_ASSERT:
			_assert_undo_blocked_after_solve()
		elif _frames == L3_NAV_FRAME:
			_press_action(&"level_next")
		elif _frames == L3_NAV_ASSERT_FRAME:
			_assert_level_loaded(2)
		elif _frames == L3_LOCKED_FRAME:
			_press_action(&"level_next")
		elif _frames == L3_LOCKED_ASSERT_FRAME:
			_assert_locked_nav_refused()

	if _frames >= FINAL_FRAME or not _failures.is_empty():
		_finished = true
		_report()


## 清掉噪声相位对开局的污染：强制回到第 1 关，并断言干净开局状态。
func _clean_start() -> void:
	_moved_seen = false
	_solved_seen = false
	GameState.start_level(0)
	if GameState.level_index != 0:
		_failures.append("开局断言：噪声后未能回到第 1 关（level_index=%d）" % GameState.level_index)
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


## ── 第二阶段：解锁门禁 / 撤销 / 多管关卡通关 ──

## 解锁门禁：通关第 1 关后第 2 关必须已解锁，且未通关的最后一关仍被拒。
func _assert_unlock_gating() -> void:
	if GameState.unlocked_max < 1:
		_failures.append("解锁断言：通关第 1 关后 unlocked_max=%d，未解锁下一关" % GameState.unlocked_max)
	if GameState.request_level(LevelSet.count() - 1):
		_failures.append("解锁断言：未通关的最后一关竟能直接进入（解锁门禁失效）")
		GameState.start_level(0)
	if GameState.level_index != 0:
		_failures.append("解锁断言：拒绝进入锁关后关卡下标漂移到 %d" % GameState.level_index)


## 进入指定关卡（已解锁路径）。
func _goto_level(index: int) -> void:
	if not GameState.request_level(index):
		_failures.append("解锁断言：第 %d 关应已解锁，request_level 却被拒" % (index + 1))


## 切关断言：关卡下标、棋盘关卡名、网格尺寸、光标落点、首管朝向全部对齐关卡数据。
func _assert_level_loaded(expect_index: int) -> void:
	var level: Dictionary = LevelSet.level_at(expect_index)
	if GameState.level_index != expect_index:
		_failures.append("切关断言：level_index=%d，期望 %d" % [GameState.level_index, expect_index])
	if _board.level.get("name", "") != level["name"]:
		_failures.append("切关断言：棋盘装载的是「%s」，期望「%s」（level_changed 未驱动换关）" % [
			_board.level.get("name", ""), level["name"],
		])
	var expected_grid := Vector2i(int(level["w"]), int(level["h"]))
	if _board.grid_size != expected_grid:
		_failures.append("切关断言：第 %d 关网格 %s 与关卡数据 %s 不一致（棋盘未按关卡重排）" % [
			expect_index + 1, _board.grid_size, expected_grid,
		])
	var first_pipe: Dictionary = level["pipes"][0]
	if _cursor.grid_pos != first_pipe["cell"]:
		_failures.append("切关断言：光标未归位到第一根管 %s（实际 %s）" % [first_pipe["cell"], _cursor.grid_pos])
	if _board.rots.get(first_pipe["cell"], -1) != int(first_pipe["init_rot"]):
		_failures.append("切关断言：第 %d 关首管朝向不是 init_rot（换关未重置棋盘）" % [expect_index + 1])


## 第 2 关旋转断言：confirm 真的转了首管并计步，且未误判通关（第 2 关需 3 根管全接通）。
func _assert_l2_rotated() -> void:
	var first_pipe: Dictionary = LevelSet.level_at(1)["pipes"][0]
	var expected_rot: int = PuzzleLogic.rotated_clockwise(int(first_pipe["init_rot"]))
	if GameState.moves != 1:
		_failures.append("旋转断言（第 2 关）：步数 %d != 1（confirm 旋转未计步）" % GameState.moves)
	if _board.rots.get(first_pipe["cell"], -1) != expected_rot:
		_failures.append("旋转断言（第 2 关）：首管朝向 %s != %s（旋转未生效）" % [
			_board.rots.get(first_pipe["cell"], -1), expected_rot,
		])
	if GameState.solved:
		_failures.append("旋转断言（第 2 关）：只转一根管就通关（光路判定失真）")


## 撤销断言：undo 后步数回退、朝向还原、撤销栈清空、通关态不受污染。
func _assert_l2_undone() -> void:
	var first_pipe: Dictionary = LevelSet.level_at(1)["pipes"][0]
	if GameState.moves != 0:
		_failures.append("撤销断言：undo 后步数 %d != 0（撤销未回退计步）" % GameState.moves)
	if _board.rots.get(first_pipe["cell"], -1) != int(first_pipe["init_rot"]):
		_failures.append("撤销断言：undo 后首管朝向未还原为 init_rot（撤销不完整）")
	if _board.can_undo():
		_failures.append("撤销断言：undo 后撤销栈仍非空（历史栈泄漏）")
	if GameState.solved:
		_failures.append("撤销断言：undo 后 solved 仍为 true")


## 以最优解（第 2 关 par=1+2+1=4 步）驱动通关：多管关卡的可通关性 + 星级规则复验。
func _drive_l2_optimal_solve() -> void:
	var level: Dictionary = LevelSet.level_at(1)
	for pipe: Dictionary in level["pipes"]:
		var clicks: int = PuzzleLogic.clicks_between(int(pipe["init_rot"]), int(pipe["target_rot"]))
		for click: int in range(clicks):
			if _board.rotate_at(pipe["cell"]):
				GameState.register_rotation(_board.current_cells(), _board.level)


## 第 2 关通关断言：最优解通关得 3 星、光束接通、第 3 关随之解锁、最少步数已记录。
func _assert_l2_solved() -> void:
	var par: int = LevelSet.par_of(LevelSet.level_at(1))
	if not GameState.solved:
		_failures.append("通关断言（第 2 关）：按最优解 %d 步旋转后未通关" % par)
		return
	if GameState.moves != par:
		_failures.append("通关断言（第 2 关）：步数 %d != 最优解 %d（计步与旋转次数不一致）" % [
			GameState.moves, par,
		])
	if _solved_stars != 3:
		_failures.append("星级断言（第 2 关）：最优解通关应得 3 星，实际 %d 星" % _solved_stars)
	if not _board.beam.get("solved", false):
		_failures.append("光束断言（第 2 关）：通关后 beam.solved 仍为 false")
	if GameState.unlocked_max < 2:
		_failures.append("解锁断言（第 2 关）：通关后 unlocked_max=%d，未解锁第 3 关" % GameState.unlocked_max)
	if int(GameState.best_moves.get(1, 0)) != par:
		_failures.append("纪录断言（第 2 关）：最少步数纪录 %s != %s（未记录最佳成绩）" % [
			GameState.best_moves.get(1, 0), par,
		])


## 通关后 undo 必须被屏蔽：步数与通关态都不能被撤销改动。
func _assert_undo_blocked_after_solve() -> void:
	if not GameState.solved:
		_failures.append("撤销屏蔽断言：进入本断言时 solved 已为 false（状态漂移）")
		return
	if GameState.moves == 0:
		_failures.append("撤销屏蔽断言：通关后按 undo 把步数撤成 0（通关态下撤销未屏蔽）")


## 越过未解锁关的导航必须被拒：仍停在第 3 关。
func _assert_locked_nav_refused() -> void:
	if GameState.level_index != 2:
		_failures.append("锁关导航断言：level_index=%d，期望仍停在第 3 关（解锁门禁未拦住 level_next）" % [
			GameState.level_index + 1,
		])


func _report() -> void:
	if _failures.is_empty():
		print("GODOT_SMOKE: PASS 场景实例化/autoload/键位契约/光标移动/旋转交互/通关星级/重开复玩/撤销/解锁门禁/多管通关/分光双路/不穿透墙体 全部通过")
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
