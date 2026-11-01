class_name Hud
extends Control
## 战斗 HUD：顶部资源条（阳光 / 出战卡片 ×5 / 波次 / 生命 / 返回 / 重开 / 下一波）
## + 底部操作提示。控件全部代码构建，样式统一走 FlatUI（风格卡 flat-bright-pvz v2）：
## 深底（UI_BASE）+ 浅字（UI_TEXT）+ 主色件（UI_PRIMARY），对比度机判见 tests/smoke.gd。
## 结果性事件的反馈挂在 *_changed 处理函数上（SKILL.md §3B），不挂在输入上。
## 排版硬底线：操作提示不常驻 —— 开局浮现，停留 hint_show_seconds 后淡出（set_hint）。
## 静音开关不在本层：常驻按钮见 mute_button.gd（选关 / 结算 / 对局全程可见，spec audio.mute）。

## HUD 条高度。
const BAR_H: float = 64.0
## 操作提示淡出时长（秒）。
const HINT_FADE_TIME: float = 0.5
## 卡片按钮尺寸（两行：短名 / 费用或原因；触屏热区 ≥44px，风格卡 ui 段）。
const CARD_SIZE := Vector2(84, 48)

signal restart_requested
signal back_requested
signal skip_wave_requested

var _sun_label: Label
var _card_buttons: Array[Button] = []
var _card_states: Array[String] = []
var _wave_label: Label
var _lives_label: Label
var _skip_wave_button: Button
var _hint_label: Label
var _hint_tween: Tween
var _prev_lives: int = GameState.START_LIVES


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_build()
	GameState.sun_changed.connect(_on_sun_changed)
	GameState.lives_changed.connect(_on_lives_changed)
	GameState.wave_changed.connect(_on_wave_changed)
	GameState.card_selected.connect(_on_card_selected)
	GameState.game_ended.connect(_on_game_ended)
	_on_sun_changed(GameState.sun)
	_on_wave_changed(GameState.wave_index, GameState.wave_count())


func _build() -> void:
	# 顶栏（深底：spec ui-text-vs-ui-base / sun-counter-vs-ui-base 两对对比度的背景侧）
	var bar := PanelContainer.new()
	bar.name = "TopBar"
	var sb := FlatUI.box(FlatUI.UI_BASE, FlatUI.UI_BASE, 0, 0)
	sb.content_margin_left = 10.0
	sb.content_margin_right = 10.0
	sb.content_margin_top = 8.0
	sb.content_margin_bottom = 8.0
	bar.add_theme_stylebox_override("panel", sb)
	bar.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE)
	bar.offset_bottom = BAR_H
	bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(bar)

	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	bar.add_child(row)

	# 阳光余额（阳光拾取物同源色数字 —— sun-counter-vs-ui-base 对）
	var chip := PanelContainer.new()
	chip.add_theme_stylebox_override("panel", FlatUI.box(FlatUI.UI_BASE, FlatUI.OUTLINE, 2, 6))
	chip.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	chip.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(chip)
	var chip_row := HBoxContainer.new()
	chip_row.add_theme_constant_override("separation", 5)
	chip_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	chip.add_child(chip_row)
	chip_row.add_child(HudSunIcon.new())
	_sun_label = FlatUI.label(str(GameState.sun), FlatUI.FONT_BODY, FlatUI.SUN_PICKUP)
	chip_row.add_child(_sun_label)

	# 出战卡片 ×5（点按选卡 → 点草坪布防；再点已选卡取消；冷却/阳光不足 = 禁用态 + 原因）
	for i in GameState.CARDS.size():
		var button := Button.new()
		FlatUI.apply_button_on_dark(button, FlatUI.UI_PRIMARY, FlatUI.FONT_ASSIST)
		button.custom_minimum_size = CARD_SIZE
		button.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		button.focus_mode = Control.FOCUS_NONE
		button.pressed.connect(_on_card_pressed.bind(i))
		row.add_child(button)
		_card_buttons.append(button)
		_card_states.append("")
	_refresh_cards()

	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	spacer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(spacer)

	# 下一波（波间等待时可点，提前召唤 —— spec input.next-wave 可选操作）
	_skip_wave_button = Button.new()
	FlatUI.apply_button_on_dark(_skip_wave_button, FlatUI.ORANGE_DARK)
	_skip_wave_button.text = "下一波"
	_skip_wave_button.custom_minimum_size = Vector2(84, 48)
	_skip_wave_button.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	_skip_wave_button.focus_mode = Control.FOCUS_NONE
	_skip_wave_button.pressed.connect(_on_skip_wave_pressed)
	_skip_wave_button.visible = false
	row.add_child(_skip_wave_button)

	# 波次 / 生命
	_wave_label = FlatUI.label("第 1/1 波", FlatUI.FONT_BODY, FlatUI.UI_TEXT)
	_wave_label.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	row.add_child(_wave_label)
	_lives_label = FlatUI.label("生命 %d" % GameState.lives, FlatUI.FONT_BODY, FlatUI.UI_TEXT)
	_lives_label.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	row.add_child(_lives_label)

	# 返回 / 重开（触屏优先：≥44px 热区；静音在常驻层 mute_button.gd）
	var back_button := Button.new()
	FlatUI.apply_button_on_dark(back_button, FlatUI.GRAY_DARK)
	back_button.text = "返回"
	back_button.custom_minimum_size = Vector2(68, 48)
	back_button.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	back_button.focus_mode = Control.FOCUS_NONE
	back_button.pressed.connect(_on_back_pressed)
	row.add_child(back_button)

	var restart_button := Button.new()
	FlatUI.apply_button_on_dark(restart_button, FlatUI.ORANGE)
	restart_button.text = "重开"
	restart_button.custom_minimum_size = Vector2(68, 48)
	restart_button.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	restart_button.focus_mode = Control.FOCUS_NONE
	restart_button.pressed.connect(_on_restart_pressed)
	row.add_child(restart_button)

	# 底部操作提示（辅助信息档；开局浮现，超时自动淡出 —— 不常驻）
	_hint_label = FlatUI.label("", FlatUI.FONT_ASSIST)
	_hint_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_hint_label.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_WIDE)
	_hint_label.offset_top = -30.0
	_hint_label.offset_bottom = -6.0
	add_child(_hint_label)


