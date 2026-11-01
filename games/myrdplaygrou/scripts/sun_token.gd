class_name SunToken
extends Node2D
## 天降阳光：从 HUD 下缘落到目标行，停留数秒后消散；单指点按收集（触屏优先）。
## 下落 / 到期由 Field 驱动（advance / expired），拾取在 Field._handle_tap。

const FALL_SPEED: float = 90.0
## 落地后的停留时长（秒），超时消散（浪费掉，形成「要及时收」的小压力）。
const LIFETIME: float = 8.0
const RADIUS: float = 16.0

var value: int = 25
var landed: bool = false
var target_y: float = 0.0
var _life: float = LIFETIME
var _spin: float = 0.0


func setup(p_value: int, from: Vector2, p_target_y: float) -> void:
	value = p_value
	position = from
	target_y = p_target_y
	z_index = 4
	_spin = fmod(from.x, TAU)


## 下落 / 停留倒计时推进一步。
func advance(delta: float) -> void:
	_spin += delta * 1.5
	if not landed:
		position.y += FALL_SPEED * delta
		if position.y >= target_y:
			position.y = target_y
			landed = true
	else:
		_life -= delta


## 到期（应被 Field 移除）。
func expired() -> bool:
	return landed and _life <= 0.0


func _process(_delta: float) -> void:
	queue_redraw()


func _draw() -> void:
	# 光线（8 根短射线，慢速旋转）
	for i in 8:
		var angle := _spin + TAU * float(i) / 8.0
		var dir := Vector2(cos(angle), sin(angle))
		draw_line(dir * (RADIUS + 3.0), dir * (RADIUS + 9.0), FlatUI.ORANGE_DARK, 3.0)
	# 本体（强调色圆 + 描边 + 高光点）
	draw_circle(Vector2.ZERO, RADIUS, FlatUI.ORANGE)
	draw_arc(Vector2.ZERO, RADIUS, 0.0, TAU, 24, FlatUI.INK, 2.0)
	draw_circle(Vector2(-5, -5), 4.0, Color(1, 1, 1, 0.85))
