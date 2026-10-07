extends Node2D
## 主场景控制器：流星生成/磁吸/收集判定、胜利结算、重开、托管导航。
##
## 规范要点（见 SKILL.md「场景规范」「移动端触摸规范」「反馈完备性」「调参工作台」）：
## - 场景内信号连接统一写在 _ready()；节点引用用 @onready + %唯一名；
## - 玩法闭环：Meteor(限时/expired) → Main(距离判定收集/超时计数) → GameState(score/won)
##   → score_changed → Main(HUD + 反馈 + 胜利判定) → VictoryLayer；
## - 结果性事件的反馈挂在结果处理函数（_on_score_changed / _win），不挂在输入处理上；
## - 触摸 UI 只在有触摸屏时显示；点击流星走 _unhandled_input 命中检测（与键盘/摇杆并存）。

const METEOR_SCENE: PackedScene = preload("res://scenes/meteor.tscn")
## 同屏流星上限：转瞬即逝 + 多颗并存，保证「漏收不判负、可继续直至胜利」。
const MAX_METEORS: int = 4
## 流星生成位置与玩家的最小距离（px）：避免生成在玩家身上被瞬时收集。
const SPAWN_MIN_PLAYER_DISTANCE: float = 200.0
## 场地内边距（px）：流星生成与钳制的范围。
const EDGE_MARGIN: float = 60.0
## 点击/触摸收集的热区加成（px）：手指命中宽容度。
const TAP_SLACK: float = 18.0

@onready var player: Player = $Player
@onready var meteors: Node2D = $Meteors
@onready var hud_label: Label = %HudLabel
@onready var victory_layer: CanvasLayer = %VictoryLayer
@onready var victory_label: Label = %VictoryLabel
@onready var restart_button: Button = %RestartButton
@onready var touch_ui: CanvasLayer = $TouchUI

var _spawn_cooldown: float = 0.0
## 本局「超时消失且未计入进度」的流星数（验收标准 1 的可观察量，冒烟断言用）。
var expired_count: int = 0


func _ready() -> void:
	if DisplayServer.is_touchscreen_available():
		touch_ui.visible = true
	# 信号连接：订阅方（本场景）写连接代码，发布方（Meteor / GameState）只 emit。
	GameState.score_changed.connect(_on_score_changed)
	restart_button.pressed.connect(_on_restart_button_pressed)
	victory_layer.visible = false
	_spawn_cooldown = 0.2
	_update_hud()


func _physics_process(delta: float) -> void:
	if GameState.won:
		return
	_spawn_cooldown -= delta
	if _spawn_cooldown <= 0.0 and meteors.get_child_count() < MAX_METEORS:
		_spawn_meteor()
		_spawn_cooldown = GameState.spawn_interval
	_apply_magnet_and_collect()
	_steer_autopilot()


## 生成一颗流星：场内随机位置（避开玩家近旁），限时存在由 Meteor 自管理。
func _spawn_meteor() -> void:
	var rect := _play_rect()
	var pos := Vector2.ZERO
	for attempt in 8:
		pos = Vector2(
			randf_range(rect.position.x + EDGE_MARGIN, rect.end.x - EDGE_MARGIN),
			randf_range(rect.position.y + EDGE_MARGIN, rect.end.y - EDGE_MARGIN)
		)
		if pos.distance_to(player.global_position) >= SPAWN_MIN_PLAYER_DISTANCE:
			break
	var meteor: Meteor = METEOR_SCENE.instantiate()
	meteor.position = pos
	meteor.expired.connect(_on_meteor_expired)
	meteors.add_child(meteor)


## 磁吸（进入磁吸范围的流星被吸向玩家）+ 距离判定收集（核心交互：触碰即收集）。
func _apply_magnet_and_collect() -> void:
	for child in meteors.get_children():
		var meteor := child as Meteor
		if meteor == null or not meteor.is_collectible():
			continue
		var distance := meteor.position.distance_to(player.global_position)
		var magnet: float = GameState.magnet_radius
		if magnet > 0.0 and distance < magnet:
			meteor.position = meteor.position.move_toward(
				player.global_position, GameState.magnet_pull * get_physics_process_delta_time())
		if distance <= GameState.collect_radius + Meteor.BODY_RADIUS:
			_collect_meteor(meteor)


