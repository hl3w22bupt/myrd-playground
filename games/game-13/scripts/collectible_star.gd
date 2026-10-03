class_name CollectibleStar
extends Area2D
## 星光结晶（收集目标）—— 被点击/拖拽扫过即发出 collected 信号并播放消散动画。
## 计费与状态判断都在 Level，实体只负责「命中 → 申报 → 表现」。

signal collected(star: CollectibleStar)

const COLLECT_ANIM_SECONDS: float = 0.25

var _consumed: bool = false

@onready var _sprite: Sprite2D = $Sprite
@onready var _sfx: AudioStreamPlayer2D = $Sfx


func is_consumed() -> bool:
	return _consumed


## 收集反馈：消散动画 + 音效，动画结束后从树上摘除。
func collect() -> void:
	if _consumed:
		return
	_consumed = true
	set_deferred("monitorable", false)
	set_deferred("monitoring", false)
	if _sfx.stream != null:
		_sfx.play()
	collected.emit(self)
	var tween := create_tween().set_parallel(true)
	tween.tween_property(_sprite, "scale", _sprite.scale * 2.2, COLLECT_ANIM_SECONDS)
	tween.tween_property(_sprite, "modulate:a", 0.0, COLLECT_ANIM_SECONDS)
	tween.chain().tween_callback(queue_free)
