class_name TuningPanel
extends CanvasLayer
## 调参工作台：运行时覆盖 gameplay.cfg 数值的可视化面板（只改内存，不写回 cfg 文件）。
##
## 打开方式：
## - Web 端：URL 带 `?tuning=1`（JavaScriptBridge 读 window.location.search）；
## - 桌面 / 无头：按 T 键切换（headless 无输入设备，冒烟不受影响）。
##
## 规范要点：
## - 数值唯一来源仍是 config/gameplay.cfg（autoload/game_config.gd 启动时读入）；
##   本面板只在运行时改 GameConfig 的属性，等价于 main.gd _apply_difficulty 的推导链路；
## - 调参链接回填契约：「复制调参链接」生成的 ?tuning=1&key=value…，下次打开时由
##   parse_tuning_query（静态、可机判）解析 + apply_parsed_tuning 应用 —— 缺这一环，
##   试玩调好的数值无法用 URL 复现，回填闭环断裂；
## - 改陨石数量类键后调用 MainScene.respawn_field(-1) 才能落到场上；
## - 纯代码构建 UI（与 virtual_joystick.gd 同风格：无图片素材，模板复制即用）。

## 面板里暴露的配置键 → 语义（键名与 config/gameplay.cfg [gameplay] 段一一对应）。
const TUNABLE_KEYS: Array[String] = [
	"max_crystals",
	"max_asteroids",
	"score_per_crystal",
	"damage_per_hit",
	"initial_shield",
	"player_speed",
	"asteroid_speed_min",
	"asteroid_speed_max",
	"respawn_delay_seconds",
	"difficulty_step",
	"difficulty_asteroids_per_level",
	"difficulty_asteroids_cap",
	"difficulty_speed_per_level",
	"difficulty_speed_cap_scale",
	"score_target",
	"milestone_step",
	"invincibility_seconds",
]

## 每个键的滑杆量程（min/max/step）：覆盖 cfg 默认值并留出两侧调参余量。
const KEY_RANGES: Dictionary = {
	"max_crystals": [1.0, 20.0, 1.0],
	"max_asteroids": [0.0, 20.0, 1.0],
	"score_per_crystal": [1.0, 10.0, 1.0],
	"damage_per_hit": [0.0, 5.0, 1.0],
	"initial_shield": [1.0, 10.0, 1.0],
	"player_speed": [80.0, 600.0, 10.0],
	"asteroid_speed_min": [0.0, 300.0, 5.0],
	"asteroid_speed_max": [10.0, 400.0, 5.0],
	"respawn_delay_seconds": [0.0, 5.0, 0.1],
	"difficulty_step": [0.0, 30.0, 1.0],
	"difficulty_asteroids_per_level": [0.0, 5.0, 1.0],
	"difficulty_asteroids_cap": [1.0, 30.0, 1.0],
	"difficulty_speed_per_level": [0.0, 0.6, 0.05],
	"difficulty_speed_cap_scale": [1.0, 3.0, 0.05],
	"score_target": [0.0, 60.0, 1.0],
	"milestone_step": [0.0, 30.0, 1.0],
	"invincibility_seconds": [0.0, 3.0, 0.05],
}

## URL 里的开关参数名。
const URL_PARAM: String = "tuning"
## 桌面端的开关按键。
const TOGGLE_KEY: Key = KEY_T

var _root: PanelContainer
var _rows: Dictionary = {}
var _status_label: Label
var _open: bool = false
var _main: MainScene
## 剪贴板写入结果（navigator.clipboard 在非安全上下文 / 被拒时不可用）。
var _clipboard_ok: bool = false


func _ready() -> void:
	layer = 20
	visible = false
	_main = get_parent() as MainScene
	var applied_from_url: int = 0
	if _should_open_from_url():
		# 先应用 URL 里的候选数值、再构建滑杆行：行标签与滑杆初值才会显示调参后的值。
		applied_from_url = _apply_from_url()
	_build_ui()
	if _should_open_from_url():
		set_open(true)
		if applied_from_url > 0:
			_status_label.text = "已从调参链接应用 %d 项数值（只改本局运行时，刷新前不会写回 cfg）" % applied_from_url


## 从当前页面 URL 解析并应用候选数值，返回成功应用的键数（仅 Web 端调用）。
func _apply_from_url() -> int:
	if not OS.has_feature("web"):
		return 0
	var search: Variant = JavaScriptBridge.eval("window.location.search", true)
	if search == null:
		return 0
	return apply_tuning_query(str(search))


