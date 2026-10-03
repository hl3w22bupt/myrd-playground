class_name SettlementPanel
extends Control
## 结算面板 —— 三分支完成反馈（CLEARED 2 星 / PERFECT 3 星 / FAILED 0 星）。
## 出现即给出明确反馈；R 重开本关、Enter 进下一关（FAILED 时只能重开）。

signal restart_requested
signal next_level_requested

const STAR_TEXT: Array[String] = ["☆☆☆", "★☆☆", "★★☆", "★★★"]
const TITLE_BY_OUTCOME: Dictionary = {
	"CLEARED": "通关！",
	"PERFECT": "完美贴线！",
	"FAILED": "预算见底…",
}
const HINT_BY_OUTCOME: Dictionary = {
	"CLEARED": "集齐全部结晶，还有预算富余（2 星）。下次试试把预算恰好打到 0 冲 3 星。",
	"PERFECT": "集齐全部结晶且预算恰好归零（3 星）——边界零点达成！",
	"FAILED": "预算归零仍未集齐（0 星）。少点空处，或借回扣晶体续命。",
}

@onready var _title: Label = $Card/Title
@onready var _stars: Label = $Card/Stars
@onready var _hint: Label = $Card/Hint
@onready var _next_button: Button = $Card/Buttons/NextButton


func show_outcome(outcome: String, stars: int, collected: int, goal: int, budget_left: int) -> void:
	visible = true
	_title.text = TITLE_BY_OUTCOME.get(outcome, outcome)
	_stars.text = STAR_TEXT[clampi(stars, 0, 3)]
	_hint.text = "%s\n收集 %d / %d · 剩余预算 %d" % [
		HINT_BY_OUTCOME.get(outcome, ""), collected, goal, budget_left,
	]
	_next_button.visible = outcome != "FAILED"


func hide_panel() -> void:
	visible = false


func _on_restart_pressed() -> void:
	restart_requested.emit()


func _on_next_pressed() -> void:
	next_level_requested.emit()
