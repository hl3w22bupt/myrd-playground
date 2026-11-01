class_name Field
extends Node2D
## 网格战场：草坪棋盘 / 房子防线 / 出怪口的扁平绘制，以及布防、僵尸推进、弹丸命中、
## 阳光拾取的统一驱动。实体（Zombie / Defender / Projectile / SunToken / FloatText）只管
## 状态与绘制，跨实体交互全部收口在本文件，保证无头可测、行为可追。
##
## v2（spec.numeric.grid / visual.contrast）：9×5 网格、96px 格、1024×640 视口；
## 草坪格底 = 低饱和深绿棋盘双档（LAWN_DARK/LAWN_LIGHT 按格交替），替换原高饱和亮绿；
## 阳光只经「点按收集」入账 —— 击杀掉落与向日葵生产都生成 SunToken，天降同规则；
## 点按语义（spec input）：拾取阳光 > 已占格位取消选卡 > 空格布防。

## 僵尸被击杀（掉落阳光拾取物之后发出）。
signal zombie_killed(zombie: Zombie)
## 僵尸突破防线（生命扣减之后发出）。
signal zombie_breached(zombie: Zombie)
## 防御单位布置成功。
signal defender_placed(defender: Defender)
## 防御单位被啃毁。
signal defender_lost(cell: Vector2i)
## 阳光被收集（value = 入账数值）。
signal sun_collected(value: int)
## 一波出怪开始（wave 为 0 起索引；波次来袭提示音挂这里）。
signal wave_spawn_started(wave: int)

## ── 战场几何（1024×640 设计视口，spec.numeric.grid：9×5、96px 格）──
const VIEW_SIZE := Vector2(1024.0, 640.0)
const GRID_COLS: int = 9
const GRID_ROWS: int = 5
const CELL_W: float = 96.0
const CELL_H: float = 96.0
## 网格左上角（房子区右缘、HUD 下缘的交点）。
const GRID_ORIGIN := Vector2(112.0, 72.0)
const HOUSE_W: float = 112.0
## 防线 x：僵尸头部越过即突破。
const DEFENSE_X: float = GRID_ORIGIN.x
## 僵尸出生 x（画面右缘外）。
const SPAWN_X: float = 1056.0
## 僵尸啃咬触达距离（嘴到防御单位中心的判定半径）。
const EAT_REACH: float = 36.0
## 弹丸命中判定半径。
const HIT_RANGE: float = 14.0
## 触摸 → 模拟鼠标双投递的去重窗口（同点位 120ms 内只算一次）。
const TAP_DEDUPE_MS: int = 120

var _defenders: Dictionary = {}          # Vector2i(cell) → Defender
var _zombies: Array[Zombie] = []
var _projectiles: Array[Projectile] = []
var _sun_tokens: Array[SunToken] = []
## 键盘光标所在格（主控制器每帧回写，绘制高亮）。
var highlight_cell: Vector2i = Vector2i(-1, -1)
var _last_tap_ms: int = -100000
var _last_tap_pos := Vector2(-10000, -10000)
## 夜幕迷雾（L5）：被遮罩的首列（0 起索引；-1 = 本关无夜幕）。由 level_started 装载。
var fog_lit_cols: int = -1
## 夜幕遮罩绘制层（压在僵尸之上：剪影之外的画面区域罩雾）。
var _fog_overlay: Node2D = null


func _ready() -> void:
	GameState.level_started.connect(_on_level_started)


## 关卡装载：夜幕遮罩按关卡配置开关（spec levelMechanics.nightFog，仅 L5 声明）。
func _on_level_started(_level_index: int) -> void:
	var fog: Dictionary = GameState.level().get("night_fog", {})
	fog_lit_cols = int(fog.get("lit_cols", -1)) if not fog.is_empty() else -1
	if fog_lit_cols >= 0 and _fog_overlay == null:
		_fog_overlay = FogOverlay.new()
		_fog_overlay.name = "NightFog"
		_fog_overlay.z_index = 3
		add_child(_fog_overlay)
	if _fog_overlay != null:
		_fog_overlay.visible = fog_lit_cols >= 0
		if fog_lit_cols >= 0:
			_fog_overlay.boundary_x = fog_boundary_x()
			_fog_overlay.alpha = float(fog.get("alpha", 0.6))
			_fog_overlay.queue_redraw()


## 夜幕是否生效（本关声明了遮罩列数）。
func fog_active() -> bool:
	return fog_lit_cols >= 0


