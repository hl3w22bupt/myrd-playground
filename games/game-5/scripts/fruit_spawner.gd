class_name FruitSpawner
extends Node2D
## 水果供给：初始铺场 + 存量下限补货（知识 6e91a11d §二）。
##
## - 初始 8~12 个（随机），保证开局视野内有可收目标；
## - 场上存量 < 6 时，每 0.8~1.5 秒补 1 个 —— 补货计时器与原木生成计时器独立，不共用；
## - 落点约束：与边缘保持内边距、不与原木瞬时位置重叠、与上一落点距离 ≥ 1.5 个水果直径。

signal fruit_collected(fruit: Fruit)

const FRUIT_SCENE: PackedScene = preload("res://scenes/fruit.tscn")

const INITIAL_COUNT_MIN: int = 8
const INITIAL_COUNT_MAX: int = 12
const STOCK_FLOOR: int = 6
const RESTOCK_INTERVAL_MIN: float = 0.8
const RESTOCK_INTERVAL_MAX: float = 1.5
## 与场景边缘的内边距（≥ 半个角色，保证 clamp 后仍可收取）。
const EDGE_PADDING: float = 40.0
## 与上一落点的最小距离（1.5 × 水果直径 24 = 36，防「原地连收」白送连击）。
const MIN_SPAWN_DISTANCE: float = 36.0
## 与原木瞬时位置的最小净距（原木半长 + 水果半径）。
const LOG_CLEARANCE: float = 60.0

var _rng := RandomNumberGenerator.new()
var _last_spawn_pos: Vector2 = Vector2.ZERO
var _running: bool = false

@onready var _restock_timer: Timer = $RestockTimer


func _ready() -> void:
	_restock_timer.timeout.connect(_on_restock_timer_timeout)


## 开局：确定性种子（冒烟/试玩可复现），铺初始场并启动补货计时。
func start_match(seed_value: int) -> void:
	stop_match()
	for child in get_children():
		if child is Fruit:
			child.queue_free()
	_rng.seed = seed_value
	var initial: int = _rng.randi_range(INITIAL_COUNT_MIN, INITIAL_COUNT_MAX)
	for i: int in range(initial):
		_spawn_fruit()
	_running = true
	_restock_timer.start(_random_restock_interval())


## 结算：停止补货（场上水果定格，不消失）。
func stop_match() -> void:
	_running = false
	_restock_timer.stop()


## 场上存活水果数（queue_free 尚未生效的本帧仍可能计入，断言留容差）。
func fruit_count() -> int:
	var count: int = 0
	for child in get_children():
		if child is Fruit and not child.is_queued_for_deletion():
			count += 1
	return count


func _random_restock_interval() -> float:
	return _rng.randf_range(RESTOCK_INTERVAL_MIN, RESTOCK_INTERVAL_MAX)


func _on_restock_timer_timeout() -> void:
	if _running and fruit_count() < STOCK_FLOOR:
		_spawn_fruit()
	_restock_timer.start(_random_restock_interval())


func _spawn_fruit() -> void:
	var fruit: Fruit = FRUIT_SCENE.instantiate()
	fruit.kind = _rng.randi_range(0, 1)
	fruit.position = _pick_spawn_position()
	_last_spawn_pos = fruit.position
	fruit.collected.connect(_on_fruit_collected)
	add_child(fruit)


## 落点：随机 + 三重约束（边缘内边距 / 避开原木瞬时位置 / 离上一落点不过近）。
## 尝试 20 次取第一个合规点；全部失败则取最后一次尝试点（不阻塞局内节奏）。
func _pick_spawn_position() -> Vector2:
	var bounds := get_viewport_rect().size
	var logs := get_tree().get_nodes_in_group("logs")
	var pos := Vector2.ZERO
	for attempt: int in range(20):
		pos = Vector2(
			_rng.randf_range(EDGE_PADDING, bounds.x - EDGE_PADDING),
			_rng.randf_range(EDGE_PADDING, bounds.y - EDGE_PADDING))
		if pos.distance_to(_last_spawn_pos) < MIN_SPAWN_DISTANCE and attempt < 19:
			continue
		var overlaps_log := false
		for log_node in logs:
			if log_node is Node2D and (log_node as Node2D).position.distance_to(pos) < LOG_CLEARANCE:
				overlaps_log = true
				break
		if overlaps_log and attempt < 19:
			continue
		break
	return pos


func _on_fruit_collected(fruit: Fruit) -> void:
	fruit_collected.emit(fruit)
