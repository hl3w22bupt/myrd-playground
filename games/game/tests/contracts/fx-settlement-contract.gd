extends Node
## 契约测试：消除/连击反馈 + 结算三态 + 分数本地持久化（M1 打回项 阻塞#1/#2/#3 的机判落点）。
##
## 运行方式（与 smoke / audio-same-tick 同构：测试根节点 + 子场景 scenes/main.tscn）：
##   godot --headless --path games/game tests/contracts/fx-settlement-contract.tscn
##
## 判定协议（门禁 grep 口径一致）：
##   通过 → stdout `FX_SETTLE_PERSIST: PASS ...`，退出码 0
##   失败 → stderr `FX_SETTLE_PERSIST: FAIL <原因>`（逐条一行），退出码 1
##
## 覆盖面与机判手段：
##   A. 消除反馈同帧：真实交换结算返回瞬间 —— FX 队列非空（burst+text）+ 屏震已触发
##      （main._shake_amp > 0）+ 消除/连锁音已在播放池（流身份匹配，同 audio-same-tick 口径）。
##   B. 连击规则：以真实管线同款的触发函数核对阈值/幅度/文案 —— 波数 1 不出连击提示、
##      波数 ≥COMBO_MSG_MIN_WAVE 出「COMBO x%波数」且字号=COMBO_MSG_FONT_SIZE；
##      屏震幅度 = 基础 + 每波增量 ×(波数-1)，超上限封顶。
##   C. 屏震有界归零：触发后等待 SHAKE_DECAY_SEC 的 2 倍时长，棋盘位置精确回到布局基准
##      （反馈会结束、不留永久偏移 —— 「帧率不掉」的结构面证据；帧成本采样见 F）。
##   D. 分数本地持久化（阻塞#3）：真实对局加分后 —— 存档文件存在且 run 快照与内存状态逐字段
##      一致（模拟「刷新」= 重新从磁盘读档）；best_score 跨局保留；新开局清快照。
##   E. 结算三态（阻塞#1，占位 UI）：WIN →「下一关 NEXT」；LOSE →「再来一局 RETRY」；
##      RESUME → 存档存在时开始遮罩转「继续游戏 CONTINUE + 新的一局 NEW GAME」双入口，
##      点继续后分数/关卡/步数与快照一致（局末断链接线完成；UI 稿待美术，台账标「占位」）。
##   F. 帧成本采样（阻塞#2 的「帧率不掉」机判面）：连续消除负载下逐帧采样，
##      平均帧率与最差帧给机判阈值（桌面口径；真机曲线归 spike/真机复验，见黑板）。
##
## 纪律：测试内一律先 SaveState.wipe() 再构造状态（user:// 跨进程持久，禁止吃上次会话残留）。

const SETTLE_FRAMES: int = 2  ## 注入间隔帧数（≥2 且互不重叠，同 smoke E-08 纪律）
## F 组采样参数：负载段数 × 每段帧数；每段做一次真实消除（走完整结算 + FX + 屏震）。
const LOAD_SEGMENTS: int = 8
const SEGMENT_FRAMES: int = 40
## F 组机判阈值（headless 桌面口径，宽松下限；真机阈值归 spike/真机复验）。
const MIN_AVG_FPS: float = 50.0
const MIN_WORST_FPS: float = 30.0

var _failures: PackedStringArray = []

var _main: Node2D
var _board: Board
var _cursor: Player
var _start_button: Button
var _new_game_button: Button
var _overlay: ColorRect
var _overlay_action_button: Button
var _start_overlay: ColorRect


func _ready() -> void:
	Engine.max_fps = 60
	SaveState.wipe()
	_locate_nodes()
	if _failures.is_empty():
		await _run_contract()
	_report()


func _locate_nodes() -> void:
	_main = get_tree().root.find_child("Main", true, false) as Node2D
	if _main == null:
		_failures.append("场景树找不到 Main（fx-settlement-contract.tscn 未实例化 scenes/main.tscn）")
		return
	_board = _main.find_child("Board", true, false) as Board
	_cursor = _main.find_child("Player", true, false) as Player
	_start_button = _main.find_child("StartButton", true, false) as Button
	_new_game_button = _main.find_child("NewGameButton", true, false) as Button
	_overlay = _main.find_child("Overlay", true, false) as ColorRect
	_overlay_action_button = _main.find_child("OverlayActionButton", true, false) as Button
	_start_overlay = _main.find_child("StartOverlay", true, false) as ColorRect
	if _board == null:
		_failures.append("主场景找不到 Board（反馈/持久化断言无结算可观测）")
	if _cursor == null:
		_failures.append("主场景找不到 Player 光标（无法经真实输入链路触发交换）")
	if _start_overlay == null:
		_failures.append("主场景找不到 StartOverlay（RESUME 三态占位载体缺失）")
	if _start_button == null or _new_game_button == null:
		_failures.append("主场景找不到 StartButton/NewGameButton（RESUME 三态占位入口缺失）")


