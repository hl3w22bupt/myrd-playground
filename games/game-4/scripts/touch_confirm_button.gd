class_name TouchActionButton
extends TouchScreenButton
## 触摸动作按钮：按下后注入指定 InputMap 动作，走与键盘相同的 _unhandled_input 路径。
##
## 规范要点（见 SKILL.md「移动端触摸规范」）：
## - TouchScreenButton 在无触摸屏的桌面端自动不响应，无需手动屏蔽；
## - 无位图纹理时用 shape 提供圆形热区，加一个 Label 显示文案；
## - 动作名参数化（@export action）：确认=confirm、重开=reset 复用同一脚本。

const BUTTON_RADIUS: float = 44.0

## 注入的 InputMap 动作名，场景里逐实例覆盖。
## （不能叫 action：TouchScreenButton 内建同名属性，脚本变量重名会报解析错。）
@export var inject_action: StringName = &"confirm"

@onready var _label: Label = %ConfirmLabel


func _ready() -> void:
	if shape == null:
		var circle := CircleShape2D.new()
		circle.radius = BUTTON_RADIUS
		shape = circle
	pressed.connect(_on_pressed)


func _on_pressed() -> void:
	var ev := InputEventAction.new()
	ev.action = inject_action
	ev.pressed = true
	Input.parse_input_event(ev)
