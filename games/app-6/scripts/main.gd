extends Node2D
## 主场景控制器：夜空调度（流星生成节奏）、捕捉交互路由、胜负结算与重开。
##
## 捕捉的三条路径都收敛到 Meteor.capture()（状态机保证只计一次）：
##   1. 点击/触碰流星（需求主交互：在捕捉窗口期内命中）；
##   2. confirm 动作 → 捕捉距捕手最近且在窗口期内的流星（键盘玩家的主动捕获）；
##   3. 捕手与流星碰撞（Meteor 订阅 body_entered 自行捕获）。
##
## 规范要点（std-skills/godot-game-dev/SKILL.md）：信号连接集中在 _ready()；
## 结果性事件的反馈挂在结果处理函数上（_on_wish_count_changed / _on_victory_achieved）；
## 节奏数值全部走 GameState 调参区，本文件零魔数（表现常量除外）。

const METEOR_SCENE: PackedScene = preload("res://scenes/meteor.tscn")
## 点击/触碰流星的有效命中半径（px）：容忍手指热区误差（触摸热区口径，见调研文档）。
const TAP_RADIUS: float = 64.0
## 流星生成时超出屏幕边缘的距离（px）：从画面外划入。
const SPAWN_MARGIN: float = 48.0

@onready var player: Player = $Player
@onready var hud_label: Label = %HudLabel
@onready var touch_ui: CanvasLayer = $TouchUI
@onready var meteor_root: Node2D = $Meteors
@onready var victory_panel: Control = %VictoryPanel
@onready var victory_title: Label = %VictoryTitle
@onready var victory_detail: Label = %VictoryDetail
@onready var restart_button: Button = %RestartButton

## 操作提示（按输入设备切换；触摸环境显示摇杆口径）。
var _move_hint: String = "WASD / 方向键移动 · 点击流星捕愿晶"
## 距下一次生成流星的倒计时（秒），间隔在 spawn_interval_min/max 间随机。
var _spawn_countdown: float = 1.0
## 自动生成开关：冒烟场景关掉它以获得确定性的节奏（断言手动生成流星）。
var auto_spawn_enabled: bool = true


func _ready() -> void:
	if DisplayServer.is_touchscreen_available():
		touch_ui.visible = true
		_move_hint = "摇杆移动 · 点击流星捕愿晶"
	# 信号连接：订阅方（本场景）集中写连接代码，发布方（Meteor / GameState）只 emit。
	restart_button.pressed.connect(_on_restart_button_pressed)
	if not GameState.wish_count_changed.is_connected(_on_wish_count_changed):
		GameState.wish_count_changed.connect(_on_wish_count_changed)
	if not GameState.victory_achieved.is_connected(_on_victory_achieved):
		GameState.victory_achieved.connect(_on_victory_achieved)
	victory_panel.visible = false
	_spawn_countdown = _next_spawn_interval()
	_refresh_hud()
	# 调参工作台（SKILL.md §3C）：网页 + URL 带 ?tuning 参数才创建，其余环境零成本。
	if TuningPanel.is_enabled():
		add_child(TuningPanel.new())


func _physics_process(delta: float) -> void:
	if not auto_spawn_enabled:
		return
	_spawn_countdown -= delta
	if _spawn_countdown > 0.0:
		return
	_spawn_countdown = _next_spawn_interval()
	_spawn_meteor_from_edge()


## 生成一颗流星（冒烟与玩法共用入口）：出生点 + 划过方向。
func spawn_meteor(from: Vector2, move_direction: Vector2) -> Meteor:
	var meteor: Meteor = METEOR_SCENE.instantiate()
	meteor.setup(from, move_direction)
	meteor_root.add_child(meteor)
	meteor.captured.connect(_on_meteor_captured)
	return meteor


