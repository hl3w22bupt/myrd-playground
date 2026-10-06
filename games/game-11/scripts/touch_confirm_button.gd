class_name TouchConfirmButton
extends TouchScreenButton
## 触摸动作按钮：按下后把原生 action 属性指定的动作注入为真实 InputEventAction，
## 走与键盘相同的 _unhandled_input 路径。
##
## 规范要点（见 SKILL.md「移动端触摸规范」）：
## - TouchScreenButton 在无触摸屏的桌面端自动不响应，无需手动屏蔽；
## - 无位图纹理时用 shape 提供圆形热区，加一个 Label 显示文案；
## - 动作名用原生 action 属性配置（下爪 confirm / 换爪 switch_claw），场景里逐按钮设置；
##   原生 action 只改动作强度、不产生 InputEvent，所以这里补一次事件注入让 _unhandled_input 收得到。

const BUTTON_RADIUS: float = 44.0

@onready var _label: Label = get_node_or_null("Label")


func _ready() -> void:
	if shape == null:
		var circle := CircleShape2D.new()
		circle.radius = BUTTON_RADIUS
		shape = circle
	pressed.connect(_on_pressed)


func _on_pressed() -> void:
	if String(action).is_empty():
		return
	var ev := InputEventAction.new()
	ev.action = action
	ev.pressed = true
	Input.parse_input_event(ev)
