extends Node2D
## 主场景控制器：装配 UI（含触摸按钮）、订阅 Player / Board / GameState 的信号、
## 处理开始 / 重开 / 过关 / 静音与音效接线。
##
## 规范要点（见 SKILL.md「场景规范」）：
## - 场景内信号连接统一写在 _ready()，集中可见、可被 preflight 静态核对；
## - 节点引用用 @onready + 类型标注，唯一名用 % 前缀；
## - 信号方向单向：光标/棋盘只 emit，本场景订阅后改 UI、调 autoload（含 GameAudio 播音）。

## 胜负遮罩文案（HUD 动态文本统一英文，避免无 CJK 字体的环境下出现豆腐块）。
const TEXT_WIN: String = "LEVEL %d CLEAR!"
const TEXT_LOSE: String = "GAME OVER"
## 遮罩提示与动作按钮文案（触摸可点按 + 键盘 confirm 双通道）。
const TEXT_WIN_HINT: String = "TAP NEXT OR PRESS SPACE"
const TEXT_LOSE_HINT: String = "TAP RETRY OR PRESS R"
const TEXT_SHUFFLED: String = "No moves left - board reshuffled!"
const TEXT_ADVANCED: String = "Level %d - target %d in %d moves"
## 无效交换提示（加大字号 + 停留数秒，见 INVALID_MSG_* 常量）。
const TEXT_INVALID_SWAP: String = "Invalid swap - needs a match of 3"
## 触屏 / 桌面两套操作提示（按输入设备切换，见 _update_hints）。
const HINT_TOUCH: String = "点按选中糖果 · 再点相邻糖果交换
或按住糖果滑动 · 三连即可收集"
const HINT_DESKTOP: String = "WASD/方向键移动 · 空格选中交换
也可用鼠标点按或滑动 · 三连即可收集"
## 静音按钮与遮罩动作按钮文案（ASCII + 常用汉字，子集字体全覆盖）。
const BTN_MUTE_ON: String = "音效 ON"
const BTN_MUTE_OFF: String = "音效 OFF"
const BTN_NEXT: String = "下一关 NEXT"
const BTN_RETRY: String = "再来一局 RETRY"
## 响应式布局：HUD 底边（设计像素）与底部按钮区高度；棋盘在两者间居中（_layout）。
const HUD_ZONE_BOTTOM: float = 260.0
const CONTROL_ZONE_TOP: float = 140.0
## 无效交换反馈：HUD 行内提示字号加大（基准 18 → 30，触摸屏上一眼可见），
## 停留 2.5 秒后自动清除；与糖果抖动动画（Board.play_invalid_swap_fx）同帧触发。
const HUD_MSG_FONT_SIZE: int = 18
const INVALID_MSG_FONT_SIZE: int = 30
const INVALID_MSG_HOLD_SEC: float = 2.5

@onready var board: Board = $Board
@onready var cursor: Player = $Board/Player
@onready var score_label: Label = %ScoreLabel
@onready var moves_label: Label = %MovesLabel
@onready var level_label: Label = %LevelLabel
@onready var hud_message: Label = %HudMessage
@onready var how_to_label: Label = %HowToLabel
@onready var overlay: ColorRect = %Overlay
@onready var overlay_title: Label = %OverlayTitle
@onready var overlay_score: Label = %OverlayScore
@onready var overlay_hint: Label = %OverlayHint
@onready var overlay_action_button: Button = %OverlayActionButton
@onready var start_overlay: ColorRect = %StartOverlay
@onready var start_button: Button = %StartButton
@onready var restart_button: Button = %RestartButton
@onready var mute_button: Button = %MuteButton

## 无效交换提示的显示令牌：停留期内出现任何新消息即 +1，
## 到期的放大定时器只在令牌未变时回写（旧定时器永远抢不过新消息）。
var _invalid_msg_seq: int = 0


