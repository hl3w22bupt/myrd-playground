class_name TuningPanel
extends CanvasLayer
## 调参面板（SKILL.md §3C 调参工作台的客户端）：调参模式下在游戏画面上直接改数值。
##
## 开启方式（壳页面契约）：URL 带 ?tuning= 参数（?tuning=<JSON> 也算）且运行在网页环境。
## 面板按 GameState.TUNING_META 生成滑杆，拖动即时生效；「复制调参 URL」把当前数值
## 序列化成 ?tuning=<JSON> 的完整链接，粘回给主人/agent 走 revisions 回写 spec。
## 非网页环境（桌面/无头）永不创建 —— 冒烟与桌面运行零成本。
##
## 与模板的差异（本工程 TUNING_META 协议）：键是 spec 点号键（如 "speed.base"），
## 成员名走 meta["prop"] 映射，读写经 GameState.get/set(prop)；meta 无 step 时按
## 类型推导（int=1，float=(max-min)/100）。其余与模板 tuning_panel.gd 同源。
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
	slider.step = _slider_step(meta)
	slider.value = float(GameState.get(String(meta["prop"])))
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


## 滑杆步进：meta 声明了 step 用声明的；否则按类型推导（int=1，float=量程/100，下限 0.05）。
func _slider_step(meta: Dictionary) -> float:
	if meta.has("step"):
		return float(meta["step"])
	if str(meta.get("type", "float")) == "int":
		return 1.0
	var span: float = float(meta["max"]) - float(meta["min"])
	return maxf(span / 100.0, 0.05)


## 与 GameState._apply_url_tuning 同口径：按 min/max 钳制 + 按类型收整后写入成员变量。
func _on_slider_changed(value: float, key: StringName) -> void:
	var meta: Dictionary = GameState.TUNING_META[key]
	var clamped: float = clampf(value, float(meta["min"]), float(meta["max"]))
	var prop: String = String(meta["prop"])
	GameState.set(prop, int(clamped) if str(meta["type"]) == "int" else clamped)
	_overrides[String(key)] = clamped
	var value_label: Label = _rows[key]
	value_label.text = _format_value(clamped)


## 面板打开时的当前值视作覆盖基线：复制出的 URL 总能完整复现此刻的数值状态。
func _snapshot_current_values() -> void:
	for key: StringName in GameState.TUNING_META:
		var meta: Dictionary = GameState.TUNING_META[key]
		_overrides[String(key)] = float(GameState.get(String(meta["prop"])))


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
