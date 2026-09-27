class_name ChunkDefs
extends RefCounted
## 赛道 chunk 元素表（spec levels 段的唯一代码落点，元素 id 与坐标逐项一致，
## 禁止私改 —— 契约测试 track_passability_contract 逐项机判）。
##
## 坐标约定（策划案 §三）：chunk 局部以左下角为原点、地面线 y=0、向上为正；
## x = 元素在 chunk 内的横向偏移（chunk 宽 chunkWidthPx=1280）。
## 可通行性由构造保证：威胁点布局满足 §3.3 四条硬约束（check_layout_constraints 机判）。

const TYPE_GROUND := &"ground"
const TYPE_POWERUP := &"powerup_box"
const TYPE_PIT := &"pit"
const TYPE_PLATFORM := &"platform"
const TYPE_COIN_ARC := &"coin_arc"
const TYPE_COIN_LINE := &"coin_line"
const TYPE_OBSTACLE_GROUND := &"obstacle_ground"
const TYPE_OBSTACLE_AIR := &"obstacle_air"

## 威胁类型集合（布局约束与机器人时间轴判定只关心这些）。
const THREAT_TYPES: Array[StringName] = [&"pit", &"obstacle_ground", &"obstacle_air"]

const LEVELS: Array[Dictionary] = [
	{
		"id": &"l1",
		"name": "糖果街区 · 新手段",
		"scene": "res://scenes/chunks/chunk_candy_street.tscn",
		"elements": [
			{"id": &"l1/e1", "type": TYPE_GROUND, "x": 0.0, "y": 0.0, "w": 1280.0},
			{"id": &"l1/e2", "type": TYPE_POWERUP, "x": 120.0, "y": 0.0},
			{"id": &"l1/e3", "type": TYPE_OBSTACLE_GROUND, "x": 560.0, "y": 0.0, "w": 64.0, "h": 56.0},
			{"id": &"l1/e4", "type": TYPE_COIN_ARC, "x": 680.0, "y": 60.0, "count": 5, "apex": 140.0},
			{"id": &"l1/e5", "type": TYPE_OBSTACLE_AIR, "x": 1040.0, "y": 96.0},
		],
	},
	{
		"id": &"l2",
		"name": "黄昏屋顶 · 提速段",
		"scene": "res://scenes/chunks/chunk_dusk_rooftop.tscn",
		"elements": [
			{"id": &"l2/e1", "type": TYPE_GROUND, "x": 0.0, "y": 0.0, "w": 1280.0},
			{"id": &"l2/e2", "type": TYPE_POWERUP, "x": 120.0, "y": 0.0},
			{"id": &"l2/e3", "type": TYPE_PIT, "x": 280.0, "y": 0.0, "w": 160.0},
			{"id": &"l2/e4", "type": TYPE_PLATFORM, "x": 520.0, "y": 150.0, "w": 240.0, "h": 24.0},
			{"id": &"l2/e5", "type": TYPE_COIN_ARC, "x": 540.0, "y": 200.0, "count": 5, "apex": 280.0},
			{"id": &"l2/e6", "type": TYPE_OBSTACLE_GROUND, "x": 900.0, "y": 0.0, "w": 64.0, "h": 56.0},
			{"id": &"l2/e7", "type": TYPE_OBSTACLE_AIR, "x": 1140.0, "y": 96.0},
		],
	},
	{
		"id": &"l3",
		"name": "夜色高速 · 高强度段",
		"scene": "res://scenes/chunks/chunk_night_highway.tscn",
		"elements": [
			{"id": &"l3/e1", "type": TYPE_GROUND, "x": 0.0, "y": 0.0, "w": 1280.0},
			{"id": &"l3/e2", "type": TYPE_PIT, "x": 180.0, "y": 0.0, "w": 192.0},
			{"id": &"l3/e3", "type": TYPE_OBSTACLE_GROUND, "x": 500.0, "y": 0.0, "w": 64.0, "h": 56.0},
			{"id": &"l3/e4", "type": TYPE_OBSTACLE_AIR, "x": 800.0, "y": 96.0},
			{"id": &"l3/e5", "type": TYPE_PIT, "x": 1024.0, "y": 0.0, "w": 160.0},
			{"id": &"l3/e6", "type": TYPE_COIN_LINE, "x": 1024.0, "y": 60.0, "count": 3},
		],
	},
]


