class_name Projectile
extends Node2D
## 豌豆弹丸：沿所在行直线右行；命中判定由 Field 每帧驱动（advance + 命中查询）。

var lane: int = 0


func setup(p_lane: int, p_pos: Vector2) -> void:
	lane = p_lane
	position = p_pos
	z_index = 3


func advance(delta: float) -> void:
	position.x += GameState.projectile_speed * delta


func _draw() -> void:
	draw_circle(Vector2.ZERO, 7.0, FlatUI.GREEN_LIGHT)
	draw_arc(Vector2.ZERO, 7.0, 0.0, TAU, 16, FlatUI.INK, 2.0)
