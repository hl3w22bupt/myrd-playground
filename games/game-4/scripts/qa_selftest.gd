class_name QaSelftest
extends Node
## 真机自检模式（URL ?qa=1）—— Godot Web 端机判「这台设备玩不玩得动」：
##   ① 触屏命中：被动采集玩家真实点击 + 主动合成点击扫描（自动 sweep），
##      逐样本核对「点击坐标 → 路由格子 → 是否按预期旋转」，坐标映射错位当场现形；
##   ② 旋转响应时延：从点击事件到达引擎，到旋转应用后下一个渲染帧的时间差（含帧开销，
##      比「纯逻辑耗时」更接近手感）；统计 mean/p50/p95/max；
##   ③ 音效播放状态：壳页 __audioDebug()（AudioContext state / worklet 装载数 / 状态变迁日志）
##      + 引擎侧 AudioServer 驱动信息；
##   ④ 一键 JSON 实测报告：结构化落 navigator.share（iOS 系统分享）→ 剪贴板 → 下载
##      （WebBridge 四级降级），并同步投浏览器控制台。
##
## 门禁纪律：本节点只在 Web + ?qa=1 时激活 UI；headless（冒烟/fuzz/playtest）不激活、零输入竞争，
## 但纯逻辑（样本记录 / 统计 / 报告构建）可被冒烟直接断言 —— 「自检本身也被门禁检」。
##
## 命中判定口径（机判、无主观项）：
##   管格目标：routed == target 且 applied == target   → hit（点击既路由到位又真的转了）
##   非管目标（空格/墙）：routed == target 且无 applied → hit（正确地不旋转）
##   其余 → miss（坐标映射错位 / 响应丢失）。

## 旋转响应时延预算（p95 超过即 verdict 不通过）：触屏交互「跟手」经验线。
const ROTATION_LATENCY_BUDGET_MS: float = 120.0
## 命中率预算：sweep 全部目标都应精确路由（合成点击不该有离散误差），预算只留浮点余量。
const HIT_RATE_BUDGET: float = 1.0
## 报告里逐样本明细上限（防长会话膨胀；统计量始终全量计算）。
const SAMPLE_ROWS_CAP: int = 64
## 合成点击后等待闭合的帧数（1 个物理帧 + 1 个渲染帧缓冲）。
const PENDING_CLOSE_FRAMES: int = 3

## 报告就绪（UI 刷新 / 冒烟同步锚点）。
signal report_ready(report: Dictionary)

## 是否已激活（Web 且 ?qa=1）。headless 恒 false。
var active: bool = false
## 触屏命中 + 时延样本（被动真实点击 + 主动 sweep 共用一张表）。
var samples: Array[Dictionary] = []
## 最近一次生成的报告（build_report() 后可读）。
var last_report: Dictionary = {}

## 棋盘引用（激活后解析；只在本节点存活期持有，不跨场景）。
var _board: BoardView
var _pending: Array[Dictionary] = []
var _sweep_queue: Array[Dictionary] = []
var _sweep_wait_frames: int = 0
## sweep 空闲态 = true（run_auto_sweep 置 false，队列排空后回 true）。
var _sweep_done: bool = true
var _report_text: String = ""
var _export_channel: String = ""
var _export_in_flight: bool = false

## ── 程序化 QA UI（仅激活时构建，不占场景文件）──
var _ui_layer: CanvasLayer
var _status_label: Label


func _ready() -> void:
	var flags: Dictionary = WebBridge.read_url_flags()
	active = WebBridge.is_web() and str(flags.get("qa", "")) == "1"
	# 棋盘信号接线与 _process 常开：headless 冒烟要能直接驱动 sweep 并闭合样本；
	# 「不激活」只关闭 UI 与被动采集，让门禁进程零输入竞争。
	_resolve_board()
	_ensure_board_wiring()
	if not active:
		return
	_build_ui()
	_collect_passive_snapshot()
	log_line("QA 自检已激活：点击棋盘开始采集；点「自动扫描」跑全格命中 sweep。")


