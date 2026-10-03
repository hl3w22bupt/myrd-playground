class_name HudCollectCounter
extends Label
## 收集计数 HUD —— 实时显示「已收 / 目标」；集齐后高亮并给完成反馈前缀。

const COLOR_NORMAL := Color(0.92, 0.95, 1.0)
const COLOR_DONE := Color(0.55, 1.0, 0.6)


func _ready() -> void:
	set_progress(0, 0)


func set_progress(collected: int, goal: int) -> void:
	text = "收集进度：%d / %d" % [collected, goal]
	add_theme_color_override("font_color", COLOR_DONE if collected >= goal and goal > 0 else COLOR_NORMAL)
