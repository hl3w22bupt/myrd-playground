class_name Zombie
extends Node2D
## 僵尸：沿所在行从右向左推进；到防御单位跟前停下啃咬；血量归零倒地。
## 行为推进由 Field 统一驱动（advance / take_damage），本脚本只管状态与扁平绘制。
## 种类（normal/cone/runner/bucket）只影响血量/速度倍率（Field 出生时已乘）与头顶造型；
## 寒冰命中 → apply_slow 移动减速（只减速移动，不改变啃咬节奏 —— 语义见 apply_slow 注释）。

## 身体尺寸（扁平几何：圆角矩形身 + 圆头 + 前伸双臂）。
const BODY_RECT := Rect2(-14, -26, 28, 44)
const HEAD_RADIUS := 12.0
const HEAD_OFFSET := Vector2(2, -32)
## 寒冰减速时长（秒）；减速倍率 = 1 - slow（slow 来自出战卡）。
const SLOW_TIME: float = 2.0
const SLOW_TINT := Color(0.72, 0.86, 1.0)

var lane: int = 0
var hp: float = 30.0
var max_hp: float = 30.0
var speed: float = 26.0
var eat_dps: float = 10.0
## 种类（GameState.ZOMBIE_KINDS 的键），只驱动头顶造型。
var kind: StringName = &"normal"
## 正在啃咬防御单位（Field 每帧判定后回写）。
var eating: bool = false
## 已倒地（等待 Field 移除，不再参与判定）。
var dying: bool = false
## 寒冰减速：倍率 <1 移动放缓，计时归零恢复。
var _slow_factor: float = 1.0
var _slow_timer: float = 0.0
var _phase: float = 0.0


func setup(z_lane: int, z_x: float, z_y: float, z_hp: float, z_speed: float, z_eat_dps: float,
		z_kind: StringName = &"normal") -> void:
	lane = z_lane
	position = Vector2(z_x, z_y)
	hp = z_hp
	max_hp = z_hp
	speed = z_speed
	eat_dps = z_eat_dps
	kind = z_kind if GameState.ZOMBIE_KINDS.has(z_kind) else &"normal"
	z_index = 2
	# 同行多只僵尸的摆动相位错开（确定值，不用随机）
	_phase = float(z_lane) * 1.3 + z_x * 0.01


## 寒冰命中：移动减速 slow（0~1），持续 SLOW_TIME 秒（重复命中刷新计时）。
## 只减速移动、不改变啃咬节奏 —— 被定身咬住的僵尸不受额外影响，语义单一可预期。
func apply_slow(slow: float) -> void:
	if slow <= 0.0 or dying:
		return
	_slow_factor = 1.0 - clampf(slow, 0.0, 0.9)
	_slow_timer = Zombie.SLOW_TIME
	modulate = SLOW_TINT


## 推进一步；返回实际位移（啃咬 / 倒地时为零向量）。
func advance(delta: float) -> Vector2:
	if eating or dying:
		return Vector2.ZERO
	if _slow_timer > 0.0:
		_slow_timer -= delta
		if _slow_timer <= 0.0:
			_slow_factor = 1.0
			_slow_timer = 0.0
			modulate = Color.WHITE
	var step := speed * _slow_factor * delta
	position.x -= step
	_phase += delta * (2.0 if not eating else 6.0)
	return Vector2(-step, 0.0)


## 扣血；返回 true = 本次攻击致其倒地。
func take_damage(amount: float) -> bool:
	if dying:
		return false
	hp = maxf(hp - amount, 0.0)
	if hp <= 0.0:
		dying = true
		return true
	return false


func _process(_delta: float) -> void:
	queue_redraw()


func _draw() -> void:
	if dying:
		# 倒地：压扁 + 半透明，等 Field 移除
		draw_set_transform(Vector2(0, 26), 0.0, Vector2(1.3, 0.45))
		draw_rect(BODY_RECT, Color(FlatUI.GRAY, 0.7))
		draw_circle(HEAD_OFFSET + Vector2(0, 26), HEAD_RADIUS, Color(FlatUI.GRAY, 0.7))
		return
	var bob := sin(_phase * 3.0) * 1.5
	# 疾跑：身体前倾（头前移），暗一档与普通区分
	var runner := kind == &"runner"
	var head_offset := HEAD_OFFSET + Vector2(-4.0 if runner else 0.0, 0.0)
	var body_color := FlatUI.GRAY_DARK if runner else FlatUI.GRAY
	# 双臂（前伸，行走时小幅摆动；疾跑摆幅更大，跑感）
	var swing := sin(_phase * (9.0 if runner else 6.0)) * (3.0 if runner else 2.0)
	draw_rect(Rect2(-30, -16 + bob + swing, 18, 8), FlatUI.GRAY_DARK)
	draw_rect(Rect2(-28, -4 + bob - swing, 18, 8), FlatUI.GRAY_DARK)
	# 身体
	draw_rect(Rect2(BODY_RECT.position + Vector2(0, bob), BODY_RECT.size), body_color)
	# 头
	draw_circle(head_offset + Vector2(0, bob), HEAD_RADIUS, FlatUI.GRAY)
	draw_arc(head_offset + Vector2(0, bob), HEAD_RADIUS, 0.0, TAU, 20, FlatUI.INK, 2.0)
	# 眼（危险感：红色小方块）
	draw_rect(Rect2(head_offset.x + 2, head_offset.y - 4 + bob, 4, 4), FlatUI.RED)
	# 头顶造型（种类识别面，全部扁平几何 + 色板内取色）
	match kind:
		&"cone":
			draw_polygon(
				PackedVector2Array([
					head_offset + Vector2(-10, -8 + bob),
					head_offset + Vector2(10, -8 + bob),
					head_offset + Vector2(0, -26 + bob),
				]),
				PackedColorArray([FlatUI.ORANGE, FlatUI.ORANGE, FlatUI.ORANGE]))
		&"bucket":
			draw_rect(Rect2(head_offset.x - 11, head_offset.y - 30 + bob, 22, 20), FlatUI.GRAY_DARK)
			draw_rect(Rect2(head_offset.x - 11, head_offset.y - 30 + bob, 22, 20), FlatUI.INK, false, 2.0)
			draw_rect(Rect2(head_offset.x - 13, head_offset.y - 14 + bob, 26, 4), FlatUI.GRAY)
		_:
			pass
	# 残血条（血量不满才出现）
	if hp < max_hp:
		var ratio := hp / maxf(max_hp, 0.001)
		draw_rect(Rect2(-16, -50 + bob, 32, 5), FlatUI.INK)
		draw_rect(Rect2(-15, -49 + bob, 30.0 * ratio, 3), FlatUI.RED)