func _run_contract() -> void:
	await _settle(SETTLE_FRAMES)
	# ---- 前置：开始全新对局（存档已在 _ready 擦除 → 必为全新开局路径）----
	_tap_control(_start_button)
	await _settle(SETTLE_FRAMES)
	if not GameState.is_playing():
		_failures.append("前置失效：开始按钮点按后对局未进入对局态")
		return
	if GameState.moves_left != GameState.moves_for_level(1):
		_failures.append("前置失效：擦档后「开始」未落入全新开局（moves_left=%d，疑似残留续玩档）" % GameState.moves_left)
		return

	# ---- A. 消除反馈同帧（真实交换 → 真实第 1 波结算）----
	_lay_board_row0_valid_swap()
	var score_before: int = GameState.score
	_cursor.set_cell(Vector2i.ZERO)
	await _settle(SETTLE_FRAMES)
	_inject_action(&"confirm")
	await _settle(SETTLE_FRAMES)
	_inject_action(&"move_right")
	await _settle(SETTLE_FRAMES)
	_inject_action(&"confirm")  # 整条结算 + 反馈在本调用内同步完成
	if GameState.score <= score_before:
		_failures.append("A 前提失效：有效交换未加分（%d → %d），本组反馈断言前提不成立" % [score_before, GameState.score])
	if _board._fx_bursts.size() < 1 or _board._fx_texts.size() < 1:
		_failures.append("A 消除 FX 未与结算同帧入队：结算返回后 burst=%d text=%d" % [
			_board._fx_bursts.size(), _board._fx_texts.size(),
		])
	if float(_main.get("_shake_amp")) <= 0.0:
		_failures.append("A 屏震未与结算同帧触发：消除后 _shake_amp=%.2f（main._trigger_elimination_shake 未在信号回调内执行）" % float(_main.get("_shake_amp")))
	if _any_streams_playing([GameAudio.SFX[&"match"], GameAudio.SFX[&"combo"]]) < 1:
		_failures.append("A 消除音缺失：结算同帧播放池内无 match/combo 流在播")

	# ---- B. 连击规则（阈值 / 幅度公式 / 文案与字号）----
	_flash_combo_probe(1, false)
	_flash_combo_probe(_main.get("COMBO_MSG_MIN_WAVE"), true)
	_shake_amplitude_probe()

	# ---- C. 屏震有界归零 ----
	_main.call("_trigger_elimination_shake", 3)
	await _settle(2)
	if float(_main.get("_shake_amp")) <= 0.0:
		_failures.append("C 屏震触发失效：_trigger_elimination_shake(3) 后 _shake_amp=0（反馈没有产生）")
	var base: Vector2 = _main.get("_board_base")
	var wait_frames: int = int(ceil(_main.get("SHAKE_DECAY_SEC") * 2.0 * 60.0))
	for i in wait_frames:
		await get_tree().physics_frame
	if float(_main.get("_shake_amp")) != 0.0:
		_failures.append("C 屏震未归零：等待 %d 帧后 _shake_amp=%.2f（衰减期超过 SHAKE_DECAY_SEC 的 2 倍）" % [wait_frames, float(_main.get("_shake_amp"))])
	if _board.position != base:
		_failures.append("C 屏震归零后棋盘未精确复位：position=%s 基准=%s（存在永久偏移，布局断言会被污染）" % [_board.position, base])

	# ---- D. 分数本地持久化（阻塞#3：刷新后分数仍在）----
	# 对局中真实加分（上面 A 组的交换已落档）；「刷新」的机判等价物 = 从磁盘重新读档比对。
	SaveState.record_progress(GameState.level, GameState.score, GameState.moves_left, GameState.target_score)
	if not FileAccess.file_exists(SaveState.SAVE_PATH):
		_failures.append("D 存档文件缺失：record_progress 后 %s 不存在（持久化写盘未生效）" % SaveState.SAVE_PATH)
	else:
		var file := FileAccess.open(SaveState.SAVE_PATH, FileAccess.READ)
		var parsed: Variant = JSON.parse_string(file.get_as_text())
		file.close()
		if typeof(parsed) != TYPE_DICTIONARY:
			_failures.append("D 存档损坏：JSON 解析失败（刷新后无可恢复内容）")
		else:
			var run: Variant = (parsed as Dictionary).get("run", {})
			if typeof(run) != TYPE_DICTIONARY:
				_failures.append("D 存档缺 run 快照：刷新后将无局可续（阻塞#3 未闭环）")
			elif int((run as Dictionary).get("score", -1)) != GameState.score \
					or int((run as Dictionary).get("level", -1)) != GameState.level:
				_failures.append("D 存档与内存不一致：盘上 score=%s level=%s，内存 score=%d level=%d（刷新会丢进度）" % [
					str((run as Dictionary).get("score")), str((run as Dictionary).get("level")), GameState.score, GameState.level,
				])
	# best_score 跨局保留：制造一次结算（win）→ 新开局 → best_score 不得回零。
	GameState.score = GameState.target_score
	GameState.check_end()
	if SaveState.best_score < GameState.score:
		_failures.append("D best_score 未刷新：结算分 %d > best_score %d" % [GameState.score, SaveState.best_score])
	var best_before: int = SaveState.best_score
	GameState.start_game()
	if SaveState.best_score != best_before:
		_failures.append("D best_score 被新开局清掉：%d → %d（历史成绩必须跨局保留）" % [best_before, SaveState.best_score])
	if not SaveState.run_snapshot.is_empty():
		_failures.append("D 新开局未清续玩快照：run_snapshot 仍非空（会把旧局误供为可续局）")

	# ---- E. 结算三态（占位 UI）：WIN / LOSE / RESUME ----
	# E-WIN：遮罩文案 + 动作按钮（占位文案常量，主策划口径）。
	GameState.score = GameState.target_score
	GameState.check_end()
	await _settle(SETTLE_FRAMES)
	if not _overlay.visible:
		_failures.append("E 胜利态遮罩未弹出（结算三态之 WIN 断链）")
	if _overlay_action_button.text != _main.get("BTN_NEXT"):
		_failures.append("E 胜利态动作按钮错误：text=%s（期望 %s）" % [_overlay_action_button.text, _main.get("BTN_NEXT")])
	# E-LOSE：步尽判负 → RETRY。
	GameState.restart()
	GameState.moves_left = 0
	GameState.check_end()
	await _settle(SETTLE_FRAMES)
	if _overlay_action_button.text != _main.get("BTN_RETRY"):
		_failures.append("E 失败态动作按钮错误：text=%s（期望 %s）" % [_overlay_action_button.text, _main.get("BTN_RETRY")])
	# E-RESUME：造一份进度档 → 重探测 → 开始遮罩必须转「继续 + 新开」双入口 → 点继续恢复数值。
	GameState.restart()
	await _settle(SETTLE_FRAMES)
	GameState.score = 240
	GameState.use_move()
	GameState.use_move()
	SaveState.record_progress(GameState.level, GameState.score, GameState.moves_left, GameState.target_score)
	var snapshot: Dictionary = SaveState.run_snapshot.duplicate(true)
	if snapshot.is_empty():
		_failures.append("E 前提失效：record_progress 后快照为空，RESUME 断言无从做起")
	else:
		_main.call("setup_resume_offer")
		if _start_button.text != _main.get("BTN_CONTINUE"):
			_failures.append("E 续玩态主按钮错误：text=%s（期望 %s）" % [_start_button.text, _main.get("BTN_CONTINUE")])
		if not _new_game_button.visible:
			_failures.append("E 续玩态缺「新的一局」入口：NewGameButton 不可见（继续/新开双通道断裂）")
		_start_overlay.visible = true
		_tap_control(_start_button)
		await _settle(SETTLE_FRAMES)
		if GameState.score != int(snapshot.get("score", -1)) \
				or GameState.moves_left != int(snapshot.get("moves_left", -1)) \
				or GameState.level != int(snapshot.get("level", -1)):
			_failures.append("E 继续游戏未恢复进度：score %d→%d moves %d→%d level %d→%d（局末断链未接上）" % [
				int(snapshot.get("score")), GameState.score,
				int(snapshot.get("moves_left")), GameState.moves_left,
				int(snapshot.get("level")), GameState.level,
			])
	# E-NEW：显式放弃续玩 → 全新开局。
	SaveState.record_progress(2, 100, 10, 900)
	_main.call("setup_resume_offer")
	_start_overlay.visible = true  # 重开遮罩供触摸注入（真实启动时本就处于显示态）
	_tap_control(_new_game_button)
	await _settle(SETTLE_FRAMES)
	if GameState.level != 1 or GameState.score != 0:
		_failures.append("E 新的一局未回全新开局：level=%d score=%d（放弃续玩路径断裂）" % [GameState.level, GameState.score])

	# ---- F. 帧成本采样（连续消除负载下的桌面口径机判）----
	var worst_ms: float = 0.0
	var sum_ms: float = 0.0
	var sampled: int = 0
	var warmup_worst_ms: float = 0.0
	var last_us: int = Time.get_ticks_usec()
	for segment in LOAD_SEGMENTS:
		GameState.restart()
		await _settle(2)
		_lay_board_row0_valid_swap()
		_board._swap_types(Vector2i.ZERO, Vector2i(1, 0))
		_board._resolve_cascades()  # 真实结算 + FX + 屏震同帧入队（消除反馈满载）
		for i in SEGMENT_FRAMES:
			await get_tree().process_frame
			var now_us: int = Time.get_ticks_usec()
			var frame_ms: float = float(now_us - last_us) / 1000.0
			last_us = now_us
			if i == 0:
				# 每段首帧吃进「重开重建 36 节点 + 结算尾帧」的一次性 hitch，
				# 与消除/连击反馈的稳态成本无关 → 单独计量，不进稳态最差帧。
				warmup_worst_ms = maxf(warmup_worst_ms, frame_ms)
				continue
			sum_ms += frame_ms
			sampled += 1
			worst_ms = maxf(worst_ms, frame_ms)
	var avg_fps: float = 1000.0 / maxf(sum_ms / float(maxi(sampled, 1)), 0.001)
	var worst_fps: float = 1000.0 / maxf(worst_ms, 0.001)
	print("FX_SETTLE_PERSIST: PERF sampled=%d avg_fps=%.1f(阈值>=%.0f) steady_worst_fps=%.1f(阈值>=%.0f) rebuild_hitch_ms=%.1f(计量不上限)" % [
		sampled, avg_fps, MIN_AVG_FPS, worst_fps, MIN_WORST_FPS, warmup_worst_ms,
	])
	if avg_fps < MIN_AVG_FPS:
		_failures.append("F 平均帧率不达标：%.1f < %.0f（消除/连击反馈把帧率拉穿下限）" % [avg_fps, MIN_AVG_FPS])
	if worst_fps < MIN_WORST_FPS:
		_failures.append("F 稳态最差帧不达标：%.1f < %.0f（存在反馈引起的长帧；重建 hitch %.1fms 已单列）" % [worst_fps, MIN_WORST_FPS, warmup_worst_ms])
	if _board.candies_root.get_child_count() != Board.COLS * Board.ROWS:
		_failures.append("F 糖果节点数泄漏：load 后 child_count=%d（期望 %d，反馈层不得增删棋子节点）" % [
			_board.candies_root.get_child_count(), Board.COLS * Board.ROWS,
		])


