class_name Board
extends Node2D
## 三消棋盘：核心逻辑（类型矩阵 + 三连匹配 + 重力补充 + 交换裁决）与视觉（底板 + 糖果节点）。
##
## 设计要点：
## - 逻辑真源是 types 矩阵（int），糖果节点只是矩阵的可视化 → 匹配/重力全部纯数组运算，
##   无头冒烟可以确定性断言（find_valid_swap 扫描真实矩阵，结果可复现）；
## - 结算走「波次」：收集 → 加分 → 重力补充 → 再查匹配，连锁自然形成（每波分数翻倍）；
## - 加分/扣步/胜负判定通过 GameState（autoload）完成，棋盘不直接改 UI。

## 一次有效交换收集到糖果时发出（参数 = 本波收集数累计），冒烟场景断言用。
signal candies_collected(count: int)
## 死局自动洗牌完成时发出（棋盘保证已有可行交换），Main 订阅后给出行内提示。
signal shuffled()

const COLS: int = 6
const ROWS: int = 6
## 竖屏设计分辨率（720×1280，aspect=expand）下的格子边长：棋盘 6×96=576px，
## 居中后两侧余 72px；390pt 宽的窄屏上单格触点 ≈52pt，高于 44pt 触摸热区下限。
const CELL: float = 96.0
## 糖果种类数（Candy.Kind 共 5 种）。
const CANDY_KINDS: int = 5
## 每颗糖果基础分（连锁波次 ×1/×2/×3 递增）。
const POINTS_PER_CANDY: int = 20
## 四连 / 五连加成（一次收集内最长直线 ≥4 / ≥5 时额外加）。
const FOUR_RUN_BONUS: int = 40
const FIVE_RUN_BONUS: int = 100
## 空格哨兵值（重力下沉 / 待补充）。
const EMPTY: int = -1
## 死局洗牌重试上限：每次全盘 Fisher-Yates 后校验「无现成三连 + 有可行交换」，
## 全部失败（概率 ~0）则落到确定性可解布局兜底，保证本函数必然产出可解棋盘。
const SHUFFLE_ATTEMPTS: int = 256

const CANDY_SCENE: PackedScene = preload("res://scenes/candy.tscn")

var rng := RandomNumberGenerator.new()
## 类型矩阵：types[x][y]，x=列（0..COLS-1），y=行（0=最上行）。
var types: Array = []
## 糖果节点的挂载层（_ready 里代码创建，重建棋子时整体清空）。
var candies_root: Node2D = Node2D.new()
## 最近一次结算的统计（冒烟断言 + 调参观测用）：波数与全程最长直线。
var last_wave_count: int = 0
var last_max_run: int = 0


func _ready() -> void:
	candies_root.name = "Candies"
	add_child(candies_root)
	new_game()


## 开新一局：重填棋盘（保证开局无现成三连）+ 死局兜底 + 重建糖果节点。
func new_game() -> void:
	rng.randomize()
	_fx_bursts.clear()
	_fx_texts.clear()
	_invalid_fx_tweens.clear()
	_fill_grid()
	ensure_solvable()
	_rebuild_candy_nodes()


## 玩家可见的格子中心（本地坐标）；光标与糖果共用，保证对齐。
func cell_to_position(cell: Vector2i) -> Vector2:
	return Vector2(cell.x * CELL + CELL * 0.5, cell.y * CELL + CELL * 0.5)


## 交换两相邻格：能三消则结算并消耗一步，否则原样换回（不耗步）。
func try_swap(a: Vector2i, b: Vector2i) -> bool:
	if not _in_bounds(a) or not _in_bounds(b) or not _are_adjacent(a, b):
		return false
	if types[a.x][a.y] == EMPTY or types[b.x][b.y] == EMPTY:
		return false
	_swap_types(a, b)
	if find_matches().is_empty():
		_swap_types(a, b)
		return false
	_resolve_cascades()
	_rebuild_candy_nodes()
	ensure_solvable()
	GameState.use_move()
	GameState.check_end()
	return true