## 点亮区右缘世界 x：该 x 之右 = 遮罩区（僵尸以剪影预显示）。
func fog_boundary_x() -> float:
	return GRID_ORIGIN.x + float(fog_lit_cols) * CELL_W


## ── 几何查询 ──

## 世界坐标 → 格子；出界返回 (-1,-1)。
func cell_at(world_pos: Vector2) -> Vector2i:
	var local := world_pos - GRID_ORIGIN
	var col := int(floor(local.x / CELL_W))
	var row := int(floor(local.y / CELL_H))
	if col < 0 or col >= GRID_COLS or row < 0 or row >= GRID_ROWS:
		return Vector2i(-1, -1)
	return Vector2i(col, row)


func cell_center(cell: Vector2i) -> Vector2:
	return GRID_ORIGIN + Vector2((float(cell.x) + 0.5) * CELL_W, (float(cell.y) + 0.5) * CELL_H)


func lane_center_y(lane: int) -> float:
	return GRID_ORIGIN.y + (float(lane) + 0.5) * CELL_H


## 把光标位置钳回网格范围（防键盘把光标甩出布防区，confirm 永久落空）。
func clamp_to_grid(pos: Vector2) -> Vector2:
	var half := Vector2(CELL_W, CELL_H) * 0.5
	var max_pos := GRID_ORIGIN + Vector2(CELL_W * GRID_COLS, CELL_H * GRID_ROWS) - half
	return pos.clamp(GRID_ORIGIN + half, max_pos)


func in_bounds(cell: Vector2i) -> bool:
	return cell.x >= 0 and cell.x < GRID_COLS and cell.y >= 0 and cell.y < GRID_ROWS


## ── 实体查询 ──

func defender_at(cell: Vector2i) -> Defender:
	return _defenders.get(cell) as Defender


## 全部已布防的格子（只读键副本，供 HUD / 冒烟 / 调参面板遍历）。
func get_defender_cells() -> Array[Vector2i]:
	var cells: Array[Vector2i] = []
	for cell: Vector2i in _defenders:
		cells.append(cell)
	return cells


func defender_count() -> int:
	return _defenders.size()


func zombie_count() -> int:
	return _zombies.size()


func sun_token_count() -> int:
	return _sun_tokens.size()


## 场上第一枚阳光拾取物（冒烟断言 / 调试用；无则 null）。
func first_sun_token() -> SunToken:
	return _sun_tokens[0] if not _sun_tokens.is_empty() else null


## ── 布防 ──

## 在 world_pos 所在格布防当前选中的出战卡：扣费成功才生成；
## 占位 / 出界 / 阳光不足 / 冷却中按各自语义反馈。
func try_place(world_pos: Vector2) -> bool:
	if not GameState.running:
		return false
	var cell := cell_at(world_pos)
	if not in_bounds(cell):
		Juice.sfx(&"fail")
		return false
	if _defenders.has(cell):
		# spec input.place-plant：点已占格位 = 取消选择（不惩罚、不占格）
		GameState.deselect_card()
		return false
	if GameState.selected_card < 0:
		Juice.sfx(&"fail")
		return false
	var reason := GameState.card_block_reason(GameState.selected_card)
	if reason != "":
		Juice.sfx(&"fail")
		return false
	var card_id := GameState.current_card_id()
	if not GameState.spend_sun(GameState.card_cost()):
		Juice.sfx(&"fail")
		return false
	var defender := Defender.new()
	defender.setup(cell, card_id)
	defender.position = cell_center(cell)
	add_child(defender)
	_defenders[cell] = defender
	GameState.notify_placed()
	Juice.sfx(&"place")
	Juice.pop(defender)
	defender_placed.emit(defender)
	return true


## ── 出怪与阳光 ──

## 在指定行 / x 出生一只僵尸：血量/速度 = 种类基准 × 本关 hpScale/speedScale
## （spec.numeric.difficulty：难度曲线上调，逐关严格递增；boss 血量固定不乘 hpScale）。
func spawn_zombie(lane: int, x: float, kind: StringName = &"walker") -> Zombie:
	var zombie := Zombie.new()
	zombie.setup(
		clampi(lane, 0, GRID_ROWS - 1), x, lane_center_y(lane),
		GameState.zombie_hp_of(kind), GameState.zombie_speed_of(kind), kind)
	add_child(zombie)
	_zombies.append(zombie)
	return zombie


