extends Node2D
## 主场景控制器：装配棋盘 / 光标 / HUD，订阅信号，编排「旋转 → 计步 → 判定」闭环。
##
## 规范要点（见 SKILL.md「场景规范」）：
## - 场景内信号连接统一写在 _ready()，集中可见、可被 preflight 静态核对；
## - 节点引用用 @onready + 类型标注，路径用 %唯一名 代替长路径字符串；
## - 触摸 UI（摇杆/动作按钮）只在有触摸屏时显示，桌面键盘环境完全不可见。

@onready var board: BoardView = $Board
@onready var hud_label: Label = %HudLabel
@onready var touch_ui: CanvasLayer = $TouchUI

var _status_line: String = ""


func _ready() -> void:
	if DisplayServer.is_touchscreen_available():
		touch_ui.visible = true
	# 信号连接：订阅方（本场景）写连接代码，发布方（board / GameState）只 emit。
	board.rotate_requested.connect(_on_board_rotate_requested)
	board.level_loaded.connect(_on_board_level_loaded)
	if not board.cursor.moved.is_connected(_on_cursor_moved):
		board.cursor.moved.connect(_on_cursor_moved)
	if not GameState.moves_changed.is_connected(_on_moves_changed):
		GameState.moves_changed.connect(_on_moves_changed)
	if not GameState.level_solved.is_connected(_on_level_solved):
		GameState.level_solved.connect(_on_level_solved)
	if not GameState.level_changed.is_connected(_on_level_changed):
		GameState.level_changed.connect(_on_level_changed)
	# 装载第一关：level_changed 触发 board.load_level。
	GameState.start_level(0)


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("confirm"):
		_handle_confirm()
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("reset"):
		GameState.reset_level()
		get_viewport().set_input_as_handled()


## confirm 语义：未通关 = 旋转光标所在格；已通关 = 进入下一关（循环）。
func _handle_confirm() -> void:
	if GameState.solved:
		GameState.start_level((GameState.level_index + 1) % LevelSet.count())
		return
	board.request_rotate(board.cursor.grid_pos)


## 旋转编排：通关后忽略；管子真的转了才计步与判定（点击空格不计步）。
func _on_board_rotate_requested(cell: Vector2i) -> void:
	if GameState.solved:
		return
	if board.rotate_at(cell):
		GameState.register_rotation(board.current_cells(), board.level)
	_update_hud()


func _on_board_level_loaded(level: Dictionary) -> void:
	_status_line = ""
	_update_hud()


func _on_cursor_moved(_grid_pos: Vector2i) -> void:
	_update_hud()


func _on_moves_changed(_moves: int) -> void:
	_update_hud()


func _on_level_changed(_level_index: int) -> void:
	board.load_level(LevelSet.level_at(GameState.level_index))


func _on_level_solved(stars: int, moves: int, par: int) -> void:
	_status_line = "通关！星级 %s（步数 %d / 最优 %d）· 按 确认 进下一关，R 重开" % [
		_star_text(stars), moves, par,
	]
	_update_hud()


func _star_text(stars: int) -> String:
	var text: String = ""
	for i: int in range(3):
		text += "★" if i < stars else "☆"
	return text


func _update_hud() -> void:
	if board.level.is_empty():
		return
	var par: int = LevelSet.par_of(board.level)
	var best: int = GameState.best_stars.get(GameState.level_index, 0)
	var best_text: String = _star_text(best) if best > 0 else "未通关"
	hud_label.text = "第 %d 关 · %s\n旋转 %d / 最优 %d · 最高 %s · 光标所在格点击或按 确认 旋转，R 重开\n%s" % [
		GameState.level_index + 1, board.level["name"], GameState.moves, par, best_text, _status_line,
	]
