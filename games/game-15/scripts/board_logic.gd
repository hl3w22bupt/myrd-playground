class_name BoardLogic
extends RefCounted
## 连连看纯规则层（无节点依赖，可无头单测）：
## - 连通判定：经典 ≤2 拐点（0 拐点直线 / 1 拐点直角 / 2 拐点双转角），
##   路径限定在棋盘网格内（边界即障碍），中间格必须为空。
## - 生成：逆向放置法 —— 逐对随机落子且要求「落子时两格连通」，
##   消除顺序取放置顺序的逆序，天然保证整局可解。
## - 洗牌：保持车种多重集不变，仅在剩余图块位置间重排，并要求重排后仍可解。

const EMPTY: int = -1
## 连通判定的最大拐点数（需求钉死为 2）。
const MAX_TURNS: int = 2
## 四方向（右 / 下 / 左 / 上）。
const DIRS: Array[Vector2i] = [Vector2i(1, 0), Vector2i(0, 1), Vector2i(-1, 0), Vector2i(0, -1)]


static func in_bounds(w: int, h: int, cell: Vector2i) -> bool:
	return cell.x >= 0 and cell.x < w and cell.y >= 0 and cell.y < h


static func cell_index(w: int, cell: Vector2i) -> int:
	return cell.y * w + cell.x


static func type_at(w: int, cells: PackedInt32Array, cell: Vector2i) -> int:
	if not in_bounds(w, cells.size() / w, cell):
		return EMPTY
	return cells[cell_index(w, cell)]


## BFS 连通判定：返回完整格路径（含两端），不可连通返回空数组。
## allow_empty_endpoints=true 供生成期使用（两枚棋子尚未落位，端点当前为空格）。
static func find_path(w: int, h: int, cells: PackedInt32Array, a: Vector2i, b: Vector2i,
		allow_empty_endpoints: bool = false) -> Array[Vector2i]:
	var path: Array[Vector2i] = []
	if a == b or not in_bounds(w, h, a) or not in_bounds(w, h, b):
		return path
	var a_type: int = cells[cell_index(w, a)]
	var b_type: int = cells[cell_index(w, b)]
	if a_type == EMPTY or b_type == EMPTY:
		if not allow_empty_endpoints:
			return path
	if a_type != b_type:
		return path
	# 状态 = (格, 进入方向, 已用拐点数)；值 = 走到该状态的格路径。
	var queue: Array = []
	var visited: Dictionary = {}
	for dir in DIRS.size():
		var key := _state_key(a, dir, 0)
		visited[key] = true
		queue.append([a, dir, 0, [a]])
	while not queue.is_empty():
		var state: Array = queue.pop_front()
		var cell: Vector2i = state[0]
		var dir: int = state[1]
		var turns: int = state[2]
		var cell_path: Array = state[3]
		# 直行一格（不增加拐点）。
		var next: Vector2i = cell + DIRS[dir]
		if in_bounds(w, h, next):
			if next == b:
				var result: Array[Vector2i] = []
				for step in cell_path:
					result.append(step)
				result.append(b)
				return result
			var next_idx: int = cell_index(w, next)
			if next != a and cells[next_idx] == EMPTY:
				var straight_key := _state_key(next, dir, turns)
				if not visited.has(straight_key):
					visited[straight_key] = true
					queue.append([next, dir, turns, cell_path + [next]])
		# 在当前格转向（消耗 1 个拐点；起点已按 4 方向初始化，无需原地转向）。
		if cell != a and turns < MAX_TURNS:
			for ndir in DIRS.size():
				if ndir == dir:
					continue
				var turn_key := _state_key(cell, ndir, turns + 1)
				if not visited.has(turn_key):
					visited[turn_key] = true
					queue.append([cell, ndir, turns + 1, cell_path])
	return path


