class_name TrackPassabilityContract
extends RefCounted
## acc-03 赛道可通行性契约（无必死的机器判据，策划案 §3.3 + §四）：
##   A. 布局硬约束逐 chunk 机判（坑宽/落地缓冲/威胁间距/chunk 安全区/平台可达/低飞怪包络）；
##   B. 10 个固定种子（1..10）机器人实跑 ≥1000m：按 spec 权重生成 chunk 序列，
##      拼接全局威胁时间轴，逐威胁验证「决策窗 ≥ 输入预算」「坑宽 < 当地速度单跳距离」
##      「坑后落地缓冲」—— 任何一条不满足即判定该种子出现不可通过组合。
## 判定与真实物理同源：速度/跳跃全部读 GameState 调参区常量，非独立魔法数。

## 机器人最小决策窗（秒）：输入延迟 3 帧(0.05s) + 跳跃缓冲(0.1s) + 观察裕度。
const MIN_DECISION_WINDOW: float = 0.2
## 坑宽 < 单跳水平距离 × 该安全系数（跳跃起跳点误差裕度）。
const PIT_JUMP_SAFETY: float = 0.9


static func run() -> PackedStringArray:
	var failures: PackedStringArray = []
	for failure: String in ChunkDefs.check_layout_constraints():
		failures.append("布局约束：%s" % failure)
	for failure: String in ChunkDefs.check_air_obstacle_envelope():
		failures.append("低飞怪包络：%s" % failure)
	var seeds: int = int(GameState.tuning_value(&"passabilitySampleSeeds"))
	for seed_value: int in range(1, seeds + 1):
		_simulate_seed(seed_value, failures)
	return failures


## 单种子机器人判定：生成 chunk 序列 → 全局威胁时间轴 → 逐项可行性。
static func _simulate_seed(seed_value: int, failures: PackedStringArray) -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_value
	var chunk_w: float = GameState.tuning_value(&"chunkWidthPx")
	var ppm: float = GameState.tuning_value(&"pixelsPerMeter")
	var cells: int = int(ceil(GameState.tuning_value(&"acceptanceDistanceMeters") * ppm / chunk_w)) + 1
	var threats: Array[Dictionary] = []
	for cell: int in cells:
		var distance_m: float = float(cell) * chunk_w / ppm
		var level_id: StringName = ChunkDefs.pick_level_id(
			GameState.chunk_weights_for_distance(distance_m), rng)
		var level: Dictionary = ChunkDefs.get_level(level_id)
		if level.is_empty():
			failures.append("种子 %d：第 %d 格抽到未知 chunk %s" % [seed_value, cell, level_id])
			return
		for point: Dictionary in ChunkDefs.threat_points(level):
			threats.append({
				"id": point["id"], "type": point["type"],
				"left": point["left"] + float(cell) * chunk_w,
				"right": point["right"] + float(cell) * chunk_w,
				"center": point["center"] + float(cell) * chunk_w,
			})
	threats.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return a["center"] < b["center"])

	var gap_min: float = GameState.tuning_value(&"reactionGapMinPx")
	var buffer_min: float = GameState.tuning_value(&"pitLandingBufferPx")
	for i: int in threats.size() - 1:
		var current: Dictionary = threats[i]
		var next: Dictionary = threats[i + 1]
		var gap: float = next["center"] - current["center"]
		# 相邻威胁点间距（决策距离）在任意速度下都要给出 ≥ MIN_DECISION_WINDOW 的时间窗。
		var local_speed: float = GameState.speed_for_distance(next["center"] / ppm)
		if gap < gap_min - 0.5:
			failures.append("种子 %d：%s→%s 威胁中心距 %.0f < %.0f（必死组合）" % [
				seed_value, current["id"], next["id"], gap, gap_min,
			])
		elif gap / local_speed < MIN_DECISION_WINDOW:
			failures.append("种子 %d：%s→%s 决策窗 %.2fs < %.2fs（速度 %.0f 下反应不及）" % [
				seed_value, current["id"], next["id"], gap / local_speed,
				MIN_DECISION_WINDOW, local_speed,
			])
		# 坑右沿到下一威胁点的落地缓冲（跨 chunk 拼接同样生效）。
		# 口径与策划案 §四算术一致：威胁点取中心（l3：e3 中心 500 − e2 坑右沿 372 = 128）。
		if current["type"] == &"pit":
			var landing: float = next["center"] - current["right"]
			if landing < buffer_min - 0.5:
				failures.append("种子 %d：%s 坑沿到 %s 落地缓冲 %.0f < %.0f" % [
					seed_value, current["id"], next["id"], landing, buffer_min,
				])
	# 每个坑：坑宽必须小于当地速度的单跳水平距离（起跳点留 PIT_JUMP_SAFETY 裕度）。
	var gravity: float = GameState.tuning_value(&"gravityPxPerSec2")
	var jump_v: float = absf(GameState.tuning_value(&"jumpVelocityPxPerSec"))
	var airtime: float = 2.0 * jump_v / gravity
	for threat: Dictionary in threats:
		if threat["type"] != &"pit":
			continue
		var pit_width: float = threat["right"] - threat["left"]
		var local_speed: float = GameState.speed_for_distance(threat["center"] / ppm)
		var jump_range: float = local_speed * airtime * PIT_JUMP_SAFETY
		if pit_width >= jump_range:
			failures.append("种子 %d：%s 坑宽 %.0f ≥ 当地单跳距离 %.0f（速度 %.0f × 滞空 %.2fs × %.2f）" % [
				seed_value, threat["id"], pit_width, jump_range, local_speed, airtime, PIT_JUMP_SAFETY,
			])
