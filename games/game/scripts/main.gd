extends Node2D
## 主场景控制器：装配 UI、订阅 Player / Board / GameState 的信号、处理重开。
##
## 规范要点（见 SKILL.md「场景规范」）：
## - 场景内信号连接统一写在 _ready()，集中可见、可被 preflight 静态核对；
## - 节点引用用 @onready + 类型标注，唯一名用 % 前缀；
## - 信号方向单向：光标/棋盘只 emit，本场景订阅后改 UI、调 autoload。

## 胜负遮罩文案（HUD 动态文本统一英文，避免无 CJK 字体的环境下出现豆腐块）。
const TEXT_WIN: String = "LEVEL %d CLEAR!"
const TEXT_LOSE: String = "GAME OVER"
## 过关提示 / 洗牌提示。
const TEXT_WIN_HINT: String = "SPACE NEXT LEVEL - R RESTART"
const TEXT_LOSE_HINT: String = "PRESS R TO RESTART"
const TEXT_SHUFFLED: String = "No moves left - board reshuffled!"
const TEXT_ADVANCED: String = "Level %d - target %d in %d moves"

@onready var board: Board = $Board
@onready var cursor: Player = $Board/Player
@onready var score_label: Label = %ScoreLabel
@onready var moves_label: Label = %MovesLabel
@onready var level_label: Label = %LevelLabel
@onready var hud_message: Label = %HudMessage
@onready var overlay: ColorRect = %Overlay
@onready var overlay_title: Label = %OverlayTitle
@onready var overlay_score: Label = %OverlayScore
@onready var overlay_hint: Label = %OverlayHint


func _ready() -> void:
	# 信号连接：订阅方（本场景）写连接代码，发布方（cursor / GameState / Board）只 emit。
	if not cursor.swap_requested.is_connected(_on_cursor_swap_requested):
		cursor.swap_requested.connect(_on_cursor_swap_requested)
	if not board.shuffled.is_connected(_on_board_shuffled):
		board.shuffled.connect(_on_board_shuffled)
	if not GameState.score_changed.is_connected(_on_state_refresh):
		GameState.score_changed.connect(_on_state_refresh)
	if not GameState.moves_changed.is_connected(_on_state_refresh):
		GameState.moves_changed.connect(_on_state_refresh)
	if not GameState.level_changed.is_connected(_on_level_changed):
		GameState.level_changed.connect(_on_level_changed)
	if not GameState.game_ended.is_connected(_on_game_ended):
		GameState.game_ended.connect(_on_game_ended)
	if not GameState.game_restarted.is_connected(_on_game_restarted):
		GameState.game_restarted.connect(_on_game_restarted)
	GameState.start_game()
	cursor.setup(Board.COLS, Board.ROWS)
	board.new_game()
	overlay.visible = false
	hud_message.text = ""
	_refresh_hud()


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("restart"):
		_restart()
	elif event.is_action_pressed("confirm") and GameState.outcome == GameState.Outcome.WIN:
		# 过关后的唯一前进入口：confirm 进入下一关（对局中 confirm 归光标管，互不干扰）。
		_advance_level()


## 重开入口：复位 autoload 状态（回第 1 关）+ 重填棋盘 + 光标归位 + 关遮罩。
func _restart() -> void:
	GameState.restart()
	board.new_game()
	cursor.reset_position()
	hud_message.text = ""
	_refresh_hud()


## 过关入口：推进关卡状态 + 重填棋盘 + 光标归位 + 关遮罩 + 行内提示新目标。
func _advance_level() -> void:
	GameState.advance_level()
	board.new_game()
	cursor.reset_position()
	overlay.visible = false
	hud_message.text = TEXT_ADVANCED % [GameState.level, GameState.target_score, GameState.moves_left]
	_refresh_hud()


## 光标发起的交换：交 Board 裁决，无效交换给出行内提示 + 光标红闪（不耗步数）。
func _on_cursor_swap_requested(from_cell: Vector2i, to_cell: Vector2i) -> void:
	var swapped: bool = board.try_swap(from_cell, to_cell)
	if swapped:
		hud_message.text = ""
	else:
		cursor.flash_error()
		hud_message.text = "Invalid swap - needs a match of 3"


func _on_board_shuffled() -> void:
	hud_message.text = TEXT_SHUFFLED


func _on_state_refresh(_value: int) -> void:
	_refresh_hud()


func _on_level_changed(_level: int) -> void:
	_refresh_hud()


func _on_game_ended(outcome: String) -> void:
	var won: bool = outcome == "win"
	overlay_title.text = TEXT_WIN % GameState.level if won else TEXT_LOSE
	overlay_score.text = "SCORE %d" % GameState.score
	overlay_hint.text = TEXT_WIN_HINT if won else TEXT_LOSE_HINT
	overlay.visible = true
	_refresh_hud()


func _on_game_restarted() -> void:
	overlay.visible = false
	hud_message.text = ""
	_refresh_hud()


func _refresh_hud() -> void:
	level_label.text = "LEVEL %d" % GameState.level
	score_label.text = "%d / %d" % [GameState.score, GameState.target_score]
	moves_label.text = str(GameState.moves_left)
