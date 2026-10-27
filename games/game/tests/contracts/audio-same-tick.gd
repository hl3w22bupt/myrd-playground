extends Node
## 契约测试：音画同 tick（spec acceptance 条目 ac-audio-tick 的逐 tick 断言落点）。
##
## 运行方式（与 smoke 同构：测试根节点 + 子场景 scenes/main.tscn）：
##   godot --headless --path games/game tests/contracts/audio-same-tick.tscn
##
## 判定协议（与 smoke.gd 一致，便于门禁 grep）：
##   通过 → stdout 打印 `AUDIO_SAME_TICK: PASS ...`，退出码 0
##   失败 → stderr 打印 `AUDIO_SAME_TICK: FAIL <原因>`（逐条一行），退出码 1
##
## 「音画同 tick」的机判口径（spec ac-audio-tick）：
##   交换/消除/胜负音效与对应逻辑结算在同一物理帧内触发 —— 结算栈内信号同步派发，
##   不允许延迟到后续帧或动画结束才出声；消除 FX 与结算同帧入队。
##
## 机判手段（不改一行业务码）：
## - 输入走 Input.parse_input_event + flush_buffered_events（同 smoke，事件同步派发）：
##   整条 Player → Main → Board → GameState → GameAudio 链在注入调用返回前执行完，
##   即全部发生在同一物理帧内；
## - 订阅次序即断言窗口：Main 在自身 _ready 先连接信号（先发声），本测试根节点
##   _ready 后连接（后断言）→ Godot 信号按连接次序同步派发，测试回调执行时
##   「发声是否已发生」就是「是否与结算同 tick」的充要证据；
## - 音效探测用播放池流身份（GameAudio._players[].stream == SFX[事件] && playing），
##   不受短音效残留播放干扰（池轮转，同帧多事件各占一池位）。
##
## 覆盖面（对应 main.gd / board.gd / game_state.gd 的发声点）：
##   A. 有效交换：swap 音 + 消除/连锁音与结算同帧（candies_collected / score_changed
##      帧号相等 + 回调内消除音已在播 + 注入返回后 swap 音已在播）
##   B. 无效交换：invalid 音 + 红闪 + 抖动 FX + 加大字号提示同一回调内同帧触发，
##      不加分不扣步
##   C. 胜利：check_end 判胜信号栈内 win 音已在播
##   D. 失败：check_end 判负信号栈内 lose 音已在播
##   E. 消除 FX 同帧入队：_spawn_collect_fx 与 add_score 在同一波循环体（帧号相等佐证）

const SETTLE_FRAMES: int = 2  # 注入间隔帧数（同 smoke 的 E-08 纪律：≥2 帧且互不重叠）

var _failures: PackedStringArray = []

var _main: Node2D
var _board: Board
var _cursor: Player
var _start_button: Button

## 信号帧号记录（Engine.get_physics_frames，同一物理帧内派发的信号帧号必然相等）。
var _frame_score_changed: int = -1
var _frame_candies_collected: int = -1
## 消除/胜负信号派发时刻的音效状态（连接次序保证 Main 的发声回调先于本测试回调执行）。
var _collect_audio_streams_playing: int = -1
var _ended_audio: Dictionary = {}      # outcome("win"/"lose") → 播放中的对应流数量
var _ended_frame: Dictionary = {}      # outcome → 信号派发时的物理帧号


func _ready() -> void:
	Engine.max_fps = 60
	_locate_nodes()
	if _failures.is_empty():
		_connect_probes()
		await _run_contract()
	_report()


func _locate_nodes() -> void:
	_main = get_tree().root.find_child("Main", true, false) as Node2D
	if _main == null:
		_failures.append("场景树找不到 Main（audio-same-tick.tscn 未实例化 scenes/main.tscn）")
		return
	_board = _main.find_child("Board", true, false) as Board
	_cursor = _main.find_child("Player", true, false) as Player
	_start_button = _main.find_child("StartButton", true, false) as Button
	if _board == null:
		_failures.append("主场景找不到 Board（音画同 tick 无结算可观测）")
	if _cursor == null:
		_failures.append("主场景找不到 Player 光标（无法经真实输入链路触发交换）")
	if _start_button == null:
		_failures.append("主场景找不到 StartButton（无法解锁音频并开局）")


