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

## ---- 结算三态（M1 打回项「阻塞#1」占位接线；美术 UI 稿落地前全部为占位文案/布局）----
## 三态口径（主策划 9/21 定义）：WIN 达标过关 / LOSE 步尽判负 / RESUME 局中离开后续玩。
## 占位实现 = 复用现有遮罩控件与文案常量，不新增美术资源；「占位」标注见打回清单 v2。
const TEXT_RESUME_TITLE: String = "RESUME LEVEL %d"
const TEXT_RESUME_HINT: String = "TAP CONTINUE OR NEW"
const TEXT_START_TITLE: String = "糖果粉碎传奇"
const TEXT_START_SUBTITLE: String = "CANDY CRUSH LEGEND · 触摸版"
const BTN_CONTINUE: String = "继续游戏 CONTINUE"
const BTN_NEW_GAME: String = "新的一局 NEW GAME"
const BTN_START_DEFAULT: String = "开始游戏 START"

## ---- 消除 / 连击反馈默认参数（M1 打回项「阻塞#2」接线；调参区，美术只改数值）----
## 口径：消除必有屏震 + 粒子（粒子在 board.gd FX 区）；第 2 波起算连击，连击有升调音 +
## HUD 连击提示 + 屏震逐波增强。结构固定，数值改动不触碰任何接线代码。
const SHAKE_AMP_BASE_PX: float = 3.0          ## 第 1 波消除的屏震幅度（设计像素）
const SHAKE_AMP_PER_WAVE_PX: float = 2.0      ## 每深一波连击追加幅度（线性叠加）
const SHAKE_AMP_MAX_PX: float = 10.0          ## 屏震幅度上限（防高连锁时失控）
const SHAKE_DECAY_SEC: float = 0.28           ## 屏震从当前幅度衰减到 0 的时长
const SHAKE_FREQ_HZ: float = 34.0             ## 屏震抖动频率（每秒相位周期数）
const COMBO_MSG_MIN_WAVE: int = 2             ## 从第几波起显示连击提示（第 1 波只有常规消除反馈）
const COMBO_MSG_FONT_SIZE: int = 30           ## 连击提示字号（与无效交换提示同级，一眼可见）
const COMBO_MSG_HOLD_SEC: float = 1.2         ## 连击提示停留时长（比无效提示短，让路给下一条消息）
const COMBO_MSG_TEXT: String = "COMBO x%d"

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
@onready var start_title: Label = %StartTitle
@onready var start_subtitle: Label = %StartSubtitle
@onready var start_button: Button = %StartButton
@onready var new_game_button: Button = %NewGameButton
@onready var restart_button: Button = %RestartButton
@onready var mute_button: Button = %MuteButton

## 无效交换提示的显示令牌：停留期内出现任何新消息即 +1，
## 到期的放大定时器只在令牌未变时回写（旧定时器永远抢不过新消息）。
var _invalid_msg_seq: int = 0
## 启动时探到的「可续局」快照（结算三态之 RESUME 的数据源；空 = 无局可续）。
## 只窥视不取走：真正的取走发生在「继续 / 新开」二选一的回调里（SaveState 侧清档）。
var _resume_offer: Dictionary = {}
## 屏震当前幅度（px）与触发时的初始幅度（线性衰减基准）；0 = 静止。
var _shake_amp: float = 0.0
var _shake_amp0: float = 0.0
## 屏震相位（按 SHAKE_FREQ_HZ 推进，x/y 用不同倍频制造无序感）。
var _shake_phase: float = 0.0
## 棋盘布局基准位（_layout 写入；屏震只在它上面加偏移，衰减完精确归位）。
var _board_base: Vector2 = Vector2.ZERO


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
	if not new_game_button.pressed.is_connected(_on_new_game_pressed):
		new_game_button.pressed.connect(_on_new_game_pressed)
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
	setup_resume_offer()
	_layout()
	_refresh_hud()


