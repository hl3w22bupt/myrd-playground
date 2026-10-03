class_name HudBudgetMeter
extends Label
## 预算条 HUD —— 实时显示剩余预算；预算吃紧（≤2）时变色提醒。

const WARN_AT: int = 2
const COLOR_NORMAL := Color(0.92, 0.95, 1.0)
const COLOR_WARN := Color(1.0, 0.62, 0.35)


func _ready() -> void:
	set_budget(0, 0)


func set_budget(remaining: int, _delta: int = 0) -> void:
	text = "剩余预算：%d" % remaining
	add_theme_color_override("font_color", COLOR_WARN if remaining <= WARN_AT else COLOR_NORMAL)
