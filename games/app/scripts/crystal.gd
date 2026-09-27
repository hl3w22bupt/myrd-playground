class_name Crystal
extends Area2D
## 能量水晶：青色规则菱形 + 白高光 + 2Hz 呼吸闪烁（知识基准 4.1 视觉双编码）。
##
## 飞船（CharacterBody2D）撞上 → body_entered → 发 collected → main 订阅后计分。
## 对外只发信号，不直接改分数、不持有 UI。

## 被飞船拾取时发出（main 订阅：GameState 计分 + Juice 反馈）。
signal collected(crystal: Crystal)

const PICKUP_RADIUS: float = 26.0
const BREATH_HZ: float = 2.0

var _time: float = 0.0
var _taken: bool = false


func _ready() -> void:
	body_entered.connect(_on_body_entered)
	_time = randf() * TAU  # 呼吸相位错开，避免同屏水晶同步闪烁
	Juice.sfx(&"spawn")


func _process(delta: float) -> void:
	_time += delta
	var pulse := 0.5 + 0.5 * sin(TAU * BREATH_HZ * _time)
	modulate.a = 0.72 + 0.28 * pulse


func _on_body_entered(body: Node2D) -> void:
	if _taken or not (body is Player):
		return
	_taken = true
	collected.emit(self)
	queue_free()