## 天降阳光：随机格落到格内偏下（spec.economy.skyDrop 默认 25/12s；
## L4 阳光紧缩关节流覆盖为 15/24s —— level.sky_drop_yield / sky_drop_interval）。
func spawn_sun_token() -> void:
	var cell := Vector2i(randi() % GRID_COLS, randi() % GRID_ROWS)
	var target := cell_center(cell) + Vector2(0.0, 20.0)
	var token := SunToken.new()
	var yield_override: Variant = GameState.level().get("sky_drop_yield", 0)
	var value := int(yield_override) if int(yield_override) > 0 else int(GameState.sky_drop_yield)
	token.setup(value, Vector2(target.x, GRID_ORIGIN.y - 36.0), target.y)
	add_child(token)
	_sun_tokens.append(token)


## 向日葵产出：落在生产者脚下（spec.economy.sunflower：25 / 10s，点按收集）。
func spawn_sunflower_token(from: Defender) -> void:
	var at := from.position + Vector2(randf_range(-22.0, 22.0), 30.0)
	at.y = minf(at.y, GRID_ORIGIN.y + float(GRID_ROWS) * CELL_H - 16.0)
	var token := SunToken.drop(int(GameState.sunflower_yield), at)
	add_child(token)
	_sun_tokens.append(token)


## 击杀掉落：落在倒地处（spec.economy.killReward：15~35 按种类，点按收集）。
func spawn_kill_token(kind: StringName, at: Vector2) -> void:
	var token := SunToken.drop(GameState.kill_reward(kind), at)
	add_child(token)
	_sun_tokens.append(token)


## ── 清场（重开 / 回选关）──

func clear_all() -> void:
	for defender: Defender in _defenders.values():
		defender.queue_free()
	_defenders.clear()
	for zombie: Zombie in _zombies:
		zombie.queue_free()
	_zombies.clear()
	for projectile: Projectile in _projectiles:
		projectile.queue_free()
	_projectiles.clear()
	for token: SunToken in _sun_tokens:
		token.queue_free()
	_sun_tokens.clear()
	highlight_cell = Vector2i(-1, -1)


## ── 帧驱动 ──

func _physics_process(delta: float) -> void:
	_advance_world(delta)


func _advance_world(delta: float) -> void:
	# ① 防御单位：生产 / 开火（同格唯一，按行找目标；双发 = 一次开火两颗弹，前后错开）
	for defender: Defender in _defenders.values():
		if defender.produces:
			if defender.tick_produce(delta):
				spawn_sunflower_token(defender)
				Juice.sfx(&"produce")
				Juice.pop(defender)
			continue
		if defender.tick_fire(delta, has_lane_target(defender.cell.y, defender.position.x)):
			for shot in defender.shots:
				var projectile := Projectile.new()
				projectile.setup(
					defender.cell.y,
					defender.position + Vector2(26.0 - 18.0 * float(shot), -12.0),
					defender.damage, defender.slow, defender.tint)
				add_child(projectile)
				_projectiles.append(projectile)
			Juice.sfx(&"shoot")
	# ② 僵尸推进 / 啃咬 / 碾压 / 突破（啃咬 = 离散节拍：tick_bite 归零咬一口）
	var fog_x := fog_boundary_x() if fog_active() else -1000000.0
	for zombie in _zombies.duplicate():
		if zombie.dying:
			continue
		# 夜幕剪影回写（L5）：遮罩区内只显示剪影，进入前 lit_cols 列点亮区才显形
		zombie.silhouetted = zombie.position.x >= fog_x
		var target := _defender_in_reach(zombie)
		zombie.eating = target != null and not zombie.crushes
		if target != null:
			if zombie.crushes:
				# 坦克巨尸碾压（spec combat.crush）：接触即摧毁（含坚果墙），
				# 不进入啃食循环，随后继续前进；音效复用 hit + zombie_down
				Juice.sfx(&"hit")
				Juice.sfx(&"zombie_die")
				Juice.shake(6.0)
				_crush_defender(target)
			elif zombie.tick_bite(delta) and target.take_damage(GameState.bite_damage):
				_remove_defender(target)
		else:
			zombie.advance(delta)
			if zombie.position.x <= DEFENSE_X:
				_breach(zombie)
	# ③ 弹丸飞行与命中（伤害/减速读弹丸快照，不读当前选中卡）
	for projectile in _projectiles.duplicate():
		projectile.advance(delta)
		var victim := _zombie_hit_by(projectile)
		if victim != null:
			Juice.sfx(&"hit")
			Juice.flash(victim)
			victim.apply_slow(projectile.slow)
			if victim.take_damage(projectile.damage):
				_kill_zombie(victim)
			_remove_projectile(projectile)
		elif projectile.position.x > VIEW_SIZE.x + 24.0:
			_remove_projectile(projectile)
	# ④ 阳光下落 / 到期
	for token in _sun_tokens.duplicate():
		token.advance(delta)
		if token.expired():
			_remove_sun_token(token)


