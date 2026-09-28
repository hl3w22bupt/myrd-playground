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
const REGION_HEIGHTS: Array[float] = [268.0, 218.0, 202.0, 182.0, 246.0]
const REGION_NAMES: Array[String] = ["菜园", "果园", "鸡鸭鹅舍", "小花园", "休闲天地"]
const TOP_RESERVE: float = 118.0
const BOTTOM_RESERVE: float = 26.0

var _hotspots: Array[Dictionary] = []
var _region_rects: Array[Rect2] = []
var _sky_rect := Rect2()
var _house_pos := Vector2.ZERO
var _stars: Array[Vector2] = []
var _anim_t := 0.0
var _tint := Color(1, 1, 1)          # 昼夜对「地面与物件」的染色，天空单独配色
var _star_rng := RandomNumberGenerator.new()


func _ready() -> void:
	_star_rng.seed = 20260928
	for i in 42:
		_stars.append(Vector2(_star_rng.randf_range(0.0, DESIGN_WIDTH), _star_rng.randf_range(4.0, 96.0)))
	get_viewport().size_changed.connect(_relayout)
	_relayout()


func _process(delta: float) -> void:
	_anim_t += delta
	_update_day_night()
	queue_redraw()


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
	# 菜园：3 列 × 2 行地块
	var garden := _region_rects[0]
	var cell := Vector2(118.0, 96.0)
	var grid_origin := Vector2(garden.get_center().x - cell.x * 1.5 - 10.0, garden.position.y + 34.0)
	for i in FarmData.PLOT_COUNT:
		var col := i % 3
		var row := i / 3
		var rect := Rect2(grid_origin + Vector2(col * (cell.x + 10.0), row * (cell.y + 12.0)), cell)
		_hotspots.append({"kind": "plot", "index": i, "rect": rect})
	# 果树：3 棵横向均布
	var orchard := _region_rects[1]
	for i in FarmData.TREES.size():
		var cx := orchard.get_center().x + (float(i) - 1.0) * 212.0
		_hotspots.append({"kind": "tree", "index": i, "rect": Rect2(cx - 78.0, orchard.position.y + 30.0, 156.0, orchard.size.y - 44.0)})
	# 养殖舍：3 座横向均布
	var coop_region := _region_rects[2]
	for i in FarmData.COOPS.size():
		var cx := coop_region.get_center().x + (float(i) - 1.0) * 212.0
		_hotspots.append({"kind": "coop", "index": i, "rect": Rect2(cx - 82.0, coop_region.position.y + 30.0, 164.0, coop_region.size.y - 44.0)})
	# 花圃：4 块一行
	var flower := _region_rects[3]
	var bed_cell := Vector2(146.0, 108.0)
	var bed_origin := Vector2(flower.get_center().x - bed_cell.x * 2.0 - 15.0, flower.position.y + 34.0)
	for i in FarmData.BED_COUNT:
		var rect := Rect2(bed_origin + Vector2(float(i) * (bed_cell.x + 10.0), 0.0), bed_cell)
		_hotspots.append({"kind": "bed", "index": i, "rect": rect})
	# 休闲天地：工坊 + 喷泉 + 秋千
	var leisure := _region_rects[4]
	var center_x := leisure.get_center().x
	_hotspots.append({"kind": "workshop", "index": 0, "rect": Rect2(center_x - 268.0, leisure.position.y + 40.0, 176.0, leisure.size.y - 56.0)})
	_hotspots.append({"kind": "fountain", "index": 0, "rect": Rect2(center_x - 66.0, leisure.position.y + 46.0, 132.0, leisure.size.y - 62.0)})
	_hotspots.append({"kind": "swing", "index": 0, "rect": Rect2(center_x + 92.0, leisure.position.y + 46.0, 132.0, leisure.size.y - 62.0)})


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


func _unhandled_input(event: InputEvent) -> void:
	var button := event as InputEventMouseButton
	if button == null or button.button_index != MOUSE_BUTTON_LEFT or not button.pressed:
		return
	var local_event := make_input_local(event) as InputEventMouseButton
	if local_event == null:
		return
	var spot := hit_at(local_event.position)
	if spot.is_empty():
		return
	tapped.emit(String(spot["kind"]), int(spot["index"]))
	get_viewport().set_input_as_handled()


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


