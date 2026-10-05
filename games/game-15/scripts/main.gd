extends Node2D
## 主场景控制器：装配 HUD / 图鉴 / 按钮与过关覆盖层，订阅 Board 与 GameState 的信号。
## 规范要点（见 SKILL.md「场景规范」）：
## - 信号连接统一写在 _ready()，集中可见、可被 preflight 静态核对（P8）；
## - 节点引用用 @onready + 类型标注，路径用 %唯一名 代替长路径字符串；
## - 对反馈文案做短促淡出（_process 计时，不用 await，保证无头可判定）。

const MSG_SHOW_SECONDS: float = 2.2

@onready var board: Node2D = $Board
@onready var hud_label: Label = %HudLabel
@onready var msg_label: Label = %MsgLabel
@onready var collection_label: Label = %CollectionLabel
@onready var hint_button: Button = %HintButton
@onready var win_layer: CanvasLayer = %WinLayer
@onready var win_label: Label = %WinLabel

var _msg_left: float = 0.0


func _ready() -> void:
	# 信号连接：订阅方（本场景）写连接代码，发布方（board / GameState）只 emit。
	if not board.feedback.is_connected(_on_board_feedback):
		board.feedback.connect(_on_board_feedback)
	if not board.restart_requested.is_connected(_on_restart_button_pressed):
		board.restart_requested.connect(_on_restart_button_pressed)
	if not GameState.score_changed.is_connected(_on_score_changed):
		GameState.score_changed.connect(_on_score_changed)
	if not GameState.progress_changed.is_connected(_on_progress_changed):
		GameState.progress_changed.connect(_on_progress_changed)
	if not GameState.collected_changed.is_connected(_on_collected_changed):
		GameState.collected_changed.connect(_on_collected_changed)
	if not GameState.hints_changed.is_connected(_on_hints_changed):
		GameState.hints_changed.connect(_on_hints_changed)
	if not GameState.game_won.is_connected(_on_game_won):
		GameState.game_won.connect(_on_game_won)
	hint_button.pressed.connect(_on_hint_button_pressed)
	%ShuffleButton.pressed.connect(_on_shuffle_button_pressed)
	%WinRestartButton.pressed.connect(_on_restart_button_pressed)
	win_layer.visible = false
	msg_label.text = ""
	_refresh_hud()
	_refresh_collection(-1)
	_refresh_hint_button()


func _process(delta: float) -> void:
	if _msg_left > 0.0:
		_msg_left = maxf(_msg_left - delta, 0.0)
		msg_label.modulate.a = clampf(_msg_left / 0.4, 0.0, 1.0)


func restart_game() -> void:
	win_layer.visible = false
	board.new_game()


## ── 信号处理 ────────────────────────────────────────────────

func _on_board_feedback(text: String) -> void:
	msg_label.text = text
	msg_label.modulate.a = 1.0
	_msg_left = MSG_SHOW_SECONDS


func _on_score_changed(_score: int) -> void:
	_refresh_hud()


func _on_progress_changed(_remaining: int, _total: int) -> void:
	_refresh_hud()


func _on_collected_changed(type_id: int, _count: int, _total: int) -> void:
	_refresh_collection(type_id)


func _on_hints_changed(_hints_left: int) -> void:
	_refresh_hint_button()


func _on_game_won() -> void:
	var complete_mark := "图鉴已收齐！" if GameState.collection_complete() else "图鉴未收齐"
	win_label.text = "过关！\n得分 %d · %s（%d/%d）" % [
		GameState.score, complete_mark, GameState.collected.size(), GameState.total_types,
	]
	win_layer.visible = true


func _on_hint_button_pressed() -> void:
	board.request_hint()


func _on_shuffle_button_pressed() -> void:
	board.request_shuffle()


func _on_restart_button_pressed() -> void:
	restart_game()


## ── UI 刷新 ────────────────────────────────────────────────

func _refresh_hud() -> void:
	hud_label.text = "剩余 %d/%d 对 · 分数 %d" % [
		GameState.remaining_pairs, GameState.total_pairs, GameState.score,
	]


func _refresh_collection(new_type_id: int) -> void:
	var names: Array[String] = []
	for type_id in CarTile.TYPE_NAMES.size():
		if GameState.collected.has(type_id):
			names.append(CarTile.TYPE_NAMES[type_id])
	var header := "图鉴 %d/%d" % [GameState.collected.size(), GameState.total_types]
	if GameState.total_types > 0 and GameState.collected.size() >= GameState.total_types:
		header += " · 已收齐！"
	if names.is_empty():
		collection_label.text = "%s（消除一对即点亮对应车种）" % header
	else:
		collection_label.text = "%s：%s" % [header, "、".join(names)]
	if new_type_id >= 0:
		_on_board_feedback("新收入图鉴：%s" % CarTile.TYPE_NAMES[new_type_id])


func _refresh_hint_button() -> void:
	hint_button.text = "提示 (%d)" % GameState.hints_left
