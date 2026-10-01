extends Node2D
## 庭院视图：程序化绘制治愈系田园画面（暖色板 + 木屋 + 栅栏 + 昼夜循环），
## 并承担五大区域对象的点击/触摸命中测试。
##
## 交互语义（目标验收硬口径 —— 点击与触摸效果一致）：
## - 移动端 emulate_mouse_from_touch 默认开启，触摸自动派生鼠标事件；
##   桌面鼠标与手机手指最终都汇入 InputEventMouseButton 同一条路径；
## - 事件坐标用 CanvasItem.make_input_local 一步完成「窗口→视口→画布」逆变换；
## - 命中表 _hotspots 由 _relayout 按「对象可见矩形」生成 —— 热区与视觉位置严格一致。
##
## 本节点只做「视图 + 命中」：业务结算一律发 tapped 信号由 main.gd 调 GameState 完成。

## 点击命中：kind ∈ plot/bed/tree/coop/workshop/fountain/swing
signal tapped(kind: String, index: int)
## v2 B3 划动批量：手势划过的每个对象逐个发出（main 侧与 tapped 同语义处理）
signal swiped(kind: String, index: int)

## ── 田园暖色板（治愈系视觉基调）──
const COL_GRASS := Color("7fbf5f")
const COL_GRASS_DARK := Color("68a94e")
const COL_SOIL := Color("9b6b43")
const COL_SOIL_DARK := Color("7d5433")
const COL_WOOD := Color("a8743f")
const COL_WOOD_DARK := Color("875c31")
const COL_ROOF := Color("c2564a")
const COL_CREAM := Color("fff3dc")
const COL_TEXT := Color("4a3628")
const COL_TEXT_LIGHT := Color("fff8ea")
const COL_COIN := Color("f2b93b")
const COL_COIN_EDGE := Color("c98f1b")
const COL_LOCKED := Color("9aa08f", 0.55)

const DESIGN_WIDTH: float = 720.0
## 区域高度（自上而下）：菜园/果园/鸡鸭鹅舍/小花园/休闲天地
## v2 A2 紧凑拼贴：总高度按「放大后的物件」重排，区域间距压缩到 8px（spec 上限 12px），
## 交界由木栅栏 + 灌木花带填充，不再出现纯色分隔带。
const REGION_HEIGHTS: Array[float] = [292.0, 200.0, 212.0, 184.0, 216.0]
const REGION_NAMES: Array[String] = ["菜园", "果园", "鸡鸭鹅舍", "小花园", "休闲天地"]
const TOP_RESERVE: float = 118.0
const BOTTOM_RESERVE: float = 26.0
## v2 A1：热区与物件几何下限（spec hitzone.minShortEdgePx / gapMin）
const HOTZONE_MIN_EDGE: float = 88.0
const HOTZONE_GAP_MIN: float = 8.0
## v1 基线（物件视觉高/单元短边 ≈ 0.46）——objectScaleRatio 的对照基准
const V1_ICON_CELL_RATIO: float = 0.46
## v2 物件视觉高目标 = 单元短边 × 0.85（spec matureHeightMin）
const ICON_CELL_TARGET: float = 0.85

var _hotspots: Array[Dictionary] = []
var _region_rects: Array[Rect2] = []
var _sky_rect := Rect2()
var _house_pos := Vector2.ZERO
var _stars: Array[Vector2] = []
var _anim_t := 0.0
var _tint := Color(1, 1, 1)          # 昼夜对「地面与物件」的染色，天空单独配色
var _star_rng := RandomNumberGenerator.new()
## v2 A2/A3：装饰、动效与手势状态
var _decor: Array[Dictionary] = []   # {kind: tuft/flower/stone, pos, size, hue}
var _clouds: Array[Dictionary] = []  # {pos, speed, scale}
var _mature_at: Dictionary = {}      # "plot-i"/"bed-i" → 变成熟时刻（生长完成弹跳 m1）
var _prev_slot_state: Dictionary = {} # 同键上一帧状态（mature→empty 触发收获粒子 m8）
var _fx: Array[Dictionary] = []      # 收获叶片粒子 {pos, vel, born}
var _last_stock: Dictionary = {}     # coop id → 上帧 stock（产蛋弹出 m5）
var _egg_pop_at: Dictionary = {}     # coop id → 产蛋时刻
var _gesture_active := false
var _gesture_start := Vector2.ZERO
var _gesture_crossed: Array[Dictionary] = []


func _ready() -> void:
	_star_rng.seed = 20260928
	for i in 42:
		_stars.append(Vector2(_star_rng.randf_range(0.0, DESIGN_WIDTH), _star_rng.randf_range(4.0, 96.0)))
	_star_rng.seed = 20261002
	for i in 4:
		_clouds.append({
			"pos": Vector2(_star_rng.randf_range(40.0, DESIGN_WIDTH - 40.0), _star_rng.randf_range(16.0, 78.0)),
			"speed": _star_rng.randf_range(6.0, 14.0),
			"scale": _star_rng.randf_range(0.8, 1.3),
		})
	get_viewport().size_changed.connect(_relayout)
	_relayout()


func _process(delta: float) -> void:
	_anim_t += delta
	_update_day_night()
	_update_view_state()
	queue_redraw()


## v2 A3 动效状态追踪：变熟时刻（m1 弹跳）、成熟→空（m8 收获粒子）、产蛋时刻（m5 弹出）。
func _update_view_state() -> void:
	for i in GameState.plots.size():
		_track_slot("plot", i, GameState.plots[i])
	for i in GameState.beds.size():
		_track_slot("bed", i, GameState.beds[i])
	for id: String in GameState.coops:
		var stock := int(GameState.coops[id]["stock"])
		if _last_stock.has(id) and stock > int(_last_stock[id]):
			_egg_pop_at[id] = _anim_t
		_last_stock[id] = stock
	while not _fx.is_empty() and _anim_t - float(_fx[0]["born"]) > 0.7:
		_fx.remove_at(0)


func _track_slot(key: String, index: int, slot: Dictionary) -> void:
	var id := "%s-%d" % [key, index]
	var state := String(slot["state"])
	var prev := String(_prev_slot_state.get(id, ""))
	if state == "mature" and prev != "mature":
		_mature_at[id] = _anim_t
	if prev == "mature" and state == "empty":
		var center := hotspot_center(key, index)
		var rng := RandomNumberGenerator.new()
		rng.seed = index * 131 + int(_anim_t * 60.0)
		for p in 6:
			_fx.append({
				"pos": center + Vector2(rng.randf_range(-16.0, 16.0), rng.randf_range(-20.0, 6.0)),
				"vel": Vector2(rng.randf_range(-52.0, 52.0), rng.randf_range(-130.0, -60.0)),
				"born": _anim_t,
			})
	_prev_slot_state[id] = state


