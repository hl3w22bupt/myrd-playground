class_name LogRoller
extends Area2D
## 滚动原木：从场景一侧横向滚向另一侧；碰到松鼠 = 本局立即结束（强惩罚，知识 6e91a11d §四）。
##
## - 速度由 LogSpawner 按「剩余时间」递增公式给定（v(t) = lerp(v1, v0, timeLeft/60)）；
## - 碰撞盒用矩形近似（不做逐像素）；滚转只转视觉子节点，碰撞盒保持稳定；
## - 完全滚出场景（含余量）后自毁，防止节点泄漏。

signal hit_player

## 由 LogSpawner 在实例化后、入树前设置。
var speed: float = 120.0
var direction: int = 1  # 1 = 从左向右，-1 = 从右向左

## 原木视觉尺寸（碰撞盒一致，矩形近似）。
const LOG_SIZE: Vector2 = Vector2(96, 28)
## 完全出界（超出视口这么多像素）即自毁。
const DESPAWN_MARGIN: float = 160.0

var _stopped: bool = false

@onready var _visual: Node2D = $Visual


func _ready() -> void:
	body_entered.connect(_on_body_entered)
	# 入场反馈：新原木可感知（反馈密度 + 玩家预警）。
	Juice.flash(self, Color(1.0, 0.9, 0.7, 0.5), 0.18)


func _physics_process(delta: float) -> void:
	if _stopped:
		return
	position.x += speed * float(direction) * delta
	# 滚转视觉：角速度 = 线速度 / 半径（视觉子节点，不影响碰撞盒）。
	_visual.rotation += (speed / (LOG_SIZE.y * 0.5)) * delta * float(direction)
	var bounds := get_viewport_rect().size
	if position.x < -DESPAWN_MARGIN or position.x > bounds.x + DESPAWN_MARGIN:
		queue_free()


## 结算时定格场上原木（不再滚动、不再触发新的碰撞判定）。
func stop_rolling() -> void:
	_stopped = true


func _on_body_entered(body: Node2D) -> void:
	if _stopped:
		return
	if body is Player:
		hit_player.emit()