## 把调参链接 query 串（"?tuning=1&key=value…"）解析成可应用数值表。
## 静态纯函数：只认 TUNABLE_KEYS 声明的键、按 KEY_RANGES 钳制到量程并吸附到步长；
## 未知键 / 非法数值一律忽略 —— 冒烟以它机判「调参链接打开即复现候选数值」契约。
static func parse_tuning_query(search: String) -> Dictionary:
	var values: Dictionary = {}
	for pair in search.lstrip("?").split("&", false):
		var parts := pair.split("=", true, 1)
		if parts.size() != 2:
			continue
		var key := parts[0]
		if key not in TUNABLE_KEYS:
			continue
		if not parts[1].is_valid_float():
			continue  # 非数值（如 abc）忽略，避免 to_float 失败返回 0 被误应用为下限
		var value := parts[1].to_float()
		if not is_finite(value):
			continue
		var range_values: Array = KEY_RANGES[key]
		var step: float = float(range_values[2])
		values[key] = clampf(snappedf(value, step), float(range_values[0]), float(range_values[1]))
	return values


## 应用 parse_tuning_query 的结果到 GameConfig（运行时覆盖，cfg 文件不动）；
## 数量类键触发重铺战场让改动立即落到场上。返回应用的键数。
func apply_parsed_tuning(values: Dictionary) -> int:
	var applied: int = 0
	for key: String in values:
		var current: Variant = GameConfig.get(key)
		if current == null:
			continue
		GameConfig.set(key, int(round(values[key])) if current is int else values[key])
		applied += 1
		_sync_row(key)
	if values.has("max_crystals") or values.has("max_asteroids"):
		if _main != null:
			_main.respawn_field(-1)
	return applied


func apply_tuning_query(search: String) -> int:
	return apply_parsed_tuning(parse_tuning_query(search))


## 把某一行滑杆与标签刷成 GameConfig 当前值（URL 应用后同步 UI）。
func _sync_row(key: String) -> void:
	var label: Label = _rows.get(key)
	if label == null or _root == null:
		return
	label.text = "%s = %s" % [key, _config_value_text(key)]
	var slider := _root.find_child("%sSlider" % key, true, false) as HSlider
	if slider != null:
		slider.set_value_no_signal(float(GameConfig.get(key)))


## Web 端从 URL 参数开启；非 Web（桌面 / headless）一律走 T 键，避免 JavaScriptBridge 报错。
func _should_open_from_url() -> bool:
	if not OS.has_feature("web"):
		return false
	var search: String = ""
	if JavaScriptBridge.eval("window.location.search", true) != null:
		search = str(JavaScriptBridge.eval("window.location.search", true))
	if search.is_empty():
		return false
	return search.contains("%s=1" % URL_PARAM)


func _unhandled_key_input(event: InputEvent) -> void:
	var key := event as InputEventKey
	if key == null or not key.pressed or key.echo:
		return
	if key.physical_keycode == TOGGLE_KEY:
		set_open(not _open)
		get_viewport().set_input_as_handled()


func set_open(open_value: bool) -> void:
	_open = open_value
	visible = _open


func _build_ui() -> void:
	_root = PanelContainer.new()
	_root.name = "TuningRoot"
	_root.custom_minimum_size = Vector2(300.0, 0.0)
	_root.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	_root.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	_root.grow_vertical = Control.GROW_DIRECTION_END
	_root.offset_right = -8.0
	_root.offset_top = 8.0
	_root.modulate = Color(1.0, 1.0, 1.0, 0.94)
	add_child(_root)

	var box := VBoxContainer.new()
	box.name = "Box"
	box.add_theme_constant_override("separation", 4)
	_root.add_child(box)

	var title := Label.new()
	title.text = "调参工作台（T 键关闭）"
	title.add_theme_font_size_override("font_size", 14)
	title.add_theme_color_override("font_color", Color(1.0, 0.92, 0.5))
	box.add_child(title)

	# 行数多于视口高度：放进 ScrollContainer，面板整体不超过 640x360 视口。
	var scroll := ScrollContainer.new()
	scroll.name = "Rows"
	scroll.custom_minimum_size = Vector2(300.0, 196.0)
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	box.add_child(scroll)

	var rows_box := VBoxContainer.new()
	rows_box.name = "RowsBox"
	rows_box.add_theme_constant_override("separation", 4)
	scroll.add_child(rows_box)

	for key in TUNABLE_KEYS:
		rows_box.add_child(_build_row(key))

	_status_label = Label.new()
	_status_label.text = " "
	_status_label.add_theme_font_size_override("font_size", 11)
	_status_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	box.add_child(_status_label)

	var copy_button := Button.new()
	copy_button.text = "复制调参链接"
	copy_button.add_theme_font_size_override("font_size", 13)
	copy_button.pressed.connect(_on_copy_link_pressed)
	box.add_child(copy_button)


