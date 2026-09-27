class_name TuningPanel
extends CanvasLayer
## 调参面板（SKILL.md §3C 调参工作台的客户端，minimal-2d 模板资产按本工程 API 适配）。
##
## 开启方式（壳页面契约）：URL 带 ?tuning= 参数（?tuning=<JSON> 也算）且运行在网页环境。
## 面板按 GameState.TUNING_META 生成滑杆，拖动即时生效（apply_tuning 按范围钳制）；
## 「复制调参 URL」把当前数值序列化成 ?tuning=<JSON> 的完整链接，粘回给主人/agent
## 走 game-design-specs revisions 回写 spec。非网页环境（桌面/无头）永不创建。
##
## 与模板差异（本工程调参区 API 不同）：模板用 GameState.get/set（键名=变量名）；
## 本工程键名是 spec.numeric 的 camelCase，读经 GameState.tuning_value()、
## 写经 GameState.apply_tuning()（唯一应用入口，acc-09）。saveKey 是字符串键
## （meta 为 {0,0,0} 占位），step<=0 的键不出滑杆、不进导出。
##
## UI 全部代码构建（不新增 .tscn，遵守「场景不凭空生成」纪律）；
## JavaScriptBridge 一律经 Engine.get_singleton 动态取用，不做编译期平台引用。

const LAYER_INDEX: int = 100
const PANEL_WIDTH: float = 280.0

var _overrides: Dictionary = {}
var _bridge: Object
var _url_label: Label
var _rows: Dictionary = {}


static func is_enabled() -> bool:
	if not Engine.has_singleton("JavaScriptBridge"):
		return false
	var bridge: Object = Engine.get_singleton("JavaScriptBridge")
	var flag: Variant = bridge.call("eval", "new URLSearchParams(location.search).get('tuning') !== null")
	# 桌面/无头下桥存在但不工作（eval 恒为 null）—— 判空后才转字符串
	if flag == null:
		return false
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
	for side: String in ["margin_left", "margin_right", "margin_top", "margin_bottom"]:
		margin.add_theme_constant_override(side, 10)
	panel.add_child(margin)

	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(PANEL_WIDTH - 20.0, 360.0)
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	margin.add_child(scroll)

	var column := VBoxContainer.new()
	column.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	column.add_theme_constant_override("separation", 4)
	scroll.add_child(column)

	var title := Label.new()
	title.text = "调参工作台（?tuning）"
	title.add_theme_font_size_override("font_size", 14)
	column.add_child(title)

	for key: StringName in GameState.TUNING_META:
		if float(GameState.TUNING_META[key]["step"]) <= 0.0:
			continue  # saveKey 等字符串占位键：无滑杆语义
		column.add_child(_build_row(key))

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


## 每个可调键一行：键名 + 滑杆 + 当前值。滑杆拖动即时经 apply_tuning 写回并更新覆盖快照。
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
	slider.value = GameState.tuning_value(key)
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
	var applied: Array[StringName] = GameState.apply_tuning({String(key): value})
	if applied.is_empty():
		return  # 未声明键被 apply_tuning 拒绝（契约行为），快照与显示不动
	var clamped: float = GameState.tuning_value(key)
	_overrides[String(key)] = clamped
	var value_label: Label = _rows[key]
	value_label.text = _format_value(clamped)


## 面板打开时的当前值视作覆盖基线：复制出的 URL 总能完整复现此刻的数值状态。
func _snapshot_current_values() -> void:
	for key: StringName in GameState.TUNING_META:
		if float(GameState.TUNING_META[key]["step"]) <= 0.0:
			continue  # saveKey 不进导出：回写 spec 时跳过，避免字符串键污染数值段
		_overrides[String(key)] = GameState.tuning_value(key)


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
	return "%.0f" % value if is_equal_approx(floorf(value), value) else "%.2f" % value


## JS 字符串字面量安全包装（单引号 + 转义），避免 URL 内容破坏 eval 表达式。
func _js_string(text: String) -> String:
	return "'%s'" % text.replace("\\", "\\\\").replace("'", "\\'")
