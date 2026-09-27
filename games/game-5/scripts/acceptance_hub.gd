class_name AcceptanceHub
extends CanvasLayer
## 验收中枢页：iPhone 扫码直达（liveUrl 二维码）+ 真机取证分步引导 + 设备数据一键真实归档
## + 五维试玩量表回填 + ?tuning=1 调参直达（需求《game-5 真机验收与试玩回填》）。
##
## 打开方式：HUD 常驻「验收中枢」按钮 / H 键（open_hub 动作）/ URL ?hub=1 直达。
## 红线：本页只搭通道 —— 设备数据带来源标记导出、量表只回填用户亲手输入，
## 不产生任何验收结论（见 EvidenceArchive）。UI 全代码构建（不新增 .tscn），
## JavaScriptBridge 一律经 Engine.get_singleton 动态取用，桌面/无头自动降级。

signal hub_toggled(open: bool)

const LAYER_INDEX: int = 90
## 线上地址兜底：headless/桌面取不到 location 时用（与 docs/playtest-kit.md 保持一致）。
const DEFAULT_LIVE_URL: String = "https://leomac-studio.tail49399e.ts.net/apps/game-5/"
const QR_MODULE_PX: float = 4.0
const QR_QUIET_MODULES: int = 4

var _codec := QrCodec.new()
var _panel: Control
var _qr_view: QRView
var _url_edit: LineEdit
var _status: Label
var _answers: Dictionary = {}
var _author_edit: LineEdit
var _device_edit: LineEdit
var _played_edit: LineEdit
var _tuning_edit: TextEdit
var _survey_rows: Dictionary = {}
var _survey_button: Button


## URL 带 ?hub 参数（壳页面任意 query 形态都算）→ 启动即展开中枢。
static func is_requested() -> bool:
	if not Engine.has_singleton("JavaScriptBridge"):
		return false
	var bridge: Object = Engine.get_singleton("JavaScriptBridge")
	var flag: Variant = bridge.call("eval", "new URLSearchParams(location.search).get('hub') !== null")
	return flag != null and str(flag) == "true"


static func get_live_url() -> String:
	if Engine.has_singleton("JavaScriptBridge"):
		var bridge: Object = Engine.get_singleton("JavaScriptBridge")
		var url: Variant = bridge.call("eval", "location.origin + location.pathname")
		if url != null and not str(url).is_empty():
			return str(url)
	return DEFAULT_LIVE_URL


func _ready() -> void:
	layer = LAYER_INDEX
	_build_toggle_button()
	_build_panel()
	set_open(is_requested())


func _input(event: InputEvent) -> void:
	if event.is_action_pressed("open_hub"):
		set_open(not _panel.visible)
		get_viewport().set_input_as_handled()


## ── 常驻入口按钮（HUD 标签下方，不挡摇杆/结算按钮）──
func _build_toggle_button() -> void:
	var anchor := Control.new()
	anchor.name = "HubToggleAnchor"
	anchor.set_anchors_and_offsets_preset(Control.PRESET_TOP_LEFT)
	anchor.offset_left = 16.0
	anchor.offset_top = 84.0
	anchor.offset_right = 132.0
	anchor.offset_bottom = 112.0
	add_child(anchor)
	var button := Button.new()
	button.name = "HubToggleButton"
	button.text = "验收中枢"
	button.add_theme_font_size_override("font_size", 14)
	button.focus_mode = Control.FOCUS_NONE
	button.pressed.connect(func() -> void: set_open(true))
	anchor.add_child(button)


func _build_panel() -> void:
	_panel = PanelContainer.new()
	_panel.name = "HubPanel"
	_panel.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	_panel.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_panel.grow_vertical = Control.GROW_DIRECTION_BOTH
	_panel.custom_minimum_size = Vector2(920.0, 500.0)
	_panel.visible = false
	add_child(_panel)

	var margin := MarginContainer.new()
	for side in ["margin_left", "margin_right", "margin_top", "margin_bottom"]:
		margin.add_theme_constant_override(side, 10)
	_panel.add_child(margin)
	var scroll := ScrollContainer.new()
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	margin.add_child(scroll)
	var columns := HBoxContainer.new()
	columns.add_theme_constant_override("separation", 14)
	scroll.add_child(columns)

	columns.add_child(_build_qr_column())
	columns.add_child(_vseparator())
	columns.add_child(_build_survey_column())


