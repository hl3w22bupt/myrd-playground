class_name Hud
extends Control
## 战斗 HUD：响应式顶栏（状态行 + 卡槽行）+ 底部操作提示。
## 控件全部代码构建，样式统一走 FlatUI（风格卡 flat-bright-pvz v3 三档字号）；
## 深底（UI_BASE）+ 浅字（UI_TEXT）+ 主色件（UI_PRIMARY），对比度机判见 tests/smoke.gd。
## 结果性事件的反馈挂在 *_changed 处理函数上（SKILL.md §3B），不挂在输入上。
## 排版硬底线：操作提示不常驻 —— 开局浮现，停留 hint_show_seconds 后淡出（set_hint）。
##
## v6（spec.numeric.visual.hudLayout · Bug cmvyowgsh… / cmvyowgtj…）两条硬契约：
## ① 单实例守卫：常驻控件（阳光/下一波/波次/生命/返回/重开/音效）只在 _ready 一次性构建；
##    rebuild_cards() 只重建卡槽按钮 —— 修复旧实现里 rebuild 复用 _build_card_buttons()
##    把常驻控件重复追加一遍的缺陷（过关进下一关顶栏按钮成倍叠加）。
## ② 响应式布局引擎：以「窗口 CSS 宽 = 视口设计宽 × 拉伸比」驱动钳制带 ——
##    按钮高 44~56、正文字号 18~24、辅助字号 12~16、元素间距 8~12（窄视口触点不缩破 44，
##    超宽视口不放过大限）；CSS 宽 < 960 折两行（第 1 行状态区 / 第 2 行卡槽区 + 音效开关，
##    行间距 = 间距带 ≥8）；单行总高 ≤68 设计 px（草坪首行 y=72 之上，不遮挡）。
##    元素 name = el_<功能 key>：冒烟按 key 断言「实例数恒 1」与「包围盒在画布内、两两无重叠」。

## 操作提示淡出时长（秒）。
const HINT_FADE_TIME: float = 0.5
## 卡片按钮高度 = 按钮钳制带（宽单独钳）。

## ── CSS 钳制带（spec visual.hudLayout.scaleClamp + 风格卡 ui 三档字号）──
const BUTTON_H_MIN: float = 44.0        ## 按钮高下限 = 触屏热区底线（css px）
const BUTTON_H_MAX: float = 56.0        ## 按钮高上限（超宽视口不得放大超过）
const BUTTON_H_BASE: float = 56.0       ## 按钮高基准（@css 宽 1024 等比起点）
const FONT_BODY_CSS: float = 20.0       ## HUD 正文字号基准（风格卡三档）
const FONT_BODY_MIN: float = 18.0       ## 正文字号下限
const FONT_BODY_MAX: float = 24.0       ## 正文字号上限
const FONT_ASSIST_CSS: float = 14.0     ## 辅助信息字号基准（卡片费用/静音钮）
const FONT_ASSIST_MIN: float = 12.0
const FONT_ASSIST_MAX: float = 16.0
const SEP_BASE: float = 8.0             ## 元素间距基准
const SEP_MIN: float = 8.0              ## 间距下限（两行行距同此带 → 行间距 ≥8 恒真）
const SEP_MAX: float = 12.0
const BAR_PAD_V: float = 6.0            ## 顶栏上下内边距（css）
const BAR_PAD_H: float = 10.0           ## 顶栏左右内边距（css）
## 单行排布的最小 CSS 宽：低于该值折两行（960 档按 1024 基准整行实测宽 1003 + 余量校准）。
const ONE_ROW_MIN_CSS_W: float = 960.0
## 紧凑文案阈值：低于该值波次/生命用短文案（窄视口整行放得下的前提）。
const COMPACT_TEXT_MAX_CSS_W: float = 640.0

signal restart_requested
signal back_requested
signal skip_wave_requested

## 布局度量缓存（_apply_layout 写入；冒烟断言入口）。
var _layout: Dictionary = {}

