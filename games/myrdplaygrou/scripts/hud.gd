class_name Hud
extends Control
## 战斗 HUD：顶部资源条（阳光 / 出战卡 / 波次 / 生命 / 静音 / 重开）+ 底部操作提示。
## 控件全部代码构建，样式统一走 FlatUI（风格卡 flat-bright-pvz）；
## 结果性事件的反馈挂在 *_changed 处理函数上（SKILL.md §3B），不挂在输入上。

## HUD 条高度。
const BAR_H: float = 64.0

signal restart_requested

var _sun_label: Label
var _card_cost_label: Label
var _card_panel: PanelContainer
var _wave_label: Label
var _lives_label: Label
var _mute_button: Button
var _hint_label: Label
var _prev_lives: int = GameState.START_LIVES


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_build()
	GameState.sun_changed.connect(_on_sun_changed)
	GameState.lives_changed.connect(_on_lives_changed)
	GameState.wave_changed.connect(_on_wave_changed)
	GameState.game_ended.connect(_on_game_ended)
	_on_sun_changed(GameState.sun)
	_on_wave_changed(GameState.wave_index, GameState.wave_count())


func _build() -> void:
	# 顶栏
	var bar := PanelContainer.new()
	bar.name = "TopBar"
	var sb := FlatUI.box(FlatUI.PAPER, FlatUI.INK, 0, 0)
	sb.content_margin_left = 12.0
	sb.content_margin_right = 12.0
	sb.content_margin_top = 8.0
	sb.content_margin_bottom = 8.0
	bar.add_theme_stylebox_override("panel", sb)
	bar.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE)
	bar.offset_bottom = BAR_H
	bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(bar)

	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 14)
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	bar.add_child(row)

	# 阳光余额（强调色徽标）
	var chip := PanelContainer.new()
	chip.add_theme_stylebox_override("panel", FlatUI.box(FlatUI.ORANGE, FlatUI.ORANGE_DARK, 2))
	chip.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	chip.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(chip)
	var chip_row := HBoxContainer.new()
	chip_row.add_theme_constant_override("separation", 6)
	chip_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	chip.add_child(chip_row)
	chip_row.add_child(HudSunIcon.new())
	_sun_label = FlatUI.label(str(GameState.sun), FlatUI.FONT_BODY)
	chip_row.add_child(_sun_label)

	# 出战卡（当前唯一防御单位；选中态 = 蓝色描边；阳光不足时降透明度提示）
	_card_panel = PanelContainer.new()
	_card_panel.add_theme_stylebox_override("panel", FlatUI.box(FlatUI.GREEN_LIGHT, FlatUI.BLUE, 3))
	_card_panel.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	_card_panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(_card_panel)
	var card_row := HBoxContainer.new()
	card_row.add_theme_constant_override("separation", 8)
	card_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_card_panel.add_child(card_row)
	card_row.add_child(HudPeaIcon.new())
	var card_text := VBoxContainer.new()
	card_text.add_theme_constant_override("separation", 0)
	card_text.mouse_filter = Control.MOUSE_FILTER_IGNORE
	card_row.add_child(card_text)
	card_text.add_child(FlatUI.label("豌豆射手", FlatUI.FONT_ASSIST))
	_card_cost_label = FlatUI.label(str(int(GameState.defender_cost)), FlatUI.FONT_ASSIST, FlatUI.ORANGE_DARK)
	card_text.add_child(_card_cost_label)

	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	spacer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(spacer)

	# 波次 / 生命
	_wave_label = FlatUI.label("第 1/1 波", FlatUI.FONT_BODY)
	_wave_label.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	row.add_child(_wave_label)
	_lives_label = FlatUI.label("生命 %d" % GameState.lives, FlatUI.FONT_BODY)
	_lives_label.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	row.add_child(_lives_label)

	# 静音 / 重开（触屏优先：≥48px 热区）
	_mute_button = Button.new()
	FlatUI.apply_button(_mute_button, FlatUI.BLUE)
	_mute_button.text = "音效 开" if not Audio.is_muted() else "音效 关"
	_mute_button.custom_minimum_size = Vector2(96, 48)
	_mute_button.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	_mute_button.focus_mode = Control.FOCUS_NONE
	_mute_button.pressed.connect(_on_mute_pressed)
	row.add_child(_mute_button)

	var restart_button := Button.new()
	FlatUI.apply_button(restart_button, FlatUI.ORANGE)
	restart_button.text = "重开"
	restart_button.custom_minimum_size = Vector2(88, 48)
	restart_button.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	restart_button.focus_mode = Control.FOCUS_NONE
	restart_button.pressed.connect(_on_restart_pressed)
	row.add_child(restart_button)

	# 底部操作提示（辅助信息档）
	_hint_label = FlatUI.label("", FlatUI.FONT_ASSIST)
	_hint_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_hint_label.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_WIDE)
	_hint_label.offset_top = -26.0
	_hint_label.offset_bottom = -4.0
	_hint_label.modulate.a = 0.8
	add_child(_hint_label)


