extends Node2D
## 主场景控制器：《冒烟愿晶》玩法闭环的装配点。
##
## 闭环（需求固化）：
##   SpawnTimer 生成流星（随机位置、3~5s 限时闪现）
##   → 收集三路：点按热区命中 / 玩家触碰 / confirm 许愿波
##   → GameState.add_score（+1 愿晶）→ 集齐 3 颗 game_won → 胜利结算（单次）
##   → 重开（confirm 或按钮）：计数归零、流星重新生成。
##
## 规范要点（SKILL.md）：信号连接集中在 _ready()；节点引用用 %唯一名；结果性事件的
## Juice 反馈挂在结果处理函数上（_on_meteor_collected / _on_game_won），不挂输入处理；
## 游戏逻辑只读 InputMap 动作名（confirm），点按是拾取（指针事件 → 热区查询），非动作。

const METEOR_SCENE: PackedScene = preload("res://scenes/meteor.tscn")
## 生成落点避开玩家/既有流星的最小间距（防一帧双收的歧义）。
const SPAWN_CLEARANCE: float = 90.0
## 出生弹跳的起始缩放（闪现「砰」一下）。
const SPAWN_SCALE_FROM: float = 0.3

@onready var player: Player = $Player
@onready var meteor_container: Node2D = $Meteors
@onready var spawn_timer: Timer = $SpawnTimer
@onready var hud_label: Label = %HudLabel
@onready var win_panel: CenterContainer = %WinPanel
@onready var touch_ui: CanvasLayer = $TouchUI

var _autospawn: bool = true
var _last_score: int = 0
var _move_hint: String = "WASD / 方向键移动 · 空格许愿波"


func _ready() -> void:
	if DisplayServer.is_touchscreen_available():
		touch_ui.visible = true
		_move_hint = "摇杆移动 · 点流星收集 · 右下按钮许愿波"
	# 信号连接：订阅方（本场景）写连接代码，发布方（player / GameState / meteor）只 emit。
	if not player.moved.is_connected(_on_player_moved):
		player.moved.connect(_on_player_moved)
	if not GameState.score_changed.is_connected(_on_score_changed):
		GameState.score_changed.connect(_on_score_changed)
	if not GameState.game_won.is_connected(_on_game_won):
		GameState.game_won.connect(_on_game_won)
	spawn_timer.wait_time = GameState.meteor_spawn_interval
	spawn_timer.timeout.connect(_on_spawn_timer_timeout)
	spawn_timer.start()
	hud_label.text = _hud_text()
	win_panel.visible = false
	# 调参工作台（SKILL.md §3C）：网页 + URL 带 ?tuning 参数才创建，其余环境零成本。
	if TuningPanel.is_enabled():
		add_child(TuningPanel.new())


## ── 流星生成 ──

func _on_spawn_timer_timeout() -> void:
	if not _autospawn or GameState.won:
		return
	if _alive_meteor_count() >= GameState.max_alive_meteors:
		return
	spawn_meteor(_find_spawn_position())


## 生成一颗流星：pos 省略则随机落点；lifetime 省略则按调参区 [min, max] 随机（≤5s）。
## 生成路径唯一（计时器 / 冒烟测试都走这里），保证行为一致可测。
func spawn_meteor(pos: Vector2 = Vector2.INF, lifetime: float = -1.0) -> Meteor:
	var meteor: Meteor = METEOR_SCENE.instantiate()
	meteor.position = pos if pos != Vector2.INF else _find_spawn_position()
	meteor.lifetime = lifetime if lifetime > 0.0 \
		else randf_range(GameState.meteor_lifetime_min, GameState.meteor_lifetime_max)
	meteor.collected.connect(_on_meteor_collected)
	meteor.expired.connect(_on_meteor_expired)
	meteor_container.add_child(meteor)
	# 闪现反馈：出生弹跳（表现层，不承担结果反馈 —— 结果反馈在收集处理函数上）。
	meteor.scale = Vector2.ONE * SPAWN_SCALE_FROM
	var tween := meteor.create_tween()
	tween.tween_property(meteor, "scale", Vector2.ONE, 0.22) \
		.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	return meteor


## 随机落点：视口内缩边距，避开玩家与既有流星（有限次重试，失败就用最后一次落点）。
func _find_spawn_position() -> Vector2:
	var view := get_viewport_rect().size
	var margin := Vector2(56.0, 72.0)
	var chosen := Vector2.ZERO
	for attempt: int in 8:
		chosen = Vector2(
			randf_range(margin.x, view.x - margin.x),
			randf_range(margin.y, view.y - margin.y),
		)
		if chosen.distance_to(player.global_position) < SPAWN_CLEARANCE:
			continue
		if _nearest_meteor(chosen) != null:
			continue
		break
	return chosen


func _alive_meteor_count() -> int:
	return meteor_container.get_child_count()


func _nearest_meteor(pos: Vector2) -> Meteor:
	var nearest: Meteor = null
	var nearest_dist: float = INF
	for child in meteor_container.get_children():
		var meteor := child as Meteor
		if meteor == null:
			continue
		var dist := meteor.global_position.distance_to(pos)
		if dist < nearest_dist:
			nearest_dist = dist
			nearest = meteor
	return nearest


## ── 输入：点按热区收集 / confirm 许愿波与重开 ──

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("confirm"):
		if GameState.won:
			restart()
		else:
			_fire_wish_pulse()
		return
	# 点按收集：触摸与鼠标两条原始事件路径（模拟鼠标事件会把一次触摸再派发成鼠标，
	# 命中的流星已 freed，第二次查询落空不计分 —— 天然幂等）。
	if GameState.won:
		return
	if event is InputEventScreenTouch and event.pressed:
		_handle_tap(event.position)
	elif event is InputEventMouseButton \
			and event.button_index == MOUSE_BUTTON_LEFT and event.pressed:
		_handle_tap(event.position)


