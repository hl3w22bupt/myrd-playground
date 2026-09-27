class_name PlayerFx
extends Node2D
## 主角生效期特效层（迭代需求 ①「生效期表现」落点）：
## - 磁吸光圈：磁铁生效期内角色周身的旋转虚线光圈（半径 ∝ magnetRadiusPx，呼吸脉动），
##   光圈内金币被持续吸飞（吸附逻辑在 coin.gd，本层只做「让增益被看见」）；
## - 冲刺速度线 + 拖尾：冲刺生效期内身后速度线组 + 后向拖影条，随移速可感知。
##
## 同步纪律：visible 直接由 player 计时器驱动 —— 倒计时归零当帧特效与增益同步消失
## （冒烟断言 fx.visible ↔ player 计时器双向一致）；本层零游戏状态，只读不写。

## 磁吸光圈视觉半径系数（真实吸附半径的显示比例，避免遮住大半屏）。
const RING_VISUAL_RATIO: float = 0.85
## 光圈虚线段数与转速（rad/s）。
const RING_SEGMENTS: int = 12
const RING_SPIN_SPEED: float = 2.2
## 冲刺速度线：条数 / 长度 / 起始 x 范围（全部在角色身后）。
const LINE_COUNT: int = 5
const LINE_LENGTH: float = 30.0

## 当前生效态（供冒烟断言「特效 ↔ 增益同步」）。
var ring_active: bool = false
var lines_active: bool = false

var _phase: float = 0.0


func _ready() -> void:
	visible = false
	z_index = -4  # 垫在主角部件后面，不遮角色


func _process(delta: float) -> void:
	var player := get_parent() as Player
	if player == null or not is_instance_valid(player):
		visible = false
		return
	ring_active = player.active and player.magnet_timer > 0.0
	lines_active = player.active and player.is_dashing()
	var should_show: bool = ring_active or lines_active
	if visible != should_show:
		visible = should_show
		_phase = 0.0
	if not visible:
		return
	_phase += delta * (16.0 if lines_active else RING_SPIN_SPEED)
	queue_redraw()


func _draw() -> void:
	if ring_active:
		_draw_magnet_ring()
	if lines_active:
		_draw_speed_lines()


## 磁吸光圈：两层 —— 外圈旋转虚线 + 内圈呼吸实线（同一暖红色系）。
func _draw_magnet_ring() -> void:
	var player := get_parent() as Player
	var radius: float = GameState.tuning_value(&"magnetRadiusPx") * RING_VISUAL_RATIO
	var pulse: float = 0.5 + 0.5 * sin(_phase * 2.0)
	var ring_color := Color(1.0, 0.45, 0.42, 0.5 + pulse * 0.35)
	var inner_color := Color(1.0, 0.62, 0.35, 0.22 + pulse * 0.12)
	draw_arc(Vector2.ZERO, radius, 0.0, TAU, 48, inner_color, 7.0, false)
	# 外圈旋转虚线：按相位只画部分弧段，视觉上「转起来」。
	for i: int in RING_SEGMENTS:
		var start: float = _phase + TAU * float(i) / float(RING_SEGMENTS)
		draw_arc(Vector2.ZERO, radius, start, start + TAU / float(RING_SEGMENTS) * 0.55,
			6, ring_color, 3.0, false)


## 冲刺速度线 + 拖尾：身后 5 条速度线（相位滚动）+ 一条渐隐拖影条。
func _draw_speed_lines() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 20260927  # 线条布局确定可复现（门禁同种子同输出口径）
	var speed_alpha: float = 0.55
	for i: int in LINE_COUNT:
		var base_y: float = rng.randf_range(-30.0, 22.0)
		var span: float = rng.randf_range(60.0, 110.0)
		var offset: float = fmod(_phase * (40.0 + 14.0 * float(i)), span)
		var tail_x: float = -26.0 - offset
		var color := Color(1.0, 0.86, 0.3, speed_alpha * (1.0 - offset / span))
		draw_line(Vector2(tail_x, base_y), Vector2(tail_x - LINE_LENGTH, base_y), color, 2.5)
	# 拖影条：身后渐隐长条（速度感的「底」）。
	var trail_color := Color(1.0, 0.8, 0.28, 0.16)
	draw_polygon(
		PackedVector2Array([
			Vector2(-14.0, -26.0), Vector2(-14.0, 24.0),
			Vector2(-96.0, 16.0), Vector2(-96.0, -18.0),
		]),
		PackedColorArray([trail_color, trail_color, Color(1.0, 0.8, 0.28, 0.0), Color(1.0, 0.8, 0.28, 0.0)]),
	)
