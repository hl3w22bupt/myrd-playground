class_name RestartButton
extends TouchScreenButton
## 结算面板的触摸重开按钮（重开双通道之触摸端，知识 ed31081f 教训：
## game-3 只有触摸入口导致桌面端无法重开 —— 本工程触摸走这里，键盘走 confirm 动作）。
##
## TouchScreenButton 在无触摸屏的桌面端自动不响应/隐藏（visibility_mode=TOUCHSCREEN_ONLY），
## 无位图纹理时用 shape 提供圆形热区，加一个 Label 显示文案。

const BUTTON_RADIUS: float = 40.0

## 点击时给一点视觉反馈（结果性事件挂反馈，SKILL.md §3B）。
@onready var _label: Label = $RestartLabel


func _ready() -> void:
	if shape == null:
		var circle := CircleShape2D.new()
		circle.radius = BUTTON_RADIUS
		shape = circle
	pressed.connect(_on_pressed)


func _on_pressed() -> void:
	if _label != null:
		Juice.pop(_label, 1.25, 0.12)
	Juice.sfx(&"confirm")
	# 复用 confirm 动作语义：Main._unhandled_input 在结算态收到 confirm 即重开，
	# 与键盘通道收敛到同一条重开路径（单一入口，避免两套重开逻辑漂移）。
	var ev := InputEventAction.new()
	ev.action = &"confirm"
	ev.pressed = true
	Input.parse_input_event(ev)
