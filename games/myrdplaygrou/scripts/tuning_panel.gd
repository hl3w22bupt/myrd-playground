class_name TuningPanel
extends CanvasLayer
## 调参面板（SKILL.md §3C 调参工作台的客户端）：调参模式下在游戏画面上直接改数值。
##
## 开启方式（壳页面契约）：URL 带 ?tuning= 参数（?tuning=<JSON> 也算）且运行在网页环境。
## 面板按 GameState.TUNING_META 生成滑杆，拖动即时生效；「复制调参 URL」把当前数值
## 序列化成 ?tuning=<JSON> 的完整链接，粘回给主人/agent 走 revisions 回写 spec。
## 非网页环境（桌面/无头）永不创建 —— 冒烟与桌面运行零成本。
##
## 「试玩反馈四问」回填区（本面板第二节，?tuning=1 同页使用）：
## Q1 单局时长（太短/刚好/太长）、Q2 难度（太容易/刚好/太难，可附开始吃力关卡号）、
## Q3 音效紧张感（1-5 星）、Q4 整体好玩度（1-5 星，可附一句话建议）。
## 一键提交 → TuningFeedback.derive 把答案映射成 spec.numeric 修订建议 →
## 发布到 window.__TUNING_FEEDBACK__ + 尽力 POST 壳层中继（api/public/feedback/spec-revision）
## → owner/agent 据此走 POST /api/v1/game-design-specs/:id/revisions 入链，
## 拍板 tuning_applied 后才同步 game_state.gd 默认值。
## ⚠️ 硬约束：面板只收集用户亲手点选的答案 —— 无任何预填/默认选中；提交前未答完 = 禁用；
## 映射层只读 GameState，本面板从不写任何默认值（冒烟第 19 项机判）。
##
## UI 全部代码构建（不新增 .tscn，遵守「场景不凭空生成」纪律）；
## JavaScriptBridge 一律经 Engine.get_singleton 动态取用，不做编译期平台引用。

const LAYER_INDEX: int = 100
const PANEL_WIDTH: float = 280.0
## 四问区触屏目标高度（acc-touch-only「点按目标 ≥44px」硬口径）。
const ANSWER_BUTTON_MIN_HEIGHT: float = 44.0
## 提交后等待壳层中继 ACK 的秒数（fire-and-forget fetch 的回读窗）。
const RELAY_ACK_WAIT_SEC: float = 2.5

var _overrides: Dictionary = {}
var _bridge: Object
var _url_label: Label
var _rows: Dictionary = {}

## ── 四问区控件引用（None = 尚未构建；面板只在网页环境创建，构建顺序固定）──
var _duration_group: ButtonGroup
var _difficulty_group: ButtonGroup
var _tension_group: ButtonGroup
var _fun_group: ButtonGroup
var _difficulty_level_option: OptionButton
var _note_edit: LineEdit
var _submit_button: Button
var _feedback_status: Label
var _copy_feedback_button: Button
var _last_suggestion: Dictionary = {}


static func is_enabled() -> bool:
	if not Engine.has_singleton("JavaScriptBridge"):
		return false
	var bridge: Object = Engine.get_singleton("JavaScriptBridge")
	var flag: Variant = bridge.call("eval", "String(new URLSearchParams(location.search).get('tuning') !== null)")
	# 桌面/无头下桥存在但不工作（eval 恒为 null）—— 判空后才判值
	if flag == null:
		return false
	# ⚠️ 教训链（v4 线上实证 → v7 接线修复后线上复证）：eval 的 JS 布尔返回会落成
	# int(0/1)，只认 String("true") 会让面板在线上永不出现 —— JS 侧已改回 String，
	# GDScript 侧再按形态归一（bool 直取 / 数值 >0.5 / 字符串比较），禁止只认单一形态。
	if flag is bool:
		return flag
	if flag is int or flag is float:
		return float(flag) > 0.5
	return str(flag) == "true"


