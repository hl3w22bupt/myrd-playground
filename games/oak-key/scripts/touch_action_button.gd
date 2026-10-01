class_name TouchActionButton
extends TouchScreenButton
## 触摸动作按钮：直接复用 TouchScreenButton 内建 `action` 属性（main.tscn 里探测按钮
## action="confirm"、重开按钮 action="restart"），把 InputEventAction 注入输入管线，
## 与键盘走同一条 _unhandled_input 路径 —— 不额外声明同名成员（内建属性已被占用）。
##
## 规范要点（见 SKILL.md「移动端触摸规范」）：
## - TouchScreenButton 在无触摸屏的桌面端自动不响应，无需手动屏蔽；
## - 无位图纹理时用 shape 提供圆形热区，加一个 Label 子节点（名字必须是 Label）显示文案。

const BUTTON_RADIUS: float = 44.0

## 动作名 → 按钮文案（_ready 时对齐，避免场景文案与动作漂移）。
const ACTION_LABELS: Dictionary = {
	&"confirm": "探测",
	&"restart": "重开",
}

@onready var _label: Label = get_node_or_null("Label") as Label


func _ready() -> void:
	if shape == null:
		var circle := CircleShape2D.new()
		circle.radius = BUTTON_RADIUS
		shape = circle
	if _label != null and ACTION_LABELS.has(action):
		_label.text = String(ACTION_LABELS[action])
	pressed.connect(_on_pressed)


func _on_pressed() -> void:
	if action == &"":
		return
	var ev := InputEventAction.new()
	ev.action = action
	ev.pressed = true
	Input.parse_input_event(ev)