static func get_level(id: StringName) -> Dictionary:
	for level: Dictionary in LEVELS:
		if level["id"] == id:
			return level
	return {}


## 按 spec 权重规则抽一个 chunk id（seeded rng 由调用方提供，保证可复现）。
static func pick_level_id(weights: Dictionary, rng: RandomNumberGenerator) -> StringName:
	var total: float = 0.0
	for id: StringName in [&"l1", &"l2", &"l3"]:
		total += maxf(float(weights.get(id, 0.0)), 0.0)
	if total <= 0.0:
		return &"l1"
	var roll: float = rng.randf() * total
	for id: StringName in [&"l1", &"l2", &"l3"]:
		roll -= maxf(float(weights.get(id, 0.0)), 0.0)
		if roll <= 0.0:
			return id
	return &"l3"


## 提取一个 chunk 的威胁点（pit 记左右沿与宽，obstacle 记中心与半宽）。
## 返回元素按 x 升序：{id, type, left, right, center}。
static func threat_points(level: Dictionary) -> Array[Dictionary]:
	var points: Array[Dictionary] = []
	for element: Dictionary in level["elements"]:
		var type: StringName = element["type"]
		if type == TYPE_PIT:
			points.append({
				"id": element["id"], "type": type,
				"left": element["x"], "right": element["x"] + element["w"],
				"center": element["x"] + element["w"] / 2.0,
			})
		elif type == TYPE_OBSTACLE_GROUND:
			var half_w: float = element["w"] / 2.0
			points.append({
				"id": element["id"], "type": type,
				"left": element["x"] - half_w, "right": element["x"] + half_w,
				"center": element["x"],
			})
		elif type == TYPE_OBSTACLE_AIR:
			# 飞行怪包络 56×88（见 obstacle_air.gd 推导），半宽 28。
			points.append({
				"id": element["id"], "type": type,
				"left": element["x"] - 28.0, "right": element["x"] + 28.0,
				"center": element["x"],
			})
	points.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return a["center"] < b["center"])
	return points


