class_name Obstacle
extends Area2D
## 障碍物：撞上即 game over（信号交给 Main → GameState.trigger_game_over）。
##
## 与拾取物同规则：仅 RUNNING 状态滚动，game over 后世界冻结（配合终局单晃后的完全静止）。

signal hit_player(obstacle: Obstacle)


func _ready() -> void:
	body_entered.connect(_on_body_entered)


func _process(delta: float) -> void:
	if GameState.state != GameState.State.RUNNING:
		return
	position.x -= GameState.current_speed_px() * delta
	if position.x < -40.0:
		queue_free()


func _on_body_entered(body: Node2D) -> void:
	if body is Player and GameState.state == GameState.State.RUNNING:
		hit_player.emit(self)