func _ready() -> void:
	layer = LAYER_INDEX
	_bridge = Engine.get_singleton("JavaScriptBridge")
	_build_ui()
	_snapshot_current_values()


func _build_ui() -> void:
	var panel := PanelContainer.new()
	panel.name = "TuningPanelRoot"
	panel.set_anchors_and_offsets_preset(Control.PRESET_TOP_RIGHT)
	panel.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	panel.grow_vertical = Control.GROW_DIRECTION_END
	panel.custom_minimum_size = Vector2(PANEL_WIDTH, 0)
	add_child(panel)

	var margin := MarginContainer.new()
	for side in ["margin_left", "margin_right", "margin_top", "margin_bottom"]:
		margin.add_theme_constant_override(side, 10)
	panel.add_child(margin)

	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 6)
	margin.add_child(column)

	var title := Label.new()
	title.text = "调参工作台（?tuning）"
	title.add_theme_font_size_override("font_size", 14)
	column.add_child(title)

	for key: StringName in GameState.TUNING_META:
		column.add_child(_build_row(key))

	column.add_child(HSeparator.new())
	_build_feedback_section(column)

	var copy_button := Button.new()
	copy_button.text = "复制调参 URL"
	copy_button.pressed.connect(_on_copy_pressed)
	column.add_child(copy_button)

	_url_label = Label.new()
	_url_label.add_theme_font_size_override("font_size", 11)
	_url_label.autowrap_mode = TextServer.AUTOWRAP_ARBITRARY
	_url_label.custom_minimum_size = Vector2(PANEL_WIDTH - 24.0, 0)
	column.add_child(_url_label)

	var close_button := Button.new()
	close_button.text = "关闭面板"
	close_button.pressed.connect(queue_free)
	column.add_child(close_button)


## ── 试玩反馈四问区（只收集用户亲手点选；无任何预选态）──

func _build_feedback_section(column: VBoxContainer) -> void:
	var section_title := Label.new()
	section_title.text = "试玩反馈四问（玩完一局回填）"
	section_title.add_theme_font_size_override("font_size", 14)
	column.add_child(section_title)

	var intro := Label.new()
	intro.text = "四问全答完才能提交；答案只来自你的点选。"
	intro.add_theme_font_size_override("font_size", 11)
	column.add_child(intro)

	_duration_group = ButtonGroup.new()
	column.add_child(_question_label("Q1 单局时长"))
	column.add_child(_option_row(_duration_group, [
		["太短", TuningFeedback.DURATION_TOO_SHORT],
		["刚好", TuningFeedback.DURATION_JUST_RIGHT],
		["太长", TuningFeedback.DURATION_TOO_LONG],
	]))

	_difficulty_group = ButtonGroup.new()
	column.add_child(_question_label("Q2 难度感受"))
	column.add_child(_option_row(_difficulty_group, [
		["太容易", TuningFeedback.DIFFICULTY_TOO_EASY],
		["刚好", TuningFeedback.DIFFICULTY_JUST_RIGHT],
		["太难", TuningFeedback.DIFFICULTY_TOO_HARD],
	]))

	_difficulty_level_option = OptionButton.new()
	_difficulty_level_option.add_item("开始吃力的关卡：不填")
	for i in GameState.LEVELS.size():
		_difficulty_level_option.add_item("第 %d 关" % (i + 1))
	_difficulty_level_option.selected = 0
	_difficulty_level_option.custom_minimum_size = Vector2(0, ANSWER_BUTTON_MIN_HEIGHT)
	_difficulty_level_option.item_selected.connect(_on_answer_changed)
	column.add_child(_difficulty_level_option)

	_tension_group = ButtonGroup.new()
	column.add_child(_question_label("Q3 音效紧张感（1-5 星）"))
	column.add_child(_star_row(_tension_group))

	_fun_group = ButtonGroup.new()
	column.add_child(_question_label("Q4 整体好玩度（1-5 星）"))
	column.add_child(_star_row(_fun_group))

	_note_edit = LineEdit.new()
	_note_edit.placeholder_text = "一句话建议（可选）"
	_note_edit.max_length = TuningFeedback.NOTE_MAX_CHARS
	_note_edit.custom_minimum_size = Vector2(0, ANSWER_BUTTON_MIN_HEIGHT)
	_note_edit.text_changed.connect(_on_answer_changed)
	column.add_child(_note_edit)

	_submit_button = Button.new()
	_submit_button.text = "提交四问反馈（生成修订建议）"
	_submit_button.custom_minimum_size = Vector2(0, ANSWER_BUTTON_MIN_HEIGHT)
	_submit_button.disabled = true
	_submit_button.pressed.connect(_on_submit_feedback)
	column.add_child(_submit_button)

	_feedback_status = Label.new()
	_feedback_status.text = "还差 4 问未答"
	_feedback_status.add_theme_font_size_override("font_size", 11)
	_feedback_status.autowrap_mode = TextServer.AUTOWRAP_ARBITRARY
	_feedback_status.custom_minimum_size = Vector2(PANEL_WIDTH - 24.0, 0)
	column.add_child(_feedback_status)

	_copy_feedback_button = Button.new()
	_copy_feedback_button.text = "复制修订建议 JSON"
	_copy_feedback_button.custom_minimum_size = Vector2(0, ANSWER_BUTTON_MIN_HEIGHT)
	_copy_feedback_button.disabled = true
	_copy_feedback_button.pressed.connect(_on_copy_feedback)
	column.add_child(_copy_feedback_button)


