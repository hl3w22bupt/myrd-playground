class_name MainScene
extends Node2D
## 《星尘收集者》主场景控制器：装配战场、订阅信号、结算与重开。
##
## 玩法闭环（谁接收输入 / 谁改状态 / 谁 emit / 谁订阅 / 谁渲染）：
## - 输入：player.gd 读 InputMap 动作驱动移动；confirm 动作在结算态触发重开；
## - 状态：GameState（autoload）持有分数/护盾/最高分并 emit 信号；
## - 收集：StarDust.body_entered → StarDust.collected → main 加分 + 飘字 + 补位；
## - 受击：Asteroid.body_entered → Player.take_hit()（无敌帧）→ GameState.apply_hit()
##   → shield_changed（震屏）→ 归 0 时 game_over（弹结算面板）；
## - 重开：RestartButton.pressed / confirm 动作 → GameState.start_game()
##   → game_restarted → main 重置战场。

const STAR_DUST_SCENE: PackedScene = preload("res://scenes/star_dust.tscn")
const ASTEROID_SCENE: PackedScene = preload("res://scenes/asteroid.tscn")
const FLOAT_TEXT_SCENE: PackedScene = preload("res://scenes/float_text.tscn")

## 星尘/陨石的生成范围（世界坐标，留出 HUD 与边距）。
const SPAWN_BOUNDS: Rect2 = Rect2(40.0, 48.0, 560.0, 264.0)
## 陨石生成点与玩家的最小距离（避免开局即撞）。
const ASTEROID_MIN_PLAYER_DISTANCE: float = 110.0
## 星尘生成点与玩家的最小距离。
const CRYSTAL_MIN_PLAYER_DISTANCE: float = 60.0
## 生成点探测重试次数（重试耗尽就接受最后一个候选点）。
const SPAWN_ATTEMPTS: int = 12

@onready var player: Player = $Player
@onready var crystals: Node2D = $Crystals
@onready var asteroids: Node2D = $Asteroids
@onready var effects: Node2D = $Effects
@onready var camera: Camera2D = $Camera
@onready var hud_label: Label = %HudLabel
@onready var game_over_panel: PanelContainer = %GameOverPanel
@onready var result_label: Label = %ResultLabel
@onready var restart_button: Button = %RestartButton
@onready var touch_ui: CanvasLayer = $TouchUI

var _move_hint: String = "WASD / 方向键移动 · 收集星尘 · 躲避陨石"
var _spawn_rng := RandomNumberGenerator.new()
var _shake_tween: Tween


func _ready() -> void:
	if DisplayServer.is_touchscreen_available():
		touch_ui.visible = true
		_move_hint = "摇杆移动 · 收集星尘 · 躲避陨石"
	# 信号连接：订阅方（本场景）集中连接，发布方（player / StarDust / GameState）只 emit。
	if not player.moved.is_connected(_on_player_moved):
		player.moved.connect(_on_player_moved)
	if not player.hit_taken.is_connected(_on_player_hit_taken):
		player.hit_taken.connect(_on_player_hit_taken)
	if not GameState.score_changed.is_connected(_on_score_changed):
		GameState.score_changed.connect(_on_score_changed)
	if not GameState.shield_changed.is_connected(_on_shield_changed):
		GameState.shield_changed.connect(_on_shield_changed)
	if not GameState.game_over.is_connected(_on_game_over):
		GameState.game_over.connect(_on_game_over)
	if not GameState.game_restarted.is_connected(_on_game_restarted):
		GameState.game_restarted.connect(_on_game_restarted)
	if not restart_button.pressed.is_connected(_on_restart_pressed):
		restart_button.pressed.connect(_on_restart_pressed)
	_spawn_rng.randomize()
	respawn_field(-1)
	_update_hud()


func _unhandled_input(event: InputEvent) -> void:
	# 结算态的键盘重开入口（与「重新开始」按钮等价）。
	if GameState.is_game_over and event.is_action_pressed("confirm"):
		_on_restart_pressed()


## 重置战场：清空现有星尘/陨石后按配置数量重新生成。
## seed_value >= 0 时用固定种子生成（冒烟门禁要求可复现），-1 表示随机。
func respawn_field(seed_value: int) -> void:
	if seed_value >= 0:
		_spawn_rng.seed = seed_value
	# 先摘出树再释放：queue_free 的节点要到帧末才消失，
	# 留在树里会把 _spawn_* 的数量上限占满，导致重开战场生成不出来。
	for node in crystals.get_children():
		crystals.remove_child(node)
		node.queue_free()
	for node in asteroids.get_children():
		asteroids.remove_child(node)
		node.queue_free()
	for _i in GameConfig.max_crystals:
		_spawn_crystal()
	for _i in GameConfig.max_asteroids:
		_spawn_asteroid()


