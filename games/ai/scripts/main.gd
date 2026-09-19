extends Node2D
## 主场景控制器：装配小李、AI 女友、HUD、剧情对话与胜负遮罩。
##
## 规范要点（见 SKILL.md「场景规范」「移动端触摸规范」）：
## - 场景内信号连接统一写在 _ready()，集中可见、可被 preflight 静态核对；
## - 节点引用用 @onready + 类型标注，路径用 %唯一名 代替长路径字符串；
## - 触摸 UI（摇杆/确认按钮）只在有触摸屏时显示，桌面键盘环境完全不可见；
## - 剧情对话状态归本场景，数值归 GameState —— 双向只走信号/方法，不互相持节点。

## 文案常量（冒烟按这里断言，改文案必须同步冒烟）。
const TEXT_WIN_TITLE: String = "告白成功 WIN"
const TEXT_LOSE_TITLE: String = "心动超时 GAME OVER"
const TEXT_RETRY_BUTTON: String = "再来一局 RETRY"
const TEXT_RESTART_BUTTON: String = "重开 R"
const TEXT_DIALOGUE_FORMAT: String = "%s：%s"
## 对话自动关闭时长（秒）；按 confirm 可提前回应并关闭。
const DIALOGUE_DURATION: float = 3.0

@onready var player: Player = $Player
@onready var touch_ui: CanvasLayer = $TouchUI
@onready var chapter_label: Label = %ChapterLabel
@onready var affection_label: Label = %AffectionLabel
@onready var time_label: Label = %TimeLabel
@onready var dialogue_box: PanelContainer = %DialogueBox
@onready var dialogue_label: Label = %DialogueLabel
@onready var hint_label: Label = %HintLabel
@onready var overlay: ColorRect = %Overlay
@onready var overlay_title: Label = %OverlayTitle
@onready var overlay_score: Label = %OverlayScore
@onready var overlay_action_button: Button = %OverlayActionButton
@onready var restart_button: Button = %RestartButton

var _move_hint: String = "WASD / 方向键移动 · 空格回应心动 · R 重开"
## 对话序号令牌：新对话/关闭都会自增，旧定时器醒来时对不上号就不再动 UI。
var _dialogue_seq: int = 0
var _player_start: Vector2 = Vector2.ZERO
var _girlfriends: Array[AIGirlfriend] = []


func _ready() -> void:
	if DisplayServer.is_touchscreen_available():
		touch_ui.visible = true
		_move_hint = "摇杆移动 · 右下按钮回应心动"
	_player_start = player.global_position
	for node: Node in $Girlfriends.get_children():
		var girlfriend := node as AIGirlfriend
		if girlfriend == null:
			continue
		_girlfriends.append(girlfriend)
		if not girlfriend.encountered.is_connected(_on_girlfriend_encountered):
			girlfriend.encountered.connect(_on_girlfriend_encountered)
	# 信号连接：订阅方（本场景）写连接代码，发布方（player / GameState / 按钮）只 emit。
	if not GameState.affection_changed.is_connected(_on_affection_changed):
		GameState.affection_changed.connect(_on_affection_changed)
	if not GameState.time_changed.is_connected(_on_time_changed):
		GameState.time_changed.connect(_on_time_changed)
	if not GameState.chapter_changed.is_connected(_on_chapter_changed):
		GameState.chapter_changed.connect(_on_chapter_changed)
	if not GameState.game_ended.is_connected(_on_game_ended):
		GameState.game_ended.connect(_on_game_ended)
	if not GameState.game_restarted.is_connected(_on_game_restarted):
		GameState.game_restarted.connect(_on_game_restarted)
	if not restart_button.pressed.is_connected(_on_restart_pressed):
		restart_button.pressed.connect(_on_restart_pressed)
	if not overlay_action_button.pressed.is_connected(_on_restart_pressed):
		overlay_action_button.pressed.connect(_on_restart_pressed)
	restart_button.text = TEXT_RESTART_BUTTON
	overlay_action_button.text = TEXT_RETRY_BUTTON
	hint_label.text = _move_hint
	_refresh_hud()


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("restart"):
		_restart_game()
	elif event.is_action_pressed("confirm"):
		_respond_to_dialogue()


## 刷新章节 / 好感 / 时间三处 HUD（状态唯一来源是 GameState）。
func _refresh_hud() -> void:
	chapter_label.text = GameState.title_for_chapter(GameState.chapter)
	affection_label.text = "好感 %d/%d" % [
		GameState.affection, GameState.target_for_chapter(GameState.chapter),
	]
	time_label.text = "心动时间 %d" % int(ceilf(GameState.time_left))


## 核心交互·收集：走进 AI 女友的光圈 → 展示她的剧情台词 + 计 1 点好感。
func _on_girlfriend_encountered(girlfriend: AIGirlfriend) -> void:
	_show_dialogue(TEXT_DIALOGUE_FORMAT % [girlfriend.display_name, girlfriend.story_line])
	GameState.add_affection(1)


## 核心交互·回应：对话在场时按 confirm 提前回应（心动加成），关闭对话。
func _respond_to_dialogue() -> void:
	if not dialogue_box.visible or not GameState.is_playing():
		return
	_close_dialogue()
	GameState.add_affection(1)


func _show_dialogue(text: String) -> void:
	_dialogue_seq += 1
	var seq: int = _dialogue_seq
	dialogue_label.text = text
	dialogue_box.visible = true
	await get_tree().create_timer(DIALOGUE_DURATION).timeout
	if _dialogue_seq == seq:
		dialogue_box.visible = false


func _close_dialogue() -> void:
	_dialogue_seq += 1
	dialogue_box.visible = false


func _on_affection_changed(_affection: int) -> void:
	_refresh_hud()


func _on_time_changed(seconds_left: int) -> void:
	time_label.text = "心动时间 %d" % seconds_left


func _on_chapter_changed(_chapter: int) -> void:
	_close_dialogue()
	_refresh_hud()


## 胜负呈现：标题/结算/按钮文案切换 + 遮罩显示（win / lose 两分支都要覆盖）。
func _on_game_ended(outcome: String) -> void:
	if outcome == "win":
		overlay_title.text = TEXT_WIN_TITLE
	else:
		overlay_title.text = TEXT_LOSE_TITLE
	overlay_score.text = "最终好感 %d · %s" % [
		GameState.affection, GameState.title_for_chapter(GameState.chapter),
	]
	overlay_action_button.text = TEXT_RETRY_BUTTON
	overlay.visible = true
	_close_dialogue()


## 重开清场：玩家先归位，女友再按新玩家位置归位/换位（落点必须离玩家足够远，
## 否则站在女友出生点上重开会被物理引擎的瞬移残留误判成一次新接触）、遮罩与对话关闭。
func _on_game_restarted() -> void:
	player.global_position = _player_start
	player.velocity = Vector2.ZERO
	for girlfriend in _girlfriends:
		girlfriend.reset_to_start(player.global_position)
	overlay.visible = false
	_close_dialogue()
	_refresh_hud()


func _on_restart_pressed() -> void:
	_restart_game()


func _restart_game() -> void:
	GameState.restart()