func _vseparator() -> VSeparator:
	var separator := VSeparator.new()
	separator.custom_minimum_size = Vector2(2.0, 0)
	return separator


## ── 左列：二维码 + 直达链接 + 取证引导 + 设备数据归档 ──
func _build_qr_column() -> VBoxContainer:
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 6)
	column.custom_minimum_size = Vector2(430.0, 0)

	var title := Label.new()
	title.text = "验收中枢 · iPhone 扫码直达"
	title.add_theme_font_size_override("font_size", 16)
	column.add_child(title)

	_qr_view = QRView.new()
	_qr_view.custom_minimum_size = Vector2(168.0, 168.0)
	column.add_child(_qr_view)

	var url_row := HBoxContainer.new()
	url_row.add_theme_constant_override("separation", 6)
	_url_edit = LineEdit.new()
	_url_edit.text = get_live_url()
	_url_edit.custom_minimum_size = Vector2(300.0, 0)
	_url_edit.add_theme_font_size_override("font_size", 11)
	url_row.add_child(_url_edit)
	var refresh := Button.new()
	refresh.text = "刷新二维码"
	refresh.add_theme_font_size_override("font_size", 12)
	refresh.focus_mode = Control.FOCUS_NONE
	refresh.pressed.connect(_on_qr_refresh)
	url_row.add_child(refresh)
	column.add_child(url_row)

	var tuning_button := _make_button("打开调参工作台（?tuning=1）")
	tuning_button.pressed.connect(_on_open_tuning)
	column.add_child(tuning_button)
	var guide_button := _make_button("复制归档说明（设备/系统/时间/操作/结论）")
	guide_button.pressed.connect(_on_copy_guide)
	column.add_child(guide_button)
	var evidence_button := _make_button("采集设备数据并导出归档（只记读数）")
	evidence_button.pressed.connect(_on_export_evidence)
	column.add_child(evidence_button)

	_status = Label.new()
	_status.text = ""
	_status.add_theme_font_size_override("font_size", 11)
	_status.autowrap_mode = TextServer.AUTOWRAP_ARBITRARY
	_status.custom_minimum_size = Vector2(430.0, 0)
	column.add_child(_status)
	_on_qr_refresh()
	return column


## ── 右列：五维量表回填（1~5 分 + 一句理由 + 署名；空缺拒绝导出）──
func _build_survey_column() -> VBoxContainer:
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 4)
	column.custom_minimum_size = Vector2(430.0, 0)

	var title := Label.new()
	title.text = "试玩量表回填（用户本人逐项填写）"
	title.add_theme_font_size_override("font_size", 16)
	column.add_child(title)

	for dimension: String in EvidenceArchive.SURVEY_DIMENSIONS:
		column.add_child(_build_survey_row(dimension))

	_author_edit = _make_edit("署名（必填，谁试玩填谁）")
	column.add_child(_author_edit)
	_device_edit = _make_edit("试玩设备（如 iPhone 15 / Safari 17）")
	column.add_child(_device_edit)
	_played_edit = _make_edit("试玩时间（如 2026-09-27 19:30）")
	column.add_child(_played_edit)
	_tuning_edit = TextEdit.new()
	_tuning_edit.placeholder_text = "调参反馈：对照 5 个可调键写期望值（可留空）"
	_tuning_edit.custom_minimum_size = Vector2(430.0, 56.0)
	_tuning_edit.add_theme_font_size_override("font_size", 11)
	column.add_child(_tuning_edit)

	_survey_button = _make_button("生成试玩回填文档（五维全部填写后可导出）")
	_survey_button.pressed.connect(_on_export_survey)
	column.add_child(_survey_button)

	var hint := Label.new()
	hint.text = "导出后请放入仓库 games/game-5/qa/ 并 git 提交；本页不代填、不生成任何结论。"
	hint.add_theme_font_size_override("font_size", 10)
	hint.autowrap_mode = TextServer.AUTOWRAP_ARBITRARY
	column.add_child(hint)
	return column