## 生成一颗星尘晶体；被收集后由补位定时器再次调用（有数量上限兜底）。
func _spawn_crystal() -> void:
	if crystals.get_child_count() >= GameConfig.max_crystals:
		return
	var crystal: StarDust = STAR_DUST_SCENE.instantiate()
	crystal.position = _pick_spawn_point(CRYSTAL_MIN_PLAYER_DISTANCE)
	crystal.collected.connect(_on_crystal_collected)
	crystals.add_child(crystal)


## 生成一颗陨石，速度取配置区间内的随机方向标量。
func _spawn_asteroid() -> void:
	if asteroids.get_child_count() >= GameConfig.max_asteroids:
		return
	var asteroid: Asteroid = ASTEROID_SCENE.instantiate()
	asteroid.position = _pick_spawn_point(ASTEROID_MIN_PLAYER_DISTANCE)
	var speed: float = _spawn_rng.randf_range(GameConfig.asteroid_speed_min, GameConfig.asteroid_speed_max)
	var direction := Vector2.from_angle(_spawn_rng.randf_range(0.0, TAU))
	asteroid.velocity = direction * speed
	asteroids.add_child(asteroid)


## 挑一个离玩家足够远的生成点（重试耗尽则接受最后一个候选点）。
func _pick_spawn_point(min_player_distance: float) -> Vector2:
	var candidate := SPAWN_BOUNDS.position
	for _attempt in SPAWN_ATTEMPTS:
		candidate = Vector2(
			_spawn_rng.randf_range(SPAWN_BOUNDS.position.x, SPAWN_BOUNDS.end.x),
			_spawn_rng.randf_range(SPAWN_BOUNDS.position.y, SPAWN_BOUNDS.end.y),
		)
		if player == null or candidate.distance_to(player.global_position) >= min_player_distance:
			return candidate
	return candidate


## 收集结算：加分（数值来自 GameConfig）→ 飘字反馈 → 延迟补位。
func _on_crystal_collected(collected_at: Vector2) -> void:
	GameState.add_score(GameConfig.score_per_crystal)
	_spawn_float_text("+%d" % GameConfig.score_per_crystal, collected_at)
	get_tree().create_timer(GameConfig.respawn_delay_seconds).timeout.connect(_spawn_crystal)


func _spawn_float_text(text_value: String, at: Vector2) -> void:
	var float_text: FloatText = FLOAT_TEXT_SCENE.instantiate()
	float_text.position = at
	effects.add_child(float_text)
	float_text.set_text(text_value)


func _on_player_hit_taken(_shield: int) -> void:
	_play_shake()


func _on_score_changed(_score: int) -> void:
	_update_hud()


func _on_shield_changed(_shield: int) -> void:
	_update_hud()


## 护盾归 0 的瞬间：结算面板展示本局得分与历史最高分（需求验收标准 3）。
func _on_game_over(final_score: int, final_high_score: int) -> void:
	result_label.text = "本局得分 %d · 历史最高 %d" % [final_score, final_high_score]
	game_over_panel.visible = true


## 重开：重置分数与护盾（GameState.start_game）并重铺战场，立即进入新一局。
func _on_restart_pressed() -> void:
	game_over_panel.visible = false
	GameState.start_game()


func _on_game_restarted() -> void:
	respawn_field(-1)
	_update_hud()


func _on_player_moved(_position: Vector2) -> void:
	_update_hud()


func _update_hud() -> void:
	hud_label.text = "星尘收集者 · 分数 %d · 护盾 %d/%d · %s" % [
		GameState.score, GameState.shield, GameConfig.initial_shield, _move_hint,
	]


## 受击反馈：震屏（相机偏移抖动后归零）。
func _play_shake() -> void:
	if _shake_tween != null and _shake_tween.is_valid():
		_shake_tween.kill()
	camera.offset = Vector2.ZERO
	_shake_tween = create_tween()
	for _i in 5:
		_shake_tween.tween_property(camera, "offset",
			Vector2(_spawn_rng.randf_range(-6.0, 6.0), _spawn_rng.randf_range(-6.0, 6.0)), 0.04)
	_shake_tween.tween_property(camera, "offset", Vector2.ZERO, 0.04)
