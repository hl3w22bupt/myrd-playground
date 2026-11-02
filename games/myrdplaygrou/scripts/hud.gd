class_name Hud
extends Control
## 战斗 HUD：顶部资源条（阳光 / 出战卡片 / 波次 / 生命 / 返回 / 重开 / 下一波）
## + 底部操作提示。控件全部代码构建，样式统一走 FlatUI（风格卡 flat-bright-pvz v4）：
## 深底（UI_BASE）+ 浅字（UI_TEXT）+ 主色件（UI_PRIMARY），对比度机判见 tests/smoke.gd。
## 结果性事件的反馈挂在 *_changed 处理函数上（SKILL.md §3B），不挂在输入上。
## 排版硬底线：操作提示不常驻 —— 开局浮现，停留 hint_show_seconds 后淡出（set_hint）。
## 静音开关不在本层：常驻按钮见 mute_button.gd（选关 / 结算 / 对局全程可见，spec audio.mute）。
##
## v4 响应式布局（本轮修复①「HUD 溢出」）：按钮统一 44px 触屏热区（原 48/56）、
## HUD 正文 18px（FlatUI.FONT_BODY 档下调）、间距收紧（行距 4 / 项距 6 / 内边距 6）；
## 顶栏按可用宽度自适应折行 —— 放不下单行 → 折两行 [状态+操作 | 卡片+下一波]，
## 还放不下 → 折三行 [阳光+波次+生命 | 卡片 | 下一波+返回+重开]（常驻 HUD ≤ 3 行硬底线）。
## 布局规划是纯函数（_plan_rows），生产重排与冒烟五档视口机判（360~2560px）同一实现。
##
## 挂件生命周期（2026-11-02 缺陷修复，冒烟挂件审计机判 widget_audit）：
## - 常驻挂件（下一波/波次/生命/返回/重开/操作提示）= _build() 一次性挂载，永不重建；
## - 出战卡随关卡槽（roster）变化 = rebuild_cards() 只重建卡片按钮。
## 旧实现 rebuild_cards 整行重建：每次开局多挂一套常驻挂件，旧挂件失联残留
## （波次/生命文案冻结成假信息、顶栏溢出），已由冒烟挂件审计断言拦死。

## 顶栏内边距（上下 / 左右）。
const BAR_PAD: float = 6.0
const BAR_PAD_X: float = 6.0
## 行间距 / 项间距（间距收紧：原顶栏单行 separation 8 → 6）。
const ROW_GAP: int = 4
const ROW_SEP: int = 6
## 按钮统一触屏热区（≥44px；本轮修复①：48/56 → 44）。
const BUTTON_H: float = 44.0
## 卡片按钮尺寸（两行：短名 / 费用或原因；宽 64 = 360 档视口 5 卡仍能单行成排）。
const CARD_SIZE := Vector2(64, 44)
## 操作提示淡出时长（秒）。
const HINT_FADE_TIME: float = 0.5

signal restart_requested
signal back_requested
signal skip_wave_requested

var _chip: PanelContainer
var _sun_label: Label
var _card_buttons: Array[Button] = []
var _card_states: Array[String] = []
var _card_row: HBoxContainer
var _skip_wave_button: Button
var _wave_label: Label
var _lives_label: Label
var _back_button: Button
var _restart_button: Button
var _bar: PanelContainer
var _rows: VBoxContainer
var _row_a: HBoxContainer
var _row_b: HBoxContainer
var _row_c: HBoxContainer
var _hint_label: Label
var _hint_tween: Tween
## 当前布局签名（行分配不变时零重排 —— 冷却倒计时逐帧刷新文本不触发重排）。
var _layout_signature: String = ""
var _prev_lives: int = GameState.START_LIVES


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_build()
	resized.connect(_relayout_deferred)
	GameState.sun_changed.connect(_on_sun_changed)
	GameState.lives_changed.connect(_on_lives_changed)
	GameState.wave_changed.connect(_on_wave_changed)
	GameState.card_selected.connect(_on_card_selected)
	GameState.game_ended.connect(_on_game_ended)
	_on_sun_changed(GameState.sun)
	_on_wave_changed(GameState.wave_index, GameState.wave_count())


