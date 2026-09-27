class_name ObstacleAir
extends Area2D
## 空中障碍「飞行怪」（spec entity: obstacle-air）：低空型 hover_y=96 与
## 高空型 hover_y=208 两种参数实例共用本场景（spec §四：同一场景不同导出参数）。
##
## 碰撞包络推导（盒 56×88、中心在 hover_y，与玩家盒常量一致，余量必须可复核）：
##   玩家站立盒高 64（顶离地 64）、滑铲盒高 36（顶离地 36）、单跳上升 168.75px。
##   hover_y=96 → 盒体离地 [52,140]：站立 64∈(52,140) 必撞；滑铲 36<52 必过；
##   单跳顶点盒底 168.75>140 可越 —— 滑铲/跳跃双解。
##   hover_y=208 → 盒体离地 [164,252]：站立顶 64<164 贴地跑过；单跳顶点盒底
##   168.75∈(164,252) 必撞；二段跳累计 308.75>252 可越 —— 贴地/二段跳双解。

## 悬停高度（离地 px，spec l1/e5、l2/e7、l3/e4 均为低空 96；高空 208 留 P2）。
@export var hover_y: float = 96.0

## 盒体尺寸（推导见类注释；视觉为 56×40 虫身 + 触手，包络略大于视觉属「余量留足」）。
const BOX_WIDTH: float = 56.0
const BOX_HEIGHT: float = 88.0

var _destroyed: bool = false
var _flap_phase: float = 0.0

@onready var _body: Polygon2D = $Body
@onready var _wing_left: Polygon2D = $WingLeft
@onready var _wing_right: Polygon2D = $WingRight
@onready var _shape: CollisionShape2D = $CollisionShape2D


func _ready() -> void:
	body_entered.connect(_on_body_entered)
	var rectangle := RectangleShape2D.new()
	rectangle.size = Vector2(BOX_WIDTH, BOX_HEIGHT)
	_shape.shape = rectangle
	# 怪体中心悬挂在 hover_y（世界 y = 地面线 − hover_y）。
	_body.position = Vector2(0, -hover_y)
	_wing_left.position = Vector2(-26, -hover_y - 6)
	_wing_right.position = Vector2(26, -hover_y - 6)


func _process(delta: float) -> void:
	if _destroyed:
		return
	_flap_phase += delta * 10.0
	var flap: float = sin(_flap_phase) * 0.5
	_wing_left.rotation = flap
	_wing_right.rotation = -flap
	_body.position.y = -hover_y + sin(_flap_phase * 0.5) * 4.0


## 冲刺碾毁（与地面怪同口径计分）。
func smash() -> void:
	if _destroyed:
		return
	_destroyed = true
	set_deferred("monitoring", false)
	visible = false
	GameState.add_smash()
	GameState.emit_feedback(&"smash", global_position)
	GameState.emit_feedback(&"smash_air", global_position)


## 对象池复位。
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