var _sun_label: Label
var _sun_chip: PanelContainer
var _status_spacer: Control
var _card_buttons: Array[Button] = []
var _card_states: Array[String] = []
var _card_row: HBoxContainer
var _status_row: HBoxContainer
var _card_spacer: Control
var _wave_label: Label
var _lives_label: Label
var _skip_wave_button: Button
var _back_button: Button
var _restart_button: Button
var _mute_button: Button
var _hint_label: Label
var _hint_tween: Tween
var _prev_lives: int = GameState.START_LIVES
var _prev_muted: bool = false
## 设备像素比（web = window.devicePixelRatio；桌面/无头 = 1）。_ready 探测，size_changed 重探
## （浏览器缩放会改 DPR）。
var _device_pixel_ratio: float = 1.0


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_detect_device_pixel_ratio()
	_build()
	_apply_layout()
	GameState.sun_changed.connect(_on_sun_changed)
	GameState.lives_changed.connect(_on_lives_changed)
	GameState.wave_changed.connect(_on_wave_changed)
	GameState.card_selected.connect(_on_card_selected)
	GameState.game_ended.connect(_on_game_ended)
	get_viewport().size_changed.connect(_on_viewport_size_changed)
	_on_sun_changed(GameState.sun)
	_on_wave_changed(GameState.wave_index, GameState.wave_count())


func _notification(what: int) -> void:
	if what == NOTIFICATION_RESIZED:
		_apply_layout()


## ── 构建（一次性；常驻控件与卡槽严格分建 —— 单实例守卫）──

func _build() -> void:
	# 顶栏（深底：spec ui-text-vs-ui-base / sun-counter-vs-ui-base 两对对比度的背景侧）
	var bar := PanelContainer.new()
	bar.name = "TopBar"
	var sb := FlatUI.box(FlatUI.UI_BASE, FlatUI.UI_BASE, 0, 0)
	bar.add_theme_stylebox_override("panel", sb)
	bar.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE)
	bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(bar)

	var rows := VBoxContainer.new()
	rows.name = "BarRows"
	rows.mouse_filter = Control.MOUSE_FILTER_IGNORE
	bar.add_child(rows)

	# 状态行：阳光 / 下一波 / 波次 / 生命 / 返回 / 重开（常驻，只建这一次）
	_status_row = HBoxContainer.new()
	_status_row.name = "RowStatus"
	_status_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	rows.add_child(_status_row)

	# 阳光余额（阳光拾取物同源色数字 —— sun-counter-vs-ui-base 对）
	_sun_chip = PanelContainer.new()
	_sun_chip.name = "el_sun"
	_sun_chip.add_theme_stylebox_override("panel", FlatUI.box(FlatUI.UI_BASE, FlatUI.OUTLINE, 2, 6))
	_sun_chip.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	_sun_chip.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_status_row.add_child(_sun_chip)
	var chip_row := HBoxContainer.new()
	chip_row.add_theme_constant_override("separation", 5)
	chip_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_sun_chip.add_child(chip_row)
	chip_row.add_child(HudSunIcon.new())
	_sun_label = FlatUI.label(str(GameState.sun), FlatUI.FONT_BODY, FlatUI.SUN_PICKUP)
	chip_row.add_child(_sun_label)

	var status_spacer := Control.new()
	status_spacer.name = "StatusSpacer"
	status_spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	status_spacer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_status_row.add_child(status_spacer)
	_status_spacer = status_spacer

	# 下一波（波间等待时可点，提前召唤 —— spec input.next-wave 可选操作）
	_skip_wave_button = Button.new()
	_skip_wave_button.name = "el_next_wave"
	FlatUI.apply_button_on_dark(_skip_wave_button, FlatUI.ORANGE_DARK)
	_skip_wave_button.text = "下一波"
	_skip_wave_button.focus_mode = Control.FOCUS_NONE
	_skip_wave_button.visible = false
	_skip_wave_button.pressed.connect(_on_skip_wave_pressed)
	_status_row.add_child(_skip_wave_button)

	# 波次 / 生命
	_wave_label = FlatUI.label("", FlatUI.FONT_BODY, FlatUI.UI_TEXT)
	_wave_label.name = "el_wave"
	_wave_label.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	_status_row.add_child(_wave_label)
	_lives_label = FlatUI.label("", FlatUI.FONT_BODY, FlatUI.UI_TEXT)
	_lives_label.name = "el_lives"
	_lives_label.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	_status_row.add_child(_lives_label)

	# 返回 / 重开（触屏优先：≥44px 热区）
	_back_button = Button.new()
	_back_button.name = "el_back"
	FlatUI.apply_button_on_dark(_back_button, FlatUI.GRAY_DARK)
	_back_button.text = "返回"
	_back_button.focus_mode = Control.FOCUS_NONE
	_back_button.pressed.connect(_on_back_pressed)
	_status_row.add_child(_back_button)

	_restart_button = Button.new()
	_restart_button.name = "el_restart"
	FlatUI.apply_button_on_dark(_restart_button, FlatUI.ORANGE)
	_restart_button.text = "重开"
	_restart_button.focus_mode = Control.FOCUS_NONE
	_restart_button.pressed.connect(_on_restart_pressed)
	_status_row.add_child(_restart_button)

	# 卡槽行：出战卡 ×N + 音效开关（spec hudLayout.rows 第 2 行）
	_card_row = HBoxContainer.new()
	_card_row.name = "RowCards"
	_card_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	rows.add_child(_card_row)

	_card_spacer = Control.new()
	_card_spacer.name = "CardSpacer"
	_card_spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_card_spacer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_card_row.add_child(_card_spacer)

	# 音效开关（spec hudLayout.rows：音效开关与卡槽同行的常驻件；与 Audio 全局静音同状态）
	_mute_button = Button.new()
	_mute_button.name = "el_mute"
	FlatUI.apply_button_on_dark(_mute_button, FlatUI.UI_BASE, FlatUI.FONT_ASSIST)
	_mute_button.text = _mute_label()
	_mute_button.focus_mode = Control.FOCUS_NONE
	_mute_button.pressed.connect(_on_mute_pressed)
	_card_row.add_child(_mute_button)
	_prev_muted = Audio.is_muted()

	_build_card_buttons()

	# 底部操作提示（辅助信息档；开局浮现，超时自动淡出 —— 不常驻）
	_hint_label = FlatUI.label("", FlatUI.FONT_ASSIST)
	_hint_label.name = "HintLabel"
	_hint_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_hint_label.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_WIDE)
	_hint_label.offset_top = -30.0
	_hint_label.offset_bottom = -6.0
	add_child(_hint_label)