func _build() -> void:
	# 顶栏（深底：spec ui-text-vs-ui-base / sun-counter-vs-ui-base 两对对比度的背景侧）
	_bar = PanelContainer.new()
	_bar.name = "TopBar"
	var sb := FlatUI.box(FlatUI.UI_BASE, FlatUI.UI_BASE, 0, 0)
	sb.content_margin_left = BAR_PAD_X
	sb.content_margin_right = BAR_PAD_X
	sb.content_margin_top = BAR_PAD
	sb.content_margin_bottom = BAR_PAD
	_bar.add_theme_stylebox_override("panel", sb)
	_bar.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE)
	_bar.offset_bottom = BUTTON_H + 2.0 * BAR_PAD
	_bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_bar)

	_rows = VBoxContainer.new()
	_rows.name = "Rows"
	_rows.add_theme_constant_override("separation", ROW_GAP)
	_rows.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_bar.add_child(_rows)
	_row_a = _make_row("RowA")
	_row_b = _make_row("RowB")
	_row_c = _make_row("RowC")

	# 阳光余额（阳光拾取物同源色数字 —— sun-counter-vs-ui-base 对）
	_chip = PanelContainer.new()
	_chip.name = "SunChip"
	_chip.add_theme_stylebox_override("panel", FlatUI.box(FlatUI.UI_BASE, FlatUI.OUTLINE, 2, 6))
	_chip.custom_minimum_size = Vector2(0, 36)
	_chip.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	_chip.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var chip_row := HBoxContainer.new()
	chip_row.add_theme_constant_override("separation", 4)
	chip_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_chip.add_child(chip_row)
	chip_row.add_child(HudSunIcon.new())
	var sun_label := FlatUI.label(str(GameState.sun), FlatUI.FONT_BODY, FlatUI.SUN_PICKUP)
	sun_label.name = "SunLabel"
	chip_row.add_child(sun_label)
	_sun_label = sun_label

	# 出战卡片（点按选卡 → 点草坪布防；再点已选卡取消；冷却/阳光不足 = 禁用态 + 原因）
	_build_card_buttons()

	# 下一波（波间等待时可点，提前召唤 —— spec input.next-wave 可选操作）
	_skip_wave_button = Button.new()
	_skip_wave_button.name = "SkipWave"
	FlatUI.apply_button_on_dark(_skip_wave_button, FlatUI.ORANGE_DARK)
	_skip_wave_button.text = "下一波"
	_skip_wave_button.custom_minimum_size = Vector2(70, BUTTON_H)
	_skip_wave_button.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	_skip_wave_button.focus_mode = Control.FOCUS_NONE
	_skip_wave_button.pressed.connect(_on_skip_wave_pressed)
	_skip_wave_button.visible = false

	# 波次 / 生命
	_wave_label = FlatUI.label("第 1/1 波", FlatUI.FONT_BODY, FlatUI.UI_TEXT)
	_wave_label.name = "WaveLabel"
	_wave_label.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	_lives_label = FlatUI.label("生命 %d" % GameState.lives, FlatUI.FONT_BODY, FlatUI.UI_TEXT)
	_lives_label.name = "LivesLabel"
	_lives_label.size_flags_vertical = Control.SIZE_SHRINK_CENTER

	# 返回 / 重开（触屏优先：44px 热区；静音在常驻层 mute_button.gd）
	_back_button = Button.new()
	_back_button.name = "Back"
	FlatUI.apply_button_on_dark(_back_button, FlatUI.GRAY_DARK)
	_back_button.text = "返回"
	_back_button.custom_minimum_size = Vector2(64, BUTTON_H)
	_back_button.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	_back_button.focus_mode = Control.FOCUS_NONE
	_back_button.pressed.connect(_on_back_pressed)

	_restart_button = Button.new()
	_restart_button.name = "Restart"
	FlatUI.apply_button_on_dark(_restart_button, FlatUI.ORANGE)
	_restart_button.text = "重开"
	_restart_button.custom_minimum_size = Vector2(64, BUTTON_H)
	_restart_button.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	_restart_button.focus_mode = Control.FOCUS_NONE
	_restart_button.pressed.connect(_on_restart_pressed)

	# 底部操作提示（辅助信息档；开局浮现，超时自动淡出 —— 不常驻）
	_hint_label = FlatUI.label("", FlatUI.FONT_ASSIST)
	_hint_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_hint_label.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_WIDE)
	_hint_label.offset_top = -30.0
	_hint_label.offset_bottom = -6.0
	add_child(_hint_label)

	_layout_signature = ""
	_relayout()


