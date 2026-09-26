class_name LogSpawner
extends Node2D
## 原木生成器：2~4 秒随机间隔，从场景一侧横向滚入；速度随「剩余时间」递增
## （v(t) = lerp(v1, v0, timeLeft / 60)，v1 = 1.8 × v0 —— 知识 6e91a11d §四）。
##
## 与 FruitSpawner 的补货计时完全独立（独立 Timer + 独立 RNG 流），
## 防止「水果集中重生在原木路径上」的连锁死局。

signal log_hit_player

const LOG_SCENE: PackedScene = preload("res://scenes/log_roller.tscn")

## 生成间隔 [2, 4) 秒（需求硬性口径）。
const SPAWN_INTERVAL_MIN: float = 2.0
const SPAWN_INTERVAL_MAX: float = 4.0
## 开局速度 v0；终局速度 v1 = SPEED_START × SPEED_END_FACTOR。
const SPEED_START: float = 120.0
const SPEED_END_FACTOR: float = 1.8
## 竖直落点带（避开上下边缘）。
const EDGE_PADDING: float = 48.0
## 同侧相邻两根原木的最小轨距（≥ 1 个原木长度，保留可穿越缝隙）。
const MIN_TRACK_GAP: float = 100.0

var _rng := RandomNumberGenerator.new()
var _running: bool = false
var _last_side: int = 0
var _last_track_y: float = -1000.0

## 当前剩余时间：由 Main 每物理帧下发（生成速度按此递增），冒烟可直设后调 spawn_now。
var time_left: float = GameState.MATCH_SECONDS

@onready var _spawn_timer: Timer = $SpawnTimer


func _ready() -> void:
	_spawn_timer.timeout.connect(_on_spawn_timer_timeout)


## 开局：确定性种子，立即起计时（第一根原木 2~4 秒后入场，给玩家热身窗口）。
func start_match(seed_value: int) -> void:
	stop_match()
	for child in get_children():
		if child is LogRoller:
			child.queue_free()
	_rng.seed = seed_value
	_last_side = 0
	_last_track_y = -1000.0
	_running = true
	_spawn_timer.start(_random_spawn_interval())


func stop_match() -> void:
	_running = false
	_spawn_timer.stop()


## 结算时定格场上原木（停止滚动）。
func freeze_logs() -> void:
	for log_node in get_tree().get_nodes_in_group("logs"):
		if log_node is LogRoller:
			(log_node as LogRoller).stop_rolling()


## 速度公式（纯函数，冒烟直测端点与单调性）。
func speed_for(time_left: float) -> float:
	var ratio: float = clampf(time_left / GameState.MATCH_SECONDS, 0.0, 1.0)
	return lerpf(SPEED_START * SPEED_END_FACTOR, SPEED_START, ratio)


## 立即生成一根原木并重排下一次计时（冒烟白盒断言用；正常运行走 _on_spawn_timer_timeout）。
func spawn_now(time_left: float) -> LogRoller:
	var log_roller := _spawn_log(time_left)
	_spawn_timer.start(_random_spawn_interval())
	return log_roller


func _random_spawn_interval() -> float:
	return _rng.randf_range(SPAWN_INTERVAL_MIN, SPAWN_INTERVAL_MAX)


func _on_spawn_timer_timeout() -> void:
	if _running:
		_spawn_log(-1.0)
	_spawn_timer.start(_random_spawn_interval())


func _spawn_log(time_left: float) -> LogRoller:
	var bounds := get_viewport_rect().size
	var side: int = _rng.randi_range(0, 1)
	var log_roller: LogRoller = LOG_SCENE.instantiate()
	log_roller.speed = speed_for(time_left if time_left >= 0.0 else self.time_left)
	log_roller.direction = 1 if side == 0 else -1
	log_roller.position = Vector2(
		-100.0 if side == 0 else bounds.x + 100.0,
		_pick_track_y(side, bounds))
	_last_side = side
	_last_track_y = log_roller.position.y
	log_roller.add_to_group("logs")
	log_roller.hit_player.connect(_on_log_hit_player)
	add_child(log_roller)
	return log_roller


## 竖直落点：随机带内取点；与上一根同侧时保持 ≥ MIN_TRACK_GAP（防同轨紧贴封死缝隙）。
func _pick_track_y(side: int, bounds: Vector2) -> float:
	var y := _rng.randf_range(EDGE_PADDING, bounds.y - EDGE_PADDING)
	if side == _last_side and absf(y - _last_track_y) < MIN_TRACK_GAP:
		var shifted := _last_track_y + (MIN_TRACK_GAP if y >= _last_track_y else -MIN_TRACK_GAP)
		y = clampf(shifted, EDGE_PADDING, bounds.y - EDGE_PADDING)
	return y


func _on_log_hit_player() -> void:
	log_hit_player.emit()
