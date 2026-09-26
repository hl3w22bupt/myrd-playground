class_name SurveyPanel
extends CanvasLayer
## 四问量表面板（URL ?tuning=1 直开 + 通关结算页入口按钮共用）。
##
## 题目 = qa/PLAYTEST_KIT.md §五 的内置化，逐问独立作答：
##   ① 首分钟能否看懂目标与操作（能/否 + 卡点 + 出现秒数）
##   ② 结束时想不想再来一局（1-5 + 原因）
##   ③ 手感与反馈四维（旋转/光束/音效/画面，各 1-5）
##   ④ 节奏有没有明显断档（无/有 + 位置 + 表现）
##
## 答案经 GameState.set_survey_answer 即时落盘（user://guanglu_survey.cfg，只升不覆盖语义
## 由玩家重选决定），提交 = 盖章元数据 + 一键导出回传（系统分享 → 剪贴板 → 下载）。
##
## 门禁纪律：headless（冒烟/fuzz/playtest）不构建交互 UI、不抢输入；
## 纯逻辑（题目表 / 必答校验 / 导出载荷）可被冒烟直接断言。

## 题目表（单一事实源；选项键与 GameState.SURVEY_KEYS 一一对应）。
const QUESTIONS: Array[Dictionary] = [
	{
		"id": "q1",
		"title": "① 首分钟能否看懂目标与操作？",
		"key": "q1_understood",
		"options": ["能", "否"],
		"extras": [
			{"key": "q1_blocker", "label": "卡点（选「否」建议填写）"},
			{"key": "q1_blocker_sec", "label": "卡点出现时间（第几秒）"},
		],
	},
	{
		"id": "q2",
		"title": "② 结束时想不想再来一局？（1=完全不想，5=非常想）",
		"key": "q2_replay",
		"options": ["1", "2", "3", "4", "5"],
		"extras": [{"key": "q2_reason", "label": "原因（一句话）"}],
	},
	{
		"id": "q3",
		"title": "③ 手感与反馈（每维 1-5 分）",
		"key": "",
		"dims": [
			{"key": "q3_rotate", "label": "旋转手感（点击→管件转动）"},
			{"key": "q3_beam", "label": "光束点亮反馈（视觉）"},
			{"key": "q3_sfx", "label": "音效"},
			{"key": "q3_perf", "label": "画面响应（帧率/卡顿）"},
		],
	},
	{
		"id": "q4",
		"title": "④ 节奏有没有明显断档或无聊段？",
		"key": "q4_gap",
		"options": ["无", "有"],
		"extras": [
			{"key": "q4_where", "label": "若有：第几关 / 第几秒"},
			{"key": "q4_detail", "label": "表现（一句话）"},
		],
	},
]

const PANEL_LAYER: int = 40

## 面板当前是否处于打开态（headless 冒烟可断言的纯状态）。
var is_open: bool = false
## 通关后是否应显示入口按钮（结算页入口）。
var solved_entry_pending: bool = false

var _root: Control
var _panel: PanelContainer
var _status_label: Label
var _open_button: Button
var _option_buttons: Dictionary = {}  # key+option -> Button
var _extra_inputs: Dictionary = {}    # key -> LineEdit


func _ready() -> void:
	layer = PANEL_LAYER
	# 订阅通关信号：结算页入口（通关后浮出「试玩四问」按钮）。
	if not GameState.level_solved.is_connected(_on_level_solved):
		GameState.level_solved.connect(_on_level_solved)
	# ?tuning= 与调参工作台（TuningPanel）共用 URL 入口：量表以「入口按钮」形态浮出，
	# 不弹模态、不遮挡右上角调参滑杆 —— 数值调参与主观回填两条工作流互不妨碍。
	# headless / 桌面不构建 UI，零输入竞争。
	var flags: Dictionary = WebBridge.read_url_flags()
	if WebBridge.is_web() and str(flags.get("tuning", "")) != "":
		_build_ui()
		solved_entry_pending = true
		_open_button.visible = true


func _exit_tree() -> void:
	if GameState.level_solved.is_connected(_on_level_solved):
		GameState.level_solved.disconnect(_on_level_solved)


func _on_level_solved(_stars: int, _moves: int, _par: int) -> void:
	solved_entry_pending = true
	if _root != null:
		_open_button.visible = true
		_open_button.text = _entry_text()


