class_name MainGame
extends Node2D
## 主场景控制器（接苹果 game-11）：装配 UI、订阅信号、驱动「开始 → 游玩 → 结算 → 重开」闭环。
##
## 规范要点（见 SKILL.md「场景规范」「移动端触摸规范」）：
## - 场景内信号连接统一写在 _ready()，集中可见、可被 preflight 静态核对（P8/P12）；
## - 游戏对象（Player / Apple）只 emit，本场景订阅后把意图转给 GameState；
## - 触摸 UI（摇杆/确认按钮）只在有触摸屏时显示，桌面键盘环境完全不可见。

## 苹果出生高度（视口顶部之上，掉进画面才算出现）。
const APPLE_SPAWN_Y: float = -24.0

const APPLE_SCENE := preload("res://scenes/apple.tscn")

@onready var player: Player = $Player
@onready var apples: Node2D = $Apples
@onready var spawn_timer: Timer = $SpawnTimer
@onready var follow_zone: PointerFollowZone = %PointerFollowZone
@onready var hud_label: Label = %HudLabel
@onready var miss_flash: ColorRect = %MissFlash
@onready var feedback_label: Label = %FeedbackLabel
@onready var start_panel: Control = %StartPanel
@onready var start_hint_label: Label = %StartHintLabel
@onready var start_button: Button = %StartButton
@onready var game_over_panel: Control = %GameOverPanel
@onready var result_label: Label = %ResultLabel
@onready var new_record_label: Label = %NewRecordLabel
@onready var restart_button: Button = %RestartButton
@onready var touch_ui: CanvasLayer = $TouchUI

## 接住/漏接反馈已触发的次数。供冒烟断言做确定性核对（反馈是短促动画，
## 断言「动画可见性」会踩时序，计数器才是机判稳定面）。
var catch_feedback_count: int = 0
var miss_feedback_count: int = 0

## 反馈短语的停留时长（秒）：接住 / 漏接的提示文字显示这么久后自动隐藏。
const FEEDBACK_VISIBLE_TIME: float = 0.6
## 漏接红闪的峰值不透明度：足够醒目又不遮住游戏区（ColorRect 铺满全屏）。
const MISS_FLASH_ALPHA: float = 0.22

var _move_hint: String = "←/→ 或 A/D 移动果篮 · 鼠标水平移动跟随 · Enter / 空格 开始"


func _ready() -> void:
	if DisplayServer.is_touchscreen_available():
		touch_ui.visible = true
		_move_hint = "手指拖动屏幕移动果篮 · 右下按钮开始"
	# 操作提示按输入设备切换（SKILL.md「移动端触摸规范」_move_hint 模式）。
	start_hint_label.text = _move_hint
	# 信号连接：订阅方（本场景）写连接代码，发布方（player / GameState / 指针区）只 emit。
	spawn_timer.timeout.connect(_on_spawn_timer_timeout)
	GameState.score_changed.connect(_on_score_changed)
	GameState.lives_changed.connect(_on_lives_changed)
	GameState.best_changed.connect(_on_best_changed)
	GameState.state_changed.connect(_on_state_changed)
	GameState.game_over.connect(_on_game_over)
	follow_zone.follow_target_changed.connect(_on_follow_target_changed)
	follow_zone.follow_ended.connect(_on_follow_ended)
	start_button.pressed.connect(_on_start_requested)
	restart_button.pressed.connect(_on_restart_requested)
	_apply_state(GameState.state)
	_update_hud()


func _unhandled_input(event: InputEvent) -> void:
	if not event.is_action_pressed("confirm"):
		return
	# 开局入口与结算重开的键盘路径：Enter / 空格（移动端走右下触摸按钮，同一动作）。
	if GameState.state == GameState.State.MENU:
		_start_run()
	elif GameState.state == GameState.State.GAME_OVER:
		_start_run()


## ── 一局的生命周期 ──
func _start_run() -> void:
	clear_apples()
	GameState.start_game()
	spawn_timer.wait_time = GameState.spawn_interval
	spawn_timer.start()


## 供门禁与生成器共用的苹果生成入口：位置显式传入，速度按难度曲线取值。
func spawn_apple(at: Vector2) -> Apple:
	var apple: Apple = APPLE_SCENE.instantiate()
	apple.position = at
	apple.fall_speed = GameState.current_fall_speed()
	apple.caught.connect(_on_apple_caught)
	apple.missed.connect(_on_apple_missed)
	apples.add_child(apple)
	return apple


