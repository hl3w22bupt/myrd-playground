extends Node2D
## 主场景控制器：跑酷流程编排 + 信号集中接线。
##
## 晃动接线（需求：加速降晃 / 终局单晃）：
## - GameState.speed_changed(active=true)  → camera.set_rumble(true)   （加速微抖开）
## - game over：GameState._finish 先终结加速（speed_changed false → 微抖关），
##   再沿状态边沿发 state_changed(GAME_OVER) → camera.request_terminal_shake()
##   （内部忽略重复请求 ⇒ 精确单次），结束后 offset 精确归零。
## 业务代码不出现任何晃动幅度/频率魔数 —— 一律取自 GameState.SHAKE_CONFIG。

const PICKUP_SCENE: PackedScene = preload("res://scenes/pickup.tscn")
const OBSTACLE_SCENE: PackedScene = preload("res://scenes/obstacle.tscn")

const TITLE_TEXT: String = "复现天天酷跑（平台已部署的游戏，接入大陆）；再言：在这个版本"

## 实体出生线（视口右缘外）。
const SPAWN_X: float = 680.0
## 障碍出生间隔下限/上限（秒）。
const OBSTACLE_GAP_S: Vector2 = Vector2(1.2, 2.0)
## 首个实体前的缓冲（秒），给玩家起步反应时间。
const FIRST_SPAWN_DELAY_S: float = 1.2
## 金币弧线：4 枚、高度对齐跳跃弧。
const COIN_ARC_HEIGHTS: Array[float] = [250.0, 225.0, 225.0, 250.0]
const COIN_ARC_STEP_PX: float = 34.0
const BOOST_Y: float = 250.0
const OBSTACLE_Y: float = 272.0
## 加速星出现概率（其余为金币弧 / 障碍交替）。
const BOOST_CHANCE: float = 0.25

@onready var player: Player = $Player
@onready var entities: Node2D = $Entities
@onready var camera: ScreenShake = $GameCamera
@onready var hud_label: Label = %HudLabel
@onready var center_message: Label = %CenterMessage
@onready var touch_ui: CanvasLayer = $TouchUI

var _spawn_timer_s: float = FIRST_SPAWN_DELAY_S
var _next_is_obstacle: bool = false
var _rng := RandomNumberGenerator.new()


func _ready() -> void:
	_rng.seed = 20261002  # 门禁要求可复现：固定种子的实体序列
	if DisplayServer.is_touchscreen_available():
		touch_ui.visible = true
	# 信号连接：订阅方（本场景）写连接代码，发布方只 emit。
	GameState.score_changed.connect(_on_score_changed)
	GameState.distance_changed.connect(_on_distance_changed)
	GameState.speed_changed.connect(_on_speed_changed)
	GameState.state_changed.connect(_on_state_changed)
	_show_state_message()
	_update_hud()


func _process(delta: float) -> void:
	if GameState.state != GameState.State.RUNNING:
		return
	GameState.tick_run(delta)
	_spawn_timer_s -= delta
	if _spawn_timer_s <= 0.0:
		_spawn_wave()
		_spawn_timer_s = _rng.randf_range(OBSTACLE_GAP_S.x, OBSTACLE_GAP_S.y)


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("confirm") and GameState.state != GameState.State.RUNNING:
		start_run()


## 开始/重开一局：清场、归位、状态切 RUNNING。
func start_run() -> void:
	camera.settle()  # 重开即刻静止：清掉可能仍在收尾的终局晃动
	_clear_entities()
	player.reset()
	_rng.seed = 20261002
	_spawn_timer_s = FIRST_SPAWN_DELAY_S
	_next_is_obstacle = false
	GameState.start_run()


## 供生成器与冒烟断言共用的出生接口。
func spawn_pickup_at(kind: String, pos: Vector2) -> Pickup:
	var pickup: Pickup = PICKUP_SCENE.instantiate()
	pickup.kind = kind
	entities.add_child(pickup)
	pickup.position = pos
	pickup.picked_up.connect(_on_picked_up)
	return pickup


func spawn_obstacle_at(pos: Vector2) -> Obstacle:
	var obstacle: Obstacle = OBSTACLE_SCENE.instantiate()
	entities.add_child(obstacle)
	obstacle.position = pos
	obstacle.hit_player.connect(_on_hit_player)
	return obstacle


func _spawn_wave() -> void:
	var roll := _rng.randf()
	if roll < BOOST_CHANCE:
		spawn_pickup_at("boost", Vector2(SPAWN_X, BOOST_Y))
		_next_is_obstacle = false
		return
	if _next_is_obstacle:
		spawn_obstacle_at(Vector2(SPAWN_X, OBSTACLE_Y))
	else:
		_spawn_coin_arc()
	_next_is_obstacle = not _next_is_obstacle


func _spawn_coin_arc() -> void:
	for i: int in COIN_ARC_HEIGHTS.size():
		spawn_pickup_at(
			"coin",
			Vector2(SPAWN_X + float(i) * COIN_ARC_STEP_PX, COIN_ARC_HEIGHTS[i]),
		)


func _clear_entities() -> void:
	for child in entities.get_children():
		child.queue_free()


## ── 信号订阅 ────────────────────────────────────────────────

func _on_state_changed(new_state: GameState.State, _old_state: GameState.State) -> void:
	# 终局单晃：只在进入 GAME_OVER 的状态边沿请求一次；加速微抖已被先行关闭（见 _finish）。
	if new_state == GameState.State.GAME_OVER:
		camera.request_terminal_shake()
	elif new_state == GameState.State.WIN:
		camera.set_rumble(false)
	_show_state_message()
	_update_hud()


func _on_speed_changed(_multiplier: float, active: bool) -> void:
	# 加速微抖仅在局内生效；game over/通关时 active 已为 false。
	camera.set_rumble(active and GameState.state == GameState.State.RUNNING)
	_update_hud()


func _on_picked_up(pickup: Pickup) -> void:
	if pickup.kind == "boost":
		GameState.start_speeding()
	else:
		GameState.add_score(GameState.COIN_SCORE)
	pickup.queue_free()


func _on_hit_player(_obstacle: Obstacle) -> void:
	GameState.trigger_game_over()


func _on_score_changed(_score: int) -> void:
	_update_hud()


func _on_distance_changed(_distance_m: float) -> void:
	_update_hud()


## ── HUD / 文案 ──────────────────────────────────────────────

func _show_state_message() -> void:
	match GameState.state:
		GameState.State.READY:
			center_message.text = "%s\n按 回车 / 空格 开始" % TITLE_TEXT
			center_message.visible = true
		GameState.State.GAME_OVER:
			center_message.text = "游戏结束 · 得分 %d · 距离 %dm\n按 回车 / 空格 重开" % [
				GameState.score, int(GameState.distance_m),
			]
			center_message.visible = true
		GameState.State.WIN:
			center_message.text = "通关！得分 %d · 距离 %dm\n按 回车 / 空格 再来一局" % [
				GameState.score, int(GameState.distance_m),
			]
			center_message.visible = true
		GameState.State.RUNNING:
			center_message.visible = false


func _update_hud() -> void:
	var speed_mark := " · 加速中!" if GameState.is_speeding() else ""
	hud_label.text = "得分 %d · 距离 %dm · 速度 x%.1f%s" % [
		GameState.score, int(GameState.distance_m), GameState.speed_multiplier, speed_mark,
	]