func _build_survey_row(dimension: String) -> HBoxContainer:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 6)
	var name_label := Label.new()
	name_label.text = dimension
	name_label.custom_minimum_size = Vector2(170.0, 0)
	name_label.add_theme_font_size_override("font_size", 12)
	row.add_child(name_label)
	var slider := HSlider.new()
	slider.min_value = 1.0
	slider.max_value = 5.0
	slider.step = 1.0
	slider.value = 0.0
	slider.custom_minimum_size = Vector2(110.0, 0)
	var value_label := Label.new()
	value_label.text = "-"
	value_label.custom_minimum_size = Vector2(16.0, 0)
	value_label.add_theme_font_size_override("font_size", 12)
	slider.value_changed.connect(func(value: float) -> void:
		value_label.text = str(int(value))
		_set_answer_score(dimension, int(value)))
	row.add_child(slider)
	row.add_child(value_label)
	var reason := LineEdit.new()
	reason.placeholder_text = "一句理由（必填）"
	reason.custom_minimum_size = Vector2(120.0, 0)
	reason.add_theme_font_size_override("font_size", 11)
	reason.text_changed.connect(func(text: String) -> void: _set_answer_reason(dimension, text))
	row.add_child(reason)
	return row


func _set_answer_score(dimension: String, score: int) -> void:
	var entry: Dictionary = _answers.get(dimension, {})
	entry["score"] = score
	_answers[dimension] = entry
	_refresh_survey_button()


func _set_answer_reason(dimension: String, reason: String) -> void:
	var entry: Dictionary = _answers.get(dimension, {})
	entry["reason"] = reason
	_answers[dimension] = entry
	_refresh_survey_button()


func _refresh_survey_button() -> void:
	if _survey_button == null:
		return
	var ok := EvidenceArchive.survey_complete(_collect_answers())
	_survey_button.disabled = not ok
	_survey_button.tooltip_text = "" if ok else "五维分数与理由、署名都填完才能导出"


func _collect_answers() -> Dictionary:
	var answers := _answers.duplicate(true)
	answers["author"] = _author_edit.text
	answers["device"] = _device_edit.text
	answers["played_at"] = _played_edit.text
	answers["tuning_feedback"] = _tuning_edit.text
	return answers


func _make_edit(placeholder: String) -> LineEdit:
	var edit := LineEdit.new()
	edit.placeholder_text = placeholder
	edit.custom_minimum_size = Vector2(430.0, 0)
	edit.add_theme_font_size_override("font_size", 11)
	return edit


func _make_button(text: String) -> Button:
	var button := Button.new()
	button.text = text
	button.add_theme_font_size_override("font_size", 12)
	button.focus_mode = Control.FOCUS_NONE
	return button


## ── 行为 ──
func set_open(value: bool) -> void:
	_panel.visible = value
	hub_toggled.emit(value)


func is_open() -> bool:
	return _panel.visible


## 冒烟断言用：当前二维码矩阵边长（0 = 未生成）。
func qr_matrix_size() -> int:
	return _qr_view.matrix_size()


func get_tuning_url() -> String:
	var base := _url_edit.text.strip_edges()
	if base.contains("?"):
		base = base.substr(0, base.find("?"))
	return base + "?tuning=1"


func _on_qr_refresh() -> void:
	var url := _url_edit.text.strip_edges()
	var result: Dictionary = _codec.encode(url)
	if result.is_empty():
		_status.text = "二维码生成失败：URL 过长（Byte 模式上限 214 字节）"
		_qr_view.clear_matrix()
		return
	_qr_view.set_matrix(result)
	_refresh_survey_button()


