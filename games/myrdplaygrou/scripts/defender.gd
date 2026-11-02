class_name Defender
extends Node2D
## 防御单位（出战卡内容表）：驻守格子，按花色分三类 ——
## 射手（peashooter/frostpea/repeater）：向本行右侧僵尸发射弹丸（目标判定与弹丸生成由 Field 驱动）；
## 生产（sunflower）：周期产出一枚阳光拾取物（tick_produce → Field 生成，点按收集）；
## 肉盾（wallnut）：不攻击，高血量挡路（spec：1200 hp）。
##
## v2 对比度规范（spec.numeric.visual.contrast）：主体 #2ecc71 / 向日葵花盘 #f39c12，
## 全部前景主体 2px 描边（FlatUI.OUTLINE）+ 投影（FlatUI.SHADOW，偏移 2px）。
## 数值在布置时从 GameState 卡表快照进来 —— 之后切换选中卡不影响已布置单位
## （弹药属性跟着卡走，不跟选中态走）。

const HEAD_RADIUS := 15.0

var cell: Vector2i = Vector2i.ZERO
var hp: float = 300.0
var max_hp: float = 300.0
## 花色 id（GameState.CARDS 的键），驱动造型与行为分类。
var kind: StringName = &"peashooter"
## 是否生产单位（向日葵）。
var produces: bool = false
## 每次开火弹丸数（0 = 不射击）。
var shots: int = 1
## 布置时快照的弹丸属性（来源：GameState.card_*_of(kind)）。
var damage: float = 20.0
var slow: float = 0.0
## 射击间隔（布置时快照 fire_interval × interval_mul）。
var interval: float = 1.5
## 生产间隔（向日葵；布置时快照 sunflower_interval）。
var produce_interval: float = 10.0
## 弹丸着色（寒冰 = 辅色蓝，其余 = 主色绿）。
var tint: Color = FlatUI.GREEN
var _cooldown: float = 0.0
var _produce_timer: float = 0.0
var _recoil: float = 0.0
var _sway: float = 0.0


func setup(d_cell: Vector2i, d_kind: StringName) -> void:
	cell = d_cell
	kind = d_kind
	hp = GameState.card_hp_of(kind)
	max_hp = hp
	produces = GameState.card_produces(kind)
	shots = GameState.card_shots_of(kind)
	damage = GameState.card_damage_of(kind)
	slow = GameState.card_slow_of(kind)
	interval = GameState.card_interval_of(kind)
	produce_interval = GameState.sunflower_interval
	_produce_timer = produce_interval
	tint = FlatUI.BLUE if kind == &"frostpea" else FlatUI.GREEN
	_cooldown = interval
	z_index = 1


## 开火节拍：冷却到期且本行有目标时开火。返回 true = 本帧开火（Field 生成弹丸）。
## 射手类专用（shots > 0）；生产 / 肉盾单位恒 false。
func tick_fire(delta: float, has_target: bool) -> bool:
	if shots <= 0:
		return false
	_cooldown = maxf(_cooldown - delta, 0.0)
	_recoil = maxf(_recoil - delta, 0.0)
	_sway += delta
	if has_target and _cooldown <= 0.0:
		_cooldown = interval
		_recoil = 0.12
		return true
	return false


## 生产节拍（向日葵）：到期返回 true（Field 生成阳光拾取物）并重置计时。
func tick_produce(delta: float) -> bool:
	if not produces:
		return false
	_sway += delta
	_produce_timer -= delta
	if _produce_timer <= 0.0:
		_produce_timer = produce_interval
		return true
	return false


## 扣血；返回 true = 被啃毁。
func take_damage(amount: float) -> bool:
	hp = maxf(hp - amount, 0.0)
	return hp <= 0.0


func _process(_delta: float) -> void:
	queue_redraw()


func _draw() -> void:
	# 投影（v2 前景主体统一：rgba(0,0,0,.25)，偏移 2px；椭圆压扁垫底）
	draw_set_transform(Vector2(2.0, 30.0), 0.0, Vector2(1.0, 0.38))
	draw_circle(Vector2.ZERO, 18.0, FlatUI.SHADOW)
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
	var sway := sin(_sway * 2.0) * 1.0
	# 茎与叶（主色·深）
	draw_rect(Rect2(-4, -6, 8, 26), FlatUI.GREEN_DARK)
	draw_polygon(
		PackedVector2Array([Vector2(-4, 10), Vector2(-20, 2), Vector2(-6, 18)]),
		PackedColorArray([FlatUI.GREEN_DARK, FlatUI.GREEN_DARK, FlatUI.GREEN_DARK]))
	match kind:
		&"sunflower":
			_draw_sunflower(sway)
		&"wallnut":
			_draw_wallnut(sway)
		_:
			_draw_shooter(sway)
	# 残血条
	if hp < max_hp:
		var ratio := hp / maxf(max_hp, 0.001)
		draw_rect(Rect2(-16, -44, 32, 5), FlatUI.OUTLINE)
		draw_rect(Rect2(-15, -43, 30.0 * ratio, 3), FlatUI.GREEN_LIGHT)