func clear_apples() -> void:
	for apple in apples.get_children():
		apple.queue_free()


func _apply_state(state: int) -> void:
	start_panel.visible = state == GameState.State.MENU
	game_over_panel.visible = false
	# 新纪录标记随结算面板一起收起：它只在 _on_game_over 里按 is_new_record() 重设，
	# 否则重开一局后仍挂着上一局的「新纪录！」。
	new_record_label.visible = false
	# 换阶段就收掉上一局遗留的反馈，避免「漏接 -1 生命」挂在开局/结算画面上。
	_hide_feedback()


## ── 苹果生成 ──
func _on_spawn_timer_timeout() -> void:
	if GameState.state != GameState.State.PLAYING:
		return
	var spawn_range := GameState.spawn_range()
	var x := randf_range(spawn_range.x, spawn_range.y)
	spawn_apple(Vector2(x, APPLE_SPAWN_Y))
	# 难度递增：每次生成都按当前得分重排下一次间隔。
	spawn_timer.wait_time = GameState.current_spawn_interval()


## ── 苹果判定结果 ──
func _on_apple_caught(_apple: Apple) -> void:
	GameState.catch_apple()
	_play_catch_feedback()


func _on_apple_missed(_apple: Apple) -> void:
	GameState.miss_apple()
	_play_miss_feedback()


## ── 反馈（需求第 2 条「接住反馈」/ 第 3 条「漏接扣生命」的可感知面）──
## 接住：HUD 上方弹出「接住 +1」并做一次缩放脉冲；计数器自增供冒烟机判。
func _play_catch_feedback() -> void:
	catch_feedback_count += 1
	feedback_label.text = "接住 +%d" % GameState.score_per_apple
	feedback_label.add_theme_color_override("font_color", Color(0.16, 0.5, 0.16))
	feedback_label.visible = true
	feedback_label.pivot_offset = Vector2(feedback_label.size.x * 0.5, feedback_label.size.y * 0.5)
	feedback_label.scale = Vector2.ONE
	var pop := create_tween()
	pop.tween_property(feedback_label, "scale", Vector2(1.18, 1.18), 0.07)
	pop.tween_property(feedback_label, "scale", Vector2.ONE, 0.12)
	pop.tween_callback(_hide_feedback).set_delay(FEEDBACK_VISIBLE_TIME)


## 漏接：HUD 弹出「漏接 -1 生命」，全屏红闪一次后淡出；同样计数供冒烟机判。
func _play_miss_feedback() -> void:
	miss_feedback_count += 1
	feedback_label.text = "漏接 -1 生命"
	feedback_label.add_theme_color_override("font_color", Color(0.72, 0.14, 0.14))
	feedback_label.visible = true
	miss_flash.color.a = MISS_FLASH_ALPHA
	var fade := create_tween()
	fade.tween_property(miss_flash, "color:a", 0.0, 0.28)
	fade.tween_callback(_hide_feedback).set_delay(FEEDBACK_VISIBLE_TIME)


func _hide_feedback() -> void:
	feedback_label.visible = false
	miss_flash.color.a = 0.0


## ── GameState 信号 → UI ──
func _on_state_changed(state: int) -> void:
	_apply_state(state)
	_update_hud()


func _on_score_changed(_score: int) -> void:
	_update_hud()


func _on_lives_changed(_lives: int) -> void:
	_update_hud()


func _on_best_changed(_best: int) -> void:
	_update_hud()


func _on_game_over(score: int, best: int) -> void:
	spawn_timer.stop()
	clear_apples()
	result_label.text = "本局得分 %d · 历史最高分 %d" % [score, best]
	# 新纪录标记与 GameState 的判定保持同一事实来源（而不是这里再算一遍）。
	new_record_label.visible = GameState.is_new_record()
	game_over_panel.visible = true
	_update_hud()


## ── 输入转发 ──
func _on_follow_target_changed(x: float) -> void:
	player.set_follow_target(x)


func _on_follow_ended() -> void:
	player.clear_follow_target()


func _on_start_requested() -> void:
	if GameState.state == GameState.State.MENU:
		_start_run()


func _on_restart_requested() -> void:
	if GameState.state == GameState.State.GAME_OVER:
		_start_run()


func _update_hud() -> void:
	hud_label.text = "得分 %d · 最高分 %d · 生命 %d" % [
		GameState.score, GameState.best, GameState.lives,
	]
