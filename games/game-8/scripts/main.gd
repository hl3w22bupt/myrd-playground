class_name GameMain
extends Node2D
## 《牛牛打游戏》主场景控制器：装配 HUD/结算面板、驱动生成器与限时、处理一键重开。
##
## 规范要点（见 SKILL.md「场景规范」「移动端触摸规范」）：
## - 场景内信号连接统一写在 _ready()，集中可见、可被 preflight 静态核对；
## - 游戏对象只 emit（Player.moved / Collectible.collected / GameState.*_changed），
##   本场景是唯一订阅方，UI 文案集中在这里拼装；
## - 触摸 UI（摇杆/确认按钮）只在有触摸屏时显示，桌面键盘环境完全不可见。

## 可收集物场景（收集判定与回收见 _on_collectible_collected）。
const COLLECTIBLE_SCENE: PackedScene = preload("res://scenes/collectible.tscn")
## 随机刷点时与场地边缘保持的最小间距（px）。
const SPAWN_MARGIN: float = 48.0
## 刷点与牛牛保持的最小间距（px）：避免物品生成在角色身上被「贴脸白捡」，
## 也避免重开瞬间（归位后无输入）被判定收集，保证开局计数的确定性。
## 余量推导：拾取半径 22 + 物品半径 14 = 36px 即可触发判定，96px 留 2.6 倍余量。
const SPAWN_CLEARANCE: float = 96.0
## 剩余时间低于该秒数时 HUD 进入红色倒计时警示（需求：失败反馈明确）。
const TIME_WARN_SECONDS: float = 10.0
## 「+1」浮字从生成到完全消失的秒数。
const FLOAT_TEXT_LIFETIME: float = 0.55

@onready var player: Player = $Player
@onready var collectibles_root: Node2D = $Collectibles
@onready var spawn_timer: Timer = $SpawnTimer
@onready var hud_label: Label = %HudLabel
@onready var result_panel: Panel = %ResultPanel
@onready var result_label: Label = %ResultLabel
@onready var touch_ui: CanvasLayer = $TouchUI

## HUD 操作提示（按输入设备切换）。
var _move_hint: String = "WASD / 方向键移动 · 收集青草垛"
## 牛牛本局出生点（重开时归位）。
var _spawn_origin: Vector2 = Vector2(320, 180)


func _ready() -> void:
	if DisplayServer.is_touchscreen_available():
		touch_ui.visible = true
		_move_hint = "摇杆移动 · 收集青草垛"
	_spawn_origin = player.global_position
	spawn_timer.wait_time = GameState.spawn_interval_now()
	# 信号连接：订阅方（本场景）写连接代码，发布方（player / GameState）只 emit。
	if not player.moved.is_connected(_on_player_moved):
		player.moved.connect(_on_player_moved)
	if not GameState.score_changed.is_connected(_on_score_changed):
		GameState.score_changed.connect(_on_score_changed)
	if not GameState.time_changed.is_connected(_on_time_changed):
		GameState.time_changed.connect(_on_time_changed)
	if not GameState.phase_changed.is_connected(_on_phase_changed):
		GameState.phase_changed.connect(_on_phase_changed)
	if not GameState.best_changed.is_connected(_on_best_changed):
		GameState.best_changed.connect(_on_best_changed)
	spawn_timer.timeout.connect(_on_spawn_timer_timeout)
	_fill_collectibles()
	spawn_timer.start()
	_update_hud()
	# 调参工作台（SKILL.md §3C）：仅 Web 且 URL 带 ?tuning= 时创建；
	# 桌面/无头环境 should_show() 恒 false，冒烟与本地运行不受影响。
	if TuningPanel.should_show():
		add_child(TuningPanel.new())


func _process(delta: float) -> void:
	# 限时推进集中在 GameState（可无头判定），场景只负责喂 delta。
	GameState.tick_time(delta)


func _unhandled_input(event: InputEvent) -> void:
	# 结算面板弹出后按确认 → 一键重开（需求验收基线 3）。
	if event.is_action_pressed("confirm") and GameState.phase != GameState.Phase.RUNNING:
		_restart_run()


## 一键重开：状态归零 + 牛牛归位 + 场上可收集物重新铺满 + 刷新节奏复位 + 收起结算面板。
func _restart_run() -> void:
	GameState.start_run()
	player.global_position = _spawn_origin
	_clear_collectibles()
	_fill_collectibles()
	# 难度梯度复位：新的一局从最宽松的节奏重新爬坡。
	spawn_timer.wait_time = GameState.spawn_interval_now()
	result_panel.visible = false
	_update_hud()


## 把场上可收集物补到上限（开局与每次定时刷新共用）。
func _fill_collectibles() -> void:
	while _collectible_count() < GameState.MAX_COLLECTIBLES:
		_spawn_collectible()


func _clear_collectibles() -> void:
	# 先摘出场景树再排队释放：queue_free 是帧末延迟删除，本帧内节点仍在树上，
	# 不摘除会让 _collectible_count 把待删节点也数进去，重开时补充逻辑被跳过。
	for child in collectibles_root.get_children():
		collectibles_root.remove_child(child)
		child.queue_free()


