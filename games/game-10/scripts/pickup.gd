class_name Pickup
extends Area2D
## 可拾取物：金币（coin，加分）/ 加速星（boost，触发加速特效）。
##
## 世界滚动：拾取物以 GameState 当前速度向左移动；非 RUNNING 状态冻结。
## 对外只发信号，加分/加速由 Main 订阅后驱动 GameState。

signal picked_up(pickup: Pickup)

## coin = 金币加分；boost = 加速星（触发 GameState.start_speeding）。
@export_enum("coin", "boost") var kind: String = "coin"

const COLOR_COIN: Color = Color(1.0, 0.82, 0.2, 1.0)
const COLOR_BOOST: Color = Color(0.35, 0.8, 1.0, 1.0)

@onready var _visual: Polygon2D = $Visual


func _ready() -> void:
	body_entered.connect(_on_body_entered)
	_visual.color = COLOR_BOOST if kind == "boost" else COLOR_COIN


func _process(delta: float) -> void:
	if GameState.state != GameState.State.RUNNING:
		return
	position.x -= GameState.current_speed_px() * delta
	if position.x < -40.0:
		queue_free()


func _on_body_entered(body: Node2D) -> void:
	if body is Player and GameState.state == GameState.State.RUNNING:
		picked_up.emit(self)
