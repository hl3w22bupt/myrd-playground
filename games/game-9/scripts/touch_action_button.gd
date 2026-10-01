class_name TouchActionButton
extends TouchScreenButton
## 触屏动作按钮：点击后注入对应 InputMap 动作，走与键盘相同的 _unhandled_input 路径。
##
## 规范要点（godot-game-dev SKILL.md「移动端触摸规范」）：
## - 触摸控件是动作的「生产者」，经 Input.parse_input_event 注入动作事件；
##   游戏逻辑（main.gd 的 _unhandled_input）仍然只读 InputMap 动作名，二者互不感知；
## - TouchScreenButton 在无触摸屏的桌面端自动不响应，无需手动屏蔽；
## - 无位图纹理时用 shape 提供圆形热区，加一个子 Label 显示文案；
## - 动作名走 emit_action 导出属性（不占用 TouchScreenButton 内建的 action 字段，
##   避免与引擎自带的动作注入叠成两路输入）。

const BUTTON_RADIUS: float = 34.0

@export var emit_action: StringName = &"confirm"

@onready var _label: Label = get_node_or_null("Label") as Label


func _ready() -> void:
	if shape == null:
		var circle := CircleShape2D.new()
		circle.radius = BUTTON_RADIUS
		shape = circle
	pressed.connect(_on_pressed)


func _on_pressed() -> void:
	var event := InputEventAction.new()
	event.action = emit_action
	event.pressed = true
	Input.parse_input_event(event)
