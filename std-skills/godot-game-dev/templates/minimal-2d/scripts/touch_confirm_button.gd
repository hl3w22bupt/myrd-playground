class_name TouchConfirmButton
extends TouchScreenButton
## 触摸确认按钮：点击后注入 confirm 动作，走与键盘相同的 _unhandled_input 路径。
##
## 规范要点（见 SKILL.md「移动端触摸规范」）：
## - TouchScreenButton 在无触摸屏的桌面端自动不响应，无需手动屏蔽；
## - 无位图纹理时用 shape 提供圆形热区，加一个 Label 显示文案。

const BUTTON_RADIUS: float = 44.0

@onready var _label: Label = %ConfirmLabel


func _ready() -> void:
	if shape == null:
		var circle := CircleShape2D.new()
		circle.radius = BUTTON_RADIUS
		shape = circle
	pressed.connect(_on_pressed)


func _on_pressed() -> void:
	var ev := InputEventAction.new()
	ev.action = &"confirm"
	ev.pressed = true
	Input.parse_input_event(ev)