func _ready() -> void:
	# 信号连接：订阅方（本场景）写连接代码，发布方（cursor / GameState / Board）只 emit。
	if not cursor.swap_requested.is_connected(_on_cursor_swap_requested):
		cursor.swap_requested.connect(_on_cursor_swap_requested)
	if not cursor.selection_changed.is_connected(_on_cursor_selection_changed):
		cursor.selection_changed.connect(_on_cursor_selection_changed)
	if not board.shuffled.is_connected(_on_board_shuffled):
		board.shuffled.connect(_on_board_shuffled)
	if not board.candies_collected.is_connected(_on_board_candies_collected):
		board.candies_collected.connect(_on_board_candies_collected)
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
	if not GameAudio.mute_changed.is_connected(_on_mute_changed):
		GameAudio.mute_changed.connect(_on_mute_changed)
	# 可点按控件（触摸热区 ≥ 96 设计像素 ≈ 52pt；桌面同样可用鼠标点按）。
	if not start_button.pressed.is_connected(_on_start_pressed):
		start_button.pressed.connect(_on_start_pressed)
	if not restart_button.pressed.is_connected(_on_restart_pressed):
		restart_button.pressed.connect(_on_restart_pressed)
	if not mute_button.pressed.is_connected(_on_mute_pressed):
		mute_button.pressed.connect(_on_mute_pressed)
	if not overlay_action_button.pressed.is_connected(_on_overlay_action_pressed):
		overlay_action_button.pressed.connect(_on_overlay_action_pressed)
	# 视口拉伸（aspect=expand）时棋盘居中重排；锚定控件随锚点自适应无需处理。
	if not get_viewport().size_changed.is_connected(_layout):
		get_viewport().size_changed.connect(_layout)
	# 状态装配。注意：不在此处 GameState.start_game() —— 对局由「开始游戏」按钮启动，
	# 该次点按同时充当 Web 导出音频解锁的首个用户手势（见 audio_manager.gd 文件头）。
	cursor.setup(Board.COLS, Board.ROWS)
	board.new_game()
	overlay.visible = false
	start_overlay.visible = true
	_set_hud_message("")
	mute_button.text = BTN_MUTE_OFF if GameAudio.muted else BTN_MUTE_ON
	_update_hints()
	_layout()
	_refresh_hud()


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("restart"):
		_restart()
	elif event.is_action_pressed("confirm") and GameState.outcome == GameState.Outcome.WIN:
		# 过关后的唯一前进入口：confirm 进入下一关（对局中 confirm 归光标管，互不干扰）。
		_advance_level()
	elif event.is_action_pressed("confirm") and not GameState.started:
		# 键盘环境的「开始」入口；触摸环境走开始按钮（start_button.pressed）。
		_start_game()


## 竖屏 / 任意宽高比适配：棋盘在「HUD 底边」与「底部按钮区顶边」之间的区带内居中。
## aspect=expand 时视口四向外扩，Control 随锚点自适应；只有棋盘（Node2D）需要重排。
func _layout() -> void:
	var view := get_viewport_rect()
	var board_size := Vector2(Board.COLS, Board.ROWS) * Board.CELL
	var zone_top := minf(HUD_ZONE_BOTTOM, view.size.y * 0.22)
	var zone_bottom := view.size.y - CONTROL_ZONE_TOP
	var center_y := (zone_top + zone_bottom) * 0.5
	board.position = Vector2((view.size.x - board_size.x) * 0.5, center_y - board_size.y * 0.5)


## 按输入设备切换操作提示：触屏设备展示手势提示，桌面提示键盘与鼠标皆可。
func _update_hints() -> void:
	how_to_label.text = HINT_TOUCH if DisplayServer.is_touchscreen_available() else HINT_DESKTOP


## 开始入口（开始按钮 / 键盘 confirm）：关开始遮罩并开新局。
func _start_game() -> void:
	GameAudio.play(&"click")
	start_overlay.visible = false
	GameState.start_game()
	board.new_game()
	cursor.reset_position()
	_set_hud_message("")
	_refresh_hud()


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
	_set_hud_message(TEXT_ADVANCED % [GameState.level, GameState.target_score, GameState.moves_left])
	_refresh_hud()


## ---- 可点按控件回调 ----

func _on_start_pressed() -> void:
	_start_game()


func _on_restart_pressed() -> void:
	GameAudio.play(&"click")
	_restart()