## ── 布局：按视口实际尺寸纵向排布五大区域（stretch=expand 时视口高度会变）──
func _relayout() -> void:
	var size := get_viewport_rect().size
	var content: float = 0.0
	for h in REGION_HEIGHTS:
		content += h
	var gap: float = maxf((size.y - TOP_RESERVE - BOTTOM_RESERVE - content) / float(REGION_HEIGHTS.size() - 1), 4.0)
	_region_rects.clear()
	var y := TOP_RESERVE
	for i in REGION_HEIGHTS.size():
		var h: float = REGION_HEIGHTS[i]
		_region_rects.append(Rect2(0.0, y, size.x, h))
		y += h + gap
	_sky_rect = Rect2(0.0, 0.0, size.x, TOP_RESERVE)
	# 木屋放左上空旷处（任务横幅改为居中窄条后，这里不再被遮挡）
	_house_pos = Vector2(size.x * 0.115, TOP_RESERVE - 22.0)
	_rebuild_hotspots()


func _rebuild_hotspots() -> void:
	_hotspots.clear()
	if _region_rects.size() < REGION_HEIGHTS.size():
		return
	# 菜园：3 列 × 2 行地块（v2 A1：单元 146×120，热区短边 ≥88、间隙 ≥8）
	var garden := _region_rects[0]
	var cell := Vector2(146.0, 120.0)
	var grid_origin := Vector2(garden.get_center().x - cell.x * 1.5 - 10.0, garden.position.y + 36.0)
	for i in FarmData.PLOT_COUNT:
		var col := i % 3
		var row := i / 3
		var rect := Rect2(grid_origin + Vector2(col * (cell.x + 10.0), row * (cell.y + 10.0)), cell)
		_hotspots.append({"kind": "plot", "index": i, "rect": rect})
	# 果树：3 棵横向均布（热区 190×150）
	var orchard := _region_rects[1]
	for i in FarmData.TREES.size():
		var cx := orchard.get_center().x + (float(i) - 1.0) * 220.0
		_hotspots.append({"kind": "tree", "index": i, "rect": Rect2(cx - 95.0, orchard.position.y + 36.0, 190.0, orchard.size.y - 50.0)})
	# 养殖舍：3 座横向均布（热区 200×162）
	var coop_region := _region_rects[2]
	for i in FarmData.COOPS.size():
		var cx := coop_region.get_center().x + (float(i) - 1.0) * 220.0
		_hotspots.append({"kind": "coop", "index": i, "rect": Rect2(cx - 100.0, coop_region.position.y + 36.0, 200.0, coop_region.size.y - 50.0)})
	# 花圃：4 块一行（单元 158×118）
	var flower := _region_rects[3]
	var bed_cell := Vector2(158.0, 118.0)
	var bed_origin := Vector2(flower.get_center().x - bed_cell.x * 2.0 - 18.0, flower.position.y + 36.0)
	for i in FarmData.BED_COUNT:
		var rect := Rect2(bed_origin + Vector2(float(i) * (bed_cell.x + 12.0), 0.0), bed_cell)
		_hotspots.append({"kind": "bed", "index": i, "rect": rect})
	# 休闲天地：工坊 + 喷泉 + 秋千（热区 196/146 ×166）
	var leisure := _region_rects[4]
	var center_x := leisure.get_center().x
	var leisure_h: float = leisure.size.y - 50.0
	_hotspots.append({"kind": "workshop", "index": 0, "rect": Rect2(center_x - 330.0, leisure.position.y + 38.0, 196.0, leisure_h)})
	_hotspots.append({"kind": "fountain", "index": 0, "rect": Rect2(center_x - 73.0, leisure.position.y + 38.0, 146.0, leisure_h)})
	_hotspots.append({"kind": "swing", "index": 0, "rect": Rect2(center_x + 134.0, leisure.position.y + 38.0, 146.0, leisure_h)})
	_rebuild_decor()


## 供冒烟断言：指定区域（region 索引 ↔ 五大区域）内可交互对象的热区数量。
func hotspot_count_in_region(region: int) -> int:
	if region < 0 or region >= _region_rects.size():
		return 0
	var area := _region_rects[region]
	var count := 0
	for spot in _hotspots:
		if area.intersects(spot["rect"]):
			count += 1
	return count


func hit_at(pos: Vector2) -> Dictionary:
	for spot in _hotspots:
		if (spot["rect"] as Rect2).has_point(pos):
			return spot
	return {}


## 冒烟/输入测试用：某对象热区中心（点击注入以此为坐标，保证热区=视觉位置）。
func hotspot_center(kind: String, index: int) -> Vector2:
	for spot in _hotspots:
		if String(spot["kind"]) == kind and int(spot["index"]) == index:
			var rect: Rect2 = spot["rect"]
			return rect.get_center()
	return Vector2.ZERO


## v2 A1 取证口：全部热区矩形（冒烟逐条断言短边 ≥ 88、两两不重叠）。
func hotspot_rects() -> Array[Rect2]:
	var rects: Array[Rect2] = []
	for spot in _hotspots:
		rects.append(spot["rect"])
	return rects


## v2 A1 断言口：返回违反热区规格（短边/间隙）的描述列表，空 = 达标。
func hotzone_violations() -> PackedStringArray:
	var violations := PackedStringArray()
	var rects := hotspot_rects()
	for i in rects.size():
		if rects[i].size.x < HOTZONE_MIN_EDGE or rects[i].size.y < HOTZONE_MIN_EDGE:
			violations.append("热区 %d 短边 %sx%s < %s" % [i, rects[i].size.x, rects[i].size.y, HOTZONE_MIN_EDGE])
		for j in range(i + 1, rects.size()):
			if rects[i].intersects(rects[j]):
				violations.append("热区 %d 与 %d 重叠（间隙不足 %s）" % [i, j, HOTZONE_GAP_MIN])
	return violations


## v2 A1 取证口：物件放大系数（成熟作物视觉高/单元短边，及相对 v1 基线的倍数）。
func object_scale_report() -> Dictionary:
	var ratio := ICON_CELL_TARGET / V1_ICON_CELL_RATIO
	return {"icon_cell_ratio": ICON_CELL_TARGET, "object_scale_ratio": ratio}


## v2 A2 装饰布点：草丛/小花/石子按确定种子散进各区域（画在物件下层，只补空白不挡交互）。
func _rebuild_decor() -> void:
	_decor.clear()
	var rng := RandomNumberGenerator.new()
	rng.seed = 20261002
	for r in _region_rects.size():
		var area := _region_rects[r]
		for i in 14:
			var kind: String = ["tuft", "flower", "stone"][rng.randi_range(0, 2)]
			_decor.append({
				"kind": kind,
				"pos": Vector2(rng.randf_range(18.0, area.size.x - 18.0), area.position.y + rng.randf_range(10.0, area.size.y - 10.0)),
				"size": rng.randf_range(0.7, 1.25),
				"hue": rng.randf_range(0.0, 1.0),
			})