## 按当前关卡槽重建卡片按钮（start_level 后由 main 调用；L4 阳光紧缩关 4 张）。
## ⚠️ 单实例守卫：只清重建卡槽按钮，常驻控件一律不碰（Bug cmvyowgsh… 修复面）。
func rebuild_cards() -> void:
	for button in _card_buttons:
		if button.get_parent() != null:
			button.get_parent().remove_child(button)  # 单行模式卡片可能被并进状态行
		button.queue_free()
	_card_buttons.clear()
	_card_states.clear()
	_build_card_buttons()
	_apply_layout()
	_refresh_cards()


func _build_card_buttons() -> void:
	for i in GameState.roster().size():
		var button := Button.new()
		button.name = "el_card_%d" % i
		FlatUI.apply_button_on_dark(button, FlatUI.UI_PRIMARY, FlatUI.FONT_ASSIST)
		button.focus_mode = Control.FOCUS_NONE
		button.pressed.connect(_on_card_pressed.bind(i))
		_card_row.add_child(button)
		_card_row.move_child(button, i)  # 卡片保持在 spacer 之前（行首对齐）
		_card_buttons.append(button)
		_card_states.append("")


## ── 响应式布局（spec visual.hudLayout.scaleClamp / rows）──

## 由视口推导布局度量：css 宽 = 视口设计宽 × 拉伸比 ÷ 设备像素比。
## Web 上 Godot 的窗口尺寸是设备像素（DPR 缩放后的 canvas），final_transform 的 scale
## 是「设计 px → 设备 px」；CSS px = 设备 px ÷ devicePixelRatio —— 不除 DPR 会把
## 390 CSS 宽的手机算成 1170，两行布局/钳制带全部失真（v6 部署实测）。
func _compute_metrics() -> Dictionary:
	var visible_size := Vector2(1024.0, 640.0)
	var css_scale := 1.0
	var viewport := get_viewport()
	if viewport != null:
		visible_size = viewport.get_visible_rect().size
		var sx := absf(viewport.get_final_transform().get_scale().x)
		if sx > 0.001:
			css_scale = sx / _device_pixel_ratio  # 设计 px → CSS px（拉伸比含设备像素比）
	var css_w := visible_size.x * css_scale
	var t := css_w / 1024.0
	# 设计 px = css px / 拉伸比（HUD 物理尺寸跟钳制带走，不被拉伸放大）
	return {
		"css_w": css_w,
		"css_scale": css_scale,
		"viewport_size": visible_size,
		"two_rows": css_w < ONE_ROW_MIN_CSS_W,
		"compact_text": css_w < COMPACT_TEXT_MAX_CSS_W,
		"button_h": clampf(BUTTON_H_BASE * t, BUTTON_H_MIN, BUTTON_H_MAX) / css_scale,
		"card_w": clampf(76.0 * t, 44.0, 76.0) / css_scale,
		"sun_w": clampf(88.0 * t, 52.0, 88.0) / css_scale,
		"next_wave_w": clampf(84.0 * t, 58.0, 84.0) / css_scale,
		"back_w": clampf(68.0 * t, 46.0, 68.0) / css_scale,
		"restart_w": clampf(68.0 * t, 46.0, 68.0) / css_scale,
		"mute_w": clampf(72.0 * t, 56.0, 72.0) / css_scale,
		"sep": clampf(SEP_BASE * t, SEP_MIN, SEP_MAX) / css_scale,
		"pad_v": BAR_PAD_V / css_scale,
		"pad_h": BAR_PAD_H / css_scale,
		"font_body": int(maxf(roundf(clampf(FONT_BODY_CSS * t, FONT_BODY_MIN, FONT_BODY_MAX) / css_scale), 1.0)),
		"font_assist": int(maxf(roundf(clampf(FONT_ASSIST_CSS * t, FONT_ASSIST_MIN, FONT_ASSIST_MAX) / css_scale), 1.0)),
	}


