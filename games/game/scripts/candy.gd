class_name Candy
extends Node2D
## 糖果棋子：按 kind 自绘的高光糖果（零外部贴图依赖，纯矢量分层绘制）。
##
## 规范要点：
## - class_name 唯一（preflight P9）；kind 用 setter 触发 queue_redraw，外部改类型即重绘；
## - 颜色/尺寸常量集中声明，不写魔数；
## - 不持有逻辑状态：三消逻辑（匹配/重力）在 Board 的类型矩阵里，棋子只负责「长得好看」。
##
## 碰撞/视觉包络余量（与 Board 的注释承诺一致）：
## 所有形体外接半径 ≤ RADIUS = 29；棋盘格 CELL = 72，半格 36 ——
## 余量 = 36 − 29 = 7px，保证相邻糖果之间至少 14px 缝隙，光标框（半边 33）始终框得住。

enum Kind { RED, ORANGE, YELLOW, GREEN, BLUE }

## 每种糖果的「主体色 / 暗部色」，画面风格：果冻感高光 + 暗色描边。
const BASE_COLORS: Dictionary = {
	Kind.RED: Color("ff5a7a"),
	Kind.ORANGE: Color("ff9f43"),
	Kind.YELLOW: Color("ffd93d"),
	Kind.GREEN: Color("5fd68b"),
	Kind.BLUE: Color("5aa2ff"),
}
const DARK_COLORS: Dictionary = {
	Kind.RED: Color("c2185b"),
	Kind.ORANGE: Color("d4761a"),
	Kind.YELLOW: Color("d9a406"),
	Kind.GREEN: Color("2e9e5b"),
	Kind.BLUE: Color("2f6fd0"),
}
## 糖果半径（棋盘格 CELL=72，糖果外接半径 29，留 7px/边 缝隙，见文件头余量推导）。
const RADIUS: float = 29.0
## 圆角方形（橙子糖）的半边长（对角 √2×24 ≈ 34 仍小于 36 半格，包络不越界）。
const SQUARE_HALF: float = 24.0
## 高光通用色。
const GLOSS: Color = Color(1.0, 1.0, 1.0, 0.85)
const GLOSS_SOFT: Color = Color(1.0, 1.0, 1.0, 0.35)
## 环境光从左上来：底部暗弧的偏移量。
const SHADE_OFFSET: Vector2 = Vector2(0.0, 5.0)

var kind: int = Kind.RED:
	set(value):
		kind = clampi(value, Kind.RED, Kind.BLUE)
		queue_redraw()


func _draw() -> void:
	var base: Color = BASE_COLORS[kind]
	var dark: Color = DARK_COLORS[kind]
	# 投影：双层椭圆让糖果「浮」在棋盘上（近实远虚）。
	draw_circle(Vector2(0.0, 5.0), RADIUS, Color(0.0, 0.0, 0.0, 0.18))
	draw_circle(Vector2(0.0, 3.0), RADIUS - 4.0, Color(0.0, 0.0, 0.0, 0.22))
	match kind:
		Kind.ORANGE:
			_draw_lozenge(base, dark)
		Kind.YELLOW:
			_draw_striped_ball(base, dark)
		Kind.GREEN:
			_draw_gem(base, dark)
		Kind.BLUE:
			_draw_hexagon(base, dark)
		_:
			_draw_jelly(base, dark)


## 果冻圆糖（红）：暗色底 + 亮色主体 + 底部反光弧 + 双高光。
func _draw_jelly(base: Color, dark: Color) -> void:
	draw_circle(Vector2.ZERO, RADIUS, dark)
	draw_circle(Vector2(0.0, -2.0), RADIUS - 3.0, base)
	# 底部反光：暗色圆盖在主体下半部，再叠一层更小的主体色，做出「果冻厚度」。
	draw_circle(SHADE_OFFSET, RADIUS - 3.0, Color(dark, 0.35))
	draw_circle(Vector2(0.0, -3.0), RADIUS - 6.0, base)
	draw_circle(Vector2(-9.0, -11.0), 7.0, GLOSS)
	draw_circle(Vector2(-12.0, -8.0), 3.0, Color(1.0, 1.0, 1.0, 0.95))
	draw_circle(Vector2(9.0, 8.0), 3.5, GLOSS_SOFT)