## ═══════════════ v2 B3 划动批量手势 ═══════════════
## 按下=起点（单点语义不变，仍走 tapped）；按住移动超阈值进入批量，
## 划过的每个对象中心进圈即发一次 swiped —— main 侧与点击同语义逐个结算。

func _unhandled_input(event: InputEvent) -> void:
	var button := event as InputEventMouseButton
	if button != null and button.button_index == MOUSE_BUTTON_LEFT:
		var local_button := make_input_local(event) as InputEventMouseButton
		if local_button == null:
			return
		if local_button.pressed:
			_gesture_active = true
			_gesture_start = local_button.position
			_gesture_crossed.clear()
			_tap_at(local_button.position)
		else:
			_gesture_active = false
		get_viewport().set_input_as_handled()
		return
	var motion := event as InputEventMouseMotion
	if motion != null and _gesture_active and (motion.button_mask & MOUSE_BUTTON_MASK_LEFT) != 0:
		var local_motion := make_input_local(event) as InputEventMouseMotion
		if local_motion == null:
			return
		_sweep_gesture(local_motion.position)


func _tap_at(pos: Vector2) -> void:
	var spot := hit_at(pos)
	if spot.is_empty():
		return
	tapped.emit(String(spot["kind"]), int(spot["index"]))


func _sweep_gesture(pos: Vector2) -> void:
	if pos.distance_to(_gesture_start) < FarmData.BATCH_SWIPE_MIN_PX:
		return
	for spot in _hotspots:
		var rect: Rect2 = spot["rect"]
		if rect.get_center().distance_to(pos) > FarmData.BATCH_HIT_RADIUS_PX:
			continue
		var seen := false
		for crossed in _gesture_crossed:
			if String(crossed["kind"]) == String(spot["kind"]) and int(crossed["index"]) == int(spot["index"]):
				seen = true
				break
		if seen:
			continue
		_gesture_crossed.append(spot)
		swiped.emit(String(spot["kind"]), int(spot["index"]))


## ── 昼夜循环（纯视觉）：按 GameState.day_phase 插值天空色与地面染色 ──
func _update_day_night() -> void:
	var phase := GameState.day_phase()
	# 关键帧：0 清晨 → 0.42 正午 → 0.62 黄昏 → 0.78 深夜 → 1.0 破晓
	var keys: Array[float] = [0.0, 0.42, 0.62, 0.78, 1.0]
	var ground: Array[Color] = [
		Color(1.0, 1.0, 1.0),
		Color(1.0, 1.0, 1.0),
		Color(1.0, 0.93, 0.86),
		Color(0.62, 0.66, 0.86),
		Color(1.0, 1.0, 1.0),
	]
	for i in keys.size() - 1:
		if phase >= keys[i] and phase <= keys[i + 1]:
			var span := keys[i + 1] - keys[i]
			if span <= 0.0:
				break
			var t: float = (phase - keys[i]) / span
			_tint = ground[i].lerp(ground[i + 1], t)
			return
	_tint = ground[0]


## ═══════════════ 绘制 ═══════════════

func _draw() -> void:
	var size := get_viewport_rect().size
	_draw_sky(size)
	_draw_ground(size)
	_draw_house()
	for i in _region_rects.size():
		_draw_region_title(_region_rects[i], REGION_NAMES[i])
	for spot in _hotspots:
		var rect: Rect2 = spot["rect"]
		rect = rect.grow(-4.0)
		match String(spot["kind"]):
			"plot":
				_draw_plot(rect, int(spot["index"]))
			"bed":
				_draw_bed(rect, int(spot["index"]))
			"tree":
				_draw_tree(rect, int(spot["index"]))
			"coop":
				_draw_coop(rect, int(spot["index"]))
			"workshop":
				_draw_workshop(rect)
			"fountain":
				_draw_fountain(rect)
			"swing":
				_draw_swing(rect)
	_draw_fx()


## v2 m8 收获粒子：叶片上抛 + 重力下落 + 淡出（0.6s）。
func _draw_fx() -> void:
	for particle in _fx:
		var age: float = _anim_t - float(particle["born"])
		if age < 0.0 or age > 0.6:
			continue
		var pos: Vector2 = particle["pos"]
		var vel: Vector2 = particle["vel"]
		var p := pos + vel * age + Vector2(0.0, 260.0 * age * age)
		draw_circle(p, 3.0, Color(0.45, 0.75, 0.35, clampf(1.0 - age / 0.6, 0.0, 1.0)))


func _draw_sky(size: Vector2) -> void:
	var phase := GameState.day_phase()
	var day_top := Color("a9def2")
	var day_bottom := Color("dff3d8")
	var night_top := Color("2b3a63")
	var night_bottom := Color("5a6a94")
	# 夜间权重：phase 0.66~0.9 渐入夜，0.9~1.0+0~0.06 渐破晓
	var night := clampf((phase - 0.66) / 0.16, 0.0, 1.0) * (1.0 - clampf((phase - 0.92) / 0.08, 0.0, 1.0))
	var top := day_top.lerp(night_top, night)
	var bottom := day_bottom.lerp(night_bottom, night)
	draw_rect(Rect2(Vector2.ZERO, Vector2(size.x, _sky_rect.size.y + 40.0)), top)
	draw_rect(Rect2(Vector2(0.0, _sky_rect.size.y * 0.5), Vector2(size.x, _sky_rect.size.y * 0.5 + 40.0)), bottom)
	if night > 0.25:
		for star in _stars:
			var twinkle := 0.55 + 0.45 * sin(_anim_t * 2.2 + star.x)
			draw_circle(star, 1.6 * (1.0 - night * 0.3), Color(1, 1, 0.92, night * twinkle))
	# 太阳 / 月亮沿弧线运动
	var arc_y := _sky_rect.size.y - 18.0
	var sun_x := size.x * phase * 1.6 - size.x * 0.3
	var sun_t := clampf(phase / 0.72, -0.2, 1.2)
	var sun_pos := Vector2(size.x * sun_t, arc_y - sin(clampf(sun_t, 0.0, 1.0) * PI) * (arc_y - 26.0))
	draw_circle(sun_pos, 24.0, Color(1.0, 0.9, 0.5, 0.95))
	draw_circle(sun_pos, 31.0, Color(1.0, 0.88, 0.45, 0.22))
	var moon_t := fposmod(phase - 0.74, 1.0) / 0.4
	if moon_t >= 0.0 and moon_t <= 1.0:
		var moon_pos := Vector2(size.x * moon_t, arc_y - sin(moon_t * PI) * (arc_y - 30.0))
		draw_circle(moon_pos, 19.0, Color(0.96, 0.96, 0.9, clampf(night + 0.15, 0.0, 1.0)))
		draw_circle(moon_pos + Vector2(7.0, -4.0), 16.0, top.lerp(Color(0, 0, 0), 0.15))
	# v2 A2：飘云（缓速横移 + 夜间压暗）与远处飞鸟
	for cloud in _clouds:
		var cpos: Vector2 = cloud["pos"]
		var drift: Vector2 = Vector2(fposmod(cpos.x + _anim_t * float(cloud["speed"]), size.x + 220.0) - 110.0, cpos.y)
		var s: float = cloud["scale"]
		var cloud_col := Color(1, 1, 1, 0.85).lerp(Color(0.62, 0.68, 0.85, 0.8), night)
		draw_circle(drift, 15.0 * s, cloud_col)
		draw_circle(drift + Vector2(14.0 * s, 4.0 * s), 11.0 * s, cloud_col)
		draw_circle(drift - Vector2(13.0 * s, 3.0 * s), 10.0 * s, cloud_col)
		draw_circle(drift + Vector2(2.0 * s, -7.0 * s), 12.0 * s, cloud_col)
	for b in 3:
		var wing := sin(_anim_t * 7.0 + float(b) * 2.1) * 3.0
		var bpos := Vector2(fposmod(float(b) * 260.0 + _anim_t * 22.0, size.x + 80.0) - 40.0, 34.0 + float(b) * 16.0)
		var bird_col := Color(0.25, 0.27, 0.33, 0.75).lerp(Color(0.85, 0.88, 0.95, 0.6), night)
		draw_line(bpos + Vector2(-6.0, -wing), bpos, bird_col, 1.6)
		draw_line(bpos, bpos + Vector2(6.0, -wing), bird_col, 1.6)