## 探针接线：Main 已在自身 _ready 连接过这些信号（先发声），本测试后连接（后断言）。
func _connect_probes() -> void:
	GameState.score_changed.connect(_on_score_changed)
	_board.candies_collected.connect(_on_candies_collected)
	GameState.game_ended.connect(_on_game_ended)


func _run_contract() -> void:
	await _settle(SETTLE_FRAMES)
	# ---- 准备：首输入解锁音频 + 开始对局（Web 自动播放链路的前置，同 smoke 阶段 1）----
	_tap_control(_start_button)
	await _settle(SETTLE_FRAMES)
	if not GameAudio.unlocked:
		_failures.append("前置失效：注入触摸后 GameAudio.unlocked 仍为假（后续播音全部会被短路）")
		return
	if not GameState.is_playing():
		_failures.append("前置失效：开始按钮点按后对局未进入对局态")
		return

	# ---- A. 有效交换：swap 音 + 消除音与结算同帧 ----
	_lay_board_row0_valid_swap()
	var score_before: int = GameState.score
	var moves_before: int = GameState.moves_left
	_cursor.set_cell(Vector2i.ZERO)
	await _settle(SETTLE_FRAMES)
	_inject_action(&"confirm")  # 选中 (0,0)
	await _settle(SETTLE_FRAMES)
	_inject_action(&"move_right")  # 光标 → (1,0)
	await _settle(SETTLE_FRAMES)
	_frame_score_changed = -1
	_frame_candies_collected = -1
	_inject_action(&"confirm")  # 发起交换：整条结算 + 音效在本调用内同步完成
	# 同 tick 断言（此刻仍是结算所在的那一物理帧）：
	if _frame_score_changed < 0:
		_failures.append("有效交换未产生加分（score_changed 未发出）：结算链路未触发，同 tick 无从谈起")
	if _frame_candies_collected < 0:
		_failures.append("有效交换未产生收集（candies_collected 未发出）：消除结算链路断裂")
	if _frame_score_changed >= 0 and _frame_candies_collected >= 0 \
			and _frame_score_changed != _frame_candies_collected:
		_failures.append("结算跨帧：score_changed(帧 %d) 与 candies_collected(帧 %d) 不在同一物理帧（结算栈被延迟/拆分）" % [
			_frame_score_changed, _frame_candies_collected,
		])
	if _collect_audio_streams_playing < 1:
		_failures.append("消除音未与结算同 tick：candies_collected 派发时刻（帧 %d）播放池内无 match/combo 流在播 —— 发声被延迟到结算栈之外" % _frame_candies_collected)
	if _players_playing(GameAudio.SFX[&"swap"]) < 1:
		_failures.append("交换音未与结算同 tick：交换派发返回时（同帧）播放池内无 swap 流在播 —— main.gd _on_cursor_swap_requested 未在回调栈内播音")
	if GameState.score <= score_before:
		_failures.append("有效交换前置失效：分数未增加（%d → %d），本组断言的结算前提不成立" % [score_before, GameState.score])
	if GameState.moves_left != moves_before - 1:
		_failures.append("有效交换前置失效：步数未消耗（%d → %d）" % [moves_before, GameState.moves_left])

	# ---- B. 无效交换：invalid 音 + 三重视觉反馈同帧，不耗资源 ----
	GameState.start_game()
	_lay_board_deadlock()
	var score_before_invalid: int = GameState.score
	var moves_before_invalid: int = GameState.moves_left
	_cursor.set_cell(Vector2i.ZERO)
	await _settle(SETTLE_FRAMES)
	_inject_action(&"confirm")
	await _settle(SETTLE_FRAMES)
	_inject_action(&"move_right")
	await _settle(SETTLE_FRAMES)
	_inject_action(&"confirm")  # 交错盘上必无效：反馈四连发应在本帧内完成
	if _players_playing(GameAudio.SFX[&"invalid"]) < 1:
		_failures.append("无效交换音未与裁决同 tick：try_swap 返回 false 的同一帧内无 invalid 流在播")
	if _cursor._error_flash_left <= 0.0:
		_failures.append("无效交换红闪缺失：注入返回的同帧 _error_flash_left 已归零（flash_error 未在同回调触发）")
	if _board.invalid_fx_playing_count() != 2:
		_failures.append("无效交换抖动 FX 未与裁决同帧入队：播放中的抖动动画数 = %d（期望 2）" % _board.invalid_fx_playing_count())
	if GameState.score != score_before_invalid or GameState.moves_left != moves_before_invalid:
		_failures.append("无效交换误耗资源：score/moves 在无效裁决同帧被改动（score %d → %d，moves %d → %d）" % [
			score_before_invalid, GameState.score, moves_before_invalid, GameState.moves_left,
		])

	# ---- C. 胜利：判胜信号栈内 win 音已在播 ----
	GameState.start_game()
	GameState.score = GameState.target_score
	GameState.check_end()  # 与 try_swap 结算栈尾的调用同源（game_state.gd check_end）
	if GameState.outcome != GameState.Outcome.WIN:
		_failures.append("胜负前置失效：分数达标后未判胜（outcome=%s）" % GameState.outcome)
	elif int(_ended_audio.get("win", 0)) < 1:
		_failures.append("胜利音未与判定同 tick：game_ended(\"win\") 派发时刻（帧 %d）播放池内无 win 流在播" % int(_ended_frame.get("win", -1)))

	# ---- D. 失败：判负信号栈内 lose 音已在播 ----
	GameState.restart()
	GameState.moves_left = 0
	GameState.check_end()
	if GameState.outcome != GameState.Outcome.LOSE:
		_failures.append("胜负前置失效：步数耗尽后未判负（outcome=%s）" % GameState.outcome)
	elif int(_ended_audio.get("lose", 0)) < 1:
		_failures.append("失败音未与判定同 tick：game_ended(\"lose\") 派发时刻（帧 %d）播放池内无 lose 流在播" % int(_ended_frame.get("lose", -1)))

	# ---- E. 消除 FX 同帧入队 ----
	# _spawn_collect_fx 与 GameState.add_score 在 _resolve_cascades 同一波循环体内先后执行
	#（board.gd 结算循环），帧号证据已由 A 组断言覆盖（score/collect 同帧）；
	# 此处补 FX 队列非空的直接证据：再次制造一次消除后立刻查 FX 队列。
	GameState.start_game()
	_lay_board_row0_valid_swap()
	_board._swap_types(Vector2i.ZERO, Vector2i(1, 0))  # 矩阵内造出第 0 行列 1..3 三连（盘面原无现成三连）
	_board._resolve_cascades()  # 直接走结算管线：消除 → FX 同帧入队 + add_score 同帧
	# FX 队列直读（同 smoke 访问私有成员惯例）：结算返回瞬间队列必须已有粒子与飘分。
	if _board._fx_bursts.size() < 1 or _board._fx_texts.size() < 1:
		_failures.append("消除 FX 未与结算同帧入队：_resolve_cascades 返回后 FX 队列为空（burst=%d text=%d，_spawn_collect_fx 未在结算循环内执行）" % [
			_board._fx_bursts.size(), _board._fx_texts.size(),
		])


