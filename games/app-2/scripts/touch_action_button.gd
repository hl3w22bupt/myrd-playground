class_name TouchActionButton
extends TouchScreenButton
## 触屏动作按钮：按下后注入指定 InputMap 动作，走与键盘相同的 _unhandled_input 路径。
##
## 规范要点（见 SKILL.md「移动端触摸规范」）：
## - TouchScreenButton 在无触摸屏的桌面端自动不响应，无需手动屏蔽；
## - 无位图纹理时用 shape 提供圆形热区（半径 ≥44 逻辑像素），加一个 Label 显示文案；
## - 一个按钮对应一个 InputMap 动作（confirm=收集 / restart=再来一局），
##   游戏逻辑不感知触摸来源 —— 触摸控件只是动作的「生产者」。

## 按钮热区半径（逻辑像素）；触摸热区不得小于 44px。
const BUTTON_RADIUS: float = 44.0

## 注入的 InputMap 动作名；场景里每个按钮在属性面板各自指定。
@export var action_name: StringName = &"confirm"

@onready var _label: Label = _find_label()


func _ready() -> void:
	if shape == null:
		var circle := CircleShape2D.new()
		circle.radius = BUTTON_RADIUS
		shape = circle
	pressed.connect(_on_pressed)


## 文案子节点查找：同场景可能有多个动作按钮（收集/再来一局），
## 不能用 %唯一名（unique_name_in_owner 全场景唯一），取第一个 Label 子节点即可。
func _find_label() -> Label:
	for child in get_children():
		if child is Label:
			return child as Label
	return null


func _on_pressed() -> void:
	var ev := InputEventAction.new()
	ev.action = action_name
	ev.pressed = true
	Input.parse_input_event(ev)