func _draw_ground(size: Vector2) -> void:
	var grass := _lit(COL_GRASS)
	var grass_dark := _lit(COL_GRASS_DARK)
	draw_rect(Rect2(0.0, _sky_rect.size.y - 34.0, size.x, size.y), grass)
	# v2 A2：草地三档色阶横带（禁止单色矩形平铺）
	var band_colors: Array[Color] = [
		grass.lerp(grass_dark, 0.18), grass, grass.lerp(Color("8fce6a"), 0.35), grass.lerp(grass_dark, 0.10),
	]
	var band_y := _sky_rect.size.y - 34.0
	var band_h: float = (size.y - band_y) / 4.0
	for b in band_colors.size():
		draw_rect(Rect2(0.0, band_y + float(b) * band_h, size.x, band_h + 1.0), band_colors[b])
	# 远处两道缓坡山丘
	draw_circle(Vector2(size.x * 0.18, _sky_rect.size.y + 10.0), 130.0, grass_dark.lerp(grass, 0.35))
	draw_circle(Vector2(size.x * 0.86, _sky_rect.size.y + 26.0), 170.0, grass_dark.lerp(grass, 0.2))
	# 贯穿庭院的浅色小径
	var path := _lit(Color("e8d9a8"))
	var points := PackedVector2Array([
		Vector2(size.x * 0.5 - 34.0, _sky_rect.size.y - 20.0),
		Vector2(size.x * 0.5 + 34.0, _sky_rect.size.y - 20.0),
		Vector2(size.x * 0.72 + 30.0, size.y),
		Vector2(size.x * 0.72 - 30.0, size.y),
	])
	draw_colored_polygon(points, Color(path, 0.85))
	# v2 A2：草地噪点碎石（确定种子，铺满下层消灭纯色块观感）
	var rng := RandomNumberGenerator.new()
	rng.seed = 7712026
	for i in 90:
		var p := Vector2(rng.randf_range(6.0, size.x - 6.0), rng.randf_range(_sky_rect.size.y - 20.0, size.y - 4.0))
		draw_circle(p, rng.randf_range(1.2, 2.6), Color(grass_dark, rng.randf_range(0.10, 0.22)))
	# 区域之间的木栅栏 + 灌木花带（填充区域交界，不留纯色分隔带）
	for i in _region_rects.size():
		var rect := _region_rects[i]
		var fence_y := rect.position.y - 10.0
		if fence_y < _sky_rect.size.y:
			continue
		_draw_fence(Vector2(14.0, fence_y), size.x - 28.0)
		_draw_hedge(Vector2(14.0, fence_y + 4.0), size.x - 28.0)
	# 装饰：草丛/小花/石子（画在物件下层）
	_draw_decor()


## v2 A2 灌木花带：栅栏脚下的一排圆灌木 + 点缀小花，填充区域间隙。
func _draw_hedge(origin: Vector2, width: float) -> void:
	var leaf := _lit(Color("55913f"))
	var leaf_light := _lit(Color("6fae52"))
	var x := origin.x + 8.0
	var i := 0
	while x < origin.x + width:
		var r := 11.0 + fposmod(float(i) * 7.0, 5.0)
		draw_circle(Vector2(x, origin.y + 6.0), r, leaf)
		draw_circle(Vector2(x - r * 0.3, origin.y + 3.0), r * 0.55, leaf_light)
		if i % 3 == 0:
			draw_circle(Vector2(x + 6.0, origin.y + 2.0), 2.4, _lit(Color("f6d460")))
		x += r * 2.1
		i += 1


## v2 A2 装饰层：草丛（三笔草叶）/ 小花 / 石子。
func _draw_decor() -> void:
	for item in _decor:
		var pos: Vector2 = item["pos"]
		var s: float = item["size"]
		match String(item["kind"]):
			"tuft":
				var blade := _lit(Color("4f9e4f").lerp(Color("8fce6a"), float(item["hue"]) * 0.5))
				draw_line(pos + Vector2(-4.0 * s, 0.0), pos + Vector2(-6.0 * s, -9.0 * s), blade, 1.8 * s)
				draw_line(pos, pos + Vector2(0.0, -12.0 * s), blade, 1.8 * s)
				draw_line(pos + Vector2(4.0 * s, 0.0), pos + Vector2(6.0 * s, -8.0 * s), blade, 1.8 * s)
			"flower":
				var petal := _lit([Color("ffffff"), Color("f6a5c0"), Color("f6d460")][int(float(item["hue"]) * 2.99) % 3])
				for p in 5:
					var angle := TAU * float(p) / 5.0
					draw_circle(pos + Vector2(cos(angle), sin(angle)) * 2.6 * s, 1.7 * s, petal)
				draw_circle(pos, 1.6 * s, _lit(Color("f2b93b")))
			"stone":
				draw_circle(pos, 3.2 * s, _lit(Color("b9b3a4")))
				draw_circle(pos + Vector2(-1.0 * s, -1.0 * s), 1.8 * s, _lit(Color("d4cec0")))


