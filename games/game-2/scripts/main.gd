class_name MainScene
extends Node2D
## 《星尘收集者》主场景控制器：装配战场、订阅信号、结算与重开。
##
## 玩法闭环（谁接收输入 / 谁改状态 / 谁 emit / 谁订阅 / 谁渲染）：
## - 输入：player.gd 读 InputMap 动作驱动移动；confirm 动作在结算态触发重开；
## - 状态：GameState（autoload）持有分数/护盾/最高分并 emit 信号；
## - 收集：StarDust.body_entered → StarDust.collected → main 加分 + 飘字 + 补位；
## - 受击：Asteroid.body_entered → Player.take_hit()（无敌帧）→ GameState.apply_hit()
##   → shield_changed（震屏）→ 归 0 时 game_over（弹失败结算面板）；
## - 梯度：score_changed → 分数跨过 difficulty_step → _apply_difficulty 上调陨石上限/速度；
## - 终局：失败 = 护盾耗尽（game_over）；胜利 = 得分达 score_target（game_won）——
##   同一结算面板，标题区分胜负；
## - 重开：RestartButton.pressed / confirm 动作 → GameState.start_game()
##   → game_restarted → main 难度复位 + 重置战场。

const STAR_DUST_SCENE: PackedScene = preload("res://scenes/star_dust.tscn")
const ASTEROID_SCENE: PackedScene = preload("res://scenes/asteroid.tscn")
const FLOAT_TEXT_SCENE: PackedScene = preload("res://scenes/float_text.tscn")

## 星尘/陨石的生成范围（世界坐标）：生成点距左右边 ≥40px、距顶底 ≥48px
## （顶部 40px 为 HUD 文案区 + 8px 余量）。星尘拾取半径 14px、陨石受击半径 13px
## 均小于 40px —— 生成点必然整体在视口内，不会出现「半截在屏外」的目标。
const SPAWN_BOUNDS: Rect2 = Rect2(40.0, 48.0, 560.0, 264.0)
## 陨石生成点与玩家的最小距离：接触包络 = 玩家碰撞半径 12 + 陨石受击半径 13 = 25px，
## 110px ≈ 4.4 倍包络，按最高漂移速度（110px/s × 1.8 难度封顶 ≈ 198px/s）也有
## ≥0.55s 反应时间，杜绝开局即撞。
const ASTEROID_MIN_PLAYER_DISTANCE: float = 110.0
## 星尘生成点与玩家的最小距离：大于收集包络（12 + 14 = 26px），
## 保证新补位的晶体不会在玩家脚下「凭空被收」。
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
@onready var result_title_label: Label = %ResultTitleLabel
@onready var result_label: Label = %ResultLabel
@onready var restart_button: Button = %RestartButton
@onready var milestone_label: Label = %MilestoneLabel
@onready var touch_ui: CanvasLayer = $TouchUI

var _move_hint: String = "WASD / 方向键移动 · 收集星尘 · 躲避陨石"
var _spawn_rng := RandomNumberGenerator.new()
var _shake_tween: Tween
var _milestone_tween: Tween

## ── 难度梯度运行时状态（由 _apply_difficulty 按 GameConfig 配置推导，重开复位）──
## 当前难度等级：score / difficulty_step 向下取整。
var difficulty_level: int = 0
## 当前陨石常驻数量上限（随难度上调，封顶 difficulty_asteroids_cap）。
var asteroid_cap: int = 0
## 当前陨石速度倍率（随难度上调，封顶 difficulty_speed_cap_scale）。
var _speed_scale: float = 1.0


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
	if not GameState.game_won.is_connected(_on_game_won):
		GameState.game_won.connect(_on_game_won)
	if not GameState.game_restarted.is_connected(_on_game_restarted):
		GameState.game_restarted.connect(_on_game_restarted)
	if not restart_button.pressed.is_connected(_on_restart_pressed):
		restart_button.pressed.connect(_on_restart_pressed)
	_spawn_rng.randomize()
	_apply_difficulty(0)
	respawn_field(-1)
	_update_hud()


func _unhandled_input(event: InputEvent) -> void:
	# 结算态的键盘重开入口（与「重新开始」按钮等价）。
	if GameState.is_game_over and event.is_action_pressed("confirm"):
		_on_restart_pressed()


## 重置战场：清空现有星尘/陨石后按当前难度上限重新生成。
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
	for _i in asteroid_cap:
		_spawn_asteroid()


## 生成一颗星尘晶体；被收集后由补位定时器再次调用（有数量上限兜底）。
func _spawn_crystal() -> void:
	if crystals.get_child_count() >= GameConfig.max_crystals:
		return
	var crystal: StarDust = STAR_DUST_SCENE.instantiate()
	crystal.position = _pick_spawn_point(CRYSTAL_MIN_PLAYER_DISTANCE)
	crystal.collected.connect(_on_crystal_collected)
	crystals.add_child(crystal)


## 生成一颗陨石，速度取配置区间内的随机方向标量（再乘当前难度倍率）。
func _spawn_asteroid() -> void:
	if asteroids.get_child_count() >= asteroid_cap:
		return
	var asteroid: Asteroid = ASTEROID_SCENE.instantiate()
	asteroid.position = _pick_spawn_point(ASTEROID_MIN_PLAYER_DISTANCE)
	var speed: float = _spawn_rng.randf_range(GameConfig.asteroid_speed_min, GameConfig.asteroid_speed_max)
	var direction := Vector2.from_angle(_spawn_rng.randf_range(0.0, TAU))
	asteroid.velocity = direction * speed * _speed_scale
	asteroids.add_child(asteroid)


