class_name LevelSelect
extends CanvasLayer
## 选关界面：三个关卡入口（触屏点按直接进；键盘 confirm 默认进第 1 关）。
## 难度标签取自 GameState.LEVELS 的波数（数据单一来源，不重复维护）。

signal level_selected(index: int)

const LEVEL_TAGS: Array[String] = ["悠闲", "轻松", "进阶"]

var _level_buttons: Array[Button] = []


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
	column.add_theme_constant_override("separation", 18)
	column.alignment = BoxContainer.ALIGNMENT_CENTER
	column.mouse_filter = Control.MOUSE_FILTER_IGNORE
	center.add_child(column)

	var title := FlatUI.label("植物人大战僵尸", FlatUI.FONT_TITLE)
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(title)
	var subtitle := FlatUI.label("网页版 · 射击防御 · 守住防线", FlatUI.FONT_ASSIST, FlatUI.GRAY_DARK)
	subtitle.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(subtitle)

	var grid := HBoxContainer.new()
	grid.add_theme_constant_override("separation", 20)
	grid.alignment = BoxContainer.ALIGNMENT_CENTER
	column.add_child(grid)
	for i in GameState.LEVELS.size():
		var cfg: Dictionary = GameState.LEVELS[i]
		var button := Button.new()
		FlatUI.apply_button(button, FlatUI.GREEN_LIGHT)
		button.text = "第%d关 %s\n%d 波 · %s" % [i + 1, cfg.get("name", ""), int(cfg.get("waves", 0)), LEVEL_TAGS[mini(i, LEVEL_TAGS.size() - 1)]]
		button.custom_minimum_size = Vector2(236, 96)
		button.focus_mode = Control.FOCUS_NONE
		button.pressed.connect(_on_level_pressed.bind(i))
		grid.add_child(button)
		_level_buttons.append(button)

	var hint_text := "点按关卡开始 · 单局约 1-3 分钟 · 点卡片选植物 · 点草坪布防"
	if not GameState.touch_preferred():
		hint_text = "点按关卡开始 · 单局约 1-3 分钟 · 1/2/3 选卡 · WASD 移动 · 空格布防"
	var hint := FlatUI.label(hint_text, FlatUI.FONT_ASSIST, FlatUI.GRAY_DARK)
	hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(hint)


func open() -> void:
	visible = true


func close() -> void:
	visible = false


## 键盘玩家的默认入口：confirm = 进第 1 关。
func press_default() -> void:
	level_selected.emit(0)


func _on_level_pressed(index: int) -> void:
	Juice.sfx(&"confirm")
	level_selected.emit(index)