## 返回所有处于三连及以上直线中的格子（行扫描 + 列扫描）。
func find_matches() -> Array[Vector2i]:
	var matched: Array[Vector2i] = []
	for y in ROWS:
		var run_start: int = 0
		for x in range(1, COLS + 1):
			var same: bool = x < COLS and types[x][y] != EMPTY and types[x][y] == types[x - 1][y]
			if not same:
				if x - run_start >= 3:
					for i in range(run_start, x):
						matched.append(Vector2i(i, y))
				run_start = x
	for x in COLS:
		var run_start_y: int = 0
		for y in range(1, ROWS + 1):
			var same_y: bool = y < ROWS and types[x][y] != EMPTY and types[x][y] == types[x][y - 1]
			if not same_y:
				if y - run_start_y >= 3:
					for i in range(run_start_y, y):
						matched.append(Vector2i(x, i))
				run_start_y = y
	return matched


## 找到一组「交换后必定三消」的相邻格 [a, b]；找不到返回空数组。
## 冒烟场景用它驱动真实输入链路（选中 → 移动 → 交换），结果对当前矩阵确定。
func find_valid_swap() -> Array[Vector2i]:
	var directions: Array[Vector2i] = [Vector2i.RIGHT, Vector2i.DOWN]
	for y in ROWS:
		for x in COLS:
			var cell := Vector2i(x, y)
			for direction in directions:
				var other := cell + direction
				if other.x >= COLS or other.y >= ROWS:
					continue
				if _swap_creates_match(cell, other):
					return [cell, other]
	return []


## 死局守卫：盘面没有可行交换时自动洗牌，保证玩家永远有棋可下（卡死角 = 缺陷）。
## 每次洗牌后校验「无现成三连 + 有可行交换」；重试 SHUFFLE_ATTEMPTS 次仍不行
## （概率 ~0）就落到确定性可解布局兜底 —— 本函数必然产出可解棋盘，冒烟可无条件断言。
func ensure_solvable() -> void:
	if not find_valid_swap().is_empty():
		return
	for attempt in SHUFFLE_ATTEMPTS:
		_shuffle_types()
		if find_matches().is_empty() and not find_valid_swap().is_empty():
			_rebuild_candy_nodes()
			shuffled.emit()
			return
	_fill_valid_fallback()
	_rebuild_candy_nodes()
	shuffled.emit()


## 全盘 Fisher-Yates 洗牌：只重排现有类型，不改变颜色分布。
func _shuffle_types() -> void:
	var pool: Array[int] = []
	for x in COLS:
		for y in ROWS:
			if types[x][y] != EMPTY:
				pool.append(types[x][y])
	for x in COLS:
		for y in ROWS:
			var pick := rng.randi_range(0, pool.size() - 1)
			types[x][y] = pool[pick]
			pool.remove_at(pick)


## 洗牌重试耗尽的确定性兜底布局（手工验证：无现成三连，且 (1,0)↔(1,1) 交换必三消）。
## 前三行手工排布，后三行走 (x + 2y) mod 5 模式 —— 模式行列均无相邻同色。
func _fill_valid_fallback() -> void:
	var top_rows: Array = [
		[0, 0, 1, 1, 2, 2],
		[1, 1, 2, 2, 0, 0],
		[2, 2, 0, 0, 1, 1],
	]
	for x in COLS:
		for y in ROWS:
			if y < top_rows.size():
				types[x][y] = top_rows[y][x]
			else:
				types[x][y] = (x + 2 * y) % CANDY_KINDS