# ---- B 组探针（对真实管线同款函数做阈值/公式断言，不伪造波次来源）----

## 连击提示规则：波数 < COMBO_MSG_MIN_WAVE 不得出提示；达标波数必须出「COMBO x 波数」
## 且字号 = COMBO_MSG_FONT_SIZE。走真实信号回调 _on_board_candies_collected
##（阈值守卫在 handler 里，直接调显示函数会绕过它 —— 首轮实跑 FAIL 的教训）。
func _flash_combo_probe(wave: int, should_show: bool) -> void:
	_settle_sync()
	_board.last_wave_count = wave  # 真实管线中该值由结算波循环写定，这里按场景注入
	_main.call("_on_board_candies_collected", 0)
	var text: String = str(_main.get("hud_message").text)
	if should_show:
		if text != (_main.get("COMBO_MSG_TEXT") as String) % wave:
			_failures.append("B 连击提示文案错误：wave=%d text=%s（期望 %s）" % [wave, text, (_main.get("COMBO_MSG_TEXT") as String) % wave])
		var font_size: int = int(_main.get("hud_message").get_theme_font_size("font_size"))
		if font_size != _main.get("COMBO_MSG_FONT_SIZE"):
			_failures.append("B 连击提示字号错误：wave=%d font_size=%d（期望 %d，反馈可读性不达标）" % [
				wave, font_size, _main.get("COMBO_MSG_FONT_SIZE"),
			])
	elif text != "":
		_failures.append("B 连击阈值失效：wave=%d（< COMBO_MSG_MIN_WAVE）不应出提示，实际 text=%s" % [wave, text])


