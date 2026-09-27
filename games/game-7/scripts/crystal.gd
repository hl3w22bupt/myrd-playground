class_name Crystal
extends Area2D
## 能量水晶：规则菱形 + 白色高光 + 2Hz 呼吸闪烁（与陨石的不规则轮廓形成形状双编码，
## 色弱/低端屏下仍可辨）。青色 #7FF6E8 与三种陨石色相均相距 ≥90°，规避撞色。

signal collected(crystal: Crystal)

const BLINK_HZ: float = 2.0
## 拾取判定半径 16px：刻意大于视觉菱形半高 14px（约 +14%）——收集类判定向玩家倾斜，
## 防「明明碰到却没吃到」的挫败；与陨石（碰撞向内收 8%）的严格判定形成松紧对比。
const PICKUP_RADIUS: float = 16.0

var fall_factor: float = 1.0
var _age: float = 0.0
var _diamond: PackedVector2Array = PackedVector2Array([
	Vector2(0, -14), Vector2(9, 0), Vector2(0, 14), Vector2(-9, 0),
])
var _highlight: PackedVector2Array = PackedVector2Array([
	Vector2(-3, -6), Vector2(0, -10), Vector2(3, -6), Vector2(0, -2),
])


func _ready() -> void:
	var shape := CircleShape2D.new()
	shape.radius = PICKUP_RADIUS
	var collision := $CollisionShape2D as CollisionShape2D
	collision.shape = shape
	body_entered.connect(_on_body_entered)


func _physics_process(delta: float) -> void:
	_age += delta
	position.y += GameState.speed() * fall_factor * delta
	modulate.a = 0.65 + 0.35 * absf(sin(_age * BLINK_HZ * TAU))
	var bottom := get_viewport_rect().end.y
	if position.y > bottom + 60.0:
		queue_free()


func _draw() -> void:
	var tint := Color(str(GameState.config["visual"]["crystal"]))
	draw_colored_polygon(_diamond, tint)
	draw_polyline(_diamond + PackedVector2Array([_diamond[0]]), Color(1, 1, 1, 0.85), 1.5)
	draw_colored_polygon(_highlight, Color(1, 1, 1, 0.9))


func _on_body_entered(body: Node2D) -> void:
	if body is Player and GameState.phase == GameState.Phase.PLAYING:
		collected.emit(self)
		queue_free()