## 本行右侧是否有可射目标（僵尸 x 不低于防御单位射口）。
func has_lane_target(lane: int, from_x: float) -> bool:
	for zombie in _zombies:
		if not zombie.dying and zombie.lane == lane and zombie.position.x >= from_x - 12.0:
			return true
	return false


func _defender_in_reach(zombie: Zombie) -> Defender:
	for defender: Defender in _defenders.values():
		if defender.cell.y == zombie.lane and defender.position.x <= zombie.position.x \
				and zombie.position.x - defender.position.x <= EAT_REACH:
			return defender
	return null


func _zombie_hit_by(projectile: Projectile) -> Zombie:
	var best: Zombie = null
	for zombie in _zombies:
		if zombie.dying or zombie.lane != projectile.lane:
			continue
		var gap := zombie.position.x - projectile.position.x
		if gap >= -6.0 and gap <= HIT_RANGE and (best == null or zombie.position.x < best.position.x):
			best = zombie
	return best


## ── 结果事件（反馈挂在这里，见 SKILL.md §3B）──

func _kill_zombie(zombie: Zombie) -> void:
	_zombies.erase(zombie)
	Juice.sfx(&"zombie_die")
	Juice.pop(zombie)
	Ambience.burst(zombie.position, FlatUI.GREEN_LIGHT)
	# 击杀掉落（spec.economy.killReward）：面额按种类，点按收集方入账
	spawn_kill_token(zombie.kind, zombie.position)
	zombie_killed.emit(zombie)
	zombie.queue_free()


func _breach(zombie: Zombie) -> void:
	_zombies.erase(zombie)
	Juice.sfx(&"breach")
	Juice.shake(9.0)
	GameState.lose_life()
	zombie_breached.emit(zombie)
	zombie.queue_free()


func _remove_defender(defender: Defender) -> void:
	_defenders.erase(defender.cell)
	Juice.sfx(&"fail")
	Juice.flash(defender, Color(1, 0.5, 0.5, 0.9))
	defender_lost.emit(defender.cell)
	defender.queue_free()


## 坦克巨尸碾压摧毁（无视血量，含坚果墙；不进啃食循环，spec combat.crush）。
func _crush_defender(defender: Defender) -> void:
	_defenders.erase(defender.cell)
	Juice.flash(defender, Color(1, 0.5, 0.5, 0.9))
	defender_lost.emit(defender.cell)
	defender.queue_free()


func _remove_projectile(projectile: Projectile) -> void:
	_projectiles.erase(projectile)
	projectile.queue_free()


func _remove_sun_token(token: SunToken) -> void:
	_sun_tokens.erase(token)
	token.queue_free()


## ── 点按（触屏优先：拾取阳光 > 取消选卡 > 布防）──

func _unhandled_input(event: InputEvent) -> void:
	var tap := Vector2.INF
	if event is InputEventScreenTouch:
		var touch := event as InputEventScreenTouch
		if touch.pressed:
			tap = get_canvas_transform().affine_inverse() * touch.position
	elif event is InputEventMouseButton:
		var mouse := event as InputEventMouseButton
		if mouse.pressed and mouse.button_index == MOUSE_BUTTON_LEFT:
			tap = get_global_mouse_position()
	if tap == Vector2.INF:
		return
	# 触摸会被浏览器/引擎再投递一条模拟鼠标事件：同点位短窗口内只算一次
	var now := Time.get_ticks_msec()
	if now - _last_tap_ms < TAP_DEDUPE_MS and tap.distance_to(_last_tap_pos) < 24.0:
		return
	_last_tap_ms = now
	_last_tap_pos = tap
	_handle_tap(tap)


func _handle_tap(pos: Vector2) -> void:
	if not GameState.running:
		return
	var token := _sun_token_at(pos)
	if token != null:
		_collect_token(token)
		return
	try_place(pos)


## 点按拾取判定半径（spec clickCollect.hitRadiusPx ≥44，触屏友好）。
func _sun_token_at(pos: Vector2) -> SunToken:
	var radius := GameState.sun_tap_radius
	for token in _sun_tokens:
		if token.position.distance_to(pos) <= radius:
			return token
	return null


