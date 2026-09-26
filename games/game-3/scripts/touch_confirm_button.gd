class_name TouchConfirmButton
extends TouchScreenButton
## 触屏动作按钮：把「点按」注入为 InputMap 动作事件，走与键盘相同的 _unhandled_input 路径。
##
## 规范要点（见 SKILL.md「移动端触摸规范」）：
## - TouchScreenButton 在无触摸屏的桌面端自动不响应，无需手动屏蔽；
## - 触摸控件是动作的「生产者」：注入动作事件，游戏逻辑仍只读动作名（不监听触摸事件）；
## - 无位图纹理时用 shape 提供圆形热区，加一个子 Label 显示文案；
## - 注入哪个动作由 inject_action 决定：本游戏两处使用 ——「跳」= confirm（Player 消费）、
##   「重开」= restart（Main 消费）。注意不能用 TouchScreenButton 原生的 action 属性：
##   它只压/抬动作强度、不产生 InputEvent，_unhandled_input 收不到（error-signatures E-08 同族）。

const BUTTON_RADIUS: float = 44.0

## 点按后注入的 InputMap 动作（命名避开原生 action 属性，否则解析期 redefined 报错）。
@export var inject_action: StringName = &"confirm"
## 按钮文案（写入子 Label；找不到子 Label 只影响文案，不影响动作注入）。
@export var label_text: String = "跳"

@onready var _label: Label = get_node_or_null("Label") as Label


func _ready() -> void:
	if shape == null:
		var circle := CircleShape2D.new()
		circle.radius = BUTTON_RADIUS
		shape = circle
	if not pressed.is_connected(_on_pressed):
		pressed.connect(_on_pressed)
	if _label != null:
		_label.text = label_text


func _on_pressed() -> void:
	var ev := InputEventAction.new()
	ev.action = inject_action
	ev.pressed = true
	Input.parse_input_event(ev)