func _draw_ground(size: Vector2) -> void:
	var grass := _lit(COL_GRASS)
	var grass_dark := _lit(COL_GRASS_DARK)
	draw_rect(Rect2(0.0, _sky_rect.size.y - 34.0, size.x, size.y), grass)
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
	# 区域之间的木栅栏
	for i in _region_rects.size():
		var rect := _region_rects[i]
		var fence_y := rect.position.y - 10.0
		if fence_y < _sky_rect.size.y:
			continue
		_draw_fence(Vector2(14.0, fence_y), size.x - 28.0)


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
	draw_rect(rect.grow(-5.0), _lit(COL_SOIL_DARK), false, 2.0)
	# 垄沟纹理
	for row in 3:
		var line_y := rect.position.y + 18.0 + float(row) * 24.0
		draw_line(Vector2(rect.position.x + 8.0, line_y), Vector2(rect.end.x - 8.0, line_y), Color(_lit(COL_SOIL_DARK), 0.6), 2.0)
	if slot["state"] == "growing":
		var progress := 1.0 - float(slot["remain"]) / maxf(float(slot["total"]), 0.001)
		_draw_crop_icon(rect.get_center(), String(slot["crop"]), 0.35 + 0.65 * progress)
		_progress_bar(rect.position + Vector2(8.0, rect.size.y - 14.0), rect.size.x - 16.0, progress)
	elif slot["state"] == "mature":
		var bounce := absf(sin(_anim_t * 3.2)) * 5.0
		_draw_crop_icon(rect.get_center() + Vector2(0.0, -bounce), String(slot["crop"]), 1.0)
		_label("收获", rect.position + Vector2(rect.size.x / 2.0, rect.size.y - 8.0), 14, _lit(Color("fff8ea")))