func _exit_tree() -> void:
	if _board != null and is_instance_valid(_board):
		if _board.rotated.is_connected(_on_board_rotated):
			_board.rotated.disconnect(_on_board_rotated)
		if _board.rotate_requested.is_connected(_on_board_rotate_requested):
			_board.rotate_requested.disconnect(_on_board_rotate_requested)


## ── 采集：被动（真实点击；sweep 期间的合成点击走显式开样，避免双记）──
func _input(event: InputEvent) -> void:
	if not active or not _sweep_done:
		return
	var click := event as InputEventMouseButton
	if click == null or not (click.pressed and click.button_index == MOUSE_BUTTON_LEFT):
		return
	_open_sample(click.position.x, click.position.y)


## 记录一个「点击到达」样本起点（合成 sweep 与被动点击共用）。
func _open_sample(win_x: float, win_y: float) -> void:
	var target: Vector2i = _cell_for_window_pos(Vector2(win_x, win_y))
	_pending.append({
		"win": Vector2(win_x, win_y),
		"target": target,
		"routed": Vector2i(-99, -99),
		"applied": Vector2i(-99, -99),
		"arrived_us": Time.get_ticks_usec(),
		"frames": 0,
	})


## ── 采集：棋盘信号回填 ─
func _on_board_rotate_requested(cell: Vector2i) -> void:
	if _pending.is_empty():
		return
	_pending[_pending.size() - 1]["routed"] = cell


func _on_board_rotated(cell: Vector2i) -> void:
	if _pending.is_empty():
		return
	_pending[_pending.size() - 1]["applied"] = cell


## 闭合到期样本：时延 = 到达 → 处理完成后下一帧（跨一个帧边界，含渲染提交开销）。
func _process(_delta: float) -> void:
	var now_us: int = Time.get_ticks_usec()
	var keep: Array[Dictionary] = []
	for pending: Dictionary in _pending:
		pending["frames"] = int(pending["frames"]) + 1
		if int(pending["frames"]) < PENDING_CLOSE_FRAMES:
			keep.append(pending)
			continue
		pending["latency_ms"] = float(now_us - int(pending["arrived_us"])) / 1000.0
		var target: Vector2i = pending["target"]
		var should_rotate: bool = _board != null and _board.is_pipe_at(target)
		var routed: Vector2i = pending["routed"]
		var applied: Vector2i = pending["applied"]
		var hit: bool = (routed == target) and (
			applied == target if should_rotate else applied == Vector2i(-99, -99))
		samples.append({
			"x": int(pending["win"].x),
			"y": int(pending["win"].y),
			"target_cell": [target.x, target.y],
			"routed_cell": [routed.x, routed.y],
			"applied_cell": [applied.x, applied.y],
			"should_rotate": should_rotate,
			"hit": hit,
			"latency_ms": snappedf(pending["latency_ms"], 0.01),
			"ts": Time.get_ticks_msec(),
		})
	_pending = keep
	_run_sweep_step()
	_poll_export_status()


## 导出是异步 Promise：发起后逐帧轮询壳页全局变量，把最终成败回报到 QA 面板。
func _poll_export_status() -> void:
	if not _export_in_flight:
		return
	var status: Dictionary = export_status()
	var state := str(status.get("state", "none"))
	if state == "started":
		return
	_export_in_flight = false
	if state == "done":
		log_line("导出完成（通道 %s）。" % str(status.get("channel", _export_channel)))
	else:
		log_line("导出未完成（通道 %s，%s）；JSON 已同步投浏览器控制台。" % [
			str(status.get("channel", _export_channel)), str(status.get("error", "未知原因"))])