## 顶栏内容高度（设计 px；单行 ≤68 < 草坪首行 y=72 —— 「不遮挡草坪首行」机判依据）。
func content_height() -> float:
	var rows := 2.0 if bool(_layout.get("two_rows", false)) else 1.0
	var button_h := float(_layout.get("button_h", 44.0))
	var sep := float(_layout.get("sep", 8.0))
	var pad_v := float(_layout.get("pad_v", 6.0))
	return rows * button_h + (rows - 1.0) * sep + 2.0 * pad_v


func _apply_layout() -> void:
	# NOTIFICATION_RESIZED 会先于 _build 触发（入树即测量），控件未建好时直接跳过
	if _status_row == null or get_node_or_null("TopBar") == null:
		return
	_layout = _compute_metrics()
	var m := _layout
	var two_rows := bool(m.two_rows)
	var bar := get_node("TopBar") as PanelContainer
	var rows_box := bar.get_node("BarRows") as VBoxContainer
	if two_rows:
		# 两行：第 1 行状态区（阳光/下一波/波次/生命/返回/重开），第 2 行卡槽区（卡片+音效）
		var status_order: Array[Node] = [_sun_chip, _status_spacer, _skip_wave_button,
			_wave_label, _lives_label, _back_button, _restart_button]
		_order_in(_status_row, status_order)
		var card_order: Array[Node] = []
		for button in _card_buttons:
			card_order.append(button)
		card_order.append(_card_spacer)
		card_order.append(_mute_button)
		if _card_row.get_parent() == null:
			rows_box.add_child(_card_row)
		rows_box.move_child(_card_row, 1)
		_card_row.visible = true
		_card_spacer.visible = true
		_order_in(_card_row, card_order)
	else:
		# 单行：阳光 → 卡片×N → spacer → 下一波 → 波次 → 生命 → 返回 → 重开 → 音效
		var single_order: Array[Node] = [_sun_chip]
		for button in _card_buttons:
			single_order.append(button)
		single_order.append(_status_spacer)
		single_order.append(_skip_wave_button)
		single_order.append(_wave_label)
		single_order.append(_lives_label)
		single_order.append(_back_button)
		single_order.append(_restart_button)
		single_order.append(_mute_button)
		if _card_row.get_parent() != null:
			_card_row.get_parent().remove_child(_card_row)
		_card_row.visible = false
		_card_spacer.visible = false
		_order_in(_status_row, single_order)

	var sb: StyleBoxFlat = bar.get_theme_stylebox("panel")
	sb.content_margin_left = m.pad_h
	sb.content_margin_right = m.pad_h
	sb.content_margin_top = m.pad_v
	sb.content_margin_bottom = m.pad_v
	bar.offset_bottom = content_height()

	rows_box.add_theme_constant_override("separation", int(round(m.sep)))
	_status_row.add_theme_constant_override("separation", int(round(m.sep)))
	_card_row.add_theme_constant_override("separation", int(round(m.sep)))

	_size_element(_sun_chip, m.sun_w, m.button_h)
	_size_button(_skip_wave_button, m.next_wave_w, m.button_h, m.font_body)
	_size_button(_back_button, m.back_w, m.button_h, m.font_body)
	_size_button(_restart_button, m.restart_w, m.button_h, m.font_body)
	_size_button(_mute_button, m.mute_w, m.button_h, m.font_assist)
	_wave_label.add_theme_font_size_override("font_size", m.font_body)
	_lives_label.add_theme_font_size_override("font_size", m.font_body)
	_sun_label.add_theme_font_size_override("font_size", m.font_body)
	for button in _card_buttons:
		_size_button(button, m.card_w, m.button_h, m.font_assist)
	# 紧凑文案随视口档切换（窄视口整行放得下的前提）
	_refresh_texts()