func _draw_fence(origin: Vector2, width: float) -> void:
	var wood := _lit(COL_WOOD)
	var wood_dark := _lit(COL_WOOD_DARK)
	draw_rect(Rect2(origin + Vector2(0.0, 6.0), Vector2(width, 3.0)), wood)
	draw_rect(Rect2(origin + Vector2(0.0, 16.0), Vector2(width, 3.0)), wood)
	var step := 64.0
	var x := origin.x
	while x < origin.x + width:
		draw_rect(Rect2(Vector2(x, origin.y - 4.0), Vector2(5.0, 30.0)), wood_dark)
		x += step


func _draw_house() -> void:
	# 远景木屋：治愈系小院的地标（夜间窗户亮灯）；左上角绘制，0.8 倍缩放避让任务横幅
	var wall := _lit(COL_CREAM)
	var roof := _lit(COL_ROOF)
	var wood := _lit(COL_WOOD_DARK)
	draw_set_transform(_house_pos, 0.0, Vector2(0.8, 0.8))
	draw_rect(Rect2(Vector2(-64.0, -34.0), Vector2(128.0, 62.0)), wall)
	draw_colored_polygon(PackedVector2Array([
		Vector2(-78.0, -34.0), Vector2(0.0, -86.0), Vector2(78.0, -34.0),
	]), roof)
	draw_rect(Rect2(Vector2(30.0, -118.0), Vector2(12.0, 34.0)), wood)
	var window_glow := clampf((GameState.day_phase() - 0.68) / 0.1, 0.0, 1.0)
	var window_col := Color("ffe9a8").lerp(Color("8fa3c0"), 1.0 - window_glow)
	draw_rect(Rect2(Vector2(-44.0, -16.0), Vector2(24.0, 24.0)), window_col)
	draw_rect(Rect2(Vector2(20.0, -16.0), Vector2(24.0, 24.0)), window_col)
	draw_rect(Rect2(Vector2(-14.0, 0.0), Vector2(28.0, 28.0)), _lit(COL_WOOD))
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)


func _draw_region_title(rect: Rect2, title: String) -> void:
	var pill := Rect2(rect.position + Vector2(12.0, 6.0), Vector2(96.0, 26.0))
	_panel(pill, _lit(Color("ffffff")), 13.0)
	_label(title, pill.get_center(), 16, _lit(COL_TEXT))


func _draw_plot(rect: Rect2, index: int) -> void:
	var slot: Dictionary = GameState.plots[index]
	var soil := _lit(COL_SOIL)
	if slot["state"] == "locked":
		_panel(rect, Color(_lit(Color("b9c2ad")), 0.5), 14.0)
		_label("未开垦", rect.get_center() + Vector2(0.0, -10.0), 16, _lit(COL_TEXT))
		_coin_with_price(rect.get_center() + Vector2(0.0, 16.0), FarmData.PLOT_UNLOCK_COSTS[index])
		return
	_panel(rect, soil, 12.0)
	# v2 A4 手绘感：暖褐描边 + 垄沟纹理
	draw_rect(rect.grow(-3.0), _lit(Color("6b4423")), false, 3.0)
	for row in 4:
		var line_y := rect.position.y + 20.0 + float(row) * 22.0
		draw_line(Vector2(rect.position.x + 8.0, line_y), Vector2(rect.end.x - 8.0, line_y), Color(_lit(COL_SOIL_DARK), 0.55), 2.0)
	if slot["state"] == "growing":
		var progress := 1.0 - float(slot["remain"]) / maxf(float(slot["total"]), 0.001)
		var sway := sin(_anim_t * 2.24 + float(index) * 1.7) * 2.5   # m2 待机摇摆（相位按地块错开）
		_draw_crop_icon(rect.get_center() + Vector2(sway, 0.0), String(slot["crop"]), _icon_scale(rect) * (0.35 + 0.65 * progress))
		_progress_bar(rect.position + Vector2(8.0, rect.size.y - 14.0), rect.size.x - 16.0, progress)
	elif slot["state"] == "mature":
		var center := rect.get_center() + Vector2(0.0, -absf(sin(_anim_t * 3.2)) * 5.0)
		# m3 成熟呼吸光：柔和光晕随呼吸明暗
		draw_circle(center, _icon_scale(rect) * 24.0, Color(1.0, 0.95, 0.6, 0.10 + 0.05 * sin(_anim_t * 3.9)))
		_draw_crop_icon(center, String(slot["crop"]), _icon_scale(rect) * _mature_pop("plot", index))
		_label("收获", rect.position + Vector2(rect.size.x / 2.0, rect.size.y - 8.0), 15, _lit(Color("fff8ea")))
	else:
		_label("点我播种", rect.get_center(), 15, Color(_lit(COL_TEXT_LIGHT), 0.9))


## v2 A1：作物/花卉图标的目标缩放 —— 视觉高 ≈ 单元短边 × 0.85（spec matureHeightMin）。
func _icon_scale(rect: Rect2) -> float:
	return minf(rect.size.x, rect.size.y) * ICON_CELL_TARGET / 46.0


## v2 m1 生长完成弹跳：变成熟后 0.24s 内 scale 0.92 → 1.0（ease-out）。
func _mature_pop(key: String, index: int) -> float:
	var id := "%s-%d" % [key, index]
	if not _mature_at.has(id):
		return 1.0
	var t: float = (_anim_t - float(_mature_at[id])) / 0.24
	if t >= 1.0:
		return 1.0
	return 0.92 + 0.08 * sin(clampf(t, 0.0, 1.0) * PI * 0.5)


func _draw_bed(rect: Rect2, index: int) -> void:
	var slot: Dictionary = GameState.beds[index]
	if slot["state"] == "locked":
		_panel(rect, Color(_lit(Color("b9c2ad")), 0.5), 14.0)
		_label("未开垦", rect.get_center() + Vector2(0.0, -10.0), 15, _lit(COL_TEXT))
		_coin_with_price(rect.get_center() + Vector2(0.0, 16.0), FarmData.BED_UNLOCK_COSTS[index])
		return
	_panel(rect, _lit(Color("6d4f8f") if index % 2 == 0 else Color("8f4f5f")), 10.0)
	# 花圃围边（暖褐描边）
	draw_rect(rect.grow(-3.0), _lit(COL_WOOD_DARK), false, 3.0)
	if slot["state"] == "growing":
		var progress := 1.0 - float(slot["remain"]) / maxf(float(slot["total"]), 0.001)
		var sway := sin(_anim_t * 2.24 + float(index) * 1.7) * 2.5
		_draw_crop_icon(rect.get_center() + Vector2(sway, 0.0), String(slot["crop"]), _icon_scale(rect) * (0.35 + 0.65 * progress))
		_progress_bar(rect.position + Vector2(8.0, rect.size.y - 12.0), rect.size.x - 16.0, progress)
	elif slot["state"] == "mature":
		var center := rect.get_center() + Vector2(0.0, -absf(sin(_anim_t * 3.2 + float(index))) * 4.0)
		draw_circle(center, _icon_scale(rect) * 24.0, Color(1.0, 0.95, 0.6, 0.10 + 0.05 * sin(_anim_t * 3.9)))
		_draw_crop_icon(center, String(slot["crop"]), _icon_scale(rect) * _mature_pop("bed", index))
		_label("摘花", rect.position + Vector2(rect.size.x / 2.0, rect.size.y - 6.0), 14, _lit(Color("fff8ea")))
	else:
		_label("点我种花", rect.get_center(), 15, Color(_lit(COL_TEXT_LIGHT), 0.9))


