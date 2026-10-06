extends Node2D
## 主场景控制器：菜单（难度选择）/ 对局 HUD / 结算 三界面装配与切换。
##
## 规范要点（见 SKILL.md「场景规范」「移动端触摸规范」「反馈完备性（Juice）」「调参工作台」）：
## - 场景内信号连接统一写在 _ready()，集中可见、可被 preflight 静态核对；
## - 节点引用用 @onready + 类型标注，路径用 %唯一名 代替长路径字符串；
## - 触摸 UI（摇杆/确认按钮）只在有触摸屏时显示，桌面键盘环境完全不可见；
## - 结果性事件的反馈挂在结果处理函数上（_on_match_made 等），不挂在输入处理上；
## - 调参面板只在网页 + ?tuning 参数时创建（TuningPanel.is_enabled()），桌面/无头零成本。

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
@onready var result_menu_button: Button = %MenuButton
@onready var menu_layer: CanvasLayer = $MenuLayer
@onready var easy_button: Button = %EasyButton
@onready var hard_button: Button = %HardButton
@onready var start_button: Button = %StartButton


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
	if not GameState.difficulty_changed.is_connected(_on_difficulty_changed):
		GameState.difficulty_changed.connect(_on_difficulty_changed)
	if not restart_button.pressed.is_connected(_on_restart_pressed):
		restart_button.pressed.connect(_on_restart_pressed)
	if not result_menu_button.pressed.is_connected(_on_result_menu_pressed):
		result_menu_button.pressed.connect(_on_result_menu_pressed)
	if not easy_button.pressed.is_connected(_on_easy_pressed):
		easy_button.pressed.connect(_on_easy_pressed)
	if not hard_button.pressed.is_connected(_on_hard_pressed):
		hard_button.pressed.connect(_on_hard_pressed)
	if not start_button.pressed.is_connected(_on_start_pressed):
		start_button.pressed.connect(_on_start_pressed)
	GameState.select_difficulty(GameState.difficulty)
	_on_state_changed(GameState.state)
	# 调参工作台（SKILL.md §3C）：网页 + URL 带 ?tuning 参数才创建，其余环境零成本。
	if TuningPanel.is_enabled():
		add_child(TuningPanel.new())


func _physics_process(delta: float) -> void:
	GameState.tick(delta)


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("confirm"):
		board.select_cell(board.cell_from_world(player.global_position))
	elif event.is_action_pressed("restart") and GameState.state != GameState.State.MENU:
		restart_game()


## 开始一局（菜单「开始游戏」唯一入口）：按当前选中难度开局并进入对局界面。
func start_game() -> void:
	GameState.start_game(GameState.difficulty)
	board.setup()
	_on_tiles_changed(board.remaining_count())
	status_label.text = "点选两张相同的汽车卡片"


## 重开入口：状态复位 + 棋盘重发（结算「再来一局」按钮与 R 键共用）；菜单态忽略。
func restart_game() -> void:
	if GameState.state == GameState.State.MENU:
		return
	GameState.reset()
	board.setup()
	_on_tiles_changed(board.remaining_count())
	status_label.text = "新的一局，继续！"


## 返回菜单（结算「返回菜单」按钮入口）：回到 MENU 态，菜单层重新覆盖。
func back_to_menu() -> void:
	GameState.to_menu()


func _on_player_moved(position: Vector2) -> void:
	board.notify_cursor(board.cell_from_world(position))


func _on_tiles_changed(remaining: int) -> void:
	tiles_label.text = "剩余卡片 %d 张" % remaining


func _on_match_made(_cell_a: Vector2i, _cell_b: Vector2i, points: int) -> void:
	status_label.text = "配对成功 +%d 分" % points
	# 结果性事件（消除得分）反馈：分数弹跳 + 音效（冒烟断言 Juice.events 非空）。
	Juice.pop(score_label)
	Juice.sfx(&"score")


func _on_selection_changed(cell: Vector2i) -> void:
	if cell == GameBoard.NO_SELECTION:
		return
	status_label.text = "已选中第 %d 列第 %d 行，再选一张相同的汽车卡片" % [cell.x + 1, cell.y + 1]
	Juice.sfx(&"confirm")


func _on_selection_rejected(_cell: Vector2i) -> void:
	status_label.text = "这两张无法连通（转折 ≤ 2 次），换一对试试"
	Juice.flash(status_label, Color(1.0, 0.5, 0.4, 0.85))
	Juice.sfx(&"hit")


func _on_board_shuffled() -> void:
	status_label.text = "无可消除对，已自动洗牌重排"
	Juice.flash(board)


func _on_score_changed(score: int) -> void:
	score_label.text = "得分 %d" % score


func _on_time_changed(time_left: float) -> void:
	time_label.text = "剩余时间 %d 秒" % int(ceilf(time_left))


func _on_difficulty_changed(difficulty: StringName) -> void:
	easy_button.set_pressed_no_signal(difficulty == &"easy")
	hard_button.set_pressed_no_signal(difficulty == &"hard")
	start_button.text = "开始（%s）" % GameState.DIFFICULTIES[difficulty]["label"]


func _on_state_changed(new_state: int) -> void:
	menu_layer.visible = new_state == GameState.State.MENU
	match new_state:
		GameState.State.MENU:
			result_panel.visible = false
		GameState.State.PLAYING:
			result_panel.visible = false
		GameState.State.WON:
			result_label.text = "通关！%s · 得分 %d" % [
				GameState.DIFFICULTIES[GameState.difficulty]["label"], GameState.score,
			]
			result_panel.visible = true
			Juice.pop(result_label)
			Juice.sfx(&"confirm")
		GameState.State.LOST:
			result_label.text = "时间到，未通关 · 得分 %d" % GameState.score
			result_panel.visible = true
			Juice.sfx(&"fail")


func _on_restart_pressed() -> void:
	restart_game()


func _on_result_menu_pressed() -> void:
	back_to_menu()


func _on_easy_pressed() -> void:
	GameState.select_difficulty(&"easy")


func _on_hard_pressed() -> void:
	GameState.select_difficulty(&"hard")


func _on_start_pressed() -> void:
	start_game()