## 托管导航：自动感知最近的可用流星并操纵玩家前往（无人干预达成胜利的机制面）。
func _steer_autopilot() -> void:
	if not GameState.autopilot or GameState.won:
		player.set_autopilot_direction(Vector2.ZERO)
		return
	var target := _nearest_collectible_meteor()
	if target == null:
		player.set_autopilot_direction(Vector2.ZERO)
		return
	var to_target := target.position - player.global_position
	if to_target.length() <= GameState.collect_radius * 0.5:
		player.set_autopilot_direction(Vector2.ZERO)
	else:
		player.set_autopilot_direction(to_target.normalized())


func _nearest_collectible_meteor() -> Meteor:
	var nearest: Meteor = null
	var nearest_distance := INF
	for child in meteors.get_children():
		var meteor := child as Meteor
		if meteor == null or not meteor.is_collectible():
			continue
		var distance := meteor.position.distance_to(player.global_position)
		if distance < nearest_distance:
			nearest = meteor
			nearest_distance = distance
	return nearest


## 收集一颗流星（触碰/点击两条路径都汇到这里）。
func _collect_meteor(meteor: Meteor) -> void:
	if GameState.won or not meteor.is_collectible():
		return
	meteor.collect()
	GameState.add_score(1)


## 点击/触摸流星即收集（移动端主路径）：命中最近的可用流星即算收集。
func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("toggle_autopilot"):
		GameState.set_autopilot(not GameState.autopilot)
		Juice.sfx(&"confirm")
		_update_hud()
		get_viewport().set_input_as_handled()
		return
	if GameState.won and event.is_action_pressed("confirm"):
		restart()
		get_viewport().set_input_as_handled()
		return
	if GameState.won:
		return
	if event is InputEventScreenTouch and event.pressed:
		_try_tap_collect(event.position)
	elif event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		_try_tap_collect(event.position)


func _try_tap_collect(screen_position: Vector2) -> void:
	var target: Meteor = null
	var nearest := GameState.collect_radius + Meteor.BODY_RADIUS + TAP_SLACK
	for child in meteors.get_children():
		var meteor := child as Meteor
		if meteor == null or not meteor.is_collectible():
			continue
		var distance := screen_position.distance_to(meteor.position)
		if distance <= nearest:
			target = meteor
			nearest = distance
	if target != null:
		_collect_meteor(target)


## 流星超时消失：不计入进度、进度不回退、不判负（验收标准 1/4 的状态面）。
func _on_meteor_expired(_meteor: Meteor) -> void:
	expired_count += 1
	_update_hud()


## 收集进度变化：HUD 实时刷新 + 反馈；满三颗立即判定胜利（验收标准 2/3）。
func _on_score_changed(score: int) -> void:
	_update_hud()
	Juice.pop(hud_label)
	Juice.sfx(&"score")
	if GameState.is_victory() and not GameState.won:
		_win()


func _win() -> void:
	GameState.won = true
	victory_layer.visible = true
	victory_label.text = "胜利！「收集三颗即胜」达成"
	Juice.shake()
	Juice.sfx(&"confirm")


## 重开一局：进度归零、结算隐藏、流星清空、生成节奏复位（重开入口）。
func restart() -> void:
	GameState.reset()
	victory_layer.visible = false
	for child in meteors.get_children():
		child.queue_free()
	expired_count = 0
	_spawn_cooldown = 0.2
	_update_hud()


func _on_restart_button_pressed() -> void:
	restart()


func _update_hud() -> void:
	var mode := "托管中" if GameState.autopilot else "手动"
	hud_label.text = "已收集 %d/%d · 超时消失 %d · %s（T 切换托管）" % [
		GameState.score, GameState.WIN_TARGET, expired_count, mode,
	]


## 可玩场地 = 当前视口矩形（stretch=expand 时随窗口自适应）。
func _play_rect() -> Rect2:
	return Rect2(Vector2.ZERO, get_viewport_rect().size)