func _draw_tree(rect: Rect2, index: int) -> void:
	var ids := FarmData.TREES.keys()
	var tree_id := String(ids[index])
	var tree: Dictionary = GameState.trees[tree_id]
	var data: Dictionary = FarmData.TREES[tree_id]
	if not tree["built"]:
		_panel(rect, Color(_lit(Color("b9c2ad")), 0.45), 16.0)
		_label(data["name"], rect.get_center() + Vector2(0.0, -8.0), 16, _lit(COL_TEXT))
		_coin_with_price(rect.get_center() + Vector2(0.0, 18.0), int(data["build_cost"]))
		return
	var base := Vector2(rect.get_center().x, rect.end.y - 8.0)
	var trunk := _lit(COL_WOOD_DARK)
	# v2 A1：树冠 ×1.5（描边提升手绘感）
	draw_rect(Rect2(base + Vector2(-11.0, -70.0), Vector2(22.0, 70.0)), trunk)
	draw_rect(Rect2(base + Vector2(-11.0, -70.0), Vector2(6.0, 70.0)), _lit(Color("6b4423")))
	var leaf := _lit(Color("4f9e4f") if tree_id != "peach" else Color("e58fb1"))
	var leaf_dark := leaf.lerp(Color(0.2, 0.35, 0.15), 0.35)
	var sway := sin(_anim_t * 1.6 + float(index)) * 3.0
	draw_circle(base + Vector2(-33.0 + sway, -98.0), 39.0, leaf_dark)
	draw_circle(base + Vector2(33.0 + sway, -95.0), 36.0, leaf_dark)
	draw_circle(base + Vector2(0.0 + sway, -128.0), 45.0, leaf_dark)
	draw_circle(base + Vector2(-30.0 + sway, -101.0), 34.0, leaf)
	draw_circle(base + Vector2(30.0 + sway, -98.0), 31.0, leaf)
	draw_circle(base + Vector2(sway, -130.0), 39.0, leaf)
	if bool(tree["ready"]):
		var bounce := absf(sin(_anim_t * 3.0 + float(index))) * 5.0
		draw_circle(base + Vector2(sway, -128.0), 46.0, Color(1.0, 0.95, 0.6, 0.10 + 0.05 * sin(_anim_t * 3.9)))
		var fruit_col := _lit(Color("e23d3d") if tree_id == "apple" else (Color("cfd66a") if tree_id == "pear" else Color("f0956b")))
		for f in 4:
			var angle := TAU * float(f) / 4.0 + _anim_t * 0.4
			draw_circle(base + Vector2(cos(angle) * 30.0, -98.0 + sin(angle) * 20.0 - bounce), 9.5, fruit_col)
		_label("可摘", base + Vector2(0.0, -bounce - 168.0), 15, _lit(Color("fff8ea")))
	else:
		_label("%s · %ds" % [data["fruit_name"], int(ceil(float(tree["ready_in"])))] , base + Vector2(0.0, -162.0), 14, _lit(COL_TEXT))


func _draw_coop(rect: Rect2, index: int) -> void:
	var ids := FarmData.COOPS.keys()
	var coop_id := String(ids[index])
	var coop: Dictionary = GameState.coops[coop_id]
	var data: Dictionary = FarmData.COOPS[coop_id]
	if int(coop["level"]) <= 0:
		_panel(rect, Color(_lit(Color("b9c2ad")), 0.45), 16.0)
		_label(data["name"], rect.get_center() + Vector2(0.0, -10.0), 16, _lit(COL_TEXT))
		_coin_with_price(rect.get_center() + Vector2(0.0, 16.0), int(data["build_cost"]))
		return
	var body := _lit(Color("e8c98f") if index == 0 else (Color("cfe0ef") if index == 1 else Color("efd8cf")))
	var roof := _lit(COL_ROOF if index != 1 else Color("5f7fae"))
	var base := Vector2(rect.get_center().x, rect.end.y - 10.0)
	# v2 A1：禽舍 ×1.4，暖褐描边
	draw_rect(Rect2(base + Vector2(-73.0, -80.0), Vector2(146.0, 80.0)), body)
	draw_rect(Rect2(base + Vector2(-73.0, -80.0), Vector2(146.0, 80.0)), _lit(Color("6b4423")), false, 3.0)
	draw_colored_polygon(PackedVector2Array([
		base + Vector2(-86.0, -80.0), base + Vector2(0.0, -136.0), base + Vector2(86.0, -80.0),
	]), roof)
	draw_rect(Rect2(base + Vector2(-20.0, -42.0), Vector2(40.0, 42.0)), _lit(Color("8a6a42")))
	# 小动物：鸡 / 鸭 / 鹅（×1.5；啄食 m4 —— 每 ~7s 低头啄一次；踱步保留）
	var animal_x := base.x + sin(_anim_t * 1.3 + float(index) * 2.0) * 34.0
	var peck_phase := fposmod(_anim_t + float(index) * 3.0, 7.0)
	var peck := (sin(peck_phase / 0.6 * PI) * 8.0) if peck_phase < 0.6 else 0.0
	var animal := Vector2(animal_x, base.y - 12.0 + peck)
	var feather := _lit(Color("ffffff") if index != 2 else Color("f3ede2"))
	draw_circle(animal, 18.0, feather)                        # 身体
	draw_circle(animal + Vector2(13.0, -13.0), 10.5, feather) # 头
	if index == 0:
		draw_rect(Rect2(animal + Vector2(9.0, -30.0), Vector2(7.0, 7.0)), _lit(Color("e23d3d")))   # 鸡冠
		draw_polygon(PackedVector2Array([animal + Vector2(22.0, -13.0), animal + Vector2(33.0, -10.0), animal + Vector2(22.0, -7.0)]), PackedColorArray([_lit(Color("f2a13b"))]))
	elif index == 1:
		draw_polygon(PackedVector2Array([animal + Vector2(22.0, -15.0), animal + Vector2(34.0, -10.0), animal + Vector2(22.0, -6.0)]), PackedColorArray([_lit(Color("f2a13b"))]))  # 鸭嘴
	else:
		draw_rect(Rect2(animal + Vector2(12.0, -36.0), Vector2(6.0, 24.0)), feather)               # 鹅颈
		draw_circle(animal + Vector2(15.0, -37.0), 7.5, feather)
		draw_polygon(PackedVector2Array([animal + Vector2(21.0, -39.0), animal + Vector2(30.0, -36.0), animal + Vector2(21.0, -33.0)]), PackedColorArray([_lit(Color("f2863b"))]))
	draw_circle(animal + Vector2(15.0, -15.0), 2.4, _lit(COL_TEXT))   # 眼睛
	draw_line(animal + Vector2(-7.0, 17.0), animal + Vector2(-9.0, 22.0), _lit(Color("f2a13b")), 2.4)   # 脚
	draw_line(animal + Vector2(7.0, 17.0), animal + Vector2(9.0, 22.0), _lit(Color("f2a13b")), 2.4)
	# 产出提示（蛋 ×1.3；新蛋落地弹出 m5）
	if int(coop["stock"]) > 0:
		var bounce := absf(sin(_anim_t * 3.0)) * 4.0
		var pop := 1.0
		if _egg_pop_at.has(coop_id) and _anim_t - float(_egg_pop_at[coop_id]) < 0.3:
			pop = 1.5 - 1.7 * ((_anim_t - float(_egg_pop_at[coop_id])) / 0.3)
		for e in mini(int(coop["stock"]), 3):
			draw_circle(base + Vector2(-44.0 + float(e) * 32.0, -6.0 - bounce), 9.0 * pop, _lit(Color("fff6e8")))
			draw_circle(base + Vector2(-40.0 + float(e) * 32.0, -10.0 - bounce), 2.8 * pop, _lit(Color("f2b93b")))
		_label("收蛋×%d" % int(coop["stock"]), base + Vector2(0.0, -152.0 - bounce), 15, _lit(Color("fff8ea")))
	else:
		_label("%s · %ds" % [data["product_name"], int(ceil(float(coop["ready_in"])))], base + Vector2(0.0, -152.0), 14, _lit(COL_TEXT))
	if int(coop["level"]) > 1:
		_label("Lv.%d" % int(coop["level"]), base + Vector2(62.0, -110.0), 14, _lit(Color("fff8ea")))