func _collectible_count() -> int:
	var count: int = 0
	for child in collectibles_root.get_children():
		if child is Collectible and not child.is_queued_for_deletion():
			count += 1
	return count


## 定时/随机刷新一个可收集物（位置在场地内取随机点，避开边缘；寿命取当前难度值）。
## 返回本体供调用方跟踪（冒烟用短寿命物品断言过期路径）。
func _spawn_collectible() -> Collectible:
	var collectible: Collectible = COLLECTIBLE_SCENE.instantiate()
	collectible.position = _random_spawn_position()
	collectible.lifetime = GameState.collectible_lifetime_now()
	collectible.collected.connect(_on_collectible_collected)
	collectible.expired.connect(_on_collectible_expired)
	collectibles_root.add_child(collectible)
	return collectible


func _random_spawn_position() -> Vector2:
	var rect := Player.PLAY_RECT
	# 优先随机取点，且与牛牛当前位置保持安全间距（重开归位后同样成立）。
	for _attempt in 8:
		var x := randf_range(rect.position.x + SPAWN_MARGIN, rect.end.x - SPAWN_MARGIN)
		var y := randf_range(rect.position.y + SPAWN_MARGIN, rect.end.y - SPAWN_MARGIN)
		var candidate := Vector2(x, y)
		if candidate.distance_to(player.global_position) >= SPAWN_CLEARANCE:
			return candidate
	# 兜底：重试用尽仍无合规点（理论上不会发生），退回离牛牛最远的场地角。
	var farthest: Vector2 = rect.position
	var farthest_distance: float = -1.0
	for corner: Vector2 in [
		rect.position,
		Vector2(rect.end.x, rect.position.y),
		Vector2(rect.position.x, rect.end.y),
		rect.end,
	]:
		var distance: float = corner.distance_to(player.global_position)
		if distance > farthest_distance:
			farthest_distance = distance
			farthest = corner
	return farthest


## 收集判定命中：计数 +1、弹出 +1 反馈、回收该物品，并按当前难度收紧刷新节奏。
func _on_collectible_collected(collectible: Collectible) -> void:
	GameState.add_score(1)
	_spawn_float_text(collectible.global_position, "+1")
	# 难度梯度：收集越多，后续补充越快（Timer 运行中改 wait_time，下一轮生效）。
	spawn_timer.wait_time = GameState.spawn_interval_now()
	collectible.queue_free()
	_update_hud()


## 物品寿命耗尽未被收集：回收但不计分（难度梯度的「错过惩罚」，与收集路径区分）。
func _on_collectible_expired(collectible: Collectible) -> void:
	collectible.queue_free()
	_update_hud()


## 收集反馈：在世界坐标弹出一个上浮渐隐的「+1」小字（纯代码节点，不进 .tscn）。
func _spawn_float_text(pos: Vector2, text: String) -> void:
	var label := Label.new()
	label.text = text
	label.position = pos + Vector2(-12.0, -26.0)
	label.z_index = 5
	add_child(label)
	var tween := create_tween()
	tween.set_parallel(true)
	tween.tween_property(label, "position:y", label.position.y - 26.0, FLOAT_TEXT_LIFETIME)
	tween.tween_property(label, "modulate:a", 0.0, FLOAT_TEXT_LIFETIME)
	tween.chain().tween_callback(label.queue_free)


func _on_spawn_timer_timeout() -> void:
	if GameState.phase == GameState.Phase.RUNNING:
		_fill_collectibles()


func _on_player_moved(_position: Vector2) -> void:
	_update_hud()


func _on_score_changed(_score: int) -> void:
	_update_hud()


func _on_time_changed(_time_left: float) -> void:
	_update_hud()


func _on_best_changed(_best: int) -> void:
	_update_hud()


func _on_phase_changed(phase: int) -> void:
	result_panel.visible = phase != GameState.Phase.RUNNING
	if phase == GameState.Phase.WON:
		result_label.text = "通关！收集 %d/%d · 历史最佳 %d\n按 确认 / 空格 一键重开" % [
			GameState.score, GameState.TARGET_SCORE, GameState.best_score,
		]
	elif phase == GameState.Phase.LOST:
		result_label.text = "时间到！本局收集 %d/%d · 历史最佳 %d\n按 确认 / 空格 一键重开" % [
			GameState.score, GameState.TARGET_SCORE, GameState.best_score,
		]
	_update_hud()


func _update_hud() -> void:
	hud_label.text = "%s · 剩余 %d 秒 · 本局 %d/%d · 最佳 %d" % [
		_move_hint, ceili(GameState.time_left), GameState.score,
		GameState.TARGET_SCORE, GameState.best_score,
	]
	# 限时尾段红色警示 + 文案提示：失败不是因为没看见（需求：失败反馈明确）。
	var time_low: bool = (
		GameState.phase == GameState.Phase.RUNNING
		and GameState.time_left <= TIME_WARN_SECONDS
	)
	hud_label.add_theme_color_override(
		"font_color", Color(1.0, 0.35, 0.3) if time_low else Color.WHITE
	)