# ---- 探针回调（连接次序晚于 Main 的发声回调 → 这里的观测 = 发声之后的世界）----

func _on_score_changed(_score: int) -> void:
	_frame_score_changed = Engine.get_physics_frames()


func _on_candies_collected(_count: int) -> void:
	_frame_candies_collected = Engine.get_physics_frames()
	_collect_audio_streams_playing = _any_streams_playing([
		GameAudio.SFX[&"match"], GameAudio.SFX[&"combo"],
	])


func _on_game_ended(outcome: String) -> void:
	var stream: AudioStream = GameAudio.SFX[&"win"] if outcome == "win" else GameAudio.SFX[&"lose"]
	_ended_frame[outcome] = Engine.get_physics_frames()
	_ended_audio[outcome] = _players_playing(stream)


# ---- 工具（与 smoke.gd 同源：真实输入注入 + 同步冲刷）----

## 播放池中「指定流正在播」的池位数（流身份精确匹配，不受其他短音残留干扰）。
func _players_playing(stream: AudioStream) -> int:
	var count: int = 0
	for player: AudioStreamPlayer in GameAudio._players:
		if player.playing and player.stream == stream:
			count += 1
	return count


## 播放池中「任一候选流正在播」的池位数（消除音：第 1 波 match / 第 2 波起 combo）。
func _any_streams_playing(streams: Array) -> int:
	var count: int = 0
	for player: AudioStreamPlayer in GameAudio._players:
		if player.playing and player.stream in streams:
			count += 1
	return count


