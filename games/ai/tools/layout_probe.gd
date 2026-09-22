extends Node2D
func _ready() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	var rect := TextureRect.new()
	layer.add_child(rect)
	rect.anchor_left = 0.5
	rect.anchor_top = 1.0
	rect.anchor_right = 0.5
	rect.anchor_bottom = 1.0
	rect.offset_left = -280
	rect.offset_top = -120
	rect.offset_right = 280
	rect.offset_bottom = -10
	await get_tree().process_frame
	await get_tree().process_frame
	print("[probe] canvas=", get_viewport_rect().size, " rect.global=", rect.get_global_rect(),
			" size=", rect.size, " pos=", rect.position)
	get_tree().quit(0)