func set_hint(text: String) -> void:
	_hint_label.text = text
	_hint_label.modulate.a = 1.0
	if _hint_tween != null:
		_hint_tween.kill()
	_hint_tween = create_tween()
	_hint_tween.tween_interval(maxf(GameState.hint_show_seconds, 0.0))
	_hint_tween.tween_property(_hint_label, "modulate:a", 0.0, HINT_FADE_TIME)


## 冒烟断言入口：操作提示当前不透明度（1 = 完全可见，0 = 已淡出）。
func hint_alpha() -> float:
	return _hint_label.modulate.a


## 波间等待态切换（「下一波」按钮可见性）。
func set_wave_wait_visible(waiting: bool) -> void:
	_skip_wave_button.visible = waiting and GameState.running


## 卡片状态刷新：两行文案（短名 / 费用或禁用原因）+ 选中描边 + 禁用态。
## 冷却倒计时逐秒变 —— 由 _process 驱动，状态签名不变时零重排。
func _process(_delta: float) -> void:
	_refresh_cards()


func _refresh_cards() -> void:
	for i in _card_buttons.size():
		var card: Dictionary = GameState.card_at(i)
		var id: StringName = card.get("id", &"peashooter") as StringName
		var selected: bool = i == GameState.selected_card
		var reason := GameState.card_block_reason(i)
		# 状态签名 = 选中态 + 禁用原因 + 冷却秒（0.1s 粒度）；不变则跳过重排
		var cooldown_left := GameState.card_cooldowns[i] if i < GameState.card_cooldowns.size() else 0.0
		var signature := "%d|%s|%.1f" % [1 if selected else 0, reason, cooldown_left]
		if _card_states[i] == signature:
			continue
		_card_states[i] = signature
		var border := FlatUI.SUN_PICKUP if selected else FlatUI.OUTLINE
		var border_w := 3 if selected else 2
		var detail := "%d" % GameState.card_cost_of(id)
		if reason == "冷却中":
			detail = "冷却 %.0fs" % ceill(cooldown_left)
		elif reason == "阳光不足":
			detail = "缺阳光"
		elif reason == "未选卡":
			detail = "%d" % GameState.card_cost_of(id)
		var button := _card_buttons[i]
		button.text = "%s\n%s" % [String(card.get("tag", "")), detail]
		button.add_theme_stylebox_override("normal",
			FlatUI.box(FlatUI.UI_PRIMARY, border, border_w))
		button.add_theme_stylebox_override("hover",
			FlatUI.box(FlatUI.UI_PRIMARY.lightened(0.08), border, border_w))
		button.add_theme_stylebox_override("focus",
			FlatUI.box(FlatUI.UI_PRIMARY.lightened(0.08), border, border_w))
		button.add_theme_stylebox_override("pressed",
			FlatUI.box(FlatUI.UI_PRIMARY.darkened(0.08), border, border_w))
		button.modulate.a = 1.0 if reason == "" else 0.55


func _on_sun_changed(sun: int) -> void:
	_sun_label.text = str(sun)
	Juice.pop(_sun_label)


func _on_card_pressed(index: int) -> void:
	GameState.select_card(index)
	Juice.sfx(&"confirm")
	Juice.pop(_card_buttons[index])


func _on_card_selected(_index: int) -> void:
	_refresh_cards()


func _on_lives_changed(lives: int) -> void:
	var lost := lives < _prev_lives
	_prev_lives = lives
	_lives_label.text = "生命 %d" % lives
	if lost:
		_lives_label.add_theme_color_override("font_color", FlatUI.RED if lives <= 1 else FlatUI.UI_TEXT)
		Juice.flash(_lives_label, Color(1, 0.45, 0.45, 0.9))
		Juice.pop(_lives_label)


func _on_wave_changed(wave: int, wave_count: int) -> void:
	_wave_label.text = "第 %d/%d 波" % [wave + 1, wave_count]
	Juice.pop(_wave_label)


func _on_game_ended(won: bool) -> void:
	_wave_label.text = "防守成功！" if won else "防线失守"
	Juice.pop(_wave_label)
	set_wave_wait_visible(false)


func _on_skip_wave_pressed() -> void:
	Juice.sfx(&"confirm")
	skip_wave_requested.emit()


func _on_back_pressed() -> void:
	Juice.sfx(&"confirm")
	back_requested.emit()


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
		draw_circle(c, 8.0, FlatUI.OUTLINE)
		draw_circle(c, 7.0, FlatUI.SUN_PICKUP)
