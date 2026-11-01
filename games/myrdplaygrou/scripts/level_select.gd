class_name LevelSelect
extends CanvasLayer
## 选关界面：八关入口单页列出（名称 / 波数 / 难度档 / 星级进度，acc-level-select），
## 通关第 n 关解锁第 n+1 关；通关第 8 关解锁无尽模式入口（acc-playable-loop）。
## 难度标签与波数取自 GameState.LEVELS（数据单一来源，不重复维护）。
## 触屏点按直接进；键盘 confirm 默认进第 1 关。

signal level_selected(index: int)

## 每关难度档标签（对齐 spec levels[].goal 的机制定位，八关一一对应）。
const LEVEL_TAGS: Array[String] = [
	"教学", "标准", "快速", "紧缩", "夜战", "高压", "boss", "终局",
]

## 空白落点 toast 停留秒数（须 ≥ mobile-web-smoke 的 tap 后 1.5s 截图窗）。
const BLANK_TOAST_SECONDS: float = 4.0

var _level_buttons: Array[Button] = []
var _endless_button: Button
var _grid: GridContainer
var _status: Label
var _blank_catcher: Control
var _blank_toast: PanelContainer
var _blank_toast_left: float = 0.0


func _ready() -> void:
	layer = 20
	visible = false
	_build()