## ── 自动 sweep：对当前关管格 + 非管格逐个合成点击 ──
## max_probes：目标数上限（-1 = 不限；冒烟用小预算控帧，真机 UI 用全量）。
func run_auto_sweep(max_probes: int = -1) -> int:
	_resolve_board()
	_sweep_queue.clear()
	_sweep_done = false
	if _board == null or _board.level.is_empty():
		return 0
	var queued: int = 0
	for pipe: Dictionary in _board.level.get("pipes", []):
		var cell: Vector2i = pipe["cell"]
		_sweep_queue.append({"cell": cell, "should_rotate": true})
		queued += 1
		if max_probes > 0 and queued >= max_probes:
			return queued
	# 非管探针：找一个空格与一个墙格（有的话），核对「正确地不旋转」。
	for y: int in range(_board.grid_size.y):
		for x: int in range(_board.grid_size.x):
			var probe: Vector2i = Vector2i(x, y)
			if _board.is_pipe_at(probe):
				continue
			var is_wall: bool = probe in _board.level.get("walls", [])
			var is_source_or_sink: bool = probe == _board.level.get("source_cell", Vector2i(-99, -99)) \
				or probe == _board.level.get("sink_cell", Vector2i(-99, -99))
			if not (is_wall or is_source_or_sink):
				_sweep_queue.append({"cell": probe, "should_rotate": false})
				queued += 1
				if max_probes > 0 and queued >= max_probes:
					return queued
				if queued >= SAMPLE_ROWS_CAP:
					break
		if queued >= SAMPLE_ROWS_CAP:
			break
	return queued


func _run_sweep_step() -> void:
	if _sweep_done:
		return
	if _sweep_wait_frames > 0:
		_sweep_wait_frames -= 1
		return
	if _sweep_queue.is_empty():
		_sweep_done = true
		if active:
			log_line("自动扫描完成：%d 个样本。点「生成报告」导出 JSON。" % samples.size())
		report_ready.emit(build_report())
		return
	var task: Dictionary = _sweep_queue.pop_front()
	var cell: Vector2i = task["cell"]
	_resolve_board()
	if _board == null:
		_sweep_done = true
		return
	var global_pos: Vector2 = _board.to_global(_board.cell_center(cell))
	var window_pos: Vector2 = _board.get_viewport().get_final_transform() \
		* (_board.get_viewport().get_canvas_transform() * global_pos)
	# sweep 显式开样（被动通道在 sweep 期间静默，见 _input）。
	_open_sample(window_pos.x, window_pos.y)
	var motion := InputEventMouseMotion.new()
	motion.position = window_pos
	motion.global_position = window_pos
	Input.parse_input_event(motion)
	var click := InputEventMouseButton.new()
	click.button_index = MOUSE_BUTTON_LEFT
	click.pressed = true
	click.position = window_pos
	click.global_position = window_pos
	Input.parse_input_event(click)
	_sweep_wait_frames = PENDING_CLOSE_FRAMES + 1


func sweep_finished() -> bool:
	return _sweep_done


## ── 统计与报告 ──
func latency_stats() -> Dictionary:
	var values: Array[float] = []
	for sample: Dictionary in samples:
		values.append(float(sample["latency_ms"]))
	if values.is_empty():
		return {"count": 0}
	values.sort()
	var total: float = 0.0
	for value: float in values:
		total += value
	return {
		"count": values.size(),
		"mean_ms": snappedf(total / values.size(), 0.01),
		"p50_ms": snappedf(_percentile(values, 0.5), 0.01),
		"p95_ms": snappedf(_percentile(values, 0.95), 0.01),
		"max_ms": snappedf(values[values.size() - 1], 0.01),
	}


func hit_stats() -> Dictionary:
	var hits: int = 0
	for sample: Dictionary in samples:
		if sample["hit"]:
			hits += 1
	var rate: float = 0.0 if samples.is_empty() else float(hits) / float(samples.size())
	return {"samples": samples.size(), "hits": hits, "misses": samples.size() - hits,
		"hit_rate": snappedf(rate, 0.001)}


