class_name ResultOverlay
extends CanvasLayer
## 结算浮层：胜利 / 失败双出口（下一关或再试 + 返回选关）。
## 弹出后 400ms 内不接受确认输入，防连点误触直接跳过结算。

signal primary_pressed
signal level_select_pressed

const ACCEPT_DELAY_MS: int = 400

var _title: Label
var _subtitle: Label
var _primary: Button
var _select_button: Button
var _action: String = "retry"
var _shown_ms: int = 0


func _ready() -> void:
	layer = 30
	visible = false
	_build()


func _build() -> void:
	var dim := ColorRect.new()
	dim.color = Color(FlatUI.INK, 0.55)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(dim)

	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(center)

	var panel := PanelContainer.new()
	var sb := FlatUI.box(FlatUI.PAPER, FlatUI.INK, 2)
	sb.content_margin_left = 32.0
	sb.content_margin_right = 32.0
	sb.content_margin_top = 24.0
	sb.content_margin_bottom = 24.0
	panel.add_theme_stylebox_override("panel", sb)
	center.add_child(panel)

	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 16)
	column.alignment = BoxContainer.ALIGNMENT_CENTER
	panel.add_child(column)

	_title = FlatUI.label("防守成功！", FlatUI.FONT_TITLE)
	_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(_title)

	_subtitle = FlatUI.label("", FlatUI.FONT_ASSIST, FlatUI.GRAY_DARK)
	_subtitle.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(_subtitle)

	var buttons := HBoxContainer.new()
	buttons.add_theme_constant_override("separation", 16)
	buttons.alignment = BoxContainer.ALIGNMENT_CENTER
	column.add_child(buttons)

	_primary = Button.new()
	FlatUI.apply_button(_primary, FlatUI.GREEN)
	_primary.text = "再试一次"
	_primary.custom_minimum_size = Vector2(168, 56)
	_primary.focus_mode = Control.FOCUS_NONE
	_primary.pressed.connect(_on_primary_pressed)
	buttons.add_child(_primary)

	_select_button = Button.new()
	FlatUI.apply_button(_select_button, FlatUI.BLUE)
	_select_button.text = "选关"
	_select_button.custom_minimum_size = Vector2(120, 56)
	_select_button.focus_mode = Control.FOCUS_NONE
	_select_button.pressed.connect(_on_select_pressed)
	buttons.add_child(_select_button)

	var hint_text := "空格 / 回车 = 主按钮"
	if GameState.touch_preferred():
		hint_text = "点按按钮继续"
	var hint := FlatUI.label(hint_text, FlatUI.FONT_ASSIST, FlatUI.GRAY_DARK)
	hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(hint)


## 展示结算（won=true 通关；最后一关通关后主按钮回「再玩一次」）。
## 胜利副标题带星级（剩余生命 5/3/1 → 3/2/1 星，spec content.replayHooks 星级结算）。
func show_result(won: bool, level_index: int, level_name: String, wave_count: int) -> void:
	var has_next := won and level_index + 1 < GameState.LEVELS.size()
	_title.text = "防守成功！" if won else "防线失守"
	_title.add_theme_color_override("font_color", FlatUI.GREEN_DARK if won else FlatUI.RED)
	if won:
		var stars := int(GameState.level_stars[level_index]) \
				if level_index < GameState.level_stars.size() else 0
		_subtitle.text = "守住了「%s」全部 %d 波 · ★x%d" % [level_name, wave_count, stars]
		_action = "next" if has_next else "replay"
		_primary.text = "下一关" if has_next else "再玩一次"
	else:
		_subtitle.text = "僵尸闯进了房子 ·「%s」共 %d 波" % [level_name, wave_count]
		_action = "retry"
		_primary.text = "再试一次"
	_shown_ms = Time.get_ticks_msec()
	visible = true
	Juice.pop(_title)


func close() -> void:
	visible = false


func can_accept() -> bool:
	var delay := GameState.overlay_accept_ms if GameState.overlay_accept_ms >= 0.0 \
		else float(ACCEPT_DELAY_MS)
	return visible and Time.get_ticks_msec() - _shown_ms >= delay


## 主按钮语义：retry / replay = 重开本关；next = 进下一关。
func primary_action() -> String:
	return _action


func press_primary() -> void:
	if can_accept():
		primary_pressed.emit()


func _on_primary_pressed() -> void:
	Juice.sfx(&"confirm")
	primary_pressed.emit()


func _on_select_pressed() -> void:
	Juice.sfx(&"confirm")
	level_select_pressed.emit()