## 收集当前棋盘全部可连通的同车种对（提示 / 死局检测共用）。
static func collect_connectable_pairs(w: int, h: int, cells: PackedInt32Array) -> Array:
	var by_type: Dictionary = {}
	for idx in cells.size():
		if cells[idx] != EMPTY:
			var type_id: int = cells[idx]
			if not by_type.has(type_id):
				by_type[type_id] = []
			by_type[type_id].append(Vector2i(idx % w, idx / w))
	var pairs: Array = []
	for type_id in by_type:
		var group: Array = by_type[type_id]
		for i in group.size():
			for j in range(i + 1, group.size()):
				if not find_path(w, h, cells, group[i], group[j]).is_empty():
					pairs.append([group[i], group[j]])
	return pairs


## 贪心可解判定：反复消除任一可连对直到清空（生成自保证可解，这里用于洗牌校验与冒烟）。
static func is_greedy_solvable(w: int, h: int, cells: PackedInt32Array) -> bool:
	var work := PackedInt32Array(cells)
	while true:
		var pairs: Array = collect_connectable_pairs(w, h, work)
		if pairs.is_empty():
			break
		for cell in pairs[0]:
			work[cell_index(w, cell)] = EMPTY
	for idx in work.size():
		if work[idx] != EMPTY:
			return false
	return true


## 逆向放置生成整局可解棋盘（w*h 须为偶数；type_count ≤ 对数）。
static func generate(w: int, h: int, type_count: int, rng: RandomNumberGenerator) -> PackedInt32Array:
	var total_pairs: int = w * h / 2
	var type_sequence: Array = []
	for i in total_pairs:
		type_sequence.append(i % type_count)
	_shuffle_array(type_sequence, rng)
	for attempt in 8:
		var cells := PackedInt32Array()
		cells.resize(w * h)
		cells.fill(EMPTY)
		var placed_all := true
		for type_id in type_sequence:
			if not _place_pair(w, h, cells, type_id, rng):
				placed_all = false
				break
		if placed_all:
			return cells
	# 逆向放置连续失败（概率极低）→ 退回随机填充（可解性由调用方 is_greedy_solvable 校验兜底）。
	var fallback := PackedInt32Array()
	fallback.resize(w * h)
	var types: Array = []
	for i in total_pairs:
		types.append(i % type_count)
		types.append(i % type_count)
	_shuffle_array(types, rng)
	for idx in fallback.size():
		fallback[idx] = types[idx]
	return fallback


## 在当前空格上为一对新车种找两个「连通可达」的格子落子；成功返回 true。
static func _place_pair(w: int, h: int, cells: PackedInt32Array, type_id: int, rng: RandomNumberGenerator) -> bool:
	var empty_cells: Array = []
	for idx in cells.size():
		if cells[idx] == EMPTY:
			empty_cells.append(Vector2i(idx % w, idx / w))
	if empty_cells.size() < 2:
		return false
	for attempt in 60:
		var i: int = rng.randi_range(0, empty_cells.size() - 1)
		var j: int = rng.randi_range(0, empty_cells.size() - 1)
		if i == j:
			continue
		var a: Vector2i = empty_cells[i]
		var b: Vector2i = empty_cells[j]
		if find_path(w, h, cells, a, b, true).is_empty():
			continue
		cells[cell_index(w, a)] = type_id
		cells[cell_index(w, b)] = type_id
		return true
	return false


## 洗牌：保持剩余图块的车种多重集不变，仅随机重排到剩余位置；返回重排后的棋盘。
static func shuffle_types(w: int, h: int, cells: PackedInt32Array, rng: RandomNumberGenerator) -> PackedInt32Array:
	var shuffled := PackedInt32Array(cells)
	var occupied: Array = []
	var types: Array = []
	for idx in shuffled.size():
		if shuffled[idx] != EMPTY:
			occupied.append(idx)
			types.append(shuffled[idx])
	_shuffle_array(types, rng)
	for i in occupied.size():
		shuffled[occupied[i]] = types[i]
	return shuffled


static func _shuffle_array(array: Array, rng: RandomNumberGenerator) -> void:
	for i in range(array.size() - 1, 0, -1):
		var j: int = rng.randi_range(0, i)
		var tmp = array[i]
		array[i] = array[j]
		array[j] = tmp


static func _state_key(cell: Vector2i, dir: int, turns: int) -> int:
	return (cell.y * 64 + cell.x) * 32 + dir * 8 + turns