func build_report() -> Dictionary:
	var latency: Dictionary = latency_stats()
	var touch: Dictionary = hit_stats()
	var audio: Dictionary = WebBridge.audio_debug()
	var audio_state: String = str(audio.get("state", "unknown"))
	var rows: Array = []
	for sample: Dictionary in samples.slice(0, SAMPLE_ROWS_CAP):
		rows.append(sample.duplicate())
	var touch_ok: bool = touch["samples"] > 0 and float(touch["hit_rate"]) >= HIT_RATE_BUDGET
	var latency_ok: bool = int(latency.get("count", 0)) > 0 \
		and float(latency.get("p95_ms", 99999.0)) <= ROTATION_LATENCY_BUDGET_MS
	var audio_running: bool = audio_state == "running"
	var audio_pending_unlock: bool = audio_state == "suspended" or audio_state == "interrupted"
	var report := {
		"schema": "guanglu-qa-report/1",
		"game": "光路谜阵",
		"generated_at": Time.get_datetime_string_from_system(true),
		"qa_url_flags": WebBridge.read_url_flags(),
		"engine": {
			"version": Engine.get_version_info().get("string", ""),
			"platform": OS.get_name(),
			"locale": OS.get_locale(),
			"viewport": [get_viewport().get_visible_rect().size.x, get_viewport().get_visible_rect().size.y],
			"touchscreen": DisplayServer.is_touchscreen_available(),
			"audio_driver": ProjectSettings.get_setting("audio/driver/driver", "unknown"),
			"audio_output_device": AudioServer.get_output_device(),
			"audio_mix_rate": AudioServer.get_mix_rate(),
			"sfx_bank_size": Juice.SFX_BANK.size(),
		},
		"device": WebBridge.device_info(),
		"audio": {
			"audio_context_state": audio_state,
			"worklets_loaded": int(audio.get("addModules", 0)),
			"state_log": audio.get("log", []),
			"running": audio_running,
			"pending_unlock": audio_pending_unlock,
			"note": "suspended=待首次手势解锁（点一下屏幕即恢复）；no-shell=壳页取证口缺失",
		},
		"touch": {
			"summary": touch,
			"budget": {"hit_rate_min": HIT_RATE_BUDGET},
			"rows": rows,
		},
		"rotation_latency": {
			"stats": latency,
			"budget_ms": ROTATION_LATENCY_BUDGET_MS,
		},
		"level": {
			"index": GameState.level_index,
			"name": LevelSet.level_at(GameState.level_index).get("name", ""),
			"moves": GameState.moves,
			"solved": GameState.solved,
		},
		"survey_snapshot": GameState.survey_export_payload(),
		"verdict": {
			"touch_hit_ok": touch_ok,
			"rotation_latency_ok": latency_ok,
			"audio_running": audio_running,
			"audio_pending_unlock": audio_pending_unlock,
			"pass": touch_ok and latency_ok and (audio_running or audio_pending_unlock),
		},
	}
	last_report = report
	return report


## 报告 JSON（紧凑单行，剪贴板/分享/回传三通道同源）。
func report_json() -> String:
	if last_report.is_empty():
		build_report()
	_report_text = JSON.stringify(last_report)
	return _report_text


## 一键导出：系统分享（iOS）→ 剪贴板 → 下载，返回即时通道名；最终状态轮询 export_status()。
func export_report() -> String:
	var text := report_json()
	_export_channel = WebBridge.export_text("光路谜阵 QA 实测报告", text)
	_export_in_flight = _export_channel != "unavailable"
	WebBridge.log_to_console("GUANGLU_QA_REPORT", text)
	if active:
		log_line("报告已生成（%d 字节），导出通道：%s" % [text.length(), _export_channel])
	return _export_channel


func export_status() -> Dictionary:
	return WebBridge.export_status()


func log_line(text: String) -> void:
	if _status_label != null:
		_status_label.text += text + "\n"
	print("QA: ", text)


## ── 内部 ──
func _resolve_board() -> void:
	if _board != null and is_instance_valid(_board):
		return
	var main: Node = get_tree().current_scene if get_tree() != null else null
	if main == null:
		main = get_parent()
	# 注意：必须取「Board 子节点」本身，而不是 main —— 真实游戏场景 current_scene=Main
	# 且必然有 Board 子节点，若把 main 赋给 candidate，`as BoardView` 得 null，
	# 线上 ?qa=1「自动扫描」会永远报 0 目标格（无头门禁因场景拓扑不同测不出这一分支）。
	var candidate: Node = main.get_node_or_null("Board") if main != null else null
	if candidate == null:
		candidate = get_tree().root.find_child("Board", true, false)
	_board = candidate as BoardView if candidate != null else null
	if _board != null:
		_ensure_board_wiring()