func _make_row(row_name: String) -> HBoxContainer:
	var row := HBoxContainer.new()
	row.name = row_name
	row.add_theme_constant_override("separation", ROW_SEP)
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	# 行尾 expand spacer：吸收余量、把行内容顶齐左缘（行分配由 _relayout 驱动）
	var spacer := Control.new()
	spacer.name = "Spacer"
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	spacer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(spacer)
	row.set_meta("spacer", spacer)
	_rows.add_child(row)
	return row


## 按当前关卡槽重建卡片按钮（start_level 后由 main 调用；L4 阳光紧缩关 4 张）。
func rebuild_cards() -> void:
	for button in _card_buttons:
		button.get_parent().remove_child(button)
		button.queue_free()
	_card_buttons.clear()
	_card_states.clear()
	_build_card_buttons()
	_layout_signature = ""
	_relayout()


func _build_card_buttons() -> void:
	if _card_row == null:
		_card_row = _row_a  # 初值；_relayout 后指向卡片实际所在行
	for i in GameState.roster().size():
		var button := Button.new()
		button.name = "Card%d" % i
		FlatUI.apply_button_on_dark(button, FlatUI.UI_PRIMARY, FlatUI.FONT_ASSIST)
		button.custom_minimum_size = CARD_SIZE
		button.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		button.focus_mode = Control.FOCUS_NONE
		button.pressed.connect(_on_card_pressed.bind(i))
		_card_row.add_child(button)
		_card_buttons.append(button)
		_card_states.append("")
	_refresh_cards()


## ── 响应式布局（本轮修复①核心）──

## 布局规划（纯函数，生产重排与冒烟五档视口机判同一实现）：
## 返回行的数组（每行 = Control 数组，不含 spacer）。策略：
##   ① 全部塞一行放得下 → 1 行；
##   ② 否则折两行 [阳光+波次+生命+返回+重开 | 卡片+下一波]，两行都放得下才用；
##   ③ 否则折三行 [阳光+波次+生命 | 卡片 | 下一波+返回+重开]（常驻 HUD ≤ 3 行硬底线）。
func _plan_rows(avail: float, skip_visible: bool) -> Array:
	var content_w := maxf(avail - 2.0 * BAR_PAD_X, 0.0)
	var chip_widgets: Array[Control] = [_chip]
	var meta_widgets: Array[Control] = [_wave_label, _lives_label]
	var action_widgets: Array[Control] = [_back_button, _restart_button]
	var card_widgets: Array[Control] = []
	for button in _card_buttons:
		card_widgets.append(button)
	var skip_widgets: Array[Control] = []
	if skip_visible:
		skip_widgets.append(_skip_wave_button)
	var single: Array[Control] = []
	single.append_array(chip_widgets)
	single.append_array(card_widgets)
	single.append_array(skip_widgets)
	single.append_array(meta_widgets)
	single.append_array(action_widgets)
	if _widgets_min_width(single) <= content_w:
		return [single]
	var row_a: Array[Control] = []
	row_a.append_array(chip_widgets)
	row_a.append_array(meta_widgets)
	row_a.append_array(action_widgets)
	var row_b: Array[Control] = []
	row_b.append_array(card_widgets)
	row_b.append_array(skip_widgets)
	if _widgets_min_width(row_a) <= content_w and _widgets_min_width(row_b) <= content_w:
		return [row_a, row_b]
	var top: Array[Control] = []
	top.append_array(chip_widgets)
	top.append_array(meta_widgets)
	var bottom: Array[Control] = []
	bottom.append_array(skip_widgets)
	bottom.append_array(action_widgets)
	return [top, card_widgets, bottom]