## 单行控件：标签（当前值）+ 滑杆。滑杆拖动即时写回 GameConfig 并按需重铺战场。
func _build_row(key: String) -> HBoxContainer:
	var range_values: Array = KEY_RANGES[key]
	var row := HBoxContainer.new()
	row.name = "%sRow" % key

	var label := Label.new()
	label.custom_minimum_size = Vector2(150.0, 0.0)
	label.add_theme_font_size_override("font_size", 11)
	label.text = "%s = %s" % [key, _config_value_text(key)]
	row.add_child(label)

	var slider := HSlider.new()
	slider.name = "%sSlider" % key
	slider.min_value = range_values[0]
	slider.max_value = range_values[1]
	slider.step = range_values[2]
	slider.value = float(GameConfig.get(key))
	slider.custom_minimum_size = Vector2(130.0, 16.0)
	slider.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	slider.value_changed.connect(_on_slider_changed.bind(key, label))
	row.add_child(slider)

	_rows[key] = label
	return row


func _config_value_text(key: String) -> String:
	var value: Variant = GameConfig.get(key)
	return "%d" % value if value is int else "%.2f" % float(value)


func _on_slider_changed(value: float, key: String, label: Label) -> void:
	var current: Variant = GameConfig.get(key)
	GameConfig.set(key, int(round(value)) if current is int else value)
	label.text = "%s = %s" % [key, _config_value_text(key)]
	# 数量类键只影响后续生成：重铺战场让改动立刻可见（运行时覆盖，cfg 文件不动）。
	if key == "max_crystals" or key == "max_asteroids":
		if _main != null:
			_main.respawn_field(-1)


## 把当前数值序列化进 URL query 并写剪贴板；失败时把链接直接展示出来让人手抄。
func _on_copy_link_pressed() -> void:
	var query := PackedStringArray()
	query.append("%s=1" % URL_PARAM)
	for key in TUNABLE_KEYS:
		query.append("%s=%s" % [key, _config_value_text(key)])
	var base_url := _current_base_url()
	var link := "%s?%s" % [base_url, "&".join(query)]
	_status_label.text = "写入剪贴板…"
	await _write_clipboard(link)
	if _clipboard_ok:
		_status_label.text = "已复制调参链接：\n%s" % link
	else:
		_status_label.text = "剪贴板不可用，请手抄：\n%s" % link


## Web 端 writeText 是异步的：用 JS 全局标志承接回调结果，短暂等待后回读判定成败；
## 桌面端走 DisplayServer.clipboard_set（同步）。失败时调用方直接把链接展示出来。
func _write_clipboard(text_value: String) -> void:
	_clipboard_ok = false
	if not OS.has_feature("web"):
		DisplayServer.clipboard_set(text_value)
		_clipboard_ok = true
		return
	var payload := JSON.stringify(text_value)
	JavaScriptBridge.eval(
		"window.__sdTuningCopied=0;(function(){var t=%s;" % payload
		+ "if(navigator.clipboard&&navigator.clipboard.writeText){"
		+ "navigator.clipboard.writeText(t).then(function(){window.__sdTuningCopied=1;})"
		+ ".catch(function(){window.__sdTuningCopied=0;});}})()", true)
	if get_tree() != null:
		await get_tree().create_timer(0.4).timeout
	var flag: Variant = JavaScriptBridge.eval("window.__sdTuningCopied", true)
	_clipboard_ok = str(flag) == "1"


## 当前页面地址（去掉既有 query / hash）；拿不到就退化为「?key=value」相对形式。
func _current_base_url() -> String:
	if OS.has_feature("web"):
		var href: Variant = JavaScriptBridge.eval("window.location.href.split(/[?#]/)[0]", true)
		if href != null:
			return str(href)
	return ""
