class_name SettlePanel
extends CenterContainer
## 结算面板（spec entity: settle-panel）：展示本局距离/金币/得分与历史记录，
## 「重新开始」按钮发 restart_requested（订阅方在主场景，本类不直接复位游戏）。

## 点击「重新开始」（主场景订阅 → restart_run）。
signal restart_requested

@onready var _title_label: Label = %TitleLabel
@onready var _settle_label: Label = %SettleLabel
@onready var _record_label: Label = %RecordLabel
@onready var _restart_button: Button = %RestartButton


func _ready() -> void:
	_restart_button.pressed.connect(_on_restart_pressed)


func _unhandled_input(event: InputEvent) -> void:
	# 确认/重开键在结算页生效（运行中空格属于跳跃，不抢）。
	if visible and (event.is_action_pressed(&"confirm") or event.is_action_pressed(&"restart")):
		_on_restart_pressed()


## 展示结算（acc-05：金币数与实际拾取同源；新增破纪录标注）。
func show_result(win: bool, score: int, coins: int, distance_m: float) -> void:
	_title_label.text = "新纪录！" if score >= GameState.best_score and score > 0 else "本局结束"
	_settle_label.text = "距离 %dm · 金币 %d 枚 · 得分 %d%s" % [
		int(distance_m), coins, score, "（达标通关）" if win else "",
	]
	_record_label.text = "历史最高分 %d · 累计金币 %d · 最远 %dm" % [
		GameState.best_score, GameState.total_coins, int(GameState.best_distance_m),
	]
	visible = true
	_restart_button.grab_focus()


func hide_panel() -> void:
	visible = false


func _on_restart_pressed() -> void:
	restart_requested.emit()
