class_name PathLayer
extends Node2D
## 连线高亮层：把一次成功配对的连通路径（≤2 转折）画成折线，短暂展示后自动清除。
##
## 独立成层是为了叠在卡片之上：父棋盘（Node2D 根）的绘制永远在子节点之下。

const SHOW_SECONDS: float = 0.45
const LINE_COLOR: Color = Color(1.0, 0.82, 0.25, 0.95)
const LINE_WIDTH: float = 6.0

var _points: PackedVector2Array = PackedVector2Array()


## 由 GameBoard 在配对成功时调用；points 为路径拐点（世界 → 本层局部坐标一致，棋盘在原点）。
func show_path(points: PackedVector2Array) -> void:
	_points = points
	queue_redraw()
	var timer := get_tree().create_timer(SHOW_SECONDS)
	timer.timeout.connect(_clear_path)


func _clear_path() -> void:
	_points = PackedVector2Array()
	queue_redraw()


func _draw() -> void:
	if _points.size() < 2:
		return
	for i in range(_points.size() - 1):
		draw_line(_points[i], _points[i + 1], LINE_COLOR, LINE_WIDTH)
	for point in _points:
		draw_circle(point, LINE_WIDTH * 0.9, LINE_COLOR)
