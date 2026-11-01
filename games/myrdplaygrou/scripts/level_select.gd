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

var _level_buttons: Array[Button] = []
var _endless_button: Button
var _grid: GridContainer
var _status: Label


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


## 无尽入口当前是否可见可点（冒烟机判 acc-playable-loop 的解锁断言入口）。
func endless_entry_visible() -> bool:
	return _endless_button != null and _endless_button.visible


func open() -> void:
	visible = true
	_refresh_entries()


func close() -> void:
	visible = false


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
		return
	Juice.sfx(&"confirm")
	level_selected.emit(index)


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
