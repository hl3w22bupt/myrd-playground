class_name CarTile
extends Node2D
## 单张汽车图块：全部视觉由 _draw() 代码绘制（无贴图资产，Web 导出零额外下载）。
## 状态高亮：选中（黄框）/ 提示（青框脉冲）/ 配对失败（红框，短促消退）。
## 对外只暴露状态设置方法，不处理输入（选择逻辑集中在 board.gd）。

const TYPE_NAMES: Array[String] = [
	"轿车", "跑车", "公交", "出租", "越野", "消防", "警车", "救护", "卡车", "赛车",
]
## 车种主色（同车种 = 同色同图案；10 色相彼此可辨）。
const TYPE_COLORS: Array[Color] = [
	Color(0.35, 0.62, 0.95), # 轿车 蓝
	Color(0.92, 0.28, 0.30), # 跑车 红
	Color(0.95, 0.78, 0.25), # 公交 琥珀
	Color(0.95, 0.52, 0.15), # 出租 橙
	Color(0.30, 0.78, 0.40), # 越野 绿
	Color(0.72, 0.12, 0.20), # 消防 绛红
	Color(0.45, 0.40, 0.85), # 警车 靛
	Color(0.92, 0.95, 0.97), # 救护 白
	Color(0.55, 0.38, 0.25), # 卡车 棕
	Color(0.20, 0.75, 0.75), # 赛车 青
]
## 高亮配色。
const COLOR_SELECTED := Color(1.0, 0.85, 0.2)
const COLOR_HINT := Color(0.2, 0.9, 1.0)
const COLOR_MISMATCH := Color(1.0, 0.25, 0.25)
const COLOR_PANEL := Color(0.13, 0.15, 0.20, 0.95)
const COLOR_PANEL_EDGE := Color(0.35, 0.40, 0.50)
const COLOR_WHEEL := Color(0.10, 0.10, 0.12)
const COLOR_WINDOW := Color(0.75, 0.88, 1.0, 0.9)

## 提示高亮总时长（秒），由 board.gd 设置后开始倒计时。
const HINT_SECONDS: float = 1.5
## 配对失败红框时长（秒）。
const MISMATCH_SECONDS: float = 0.35

var type_id: int = 0
var cell: Vector2i = Vector2i.ZERO
var tile_size: float = 96.0
var selected: bool = false
var hint_left: float = 0.0
var mismatch_left: float = 0.0


func setup(new_type: int, new_cell: Vector2i, size: float) -> void:
	type_id = new_type
	cell = new_cell
	tile_size = size
	position = Vector2(new_cell.x * size + size / 2.0, new_cell.y * size + size / 2.0)
	queue_redraw()


func set_selected(value: bool) -> void:
	selected = value
	queue_redraw()


func show_hint() -> void:
	hint_left = HINT_SECONDS
	queue_redraw()


func show_mismatch() -> void:
	mismatch_left = MISMATCH_SECONDS
	queue_redraw()


func _process(delta: float) -> void:
	var need_redraw := false
	if hint_left > 0.0:
		hint_left = maxf(hint_left - delta, 0.0)
		need_redraw = true
	if mismatch_left > 0.0:
		mismatch_left = maxf(mismatch_left - delta, 0.0)
		need_redraw = true
	if need_redraw:
		queue_redraw()


func type_name() -> String:
	return TYPE_NAMES[clampi(type_id, 0, TYPE_NAMES.size() - 1)]


func _draw() -> void:
	var half: float = tile_size / 2.0
	var panel := Rect2(-half, -half, tile_size, tile_size)
	draw_rect(panel, COLOR_PANEL)
	# 车身（侧视）：不同车种仅在比例上略作区分，识别以颜色为主。
	var body_color := TYPE_COLORS[clampi(type_id, 0, TYPE_COLORS.size() - 1)]
	var long_body: bool = type_id == 2 or type_id == 8 # 公交 / 卡车：贯通车身
	var low_roof: bool = type_id == 1 or type_id == 9 # 跑车 / 赛车：低趴座舱
	var body_w: float = tile_size * (0.86 if long_body else 0.66)
	var body_h: float = tile_size * 0.30
	var body_y: float = tile_size * 0.06
	var body := Rect2(-body_w / 2.0, body_y, body_w, body_h)
	var roof_w: float = tile_size * (0.70 if long_body else 0.38)
	var roof_h: float = tile_size * (0.16 if low_roof else 0.24)
	var roof := Rect2(-roof_w / 2.0, body_y - roof_h, roof_w, roof_h)
	draw_rect(roof, body_color.darkened(0.1))
	draw_rect(roof.grow(-roof_h * 0.28), COLOR_WINDOW)
	draw_rect(body, body_color)
	draw_rect(body.grow(-body_h * 0.22), body_color.lightened(0.12))
	# 车轮 ×2。
	var wheel_r: float = tile_size * 0.09
	var wheel_y: float = body_y + body_h
	for wheel_x in [-body_w * 0.28, body_w * 0.28]:
		draw_circle(Vector2(wheel_x, wheel_y), wheel_r, COLOR_WHEEL)
		draw_circle(Vector2(wheel_x, wheel_y), wheel_r * 0.45, Color(0.6, 0.6, 0.65))
	# 高亮框（选中 > 提示 > 错误 依次覆盖）。
	if selected:
		_draw_border(panel, COLOR_SELECTED, 5.0)
	if hint_left > 0.0:
		var pulse: float = 0.55 + 0.45 * sin(hint_left * 18.0)
		_draw_border(panel, Color(COLOR_HINT, pulse), 5.0)
	if mismatch_left > 0.0:
		_draw_border(panel, Color(COLOR_MISMATCH, mismatch_left / MISMATCH_SECONDS), 5.0)
	if not selected and hint_left <= 0.0 and mismatch_left <= 0.0:
		_draw_border(panel, COLOR_PANEL_EDGE, 2.0)


func _draw_border(rect: Rect2, color: Color, width: float) -> void:
	draw_rect(rect, color, false, width)