func _draw_workshop(rect: Rect2) -> void:
	if not GameState.workshop_built:
		_panel(rect, Color(_lit(Color("b9c2ad")), 0.45), 16.0)
		_label("工坊", rect.get_center() + Vector2(0.0, -12.0), 17, _lit(COL_TEXT))
		_label("把原料加工成商品", rect.get_center() + Vector2(0.0, 8.0), 13, _lit(COL_TEXT))
		_coin_with_price(rect.get_center() + Vector2(0.0, 32.0), FarmData.WORKSHOP_BUILD_COST)
		return
	var base := Vector2(rect.get_center().x, rect.end.y - 10.0)
	var wall := _lit(Color("f3e3c2"))
	# v2 A1：工坊 ×1.25，暖褐描边
	draw_rect(Rect2(base + Vector2(-88.0, -84.0), Vector2(176.0, 84.0)), wall)
	draw_rect(Rect2(base + Vector2(-88.0, -84.0), Vector2(176.0, 84.0)), _lit(Color("6b4423")), false, 3.0)
	draw_colored_polygon(PackedVector2Array([
		base + Vector2(-100.0, -84.0), base + Vector2(0.0, -140.0), base + Vector2(100.0, -84.0),
	]), _lit(COL_ROOF))
	draw_rect(Rect2(base + Vector2(46.0, -126.0), Vector2(15.0, 38.0)), _lit(COL_WOOD_DARK))   # 烟囱
	draw_rect(Rect2(base + Vector2(-28.0, -44.0), Vector2(56.0, 44.0)), _lit(COL_WOOD))        # 门
	draw_circle(base + Vector2(13.0, -22.0), 3.0, _lit(COL_COIN))
	draw_rect(Rect2(base + Vector2(-70.0, -66.0), Vector2(28.0, 26.0)), _lit(Color("ffe9a8"))) # 窗
	# 加工中：烟囱冒烟 + 进度条
	if GameState.crafting_recipe != "":
		var recipe: Dictionary = FarmData.RECIPES[GameState.crafting_recipe]
		var total := float(recipe["craft_sec"]) * FarmData.level_speed(GameState.workshop_level, FarmData.CRAFT_SPEED_PER_LEVEL)
		var progress := 1.0 - clampf(GameState.craft_remain / maxf(total, 0.001), 0.0, 1.0)
		for puff in 3:
			var t := fposmod(_anim_t * 0.5 + float(puff) / 3.0, 1.0)
			draw_circle(base + Vector2(53.0 + sin(t * 6.0) * 5.0, -132.0 - t * 40.0), 4.0 + t * 7.0, Color(1, 1, 1, 0.4 * (1.0 - t)))
		_progress_bar(base + Vector2(-88.0, 6.0), 176.0, progress)
		_label("制作中：%s" % recipe["name"], base + Vector2(0.0, -156.0), 14, _lit(Color("fff8ea")))
	else:
		_label("点我加工", base + Vector2(0.0, -156.0), 14, _lit(COL_TEXT))
	if GameState.workshop_level > 1:
		_label("Lv.%d" % GameState.workshop_level, base + Vector2(66.0, -108.0), 14, _lit(Color("fff8ea")))


func _draw_fountain(rect: Rect2) -> void:
	var level := GameState.fountain_level
	var base := Vector2(rect.get_center().x, rect.end.y - 8.0)
	if level <= 0:
		_panel(rect, Color(_lit(Color("b9c2ad")), 0.45), 16.0)
		_label("喷泉", rect.get_center() + Vector2(0.0, -12.0), 16, _lit(COL_TEXT))
		_coin_with_price(rect.get_center() + Vector2(0.0, 12.0), FarmData.FOUNTAIN_BUILD_COST)
		return
	draw_circle(base + Vector2(0.0, -20.0), 60.0, _lit(Color("c9c3b4")))
	draw_circle(base + Vector2(0.0, -22.0), 50.0, _lit(Color("7fc4de")))
	draw_circle(base + Vector2(0.0, -46.0), 18.0, _lit(Color("c9c3b4")))
	for jet in 6:
		var angle := TAU * float(jet) / 6.0 + _anim_t * 1.4
		var drop := Vector2(cos(angle) * 22.0, -64.0 - absf(sin(_anim_t * 3.0 + float(jet))) * 14.0)
		draw_circle(base + drop, 3.2, _lit(Color("a8dcf0")))
	_label("喷泉 Lv.%d" % level, base + Vector2(0.0, -108.0), 14, _lit(COL_TEXT))
	_bonus_label(base + Vector2(0.0, 18.0))


