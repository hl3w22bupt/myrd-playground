class_name MuteButton
extends CanvasLayer
## 常驻静音开关（spec audio.mute：右上角常驻、≥44×44px、解锁前后均可见可点、即时生效、
## 会话内记忆）。独立 CanvasLayer（layer 40）悬浮在选关 / 对局 / 结算之上，不随 HUD 显隐。
## 静音 = AudioServer 总线 mute，一次性覆盖 BGM 与全部音效，点击后即时生效。

var _button: Button


func _ready() -> void:
	layer = 40
	visible = true
	_button = Button.new()
	FlatUI.apply_button_on_dark(_button, FlatUI.UI_BASE, FlatUI.FONT_ASSIST)
	_button.text = _label()
	_button.custom_minimum_size = Vector2(72, 44)
	_button.focus_mode = Control.FOCUS_NONE
	_button.set_anchors_and_offsets_preset(Control.PRESET_TOP_RIGHT)
	_button.offset_left = -76.0
	_button.offset_top = 8.0
	_button.offset_right = -4.0
	_button.offset_bottom = 52.0
	_button.pressed.connect(_on_pressed)
	add_child(_button)


func _label() -> String:
	return "音效 关" if Audio.is_muted() else "音效 开"


func _on_pressed() -> void:
	var muted := not Audio.is_muted()
	Audio.set_muted(muted)
	_button.text = _label()
	Juice.pop(_button)
	if not muted:
		Juice.sfx(&"confirm")


## 同步外部静音状态（冒烟断言 / 调试用）。
func refresh() -> void:
	_button.text = _label()