func _collect_token(token: SunToken) -> void:
	_sun_tokens.erase(token)
	GameState.add_sun(token.value)
	Juice.sfx(&"score")
	Juice.pop(token)
	Ambience.burst(token.position, FlatUI.SUN_PICKUP)
	_collect_float_text(token.position, token.value)
	sun_collected.emit(token.value)
	token.queue_free()


## 收集飘字（+N，spec input.collect-sun）。
func _collect_float_text(at: Vector2, value: int) -> void:
	var label := FloatText.new()
	label.setup("+%d" % value)
	label.position = at + Vector2(0.0, -18.0)
	add_child(label)


## ── 绘制（全扁平色块，风格卡 v2 对比度规范）──

func _draw() -> void:
	var field_bottom := GRID_ORIGIN.y + float(GRID_ROWS) * CELL_H
	var tint: Color = GameState.level().get("chapter_tint", Color("d5f0dd"))
	# 草坪：低饱和深绿棋盘双档（按格交替 —— spec visual.lawnCellBase）
	for row in GRID_ROWS:
		for col in GRID_COLS:
			var cell_color := FlatUI.LAWN_DARK if (row + col) % 2 == 0 else FlatUI.LAWN_LIGHT
			draw_rect(Rect2(
				GRID_ORIGIN.x + float(col) * CELL_W,
				GRID_ORIGIN.y + float(row) * CELL_H, CELL_W, CELL_H), cell_color)
	# 网格线（低调，压在草地上）
	var grid_line := Color(FlatUI.OUTLINE, 0.22)
	for col in GRID_COLS + 1:
		var x := GRID_ORIGIN.x + float(col) * CELL_W
		draw_line(Vector2(x, GRID_ORIGIN.y), Vector2(x, field_bottom), grid_line, 2.0)
	for row in GRID_ROWS + 1:
		var y := GRID_ORIGIN.y + float(row) * CELL_H
		draw_line(Vector2(GRID_ORIGIN.x, y), Vector2(GRID_ORIGIN.x + float(GRID_COLS) * CELL_W, y), grid_line, 2.0)
	# 键盘光标所在格高亮（触屏用户看不到光标，不受影响）
	if in_bounds(highlight_cell):
		var rect := Rect2(GRID_ORIGIN + Vector2(highlight_cell) * Vector2(CELL_W, CELL_H), Vector2(CELL_W, CELL_H))
		draw_rect(rect, Color(1, 1, 1, 0.14))
		draw_rect(rect.grow(-3.0), FlatUI.BLUE, false, 4.0)
	# 房子防线（左侧几何块：辅色 + 章节色檐口）
	draw_rect(Rect2(0.0, GRID_ORIGIN.y, HOUSE_W - 8.0, field_bottom - GRID_ORIGIN.y), FlatUI.BLUE)
	draw_rect(Rect2(0.0, GRID_ORIGIN.y, HOUSE_W - 8.0, 26.0), tint)
	draw_rect(Rect2(HOUSE_W - 34.0, field_bottom - 64.0, 26.0, 64.0), FlatUI.BLUE_DARK)
	# 防线警示条（红线，僵尸越过即失败）
	draw_rect(Rect2(DEFENSE_X - 4.0, GRID_ORIGIN.y, 4.0, field_bottom - GRID_ORIGIN.y), FlatUI.RED)
	# 出怪口（右侧暗色带）
	draw_rect(Rect2(VIEW_SIZE.x - 40.0, GRID_ORIGIN.y, 40.0, field_bottom - GRID_ORIGIN.y), Color(FlatUI.INK, 0.35))
	# 底部提示条底色（章节色，配 INK 文字 = 高对比浅底）
	draw_rect(Rect2(0.0, field_bottom, VIEW_SIZE.x, VIEW_SIZE.y - field_bottom), tint)


## 夜幕遮罩绘制层（L5 专属，z_index=3 压在僵尸之上）：第 fog boundary 列及以右罩雾。
## 扁平纯色块（spec nightFog.fogColor #0d1626 / alpha 0.6），无渐变（风格卡禁忌）。
class FogOverlay extends Node2D:
	var boundary_x: float = 0.0
	var alpha: float = 0.6

	func _draw() -> void:
		var top: float = Field.GRID_ORIGIN.y
		var field_bottom: float = Field.GRID_ORIGIN.y + float(Field.GRID_ROWS) * Field.CELL_H
		draw_rect(Rect2(boundary_x, top, Field.VIEW_SIZE.x - boundary_x, field_bottom - top),
			Color(FlatUI.FOG, alpha))
