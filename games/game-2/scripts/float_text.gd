class_name FloatText
extends Node2D
## 收集反馈飘字：在收集点上浮 + 淡出后自毁（需求「收集反馈」的轻量实现）。
##
## 规范要点：自包含生命周期，不依赖外部节点清理；动画用 create_tween（Godot 4 API）。

## 上浮距离（像素）。
const RISE_DISTANCE: float = 26.0
## 存活时长（秒）。
const LIFETIME: float = 0.7

@onready var _label: Label = $Label


func _ready() -> void:
	var tween := create_tween()
	tween.set_parallel(true)
	tween.tween_property(self, "position:y", position.y - RISE_DISTANCE, LIFETIME)
	tween.tween_property(self, "modulate:a", 0.0, LIFETIME).set_ease(Tween.EASE_IN)
	tween.chain().tween_callback(queue_free)


func set_text(value: String) -> void:
	if _label != null:
		_label.text = value
