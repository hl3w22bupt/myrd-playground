class_name UiTheme
extends RefCounted
## UI 主题（画质 v2 专项一：高清字体主题）：代码构建 Theme，供主场景 UI 统一挂载。
##
## 为什么用代码而不是 .tres：场景/资源文件手写 ext_resource 的 uid 引用会「不报错但静默损坏」
## （工程规则：.tscn 禁止从零整段生成）；代码构建可静态检查、可无头冒烟断言。
## 字体必须是矢量字体（NotoSansSC 子集）+ hidpi + canvas_items 矢量重排，移动高分屏才不发糊；
## 禁止任何位图字。配色与机台一致：深紫夜色 + 金色描边 + 奶油白文字。

## 全局矢量中文字体（与 project.godot [gui] theme/custom_font 同源）。
const FONT := preload("res://assets/fonts/NotoSansSC-Regular.otf")

## 主题配色（与机台材质同色系：机身深紫 / 金色包边 / 奶油文字）。
const COLOR_TEXT := Color(1.0, 0.96, 0.88)
const COLOR_TEXT_DIM := Color(0.85, 0.92, 1.0, 0.92)
const COLOR_PANEL_BG := Color(0.09, 0.075, 0.17, 0.94)
const COLOR_BTN_BG := Color(0.17, 0.135, 0.32, 0.96)
const COLOR_BTN_BG_HOVER := Color(0.24, 0.19, 0.44, 1.0)
const COLOR_BTN_BG_PRESSED := Color(0.30, 0.23, 0.52, 1.0)
const COLOR_BTN_DISABLED := Color(0.12, 0.10, 0.20, 0.6)
const COLOR_ACCENT := Color(0.98, 0.80, 0.36)
const CORNER_RADIUS := 12
const BORDER_WIDTH := 2

## 默认字号（720×1280 基准视口；aspect=expand 下按窗口矢量重排，不位图拉伸）。
const DEFAULT_FONT_SIZE := 26
const BUTTON_FONT_SIZE := 24


static func build() -> Theme:
	var theme := Theme.new()
	theme.default_font = FONT
	theme.default_font_size = DEFAULT_FONT_SIZE
	_apply_label(theme)
	_apply_button(theme)
	_apply_panel(theme)
	return theme


static func _apply_label(theme: Theme) -> void:
	theme.set_color("font_color", "Label", COLOR_TEXT)
	theme.set_color("font_outline_color", "Label", Color(0.08, 0.06, 0.14, 0.92))
	theme.set_constant("outline_size", "Label", 6)


static func _button_box(bg: Color, border: Color) -> StyleBoxFlat:
	var box := StyleBoxFlat.new()
	box.bg_color = bg
	box.set_corner_radius_all(CORNER_RADIUS)
	box.set_border_width_all(BORDER_WIDTH)
	box.border_color = border
	box.content_margin_left = 18.0
	box.content_margin_right = 18.0
	box.content_margin_top = 10.0
	box.content_margin_bottom = 10.0
	box.shadow_color = Color(0.0, 0.0, 0.0, 0.35)
	box.shadow_size = 6
	box.shadow_offset = Vector2(0.0, 3.0)
	return box


static func _apply_button(theme: Theme) -> void:
	theme.set_font_size("font_size", "Button", BUTTON_FONT_SIZE)
	theme.set_color("font_color", "Button", COLOR_TEXT)
	theme.set_color("font_hover_color", "Button", Color(1.0, 1.0, 0.95))
	theme.set_color("font_pressed_color", "Button", COLOR_ACCENT)
	theme.set_color("font_focus_color", "Button", COLOR_TEXT)
	theme.set_color("font_disabled_color", "Button", Color(0.7, 0.7, 0.75, 0.7))
	theme.set_color("font_outline_color", "Button", Color(0.08, 0.06, 0.14, 0.9))
	theme.set_constant("outline_size", "Button", 4)
	var border := COLOR_ACCENT
	theme.set_stylebox("normal", "Button", _button_box(COLOR_BTN_BG, border * Color(1, 1, 1, 0.75)))
	theme.set_stylebox("hover", "Button", _button_box(COLOR_BTN_BG_HOVER, border))
	theme.set_stylebox("pressed", "Button", _button_box(COLOR_BTN_BG_PRESSED, border))
	theme.set_stylebox("focus", "Button", _button_box(COLOR_BTN_BG_HOVER, border))
	theme.set_stylebox("disabled", "Button", _button_box(COLOR_BTN_DISABLED, border * Color(1, 1, 1, 0.35)))


static func _apply_panel(theme: Theme) -> void:
	var panel := StyleBoxFlat.new()
	panel.bg_color = COLOR_PANEL_BG
	panel.set_corner_radius_all(16)
	panel.set_border_width_all(2)
	panel.border_color = COLOR_ACCENT * Color(1, 1, 1, 0.85)
	panel.content_margin_left = 24.0
	panel.content_margin_right = 24.0
	panel.content_margin_top = 20.0
	panel.content_margin_bottom = 20.0
	panel.shadow_color = Color(0.0, 0.0, 0.0, 0.5)
	panel.shadow_size = 12
	theme.set_stylebox("panel", "PanelContainer", panel)