func _question_label(text: String) -> Label:
	var label := Label.new()
	label.text = text
	label.add_theme_font_size_override("font_size", 12)
	return label


## 三选一/五选一的点按行：互斥（ButtonGroup）+ 无预选（用户没点就是没答）。
func _option_row(group: ButtonGroup, options: Array) -> HBoxContainer:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 4)
	for option: Array in options:
		var button := Button.new()
		button.text = String(option[0])
		button.toggle_mode = true
		button.button_group = group
		button.set_meta("answer_value", String(option[1]))
		button.custom_minimum_size = Vector2(0, ANSWER_BUTTON_MIN_HEIGHT)
		button.add_theme_font_size_override("font_size", 12)
		button.pressed.connect(_on_answer_changed)
		row.add_child(button)
	return row


func _star_row(group: ButtonGroup) -> HBoxContainer:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 4)
	for stars in 5:
		var button := Button.new()
		button.text = "★%d" % (stars + 1)
		button.toggle_mode = true
		button.button_group = group
		button.set_meta("answer_stars", stars + 1)
		button.custom_minimum_size = Vector2(44.0, ANSWER_BUTTON_MIN_HEIGHT)
		button.add_theme_font_size_override("font_size", 12)
		button.pressed.connect(_on_answer_changed)
		row.add_child(button)
	return row


## 从当前点选状态收集答案（唯一的答案来源 = 控件选中态；没有点击就是缺答）。
func _collect_answers() -> Dictionary:
	var answers: Dictionary = {}
	var duration := _selected_meta_value(_duration_group)
	if not duration.is_empty():
		answers[TuningFeedback.Q1_DURATION] = duration
	var difficulty := _selected_meta_value(_difficulty_group)
	if not difficulty.is_empty():
		answers[TuningFeedback.Q2_DIFFICULTY] = difficulty
		var level := _difficulty_level_option.selected
		if level > 0:
			answers[TuningFeedback.Q2_DIFFICULTY_LEVEL] = level
	var tension := _selected_meta_stars(_tension_group)
	if tension > 0:
		answers[TuningFeedback.Q3_TENSION_STARS] = tension
	var fun := _selected_meta_stars(_fun_group)
	if fun > 0:
		answers[TuningFeedback.Q4_FUN_STARS] = fun
	var note := _note_edit.text.strip_edges()
	if not note.is_empty():
		answers[TuningFeedback.Q4_SUGGESTION] = note
	return answers