func _draw_bed(rect: Rect2, index: int) -> void:
	var slot: Dictionary = GameState.beds[index]
	if slot["state"] == "locked":
		_panel(rect, Color(_lit(Color("b9c2ad")), 0.5), 14.0)
		_label("未开垦", rect.get_center() + Vector2(0.0, -10.0), 15, _lit(COL_TEXT))
		_coin_with_price(rect.get_center() + Vector2(0.0, 16.0), FarmData.BED_UNLOCK_COSTS[index])
		return
	_panel(rect, _lit(Color("6d4f8f") if index % 2 == 0 else Color("8f4f5f")), 10.0)
	# 花圃围边
	draw_rect(rect.grow(-4.0), _lit(COL_WOOD), false, 3.0)
	if slot["state"] == "growing":
		var progress := 1.0 - float(slot["remain"]) / maxf(float(slot["total"]), 0.001)
		_draw_crop_icon(rect.get_center(), String(slot["crop"]), 0.35 + 0.65 * progress)
		_progress_bar(rect.position + Vector2(8.0, rect.size.y - 12.0), rect.size.x - 16.0, progress)
	elif slot["state"] == "mature":
		var bounce := absf(sin(_anim_t * 3.2 + float(index))) * 4.0
		_draw_crop_icon(rect.get_center() + Vector2(0.0, -bounce), String(slot["crop"]), 1.0)
		_label("摘花", rect.position + Vector2(rect.size.x / 2.0, rect.size.y - 6.0), 13, _lit(Color("fff8ea")))
	else:
		_label("点我种花", rect.get_center(), 14, Color(_lit(COL_TEXT_LIGHT), 0.85))


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
	draw_rect(Rect2(base + Vector2(-7.0, -46.0), Vector2(14.0, 46.0)), trunk)
	var leaf := _lit(Color("4f9e4f") if tree_id != "peach" else Color("e58fb1"))
	var sway := sin(_anim_t * 1.6 + float(index)) * 2.0
	draw_circle(base + Vector2(-22.0 + sway, -66.0), 26.0, leaf)
	draw_circle(base + Vector2(22.0 + sway, -64.0), 24.0, leaf)
	draw_circle(base + Vector2(0.0 + sway, -86.0), 30.0, leaf)
	if bool(tree["ready"]):
		var bounce := absf(sin(_anim_t * 3.0 + float(index))) * 4.0
		var fruit_col := _lit(Color("e23d3d") if tree_id == "apple" else (Color("cfd66a") if tree_id == "pear" else Color("f0956b")))
		for f in 4:
			var angle := TAU * float(f) / 4.0 + _anim_t * 0.4
			draw_circle(base + Vector2(cos(angle) * 20.0, -66.0 + sin(angle) * 14.0 - bounce), 6.5, fruit_col)
		_label("可摘", base + Vector2(0.0, -bounce - 118.0), 14, _lit(Color("fff8ea")))
	else:
		_label("%s · %ds" % [data["fruit_name"], int(ceil(float(tree["ready_in"])))] , base + Vector2(0.0, -112.0), 13, _lit(COL_TEXT))


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
	draw_rect(Rect2(base + Vector2(-52.0, -56.0), Vector2(104.0, 56.0)), body)
	draw_colored_polygon(PackedVector2Array([
		base + Vector2(-62.0, -56.0), base + Vector2(0.0, -96.0), base + Vector2(62.0, -56.0),
	]), roof)
	draw_rect(Rect2(base + Vector2(-14.0, -30.0), Vector2(28.0, 30.0)), _lit(Color("8a6a42")))
	# 小动物：鸡 / 鸭 / 鹅（体色与喙形区分，呆萌系）
	var animal_x := base.x + sin(_anim_t * 1.3 + float(index) * 2.0) * 26.0
	var animal := Vector2(animal_x, base.y - 10.0)
	var feather := _lit(Color("ffffff") if index != 2 else Color("f3ede2"))
	draw_circle(animal, 12.0, feather)                      # 身体
	draw_circle(animal + Vector2(9.0, -9.0), 7.0, feather)  # 头
	if index == 0:
		draw_rect(Rect2(animal + Vector2(6.0, -20.0), Vector2(5.0, 5.0)), _lit(Color("e23d3d")))   # 鸡冠
		draw_polygon(PackedVector2Array([animal + Vector2(15.0, -9.0), animal + Vector2(22.0, -7.0), animal + Vector2(15.0, -5.0)]), PackedColorArray([_lit(Color("f2a13b"))]))
	elif index == 1:
		draw_polygon(PackedVector2Array([animal + Vector2(15.0, -10.0), animal + Vector2(23.0, -7.0), animal + Vector2(15.0, -4.0)]), PackedColorArray([_lit(Color("f2a13b"))]))  # 鸭嘴
	else:
		draw_rect(Rect2(animal + Vector2(8.0, -24.0), Vector2(4.0, 16.0)), feather)                # 鹅颈
		draw_circle(animal + Vector2(10.0, -25.0), 5.0, feather)
		draw_polygon(PackedVector2Array([animal + Vector2(14.0, -26.0), animal + Vector2(20.0, -24.0), animal + Vector2(14.0, -22.0)]), PackedColorArray([_lit(Color("f2863b"))]))
	draw_circle(animal + Vector2(10.0, -10.5), 1.6, _lit(COL_TEXT))   # 眼睛
	# 产出提示
	if int(coop["stock"]) > 0:
		var bounce := absf(sin(_anim_t * 3.0)) * 4.0
		for e in mini(int(coop["stock"]), 3):
			draw_circle(base + Vector2(-30.0 + float(e) * 22.0, -6.0 - bounce), 7.0, _lit(Color("fff6e8")))
			draw_circle(base + Vector2(-27.0 + float(e) * 22.0, -9.0 - bounce), 2.2, _lit(Color("f2b93b")))
		_label("收蛋×%d" % int(coop["stock"]), base + Vector2(0.0, -110.0 - bounce), 14, _lit(Color("fff8ea")))
	else:
		_label("%s · %ds" % [data["product_name"], int(ceil(float(coop["ready_in"])))], base + Vector2(0.0, -110.0), 13, _lit(COL_TEXT))
	if int(coop["level"]) > 1:
		_label("Lv.%d" % int(coop["level"]), base + Vector2(44.0, -78.0), 13, _lit(Color("fff8ea")))