## 把一组节点收拢进同一行容器并钉住顺序（跨行搬移 + 排序；container 布局保证两两无重叠）。
func _order_in(row: HBoxContainer, order: Array[Node]) -> void:
	for i in order.size():
		var node := order[i]
		if node.get_parent() != row:
			if node.get_parent() != null:
				node.get_parent().remove_child(node)
			row.add_child(node)
		row.move_child(node, i)


func _size_button(button: Button, width_css: float, height_css: float, font_size: int) -> void:
	button.custom_minimum_size = Vector2(width_css, height_css)
	button.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	button.clip_text = true
	button.add_theme_font_size_override("font_size", font_size)


func _size_element(control: Control, width_css: float, height_css: float) -> void:
	control.custom_minimum_size = Vector2(width_css, height_css)
	control.size_flags_vertical = Control.SIZE_SHRINK_CENTER


func _on_viewport_size_changed() -> void:
	_detect_device_pixel_ratio()
	_apply_layout()


func _detect_device_pixel_ratio() -> void:
	if not OS.has_feature("web") or not Engine.has_singleton("JavaScriptBridge"):
		_device_pixel_ratio = 1.0
		return
	var bridge: Object = Engine.get_singleton("JavaScriptBridge")
	var raw: Variant = bridge.call("eval", "window.devicePixelRatio || 1")
	if raw is float or raw is int:
		_device_pixel_ratio = maxf(float(raw), 1.0)


## ── 提示 ──

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


## 冒烟断言入口：生命数字当前颜色（重开复位断言用 —— 败局红色不得跨局泄漏）。
func lives_font_color() -> Color:
	return _lives_label.get_theme_color("font_color")


## 冒烟断言入口：波次/终局状态行当前文案（无尽波次口径一致性断言用）。
func wave_label_text() -> String:
	return _wave_label.text


## 波间等待态切换（「下一波」按钮可见性）。
func set_wave_wait_visible(waiting: bool) -> void:
	_skip_wave_button.visible = waiting and GameState.running


## ── 帧驱动 ──

## 卡片状态刷新：两行文案（短名 / 费用或禁用原因）+ 选中描边 + 禁用态。
## 冷却倒计时逐秒变 —— 由 _process 驱动，状态签名不变时零重排。
func _process(_delta: float) -> void:
	var muted := Audio.is_muted()
	if muted != _prev_muted:
		_prev_muted = muted
		_mute_button.text = _mute_label()
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