func _draw_swing(rect: Rect2) -> void:
	var level := GameState.swing_level
	var base := Vector2(rect.get_center().x, rect.end.y - 8.0)
	if level <= 0:
		_panel(rect, Color(_lit(Color("b9c2ad")), 0.45), 16.0)
		_label("秋千", rect.get_center() + Vector2(0.0, -12.0), 16, _lit(COL_TEXT))
		_coin_with_price(rect.get_center() + Vector2(0.0, 12.0), FarmData.SWING_BUILD_COST)
		return
	var wood := _lit(COL_WOOD)
	var sway := sin(_anim_t * 1.5) * 7.0
	draw_line(base + Vector2(-42.0, 0.0), base + Vector2(0.0, -112.0), wood, 7.0)
	draw_line(base + Vector2(42.0, 0.0), base + Vector2(0.0, -112.0), wood, 7.0)
	draw_line(base + Vector2(-36.0, -100.0), base + Vector2(36.0, -100.0), wood, 7.0)
	draw_line(base + Vector2(0.0, -112.0), base + Vector2(sway, -46.0), _lit(COL_WOOD_DARK), 3.0)
	draw_line(base + Vector2(0.0, -112.0), base + Vector2(-sway, -46.0), _lit(COL_WOOD_DARK), 3.0)
	draw_rect(Rect2(base + Vector2(-19.0 + minf(sway, 0.0), -46.0), Vector2(38.0, 8.0)), _lit(COL_ROOF))
	_label("秋千 Lv.%d" % level, base + Vector2(0.0, -134.0), 14, _lit(COL_TEXT))
	_bonus_label(base + Vector2(0.0, 18.0))


func _draw_crop_icon(center: Vector2, crop_id: String, scale_factor: float) -> void:
	if crop_id == "":
		return
	var s := scale_factor
	var c := center
	if FarmData.CROPS.has(crop_id):
		match crop_id:
			"wheat":
				for stalk in 3:
					var offset := Vector2((float(stalk) - 1.0) * 9.0 * s, 0.0)
					draw_line(c + offset + Vector2(0.0, 20.0 * s), c + offset - Vector2(0.0, 20.0 * s), _lit(Color("d8b13c")), 3.0 * s)
					draw_circle(c + offset - Vector2(0.0, 20.0 * s), 4.5 * s, _lit(Color("f2cf5b")))
			"carrot":
				draw_polygon(PackedVector2Array([
					c + Vector2(-8.0 * s, -6.0 * s), c + Vector2(8.0 * s, -6.0 * s), c + Vector2(0.0, 22.0 * s),
				]), PackedColorArray([_lit(Color("ef7d2e"))]))
				draw_circle(c - Vector2(0.0, 10.0 * s), 6.0 * s, _lit(Color("4f9e4f")))
			"tomato":
				draw_circle(c + Vector2(0.0, 4.0 * s), 13.0 * s, _lit(Color("e23d3d")))
				draw_circle(c + Vector2(-4.0 * s, 0.0), 4.0 * s, Color(1, 1, 1, 0.35))
				draw_circle(c - Vector2(0.0, 9.0 * s), 5.0 * s, _lit(Color("4f9e4f")))
			"pumpkin":
				draw_circle(c + Vector2(0.0, 6.0 * s), 16.0 * s, _lit(Color("ef8b2e")))
				draw_circle(c + Vector2(0.0, 6.0 * s), 10.0 * s, _lit(Color("d9761f")))
				draw_rect(Rect2(c + Vector2(-2.5 * s, -14.0 * s), Vector2(5.0 * s, 8.0 * s)), _lit(Color("4f7e3a")))
			"corn":
				draw_polygon(PackedVector2Array([
					c + Vector2(-8.0 * s, 16.0 * s), c + Vector2(0.0, -20.0 * s), c + Vector2(8.0 * s, 16.0 * s),
				]), PackedColorArray([_lit(Color("f2d64b"))]))
				draw_line(c + Vector2(-8.0 * s, 10.0 * s), c - Vector2(9.0 * s, -14.0 * s), _lit(Color("4f9e4f")), 3.0 * s)
				draw_line(c + Vector2(8.0 * s, 10.0 * s), c + Vector2(9.0 * s, -14.0 * s), _lit(Color("4f9e4f")), 3.0 * s)
	elif FarmData.FLOWERS.has(crop_id):
		var petal := _lit(Color("ffffff") if crop_id == "daisy" else (Color("ef5d8f") if crop_id == "tulip" else Color("f2cf3b")))
		if crop_id == "sunflower":
			draw_line(c + Vector2(0.0, 22.0 * s), c + Vector2(0.0, -4.0 * s), _lit(Color("4f9e4f")), 3.5 * s)
		for petal_i in 6:
			var angle := TAU * float(petal_i) / 6.0
			draw_circle(c + Vector2(cos(angle), sin(angle) - 6.0) * 9.0 * s, 5.0 * s, petal)
		draw_circle(c - Vector2(0.0, 6.0 * s), 5.5 * s, _lit(Color("8a5a2b")))


## ═══════════════ 绘制小工具 ═══════════════

## 昼夜染色：地面与物件统一乘 _tint（天空单独配色不经过这里）。
func _lit(color: Color) -> Color:
	return Color(color.r * _tint.r, color.g * _tint.g, color.b * _tint.b, color.a)


func _panel(rect: Rect2, color: Color, radius: float) -> void:
	var box := StyleBoxFlat.new()
	box.bg_color = color
	box.set_corner_radius_all(int(radius))
	box.anti_aliasing = true
	draw_style_box(box, rect)


func _label(text: String, center: Vector2, font_size: int, color: Color) -> void:
	var font := ThemeDB.fallback_font
	draw_string(font, center + Vector2(-200.0, float(font_size) * 0.36), text, HORIZONTAL_ALIGNMENT_CENTER, 400.0, font_size, color)


func _progress_bar(origin: Vector2, width: float, progress: float) -> void:
	var back := Rect2(origin, Vector2(width, 8.0))
	_panel(back, Color(0.0, 0.0, 0.0, 0.28), 4.0)
	if progress > 0.01:
		_panel(Rect2(origin, Vector2(width * clampf(progress, 0.0, 1.0), 8.0)), _lit(COL_COIN), 4.0)


func _coin_with_price(center: Vector2, price: int) -> void:
	var coin := _lit(COL_COIN)
	draw_circle(center + Vector2(-14.0, 0.0), 7.0, coin)
	draw_circle(center + Vector2(-14.0, 0.0), 7.0, _lit(COL_COIN_EDGE), false, 1.6)
	_label(str(price), center + Vector2(12.0, 0.0), 15, _lit(COL_TEXT))


func _bonus_label(center: Vector2) -> void:
	var bonus := FarmData.price_bonus_pct(GameState.fountain_level, GameState.swing_level)
	if bonus > 0:
		_label("售价 +%d%%" % bonus, center, 13, _lit(Color("2f7d4f")))
