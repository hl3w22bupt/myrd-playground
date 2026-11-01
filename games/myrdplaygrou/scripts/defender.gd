class_name Defender
extends Node2D
## 防御单位（出战卡花色）：驻守格子，向本行右侧的僵尸发射弹丸
## （目标判定与弹丸生成由 Field 驱动）。扁平几何：茎 + 圆头 + 右向嘴管，开火时嘴管后坐。
## 花色（pea/ice/twin）决定造型与弹丸属性；数值在布置时从 GameState 卡表快照进来 ——
## 之后切换选中卡不影响已布置单位（弹药属性跟着卡走，不跟选中态走）。

const HEAD_RADIUS := 15.0

var cell: Vector2i = Vector2i.ZERO
var hp: float = 100.0
var max_hp: float = 100.0
## 花色 id（GameState.CARDS 的键），驱动造型与弹丸属性。
var kind: StringName = &"pea"
## 布置时快照的弹丸属性（来源：GameState.card_*_of(kind)）。
var damage: float = 10.0
var slow: float = 0.0
var shots: int = 1
## 射击间隔（布置时快照 fire_interval 调参）。
var interval: float = 0.9
## 弹丸着色（寒冰 = 辅色提亮，其余 = 主色亮档）。
var tint: Color = FlatUI.GREEN_LIGHT
var _cooldown: float = 0.0
var _recoil: float = 0.0
var _sway: float = 0.0


func setup(d_cell: Vector2i, d_hp: float, d_kind: StringName = &"pea") -> void:
	cell = d_cell
	hp = d_hp
	max_hp = d_hp
	kind = d_kind
	damage = GameState.card_damage_of(kind)
	slow = GameState.card_slow_of(kind)
	shots = GameState.card_shots_of(kind)
	interval = GameState.fire_interval
	tint = FlatUI.BLUE.lightened(0.1) if kind == &"ice" else FlatUI.GREEN_LIGHT
	z_index = 1


## 开火节拍：冷却到期且本行有目标时开火。返回 true = 本帧开火（Field 生成弹丸）。
func tick_fire(delta: float, has_target: bool) -> bool:
	_cooldown = maxf(_cooldown - delta, 0.0)
	_recoil = maxf(_recoil - delta, 0.0)
	_sway += delta
	if has_target and _cooldown <= 0.0:
		_cooldown = interval
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
	# 头（花色主色圆 + 描边：豌豆/双发绿、寒冰蓝）
	var head_color := FlatUI.BLUE if kind == &"ice" else FlatUI.GREEN
	var head := Vector2(-recoil_px, -14 + sway)
	draw_circle(head, HEAD_RADIUS, head_color)
	draw_arc(head, HEAD_RADIUS, 0.0, TAU, 24, FlatUI.INK, 2.0)
	# 嘴管（向右；双发 = 上下双管，寒冰 = 冰蓝色管口）
	var barrel_color := FlatUI.BLUE.lightened(0.1) if kind == &"ice" else FlatUI.GREEN
	if kind == &"twin":
		draw_rect(Rect2(head.x + 8, head.y - 12, 16 - recoil_px, 9), barrel_color)
		draw_rect(Rect2(head.x + 8, head.y + 3, 16 - recoil_px, 9), barrel_color)
		draw_rect(Rect2(head.x + 22 - recoil_px, head.y - 13, 6, 11), FlatUI.GREEN_DARK)
		draw_rect(Rect2(head.x + 22 - recoil_px, head.y + 2, 6, 11), FlatUI.GREEN_DARK)
	else:
		draw_rect(Rect2(head.x + 8, head.y - 6, 18 - recoil_px, 12), barrel_color)
		draw_rect(Rect2(head.x + 24 - recoil_px, head.y - 7, 6, 14), FlatUI.GREEN_DARK)
	# 眼
	draw_rect(Rect2(head.x + 2, head.y - 8, 4, 4), FlatUI.INK)
	# 残血条
	if hp < max_hp:
		var ratio := hp / maxf(max_hp, 0.001)
		draw_rect(Rect2(-16, -44, 32, 5), FlatUI.INK)
		draw_rect(Rect2(-15, -43, 30.0 * ratio, 3), FlatUI.GREEN_LIGHT)
