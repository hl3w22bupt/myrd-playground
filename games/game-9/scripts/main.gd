extends Node2D
## 主场景控制器：装配 HUD，订阅 Player / GameBoard / GameState 的信号。
##
## 规范要点（见 SKILL.md「场景规范」「移动端触摸规范」）：
## - 场景内信号连接统一写在 _ready()，集中可见、可被 preflight 静态核对；
## - 节点引用用 @onready + 类型标注，路径用 %唯一名 代替长路径字符串；
## - 触摸 UI（摇杆/确认按钮）只在有触摸屏时显示，桌面键盘环境完全不可见。

@onready var player: Player = $Player
@onready var board: GameBoard = $Board
@onready var touch_ui: CanvasLayer = $TouchUI
@onready var time_label: Label = %TimeLabel
@onready var score_label: Label = %ScoreLabel
@onready var tiles_label: Label = %TilesLabel
@onready var status_label: Label = %StatusLabel
@onready var result_panel: ColorRect = %ResultPanel
@onready var result_label: Label = %ResultLabel
@onready var restart_button: Button = %RestartButton


func _ready() -> void:
	if DisplayServer.is_touchscreen_available():
		touch_ui.visible = true
	# 信号连接：订阅方（本场景）写连接代码，发布方（player / board / GameState）只 emit。
	if not player.moved.is_connected(_on_player_moved):
		player.moved.connect(_on_player_moved)
	if not board.tiles_changed.is_connected(_on_tiles_changed):
		board.tiles_changed.connect(_on_tiles_changed)
	if not board.match_made.is_connected(_on_match_made):
		board.match_made.connect(_on_match_made)
	if not board.selection_changed.is_connected(_on_selection_changed):
		board.selection_changed.connect(_on_selection_changed)
	if not board.selection_rejected.is_connected(_on_selection_rejected):
		board.selection_rejected.connect(_on_selection_rejected)
	if not board.board_shuffled.is_connected(_on_board_shuffled):
		board.board_shuffled.connect(_on_board_shuffled)
	if not GameState.score_changed.is_connected(_on_score_changed):
		GameState.score_changed.connect(_on_score_changed)
	if not GameState.time_changed.is_connected(_on_time_changed):
		GameState.time_changed.connect(_on_time_changed)
	if not GameState.state_changed.is_connected(_on_state_changed):
		GameState.state_changed.connect(_on_state_changed)
	if not restart_button.pressed.is_connected(_on_restart_pressed):
		restart_button.pressed.connect(_on_restart_pressed)
	GameState.reset()
	_on_tiles_changed(board.remaining_count())


func _physics_process(delta: float) -> void:
	GameState.tick(delta)


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("confirm"):
		board.select_cell(board.cell_from_world(player.global_position))
	elif event.is_action_pressed("restart"):
		restart_game()


## 重开入口：状态复位 + 棋盘重发（按钮与 R 键共用）。
func restart_game() -> void:
	GameState.reset()
	board.setup()
	_on_tiles_changed(board.remaining_count())
	status_label.text = "新的一局，继续！"


func _on_player_moved(position: Vector2) -> void:
	board.notify_cursor(board.cell_from_world(position))


func _on_tiles_changed(remaining: int) -> void:
	tiles_label.text = "剩余卡片 %d 张" % remaining


func _on_match_made(_cell_a: Vector2i, _cell_b: Vector2i, points: int) -> void:
	status_label.text = "配对成功 +%d 分" % points


func _on_selection_changed(cell: Vector2i) -> void:
	if cell == GameBoard.NO_SELECTION:
		status_label.text = "再选一张相同的汽车卡片"
	else:
		status_label.text = "已选中第 %d 列第 %d 行" % [cell.x + 1, cell.y + 1]


func _on_selection_rejected(_cell: Vector2i) -> void:
	status_label.text = "这两张无法连通（转折 ≤ 2 次），换一对试试"


func _on_board_shuffled() -> void:
	status_label.text = "无可消除对，已自动洗牌重排"


func _on_score_changed(score: int) -> void:
	score_label.text = "得分 %d" % score


func _on_time_changed(time_left: float) -> void:
	time_label.text = "剩余时间 %d 秒" % int(ceilf(time_left))


func _on_state_changed(new_state: int) -> void:
	match new_state:
		GameState.State.WON:
			result_label.text = "通关！得分 %d" % GameState.score
			result_panel.visible = true
		GameState.State.LOST:
			result_label.text = "时间到，未通关"
			result_panel.visible = true
		GameState.State.PLAYING:
			result_panel.visible = false


func _on_restart_pressed() -> void:
	restart_game()
