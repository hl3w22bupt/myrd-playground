class_name TouchActionButton
extends TouchScreenButton
## 触摸动作按钮（移动端）：按下后注入对应 InputMap 动作，走与键盘相同的 _unhandled_input 路径。
##
## 规范要点（SKILL.md「移动端触摸规范」）：
## - 触摸控件是动作的「生产者」；游戏逻辑仍只读 InputMap 动作名，键盘与触摸并存互不感知；
## - TouchScreenButton 在无触摸屏的桌面端自动不响应，无需手动屏蔽；
## - 无位图纹理时用 shape 提供热区（本游戏用矩形 = 四轨触控分区）；
## - 多点触控：TouchScreenButton 按 touch index 跟踪各自触点，四指并发各按钮独立响应。

## 要注入的动作名（如 &"lane_1"）；留空 = 纯按钮（由场景代码直接连 pressed 信号）。
## 注意：不能叫 action——TouchScreenButton 原生已有同名属性，重定义会 Parse Error。
var action_name: StringName = &""


## 工厂：代码建 UI 时用（action 为空则只作为可连信号的按钮）。
static func create(button_action: StringName, rect: Rect2, label_text: String,
		font_size: int = 40) -> TouchActionButton:
	var button := TouchActionButton.new()
	button.action_name = button_action
	button.position = rect.position
	var shape := RectangleShape2D.new()
	shape.size = rect.size
	button.shape = shape
	if not label_text.is_empty():
		var label := Label.new()
		label.text = label_text
		var half_w := rect.size.x / 2.0
		var half_h := rect.size.y / 2.0
		label.position = Vector2(-half_w, -half_h)
		label.size = rect.size
		label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		label.add_theme_font_size_override("font_size", font_size)
		label.add_theme_color_override("font_color", Color(0.92, 0.95, 1.0, 0.85))
		label.mouse_filter = Control.MOUSE_FILTER_IGNORE
		button.add_child(label)
	button.pressed.connect(button._on_pressed)
	return button


func _on_pressed() -> void:
	if action_name == &"":
		return
	var ev := InputEventAction.new()
	ev.action = action_name
	ev.pressed = true
	Input.parse_input_event(ev)