## 波次/生命文案（窄视口紧凑档：css 宽 < 640 用短文案，整行放得下）。
func _refresh_texts() -> void:
	var compact := bool(_layout.get("compact_text", false))
	if GameState.endless_active:
		_wave_label.text = ("∞ %d" % [GameState.wave_index + 1]) if compact \
			else endless_wave_text(GameState.wave_index)
	else:
		_wave_label.text = ("%d/%d" % [GameState.wave_index + 1, GameState.wave_count()]) if compact \
			else ("第 %d/%d 波" % [GameState.wave_index + 1, GameState.wave_count()])
	_lives_label.text = ("命 %d" % GameState.lives) if compact else ("生命 %d" % GameState.lives)


## 无尽模式波次文案（唯一出口：进行中 `_refresh_texts` 与终局 `_on_game_ended` 共用）——
## 波次号 = wave_index + 1（0 起索引转人类计数）；两处曾各自拼接导致终局比进行中少 1。
func endless_wave_text(wave_index: int) -> String:
	return "无尽 第 %d 波" % (wave_index + 1)


func _mute_label() -> String:
	return "音效 关" if Audio.is_muted() else "音效 开"


## ── 机判取数面（tests/smoke.gd 消费；运行期零调用）──

## 顶栏功能元素快照：功能 key → 控件（el_<key> 命名约定；card_i 归并为 card 组）。
func debug_elements() -> Dictionary:
	var out: Dictionary = {}
	_collect_elements(self, out)
	return out


## 顶栏功能元素实例计数（Bug cmvyowgsh… 回归断言入口）：过关进下一关后每组必须恒为 1。
## 分组：card_i 归并为 card 组，其余 key 即组名（next_wave 不拆分）。
func debug_control_counts() -> Dictionary:
	var counts: Dictionary = {}
	for key: String in debug_elements():
		var group := "card" if key.begins_with("card_") else key
		counts[group] = int(counts.get(group, 0)) + 1
	return counts


## 布局度量快照（冒烟钳制带断言入口；css 值 = 设计 px × 拉伸比，物理口径）。
func layout_report() -> Dictionary:
	var css_scale := float(_layout.get("css_scale", 1.0))
	return {
		"css_w": _layout.get("css_w", 0.0),
		"css_scale": css_scale,
		"two_rows": _layout.get("two_rows", false),
		"button_h_css": float(_layout.get("button_h", 0.0)) * css_scale,
		"font_body_css": float(_layout.get("font_body", 0.0)) * css_scale,
		"font_assist_css": float(_layout.get("font_assist", 0.0)) * css_scale,
		"sep_css": float(_layout.get("sep", 0.0)) * css_scale,
		"content_height": content_height(),
	}


func _collect_elements(node: Node, out: Dictionary) -> void:
	for child in node.get_children():
		var cname := String(child.name)
		if cname.begins_with("el_"):
			out[cname.trim_prefix("el_")] = child
		_collect_elements(child, out)


## 元素包围盒快照（画布/视口坐标 —— 冒烟直接做「在界 + 两两无重叠」机判）。
func element_rects() -> Dictionary:
	var rects: Dictionary = {}
	var elements := debug_elements()
	for key: String in elements:
		var control := elements[key] as Control
		rects[key] = Rect2(control.global_position, control.size)
	return rects


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
	_refresh_texts()
	# 危险红按「当前生命值」即时判定，不只在掉命帧 —— 败局把生命打到 ≤1 置红后重开，
	# 生命回满也必须回到常规色，否则上一局的结算态颜色跨局泄漏进新一局 HUD。
	_lives_label.add_theme_color_override("font_color", FlatUI.RED if lives <= 1 else FlatUI.UI_TEXT)
	if lost:
		Juice.flash(_lives_label, Color(1, 0.45, 0.45, 0.9))
		Juice.pop(_lives_label)


func _on_wave_changed(_wave: int, _wave_count: int) -> void:
	_refresh_texts()
	Juice.pop(_wave_label)


func _on_game_ended(won: bool) -> void:
	if GameState.endless_active:
		_wave_label.text = endless_wave_text(GameState.wave_index)
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


func _on_mute_pressed() -> void:
	Audio.set_muted(not Audio.is_muted())
	_prev_muted = Audio.is_muted()
	_mute_button.text = _mute_label()
	Juice.pop(_mute_button)


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