func _on_mute_pressed() -> void:
	# 先切换再播音：取消静音后本次点按立即出声；静音态 play 内部短路，无声即反馈。
	GameAudio.toggle_muted()
	GameAudio.play(&"click")


func _on_overlay_action_pressed() -> void:
	GameAudio.play(&"click")
	if GameState.outcome == GameState.Outcome.WIN:
		_advance_level()
	else:
		_restart()


func _on_mute_changed(muted: bool) -> void:
	mute_button.text = BTN_MUTE_OFF if muted else BTN_MUTE_ON


## ---- 游戏信号 → UI / 音效 ----

## 光标发起的交换：交 Board 裁决；有效播音效，无效给「红闪 + 糖果抖动回弹 +
## 加大字号行内提示（停留 2.5 秒）」三重反馈（不耗步数，输入状态机不动）。
func _on_cursor_swap_requested(from_cell: Vector2i, to_cell: Vector2i) -> void:
	var swapped: bool = board.try_swap(from_cell, to_cell)
	if swapped:
		GameAudio.play(&"swap")
		_set_hud_message("")
	else:
		GameAudio.play(&"invalid")
		cursor.flash_error()
		board.play_invalid_swap_fx(from_cell, to_cell)
		_flash_invalid_swap_message()


## 点按选中反馈音。
func _on_cursor_selection_changed(_selected_cell: Vector2i) -> void:
	GameAudio.play(&"select")


## 消除音：第 1 波 = 单次消除音；第 2 波起走连锁音并逐波升调（play_combo 内部处理）。
func _on_board_candies_collected(_count: int) -> void:
	GameAudio.play_combo(board.last_wave_count)


func _on_board_shuffled() -> void:
	_set_hud_message(TEXT_SHUFFLED)


func _on_state_refresh(_value: int) -> void:
	_refresh_hud()


func _on_level_changed(_level: int) -> void:
	_refresh_hud()


func _on_game_ended(outcome: String) -> void:
	var won: bool = outcome == "win"
	if won:
		GameAudio.play(&"win")
	else:
		GameAudio.play(&"lose")
	overlay_title.text = TEXT_WIN % GameState.level if won else TEXT_LOSE
	overlay_score.text = "SCORE %d" % GameState.score
	overlay_hint.text = TEXT_WIN_HINT if won else TEXT_LOSE_HINT
	overlay_action_button.text = BTN_NEXT if won else BTN_RETRY
	overlay.visible = true
	_refresh_hud()


func _on_game_restarted() -> void:
	overlay.visible = false
	_set_hud_message("")
	_refresh_hud()


## ---- HUD 行内消息（统一出口 + 无效交换放大提示）----

## 普通行内消息统一走这里：字号回到基准，并让任何未到期的无效交换放大定时器失效
##（新消息立即接管显示权，旧定时器不许再回写旧文案）。
func _set_hud_message(text: String) -> void:
	_invalid_msg_seq += 1
	hud_message.add_theme_font_size_override("font_size", HUD_MSG_FONT_SIZE)
	hud_message.text = text


## 无效交换提示：加大字号 + 停留 INVALID_MSG_HOLD_SEC 后自动清除。
## seq 守卫：停留期内出现的新消息（有效交换清屏 / 洗牌 / 过关）会推进令牌，
## 到期回写只在令牌未变时执行 —— 提示既「留得住」也「让得路」。
func _flash_invalid_swap_message() -> void:
	_invalid_msg_seq += 1
	var seq: int = _invalid_msg_seq
	hud_message.add_theme_font_size_override("font_size", INVALID_MSG_FONT_SIZE)
	hud_message.text = TEXT_INVALID_SWAP
	get_tree().create_timer(INVALID_MSG_HOLD_SEC).timeout.connect(func() -> void:
		if seq == _invalid_msg_seq and is_inside_tree():
			_set_hud_message("")
	)


func _refresh_hud() -> void:
	level_label.text = "LEVEL %d" % GameState.level
	score_label.text = "%d / %d" % [GameState.score, GameState.target_score]
	moves_label.text = str(GameState.moves_left)