## 点按热区：视口坐标 → 世界坐标，命中半径内最近的闪现流星即收集。
func _handle_tap(viewport_pos: Vector2) -> void:
	var world_pos := get_canvas_transform().affine_inverse() * viewport_pos
	var meteor := _nearest_meteor(world_pos)
	if meteor == null:
		return  # 失手口径：点空不扣愿晶、不判负
	if meteor.global_position.distance_to(world_pos) <= GameState.tap_radius:
		meteor.collect()


## 许愿波：以玩家为圆心、pulse_radius 内的闪现流星全部收集（bot/触屏的正反馈主路径之一）。
func _fire_wish_pulse() -> void:
	_spawn_pulse_ring()
	for child in meteor_container.get_children():
		var meteor := child as Meteor
		if meteor == null:
			continue
		if meteor.global_position.distance_to(player.global_position) <= GameState.pulse_radius:
			meteor.collect()


## ── 结果处理（Juice 反馈挂这里，不挂输入处理）──

func _on_meteor_collected(_meteor: Meteor) -> void:
	# 收集结算的唯一计分点：三路收集（点按/触碰/许愿波）都汇到这里，愿晶 +1。
	# 胜利门闩（won）在 GameState.add_score 内部处理 —— 集齐 3 颗立即 game_won。
	GameState.add_score(1)
	Juice.pop(hud_label)
	Juice.sfx(&"score")


func _on_meteor_expired(_meteor: Meteor) -> void:
	pass  # 失手口径：超时消失不扣愿晶、不判负；无惩罚反馈以免误导


func _on_score_changed(score: int) -> void:
	var increased := score > _last_score
	_last_score = score
	hud_label.text = _hud_text()
	if increased:
		_spawn_float_text("+1", player.global_position + Vector2(0.0, -34.0))


func _on_game_won(score: int) -> void:
	# 胜利结算：停生成、清空残星（场景无残留元素）、亮结算面板。won 门闩保证只走一次。
	_autospawn = false
	spawn_timer.stop()
	_clear_meteors()
	hud_label.text = _hud_text()
	win_panel.visible = true
	Juice.pop(win_panel)
	Juice.sfx(&"confirm")


func _on_player_moved(pos: Vector2) -> void:
	if not GameState.won:
		hud_label.text = _hud_text()


func _on_restart_button_pressed() -> void:
	restart()
	Juice.sfx(&"confirm")


## 重开一局：计数归零、胜利门闩复位（GameState.reset）、流星重新生成、玩家回中心。
func restart() -> void:
	if not GameState.won:
		return  # 只允许从胜利结算进入重开，防对局中误触清空
	GameState.reset()
	_clear_meteors()
	player.global_position = get_viewport_rect().size / 2.0
	player.velocity = Vector2.ZERO
	win_panel.visible = false
	_autospawn = true
	spawn_timer.wait_time = GameState.meteor_spawn_interval
	spawn_timer.start()
	hud_label.text = _hud_text()


## 冒烟/playtest 可用的确定性开关：暂停/恢复自动生成（不改变判定语义）。
func set_autospawn(enabled: bool) -> void:
	_autospawn = enabled
	if enabled:
		spawn_timer.start()
	else:
		spawn_timer.stop()


func is_spawning() -> bool:
	return _autospawn and not GameState.won


## ── 表现层小件（全部代码构建，不新增场景文件）──

func _clear_meteors() -> void:
	for child in meteor_container.get_children():
		child.queue_free()


func _hud_text() -> String:
	var suffix := " · 胜利！" if GameState.won else ""
	return "%s · 愿晶 %d/%d%s" % [_move_hint, GameState.score, GameState.WIN_TARGET, suffix]


## 收集反馈之一：漂浮「+1」文本（动画反馈；配合音效/弹跳满足「至少其一」）。
func _spawn_float_text(text: String, world_pos: Vector2) -> void:
	var label := Label.new()
	label.text = text
	label.position = world_pos
	label.modulate = Color(1.0, 0.87, 0.35, 1.0)
	label.z_index = 20
	add_child(label)
	var tween := label.create_tween()
	tween.set_parallel(true)
	tween.tween_property(label, "position:y", label.position.y - 44.0, 0.6)
	tween.tween_property(label, "modulate:a", 0.0, 0.6).set_ease(Tween.EASE_IN)
	tween.chain().tween_callback(label.queue_free)


## 许愿波反馈：玩家脚下扩散一圈光环（输入触发动作的表现，不承担结果反馈）。
func _spawn_pulse_ring() -> void:
	var ring := PulseRing.new()
	ring.position = player.global_position
	ring.radius = GameState.pulse_radius
	add_child(ring)
	ring.scale = Vector2.ONE * 0.2
	var tween := ring.create_tween()
	tween.set_parallel(true)
	tween.tween_property(ring, "scale", Vector2.ONE, 0.32).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tween.tween_property(ring, "modulate:a", 0.0, 0.32).set_ease(Tween.EASE_IN)
	tween.chain().tween_callback(ring.queue_free)


## 扩散光环的可绘制节点（内部类：几何极简，不值得单开文件）。
class PulseRing extends Node2D:
	var radius: float = 100.0

	func _draw() -> void:
		draw_arc(Vector2.ZERO, radius, 0.0, TAU, 48, Color(1.0, 0.9, 0.5, 0.8), 3.0)
		draw_arc(Vector2.ZERO, radius * 0.82, 0.0, TAU, 48, Color(1.0, 1.0, 1.0, 0.35), 1.5)