## 圆角方糖（橙）：StyleBoxFlat 圆角矩形 + 内侧亮边 + 高光点。
func _draw_lozenge(base: Color, dark: Color) -> void:
	var box := StyleBoxFlat.new()
	box.bg_color = base
	box.border_color = dark
	box.set_border_width_all(4)
	box.set_corner_radius_all(10)
	box.shadow_color = Color(dark, 0.55)
	box.shadow_size = 6
	var half: float = SQUARE_HALF
	box.draw(get_canvas_item(), Rect2(-half, -half + 4.0, half * 2.0, half * 2.0))
	# 顶部亮边：一条圆角高光横带，模拟糖纸反光。
	var shine := StyleBoxFlat.new()
	shine.bg_color = Color(1.0, 1.0, 1.0, 0.28)
	shine.set_corner_radius_all(6)
	shine.draw(get_canvas_item(), Rect2(-half + 6.0, -half + 6.0, half * 2.0 - 12.0, 8.0))
	draw_circle(Vector2(-half + 11.0, half - 12.0), 4.0, GLOSS_SOFT)


## 条纹球糖（黄）：球体 + 三条白色弦带（弦宽由圆方程算出，真实「包裹在球面上」）。
func _draw_striped_ball(base: Color, dark: Color) -> void:
	draw_circle(Vector2.ZERO, RADIUS, dark)
	draw_circle(Vector2(0.0, -2.0), RADIUS - 3.0, base)
	# 弦带：dy 处的半弦长 = sqrt(r² − dy²)，条带高度 6，覆盖球体中部。
	var stripe_half_height: float = 3.0
	for dy in [-12.0, 0.0, 12.0]:
		var half_width: float = sqrt(maxf((RADIUS - 4.0) * (RADIUS - 4.0) - dy * dy, 0.0))
		draw_rect(Rect2(-half_width + 1.0, dy - stripe_half_height - 2.0,
			(half_width - 1.0) * 2.0, stripe_half_height * 2.0),
			Color(1.0, 1.0, 1.0, 0.55))
	draw_circle(Vector2(-9.0, -12.0), 6.0, GLOSS)
	draw_circle(Vector2(10.0, 9.0), 3.0, GLOSS_SOFT)


## 菱形宝石糖（绿）：四点外形 + 内嵌棱面（上半亮、下半暗）+ 顶点高光。
func _draw_gem(base: Color, dark: Color) -> void:
	var points := PackedVector2Array([
		Vector2(0.0, -RADIUS), Vector2(RADIUS, 0.0),
		Vector2(0.0, RADIUS), Vector2(-RADIUS, 0.0),
	])
	draw_colored_polygon(points, dark)
	var inner := PackedVector2Array([
		Vector2(0.0, -RADIUS + 6.0), Vector2(RADIUS - 6.0, 0.0),
		Vector2(0.0, RADIUS - 6.0), Vector2(-RADIUS + 6.0, 0.0),
	])
	draw_colored_polygon(inner, base)
	# 棱面：左上亮面 + 右下暗面，塑造切割感。
	var facet_light := PackedVector2Array([
		Vector2(0.0, -RADIUS + 6.0), Vector2(-RADIUS + 6.0, 0.0), Vector2.ZERO,
	])
	draw_colored_polygon(facet_light, Color(1.0, 1.0, 1.0, 0.30))
	var facet_dark := PackedVector2Array([
		Vector2(RADIUS - 6.0, 0.0), Vector2(0.0, RADIUS - 6.0), Vector2.ZERO,
	])
	draw_colored_polygon(facet_dark, Color(dark, 0.45))
	draw_circle(Vector2(-5.0, -13.0), 4.0, GLOSS)


## 圆角六边形糖（蓝）：六点外形 + 顶部高光带 + 中心小高光。
func _draw_hexagon(base: Color, dark: Color) -> void:
	var points := PackedVector2Array()
	for i in 6:
		var angle := TAU * float(i) / 6.0 - PI / 2.0
		points.append(Vector2.from_angle(angle) * (RADIUS - 1.0))
	draw_colored_polygon(points, dark)
	var inner_points := PackedVector2Array()
	for i in 6:
		var angle_in := TAU * float(i) / 6.0 - PI / 2.0
		inner_points.append(Vector2.from_angle(angle_in) * (RADIUS - 6.0))
	draw_colored_polygon(inner_points, base)
	# 顶部高光带：上三条边内侧的一条圆角亮带。
	var shine := StyleBoxFlat.new()
	shine.bg_color = Color(1.0, 1.0, 1.0, 0.30)
	shine.set_corner_radius_all(5)
	shine.draw(get_canvas_item(), Rect2(-12.0, -20.0, 24.0, 9.0))
	draw_circle(Vector2(8.0, 6.0), 3.5, GLOSS_SOFT)