## 单波计分公式（纯函数，无随机 —— 冒烟场景对具体数值断言）：
## 基础 = 收集数 × 单颗分 × 波次倍率（第 1 波 ×1、第 2 波 ×2 …连锁越深越值钱）；
## 本波最长直线 ≥4 额外 +FOUR_RUN_BONUS，≥5 额外 +FIVE_RUN_BONUS（鼓励憋大MATCH）。
static func score_for_wave(cells: int, wave: int, run: int) -> int:
	var score: int = cells * POINTS_PER_CANDY * wave
	if run >= 5:
		score += FIVE_RUN_BONUS
	elif run >= 4:
		score += FOUR_RUN_BONUS
	return score


## 结算连锁：收集 → 加分（波次翻倍 + 长连加成）→ 重力补充，直到无匹配。
func _resolve_cascades() -> void:
	var wave: int = 1
	var collected_total: int = 0
	last_wave_count = 0
	last_max_run = 0
	while true:
		var matched := find_matches()
		if matched.is_empty():
			break
		var run: int = _max_run_length()
		last_max_run = maxi(last_max_run, run)
		var gained: int = score_for_wave(matched.size(), wave, run)
		for cell in matched:
			types[cell.x][cell.y] = EMPTY
		_spawn_collect_fx(matched, gained)
		GameState.add_score(gained)
		collected_total += matched.size()
		last_wave_count = wave
		_apply_gravity_and_refill()
		wave += 1
	if collected_total > 0:
		candies_collected.emit(collected_total)


## 当前矩阵最长同色直线长度（行/列扫描，≥2 才有意义；供长连加成与冒烟断言）。
func _max_run_length() -> int:
	var best: int = 1
	for y in ROWS:
		var run: int = 1
		for x in range(1, COLS):
			if types[x][y] != EMPTY and types[x][y] == types[x - 1][y]:
				run += 1
				best = maxi(best, run)
			else:
				run = 1
	for x in COLS:
		var run_y: int = 1
		for y in range(1, ROWS):
			if types[x][y] != EMPTY and types[x][y] == types[x][y - 1]:
				run_y += 1
				best = maxi(best, run_y)
			else:
				run_y = 1
	return best


## 每列非空类型下沉到底部，顶部空洞用随机类型补满（可能立即形成新匹配 → 连锁）。
func _apply_gravity_and_refill() -> void:
	for x in COLS:
		var write_y: int = ROWS - 1
		for y in range(ROWS - 1, -1, -1):
			if types[x][y] != EMPTY:
				var kind: int = types[x][y]
				types[x][y] = EMPTY
				types[x][write_y] = kind
				write_y -= 1
		for y in range(write_y, -1, -1):
			types[x][y] = rng.randi_range(0, CANDY_KINDS - 1)


## 开局填充：逐格选型并避开「与左两格 / 上两格同色」，保证开局零现成三连。
func _fill_grid() -> void:
	types = []
	for x in COLS:
		var column: Array = []
		for y in ROWS:
			column.append(EMPTY)
		types.append(column)
	for x in COLS:
		for y in ROWS:
			types[x][y] = _pick_type(Vector2i(x, y))


## 选型：排除会立刻完成三连的类型（左侧两格同色 / 上方两格同色）。
func _pick_type(cell: Vector2i) -> int:
	var banned: Array[int] = []
	if cell.x >= 2 and types[cell.x - 1][cell.y] == types[cell.x - 2][cell.y]:
		banned.append(types[cell.x - 1][cell.y])
	if cell.y >= 2 and types[cell.x][cell.y - 1] == types[cell.x][cell.y - 2]:
		banned.append(types[cell.x][cell.y - 1])
	var kind := rng.randi_range(0, CANDY_KINDS - 1)
	var guard: int = 0
	while kind in banned and guard < 32:
		kind = rng.randi_range(0, CANDY_KINDS - 1)
		guard += 1
	return kind


func _swap_creates_match(a: Vector2i, b: Vector2i) -> bool:
	_swap_types(a, b)
	var creates: bool = not find_matches().is_empty()
	_swap_types(a, b)
	return creates