## 晚到接线：Web 下 _ready 时棋盘可能尚未可解析（此前曾因此永不接线 → 样本全 miss），
## 解析成功后补接两路信号（幂等，可重复调用）。
func _ensure_board_wiring() -> void:
	if _board == null or not is_instance_valid(_board):
		return
	if not _board.rotated.is_connected(_on_board_rotated):
		_board.rotated.connect(_on_board_rotated)
	if not _board.rotate_requested.is_connected(_on_board_rotate_requested):
		_board.rotate_requested.connect(_on_board_rotate_requested)


func _cell_for_window_pos(window_pos: Vector2) -> Vector2i:
	_resolve_board()
	if _board == null:
		return Vector2i(-99, -99)
	var viewport := _board.get_viewport()
	var canvas_pos: Vector2 = viewport.get_final_transform().affine_inverse() * window_pos
	var global_pos: Vector2 = viewport.get_canvas_transform().affine_inverse() * canvas_pos
	return _board.local_to_cell(_board.to_local(global_pos))


func _percentile(sorted_values: Array[float], ratio: float) -> float:
	if sorted_values.is_empty():
		return 0.0
	var index: int = clampi(int(ceil(ratio * float(sorted_values.size()))) - 1, 0, sorted_values.size() - 1)
	return sorted_values[index]


## 激活时的即时快照（设备 + 音频先采一轮，报告里即使不点击也有设备信息）。
func _collect_passive_snapshot() -> void:
	log_line("设备：UA=%s" % str(WebBridge.device_info().get("ua", "未知")))
	var audio: Dictionary = WebBridge.audio_debug()
	log_line("音频：AudioContext=%s worklets=%d（suspended 属正常，点一下屏幕解锁）" % [
		str(audio.get("state", "?")), int(audio.get("addModules", 0))])


## ── 程序化 UI（仅 Web+qa=1 构建）──
func _build_ui() -> void:
	_ui_layer = CanvasLayer.new()
	_ui_layer.name = "QaUI"
	_ui_layer.layer = 45
	add_child(_ui_layer)

	var panel := PanelContainer.new()
	panel.name = "Panel"
	panel.position = Vector2(16, 96)
	panel.custom_minimum_size = Vector2(360, 0)
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.05, 0.08, 0.16, 0.92)
	style.border_color = Color(0.45, 0.75, 1.0, 0.8)
	style.set_border_width_all(2)
	style.set_corner_radius_all(10)
	style.set_content_margin_all(12)
	panel.add_theme_stylebox_override("panel", style)
	_ui_layer.add_child(panel)

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 8)
	panel.add_child(vbox)

	var title := Label.new()
	title.text = "🛠 QA 真机自检（?qa=1）"
	title.add_theme_color_override("font_color", Color(1.0, 0.85, 0.4))
	vbox.add_child(title)

	_status_label = Label.new()
	_status_label.text = ""
	_status_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_status_label.custom_minimum_size = Vector2(336, 0)
	vbox.add_child(_status_label)

	var buttons := HBoxContainer.new()
	buttons.add_theme_constant_override("separation", 6)
	vbox.add_child(buttons)
	buttons.add_child(_make_button("自动扫描", "sweep"))
	buttons.add_child(_make_button("生成报告", "report"))
	buttons.add_child(_make_button("分享/复制", "share"))


func _make_button(text: String, action: String) -> Button:
	var button := Button.new()
	button.text = text
	button.pressed.connect(_on_qa_button.bind(action))
	return button


## QA 面板按钮统一入口（bind 派发；P12 可静态核对方法存在）。
func _on_qa_button(action: String) -> void:
	match action:
		"sweep":
			var queued := run_auto_sweep()
			log_line("自动扫描开始：%d 个目标格…" % queued)
		"report":
			report_json()
			log_line("报告已生成：%d 字节 JSON。" % _report_text.length())
		"share":
			export_report()