func _build() -> void:
	var cover := ColorRect.new()
	cover.color = FlatUI.PAPER
	cover.set_anchors_preset(Control.PRESET_FULL_RECT)
	cover.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(cover)

	# 空白落点兜底（spec 触屏优先「任何点按都必须有可见反馈，不允许按了没反应」）：
	# 4×2 关卡网格的卡片间隙（含视口正中落点，恰在列缝/行缝内）不是交互目标，
	# 但真机拇指可能点在那里 —— 给持久可见反馈（状态行文字 + 网格弹跳）。
	# 契约来源：mobile-web-smoke touch-response（tap 视口中心必须画面有响应）。
	# mouse_filter 必须用 PASS 而非 STOP：空白落点给完反馈后事件要继续传播到
	# _unhandled_input —— main.gd 首个人类输入的 Audio.ensure_playing()（BGM 手势起播
	# 兜底，spec firstInteractionPolicy）依赖它；STOP 会把首手势吃掉，BGM 永不起播。
	# 关卡按钮自身是 STOP 且在更上层（后于本节点 add_child），点按钮仍只走按钮。
	var blank_catcher := Control.new()
	blank_catcher.set_anchors_preset(Control.PRESET_FULL_RECT)
	blank_catcher.mouse_filter = Control.MOUSE_FILTER_PASS
	blank_catcher.gui_input.connect(_on_blank_input)
	add_child(blank_catcher)
	_blank_catcher = blank_catcher

	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	center.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(center)

	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 14)
	column.alignment = BoxContainer.ALIGNMENT_CENTER
	column.mouse_filter = Control.MOUSE_FILTER_IGNORE
	center.add_child(column)

	var title := FlatUI.label("植物人大战僵尸", FlatUI.FONT_TITLE)
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(title)
	var subtitle := FlatUI.label("网页版 · 射击防御 · 守住防线", FlatUI.FONT_ASSIST, FlatUI.GRAY_DARK)
	subtitle.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(subtitle)

	# 八关两行 × 4 列（触屏热区 ≥44px：按钮 216×72）
	_grid = GridContainer.new()
	_grid.columns = 4
	_grid.add_theme_constant_override("h_separation", 12)
	_grid.add_theme_constant_override("v_separation", 12)
	_grid.mouse_filter = Control.MOUSE_FILTER_IGNORE
	column.add_child(_grid)
	for i in GameState.LEVELS.size():
		var button := Button.new()
		FlatUI.apply_button(button, FlatUI.GREEN_LIGHT, FlatUI.FONT_ASSIST)
		button.custom_minimum_size = Vector2(216, 72)
		button.focus_mode = Control.FOCUS_NONE
		button.pressed.connect(_on_level_pressed.bind(i))
		_grid.add_child(button)
		_level_buttons.append(button)

	# 无尽模式入口（通关第 8 关后可见可点；会话内记忆）
	_endless_button = Button.new()
	FlatUI.apply_button(_endless_button, FlatUI.ORANGE, FlatUI.FONT_ASSIST)
	_endless_button.text = "无尽模式 · 波次无限\n通关第 8 关解锁"
	_endless_button.custom_minimum_size = Vector2(216, 72)
	_endless_button.focus_mode = Control.FOCUS_NONE
	_endless_button.pressed.connect(_on_endless_pressed)
	_endless_button.visible = false
	column.add_child(_endless_button)

	# 点按状态行（锁定关点按 = 即时反馈「先通过第 n 关」，spec 触屏优先：任何点按都有反馈）
	_status = FlatUI.label(" ", FlatUI.FONT_ASSIST, FlatUI.ORANGE_DARK)
	_status.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(_status)

	_refresh_entries()

	var hint_text := "点按关卡开始 · 单局约 1-3 分钟 · 点卡片选植物 · 点草坪布防 · 点阳光收集"
	if not GameState.touch_preferred():
		hint_text = "点按关卡开始 · 单局约 1-3 分钟 · 1-5 选卡 · WASD 移动 · 空格布防"
	var hint := FlatUI.label(hint_text, FlatUI.FONT_ASSIST, FlatUI.GRAY_DARK)
	hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(hint)

	# 空白落点 toast（绝对定位覆盖，不参与布局回流；IGNORE 不吃任何点按）：
	# 状态行文字面积太小（0.09% 画面），400 点指纹采样期望命中 0.35 点会被漏采 ——
	# 带边框双行面板（约 1.7% 画面、期望命中 6.8 点）才是「可见反馈」的可靠载体。
	_blank_toast = PanelContainer.new()
	var toast_box := FlatUI.box(FlatUI.PAPER, FlatUI.INK, 2, FlatUI.CORNER)
	toast_box.content_margin_left = 18
	toast_box.content_margin_right = 18
	toast_box.content_margin_top = 14
	toast_box.content_margin_bottom = 14
	_blank_toast.add_theme_stylebox_override("panel", toast_box)
	_blank_toast.custom_minimum_size = Vector2(320, 0)
	var toast_label := FlatUI.label("点按关卡卡片开始防守\n通关一关解锁下一关", FlatUI.FONT_BODY, FlatUI.INK)
	toast_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_blank_toast.add_child(toast_label)
	_blank_toast.visible = false
	_blank_toast.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_blank_toast.z_index = 5
	add_child(_blank_toast)


## 刷新入口态（每次 open 调用）：星级进度 + 无尽入口可见性（acc-level-select）。
func _refresh_entries() -> void:
	for i in _level_buttons.size():
		var cfg: Dictionary = GameState.LEVELS[i]
		var progress := "未通关"
		var stars := int(GameState.level_stars[i]) if i < GameState.level_stars.size() else 0
		if stars > 0:
			progress = "★x%d" % stars
		var locked := i > 0 and stars == 0 \
			and (i - 1 >= GameState.level_stars.size() or int(GameState.level_stars[i - 1]) == 0)
		_level_buttons[i].text = "第%d关 %s\n%d 波 · %s · %s" % [
			i + 1, cfg.get("name", ""), (cfg.get("waves", []) as Array).size(),
			LEVEL_TAGS[mini(i, LEVEL_TAGS.size() - 1)], progress]
		# 锁定态只压暗不禁用：按钮保持可点（点按给即时反馈），入口判定收口在 _on_level_pressed
		_level_buttons[i].modulate.a = 0.55 if locked else 1.0
		_level_buttons[i].set_meta(&"locked", locked)
	_endless_button.visible = GameState.endless_unlocked
	_status.text = " "
	_hide_blank_toast()


