class_name TouchConfirmButton
extends Button
## 触屏确认按钮：点击后注入 confirm 动作，走与键盘相同的 _unhandled_input 路径。
##
## 规范要点（见 SKILL.md「移动端触摸规范」）：
## - 触摸控件是动作的「生产者」：pressed 信号 → InputEventAction(confirm) 注入引擎，
##   游戏逻辑（main.gd 的相位机）只认 InputMap 动作名，与键盘 Space/Enter 同路径；
## - 用 Button（而非 TouchScreenButton）：确认按钮与各全屏 overlay 同处 gui 命中体系，
##   Button 命中后事件被消费、不再落进 main 的 ScreenTouch 分支，保证一次点按一次语义；
## - 热区 ≥44 物理像素：尺寸由 main.gd 按窗口/画布缩放换算（data/spec/touch.json 可调）。

## 按钮文案（触屏语义：任何相位下都等价于「推进/确认」）。
const BUTTON_LABEL: String = "推进"


func _ready() -> void:
	text = BUTTON_LABEL
	add_theme_font_size_override("font_size", 20)
	pressed.connect(_on_pressed)


## 由 Main 按 data/spec/touch.json 的换算结果设置热区（逻辑像素）。
func apply_hotspot(min_size: Vector2) -> void:
	custom_minimum_size = min_size


func _on_pressed() -> void:
	var ev := InputEventAction.new()
	ev.action = &"confirm"
	ev.pressed = true
	Input.parse_input_event(ev)
