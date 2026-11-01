class_name FlatUI
extends RefCounted
## 风格卡 flat-bright-pvz v2 的界面工具：色板 / 圆角 / 描边 / 按钮三态 / 三档字号的唯一来源。
## 色值与规则见 .myrd/style-card.md —— 界面代码只从这里取颜色，禁止散落颜色魔数。
##
## v2 对比度规范（spec.numeric.visual.contrast，验收 acc-contrast）：
## - 草坪格底改低饱和深绿棋盘双档（LAWN_DARK/LAWN_LIGHT），替换原高饱和亮绿；
## - 植物/僵尸/阳光等前景主体统一 2px 深色描边（OUTLINE）+ 投影（SHADOW）；
## - 关键前景/背景色对按 WCAG 2.x 相对亮度公式实测 ≥3:1（机判见 tests/smoke.gd::_check_contrast）；
## - HUD 深底（UI_BASE）+ 浅字（UI_TEXT）+ 主色件（UI_PRIMARY）三对同规则机判。

## ── 色板（style-card palette 段；v2 新增项已同步进卡）──
const GREEN := Color("2ecc71")           ## 主色 = 植物主体 / 胜利态（PLANT_BODY 同值）
const GREEN_DARK := Color("27ae60")      ## 主色·深（茎叶 / 按钮投影块）
const GREEN_LIGHT := Color("58d68d")     ## 主色·亮
const BLUE := Color("3498db")            ## 辅色 = UI 主色件（仅 UI，不作草坪前景）
const BLUE_DARK := Color("2980b9")       ## 辅色·深
const ORANGE := Color("f39c12")          ## 强调色 = 向日葵花盘 / 卡片高亮
const ORANGE_DARK := Color("e67e22")     ## 强调色·深 = 阳光描边 / 警告条
const RED := Color("e74c3c")             ## 危险色 = 威胁提示 / 失败态
const GRAY := Color("95a5a6")            ## 中性色（辅助信息 / 次级按钮）
const GRAY_DARK := Color("707b7c")       ## 中性色·深（僵尸暗部 / 铁桶）
const INK := Color("2c3e50")             ## 浅底上的正文与描边（UI 旧档，浅色面板用）
const PAPER := Color("ecf0f1")           ## 浅底（结算面板 / 选关页）

## ── v2 对比度规范色（spec.numeric.visual.contrast 逐项声明，渲染必须与声明一致）──
const LAWN_DARK := Color("2b5436")       ## 草坪棋盘深档格底
const LAWN_LIGHT := Color("31603f")      ## 草坪棋盘浅档格底
const OUTLINE := Color("1e3b25")         ## 前景主体统一 2px 描边色
const SUN_PICKUP := Color("f1c40f")      ## 阳光拾取物（本体 + 计数数字）
const ZOMBIE_BODY := Color("bdc3c7")     ## 僵尸四类统一浅灰基底（识别色只上头饰）
const UI_BASE := Color("22313f")         ## HUD 深底
const UI_TEXT := Color("ecf0f1")         ## HUD 深底上的常规文本
const UI_PRIMARY := Color("3498db")      ## UI 主色件（按钮/卡片）= 辅色同值
const SHADOW := Color(0.0, 0.0, 0.0, 0.25)  ## 前景主体投影（rgba(0,0,0,.25)，偏移 2px）

## ── v3 夜战关色（spec levelMechanics.nightFog 逐项声明，渲染必须与声明一致）──
const FOG := Color("0d1626")             ## 夜幕遮罩（L5 第 4 列及以右，alpha 0.6）
const SILHOUETTE := Color("6b7f94")      ## 遮罩内僵尸剪影预显示色（对比度 4.39 ≥3.0 机判）

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


## 按钮三态（浅底版：normal / hover 亮 8% / pressed 下压变深 / disabled 灰 40%）。
static func apply_button(button: Button, base: Color, font_size: int = FONT_BODY) -> void:
	_style_button(button, base, INK, font_size)


## 按钮三态（HUD 深底版：文字用 UI_TEXT，保证 ui-text-vs-ui-base 对比度）。
static func apply_button_on_dark(button: Button, base: Color, font_size: int = FONT_BODY) -> void:
	_style_button(button, base, UI_TEXT, font_size)


static func _style_button(button: Button, base: Color, font_color: Color, font_size: int) -> void:
	button.add_theme_font_size_override("font_size", font_size)
	button.add_theme_color_override("font_color", font_color)
	button.add_theme_color_override("font_hover_color", font_color)
	button.add_theme_color_override("font_pressed_color", font_color)
	button.add_theme_color_override("font_focus_color", font_color)
	button.add_theme_color_override("font_disabled_color", Color(font_color, 0.45))
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


## ── WCAG 2.x 相对亮度与对比度（acc-contrast 机判共用实现，spec.numeric.visual.contrast）──

## sRGB 通道线性化（WCAG 2.x 定义）。
static func _srgb_to_linear(c: float) -> float:
	return c / 12.92 if c <= 0.04045 else pow((c + 0.055) / 1.055, 2.4)


## WCAG 2.x 相对亮度。
static func relative_luminance(color: Color) -> float:
	return 0.2126 * _srgb_to_linear(color.r) \
		+ 0.7152 * _srgb_to_linear(color.g) \
		+ 0.0722 * _srgb_to_linear(color.b)


## WCAG 对比度（(L1+0.05)/(L2+0.05)，L1 为较亮者）。
static func contrast_ratio(a: Color, b: Color) -> float:
	var la := relative_luminance(a)
	var lb := relative_luminance(b)
	var lighter := maxf(la, lb)
	var darker := minf(la, lb)
	return (lighter + 0.05) / (darker + 0.05)