func _entry_text() -> String:
	return "📋 试玩四问（已填，可改）" if GameState.survey_complete() else "📋 试玩四问"


## 打开面板（构建惰性 UI；headless 只置状态，供冒烟断言）。
func open_survey() -> void:
	is_open = true
	if _root == null:
		if not WebBridge.is_web():
			return
		_build_ui()
	_show_modal(true)
	_refresh_all()


func close_survey() -> void:
	is_open = false
	_show_modal(false)


## 模态层（遮罩 + 面板）显隐；入口按钮独立于模态层，只受 solved_entry_pending 控制。
func _show_modal(shown: bool) -> void:
	if _root == null:
		return
	for child: Node in _root.get_children():
		if child is Control and child != _open_button:
			(child as Control).visible = shown


## 选中一个选项（纯逻辑入口，UI 与冒烟共用）。
func choose_option(key: String, option: String) -> bool:
	return GameState.set_survey_answer(key, option)


## 写入一个文本补充栏。
func set_extra(key: String, text: String) -> bool:
	return GameState.set_survey_answer(key, text)


## 提交：必答校验 → 盖章元数据 → 导出回传。返回 (是否提交成功, 缺失键列表)。
func submit_survey() -> Dictionary:
	var missing: Array[String] = GameState.survey_missing_required()
	if not missing.is_empty():
		_set_status("还缺 %d 项必答：%s" % [missing.size(), "、".join(missing)])
		return {"submitted": false, "missing": missing}
	GameState.stamp_survey_meta()
	var payload := GameState.survey_export_payload()
	var text := JSON.stringify(payload)
	var channel := WebBridge.export_text("光路谜阵·试玩四问回填", text)
	WebBridge.log_to_console("GUANGLU_SURVEY", text)
	_set_status("已提交并在本地保存（%d 字节）。导出通道：%s（iOS 弹分享面板 / 复制到剪贴板）"
		% [text.length(), channel])
	return {"submitted": true, "missing": [], "channel": channel, "bytes": text.length()}


## 导出而不提交（改答案后想先看载荷）。
func export_answers() -> String:
	return JSON.stringify(GameState.survey_export_payload())


## ── 内部：程序化 UI ──

func _build_ui() -> void:
	_root = Control.new()
	_root.name = "SurveyRoot"
	_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	# root 常显（承载入口按钮）；模态层（遮罩+面板）单独控显隐。
	_root.visible = true
	add_child(_root)

	var dim := ColorRect.new()
	dim.name = "Dim"
	dim.color = Color(0.02, 0.03, 0.08, 0.72)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	# 拦截背景输入，但入口按钮在 dim 之上不受影响。
	dim.mouse_filter = Control.MOUSE_FILTER_STOP
	dim.visible = false
	_root.add_child(dim)

	_panel = PanelContainer.new()
	_panel.name = "Panel"
	_panel.set_anchors_preset(Control.PRESET_CENTER)
	_panel.visible = false
	_panel.custom_minimum_size = Vector2(560, 0)
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.07, 0.1, 0.2, 0.97)
	style.border_color = Color(0.45, 0.75, 1.0, 0.9)
	style.set_border_width_all(2)
	style.set_corner_radius_all(12)
	style.set_content_margin_all(16)
	_panel.add_theme_stylebox_override("panel", style)
	_root.add_child(_panel)

	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(560, 520)
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_panel.add_child(scroll)

	var vbox := VBoxContainer.new()
	vbox.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	vbox.add_theme_constant_override("separation", 10)
	scroll.add_child(vbox)

	var title := Label.new()
	title.text = "📋 试玩四问量表（每问独立作答，答案本地保存）"
	title.add_theme_color_override("font_color", Color(1.0, 0.85, 0.4))
	vbox.add_child(title)

	for question: Dictionary in QUESTIONS:
		vbox.add_child(_make_question_row(question))

	var button_row := HBoxContainer.new()
	button_row.add_theme_constant_override("separation", 10)
	vbox.add_child(button_row)
	button_row.add_child(_make_action_button("提交并导出回传", "submit"))
	button_row.add_child(_make_action_button("仅导出 JSON", "export"))
	button_row.add_child(_make_action_button("关闭", "close"))

	_status_label = Label.new()
	_status_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_status_label.custom_minimum_size = Vector2(520, 0)
	_status_label.add_theme_font_size_override("font_size", 13)
	_status_label.add_theme_color_override("font_color", Color(0.7, 0.9, 1.0))
	vbox.add_child(_status_label)

	_open_button = Button.new()
	_open_button.name = "EntryButton"
	_open_button.text = _entry_text()
	_open_button.visible = false
	_open_button.position = Vector2(16, 640)
	_open_button.pressed.connect(_on_entry_pressed)
	_root.add_child(_open_button)


