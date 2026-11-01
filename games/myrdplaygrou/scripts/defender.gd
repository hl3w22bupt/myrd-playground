class_name Defender
extends Node2D
## 豌豆射手：驻守格子，向本行右侧的僵尸发射弹丸（目标判定与弹丸生成由 Field 驱动）。
## 扁平几何：绿茎 + 圆头 + 右向嘴管，开火时嘴管后坐。

const HEAD_RADIUS := 15.0

var cell: Vector2i = Vector2i.ZERO
var hp: float = 100.0
var max_hp: float = 100.0
var _cooldown: float = 0.0
var _recoil: float = 0.0
var _sway: float = 0.0


func setup(d_cell: Vector2i, d_hp: float) -> void:
	cell = d_cell
	hp = d_hp
	max_hp = d_hp
	z_index = 1


## 开火节拍：冷却到期且本行有目标时开火。返回 true = 本帧开火（Field 生成弹丸）。
func tick_fire(delta: float, has_target: bool) -> bool:
	_cooldown = maxf(_cooldown - delta, 0.0)
	_recoil = maxf(_recoil - delta, 0.0)
	_sway += delta
	if has_target and _cooldown <= 0.0:
		_cooldown = GameState.fire_interval
		_recoil = 0.12
		return true
	return false


## 扣血；返回 true = 被啃毁。
func take_damage(amount: float) -> bool:
	hp = maxf(hp - amount, 0.0)
	return hp <= 0.0


func _process(_delta: float) -> void:
	queue_redraw()


func _draw() -> void:
	var recoil_px := 4.0 if _recoil > 0.0 else 0.0
	var sway := sin(_sway * 2.0) * 1.0
	# 茎与叶（深绿）
	draw_rect(Rect2(-4, -6, 8, 26), FlatUI.GREEN_DARK)
	draw_polygon(
		PackedVector2Array([Vector2(-4, 10), Vector2(-20, 2), Vector2(-6, 18)]),
		PackedColorArray([FlatUI.GREEN_DARK, FlatUI.GREEN_DARK, FlatUI.GREEN_DARK]))
	# 头（主色圆 + 描边）
	var head := Vector2(-recoil_px, -14 + sway)
	draw_circle(head, HEAD_RADIUS, FlatUI.GREEN)
	draw_arc(head, HEAD_RADIUS, 0.0, TAU, 24, FlatUI.INK, 2.0)
	# 嘴管（向右）
	draw_rect(Rect2(head.x + 8, head.y - 6, 18 - recoil_px, 12), FlatUI.GREEN)
	draw_rect(Rect2(head.x + 24 - recoil_px, head.y - 7, 6, 14), FlatUI.GREEN_DARK)
	# 眼
	draw_rect(Rect2(head.x + 2, head.y - 8, 4, 4), FlatUI.INK)
	# 残血条
	if hp < max_hp:
		var ratio := hp / maxf(max_hp, 0.001)
		draw_rect(Rect2(-16, -44, 32, 5), FlatUI.INK)
		draw_rect(Rect2(-15, -43, 30.0 * ratio, 3), FlatUI.GREEN_LIGHT)
