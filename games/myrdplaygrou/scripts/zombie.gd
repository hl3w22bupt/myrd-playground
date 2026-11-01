class_name Zombie
extends Node2D
## 僵尸：沿所在行从右向左推进；到防御单位跟前停下啃咬；血量归零倒地。
## 行为推进由 Field 统一驱动（advance / take_damage），本脚本只管状态与扁平绘制。

## 身体尺寸（扁平几何：圆角矩形身 + 圆头 + 前伸双臂）。
const BODY_RECT := Rect2(-14, -26, 28, 44)
const HEAD_RADIUS := 12.0
const HEAD_OFFSET := Vector2(2, -32)

var lane: int = 0
var hp: float = 30.0
var max_hp: float = 30.0
var speed: float = 26.0
var eat_dps: float = 10.0
## 正在啃咬防御单位（Field 每帧判定后回写）。
var eating: bool = false
## 已倒地（等待 Field 移除，不再参与判定）。
var dying: bool = false
var _phase: float = 0.0


func setup(z_lane: int, z_x: float, z_y: float, z_hp: float, z_speed: float, z_eat_dps: float) -> void:
	lane = z_lane
	position = Vector2(z_x, z_y)
	hp = z_hp
	max_hp = z_hp
	speed = z_speed
	eat_dps = z_eat_dps
	z_index = 2
	# 同行多只僵尸的摆动相位错开（确定值，不用随机）
	_phase = float(z_lane) * 1.3 + z_x * 0.01


## 推进一步；返回实际位移（啃咬 / 倒地时为零向量）。
func advance(delta: float) -> Vector2:
	if eating or dying:
		return Vector2.ZERO
	var step := speed * delta
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
	# 双臂（前伸，行走时小幅摆动）
	var swing := sin(_phase * 6.0) * 2.0
	draw_rect(Rect2(-30, -16 + bob + swing, 18, 8), FlatUI.GRAY_DARK)
	draw_rect(Rect2(-28, -4 + bob - swing, 18, 8), FlatUI.GRAY_DARK)
	# 身体
	draw_rect(Rect2(BODY_RECT.position + Vector2(0, bob), BODY_RECT.size), FlatUI.GRAY)
	# 头
	draw_circle(HEAD_OFFSET + Vector2(0, bob), HEAD_RADIUS, FlatUI.GRAY)
	draw_arc(HEAD_OFFSET + Vector2(0, bob), HEAD_RADIUS, 0.0, TAU, 20, FlatUI.INK, 2.0)
	# 眼（危险感：红色小方块）
	draw_rect(Rect2(HEAD_OFFSET.x + 2, HEAD_OFFSET.y - 4 + bob, 4, 4), FlatUI.RED)
	# 残血条（血量不满才出现）
	if hp < max_hp:
		var ratio := hp / maxf(max_hp, 0.001)
		draw_rect(Rect2(-16, -50 + bob, 32, 5), FlatUI.INK)
		draw_rect(Rect2(-15, -49 + bob, 30.0 * ratio, 3), FlatUI.RED)