## 一行控件的最小总宽 = Σ(最小宽) + 项距 ×(n-1)。隐藏控件（下一波等待态之外）不计。
func _widgets_min_width(widgets: Array[Control]) -> float:
	var total := 0.0
	var count := 0
	for widget in widgets:
		if not widget.visible:
			continue
		total += widget.get_combined_minimum_size().x
		count += 1
	return total + float(ROW_SEP) * float(maxi(count - 1, 0))


## 顶栏高度 = 行栈实测最小高 + 上下内边距（按字体实测行高推导，任何运行时都不裁切）。
func _bar_height() -> float:
	return _rows.get_combined_minimum_size().y + 2.0 * BAR_PAD


func _relayout_deferred() -> void:
	call_deferred("_relayout")


func _relayout() -> void:
	if _bar == null or _chip == null:
		return
	var plan := _plan_rows(size.x, _skip_wave_button.visible)
	var signature := "%d|" % plan.size()
	for row_widgets: Array in plan:
		for widget: Control in row_widgets:
			signature += "%s," % widget.name
		signature += "|"
	if signature == _layout_signature:
		return
	_layout_signature = signature
	var rows: Array[HBoxContainer] = [_row_a, _row_b, _row_c]
	for i in rows.size():
		var row := rows[i]
		var spacer: Control = row.get_meta("spacer")
		if i >= plan.size():
			row.visible = false
			continue
		row.visible = true
		for child in row.get_children():
			if child != spacer:
				row.remove_child(child)
		var index := 0
		for widget: Control in plan[i]:
			if widget.get_parent() != row:
				row.add_child(widget)
			row.move_child(widget, index)
			index += 1
		row.move_child(spacer, row.get_child_count() - 1)
	_bar.offset_bottom = _bar_height()
	for button in _card_buttons:
		if button.get_parent() != null:
			_card_row = button.get_parent() as HBoxContainer
			break


## 冒烟断言入口：顶栏挂件审计（冒烟第 19 项）—— 按文案签名统计各类挂件在栏数量。
## 期望：出战卡 = 卡槽张数；下一波/返回/重开/波次/生命/操作提示各恰好 1。
## 常驻挂件 = _build() 一次性挂载、rebuild_cards() 只重建出战卡（挂件生命周期不变式）；
## 旧引用失联的残留挂件按签名计数一律现形 —— 这是「重复挂载」的唯一可靠观测口径。
## 响应式折行布局下挂件分布在 RowA/B/C 三行，逐行扫描计数。
func widget_audit() -> Dictionary:
	var cards := 0
	var skip_wave := 0
	var back := 0
	var restart := 0
	var wave := 0
	var lives := 0
	for row: HBoxContainer in [_row_a, _row_b, _row_c]:
		for child in row.get_children():
			var button := child as Button
			if button != null:
				var text := button.text
				if text.contains("\n"):
					cards += 1
				elif text == "下一波":
					skip_wave += 1
				elif text == "返回":
					back += 1
				elif text == "重开":
					restart += 1
			else:
				var label := child as Label
				if label != null:
					if label.text.begins_with("生命"):
						lives += 1
					else:
						wave += 1
	var hints := 0
	for child in get_children():
		if child is Label:
			hints += 1
	return {
		"cards": cards,
		"skip_wave": skip_wave,
		"back": back,
		"restart": restart,
		"wave": wave,
		"lives": lives,
		"hints": hints,
	}