## 布局硬约束机判（acc-03 前半，策划案 §3.3 四条）：
## 1. 坑宽 ∈ [pitWidthMinPx, pitWidthMaxPx]；
## 2. 坑右沿到本 chunk 内下一威胁左沿 ≥ pitLandingBufferPx（落地缓冲）；
## 3. 相邻威胁点中心距 ≥ reactionGapMinPx（决策窗，跨 chunk 序列由调用方续查）；
## 4. 一切威胁不得进入 chunk 首尾 chunkSafetyMarginPx 安全区。
## 另机判两条可达性：平台顶 < 单跳高度；低飞怪盒「封站立、放滑铲」。
static func check_layout_constraints() -> PackedStringArray:
	var failures: PackedStringArray = []
	var chunk_w: float = GameState.tuning_value(&"chunkWidthPx")
	var margin: float = GameState.tuning_value(&"chunkSafetyMarginPx")
	var jump_height: float = _single_jump_height_px()
	for level: Dictionary in LEVELS:
		var lid: StringName = level["id"]
		var has_ground: bool = false
		for element: Dictionary in level["elements"]:
			if element["type"] == TYPE_GROUND:
				has_ground = true
				if element["w"] != chunk_w:
					failures.append("%s 地面宽 %s ≠ chunkWidthPx %s" % [element["id"], element["w"], chunk_w])
			elif element["type"] == TYPE_PIT:
				var pit_w: float = element["w"]
				if pit_w < GameState.tuning_value(&"pitWidthMinPx") or pit_w > GameState.tuning_value(&"pitWidthMaxPx"):
					failures.append("%s 坑宽 %.0f 越界 [%.0f, %.0f]" % [
						element["id"], pit_w,
						GameState.tuning_value(&"pitWidthMinPx"), GameState.tuning_value(&"pitWidthMaxPx"),
					])
				if element["x"] < margin or element["x"] + pit_w > chunk_w - margin:
					failures.append("%s 坑 [%0.f, %.0f] 侵入 chunk 首尾安全区 %.0f" % [
						element["id"], element["x"], element["x"] + pit_w, margin,
					])
			elif element["type"] == TYPE_OBSTACLE_GROUND:
				if element["x"] - element["w"] / 2.0 < margin or element["x"] + element["w"] / 2.0 > chunk_w - margin:
					failures.append("%s 地面怪侵入安全区" % element["id"])
			elif element["type"] == TYPE_OBSTACLE_AIR:
				if element["x"] - 28.0 < margin or element["x"] + 28.0 > chunk_w - margin:
					failures.append("%s 飞行怪侵入安全区" % element["id"])
			elif element["type"] == TYPE_PLATFORM:
				if element["y"] >= jump_height:
					failures.append("%s 平台顶 %.0f ≥ 单跳高度 %.1f，不可达" % [
						element["id"], element["y"], jump_height,
					])
		if not has_ground:
			failures.append("%s 缺少 ground 元素（坑洞必须由地面分段构成）" % lid)
		# 威胁间距：坑右沿 → 下一威胁左沿 ≥ pitLandingBuffer；中心距 ≥ reactionGapMin。
		# 落地缓冲口径与策划案 §四算术一致：威胁点取中心（l3：e3 中心 500 − e2 坑右沿 372 = 128）。
		var points: Array[Dictionary] = threat_points(level)
		for i: int in range(points.size() - 1):
			var current: Dictionary = points[i]
			var next: Dictionary = points[i + 1]
			var center_gap: float = next["center"] - current["center"]
			if center_gap < GameState.tuning_value(&"reactionGapMinPx"):
				failures.append("%s→%s 威胁中心距 %.0f < reactionGapMinPx %.0f" % [
					current["id"], next["id"], center_gap, GameState.tuning_value(&"reactionGapMinPx"),
				])
			if current["type"] == TYPE_PIT:
				var landing_gap: float = next["center"] - current["right"]
				if landing_gap < GameState.tuning_value(&"pitLandingBufferPx"):
					failures.append("%s 坑沿到 %s 落地缓冲 %.0f < pitLandingBufferPx %.0f" % [
						current["id"], next["id"], landing_gap, GameState.tuning_value(&"pitLandingBufferPx"),
					])
	return failures


## 单跳上升高度（px）：v²/(2g)，与 player.gd 跳跃常量同源（策划案 §3.2 演算 168.75）。
static func _single_jump_height_px() -> float:
	var v: float = absf(GameState.tuning_value(&"jumpVelocityPxPerSec"))
	var g: float = GameState.tuning_value(&"gravityPxPerSec2")
	return v * v / (2.0 * g)


## 低飞怪「封站立、放滑铲」校验（两个 variant 一起机判，见 obstacle_air.gd 推导）。
static func check_air_obstacle_envelope() -> PackedStringArray:
	var failures: PackedStringArray = []
	var box_half: float = ObstacleAir.BOX_HEIGHT / 2.0
	var stand_top: float = GameState.tuning_value(&"hitboxStandHeightPx")
	var slide_top: float = GameState.tuning_value(&"hitboxSlideHeightPx")
	for level: Dictionary in LEVELS:
		for element: Dictionary in level["elements"]:
			if element["type"] != TYPE_OBSTACLE_AIR:
				continue
			var bottom: float = element["y"] - box_half
			if bottom >= stand_top:
				failures.append("%s 盒底 %.0f ≥ 站立顶 %.0f：不构成低飞威胁" % [
					element["id"], bottom, stand_top,
				])
			if bottom < slide_top:
				failures.append("%s 盒底 %.0f < 滑铲顶 %.0f：滑铲无法通过" % [
					element["id"], bottom, slide_top,
				])
	return failures
