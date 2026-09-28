class_name TuningPanel
extends CanvasLayer
## 《牛牛打游戏》调参工作台面板（SKILL.md §3C 三件套之三；代码建 UI，不进 .tscn）。
##
## 创建时机：仅 Web 端且页面 URL 带 ?tuning= 时由 main.gd 创建（should_show()）；
## 桌面/无头环境永不创建，冒烟与本地运行完全不受影响。
## 交互：按 GameState.TUNING_META 生成滑杆，拖动即时经 GameState.apply_tuning() 生效
## （只认声明键、按 min/max 钳制）；「复制调参 URL」把当前数值序列化成
## ?tuning=<urlencoded JSON> 可分享链接，试玩人回传后走 spec 回写协议。

## 面板距视口右上角的边距（px）。
const MARGIN: float = 8.0
## 面板固定宽度（px）：640 宽的竖屏场地里给调参台留约 1/3 宽。
const PANEL_WIDTH: float = 232.0
## 面板小号字体（键名/数值），HUD 字号已由场景定，这里独立控制。
const SMALL_FONT_SIZE: int = 10
## 标题字号。
const TITLE_FONT_SIZE: int = 13

## 键名 → 数值读出 Label（拖动滑杆时刷新显示）。
var _value_labels: Dictionary = {}
## 当前调参 URL 的只读展示框（剪贴板不可用时人工长按复制兜底）。
var _url_edit: LineEdit


## 是否应创建面板：仅 Web 且 URL 带 tuning 参数（与壳页面调参桥同一开启标志）。
static func should_show() -> bool:
	if not OS.has_feature("web"):
		return false
	var has_tuning: Variant = JavaScriptBridge.eval(
		"location.search.indexOf('tuning=') !== -1", true
	)
	return has_tuning == true


func _ready() -> void:
	layer = 20
	_build_ui()


## 组装面板：右上角浮层 = 标题 + 每键一行（键名 + 滑杆 + 数值）+ 调参 URL + 隐藏按钮。
func _build_ui() -> void:
	var panel := PanelContainer.new()
	panel.name = "TuningRoot"
	panel.custom_minimum_size = Vector2(PANEL_WIDTH, 0.0)
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.08, 0.1, 0.16, 0.92)
	style.set_corner_radius_all(8)
	style.set_content_margin_all(8.0)
	panel.add_theme_stylebox_override("panel", style)
	panel.position = Vector2(640.0 - PANEL_WIDTH - MARGIN, MARGIN)
	add_child(panel)

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 5)
	panel.add_child(vbox)

	var title := Label.new()
	title.text = "调参工作台（URL ?tuning=）"
	title.add_theme_font_size_override("font_size", TITLE_FONT_SIZE)
	vbox.add_child(title)

	for key: String in GameState.TUNING_META:
		vbox.add_child(_build_row(key))

	vbox.add_child(_build_url_row())

	var hide := Button.new()
	hide.text = "隐藏面板"
	hide.add_theme_font_size_override("font_size", SMALL_FONT_SIZE)
	hide.pressed.connect(func() -> void: panel.visible = false)
	vbox.add_child(hide)


## 单个可调键的一行：键名 + 数值读出 + 滑杆（初值 = 当前生效值）。
func _build_row(key: String) -> VBoxContainer:
	var meta: Dictionary = GameState.TUNING_META[key]
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 1)

	var head := HBoxContainer.new()
	var name_label := Label.new()
	name_label.text = key
	name_label.add_theme_font_size_override("font_size", SMALL_FONT_SIZE)
	name_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	head.add_child(name_label)
	var value_label := Label.new()
	value_label.add_theme_font_size_override("font_size", SMALL_FONT_SIZE)
	_value_labels[key] = value_label
	head.add_child(value_label)
	column.add_child(head)

	var slider := HSlider.new()
	slider.min_value = float(meta["min"])
	slider.max_value = float(meta["max"])
	slider.step = float(meta["step"])
	slider.value = float(GameState.get(key))
	slider.custom_minimum_size = Vector2(0.0, 14.0)
	slider.value_changed.connect(_on_slider_changed.bind(key))
	column.add_child(slider)

	_refresh_value_label(key)
	return column


## 调参 URL 行：只读展示框（人工复制兜底）+ 复制按钮（剪贴板可用时一键复制）。
func _build_url_row() -> VBoxContainer:
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 2)

	_url_edit = LineEdit.new()
	_url_edit.text = _build_tuning_url()
	_url_edit.editable = false
	_url_edit.add_theme_font_size_override("font_size", SMALL_FONT_SIZE)
	_url_edit.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	column.add_child(_url_edit)

	var copy := Button.new()
	copy.text = "复制调参 URL"
	copy.add_theme_font_size_override("font_size", SMALL_FONT_SIZE)
	copy.pressed.connect(_on_copy_pressed)
	column.add_child(copy)
	return column


## 拖动滑杆：即时经唯一入口 apply_tuning() 应用（钳制后生效），并刷新数值读出。
func _on_slider_changed(value: float, key: String) -> void:
	GameState.apply_tuning({key: value})
	_refresh_value_label(key)


## 复制调参 URL：优先 navigator.clipboard（异步、失败静默），URL 展示框始终可人工复制。
func _on_copy_pressed() -> void:
	if _url_edit == null:
		return
	var url := _build_tuning_url()
	var script := (
		"navigator.clipboard && navigator.clipboard.writeText(%s).catch(function(e){})"
		% JSON.stringify(url)
	)
	JavaScriptBridge.eval(script, true)
	_url_edit.text = url


## 当前调参 URL：页面地址 + ?tuning=<urlencoded JSON>（GameState 当前值序列化）。
func _build_tuning_url() -> String:
	var data: Dictionary = {}
	for key: String in GameState.TUNING_META:
		data[key] = GameState.get(key)
	var origin: String = str(
		JavaScriptBridge.eval("location.origin + location.pathname", true)
	)
	return origin + "?tuning=" + JSON.stringify(data).uri_encode()


## 数值读出：整型键显示整数，浮点键保留 2 位小数。
func _refresh_value_label(key: String) -> void:
	var label: Label = _value_labels.get(key)
	if label == null:
		return
	var current: Variant = GameState.get(key)
	label.text = str(current) if typeof(current) == TYPE_INT else "%.2f" % [float(current)]