## 屏震幅度公式：amp = base + per_wave×(wave-1)，超过上限封顶。
func _shake_amplitude_probe() -> void:
	_settle_sync()
	_main.call("_trigger_elimination_shake", 1)
	var amp1: float = float(_main.get("_shake_amp"))
	if absf(amp1 - _main.get("SHAKE_AMP_BASE_PX")) > 0.001:
		_failures.append("B 屏震基础幅度错误：wave=1 amp=%.2f（期望 %.2f）" % [amp1, _main.get("SHAKE_AMP_BASE_PX")])
	_settle_sync()
	_main.call("_trigger_elimination_shake", 99)
	var amp99: float = float(_main.get("_shake_amp"))
	if absf(amp99 - _main.get("SHAKE_AMP_MAX_PX")) > 0.001:
		_failures.append("B 屏震上限封顶失效：wave=99 amp=%.2f（期望封顶 %.2f，高连锁会震失控）" % [amp99, _main.get("SHAKE_AMP_MAX_PX")])


## 立即清一次屏震与 HUD（B 组探针互不污染）。
func _settle_sync() -> void:
	_main.set("_shake_amp", 0.0)
	_main.set("_shake_amp0", 0.0)
	_main.set("_shake_phase", 0.0)
	_board.position = _main.get("_board_base")
	_main.call("_set_hud_message", "")


