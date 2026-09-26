class_name Hud
extends CanvasLayer
## HUD 与结算面板：剩余时间 / 得分 / 收集数 / 连击窗口倒计时，以及结算三要素 + 重开入口。
##
## 规范（知识 6e91a11d §三/§六）：
## - 连击 UI 必须显式：连击数 + 剩余窗口条形倒计时，窗口将尽变色提示；
## - 结算三要素：本局得分、收集水果数量、历史最高分（读取时机在覆写之后，三处自洽）；
## - 本节点不自行算分（数值一律读 GameState / 入参），只订阅信号刷新显示。

signal restart_requested

const COMBO_WINDOW: float = 3.0
## 窗口将尽（< 1 秒）的警示色（知识 6e91a11d §三：让玩家知道「再快一点就能续上」）。
const COMBO_URGENT_COLOR: Color = Color(1.0, 0.45, 0.2)
const COMBO_BAR_IDLE_ALPHA: float = 0.35

@onready var time_label: Label = %TimeLabel
@onready var score_label: Label = %ScoreLabel
@onready var fruit_label: Label = %FruitLabel
@onready var combo_label: Label = %ComboLabel
@onready var combo_bar: ProgressBar = %ComboBar
@onready var result_panel: PanelContainer = %ResultPanel
@onready var result_title: Label = %ResultTitle
@onready var result_score: Label = %ResultScore
@onready var result_fruits: Label = %ResultFruits
@onready var result_best: Label = %ResultBest
@onready var restart_button: TouchScreenButton = %RestartButton


func _ready() -> void:
	restart_button.pressed.connect(_on_restart_button_pressed)
	result_panel.visible = false
	combo_bar.max_value = COMBO_WINDOW
	combo_bar.value = 0.0
	on_score_changed(0)
	on_fruits_changed(0)
	on_time_changed(GameState.MATCH_SECONDS)


func _process(_delta: float) -> void:
	# 连击窗口逐帧刷新（GameState 状态机是唯一事实源，这里只做显示）。
	combo_bar.value = GameState.combo_window_left
	if GameState.combo_count > 0:
		combo_label.text = "连击 x%d（%.1fs）" % [GameState.combo_count, GameState.combo_window_left]
		var urgent := GameState.combo_window_left < 1.0
		combo_label.add_theme_color_override(
			"font_color", Hud.COMBO_URGENT_COLOR if urgent else Color.WHITE)
	else:
		combo_label.text = ""
		combo_bar.modulate = Color(1, 1, 1, COMBO_BAR_IDLE_ALPHA)


func on_time_changed(time_left: float) -> void:
	time_label.text = "剩余时间 %d" % int(ceilf(maxf(time_left, 0.0)))


func on_score_changed(score: int) -> void:
	score_label.text = "得分 %d" % score


func on_fruits_changed(count: int) -> void:
	fruit_label.text = "水果 %d" % count


## 失败 / 到时结算：三要素 + 标题（失败局明确「被原木击中」，避免误以为计时结束）。
func show_result(title: String, final_score: int, fruits: int, best: int) -> void:
	result_title.text = title
	result_score.text = "本局得分 %d" % final_score
	result_fruits.text = "收集水果 %d 个" % fruits
	result_best.text = "历史最高 %d" % best
	result_panel.visible = true
	Juice.pop(result_panel)
	Juice.sfx(&"confirm")


func hide_result() -> void:
	result_panel.visible = false


func _on_restart_button_pressed() -> void:
	# 触摸通道（桌面键盘 Enter/Space 走 confirm 动作，双通道 —— 知识 ed31081f 教训）。
	restart_requested.emit()
