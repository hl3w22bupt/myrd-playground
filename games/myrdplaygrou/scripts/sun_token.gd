class_name SunToken
extends Node2D
## 阳光拾取物：阳光经济的唯一入账形态 —— 天降 / 向日葵生产 / 击杀掉落三种来源共用，
## 全部须单指点按收集（触屏判定半径 = GameState.sun_tap_radius ≥44px）。
## 停留 sun_expire_sec 后进入 sun_fade_sec 淡出，过期消失（无惩罚）。
## 下落 / 到期由 Field 驱动（advance / expired），拾取在 Field._handle_tap。
##
## v2 对比度规范：本体 #f1c40f（FlatUI.SUN_PICKUP）+ 2px 描边 + 投影（spec.clickCollect）。

const RADIUS: float = 16.0
## 下落速度（天降阳光从 HUD 下缘落到目标行）。
const FALL_SPEED: float = 90.0

var value: int = 25
var landed: bool = false
var target_y: float = 0.0
## 淡出进度（0 = 不透明，1 = 消失；expired() 在 1.0 时为真）。
var fade: float = 0.0
var _life: float = 0.0
var _spin: float = 0.0


func setup(p_value: int, from: Vector2, p_target_y: float) -> void:
	value = p_value
	position = from
	target_y = p_target_y
	_life = GameState.sun_expire_sec
	z_index = 4
	_spin = fmod(from.x, TAU)


## 无下落段的落点生成（向日葵生产 / 击杀掉落）：直接落在实体旁。
static func drop(p_value: int, at: Vector2) -> SunToken:
	var token := SunToken.new()
	token.setup(p_value, at, at.y)
	token.landed = true
	return token


## 下落 / 停留倒计时推进一步（Field 逐帧调用）。
func advance(delta: float) -> void:
	_spin += delta * 1.5
	if not landed:
		position.y += FALL_SPEED * delta
		if position.y >= target_y:
			position.y = target_y
			landed = true
		return
	if _life > 0.0:
		_life -= delta
		return
	# 停留期满 → 淡出（淡完由 Field 移除）
	fade = minf(fade + delta / maxf(GameState.sun_fade_sec, 0.1), 1.0)
	modulate.a = 1.0 - fade


## 到期（应被 Field 移除）。
func expired() -> bool:
	return landed and fade >= 1.0


func _process(_delta: float) -> void:
	queue_redraw()


func _draw() -> void:
	# 投影（垫底椭圆）
	draw_set_transform(Vector2(2.0, 6.0), 0.0, Vector2(1.0, 0.5))
	draw_circle(Vector2.ZERO, RADIUS, FlatUI.SHADOW)
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
	# 光线（8 根短射线，慢速旋转）
	for i in 8:
		var angle := _spin + TAU * float(i) / 8.0
		var dir := Vector2(cos(angle), sin(angle))
		draw_line(dir * (RADIUS + 3.0), dir * (RADIUS + 9.0), FlatUI.ORANGE_DARK, 3.0)
	# 本体（阳光拾取物色 + 2px 描边 + 高光点）
	draw_circle(Vector2.ZERO, RADIUS, FlatUI.SUN_PICKUP)
	draw_arc(Vector2.ZERO, RADIUS, 0.0, TAU, 24, FlatUI.OUTLINE, 2.0)
	draw_circle(Vector2(-5, -5), 4.0, Color(1, 1, 1, 0.85))
