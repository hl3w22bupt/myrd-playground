class_name PowerupPoolContract
extends RefCounted
## 道具生成池契约（迭代需求 ① 的根因修复机判）：
## 上一版缺陷 = build 时 randi()%3 定死种类 + 对象池不复位 → 磁吸/冲刺整局可能不出现。
## 本契约钉死四件事：
##   1. 权重配置存在且可复核：键集 = 三道具、权重和 = 1.0、磁铁/冲刺权重 ≥ 0.30；
##   2. seeded 分布：固定种子抽 300 次，磁铁/冲刺均以可感知频率出现（各 ≥ 60 次）；
##   3. 池化重掷：同一个 PickupBox 实例反复 reroll 能在三种类间变化（不再锁死）；
##   4. chunk 级接线：chunk 场景 reroll_powerups(rng) 后场上道具种类落在合法集合。

## ctx 键：root（挂测试实例的节点，冒烟场景根）。
static func run(ctx: Dictionary = {}) -> PackedStringArray:
	var failures: PackedStringArray = []
	var root: Node = ctx.get("root", null)
	var weights: Dictionary = GameState.POWERUP_KIND_WEIGHTS

	# 1. 权重配置可复核。
	var expected: Array[StringName] = [&"magnet", &"shield", &"dash"]
	for kind: StringName in expected:
		if not weights.has(kind):
			failures.append("生成权重缺 %s（可复核配置不完整）" % kind)
	var total: float = 0.0
	for value: Variant in weights.values():
		total += float(value)
	if absf(total - 1.0) > 0.001:
		failures.append("生成权重和 %.3f ≠ 1.0" % total)
	for required: StringName in [&"magnet", &"dash"]:
		if float(weights.get(required, 0.0)) < 0.30:
			failures.append("%s 权重 %.2f < 0.30（可感知概率不达标）" % [
				required, float(weights.get(required, 0.0)),
			])

	# 2. seeded 分布：同种子同序列；磁铁/冲刺都要高频出现。
	var rng := RandomNumberGenerator.new()
	rng.seed = 20260927
	var counts: Dictionary = {&"magnet": 0, &"shield": 0, &"dash": 0}
	for _i: int in 300:
		var kind: StringName = GameState.pick_powerup_kind(rng)
		if not counts.has(kind):
			failures.append("pick_powerup_kind 抽出非法种类 %s" % kind)
			break
		counts[kind] = int(counts[kind]) + 1
	if root != null:
		for counted: StringName in [&"magnet", &"dash"]:
			if int(counts[counted]) < 60:
				failures.append("seeded 分布：%s 300 抽仅 %d 次（<60，生成不可感知）" % [
					counted, int(counts[counted]),
				])
		# 3. 池化重掷：同一实例在三种类间可变（上一版「build 锁死整局」的负例探针）。
		var pickup: PickupBox = (load("res://scenes/powerup_magnet.tscn") as PackedScene).instantiate() as PickupBox
		root.add_child(pickup)
		var seen: Dictionary = {}
		for _i: int in 12:
			pickup.reroll_kind(GameState.pick_powerup_kind(rng))
			seen[pickup.kind] = true
		if seen.size() < 2:
			failures.append("同一道具盒 12 次重掷后种类无变化（池化重掷失效，种类仍会被锁死）")
		# 4. chunk 级接线：真实 chunk 场景重掷后道具种类合法。
		var chunk: ChunkBase = (load("res://scenes/chunks/chunk_candy_street.tscn") as PackedScene).instantiate() as ChunkBase
		root.add_child(chunk)
		chunk.reroll_powerups(rng)
		var found_pickup: bool = false
		for child in chunk.get_node("Entities").get_children():
			if child is PickupBox:
				found_pickup = true
				if not [&"magnet", &"shield", &"dash"].has((child as PickupBox).kind):
					failures.append("chunk 重掷后道具种类非法：%s" % (child as PickupBox).kind)
		if not found_pickup:
			failures.append("chunk 场景（l1）未找到道具盒：生成池接线断裂")
		pickup.queue_free()
		chunk.queue_free()
	else:
		failures.append("powerup_pool_contract 缺少 root 节点（无法做实例级断言）")
	return failures
