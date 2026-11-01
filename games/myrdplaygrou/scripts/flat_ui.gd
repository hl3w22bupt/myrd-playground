class_name FlatUI
extends RefCounted
## 风格卡 flat-bright-pvz 的界面工具：色板 / 圆角 / 描边 / 按钮三态 / 三档字号的唯一来源。
## 色值与规则见 .myrd/style-card.md —— 界面代码只从这里取颜色，禁止散落颜色魔数。

## ── 色板（style-card palette 段）──
const GREEN := Color("2ecc71")
const GREEN_DARK := Color("27ae60")
const GREEN_LIGHT := Color("58d68d")
const BLUE := Color("3498db")
const BLUE_DARK := Color("2980b9")
const ORANGE := Color("f39c12")
const ORANGE_DARK := Color("e67e22")
const RED := Color("e74c3c")
const GRAY := Color("95a5a6")
const GRAY_DARK := Color("707b7c")
const INK := Color("2c3e50")
const PAPER := Color("ecf0f1")

## ── 三档字号（标题 / HUD 正文 / 辅助信息）──
const FONT_TITLE := 32
const FONT_BODY := 20
const FONT_ASSIST := 14
## 统一圆角半径。
const CORNER := 8


## 扁平色块（统一描边色 INK / 统一圆角）。
static func box(bg: Color, border: Color = INK, border_w: int = 2, corner: int = CORNER) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = bg
	sb.border_color = border
	sb.set_border_width_all(border_w)
	sb.set_corner_radius_all(corner)
	return sb


## 按钮三态（风格卡 ui 段：normal / hover 亮 8% / pressed 下压变深 / disabled 灰 40%）。
static func apply_button(button: Button, base: Color, font_size: int = FONT_BODY) -> void:
	button.add_theme_font_size_override("font_size", font_size)
	button.add_theme_color_override("font_color", INK)
	button.add_theme_color_override("font_hover_color", INK)
	button.add_theme_color_override("font_pressed_color", INK)
	button.add_theme_color_override("font_focus_color", INK)
	button.add_theme_color_override("font_disabled_color", GRAY_DARK)
	var normal := box(base)
	var hover := box(base.lightened(0.08))
	var pressed := box(base.darkened(0.08))
	# 按压 = 文字下沉 3px（扁平「按进去了」，无渐变无阴影）
	pressed.content_margin_top = normal.content_margin_top + 3.0
	pressed.content_margin_bottom = maxf(normal.content_margin_bottom - 3.0, 2.0)
	var disabled := box(Color(GRAY, 0.4))
	disabled.border_color = Color(INK, 0.4)
	button.add_theme_stylebox_override("normal", normal)
	button.add_theme_stylebox_override("hover", hover)
	button.add_theme_stylebox_override("pressed", pressed)
	button.add_theme_stylebox_override("disabled", disabled)
	button.add_theme_stylebox_override("focus", hover)


## 统一样式的文本标签。
static func label(text: String, size: int, color: Color = INK) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l