## 结算页入口按钮（通关后浮出）。
func _on_entry_pressed() -> void:
	open_survey()


## 面板动作按钮统一入口（bind 派发；P12 可静态核对方法存在）。
func _on_survey_action(action: String) -> void:
	match action:
		"submit":
			submit_survey()
		"export":
			var text := export_answers()
			WebBridge.export_text("光路谜阵·试玩四问", text)
			_set_status("已导出载荷（%d 字节）" % text.length())
		"close":
			close_survey()


func _make_question_row(question: Dictionary) -> Control:
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 4)
	var title := Label.new()
	title.text = str(question["title"])
	title.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	title.add_theme_color_override("font_color", Color(0.92, 0.95, 1.0))
	box.add_child(title)

	var question_key := str(question.get("key", ""))
	if question.has("options"):
		var options_row := HBoxContainer.new()
		options_row.add_theme_constant_override("separation", 6)
		box.add_child(options_row)
		for option: String in question["options"]:
			var button := Button.new()
			button.text = option
			button.toggle_mode = true
			button.custom_minimum_size = Vector2(56, 34)
			button.pressed.connect(_on_option_pressed.bind(question_key, option))
			options_row.add_child(button)
			_option_buttons["%s|%s" % [question_key, option]] = button
	elif question.has("dims"):
		for dim_question: Dictionary in question["dims"]:
			var dim_key := str(dim_question["key"])
			var dim_label := Label.new()
			dim_label.text = "· " + str(dim_question["label"])
			dim_label.add_theme_font_size_override("font_size", 13)
			box.add_child(dim_label)
			var dim_row := HBoxContainer.new()
			dim_row.add_theme_constant_override("separation", 6)
			box.add_child(dim_row)
			for score: int in range(1, 6):
				var button := Button.new()
				button.text = str(score)
				button.toggle_mode = true
				button.custom_minimum_size = Vector2(48, 32)
				button.pressed.connect(_on_option_pressed.bind(dim_key, str(score)))
				dim_row.add_child(button)
				_option_buttons["%s|%d" % [dim_key, score]] = button

	for extra: Dictionary in question.get("extras", []):
		var extra_key := str(extra["key"])
		var input := LineEdit.new()
		input.placeholder_text = str(extra["label"])
		input.custom_minimum_size = Vector2(520, 34)
		input.text_submitted.connect(_on_extra_submitted.bind(extra_key, input))
		input.focus_exited.connect(_on_extra_focus_exited.bind(extra_key, input))
		box.add_child(input)
		_extra_inputs[extra_key] = input
	return box


## 选项点选（问句选项与 q3 各维共用，bind 派发键与取值）。
func _on_option_pressed(key: String, option: String) -> void:
	choose_option(key, option)
	_refresh_all()


## 文本补充栏：回车提交。
func _on_extra_submitted(key: String, input: LineEdit, text: String) -> void:
	set_extra(key, text)
	_set_status("已记录：%s" % key)


## 文本补充栏：失焦同步（防玩家填完不按回车就点提交）。
func _on_extra_focus_exited(key: String, input: LineEdit) -> void:
	if not input.text.is_empty():
		set_extra(key, input.text)


func _make_action_button(text: String, action: String) -> Button:
	var button := Button.new()
	button.text = text
	button.pressed.connect(_on_survey_action.bind(action))
	return button


func _refresh_all() -> void:
	for combo: String in _option_buttons:
		var parts := combo.split("|")
		var key := parts[0]
		var option := "|".join(parts.slice(1))
		var button: Button = _option_buttons[combo]
		button.set_pressed_no_signal(str(GameState.survey_answers.get(key, "")) == option)
	if _open_button != null:
		_open_button.text = _entry_text()


func _set_status(text: String) -> void:
	if _status_label != null:
		_status_label.text = text
	print("Survey: ", text)