## 射手（豌豆/寒冰/双发）：主色圆头 + 描边 + 右向嘴管，开火时嘴管后坐。
func _draw_shooter(sway: float) -> void:
	var recoil_px := 4.0 if _recoil > 0.0 else 0.0
	var head_color := FlatUI.BLUE if kind == &"frostpea" else FlatUI.GREEN
	var head := Vector2(-recoil_px, -14 + sway)
	draw_circle(head, HEAD_RADIUS, head_color)
	draw_arc(head, HEAD_RADIUS, 0.0, TAU, 24, FlatUI.OUTLINE, 2.0)
	# 嘴管（向右；双发 = 上下双管，寒冰 = 蓝管口）
	var barrel_color := head_color
	if kind == &"repeater":
		draw_rect(Rect2(head.x + 8, head.y - 12, 16 - recoil_px, 9), barrel_color)
		draw_rect(Rect2(head.x + 8, head.y + 3, 16 - recoil_px, 9), barrel_color)
		draw_rect(Rect2(head.x + 22 - recoil_px, head.y - 13, 6, 11), FlatUI.GREEN_DARK)
		draw_rect(Rect2(head.x + 22 - recoil_px, head.y + 2, 6, 11), FlatUI.GREEN_DARK)
	else:
		draw_rect(Rect2(head.x + 8, head.y - 6, 18 - recoil_px, 12), barrel_color)
		draw_rect(Rect2(head.x + 24 - recoil_px, head.y - 7, 6, 14), FlatUI.GREEN_DARK)
	# 眼
	draw_rect(Rect2(head.x + 2, head.y - 8, 4, 4), FlatUI.OUTLINE)
	# 寒冰识别件：头顶冰晶（辅色三角，2px 描边）
	if kind == &"frostpea":
		var crystal := PackedVector2Array([
			head + Vector2(-6, -HEAD_RADIUS + 2),
			head + Vector2(6, -HEAD_RADIUS + 2),
			head + Vector2(0, -HEAD_RADIUS - 10),
		])
		var crystal_fill := FlatUI.BLUE.lightened(0.1)
		draw_polygon(crystal, PackedColorArray([crystal_fill, crystal_fill, crystal_fill]))
		draw_polyline(crystal + PackedVector2Array([crystal[0]]), FlatUI.OUTLINE, 2.0)


## 向日葵：8 片强调色花瓣（阳光拾取物同源色）+ 强调色花盘 + 笑脸，生产即轻晃。
func _draw_sunflower(sway: float) -> void:
	var center := Vector2(0, -16 + sway)
	for i in 8:
		var angle := TAU * float(i) / 8.0 + 0.39
		var dir := Vector2(cos(angle), sin(angle))
		var petal := Rect2(center + dir * 14.0 - Vector2(5, 5), Vector2(10, 10))
		draw_rect(petal, FlatUI.SUN_PICKUP)
		draw_rect(petal, FlatUI.OUTLINE, false, 2.0)
	draw_circle(center, 11.0, FlatUI.ORANGE)
	draw_arc(center, 11.0, 0.0, TAU, 24, FlatUI.OUTLINE, 2.0)
	# 笑脸（描边色小件）
	draw_rect(Rect2(center.x - 5, center.y - 4, 3, 3), FlatUI.OUTLINE)
	draw_rect(Rect2(center.x + 2, center.y - 4, 3, 3), FlatUI.OUTLINE)
	draw_arc(center + Vector2(0, 2), 4.0, 0.2, PI - 0.2, 10, FlatUI.OUTLINE, 2.0)


## 坚果墙：高壮椭圆壳（强调色系）+ 深色壳纹 + 眼睛，只挡不射。
func _draw_wallnut(sway: float) -> void:
	var center := Vector2(0, -14 + sway * 0.4)
	draw_rect(Rect2(center.x - 16, center.y - 22, 32, 52), FlatUI.ORANGE)
	draw_rect(Rect2(center.x - 16, center.y - 22, 32, 52), FlatUI.OUTLINE, false, 2.0)
	# 壳纹（强调色·深横带）
	draw_rect(Rect2(center.x - 16, center.y - 4, 32, 4), FlatUI.ORANGE_DARK)
	draw_rect(Rect2(center.x - 16, center.y + 14, 32, 4), FlatUI.ORANGE_DARK)
	# 眼（受损表情：残血越少眼越歪 —— 简化为固定愁眉）
	draw_rect(Rect2(center.x - 8, center.y - 12, 4, 6), FlatUI.OUTLINE)
	draw_rect(Rect2(center.x + 4, center.y - 12, 4, 6), FlatUI.OUTLINE)
	draw_rect(Rect2(center.x - 5, center.y + 2, 10, 3), FlatUI.OUTLINE)