## ── 难度梯度 ──
## 当前分数对应的难度等级：score / difficulty_step 向下取整（difficulty_step <= 0 恒为 0）。
func _level_for_score(score_value: int) -> int:
	if GameConfig.difficulty_step <= 0:
		return 0
	return floori(float(score_value) / float(GameConfig.difficulty_step))


## 应用难度等级（数值推导与 config/gameplay.cfg 注释同口径）：
##   陨石上限 = min(max_asteroids + level × difficulty_asteroids_per_level, difficulty_asteroids_cap)
##   速度倍率 = min(1 + level × difficulty_speed_per_level, difficulty_speed_cap_scale)
## 上调后同步把陨石补足到新上限（已生成的陨石不重生成，梯度平滑不闪变）。
func _apply_difficulty(level: int) -> void:
	difficulty_level = maxi(level, 0)
	asteroid_cap = mini(
		GameConfig.max_asteroids + difficulty_level * GameConfig.difficulty_asteroids_per_level,
		GameConfig.difficulty_asteroids_cap)
	_speed_scale = minf(
		1.0 + float(difficulty_level) * GameConfig.difficulty_speed_per_level,
		GameConfig.difficulty_speed_cap_scale)
	while asteroids.get_child_count() < asteroid_cap:
		_spawn_asteroid()


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


func _on_score_changed(score_value: int) -> void:
	# 难度梯度：跨过 difficulty_step 整数倍 → 提升难度并补足陨石。
	var level := _level_for_score(score_value)
	if level != difficulty_level:
		_apply_difficulty(level)
	# 里程碑庆祝：分数跨过 milestone_step 整数倍 → 弹庆祝横幅。
	_maybe_show_milestone(score_value)
	_update_hud()


func _on_shield_changed(_shield: int) -> void:
	_update_hud()


## 失败终局（护盾耗尽）：结算面板展示本局得分与历史最高分（需求验收标准 3）。
func _on_game_over(final_score: int, final_high_score: int) -> void:
	_show_settlement("护盾耗尽 · 本局结束", final_score, final_high_score)


## 胜利终局（本局得分达到 score_target）。
func _on_game_won(final_score: int, final_high_score: int) -> void:
	_show_settlement("目标达成 · 胜利！", final_score, final_high_score)


## 两种终局共用结算面板：标题区分胜负，正文给出本局得分与历史最高分
## （追平/刷新纪录时追加「新纪录」，给出明确的正反馈）。
func _show_settlement(title: String, final_score: int, final_high_score: int) -> void:
	result_title_label.text = title
	var summary := "本局得分 %d · 历史最高 %d" % [final_score, final_high_score]
	if final_score > 0 and final_score >= final_high_score:
		summary += " · 新纪录！"
	result_label.text = summary
	_hide_milestone_banner()
	game_over_panel.visible = true


## ── 里程碑庆祝横幅 ──
func _maybe_show_milestone(score_value: int) -> void:
	if GameConfig.milestone_step <= 0 or GameState.is_game_over or score_value <= 0:
		return
	if score_value % GameConfig.milestone_step != 0:
		return
	milestone_label.text = "里程碑 · 已收集 %d 颗星尘！" % score_value
	milestone_label.visible = true
	if _milestone_tween != null and _milestone_tween.is_valid():
		_milestone_tween.kill()
	milestone_label.modulate = Color(1.0, 1.0, 0.65, 0.0)
	_milestone_tween = create_tween()
	_milestone_tween.tween_property(milestone_label, "modulate:a", 1.0, 0.12)
	_milestone_tween.tween_interval(1.1)
	_milestone_tween.tween_property(milestone_label, "modulate:a", 0.0, 0.25)
	_milestone_tween.tween_callback(_on_milestone_fade_out)


func _on_milestone_fade_out() -> void:
	# 淡出完成后只藏节点，不 kill 自己所在的 tween（避免回调里销毁自身）。
	milestone_label.visible = false


func _hide_milestone_banner() -> void:
	if _milestone_tween != null and _milestone_tween.is_valid():
		_milestone_tween.kill()
	milestone_label.visible = false
	milestone_label.modulate = Color(1.0, 1.0, 0.65, 0.0)


## 重开：重置分数与护盾（GameState.start_game）并重铺战场，立即进入新一局。
func _on_restart_pressed() -> void:
	game_over_panel.visible = false
	GameState.start_game()


func _on_game_restarted() -> void:
	# 难度先复位再重铺：战场按 0 级上限重新生成（胜利/失败重开都回到起点）。
	_apply_difficulty(0)
	_hide_milestone_banner()
	respawn_field(-1)
	_update_hud()


func _on_player_moved(_position: Vector2) -> void:
	_update_hud()


func _update_hud() -> void:
	# 开启胜利目标时，分数以「当前/目标」呈现，进度与终局条件一目了然。
	var score_text := "分数 %d" % GameState.score
	if GameConfig.score_target > 0:
		score_text += "/%d" % GameConfig.score_target
	hud_label.text = "星尘收集者 · %s · 护盾 %d/%d · %s" % [
		score_text, GameState.shield, GameConfig.initial_shield, _move_hint,
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