## 重开一局：清空愿晶与场上流星、收起结算浮层、重置生成节奏。
func restart_game() -> void:
	GameState.reset()
	for node in get_tree().get_nodes_in_group(&"meteors"):
		node.queue_free()
	victory_panel.visible = false
	_spawn_countdown = _next_spawn_interval()
	_refresh_hud()
	# 重开是结果性事件（确认类）：挂反馈（SKILL.md §3B）。
	Juice.pop(hud_label)
	Juice.sfx(&"confirm")


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed(&"confirm"):
		# 胜利结算浮层在前时，confirm 优先重开（键盘玩家的重开入口）。
		if victory_panel.visible:
			restart_game()
		else:
			_capture_nearest_to_player()
		return
	var pressed := false
	var pos := Vector2.ZERO
	if event is InputEventMouseButton:
		var mouse := event as InputEventMouseButton
		pressed = mouse.pressed and mouse.button_index == MOUSE_BUTTON_LEFT
		pos = mouse.position
	elif event is InputEventScreenTouch:
		var touch := event as InputEventScreenTouch
		pressed = touch.pressed
		pos = touch.position
	if pressed:
		_try_capture_at(_event_world_position(pos))


## 路径 1：点击/触碰捕捉 —— 命中半径内离落点最近的窗口期内流星。
func _try_capture_at(world_pos: Vector2) -> bool:
	var best: Meteor = null
	var best_dist := TAP_RADIUS
	for node in get_tree().get_nodes_in_group(&"meteors"):
		var meteor := node as Meteor
		if meteor == null or meteor.state != Meteor.State.ALIVE:
			continue
		var dist: float = meteor.global_position.distance_to(world_pos)
		if dist <= best_dist:
			best = meteor
			best_dist = dist
	if best == null:
		return false
	return best.capture()


## 路径 2：confirm 主动捕获 —— 捕手 capture_radius 内最近的窗口期内流星。
func _capture_nearest_to_player() -> bool:
	var best: Meteor = null
	var best_dist: float = GameState.capture_radius
	for node in get_tree().get_nodes_in_group(&"meteors"):
		var meteor := node as Meteor
		if meteor == null or meteor.state != Meteor.State.ALIVE:
			continue
		var dist: float = meteor.global_position.distance_to(player.global_position)
		if dist <= best_dist:
			best = meteor
			best_dist = dist
	if best == null:
		return false
	return best.capture()


func _on_meteor_captured(_meteor: Meteor) -> void:
	# 愿晶计数的唯一入口：状态与信号都在 GameState，胜利判定也在那里收口。
	GameState.add_wish_crystal(1)


func _on_wish_count_changed(count: int) -> void:
	_refresh_hud()
	# 结果性事件（捕捉成功）的反馈：HUD 弹跳 + 音效（SKILL.md §3B）。
	Juice.pop(hud_label)
	Juice.sfx(&"score")


func _on_victory_achieved(count: int) -> void:
	# 需求验收标准 4：收集数达 3 立即触发胜利结算界面（胜利只由收集数=3 触发）。
	victory_title.text = "愿望达成！"
	victory_detail.text = "你捕捉了 %d 颗愿晶，流星为证" % count
	victory_panel.visible = true
	_refresh_hud()
	Juice.pop(victory_panel)
	Juice.sfx(&"confirm")


func _on_restart_button_pressed() -> void:
	restart_game()


func _refresh_hud() -> void:
	if GameState.phase == GameState.Phase.VICTORY:
		hud_label.text = "%s · 愿晶 %d/%d 已达成" % [_move_hint, GameState.score, GameState.WIN_TARGET]
	else:
		hud_label.text = "%s · 愿晶 %d/%d" % [_move_hint, GameState.score, GameState.WIN_TARGET]


func _next_spawn_interval() -> float:
	return randf_range(GameState.spawn_interval_min, GameState.spawn_interval_max)


func _spawn_meteor_from_edge() -> void:
	var bounds := get_viewport_rect().size
	var target := Vector2(
		randf_range(bounds.x * 0.25, bounds.x * 0.75),
		randf_range(bounds.y * 0.2, bounds.y * 0.8),
	)
	var from: Vector2
	match randi_range(0, 3):
		0:
			from = Vector2(-SPAWN_MARGIN, randf_range(0.0, bounds.y))
		1:
			from = Vector2(bounds.x + SPAWN_MARGIN, randf_range(0.0, bounds.y))
		2:
			from = Vector2(randf_range(0.0, bounds.x), -SPAWN_MARGIN)
		_:
			from = Vector2(randf_range(0.0, bounds.x), bounds.y + SPAWN_MARGIN)
	spawn_meteor(from, target - from)


## 视口坐标 → 世界坐标（本游戏无相机、canvas 恒等变换；写全换算防以后加相机时悄悄断）。
func _event_world_position(viewport_pos: Vector2) -> Vector2:
	return get_canvas_transform().affine_inverse() * viewport_pos
