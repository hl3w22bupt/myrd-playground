extends Node2D
## 主场景控制器：装配棋盘视图、订阅信号刷新 HUD、处理撤销 / 重开 / 关卡选择。
##
## 规范要点（godot-game-dev SKILL.md）：
## - 场景内信号连接统一写在 _ready()，集中可见、可被 preflight 静态核对（P8/P12）；
## - 节点引用用 @onready + 类型标注，跨层级用 %唯一名；
## - 输入只判 InputMap 动作名（is_action_pressed），不碰 keycode；
## - 触摸 UI（摇杆 + 撤销/重开/换关按钮）只在内建触屏上显示，桌面键盘环境不可见。

const WIN_HINT: String = "通关！按 空格/回车 或 N 进入下一关"

@onready var player: Player = $Player
@onready var hud_label: Label = %HudLabel
@onready var touch_ui: CanvasLayer = $TouchUI
@onready var win_overlay: CanvasLayer = %WinOverlay
@onready var win_label: Label = %WinLabel

var _board_view: BoardView
var _move_hint: String = "WASD / 方向键移动 · Z 撤销 · R 重开 · N/P 换关"
## 通关弹层倒计时（<0 表示未在等待）；用 _process 计数而非协程，避免协程悬挂。
var _win_countdown: float = -1.0
var _win_steps: int = 0


func _ready() -> void:
	if DisplayServer.is_touchscreen_available():
		touch_ui.visible = true
		_move_hint = "摇杆移动 · 右下按钮撤销 / 重开 / 换关"
	_board_view = BoardView.new()
	_board_view.name = "BoardView"
	add_child(_board_view)
	move_child(_board_view, 0)  # 棋盘垫底，角色与 UI 在上层
	# 信号连接：订阅方（本场景）写连接代码，发布方（Player / GameState）只 emit。
	if not player.moved.is_connected(_on_player_moved):
		player.moved.connect(_on_player_moved)
	if not GameState.steps_changed.is_connected(_on_steps_changed):
		GameState.steps_changed.connect(_on_steps_changed)
	if not GameState.lit_changed.is_connected(_on_lit_changed):
		GameState.lit_changed.connect(_on_lit_changed)
	if not GameState.level_won.is_connected(_on_level_won):
		GameState.level_won.connect(_on_level_won)
	if not GameState.board_changed.is_connected(_on_board_changed):
		GameState.board_changed.connect(_on_board_changed)
	GameState.load_level(0)
	_update_hud()


func _process(delta: float) -> void:
	if _win_countdown < 0.0:
		return
	_win_countdown -= delta
	if _win_countdown <= 0.0:
		_win_countdown = -1.0
		win_label.text = "%s\n本关步数：%d" % [WIN_HINT, _win_steps]
		win_overlay.visible = true


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("undo"):
		_request_undo()
	elif event.is_action_pressed("restart"):
		GameState.restart()
	elif event.is_action_pressed("next_level"):
		GameState.next_level()
	elif event.is_action_pressed("prev_level"):
		GameState.prev_level()
	elif event.is_action_pressed("confirm") and GameState.won:
		GameState.next_level()


func _request_undo() -> void:
	if not GameState.undo():
		# 没有历史可撤销时给出可读反馈，而不是无声无息。
		hud_label.text = "%s · 没有可撤销的步了" % _move_hint


## 复位类变化：角色对齐格子 + 重建棋盘 + 关闭通关弹层（换关 / 重开 / 撤销共用）。
func _on_board_changed(reset: bool) -> void:
	_win_countdown = -1.0
	win_overlay.visible = false
	player.snap_to_board()
	if reset:
		_update_hud()


func _on_player_moved(_world_position: Vector2) -> void:
	_update_hud()


func _on_steps_changed(steps: int) -> void:
	_update_hud()


func _on_lit_changed(_lit_count: int, _total: int) -> void:
	_update_hud()


func _on_level_won(_level_index: int, steps: int) -> void:
	_win_steps = steps
	_win_countdown = GameState.WIN_OVERLAY_DELAY_MS / 1000.0


func _update_hud() -> void:
	var meta := GameState.level_meta()
	hud_label.text = "%s · %s · 步数 %d · 点亮 %d/%d" % [
		_move_hint,
		meta["name"],
		GameState.steps,
		GameState.board.lit_count(),
		GameState.board.target_count(),
	]

