class_name DecoyRock
extends Area2D
## 诱饵石（hazard）—— 外形醒目但点击扣 1 点预算且不计收集目标。
## 只做视觉抖动反馈，不从场景移除（可反复误触，玩家要学会别点它）。

signal decoy_hit(rock: DecoyRock)

var _cooldown: bool = false

@onready var _sprite: Sprite2D = $Sprite
@onready var _sfx: AudioStreamPlayer2D = $Sfx


func hit() -> void:
	if _cooldown:
		return
	_cooldown = true
	if _sfx.stream != null:
		_sfx.play()
	decoy_hit.emit(self)
	var origin := _sprite.position
	var tween := create_tween()
	tween.tween_property(_sprite, "position:x", origin.x + 3.0, 0.05)
	tween.tween_property(_sprite, "position:x", origin.x - 3.0, 0.05)
	tween.tween_property(_sprite, "position:x", origin.x, 0.05)
	tween.tween_callback(func() -> void: _cooldown = false)