func _swap_types(a: Vector2i, b: Vector2i) -> void:
	var tmp: int = types[a.x][a.y]
	types[a.x][a.y] = types[b.x][b.y]
	types[b.x][b.y] = tmp


func _in_bounds(cell: Vector2i) -> bool:
	return cell.x >= 0 and cell.y >= 0 and cell.x < COLS and cell.y < ROWS


func _are_adjacent(a: Vector2i, b: Vector2i) -> bool:
	return absi(a.x - b.x) + absi(a.y - b.y) == 1


## 重建糖果节点：清空挂载层后按矩阵重新实例化（36 节点，代价可忽略），
## 新棋子带 0.16s 缩放入场（TRANS_BACK 回弹），tween 绑定在棋子节点上、随节点释放。
func _rebuild_candy_nodes() -> void:
	for child in candies_root.get_children():
		child.queue_free()
	for x in COLS:
		for y in ROWS:
			if types[x][y] == EMPTY:
				continue
			var candy: Candy = CANDY_SCENE.instantiate()
			candy.kind = types[x][y]
			candy.position = cell_to_position(Vector2i(x, y))
			candy.scale = Vector2(0.6, 0.6)
			candies_root.add_child(candy)
			var tween := candy.create_tween()
			tween.tween_property(candy, "scale", Vector2.ONE, SPAWN_TWEEN_SEC) \
				.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)


## ---- 消除反馈 FX（粒子爆发 + 飘分文字）----
## Board 自绘（_draw），不引入额外脚本/场景：headless 冒烟与 preflight 接线检查零风险。

const FX_LIFE_SEC: float = 0.5
const FX_PARTICLES: int = 12
const FX_RING_RADIUS: float = 46.0
const FX_TEXT_RISE: float = 56.0
const FX_COLOR_GOLD: Color = Color(1.0, 0.85, 0.35, 1.0)
const SPAWN_TWEEN_SEC: float = 0.16

## ---- 无效交换反馈（涉事糖果抖动/缩小回弹动画）----
## 时长分解：缩小 0.08 + 抖动 4 步 ×0.07 + 回弹归位 0.14 = 0.5 秒（明显可感知的失败反馈）。
const INVALID_FX_SEC: float = 0.5
const INVALID_FX_SHRINK_SEC: float = 0.08
const INVALID_FX_SHAKE_STEP_SEC: float = 0.07
const INVALID_FX_SETTLE_SEC: float = 0.14
## 抖动振幅序列（设计像素，逐段衰减）：-8 → +6 → -4 → +2，最后一吻回到格心。
const INVALID_SHAKE_AMPS: Array[float] = [8.0, 6.0, 4.0, 2.0]
## 抖动时的缩小倍率（回弹由 settle 段 TRANS_BACK 完成）。
const INVALID_SHRINK_SCALE: float = 0.72

## 正在播放无效交换动画的糖果 → tween（实例 ID 索引；同颗糖果连击时杀旧动画防叠加）。
var _invalid_fx_tweens: Dictionary = {}

## 粒子爆发与飘分：age 由 _process 推进，超龄即剔除；非空期间每帧 queue_redraw。
var _fx_bursts: Array[Dictionary] = []
var _fx_texts: Array[Dictionary] = []


func _process(delta: float) -> void:
	if _fx_bursts.is_empty() and _fx_texts.is_empty():
		return
	for burst in _fx_bursts:
		burst["age"] = float(burst["age"]) + delta
	_fx_bursts = _fx_bursts.filter(func(b: Dictionary) -> bool: return float(b["age"]) < FX_LIFE_SEC)
	for text in _fx_texts:
		text["age"] = float(text["age"]) + delta
	_fx_texts = _fx_texts.filter(func(t: Dictionary) -> bool: return float(t["age"]) < FX_LIFE_SEC)
	queue_redraw()


