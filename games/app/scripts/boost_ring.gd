class_name BoostRing
extends Control
## HUD「×2」角标 + 剩余时间环（知识基准 4.2：与加速态同步出现/消失）。
##
## 环弧 = 剩余时长 / 初始时长（续时封顶 15s 时弧满格钳制）；环心「×2」即得分倍率。
## 自读 GameState（autoload 状态），不依赖 main 转发 —— UI 订阅状态是规范允许的方向。

const COLOR_RING := Color("7ff6e8")
const COLOR_RING_DIM := Color(0.5, 0.55, 0.65, 0.22)
const COLOR_TEXT := Color("7ff6e8")
const RING_WIDTH: float = 3.0
const TEXT_SIZE: int = 24


func _process(_delta: float) -> void:
	if visible != GameState.boost_active:
		visible = GameState.boost_active
	if visible:
		queue_redraw()


func _draw() -> void:
	var center := size / 2.0
	var radius: float = minf(size.x, size.y) / 2.0 - RING_WIDTH
	draw_arc(center, radius, 0.0, TAU, 48, COLOR_RING_DIM, RING_WIDTH, true)
	var fraction := clampf(GameState.boost_time_left / GameState.BOOST_DURATION_SEC, 0.0, 1.0)
	if fraction > 0.003:
		## 从正上方顺时针铺满剩余时长（-90° 起点）。
		draw_arc(center, radius, -PI / 2.0, -PI / 2.0 + TAU * fraction, 48, COLOR_RING, RING_WIDTH, true)
	var font := get_theme_default_font()
	if font != null:
		draw_string(font, Vector2(0.0, size.y * 0.5 + TEXT_SIZE * 0.36), "×2",
			HORIZONTAL_ALIGNMENT_CENTER, size.x, TEXT_SIZE, COLOR_TEXT)
