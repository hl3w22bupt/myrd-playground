class_name Collectible
extends Area2D
## 可收集物「青草垛」：定时/随机刷新在场地上的收集目标。
##
## 规范要点（见 SKILL.md「信号方向单向」）：
## - 只 emit collected 信号，不直接改分数、不持有 UI（计数与回收在 main.gd 订阅侧完成）；
## - 生命周期由主场景管理（收到信号后 queue_free 并调度补充刷新）。

## 被牛牛碰到时发出；参数是本体，订阅方可直接回收该节点。
signal collected(collectible: Collectible)


func _ready() -> void:
	# Area2D 重叠回调：撞上来的是玩家拾取区（player_pickup 组）才算收集成功。
	area_entered.connect(_on_area_entered)


func _on_area_entered(area: Area2D) -> void:
	if GameState.phase != GameState.Phase.RUNNING:
		return
	if not area.is_in_group("player_pickup"):
		return
	collected.emit(self)
