class_name TrackBuilder
extends Node2D
## 赛道生成器（spec entity: track-builder）：按距离难度权重从 chunk 池抽取预制件、
## 循环回收（对象池，策划案 §七.5），只实例化 levels 声明的 3 个 chunk 场景。
##
## 池设计：每种 chunk 预建 POOL_PER_LEVEL 个实例（只 build 一次，之后纯复用）；
## 铺设时按当前距离的权重抽 chunk 种类，回收「玩家身后」的实例挪到最前并复位。
## 活跃窗口 = 玩家当前格 .. 前方 CHUNKS_AHEAD 格；回收条件 = 格号 ≤ current−1
##（完全在身后），保证玩家脚下与前方永远有地面 —— 任何情况下不缺格（不缺格优先于种类）。
## 权重（策划案 §四）：l1 = 1.0 − d/1000（下限 0.55）；l2 = clamp((d−300)/700)×0.8；
## l3 = clamp((d−1200)/800)。若抽中的种类暂无可回收实例，退化为全池最旧实例兜底。

## 玩家前方保证已铺设的格数（当前格之外）。
const CHUNKS_AHEAD: int = 2
## 每种 chunk 的实例数（3 种 × 3 = 9 实例；活跃窗口 3 格 + 按种类自由轮转余量）。
const POOL_PER_LEVEL: int = 3

## 未铺设实例的停车位（屏幕外，避免悬空渲染与误碰撞）。
const PARK_POSITION: Vector2 = Vector2(-100000.0, -5000.0)

## chunk 场景池（spec levels 声明的 3 个场景，禁止增删 —— 施工红线 3）。
const CHUNK_SCENES: Dictionary = {
	&"l1": "res://scenes/chunks/chunk_candy_street.tscn",
	&"l2": "res://scenes/chunks/chunk_dusk_rooftop.tscn",
	&"l3": "res://scenes/chunks/chunk_night_highway.tscn",
}

## 种类 → 实例列表。
var _pool: Dictionary = {}
## 实例 → 当前世界格号（-1 = 从未铺设）。
var _cell_of: Dictionary = {}
## 已铺设到的最前格号（下一格）。
var _front_cell: int = 0
## 抽取随机源（每次重开按 run 种子重置，保证同种子同赛道）。
var _rng := RandomNumberGenerator.new()


func _physics_process(_delta: float) -> void:
	if _pool.is_empty():
		return
	var player: Player = get_tree().get_first_node_in_group(&"player") as Player
	if player == null:
		return
	var current_cell: int = int(floor(player.global_position.x / GameState.tuning_value(&"chunkWidthPx")))
	# 单帧最多铺 2 格（正常推进每格一次；防远距离瞬移时尖峰）。
	for _i: int in 2:
		if _front_cell < current_cell + 1 + CHUNKS_AHEAD:
			_lay_cell(current_cell)
		else:
			break


## 重开：按种子重置抽取序列并从 0 号格重新铺设（实例只复位不重建）。
func reset_run(seed_value: int) -> void:
	_rng.seed = seed_value
	_cell_of.clear()
	if _pool.is_empty():
		for id: StringName in CHUNK_SCENES.keys():
			var instances: Array[ChunkBase] = []
			for i: int in POOL_PER_LEVEL:
				var chunk: ChunkBase = (load(CHUNK_SCENES[id]) as PackedScene).instantiate()
				chunk.position = PARK_POSITION
				add_child(chunk)
				instances.append(chunk)
			_pool[id] = instances
	_front_cell = 0
	# 初始铺设到「当前格(0) + CHUNKS_AHEAD」窗口铺满为止。
	var laid: int = 0
	while _front_cell < 1 + CHUNKS_AHEAD and laid < POOL_PER_LEVEL * 3:
		_lay_cell(0)
		laid += 1


## 铺设下一格：按权重抽种类 → 取该种类中可回收（身后）的最旧实例；
## 该种类暂无可回收实例时退化全池兜底 —— 地面完整性优先于种类序列。
func _lay_cell(current_cell: int) -> void:
	var kind: StringName = _pick_chunk_id()
	var chunk: ChunkBase = _recyclable_of_kind(kind, current_cell)
	if chunk == null:
		chunk = _oldest_any()
	_cell_of[chunk] = _front_cell
	chunk.position = Vector2(float(_front_cell) * GameState.tuning_value(&"chunkWidthPx"), GameState.GROUND_LINE_Y)
	chunk.reset_chunk()
	# 道具种类每次铺设都按局种子重掷（迭代需求 ①：磁吸/冲刺按可感知概率进生成池，
	# 不再被首次 build 的随机锁死整局；同种子同赛道同道具序列，冒烟可复现）。
	chunk.reroll_powerups(_rng)
	_front_cell += 1


func _recyclable_of_kind(kind: StringName, current_cell: int) -> ChunkBase:
	var candidates: Array[ChunkBase] = _pool.get(kind, [])
	var best: ChunkBase = null
	var best_cell: int = 1 << 30
	for instance: ChunkBase in candidates:
		var cell: int = int(_cell_of.get(instance, -1))
		if (cell < 0 or cell <= current_cell - 1) and cell < best_cell:
			best = instance
			best_cell = cell
	return best


func _oldest_any() -> ChunkBase:
	var best: ChunkBase = null
	var best_cell: int = 1 << 30
	for kind: StringName in _pool.keys():
		for instance: ChunkBase in _pool[kind]:
			var cell: int = int(_cell_of.get(instance, -1))
			if cell < best_cell:
				best = instance
				best_cell = cell
	return best


## 按当前距离权重抽 chunk 种类（策划案 §四权重规则）。
func _pick_chunk_id() -> StringName:
	var weights: Dictionary = GameState.chunk_weights_for_distance(GameState.distance_m)
	return ChunkDefs.pick_level_id(weights, _rng)
