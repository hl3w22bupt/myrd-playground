class_name FloatText
extends Node2D
## 飘字（+N）：点按收集阳光入账时的即时反馈（spec input.collect-sun「收集即播放收集音效
## 并显示 +N 飘字」）。代码构建、自驱自毁 —— Field 在收集时生成，1s 后自行 queue_free。

## 上飘距离（px）。
const RISE_PX: float = 34.0
## 存活时长（秒）。
const LIFETIME: float = 1.0

var text: String = "+25"
var color: Color = FlatUI.SUN_PICKUP
var _age: float = 0.0


func setup(p_text: String, p_color: Color = FlatUI.SUN_PICKUP) -> void:
	text = p_text
	color = p_color
	z_index = 6


func _process(delta: float) -> void:
	_age += delta
	position.y -= RISE_PX * delta / LIFETIME
	queue_redraw()
	if _age >= LIFETIME:
		queue_free()


func _draw() -> void:
	var alpha := 1.0 - _age / LIFETIME
	var font := ThemeDB.fallback_font
	# 阳光黄 vs 深绿草坪 = WCAG 5.2:1（对比度规范内），无需描边
	draw_string(font, Vector2.ZERO, text, HORIZONTAL_ALIGNMENT_CENTER, -60.0, FlatUI.FONT_BODY,
		Color(color, alpha))
