class_name RefundCrystal
extends Area2D
## 回扣晶体（bonus）—— 点一下扣 1 点预算返 2 点（净 +1）。
## 吃下它意味着告别 PERFECT，用于失误后的「续命」抉择。

signal consumed(crystal: RefundCrystal)

const COLLECT_ANIM_SECONDS: float = 0.25

var _consumed: bool = false

@onready var _sprite: Sprite2D = $Sprite
@onready var _sfx: AudioStreamPlayer2D = $Sfx


func is_consumed() -> bool:
	return _consumed


func consume() -> void:
	if _consumed:
		return
	_consumed = true
	set_deferred("monitorable", false)
	set_deferred("monitoring", false)
	if _sfx.stream != null:
		_sfx.play()
	consumed.emit(self)
	var tween := create_tween().set_parallel(true)
	tween.tween_property(_sprite, "scale", _sprite.scale * 1.8, COLLECT_ANIM_SECONDS)
	tween.tween_property(_sprite, "modulate:a", 0.0, COLLECT_ANIM_SECONDS)
	tween.chain().tween_callback(queue_free)