# ---- 工具（与 smoke.gd / audio-same-tick.gd 同源：真实输入注入 + 同步冲刷）----

## 播放池中「任一候选流正在播」的池位数。
func _any_streams_playing(streams: Array) -> int:
	var count: int = 0
	for player: AudioStreamPlayer in GameAudio._players:
		if player.playing and player.stream in streams:
			count += 1
	return count


## 铺「存在一处必中交换、且无现成三连」的确定性棋盘（同 audio-same-tick 的构造）：
## 第 0 行 = [2,3,2,2,4,4]，第 1..5 行 = (x+2y) mod 5 交错盘；交换 (0,0)↔(1,0) 必中列 1..3 三连。
func _lay_board_row0_valid_swap() -> void:
	var row0: Array[int] = [2, 3, 2, 2, 4, 4]
	for x in Board.COLS:
		for y in Board.ROWS:
			_board.types[x][y] = row0[x] if y == 0 else (x + 2 * y) % Board.CANDY_KINDS
	_board._rebuild_candy_nodes()
	if not _board.find_matches().is_empty():
		_failures.append("测试盘构造失效：有效交换盘存在现成三连，交换裁决前提被污染")


func _inject_action(action: StringName) -> void:
	var event := InputEventAction.new()
	event.action = action
	event.pressed = true
	Input.parse_input_event(event)
	Input.flush_buffered_events()


## 模拟真实触摸「点按」控件（走完整触摸→Button 链路，GameAudio._input 借此解锁）。
func _tap_control(control: Control) -> void:
	var pos: Vector2 = get_viewport().get_final_transform() * control.get_global_rect().get_center()
	for pressed: bool in [true, false]:
		var event := InputEventScreenTouch.new()
		event.index = 0
		event.position = pos
		event.pressed = pressed
		Input.parse_input_event(event)
		Input.flush_buffered_events()


## 等 n 个物理帧（注入间隔纪律：≥2 帧、互不重叠）。
func _settle(frames: int) -> void:
	for i in frames:
		await get_tree().physics_frame


func _report() -> void:
	if _failures.is_empty():
		print("FX_SETTLE_PERSIST: PASS 消除反馈同帧 + 连击阈值/封顶 + 屏震有界归零 + 刷新后分数仍在 + 结算三态(WIN/LOSE/RESUME)接线 + 帧成本达标 全部通过")
		get_tree().quit(0)
	else:
		for failure in _failures:
			printerr("FX_SETTLE_PERSIST: FAIL %s" % failure)
		get_tree().quit(1)
