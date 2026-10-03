class_name PlayerCursor
extends Node2D
## 仓库管理员光标 —— 轻交互的「手感」层。
## 把底层指针事件翻译成带世界坐标的语义信号（按下=开始扫收 / 移动=拖拽扫过 / 抬起=结束），
## 判定（冷却 / 命中 / 计费 / 边界）都在 Level。headless 冒烟注入原始 InputEvent 即可驱动。

signal pointer_moved(world_pos: Vector2)
signal sweep_started_at(world_pos: Vector2)
signal sweep_moved(world_pos: Vector2)
signal sweep_ended_at(world_pos: Vector2)

const HIT_RADIUS_PX: float = 28.0

var _pressed: bool = false


func _ready() -> void:
	z_index = 50


func _to_world(screen_pos: Vector2) -> Vector2:
	return get_canvas_transform().affine_inverse() * screen_pos


func _unhandled_input(event: InputEvent) -> void:
	var handled := false
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		_pressed = event.pressed
		var world := _to_world(event.position)
		position = world
		pointer_moved.emit(world)
		if event.pressed:
			sweep_started_at.emit(world)
		else:
			sweep_ended_at.emit(world)
		handled = true
	elif event is InputEventMouseMotion:
		var world := _to_world(event.position)
		position = world
		pointer_moved.emit(world)
		if _pressed:
			sweep_moved.emit(world)
		handled = true
	if handled:
		queue_redraw()
		get_viewport().set_input_as_handled()


func is_sweeping() -> bool:
	return _pressed


func _draw() -> void:
	var ring := Color(1.0, 0.92, 0.55, 0.9) if not _pressed else Color(1.0, 0.75, 0.25, 1.0)
	draw_arc(Vector2.ZERO, HIT_RADIUS_PX, 0.0, TAU, 32, ring, 2.0, true)
	draw_circle(Vector2.ZERO, 3.0, ring)