## 铺「存在一处必中交换、且无现成三连」的确定性棋盘：
## 第 0 行 = [2,3,2,2,4,4]（无横向 ≥3 连），第 1..5 行 = (x+2y) mod 5 交错盘
##（冒烟阶段 7 已证明该模式行列均无相邻同色）；交换 (0,0)↔(1,0) 后第 0 行变
## [3,2,2,2,4,4] → 列 1..3 成三连。各列纵向均为断续色，无现成三连（手工核对）。
func _lay_board_row0_valid_swap() -> void:
	var row0: Array[int] = [2, 3, 2, 2, 4, 4]
	for x in Board.COLS:
		for y in Board.ROWS:
			_board.types[x][y] = row0[x] if y == 0 else (x + 2 * y) % Board.CANDY_KINDS
	_board._rebuild_candy_nodes()
	if not _board.find_matches().is_empty():
		_failures.append("测试盘构造失效：有效交换盘存在现成三连，交换裁决前提被污染")
		return
	if _board.find_valid_swap().is_empty():
		_failures.append("测试盘构造失效：有效交换盘上找不到可行交换（(0,0)↔(1,0) 应必中）")


## 铺「模 5 交错盘」死局盘（任何相邻交换都无效，同 smoke 阶段 12 的构造）。
func _lay_board_deadlock() -> void:
	for x in Board.COLS:
		for y in Board.ROWS:
			_board.types[x][y] = (x + 2 * y) % Board.CANDY_KINDS
	_board._rebuild_candy_nodes()
	if not _board.find_valid_swap().is_empty():
		_failures.append("测试盘构造失效：交错盘被判存在可行交换，无效交换前提不成立")


func _inject_action(action: StringName) -> void:
	var event := InputEventAction.new()
	event.action = action
	event.pressed = true
	Input.parse_input_event(event)
	Input.flush_buffered_events()


## 模拟真实触摸「点按」控件（走完整触摸→镜像→Button 链路，GameAudio._input 借此解锁）。
func _tap_control(control: Control) -> void:
	var pos: Vector2 = get_viewport().get_final_transform() * control.get_global_rect().get_center()
	for pressed: bool in [true, false]:
		var event := InputEventScreenTouch.new()
		event.index = 0
		event.position = pos
		event.pressed = pressed
		Input.parse_input_event(event)
		Input.flush_buffered_events()


## 等 n 个物理帧（注入间隔纪律：≥2 帧、互不重叠，同 smoke E-08）。
func _settle(frames: int) -> void:
	for i in frames:
		await get_tree().physics_frame


func _report() -> void:
	if _failures.is_empty():
		print("AUDIO_SAME_TICK: PASS 交换音/消除音/胜负音与结算同帧 + 无效交换反馈同帧 + 消除FX同帧入队 全部通过")
		get_tree().quit(0)
	else:
		for failure in _failures:
			printerr("AUDIO_SAME_TICK: FAIL %s" % failure)
		get_tree().quit(1)