func _draw_workshop(rect: Rect2) -> void:
	if not GameState.workshop_built:
		_panel(rect, Color(_lit(Color("b9c2ad")), 0.45), 16.0)
		_label("工坊", rect.get_center() + Vector2(0.0, -12.0), 17, _lit(COL_TEXT))
		_label("把原料加工成商品", rect.get_center() + Vector2(0.0, 8.0), 13, _lit(COL_TEXT))
		_coin_with_price(rect.get_center() + Vector2(0.0, 32.0), FarmData.WORKSHOP_BUILD_COST)
		return
	var base := Vector2(rect.get_center().x, rect.end.y - 10.0)
	var wall := _lit(Color("f3e3c2"))
	draw_rect(Rect2(base + Vector2(-70.0, -66.0), Vector2(140.0, 66.0)), wall)
	draw_colored_polygon(PackedVector2Array([
		base + Vector2(-80.0, -66.0), base + Vector2(0.0, -112.0), base + Vector2(80.0, -66.0),
	]), _lit(COL_ROOF))
	draw_rect(Rect2(base + Vector2(36.0, -100.0), Vector2(12.0, 30.0)), _lit(COL_WOOD_DARK))   # 烟囱
	draw_rect(Rect2(base + Vector2(-22.0, -34.0), Vector2(44.0, 34.0)), _lit(COL_WOOD))        # 门
	draw_circle(base + Vector2(10.0, -18.0), 2.5, _lit(COL_COIN))
	draw_rect(Rect2(base + Vector2(-56.0, -52.0), Vector2(22.0, 20.0)), _lit(Color("ffe9a8"))) # 窗
	# 加工中：烟囱冒烟 + 进度条
	if GameState.crafting_recipe != "":
		var recipe: Dictionary = FarmData.RECIPES[GameState.crafting_recipe]
		var total := float(recipe["craft_sec"]) * FarmData.level_speed(GameState.workshop_level, FarmData.CRAFT_SPEED_PER_LEVEL)
		var progress := 1.0 - clampf(GameState.craft_remain / maxf(total, 0.001), 0.0, 1.0)
		for puff in 3:
			var t := fposmod(_anim_t * 0.5 + float(puff) / 3.0, 1.0)
			draw_circle(base + Vector2(42.0 + sin(t * 6.0) * 5.0, -108.0 - t * 40.0), 4.0 + t * 7.0, Color(1, 1, 1, 0.4 * (1.0 - t)))
		_progress_bar(base + Vector2(-70.0, 6.0), 140.0, progress)
		_label("制作中：%s" % recipe["name"], base + Vector2(0.0, -128.0), 14, _lit(Color("fff8ea")))
	else:
		_label("点我加工", base + Vector2(0.0, -128.0), 14, _lit(COL_TEXT))
	if GameState.workshop_level > 1:
		_label("Lv.%d" % GameState.workshop_level, base + Vector2(52.0, -86.0), 13, _lit(Color("fff8ea")))


func _draw_fountain(rect: Rect2) -> void:
	var level := GameState.fountain_level
	var base := Vector2(rect.get_center().x, rect.end.y - 8.0)
	if level <= 0:
		_panel(rect, Color(_lit(Color("b9c2ad")), 0.45), 16.0)
		_label("喷泉", rect.get_center() + Vector2(0.0, -12.0), 16, _lit(COL_TEXT))
		_coin_with_price(rect.get_center() + Vector2(0.0, 12.0), FarmData.FOUNTAIN_BUILD_COST)
		return
	draw_circle(base + Vector2(0.0, -18.0), 44.0, _lit(Color("c9c3b4")))
	draw_circle(base + Vector2(0.0, -20.0), 36.0, _lit(Color("7fc4de")))
	draw_circle(base + Vector2(0.0, -34.0), 14.0, _lit(Color("c9c3b4")))
	for jet in 5:
		var angle := TAU * float(jet) / 5.0 + _anim_t * 1.4
		var drop := Vector2(cos(angle) * 16.0, -46.0 - absf(sin(_anim_t * 3.0 + float(jet))) * 10.0)
		draw_circle(base + drop, 2.6, _lit(Color("a8dcf0")))
	_label("喷泉 Lv.%d" % level, base + Vector2(0.0, -78.0), 13, _lit(COL_TEXT))
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
	var sway := sin(_anim_t * 1.5) * 5.0
	draw_line(base + Vector2(-30.0, 0.0), base + Vector2(0.0, -78.0), wood, 5.0)
	draw_line(base + Vector2(30.0, 0.0), base + Vector2(0.0, -78.0), wood, 5.0)
	draw_line(base + Vector2(-26.0, -70.0), base + Vector2(26.0, -70.0), wood, 5.0)
	draw_line(base + Vector2(0.0, -78.0), base + Vector2(sway, -34.0), _lit(COL_WOOD_DARK), 2.0)
	draw_line(base + Vector2(0.0, -78.0), base + Vector2(-sway, -34.0), _lit(COL_WOOD_DARK), 2.0)
	draw_rect(Rect2(base + Vector2(-14.0 + minf(sway, 0.0) - 0.0, -34.0), Vector2(28.0, 6.0)), _lit(COL_ROOF))
	_label("秋千 Lv.%d" % level, base + Vector2(0.0, -96.0), 13, _lit(COL_TEXT))
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