## 组内选中按钮的 answer_value 元数据（未选返回空串）。
func _selected_meta_value(group: ButtonGroup) -> String:
	for button: BaseButton in group.get_buttons():
		if button.button_pressed:
			return String(button.get_meta("answer_value", ""))
	return ""


## 组内选中按钮的 answer_stars 元数据（未选返回 0）。
func _selected_meta_stars(group: ButtonGroup) -> int:
	for button: BaseButton in group.get_buttons():
		if button.button_pressed:
			return int(button.get_meta("answer_stars", 0))
	return 0


## 任一答案变化 → 重算完整性与提示（不代填：缺答就一直禁用提交）。
func _on_answer_changed(_argument: Variant = null) -> void:
	var answers := _collect_answers()
	var missing := TuningFeedback.missing_fields(answers)
	_submit_button.disabled = not missing.is_empty()
	if missing.is_empty():
		_feedback_status.text = "四问已答完，可提交。"
	else:
		_feedback_status.text = "还差 %d 问未答（%s）" % [missing.size(), ", ".join(missing)]


## 一键提交：答案 → 修订建议 → 发布页面全局 + 尽力回传壳层中继。
func _on_submit_feedback() -> void:
	var answers := _collect_answers()
	if not TuningFeedback.is_complete(answers):
		_on_answer_changed()
		return
	var suggestion := TuningFeedback.derive(answers)
	if suggestion.is_empty():
		_feedback_status.text = "提交失败：答案映射为空（请重试）"
		return
	_last_suggestion = suggestion
	var exported := JSON.stringify(suggestion)
	var publish_result: Variant = _bridge.call("eval",
		"window.__TUNING_FEEDBACK__ = JSON.parse('%s'); 'ok'" % exported.replace("\\", "\\\\").replace("'", "\\'"))
	if publish_result == null or str(publish_result) != "ok":
		_feedback_status.text = "修订建议已生成，但页面发布失败（桥不工作）——可用「复制修订建议 JSON」"
		_copy_feedback_button.disabled = false
		return
	_copy_feedback_button.disabled = false
	_feedback_status.text = "已发布修订建议（%d 条），回传壳层中继…" % (suggestion["suggestions"] as Array).size()
	_post_feedback_to_relay()


## 尽力 POST 壳层中继（fire-and-forget fetch + 延时回读 ACK）；
## 中继不可达/未部署时静默失败，入口始终是「复制修订建议 JSON」。
func _post_feedback_to_relay() -> void:
	var js := """
(function () {
  var p = window.__TUNING_FEEDBACK__;
  if (!p) { window.__TUNING_FEEDBACK_ACK__ = { received: false, error: 'no-payload' }; return; }
  var base = location.pathname.replace(/index\\.html$/, '');
  if (base.charAt(base.length - 1) !== '/') { base += '/'; }
  fetch(base + '%s', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(p)
  }).then(function (r) { return r.json(); })
    .then(function (j) { window.__TUNING_FEEDBACK_ACK__ = j; })
    .catch(function (e) { window.__TUNING_FEEDBACK_ACK__ = { received: false, error: String(e) }; });
})()
""" % TuningFeedback.RELAY_PATH
	_bridge.call("eval", js)
	await get_tree().create_timer(RELAY_ACK_WAIT_SEC).timeout
	# 等待期间面板可能被「关闭面板」释放 —— 防已释放实例上继续执行（ Freed instance 噪声）
	if not is_inside_tree():
		return
	var ack_raw: Variant = _bridge.call("eval", "JSON.stringify(window.__TUNING_FEEDBACK_ACK__ || null)")
	if ack_raw == null or str(ack_raw) == "null":
		_feedback_status.text += "｜壳层中继未回 ACK（离线/旧部署）：请用「复制修订建议 JSON」交给 agent 入链"
		return
	var parsed: Variant = JSON.parse_string(str(ack_raw))
	if parsed is Dictionary and bool(parsed.get("received", false)):
		_feedback_status.text += "｜壳层已收妥（goal agent 可取回入链，待 owner 拍板）"
	else:
		var reason := "unknown"
		if parsed is Dictionary:
			reason = str(parsed.get("error", "unknown"))
		_feedback_status.text += "｜壳层未收妥：%s" % reason


