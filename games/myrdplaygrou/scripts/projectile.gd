class_name Projectile
extends Node2D
## 豌豆弹丸：沿所在行直线右行；命中判定由 Field 每帧驱动（advance + 命中查询）。
## 伤害 / 减速 / 着色在出膛时快照（花色属性跟着弹丸走，切卡不影响已在飞的弹）。

var lane: int = 0
var damage: float = 10.0
var slow: float = 0.0
var tint: Color = FlatUI.GREEN_LIGHT


func setup(p_lane: int, p_pos: Vector2, p_damage: float = 10.0, p_slow: float = 0.0,
		p_tint: Color = FlatUI.GREEN_LIGHT) -> void:
	lane = p_lane
	position = p_pos
	damage = p_damage
	slow = p_slow
	tint = p_tint
	z_index = 3


func advance(delta: float) -> void:
	position.x += GameState.projectile_speed * delta


func _draw() -> void:
	draw_circle(Vector2.ZERO, 7.0, tint)
	draw_arc(Vector2.ZERO, 7.0, 0.0, TAU, 16, FlatUI.INK, 2.0)
	if slow > 0.0:
		# 寒冰弹：内部冰晶点（命中即减速的视觉预告）
		draw_circle(Vector2(-2, -2), 2.5, Color(1, 1, 1, 0.9))