## 收集反馈：在匹配质心爆一圈金色粒子，并弹出「+分数」飘字。
func _spawn_collect_fx(cells: Array[Vector2i], gained: int) -> void:
	if cells.is_empty():
		return
	var centroid := Vector2.ZERO
	for cell in cells:
		centroid += cell_to_position(cell)
	centroid /= float(cells.size())
	var particles: Array[Dictionary] = []
	for i in FX_PARTICLES:
		var angle := TAU * float(i) / float(FX_PARTICLES) + rng.randf_range(-0.25, 0.25)
		particles.append({
			"dir": Vector2.from_angle(angle),
			"dist": rng.randf_range(FX_RING_RADIUS * 0.5, FX_RING_RADIUS),
			"size": rng.randf_range(3.0, 6.0),
		})
	_fx_bursts.append({"pos": centroid, "age": 0.0, "particles": particles})
	_fx_texts.append({"pos": centroid, "age": 0.0, "text": "+%d" % gained})
	queue_redraw()


## 底板视觉：圆角深色面板 + 内嵌格子凹槽 + 棋盘格微条纹 + 消除 FX。
func _draw() -> void:
	var panel := StyleBoxFlat.new()
	panel.bg_color = Color(0.13, 0.11, 0.24, 0.88)
	panel.set_corner_radius_all(16)
	panel.shadow_color = Color(0.0, 0.0, 0.0, 0.35)
	panel.shadow_size = 12
	var board_size := Vector2(COLS * CELL, ROWS * CELL)
	panel.draw(get_canvas_item(), Rect2(Vector2(-10.0, -10.0), board_size + Vector2(20.0, 20.0)))
	for x in COLS:
		for y in ROWS:
			var cell_rect := Rect2(Vector2(x * CELL, y * CELL), Vector2(CELL, CELL))
			if (x + y) % 2 == 0:
				draw_rect(cell_rect, Color(1.0, 1.0, 1.0, 0.03))
			# 格子凹槽：内缩 5px 的圆角深色块，让糖果「嵌」进棋盘。
			var well := StyleBoxFlat.new()
			well.bg_color = Color(0.0, 0.0, 0.0, 0.22)
			well.set_corner_radius_all(10)
			well.set_border_width_all(2)
			well.border_color = Color(1.0, 1.0, 1.0, 0.05)
			well.draw(get_canvas_item(), cell_rect.grow(-5.0))
	_draw_fx()


## 粒子爆发（扩散圆环 + 外飞粒子）与飘分文字（上浮渐隐），全部随 age 归一化插值。
func _draw_fx() -> void:
	var progress_scale := 1.0 / FX_LIFE_SEC
	for burst in _fx_bursts:
		var age: float = float(burst["age"])
		var t: float = clampf(age * progress_scale, 0.0, 1.0)
		var pos: Vector2 = burst["pos"]
		var ring_radius: float = FX_RING_RADIUS * (0.4 + 0.6 * t)
		draw_arc(pos, ring_radius, 0.0, TAU, 24, Color(FX_COLOR_GOLD, 1.0 - t), 3.0)
		for particle in burst["particles"]:
			var dir: Vector2 = particle["dir"]
			var flight: float = float(particle["dist"]) * t
			var size: float = float(particle["size"]) * (1.0 - t)
			draw_circle(pos + dir * flight, maxf(size, 0.5), Color(FX_COLOR_GOLD, 1.0 - t))
	var font: Font = ThemeDB.fallback_font
	for text in _fx_texts:
		var age_text: float = float(text["age"])
		var t_text: float = clampf(age_text * progress_scale, 0.0, 1.0)
		var pos_text: Vector2 = text["pos"] - Vector2(0.0, FX_TEXT_RISE * t_text)
		draw_string(font, pos_text + Vector2(-24.0, 0.0), text["text"],
			HORIZONTAL_ALIGNMENT_CENTER, 48.0, 26, Color(FX_COLOR_GOLD, 1.0 - t_text))