func set_hint(text: String) -> void:
	_hint_label.text = text


func _on_sun_changed(sun: int) -> void:
	_sun_label.text = str(sun)
	_card_cost_label.text = str(int(GameState.defender_cost))
	# 出战卡可负担性提示（纯视觉，不拦截布防——点下去有 fail 反馈兜底）
	_card_panel.modulate.a = 1.0 if sun >= int(GameState.defender_cost) else 0.55
	Juice.pop(_sun_label)


func _on_lives_changed(lives: int) -> void:
	var lost := lives < _prev_lives
	_prev_lives = lives
	_lives_label.text = "生命 %d" % lives
	if lost:
		_lives_label.add_theme_color_override("font_color", FlatUI.RED if lives <= 1 else FlatUI.INK)
		Juice.flash(_lives_label, Color(1, 0.45, 0.45, 0.9))
		Juice.pop(_lives_label)


func _on_wave_changed(wave: int, wave_count: int) -> void:
	_wave_label.text = "第 %d/%d 波" % [wave + 1, wave_count]
	Juice.pop(_wave_label)


func _on_game_ended(won: bool) -> void:
	_wave_label.text = "防守成功！" if won else "防线失守"
	Juice.pop(_wave_label)


func _on_mute_pressed() -> void:
	var muted := not Audio.is_muted()
	Audio.set_muted(muted)
	_mute_button.text = "音效 关" if muted else "音效 开"
	Juice.pop(_mute_button)
	if not muted:
		Juice.sfx(&"confirm")


func _on_restart_pressed() -> void:
	Juice.sfx(&"confirm")
	restart_requested.emit()


## ── 迷你图标（内嵌小类，只画不交互）──

class HudSunIcon extends Control:
	func _init() -> void:
		custom_minimum_size = Vector2(26, 26)
		mouse_filter = Control.MOUSE_FILTER_IGNORE
	func _draw() -> void:
		var c := Vector2(13, 13)
		for i in 8:
			var angle := TAU * float(i) / 8.0
			var dir := Vector2(cos(angle), sin(angle))
			draw_line(c + dir * 9.0, c + dir * 12.0, FlatUI.ORANGE_DARK, 2.0)
		draw_circle(c, 8.0, FlatUI.INK)
		draw_circle(c, 7.0, Color("f7dc8f"))


class HudPeaIcon extends Control:
	func _init() -> void:
		custom_minimum_size = Vector2(34, 40)
		mouse_filter = Control.MOUSE_FILTER_IGNORE
	func _draw() -> void:
		# 迷你豌豆射手：茎 + 圆头 + 嘴管（与战场 Defender 同一形状语言）
		draw_rect(Rect2(14, 22, 6, 14), FlatUI.GREEN_DARK)
		draw_circle(Vector2(17, 18), 11.0, FlatUI.GREEN)
		draw_arc(Vector2(17, 18), 11.0, 0.0, TAU, 20, FlatUI.INK, 2.0)
		draw_rect(Rect2(26, 13, 7, 10), FlatUI.GREEN)
		draw_rect(Rect2(20, 11, 4, 4), FlatUI.INK)
