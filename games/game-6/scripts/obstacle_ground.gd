class_name ObstacleGround
extends Area2D
## 地面障碍「零食怪/糖果箱」（spec entity: obstacle-ground）：
## 地面碰撞体 64×56，跳跃越过或冲刺碾毁（+30 分）。
##
## 碰撞包络（与常量推导一致，见策划案 §3.2/§3.3）：
## 玩家站立盒高 64、滑铲盒高 36；本怪高 56 → 站立顶 64 > 56 需跳跃，
## 滑铲 36 < 56 不能钻 → 唯一解「跳」，与低飞怪的「滑铲/跳」形成互补威胁。

## 碾毁时发出（统计/冒烟断言用；加分与反馈本类直接走 GameState）。
signal smashed

## 怪体尺寸（spec l1/e3、l2/e6、l3/e3 均为 64×56）。
@export var width: float = 64.0
@export var height: float = 56.0

var _destroyed: bool = false
var _wobble_phase: float = 0.0

@onready var _body: Polygon2D = $Body
@onready var _shape: CollisionShape2D = $CollisionShape2D


func _ready() -> void:
	body_entered.connect(_on_body_entered)
	var rectangle := RectangleShape2D.new()
	rectangle.size = Vector2(width, height)
	_shape.shape = rectangle
	var half_w: float = width / 2.0
	var half_h: float = height / 2.0
	_body.polygon = PackedVector2Array([
		Vector2(-half_w, -half_h), Vector2(half_w, -half_h),
		Vector2(half_w, half_h), Vector2(-half_w, half_h),
	])


func _process(delta: float) -> void:
	if _destroyed:
		return
	# Q 版零食怪的胖胖晃动（纯表现）。
	_wobble_phase += delta * 6.0
	_body.scale = Vector2(1.0 + sin(_wobble_phase) * 0.05, 1.0 - sin(_wobble_phase) * 0.05)


## 冲刺碾毁：压扁消失 + 计分（acc-04 / spec scorePerObstacleSmash）。
func smash() -> void:
	if _destroyed:
		return
	_destroyed = true
	set_deferred("monitoring", false)
	visible = false
	GameState.add_smash()
	GameState.emit_feedback(&"smash", global_position)
	smashed.emit()


## 对象池复位（track_builder 循环 chunk 实例时调用）。
func reset_hazard() -> void:
	_destroyed = false
	visible = true
	set_deferred("monitoring", true)


func _on_body_entered(body: Node2D) -> void:
	if _destroyed or GameState.run_active == false:
		return
	if body is Player:
		match (body as Player).hit_hazard():
			&"smash":
				smash()
			&"shield_break":
				GameState.emit_feedback(&"shield_break", global_position)
			&"death":
				GameState.emit_feedback(&"death", global_position)
			_:
				pass