## 冒烟断言入口：顶栏布局体检（本轮修复①的机判面）。
## 返回 {rows, bar_h, overflow_px, overlaps, min_button_h, body_font}：
## overflow_px = 交互控件越出本控件矩形的最坏越界量（0 = 无溢出无裁切）；
## overlaps = 交互控件两两矩形相交对数（0 = 无重叠）；
## min_button_h = 最小按钮高（≥44 = 触屏热区达标）；body_font = HUD 正文字号档。
func topbar_metrics() -> Dictionary:
	var widgets: Array[Control] = [_chip, _skip_wave_button, _wave_label, _lives_label,
		_back_button, _restart_button]
	for button in _card_buttons:
		widgets.append(button)
	var overflow := 0.0
	var overlaps := 0
	var rects: Array[Rect2] = []
	for widget in widgets:
		if not widget.visible:
			rects.append(Rect2())
			continue
		var rect := Rect2(widget.global_position - global_position, widget.size)
		rects.append(rect)
		overflow = maxf(overflow, -rect.position.x)
		overflow = maxf(overflow, rect.position.x + rect.size.x - size.x)
		overflow = maxf(overflow, -rect.position.y)
		overflow = maxf(overflow, rect.position.y + rect.size.y - size.y)
	for i in widgets.size():
		if not widgets[i].visible:
			continue
		for j in range(i + 1, widgets.size()):
			if not widgets[j].visible:
				continue
			if rects[i].intersects(rects[j]):
				overlaps += 1
	var min_h := INF
	for widget in [_back_button, _restart_button, _skip_wave_button]:
		if widget.visible:
			min_h = minf(min_h, widget.size.y)
	for button in _card_buttons:
		min_h = minf(min_h, button.size.y)
	var rows := 0
	for row in [_row_a, _row_b, _row_c]:
		if row.visible:
			rows += 1
	return {
		"rows": rows,
		"bar_h": _bar.offset_bottom,
		"overflow_px": overflow,
		"overlaps": overlaps,
		"min_button_h": min_h,
		"body_font": _wave_label.get_theme_font_size("font_size"),
	}


func set_hint(text: String, persist: bool = false) -> void:
	_hint_label.text = text
	_hint_label.modulate.a = 1.0
	if _hint_tween != null:
		_hint_tween.kill()
		_hint_tween = null
	if persist:
		# 常驻提示（L1 教学引导：完成前不淡出 —— spec levelMechanics.teaching「完成后淡出」）
		return
	_hint_tween = create_tween()
	_hint_tween.tween_interval(maxf(GameState.hint_show_seconds, 0.0))
	_hint_tween.tween_property(_hint_label, "modulate:a", 0.0, HINT_FADE_TIME)


## 冒烟断言入口：操作提示当前不透明度（1 = 完全可见，0 = 已淡出）。
func hint_alpha() -> float:
	return _hint_label.modulate.a


## 波间等待态切换（「下一波」按钮可见性）。可见性变化会改变行宽 → 触发重排。
func set_wave_wait_visible(waiting: bool) -> void:
	var visible_now := waiting and GameState.running
	if _skip_wave_button.visible == visible_now:
		return
	_skip_wave_button.visible = visible_now
	_layout_signature = ""
	_relayout()


## 卡片状态刷新：两行文案（短名 / 费用或禁用原因）+ 选中描边 + 禁用态。
## 冷却倒计时逐秒变 —— 由 _process 驱动，状态签名不变时零重排。
func _process(_delta: float) -> void:
	_refresh_cards()


func _refresh_cards() -> void:
	var text_changed := false
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
		text_changed = true
		var border := FlatUI.SUN_PICKUP if selected else FlatUI.OUTLINE
		var border_w := 3 if selected else 2
		var detail := "%d" % GameState.card_cost_of(id)
		if reason == "冷却中":
			detail = "冷却 %.0fs" % ceili(cooldown_left)
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
	if text_changed:
		# 卡片文案变宽/变窄会改行最小宽 → 让 _relayout 重新校一次行分配（签名去重，零成本）
		_relayout_deferred()


func _on_sun_changed(sun: int) -> void:
	_sun_label.text = str(sun)
	Juice.pop(_sun_label)
	_relayout_deferred()


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
	_relayout_deferred()


func _on_wave_changed(wave: int, wave_count: int) -> void:
	if GameState.endless_active:
		_wave_label.text = "无尽 第 %d 波" % [wave + 1]
	else:
		_wave_label.text = "第 %d/%d 波" % [wave + 1, wave_count]
	Juice.pop(_wave_label)
	_relayout_deferred()


func _on_game_ended(won: bool) -> void:
	if GameState.endless_active:
		# 无尽终局留波次战报：展示口径与对局中一致（wave_index 0 起，展示 +1）
		_wave_label.text = "无尽 第 %d 波" % (GameState.wave_index + 1)
	else:
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
