class_name Machine
extends Node2D
## 机台：外观（柜体/灯光/玻璃罩/取物口）绘制 + 布局常量唯一来源。
##
## 布局以 720x1280 竖屏视口为基准；爪子/娃娃/取物口的位置都从这里的常量推导，
## 改布局只动本文件。

## 玻璃罩内的可玩区（爪子平移范围，世界坐标）。
const FIELD_RECT: Rect2 = Rect2(84.0, 264.0, 552.0, 660.0)
## 取物口（娃娃落入判定区，世界坐标）。
const PIT_RECT: Rect2 = Rect2(236.0, 836.0, 248.0, 120.0)
## 取物口悬停点：爪子送娃娃回程的目标点。
const PIT_HOVER: Vector2 = Vector2(360.0, 806.0)
## 松爪后娃娃的落点（取物口中心偏下）。
const PIT_DROP_TARGET: Vector2 = Vector2(360.0, 880.0)
## 娃娃布货区（玻璃罩内、取物口以外的散落范围）。
const SPAWN_RECT: Rect2 = Rect2(130.0, 320.0, 460.0, 480.0)

## 爪子开局的挂点（顶部导轨中央）。
const CLAW_START: Vector2 = Vector2(360.0, 300.0)


func field_rect() -> Rect2:
	return FIELD_RECT


func pit_hover_point() -> Vector2:
	return PIT_HOVER


func pit_drop_target() -> Vector2:
	return PIT_DROP_TARGET


func claw_start() -> Vector2:
	return CLAW_START


func _draw() -> void:
	# 柜体外壳（深色金属框）。
	draw_rect(Rect2(28.0, 140.0, 664.0, 1020.0), Color(0.13, 0.15, 0.22))
	draw_rect(Rect2(28.0, 140.0, 664.0, 1020.0), Color(0.32, 0.38, 0.55), false, 6.0)
	# 顶部灯箱：暖光渐变条。
	draw_rect(Rect2(52.0, 164.0, 616.0, 64.0), Color(0.98, 0.86, 0.55, 0.92))
	draw_rect(Rect2(52.0, 164.0, 616.0, 20.0), Color(1.0, 0.95, 0.8, 0.65))
	for i in 8:
		var bulb_x := 84.0 + float(i) * 76.0
		draw_circle(Vector2(bulb_x, 196.0), 9.0, Color(1.0, 0.98, 0.9))
		draw_circle(Vector2(bulb_x, 196.0), 14.0, Color(1.0, 0.95, 0.7, 0.22))
	# 玻璃罩内衬（可玩区底色 + 侧壁）。
	draw_rect(FIELD_RECT.grow(14.0), Color(0.07, 0.09, 0.16))
	draw_rect(FIELD_RECT, Color(0.16, 0.2, 0.3))
	# 玻璃反光：两道斜向高光。
	draw_line(Vector2(120.0, 300.0), Vector2(320.0, 120.0), Color(1.0, 1.0, 1.0, 0.05), 26.0)
	draw_line(Vector2(430.0, 700.0), Vector2(640.0, 470.0), Color(1.0, 1.0, 1.0, 0.04), 34.0)
	# 顶部导轨（爪子滑轨）。
	draw_rect(Rect2(FIELD_RECT.position.x - 10.0, FIELD_RECT.position.y - 26.0, FIELD_RECT.size.x + 20.0, 12.0), Color(0.4, 0.44, 0.55))
	# 取物口：洞口 + 挡板高光 + 软垫。
	draw_rect(PIT_RECT, Color(0.03, 0.04, 0.08))
	draw_rect(PIT_RECT, Color(0.95, 0.75, 0.35), false, 4.0)
	draw_rect(Rect2(PIT_RECT.position + Vector2(6.0, 6.0), PIT_RECT.size - Vector2(12.0, 60.0)), Color(0.18, 0.12, 0.2, 0.55))
	# 出货口面板（机台正面装饰）。
	draw_rect(Rect2(180.0, 990.0, 360.0, 120.0), Color(0.1, 0.12, 0.19))
	draw_rect(Rect2(180.0, 990.0, 360.0, 120.0), Color(0.36, 0.42, 0.6), false, 3.0)
	draw_circle(Vector2(360.0, 1050.0), 26.0, Color(0.22, 0.26, 0.38))
	draw_arc(Vector2(360.0, 1050.0), 26.0, 0.0, TAU, 32, Color(0.95, 0.75, 0.35), 3.0)
