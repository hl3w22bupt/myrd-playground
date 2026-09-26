class_name Asteroid
extends Area2D
## 陨石：匀速漂移的障碍物，越界回绕。
##
## 规范要点：
## - 碰到玩家只调用 Player.take_hit()，扣不扣盾由玩家侧无敌帧决定（职责分离）；
## - 漂移用 _physics_process，速度由 main.gd 生成时注入（速度区间来自 GameConfig）。

## 世界回绕范围（与视口同尺寸，飞出一侧从另一侧回来）。
const WRAP_BOUNDS: Rect2 = Rect2(0.0, 0.0, 640.0, 360.0)

## 漂移速度（像素/秒），生成时由 main.gd 注入。
var velocity: Vector2 = Vector2.ZERO


func _ready() -> void:
	body_entered.connect(_on_body_entered)
	_play_spin()


func _physics_process(delta: float) -> void:
	position += velocity * delta
	_wrap_around()


func _on_body_entered(body: Node2D) -> void:
	if body is Player:
		body.take_hit()


## 越界回绕：让陨石带始终保持密度，不需要补生成。
func _wrap_around() -> void:
	if position.x < WRAP_BOUNDS.position.x:
		position.x = WRAP_BOUNDS.end.x
	elif position.x > WRAP_BOUNDS.end.x:
		position.x = WRAP_BOUNDS.position.x
	if position.y < WRAP_BOUNDS.position.y:
		position.y = WRAP_BOUNDS.end.y
	elif position.y > WRAP_BOUNDS.end.y:
		position.y = WRAP_BOUNDS.position.y


## 自转动画：转 Visual 子节点（0 → TAU 循环），不转根节点避免影响碰撞朝向语义。
func _play_spin() -> void:
	var visual: Node2D = get_node_or_null("Visual")
	if visual == null:
		return
	var tween := create_tween()
	tween.set_loops()
	tween.tween_property(visual, "rotation", TAU, randf_range(5.0, 9.0)).from(0.0)