## 复制修订建议 JSON（剪贴板被拒时仍显示在调参 URL 同款出口）。
func _on_copy_feedback() -> void:
	if _last_suggestion.is_empty():
		return
	var exported := JSON.stringify(_last_suggestion)
	_url_label.text = exported
	_bridge.call("eval", "navigator.clipboard && navigator.clipboard.writeText(%s).catch(function () {}); 'ok'" % _js_string(exported))


## 每个可调键一行：键名 + 滑杆 + 当前值。滑杆拖动即时写回 GameState 并更新覆盖快照。
func _build_row(key: StringName) -> HBoxContainer:
	var meta: Dictionary = GameState.TUNING_META[key]
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 6)

	var name_label := Label.new()
	name_label.text = String(key)
	name_label.custom_minimum_size = Vector2(96.0, 0)
	name_label.add_theme_font_size_override("font_size", 12)
	row.add_child(name_label)

	var slider := HSlider.new()
	slider.min_value = float(meta["min"])
	slider.max_value = float(meta["max"])
	slider.step = float(meta["step"])
	slider.value = float(GameState.get(String(key)))
	slider.custom_minimum_size = Vector2(96.0, 0)
	slider.value_changed.connect(_on_slider_changed.bind(key))
	row.add_child(slider)

	var value_label := Label.new()
	value_label.text = _format_value(slider.value)
	value_label.custom_minimum_size = Vector2(44.0, 0)
	value_label.add_theme_font_size_override("font_size", 12)
	row.add_child(value_label)

	_rows[key] = value_label
	return row


func _on_slider_changed(value: float, key: StringName) -> void:
	GameState.set(String(key), value)
	_overrides[String(key)] = value
	var value_label: Label = _rows[key]
	value_label.text = _format_value(value)


## 面板打开时的当前值视作覆盖基线：复制出的 URL 总能完整复现此刻的数值状态。
func _snapshot_current_values() -> void:
	for key: StringName in GameState.TUNING_META:
		_overrides[String(key)] = float(GameState.get(String(key)))


## 把当前覆盖序列化成 ?tuning=<JSON> 的完整地址，写入剪贴板并显示（剪贴板被拒时仍有出口）。
func _on_copy_pressed() -> void:
	var exported := JSON.stringify(_overrides)
	var set_result: Variant = _bridge.call("eval", "window.__TUNING_EXPORT__ = %s; 'ok'" % exported)
	if set_result == null or str(set_result) != "ok":
		_url_label.text = "序列化失败：JSON 不能安全注入页面"
		return
	var url_result: Variant = _bridge.call("eval",
		"location.origin + location.pathname + '?tuning=' + encodeURIComponent(JSON.stringify(window.__TUNING_EXPORT__))")
	if url_result == null:
		_url_label.text = "取 URL 失败：当前环境桥不工作"
		return
	var url := str(url_result)
	_url_label.text = url
	_bridge.call("eval", "navigator.clipboard && navigator.clipboard.writeText(%s).catch(function () {}); 'ok'" % _js_string(url))


func _format_value(value: float) -> String:
	return "%.0f" % value if is_equal_approx(floorf(value), value) else "%.1f" % value


## JS 字符串字面量安全包装（单引号 + 转义），避免 URL 内容破坏 eval 表达式。
func _js_string(text: String) -> String:
	return "'%s'" % text.replace("\\", "\\\\").replace("'", "\\'")
