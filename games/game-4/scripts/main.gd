extends Node2D
## 主场景控制器：装配棋盘 / 光标 / HUD，订阅信号，编排「旋转/撤销 → 计步 → 判定 → 解锁」闭环。
##
## 规范要点（见 SKILL.md「场景规范」）：
## - 场景内信号连接统一写在 _ready()，集中可见、可被 preflight 静态核对；
## - 节点引用用 @onready + 类型标注，路径用 %唯一名 代替长路径字符串；
## - UI（HUD / 关卡条 / 状态反馈）挂在独立 CanvasLayer，触摸 UI 再单独一层（layer 更高）；
## - 触摸 UI（摇杆/动作按钮）只在有触摸屏时显示，桌面键盘环境完全不可见。

@onready var board: BoardView = $Board
@onready var hud_label: Label = %HudLabel
@onready var status_label: Label = %StatusLabel
@onready var level_bar: Label = %LevelBar
@onready var touch_ui: CanvasLayer = $TouchUI

## 状态行（通关结算 / 光路中断提示 / 撤销反馈），随棋盘状态实时刷新。
var _status_line: String = ""


func _ready() -> void:
	if DisplayServer.is_touchscreen_available():
		touch_ui.visible = true
	# 调参工作台（SKILL.md §3C）：仅网页 + URL 带 ?tuning= 时浮出（?tuning=1 / ?tuning=<JSON> 都算）；
	# 桌面与无头门禁环境 is_enabled() 恒 false，零成本。
	if TuningPanel.is_enabled():
		add_child(TuningPanel.new())
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
	if not GameState.level_unlocked.is_connected(_on_level_unlocked):
		GameState.level_unlocked.connect(_on_level_unlocked)
	# 装载第一关：level_changed 触发 board.load_level。
	GameState.start_level(0)


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("confirm"):
		_handle_confirm()
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("undo"):
		_handle_undo()
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("reset"):
		GameState.reset_level()
		Juice.flash(board)
		Juice.sfx(&"hit")
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("level_next"):
		_request_level(GameState.level_index + 1)
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("level_prev"):
		_request_level(GameState.level_index - 1)
		get_viewport().set_input_as_handled()


## confirm 语义：未通关 = 旋转光标所在格；已通关 = 进入下一关（锁着的进不去）。
func _handle_confirm() -> void:
	if GameState.solved:
		if GameState.is_last_level():
			_status_line = "全部 %d 关通关！按 Q/E 选关重玩刷星，R 重开本关" % LevelSet.count()
			_update_hud()
			return
		if not GameState.advance_level():
			_status_line = "下一关尚未解锁（需先通关当前关）"
			_update_hud()
		return
	board.request_rotate(board.cursor.grid_pos)


## undo 语义：撤销最近一次旋转（棋盘朝向与步数同时回退）；通关后撤销无意义，屏蔽。
func _handle_undo() -> void:
	if GameState.solved:
		return
	if board.undo():
		GameState.register_undo()
		Juice.sfx(&"hit")
		_status_line = "已撤销一步（剩余可撤 %d 步）" % _undo_depth()
	else:
		Juice.sfx(&"fail")
		_status_line = "没有可撤销的旋转"
	_update_hud()


## 关卡导航：锁着的关卡拒绝进入，并给明确反馈。
func _request_level(index: int) -> void:
	if index < 0 or index >= LevelSet.count():
		_status_line = "没有这一关（共 %d 关）" % LevelSet.count()
	elif not GameState.request_level(index):
		Juice.sfx(&"fail")
		Juice.flash(level_bar, Color(1.0, 0.55, 0.45, 0.6))
		_status_line = "第 %d 关未解锁：先通关第 %d 关" % [index + 1, GameState.unlocked_max + 1]
	else:
		return
	_update_hud()


## 旋转编排：通关后忽略；管子真的转了才计步与判定（点击空格不计步）。
func _on_board_rotate_requested(cell: Vector2i) -> void:
	if GameState.solved:
		return
	if board.rotate_at(cell):
		GameState.register_rotation(board.current_cells(), board.level)
		Juice.sfx(&"confirm")
		_update_status_from_beam()
	_update_hud()


func _on_board_level_loaded(_level: Dictionary) -> void:
	_status_line = ""
	_update_hud()


func _on_cursor_moved(_grid_pos: Vector2i) -> void:
	_update_hud()


func _on_moves_changed(_moves: int) -> void:
	_update_hud()


func _on_level_changed(_level_index: int) -> void:
	board.load_level(LevelSet.level_at(GameState.level_index))


func _on_level_unlocked(unlocked_index: int) -> void:
	Juice.pop(level_bar)
	Juice.sfx(&"confirm")
	_status_line = "第 %d 关已解锁！" % (unlocked_index + 1)


## 通关结算：星级/步数反馈 + 棋盘闪光（结果性事件必须挂反馈，SKILL.md §3B）。
func _on_level_solved(stars: int, moves: int, par: int) -> void:
	_status_line = "通关！%s（步数 %d / 最优 %d）· 按 确认 进下一关，R 重开刷星" % [
		_star_text(stars), moves, par,
	]
	if GameState.is_last_level():
		_status_line += " —— 这是最后一关！"
	Juice.pop(status_label)
	Juice.flash(board, Color(1.4, 1.3, 0.9, 1.0), 0.3)
	Juice.shake(2.5)
	Juice.sfx(&"score")
	_update_hud()


## 实时提示：光路没接通时说明断在哪（撞墙 / 断口），失败反馈明确。
func _update_status_from_beam() -> void:
	if board.beam.get("solved", false):
		return  # 通关反馈由 _on_level_solved 负责，这里不抢
	if board.beam.get("hits_wall", false):
		_status_line = "光路被墙挡断：调整管口绕开墙体"
	else:
		_status_line = "光路未接通：有管口对不上或断在半路"


func _undo_depth() -> int:
	return board.history_size()


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
	var best_moves: int = GameState.best_moves.get(GameState.level_index, 0)
	var best_moves_text: String = str(best_moves) if best_moves > 0 else "—"
	hud_label.text = "第 %d/%d 关 · %s\n旋转 %d / 最优 %d · 最高 %s（最少 %s 步）" % [
		GameState.level_index + 1, LevelSet.count(), board.level["name"],
		GameState.moves, par, best_text, best_moves_text,
	]
	status_label.text = _status_line
	level_bar.text = _level_bar_text()


## 关卡条：逐关标注 最高星级 / 待通 / 未解锁，当前关用方括号标出。
func _level_bar_text() -> String:
	var chips: PackedStringArray = []
	for index: int in range(LevelSet.count()):
		var chip: String = ""
		if index > GameState.unlocked_max:
			chip = "×"
		elif GameState.best_stars.get(index, 0) > 0:
			chip = "%d★" % GameState.best_stars[index]
		else:
			chip = "□"
		chips.append("[%d%s]" % [index + 1, chip] if index == GameState.level_index else "%d%s" % [index + 1, chip])
	return "关卡（Q/E 切换）：" + " ".join(chips)
