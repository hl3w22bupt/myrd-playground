class_name StarDust
extends Area2D
## 星尘晶体：核心交互「收集」的目标。
##
## 规范要点：
## - 只 emit 信号（collected），加分/飘字/补位由 main.gd 集中订阅处理；
## - `_collected` 门闩保证同一颗星尘只计一次分（需求验收标准 1）；
## - 收集即 queue_free，物理上杜绝重复计分。

## 玩家碰到晶体时发出，携带晶体位置（飘字用）。
signal collected(position: Vector2)

var _collected: bool = false


func _ready() -> void:
	body_entered.connect(_on_body_entered)
	_play_pulse()


func _on_body_entered(body: Node2D) -> void:
	if _collected or not (body is Player):
		return
	_collected = true
	# 物理回调里改监控状态必须 deferred，避免引擎刷新监控集时报错。
	set_deferred("monitoring", false)
	collected.emit(global_position)
	queue_free()


## 待机呼吸动画：让晶体在陨石带里可辨识。
func _play_pulse() -> void:
	var tween := create_tween()
	tween.set_loops()
	tween.tween_property(self, "scale", Vector2(1.18, 1.18), 0.55).from(Vector2.ONE).set_trans(Tween.TRANS_SINE)
	tween.tween_property(self, "scale", Vector2.ONE, 0.55).from(Vector2(1.18, 1.18)).set_trans(Tween.TRANS_SINE)
