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
const SPAWN_CLEARANCE: float = 96.0

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
	spawn_timer.wait_time = GameState.SPAWN_INTERVAL
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


func _process(delta: float) -> void:
	# 限时推进集中在 GameState（可无头判定），场景只负责喂 delta。
	GameState.tick_time(delta)


func _unhandled_input(event: InputEvent) -> void:
	# 结算面板弹出后按确认 → 一键重开（需求验收基线 3）。
	if event.is_action_pressed("confirm") and GameState.phase != GameState.Phase.RUNNING:
		_restart_run()


## 一键重开：状态归零 + 牛牛归位 + 场上可收集物重新铺满 + 收起结算面板。
func _restart_run() -> void:
	GameState.start_run()
	player.global_position = _spawn_origin
	_clear_collectibles()
	_fill_collectibles()
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


## 定时/随机刷新一个可收集物（位置在场地内取随机点，避开边缘）。
func _spawn_collectible() -> void:
	var collectible: Collectible = COLLECTIBLE_SCENE.instantiate()
	collectible.position = _random_spawn_position()
	collectible.collected.connect(_on_collectible_collected)
	collectibles_root.add_child(collectible)


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


## 收集判定命中：计数 +1、回收该物品（生成器稍后自动补充）。
func _on_collectible_collected(collectible: Collectible) -> void:
	GameState.add_score(1)
	collectible.queue_free()
	_update_hud()


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