func _on_open_tuning() -> void:
	var url := get_tuning_url()
	if Engine.has_singleton("JavaScriptBridge"):
		var bridge: Object = Engine.get_singleton("JavaScriptBridge")
		var result: Variant = bridge.call("eval", "location.href = %s; 'ok'" % _js_string(url))
		if result != null and str(result) == "ok":
			_status.text = "正在打开调参工作台：%s" % url
			return
	_status.text = "当前环境无法跳转，请手动打开：%s" % url


func _on_copy_guide() -> void:
	var guide := "game-5 真机取证归档说明（每份证据附一行）：\n"
	guide += "1. 文件放入仓库 games/game-5/qa/，文件名含日期（如 game5-joystick-20260927.jpg）。\n"
	guide += "2. 一行说明必须含：设备型号 / 系统版本 / 实测时间 / 操作项 / 你本人的结论。\n"
	guide += "3. 移动操作证据：摇杆推动前后各一张截图（松鼠位置明显不同）。\n"
	guide += "4. 音效证据：含声音的录屏，或 __audioDebug 取证口截图 + 人耳听感结论。\n"
	_copy_to_clipboard(guide, "归档说明已复制到剪贴板（剪贴板被拒时请看下方原文）\n" + guide)


func _on_export_evidence() -> void:
	var data := EvidenceArchive.collect_device_data(get_live_url())
	var markdown := EvidenceArchive.build_evidence_markdown(data)
	var filename := EvidenceArchive.suggested_filename("device-evidence")
	_status.text = EvidenceArchive.save_markdown(filename, markdown)


func _on_export_survey() -> void:
	var answers := _collect_answers()
	if not EvidenceArchive.survey_complete(answers):
		_status.text = "量表未填完：五维分数与理由、署名都是必填项。"
		return
	var markdown := EvidenceArchive.build_survey_markdown(answers, get_live_url(), get_tuning_url())
	var filename := EvidenceArchive.suggested_filename("playtest-survey")
	_status.text = EvidenceArchive.save_markdown(filename, markdown)


func _copy_to_clipboard(text: String, fallback_status: String) -> void:
	if Engine.has_singleton("JavaScriptBridge"):
		var bridge: Object = Engine.get_singleton("JavaScriptBridge")
		var result: Variant = bridge.call("eval",
			"navigator.clipboard && navigator.clipboard.writeText(%s).catch(function () {}); 'ok'" % _js_string(text))
		if result != null and str(result) == "ok":
			_status.text = "已复制到剪贴板。"
			return
	_status.text = fallback_status


func _js_string(text: String) -> String:
	return "'%s'" % text.replace("\\", "\\\\").replace("'", "\\'")


## 二维码视图：白底静区 + 黑模块，纯 draw_rect，无外部资产。
class QRView:
	extends Control

	var _modules: PackedByteArray = PackedByteArray()
	var _matrix_size: int = 0

	func set_matrix(result: Dictionary) -> void:
		_matrix_size = int(result["size"])
		_modules = result["modules"]
		custom_minimum_size = Vector2(
			(_matrix_size + AcceptanceHub.QR_QUIET_MODULES * 2) * AcceptanceHub.QR_MODULE_PX,
			(_matrix_size + AcceptanceHub.QR_QUIET_MODULES * 2) * AcceptanceHub.QR_MODULE_PX)
		queue_redraw()

	func clear_matrix() -> void:
		_matrix_size = 0
		_modules = PackedByteArray()
		queue_redraw()

	func matrix_size() -> int:
		return _matrix_size

	func is_dark(row: int, col: int) -> bool:
		if _matrix_size == 0:
			return false
		return _modules[row * _matrix_size + col] == 1

	func _draw() -> void:
		var scale := AcceptanceHub.QR_MODULE_PX
		var quiet := AcceptanceHub.QR_QUIET_MODULES
		var total := _matrix_size + quiet * 2
		draw_rect(Rect2(0.0, 0.0, total * scale, total * scale), Color.WHITE)
		if _matrix_size == 0:
			return
		for row in range(_matrix_size):
			for col in range(_matrix_size):
				if is_dark(row, col):
					draw_rect(Rect2((col + quiet) * scale, (row + quiet) * scale, scale, scale), Color.BLACK)