## 无尽入口当前是否可见可点（冒烟机判 acc-playable-loop 的解锁断言入口）。
func endless_entry_visible() -> bool:
	return _endless_button != null and _endless_button.visible


func open() -> void:
	visible = true
	_refresh_entries()


func close() -> void:
	visible = false
	_hide_blank_toast()


## 收起空白落点 toast（选关/进关/关闭时立即收起）。
func _hide_blank_toast() -> void:
	if _blank_toast != null:
		_blank_toast.visible = false
	_blank_toast_left = 0.0


## 键盘玩家的默认入口：confirm = 进第 1 关。
func press_default() -> void:
	level_selected.emit(0)


func _on_level_pressed(index: int) -> void:
	# 通关第 n 关解锁第 n+1 关（acc-level-select）：锁定关点按 = 即时反馈不进入
	#（spec 触屏优先：任何点按都必须有可见反馈，不允许「按了没反应」）
	if index > 0 and _is_locked(index):
		Juice.sfx(&"fail")
		Juice.pop(_level_buttons[index])
		_status.text = "先通过第 %d 关，即可解锁第 %d 关" % [index, index + 1]
		_hide_blank_toast()
		return
	Juice.sfx(&"confirm")
	_hide_blank_toast()
	level_selected.emit(index)


## 空白落点反馈（卡片间隙/标题区/提示区）：落点处 toast（持久可见 4s）+ 状态行文字
## + 网格弹跳，不允许「按了没反应」（触屏优先契约 + mobile-web-smoke touch-response）。
func _on_blank_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed \
			and event.button_index == MOUSE_BUTTON_LEFT:
		_status.text = "点按关卡卡片开始防守 · 通关解锁下一关"
		Juice.pop(_grid)
		_show_blank_toast(event.position)


## toast 定位在落点附近（钳制在视口内），BLANK_TOAST_SECONDS 后经 _process 收起。
func _show_blank_toast(tap_pos: Vector2) -> void:
	_blank_toast.visible = true
	_blank_toast_left = BLANK_TOAST_SECONDS
	_blank_toast.reset_size()
	var margin := Vector2(16, 16)
	_blank_toast.position = (tap_pos - _blank_toast.size / 2.0) \
		.clamp(margin, _blank_toast.get_viewport_rect().size - _blank_toast.size - margin)


func _process(delta: float) -> void:
	if _blank_toast != null and _blank_toast.visible:
		_blank_toast_left -= delta
		if _blank_toast_left <= 0.0:
			_blank_toast.visible = false


## 冒烟机判入口：空白落点反馈是否在位（状态行可写）。
func blank_tap_feedback_text() -> String:
	return _status.text


## 冒烟机判入口：空白落点 toast 面板在反馈后可见（「可见反馈」的持久载体）。
func blank_toast_visible() -> bool:
	return _blank_toast != null and _blank_toast.visible


## 冒烟机判入口：空白落点层必须 PASS 透传 —— STOP 会吃掉空白落点的手势，
## main.gd「首个人类输入 Audio.ensure_playing()」（BGM 手势起播兜底）依赖透传。
func blank_catcher_pass_through() -> bool:
	return _blank_catcher != null and _blank_catcher.mouse_filter == Control.MOUSE_FILTER_PASS


## 第 index 关（0 起索引）是否锁定（前一关尚无通关星级）。
func _is_locked(index: int) -> bool:
	if index <= 0:
		return false
	var prev := int(GameState.level_stars[index - 1]) if index - 1 < GameState.level_stars.size() else 0
	return prev == 0


func _on_endless_pressed() -> void:
	if not GameState.endless_unlocked:
		Juice.sfx(&"fail")
		_status.text = "通关第 8 关后解锁无尽模式"
		return
	Juice.sfx(&"confirm")
	level_selected.emit(GameState.LEVELS.size())