func _process(delta: float) -> void:
	# 屏震推进：幅度线性衰减到 0 后精确复位到布局基准位（不留永久偏移，帧率与布局稳定）。
	if _shake_amp <= 0.0:
		return
	_shake_phase += SHAKE_FREQ_HZ * TAU * delta
	_shake_amp = maxf(_shake_amp - (_shake_amp0 / SHAKE_DECAY_SEC) * delta, 0.0)
	if _shake_amp <= 0.01:
		_shake_amp = 0.0
		board.position = _board_base
	else:
		board.position = _board_base + Vector2(
			sin(_shake_phase) * _shake_amp,
			cos(_shake_phase * 1.31) * _shake_amp * 0.6
		)


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
	_board_base = Vector2((view.size.x - board_size.x) * 0.5, center_y - board_size.y * 0.5)
	board.position = _board_base


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


## 消除反馈总入口：与结算同 tick（信号同步派发）——
## 音效（第 1 波消除音 / 第 2 波起连锁升调）+ 屏震（幅度逐波增强、上限封顶）
## + 连击提示（第 COMBO_MSG_MIN_WAVE 波起）。数值全部在本文件 VFX 默认参数区。
func _on_board_candies_collected(_count: int) -> void:
	GameAudio.play_combo(board.last_wave_count)
	_trigger_elimination_shake(board.last_wave_count)
	if board.last_wave_count >= COMBO_MSG_MIN_WAVE:
		_flash_combo_message(board.last_wave_count)


## 屏震触发：幅度 = 基础 + 每波增量 ×（波数-1），封顶 SHAKE_AMP_MAX_PX；
## 只改状态量，位移由 _process 推进（同一帧内多次触发取更响的那次）。
func _trigger_elimination_shake(wave_count: int) -> void:
	var amp: float = SHAKE_AMP_BASE_PX + SHAKE_AMP_PER_WAVE_PX * float(wave_count - 1)
	amp = minf(amp, SHAKE_AMP_MAX_PX)
	if amp <= _shake_amp:
		return
	_shake_amp = amp
	_shake_amp0 = amp
	_shake_phase = 0.0


## 连击提示：加大字号行内消息，停留 COMBO_MSG_HOLD_SEC 后自动清除
##（与无效交换提示共用令牌守卫，新消息永远能接管显示权）。
func _flash_combo_message(wave_count: int) -> void:
	_invalid_msg_seq += 1
	var seq: int = _invalid_msg_seq
	hud_message.add_theme_font_size_override("font_size", COMBO_MSG_FONT_SIZE)
	hud_message.text = COMBO_MSG_TEXT % wave_count
	get_tree().create_timer(COMBO_MSG_HOLD_SEC).timeout.connect(func() -> void:
		if seq == _invalid_msg_seq and is_inside_tree():
			_set_hud_message("")
	)


## ---- 结算三态之 RESUME（局中离开后续玩；占位 UI，美术稿落地前仅文案级占位）----

## 启动时探测存档：有可续局 → 开始遮罩转「继续 / 新开」双入口（占位文案），否则维持新局单入口。
## 公开给测试侧：冒烟擦档后重跑本探测，保证「开始」永远从全新开局起步（无跨进程残留）。
func setup_resume_offer() -> void:
	_resume_offer = SaveState.run_snapshot.duplicate(true)
	if _resume_offer.is_empty():
		new_game_button.visible = false
		start_button.text = BTN_START_DEFAULT
		start_title.text = TEXT_START_TITLE
		start_subtitle.text = TEXT_START_SUBTITLE
		return
	start_button.text = BTN_CONTINUE
	new_game_button.visible = true
	start_title.text = TEXT_RESUME_TITLE % int(_resume_offer.get("level", 1))
	start_subtitle.text = "SCORE %d · %s" % [int(_resume_offer.get("score", 0)), TEXT_RESUME_HINT]


## 「继续游戏」：把存档快照装回 GameState（数值进度全恢复；盘面重铺为 M1 占位语义）。
func _on_start_pressed() -> void:
	if _resume_offer.is_empty():
		_start_game()
		return
	GameAudio.play(&"click")
	start_overlay.visible = false
	GameState.resume_from_snapshot(_resume_offer)
	_resume_offer = {}
	board.new_game()
	cursor.reset_position()
	_set_hud_message("")
	_refresh_hud()


## 「新的一局」：显式放弃续玩，走全新开局（SaveState 快照在 start_game 内清档）。
func _on_new_game_pressed() -> void:
	GameAudio.play(&"click")
	_resume_offer = {}
	_start_game()


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