## ---- 无效交换反馈 ----
## 涉事两颗糖果做约 0.5 秒「缩小 → 左右抖动 → 回弹归位」动画。只动视觉节点：
## 类型矩阵、输入状态机、GameAudio 的 unlocked 逻辑一概不碰 —— 玩家可立即再次发起交换。

## 无效交换入口（Main 在 try_swap 失败分支调用）：给 a/b 两格的糖果各播一段动画。
func play_invalid_swap_fx(a: Vector2i, b: Vector2i) -> void:
	_prune_invalid_fx_tweens()
	for cell in [a, b]:
		var candy := _candy_at(cell)
		if candy != null:
			_animate_invalid_swap(candy, cell)


## 正在播放无效交换动画的糖果数（冒烟断言用；按有效 tween 实时统计，
## 动画播完或糖果被重建释放即不计入 —— 不需要 signal 记账，天然无泄漏）。
func invalid_fx_playing_count() -> int:
	var count: int = 0
	for tween: Tween in _invalid_fx_tweens.values():
		if tween != null and tween.is_valid() and tween.is_running():
			count += 1
	return count


## 按格心位置找糖果节点：糖果节点与类型矩阵一一对应（位置即身份），找不到返回 null。
func _candy_at(cell: Vector2i) -> Candy:
	if not _in_bounds(cell) or types[cell.x][cell.y] == EMPTY:
		return null
	var home := cell_to_position(cell)
	for child in candies_root.get_children():
		var candy := child as Candy
		if candy != null and candy.position.distance_squared_to(home) < 1.0:
			return candy
	return null


## 单颗糖果的动画序列：先复位到格心（清掉上次残留偏移），再缩小 → 衰减抖动 →
## 位置/缩放并行走回弹归位。tween 绑定在糖果节点上，节点被释放时自动失效；
## 同一颗糖果短时间内再次无效交换时先杀旧 tween（_invalid_fx_tweens 索引），不叠加打架。
func _animate_invalid_swap(candy: Candy, cell: Vector2i) -> void:
	var key: int = candy.get_instance_id()
	var previous: Variant = _invalid_fx_tweens.get(key)
	if previous is Tween:
		var old_tween: Tween = previous
		if old_tween.is_valid():
			old_tween.kill()
	candy.position = cell_to_position(cell)
	candy.scale = Vector2.ONE
	var origin := candy.position
	var tween := candy.create_tween()
	# ① 缩小（失败感的第一拍）
	tween.tween_property(candy, "scale", Vector2.ONE * INVALID_SHRINK_SCALE, INVALID_FX_SHRINK_SEC) \
		.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	# ② 左右抖动，振幅逐段衰减（-8 → +6 → -4 → +2）
	for i in INVALID_SHAKE_AMPS.size():
		var sign_x: float = -1.0 if i % 2 == 0 else 1.0
		tween.tween_property(candy, "position:x", origin.x + sign_x * INVALID_SHAKE_AMPS[i],
			INVALID_FX_SHAKE_STEP_SEC)
	# ③ 回弹归位：位置回格心 + 缩放 TRANS_BACK 回到 1.0（并行）
	tween.set_parallel(true)
	tween.tween_property(candy, "position", origin, INVALID_FX_SETTLE_SEC)
	tween.tween_property(candy, "scale", Vector2.ONE, INVALID_FX_SETTLE_SEC) \
		.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tween.set_parallel(false)
	_invalid_fx_tweens[key] = tween


## 清理字典里已失效的条目（糖果节点被重建释放时绑定 tween 被 kill → is_valid 为假）。
func _prune_invalid_fx_tweens() -> void:
	var stale: Array[int] = []
	for key: int in _invalid_fx_tweens:
		var tween: Tween = _invalid_fx_tweens[key]
		if tween == null or not tween.is_valid():
			stale.append(key)
	for key: int in stale:
		_invalid_fx_tweens.erase(key)
