class_name GameMain
extends Node2D
## 《牛牛打游戏》主场景控制器：装配 HUD/面板、驱动波次与生成器、处理开始/暂停/重开。
##
## 规范要点（见 SKILL.md「场景规范」「移动端触摸规范」）：
## - 场景内信号连接统一写在 _ready()，集中可见、可被 preflight 静态核对；
## - 游戏对象只 emit（Player.moved / Collectible.collected / GameState.*_changed），
##   本场景是唯一订阅方，UI 文案集中在这里拼装；
## - 触摸 UI（摇杆/确认/暂停按钮）只在有触摸屏时显示，桌面键盘环境完全不可见；
## - v3 的增量 UI（背景层/连击/横幅/开始面板/暂停面板/粒子/飘字）全部代码创建，
##   不改 .tscn 结构（场景手写风险为零），节点随用随建、动画完自动回收（清场纪律）。

## 可收集物场景（收集判定与回收见 _on_collectible_collected）。
const COLLECTIBLE_SCENE: PackedScene = preload("res://scenes/collectible.tscn")
## 随机刷点时与场地边缘保持的最小间距（px）。
const SPAWN_MARGIN: float = 48.0
## 刷点与牛牛保持的最小间距（px）：避免物品生成在角色身上被「贴脸白捡」，
## 也避免重开瞬间（归位后无输入）被判定收集，保证开局计数的确定性。
## 余量推导：v2 体型 1.4× 后拾取判定半径 22×1.4≈30.8 + 物品半径 14 ≈44.8px 即触发判定，
## 96px 仍留 ≈2.1 倍余量（v1 为 36px/2.6 倍；间距常量不变，倍率变化随 PLAYER_SCALE 生效）。
const SPAWN_CLEARANCE: float = 96.0
## 剩余时间低于该秒数时 HUD 进入红色倒计时警示（需求：失败反馈明确）。
const TIME_WARN_SECONDS: float = 10.0
## 飘字从生成到完全消失的秒数。
const FLOAT_TEXT_LIFETIME: float = 0.6
## 磁铁吸附拉速（px/s）：生效期间范围内计分物被吸向牛牛的速度。
const MAGNET_PULL_SPEED: float = 170.0
## ── v3 UI 主题（需求 ④：开始/HUD/结算统一主题；配色与目标物体系呼应）──
## 主题色板（v4 ②4 风格卡 niuniu-game8-flat-bright 对齐：扁平明快三主色，最深只到 #2c3e50）。
const THEME_PANEL_BG := Color(0.17, 0.24, 0.31, 0.94)
const THEME_PANEL_BORDER := Color(0.18, 0.8, 0.44, 0.9)
const THEME_TEXT := Color(0.93, 0.94, 0.95)
const THEME_ACCENT := Color(0.95, 0.61, 0.07)
const THEME_PRIMARY := Color(0.2, 0.6, 0.86)
const THEME_RECORD := Color(1.0, 0.82, 0.25)
const THEME_COMBO := Color(1.0, 0.62, 0.2)
## 波次横幅副标题（跨波可感知提示）。
const WAVE_SUBTITLES: Array[String] = [
	"青草垛大量刷出，热身收集",
	"金铃铛变多，瞄准高分",
	"最后冲刺，连击冲分！",
]

@onready var player: Player = $Player
@onready var collectibles_root: Node2D = $Collectibles
@onready var spawn_timer: Timer = $SpawnTimer
@onready var hud_label: Label = %HudLabel
@onready var result_panel: Panel = %ResultPanel
@onready var result_label: Label = %ResultLabel
@onready var touch_ui: CanvasLayer = $TouchUI

## HUD 操作提示（按输入设备切换）。
var _move_hint: String = "WASD / 方向键移动 · P 暂停"
## 牛牛本局出生点（重开时归位）。
var _spawn_origin: Vector2 = Vector2(360.0, 640.0)
## ── v3 代码创建的节点 ──
## 视差背景（远/近两层）。
var _bg_far: Node2D
var _bg_near: Node2D
## 连击展示（HUD 右上）。
var _combo_label: Label
## 波次横幅（跨波提示，波间停顿结束后隐藏）。
var _wave_banner: Label
## 全局相机（v4 ④1 关键事件震屏的载体：Juice.shake 驱动 offset 抖动）。
var _camera: Camera2D
## 上一帧相位（v4 ④1 UI 反馈映射用：RUNNING 迁移需区分「从暂停恢复」还是「开局/重开」）。
var _prev_phase: int = 0
## 结算「新纪录」高亮行（v4 ④3：刷新历史最佳时显示金色强调）。
var _record_label: Label
## 返回合集按钮（v4 ④3：Web 壳内跳合集门户；桌面/无头合法空转）。
var _back_button: Button
## 本局开局时的历史最佳（结算时对比判定「新纪录」，v4 ④3）。
var _best_at_run_start: int = 0
## 暂停提示。
var _pause_label: Label
## 开始面板（READY 阶段显示）。
var _start_panel: Panel
## 波间停顿剩余秒数（>0 时生成器暂停）。
var _wave_break_left: float = 0.0


func _ready() -> void:
	_spawn_origin = player.global_position
	_build_background()
	_build_hud_extras()
	_build_start_panel()
	_build_camera()
	if _touch_ui_should_show():
		touch_ui.visible = true
		_move_hint = "摇杆移动 · 收集目标物"
		_build_pause_button()
	# 信号连接：订阅方（本场景）写连接代码，发布方（player / GameState）只 emit。
	if not player.moved.is_connected(_on_player_moved):
		player.moved.connect(_on_player_moved)
	if not player.powerup_activated.is_connected(_on_powerup_activated):
		player.powerup_activated.connect(_on_powerup_activated)
	if not GameState.score_changed.is_connected(_on_score_changed):
		GameState.score_changed.connect(_on_score_changed)
	if not GameState.time_changed.is_connected(_on_time_changed):
		GameState.time_changed.connect(_on_time_changed)
	if not GameState.phase_changed.is_connected(_on_phase_changed):
		GameState.phase_changed.connect(_on_phase_changed)
	if not GameState.best_changed.is_connected(_on_best_changed):
		GameState.best_changed.connect(_on_best_changed)
	if not GameState.combo_changed.is_connected(_on_combo_changed):
		GameState.combo_changed.connect(_on_combo_changed)
	if not GameState.wave_changed.is_connected(_on_wave_changed):
		GameState.wave_changed.connect(_on_wave_changed)
	spawn_timer.timeout.connect(_on_spawn_timer_timeout)
	_prev_phase = GameState.phase
	_apply_panel_theme(result_panel)
	_build_result_panel_extras()
	# READY 阶段：开始面板就位，场上不铺物品（开始后才进入正式玩法）。
	result_panel.visible = false
	_show_start_panel(true)
	_update_hud()
	# 调参工作台（SKILL.md §3C）：仅 Web 且 URL 带 ?tuning= 时创建；
	# 桌面/无头环境 should_show() 恒 false，冒烟与本地运行不受影响。
	if TuningPanel.should_show():
		add_child(TuningPanel.new())


func _process(delta: float) -> void:
	# 限时推进集中在 GameState（可无头判定），场景只负责喂 delta。
	GameState.tick_time(delta)
	_tick_wave_break(delta)
	_apply_magnet(delta)
	_update_parallax()


func _unhandled_input(event: InputEvent) -> void:
	# 确认键上下文语义：待开始 → 开始；暂停 → 恢复；结算 → 一键重开。
	if event.is_action_pressed("confirm"):
		match GameState.phase:
			GameState.Phase.READY, GameState.Phase.WON, GameState.Phase.LOST:
				_start_or_restart()
			GameState.Phase.PAUSED:
				GameState.resume_game()
	# P 键（或触屏暂停按钮注入的同名动作）：进行中 ↔ 暂停。
	if event.is_action_pressed("pause"):
		if GameState.phase == GameState.Phase.RUNNING:
			GameState.pause_game()
		elif GameState.phase == GameState.Phase.PAUSED:
			GameState.resume_game()
	# R 键（v4 ④3 结算双入口之一）：结算面板下一键重开，与重开按钮同路径。
	if event.is_action_pressed("restart"):
		if GameState.phase == GameState.Phase.WON or GameState.phase == GameState.Phase.LOST:
			_start_or_restart()


## 新纪录高亮（v4 ④3）：本局得分刷新历史最佳时点亮金色行，否则隐藏。
func _show_record_banner() -> void:
	var is_record: bool = GameState.score > _best_at_run_start and GameState.score > 0
	# 纯文字 + 金色高亮：emoji 不在字体子集（preflight P13b 拦截，Web 会渲染缺字方块）。
	_record_label.text = "新纪录！本局 %d 分" % GameState.score
	_record_label.visible = is_record


## 开始 / 重开统一入口：状态归零 + 牛牛归位 + 道具清空 + 场上重铺 + 节奏复位 + 收起面板。
func _start_or_restart() -> void:
	_best_at_run_start = GameState.best_score
	_record_label.visible = false
	GameState.start_run()
	player.global_position = _spawn_origin
	player.clear_powerups()
	_clear_collectibles()
	_fill_collectibles()
	# 难度梯度复位：新的一局从第 1 波最宽松的节奏重新爬坡。
	spawn_timer.wait_time = GameState.spawn_interval_now()
	spawn_timer.start()
	_wave_break_left = 0.0
	_show_start_panel(false)
	_wave_banner.visible = false
	result_panel.visible = false
	_pause_label.visible = false
	_update_hud()


## 把场上可收集物补到上限（开局与每次定时刷新共用）。
func _fill_collectibles() -> void:
	while _collectible_count() < GameState.MAX_COLLECTIBLES:
		_spawn_collectible()


func _clear_collectibles() -> void:
	# 先摘出场景树再排队释放：queue_free 是帧末延迟删除，本帧内节点仍在树上，
	# 不摘除会让 _collectible_count 把待删节点也数进去，重开时补充逻辑被跳过。
	for child in collectibles_root.get_children():
		collectibles_root.remove_child(child)
		child.queue_free()


func _collectible_count() -> int:
	var count: int = 0
	for child in collectibles_root.get_children():
		if child is Collectible and not child.is_queued_for_deletion():
			count += 1
	return count


## 定时/随机刷新一个可收集物：类型按当前波次权重抽签（kind 传空时），
## 位置在场地内取随机点、避开边缘与牛牛 96px 安全圈；寿命取当前波次值。
## 返回本体供调用方跟踪（冒烟用短寿命物品断言过期路径、指定类型断言多类型计分）。
func _spawn_collectible(kind: String = "") -> Collectible:
	var collectible: Collectible = COLLECTIBLE_SCENE.instantiate()
	if kind.is_empty():
		kind = GameState.pick_kind(GameState.wave_index, randf())
	collectible.kind = kind
	collectible.position = _random_spawn_position()
	collectible.lifetime = GameState.collectible_lifetime_now()
	collectible.collected.connect(_on_collectible_collected)
	collectible.expired.connect(_on_collectible_expired)
	collectibles_root.add_child(collectible)
	return collectible


func _random_spawn_position() -> Vector2:
	var rect := Player.PLAY_RECT
	# 优先随机取点，且与牛牛当前位置保持安全间距（重开归位后同样成立）。
	for _attempt: int in 8:
		var x := randf_range(rect.position.x + SPAWN_MARGIN, rect.end.x - SPAWN_MARGIN)
		var y := randf_range(rect.position.y + SPAWN_MARGIN, rect.end.y - SPAWN_MARGIN)
		var candidate := Vector2(x, y)
		if candidate.distance_to(player.global_position) >= SPAWN_CLEARANCE:
			return candidate
	# 兜底：重试用尽仍无合规点（理论上不会发生），退回离牛牛最远的场地角。
	var farthest: Vector2 = rect.position
	var farthest_distance: float = -1.0
	for corner: Vector2 in [
		rect.position,
		Vector2(rect.end.x, rect.position.y),
		Vector2(rect.position.x, rect.end.y),
		rect.end,
	]:
		var distance: float = corner.distance_to(player.global_position)
		if distance > farthest_distance:
			farthest_distance = distance
			farthest = corner
	return farthest


## 收集判定命中：按类型计分（含 Combo 加成）、道具生效、反馈三件套（音效+粒子+飘字），
## 回收该物品并按当前波次收紧刷新节奏。
func _on_collectible_collected(collectible: Collectible) -> void:
	var kind := collectible.kind
	var gain := GameState.collect_item(kind)
	var tint: Color = Collectible.KIND_COLORS.get(kind, Collectible.KIND_COLORS["normal"])
	match kind:
		GameState.KIND_MAGNET:
			player.activate_magnet()  # 反馈在 _on_powerup_activated 统一挂
		GameState.KIND_BOOST:
			player.activate_boost()
		GameState.KIND_CLOCK:
			_spawn_float_text(collectible.global_position, "+%d · 加时" % gain, tint)
			Juice.sfx(&"clock")
		_:
			_spawn_float_text(collectible.global_position, _gain_text(gain), tint)
			Juice.sfx(&"rare" if kind == GameState.KIND_RARE else &"collect",
					1.0 + 0.05 * mini(GameState.combo_count, 8))
	# 收集正反馈三件套：音效 + 粒子 + 飘字（上 match 已各就各位；powerup 飘字走
	# powerup_activated 路径，磁铁/加速不重复播计分音效）+ Juice 弹跳（反馈单例记录，
	# §3B：反馈挂在结果事件处理函数上）+ 牛牛庆祝动画（v4 ②1 多帧动画的 collect 态）。
	Juice.pop(player, 1.12, 0.14)
	player.play_collect()
	_spawn_collect_burst(collectible.global_position, tint)
	_spawn_vanish_ghost(collectible)
	# 波次难度：收集越多（分越高），后续补充越快（Timer 运行中改 wait_time，下一轮生效）。
	if _wave_break_left <= 0.0:
		spawn_timer.wait_time = GameState.spawn_interval_now()
	collectible.queue_free()
	_update_hud()


## 连击文案：≥2 连击时附带连击标记（视觉反馈的一部分）。
func _gain_text(gain: int) -> String:
	if GameState.combo_count >= 2:
		return "+%d ×%d连击" % [gain, GameState.combo_count]
	return "+%d" % gain


## 物品寿命耗尽未被收集：回收但不计分（波次节奏的「错过惩罚」，与收集路径区分）。
func _on_collectible_expired(collectible: Collectible) -> void:
	collectible.queue_free()
	_update_hud()


## 磁铁吸附（v3 ② 道具效果）：生效期间把范围内的计分物拉向牛牛。
## 只吸附计分类型（normal/rare/clock），道具不被吸（避免磁铁吸磁铁的怪异观感）。
func _apply_magnet(delta: float) -> void:
	if not player.is_magnet_active() or GameState.phase != GameState.Phase.RUNNING:
		return
	for child in collectibles_root.get_children():
		var collectible := child as Collectible
		if collectible == null or collectible.is_queued_for_deletion():
			continue
		if GameState.item_score_for(collectible.kind) <= 0:
			continue
		var offset := player.global_position - collectible.global_position
		if offset.length() <= GameState.MAGNET_RADIUS:
			collectible.global_position += offset.normalized() * MAGNET_PULL_SPEED * delta


## ── 波间停顿（v3 ④：跨波可感知）──
func _on_wave_changed(wave: int) -> void:
	if GameState.phase != GameState.Phase.RUNNING:
		return
	_wave_break_left = GameState.WAVE_BREAK_SECONDS
	spawn_timer.stop()
	_wave_banner.text = "第 %d 波 %s" % [wave + 1, WAVE_SUBTITLES[clampi(wave, 0, WAVE_SUBTITLES.size() - 1)]]
	_wave_banner.visible = true
	Juice.sfx(&"wave")
	Juice.flash(_wave_banner, Color(1, 1, 1, 0.5))
	# v4 ②3 波次切换粒子：主题蓝迸发（波间停顿期的可感知视觉事件）。
	_spawn_collect_burst(player.global_position + Vector2(0.0, -90.0), THEME_PRIMARY)


func _tick_wave_break(delta: float) -> void:
	if _wave_break_left <= 0.0:
		return
	_wave_break_left = maxf(_wave_break_left - delta, 0.0)
	if _wave_break_left <= 0.0:
		_wave_banner.visible = false
		if GameState.phase == GameState.Phase.RUNNING:
			spawn_timer.wait_time = GameState.spawn_interval_now()
			spawn_timer.start()


## ── 收集反馈：粒子迸发（一次性发射、finished 自动回收，清场纪律无残留）──
func _spawn_collect_burst(pos: Vector2, tint: Color) -> void:
	var burst := CPUParticles2D.new()
	burst.position = pos
	burst.z_index = 6
	burst.one_shot = true
	burst.emitting = true
	burst.amount = 12
	burst.lifetime = 0.45
	burst.explosiveness = 1.0
	burst.direction = Vector2.UP
	burst.spread = 180.0
	burst.initial_velocity_min = 60.0
	burst.initial_velocity_max = 150.0
	burst.gravity = Vector2(0.0, 260.0)
	burst.scale_amount_min = 2.0
	burst.scale_amount_max = 5.0
	burst.color = tint
	add_child(burst)
	burst.finished.connect(burst.queue_free)


## 收集/消失动画：原地留下同色残影，0.18s 缩小淡出后自动释放（本体当帧已消失）。
func _spawn_vanish_ghost(collectible: Collectible) -> void:
	var visual := collectible.get_node_or_null("Visual") as Polygon2D
	if visual == null:
		return
	var ghost := Polygon2D.new()
	ghost.polygon = visual.polygon
	ghost.color = visual.color
	ghost.global_position = collectible.global_position
	ghost.z_index = 4
	add_child(ghost)
	var tween := create_tween()
	tween.set_parallel(true)
	tween.tween_property(ghost, "scale", Vector2.ZERO, 0.18)
	tween.tween_property(ghost, "modulate:a", 0.0, 0.18)
	tween.chain().tween_callback(ghost.queue_free)


## 收集反馈：在世界坐标弹出一个上浮渐隐的飘字（纯代码节点，动画完自动释放）。
func _spawn_float_text(pos: Vector2, text: String, tint: Color = THEME_TEXT) -> void:
	var label := Label.new()
	label.text = text
	label.position = pos + Vector2(-28.0, -34.0)
	label.z_index = 5
	label.add_theme_color_override("font_color", tint)
	label.add_theme_font_size_override("font_size", 24)
	add_child(label)
	var tween := create_tween()
	tween.set_parallel(true)
	tween.tween_property(label, "position:y", label.position.y - 40.0, FLOAT_TEXT_LIFETIME)
	tween.tween_property(label, "modulate:a", 0.0, FLOAT_TEXT_LIFETIME)
	tween.chain().tween_callback(label.queue_free)


## 道具生效反馈（磁铁/加速）：飘字 + 音效（收集路径不重复播）。
func _on_powerup_activated(kind: String) -> void:
	var tint: Color = Collectible.KIND_COLORS.get(kind, Collectible.KIND_COLORS["normal"])
	var text := "磁铁！范围内目标被吸来" if kind == GameState.KIND_MAGNET else "加速！移速提升"
	_spawn_float_text(player.global_position + Vector2(-40.0, -60.0), text, tint)
	Juice.sfx(&"powerup")
	Juice.flash(player, Color(1, 1, 1, 0.4))
	# v4 ②3 道具生效粒子：按道具本色在牛牛处迸发（自动回收）。
	_spawn_collect_burst(player.global_position, tint)


func _on_spawn_timer_timeout() -> void:
	if GameState.phase == GameState.Phase.RUNNING and _wave_break_left <= 0.0:
		_fill_collectibles()


func _on_player_moved(_position: Vector2) -> void:
	_update_hud()


func _on_score_changed(_score: int) -> void:
	_update_hud()


func _on_time_changed(_time_left: float) -> void:
	_update_hud()


func _on_best_changed(_best: int) -> void:
	_update_hud()


func _on_combo_changed(combo: int) -> void:
	if combo >= 2:
		_combo_label.text = "×%d 连击" % combo
		_combo_label.visible = true
		# v4 ④1/②3 连击里程碑反馈：×2 起步、此后每 +5 → 橙色迸发 + 震屏 + 连击牌弹跳。
		if combo == 2 or combo % 5 == 0:
			_spawn_collect_burst(player.global_position, THEME_COMBO)
			Juice.shake(4.0, 0.16)
			Juice.pop(_combo_label, 1.25, 0.18)
	else:
		_combo_label.visible = false
	_update_hud()


func _on_phase_changed(phase: int) -> void:
	# 非 RUNNING 一律掐掉波间停顿（通关/失败/暂停时不再补场）。
	_wave_break_left = 0.0
	_wave_banner.visible = false
	result_panel.visible = phase == GameState.Phase.WON or phase == GameState.Phase.LOST
	_pause_label.visible = phase == GameState.Phase.PAUSED
	match phase:
		GameState.Phase.WON:
			result_label.text = "通关！得分 %d/%d · 本局最高连击 ×%d · 历史最佳 %d\n按 确认 / 空格 一键重开" % [
				GameState.score, GameState.TARGET_SCORE, GameState.run_max_combo, GameState.best_score,
			]
			Juice.sfx(&"win")
			Juice.shake(8.0, 0.3)
			_show_record_banner()
		GameState.Phase.LOST:
			result_label.text = "时间到！本局得分 %d/%d · 最高连击 ×%d · 历史最佳 %d\n按 确认 / 空格 一键重开" % [
				GameState.score, GameState.TARGET_SCORE, GameState.run_max_combo, GameState.best_score,
			]
			Juice.sfx(&"lose")
			Juice.shake(5.0, 0.25)
			_show_record_banner()
		GameState.Phase.PAUSED:
			# v4 ④1 UI 反馈映射：暂停/恢复都有确认音（键盘 P 与触屏按钮同路径）。
			Juice.sfx(&"pause")
			spawn_timer.stop()
		GameState.Phase.RUNNING:
			# v4 ④1 UI 反馈映射：从暂停恢复 = 上行音；开局/重开确认 = 确认双音。
			if _prev_phase == GameState.Phase.PAUSED:
				Juice.sfx(&"resume")
			else:
				Juice.sfx(&"confirm")
			# 恢复（或开始）时重启生成器；波间停顿期内不抢（停顿结束 _tick_wave_break 会开）。
			if _wave_break_left <= 0.0 and not _start_panel.visible:
				spawn_timer.wait_time = GameState.spawn_interval_now()
				spawn_timer.start()
	_prev_phase = phase
	_update_hud()


func _update_hud() -> void:
	var combo_text := " · ×%d连击" % GameState.combo_count if GameState.combo_count >= 2 else ""
	hud_label.text = "第%d波 · 剩余 %d 秒 · 本局 %d/%d · 最佳 %d%s" % [
		GameState.wave_index + 1, ceili(GameState.time_left), GameState.score,
		GameState.TARGET_SCORE, GameState.best_score, combo_text,
	]
	# 限时尾段红色警示 + 文案提示：失败不是因为没看见（需求：失败反馈明确）。
	var time_low: bool = (
		GameState.phase == GameState.Phase.RUNNING
		and GameState.time_left <= TIME_WARN_SECONDS
	)
	hud_label.add_theme_color_override(
		"font_color", Color(1.0, 0.35, 0.3) if time_low else THEME_TEXT
	)


## ── v3 代码创建的 UI 与背景 ──

## 分层背景（v3 画面升级①）：远层（夜空渐变带 + 远山 + 云）与近层（草地 + 草簇），
## 近层随牛牛水平位移做轻视差，云朵自带动效 —— ≥2 层 + 视差/动效层次。
func _build_background() -> void:
	_bg_far = Node2D.new()
	_bg_far.name = "BackgroundFar"
	_bg_far.z_index = -20
	add_child(_bg_far)
	# 夜空基色（整画布）。
	_add_rect_polygon(_bg_far, Rect2(-40, -40, 800, 1360), Color(0.10, 0.17, 0.25))
	# 地平线上方的暖色微光带（渐变层次）。
	_add_rect_polygon(_bg_far, Rect2(-40, 780, 800, 260), Color(0.16, 0.24, 0.30))
	# 远山两叠（深浅两色剪影）。
	_add_rect_polygon(_bg_far, Rect2(-40, 980, 800, 320), Color(0.13, 0.22, 0.20))
	_bg_far.add_child(_make_cloud(Vector2(140, 210), 1.0))
	_bg_far.add_child(_make_cloud(Vector2(520, 350), 0.7))
	_bg_near = Node2D.new()
	_bg_near.name = "BackgroundNear"
	_bg_near.z_index = -10
	add_child(_bg_near)
	# 近层草地（画面底部色带）+ 草簇点缀。
	_add_rect_polygon(_bg_near, Rect2(-60, 1080, 840, 260), Color(0.16, 0.28, 0.16))
	for i: int in 9:
		var tuft_x := 30.0 + float(i) * 85.0
		var tuft := Polygon2D.new()
		tuft.polygon = PackedVector2Array([
			Vector2(tuft_x - 10.0, 1180.0), Vector2(tuft_x - 4.0, 1120.0),
			Vector2(tuft_x, 1180.0), Vector2(tuft_x + 6.0, 1126.0), Vector2(tuft_x + 12.0, 1180.0),
		])
		tuft.color = Color(0.24, 0.4, 0.2)
		_bg_near.add_child(tuft)


func _make_cloud(pos: Vector2, speed_scale: float) -> Polygon2D:
	var cloud := Polygon2D.new()
	cloud.polygon = PackedVector2Array([
		Vector2(-46, 8), Vector2(-26, -12), Vector2(-4, -18), Vector2(22, -10),
		Vector2(44, 4), Vector2(24, 12), Vector2(-24, 14),
	])
	cloud.color = Color(0.85, 0.9, 0.95, 0.16)
	cloud.position = pos
	cloud.set_meta("drift_speed", 12.0 * speed_scale)
	cloud.set_meta("drift_from", pos.x)
	return cloud


func _add_rect_polygon(parent: Node2D, rect: Rect2, tint: Color) -> void:
	var poly := Polygon2D.new()
	poly.polygon = PackedVector2Array([
		rect.position,
		Vector2(rect.end.x, rect.position.y),
		rect.end,
		Vector2(rect.position.x, rect.end.y),
	])
	poly.color = tint
	parent.add_child(poly)


## 云朵横向漂移动效 + 近层轻视差（牛牛 x 位移映射为近层反向偏移）。
func _update_parallax() -> void:
	if _bg_near != null:
		_bg_near.position.x = -(player.global_position.x - 360.0) * 0.04
	if _bg_far == null:
		return
	for cloud: Node in _bg_far.get_children():
		var speed: float = cloud.get_meta("drift_speed", 12.0)
		var from_x: float = cloud.get_meta("drift_from", 0.0)
		var poly := cloud as Polygon2D
		if poly == null:
			continue
		poly.position.x += speed * get_process_delta_time()
		if poly.position.x > 860.0:
			poly.position.x = from_x


## HUD 增量：连击标签（右上）+ 波次横幅（居中）+ 暂停提示（居中）。
func _build_hud_extras() -> void:
	var ui_layer: CanvasLayer = $UI
	_combo_label = Label.new()
	_combo_label.name = "ComboLabel"
	_combo_label.anchor_left = 1.0
	_combo_label.anchor_right = 1.0
	_combo_label.offset_left = -240.0
	_combo_label.offset_right = -24.0
	_combo_label.offset_top = 44.0
	_combo_label.offset_bottom = 84.0
	_combo_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_combo_label.add_theme_color_override("font_color", THEME_COMBO)
	_combo_label.add_theme_font_size_override("font_size", 28)
	_combo_label.visible = false
	ui_layer.add_child(_combo_label)

	_wave_banner = Label.new()
	_wave_banner.name = "WaveBanner"
	_wave_banner.anchor_left = 0.0
	_wave_banner.anchor_right = 1.0
	_wave_banner.offset_top = 540.0
	_wave_banner.offset_bottom = 660.0
	_wave_banner.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_wave_banner.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_wave_banner.add_theme_color_override("font_color", THEME_PRIMARY)
	_wave_banner.add_theme_font_size_override("font_size", 40)
	_wave_banner.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.6))
	_wave_banner.add_theme_constant_override("shadow_offset_y", 3)
	_wave_banner.visible = false
	ui_layer.add_child(_wave_banner)

	_pause_label = Label.new()
	_pause_label.name = "PauseLabel"
	_pause_label.anchor_right = 1.0
	_pause_label.anchor_bottom = 1.0
	_pause_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_pause_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_pause_label.text = "已暂停\n按 P / 确认 继续"
	_pause_label.add_theme_font_size_override("font_size", 40)
	_pause_label.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.7))
	_pause_label.visible = false
	ui_layer.add_child(_pause_label)


## 全局相机（v4 ④1）：固定画布正中（720×1280），Juice.shake 以 offset 抖动实现震屏；
## 没有它 shake 只记录不位移（模板合法空转），关键事件的震屏反馈就是空话。
func _build_camera() -> void:
	_camera = Camera2D.new()
	_camera.name = "Camera"
	_camera.position = Vector2(360.0, 640.0)
	add_child(_camera)
	_camera.make_current()


## 开始面板（v3 ④2 完整流程的第一环：READY 阶段展示，点击/确认开始）。
func _build_start_panel() -> void:
	_start_panel = Panel.new()
	_start_panel.name = "StartPanel"
	_start_panel.anchor_left = 0.5
	_start_panel.anchor_top = 0.5
	_start_panel.anchor_right = 0.5
	_start_panel.anchor_bottom = 0.5
	_start_panel.offset_left = -300.0
	_start_panel.offset_top = -260.0
	_start_panel.offset_right = 300.0
	_start_panel.offset_bottom = 260.0
	_apply_panel_theme(_start_panel)
	var ui_layer: CanvasLayer = $UI
	ui_layer.add_child(_start_panel)

	var title := Label.new()
	title.name = "StartTitle"
	title.text = "牛牛打游戏"
	title.anchor_right = 1.0
	title.offset_top = 36.0
	title.offset_bottom = 100.0
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 48)
	title.add_theme_color_override("font_color", THEME_ACCENT)
	_start_panel.add_child(title)

	var intro := Label.new()
	intro.name = "StartIntro"
	intro.text = "60 秒内收集 20 分\n青草垛 +1 · 金铃铛 +3 · 时钟 +2 并加时\n连击高分物有加成 · 磁铁 / 加速帮你冲刺"
	intro.anchor_right = 1.0
	intro.offset_top = 120.0
	intro.offset_bottom = 240.0
	intro.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	intro.add_theme_font_size_override("font_size", 20)
	_start_panel.add_child(intro)

	var start_button := Button.new()
	start_button.name = "StartButton"
	start_button.text = "开 始 游 戏"
	start_button.anchor_left = 0.5
	start_button.anchor_right = 0.5
	start_button.offset_left = -140.0
	start_button.offset_right = 140.0
	start_button.offset_top = 280.0
	start_button.offset_bottom = 348.0
	start_button.add_theme_font_size_override("font_size", 28)
	start_button.custom_minimum_size = Vector2(280.0, 68.0)  # 触达区 ≥44x44（需求 ④3）
	start_button.pressed.connect(_start_or_restart)
	_start_panel.add_child(start_button)

	var hint := Label.new()
	hint.name = "StartHint"
	hint.text = "键盘 WASD/方向键移动 · 空格确认 · P 暂停\n触屏：左下摇杆移动"
	hint.anchor_right = 1.0
	hint.anchor_top = 1.0
	hint.anchor_bottom = 1.0
	hint.offset_top = -76.0
	hint.offset_bottom = -20.0
	hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	hint.add_theme_font_size_override("font_size", 16)
	_start_panel.add_child(hint)


func _show_start_panel(visible_now: bool) -> void:
	if _start_panel != null:
		_start_panel.visible = visible_now


## 结算面板增强（v4 ④3）：新纪录高亮行 + 一键重开/返回合集双按钮（触达区 ≥44×44px）。
## v5 修复 C（结算文字压按钮）：结论行开启自动换行并降字号，三段（结论 16..134 /
## 新纪录 138..172 / 按钮行 180..244）互不重叠，面板加高到 320px 容纳三行结论。
## v5 复验补刀（浏览器实测抓出）：场景里 ResultLabel 是 anchor_bottom=1（锚面板底边），
## 顶部锚定语义下 offset_bottom=134 会把 label 底边悬到面板外 134px——文字垂直居中后
## 正好压在按钮行。必须先把 anchor_bottom 归 0，offsets 才是「距面板顶 16..134」。
func _build_result_panel_extras() -> void:
	result_panel.offset_top = -180.0
	result_panel.offset_bottom = 140.0
	result_label.anchor_bottom = 0.0
	result_label.offset_top = 16.0
	result_label.offset_bottom = 134.0
	result_label.add_theme_font_size_override("font_size", 20)
	# 长结论行（≈28 字）在 528px 宽内必须自动换行，否则画出 label 区域压住按钮（v4 线上实测）。
	result_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART

	_record_label = Label.new()
	_record_label.name = "RecordLabel"
	_record_label.unique_name_in_owner = true
	_record_label.anchor_right = 1.0
	_record_label.offset_top = 138.0
	_record_label.offset_bottom = 172.0
	_record_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_record_label.add_theme_font_size_override("font_size", 22)
	_record_label.add_theme_color_override("font_color", THEME_RECORD)
	_record_label.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.6))
	_record_label.add_theme_constant_override("shadow_offset_y", 2)
	_record_label.visible = false
	result_panel.add_child(_record_label)

	var restart_button := Button.new()
	restart_button.name = "RestartButton"
	restart_button.text = "一键重开 (R)"
	restart_button.offset_left = 24.0
	restart_button.offset_right = 264.0
	restart_button.offset_top = 180.0
	restart_button.offset_bottom = 244.0
	restart_button.add_theme_font_size_override("font_size", 22)
	restart_button.custom_minimum_size = Vector2(240.0, 64.0)
	restart_button.pressed.connect(_start_or_restart)
	result_panel.add_child(restart_button)

	_back_button = Button.new()
	_back_button.name = "BackButton"
	_back_button.text = "返回合集"
	_back_button.offset_left = 296.0
	_back_button.offset_right = 536.0
	_back_button.offset_top = 180.0
	_back_button.offset_bottom = 244.0
	_back_button.add_theme_font_size_override("font_size", 22)
	_back_button.custom_minimum_size = Vector2(240.0, 64.0)
	_back_button.pressed.connect(_go_back_to_hub)
	result_panel.add_child(_back_button)


## 返回合集入口（v4 ④3）：Web 壳内跳转合集门户 /apps；桌面/无头环境合法空转（无可去处）。
func _go_back_to_hub() -> void:
	if OS.has_feature("web"):
		JavaScriptBridge.eval("window.location.href = '/apps'", true)


## 触屏暂停按钮（右上角，66px 触达 ≥44px；TouchScreenButton.action 直接注入 pause 动作，
## 与键盘 P 走同一条 _unhandled_input 路径，无第二套输入逻辑）。
func _build_pause_button() -> void:
	var anchor := Control.new()
	anchor.name = "PauseAnchor"
	anchor.anchor_left = 1.0
	anchor.anchor_right = 1.0
	anchor.offset_left = -108.0
	anchor.offset_top = 40.0
	anchor.offset_right = -40.0
	anchor.offset_bottom = 108.0
	touch_ui.add_child(anchor)
	var pause_button := TouchScreenButton.new()
	pause_button.name = "PauseButton"
	pause_button.action = &"pause"
	pause_button.shape = _make_circle_shape(33.0)
	pause_button.position = Vector2(34.0, 34.0)
	anchor.add_child(pause_button)
	var visual := Polygon2D.new()
	visual.polygon = PackedVector2Array([
		Vector2(-30, -30), Vector2(30, -30), Vector2(30, 30), Vector2(-30, 30),
	])
	visual.color = Color(0.1, 0.2, 0.12, 0.7)
	pause_button.add_child(visual)
	var icon := Label.new()
	icon.text = "II"
	icon.position = Vector2(-14.0, -18.0)
	icon.add_theme_font_size_override("font_size", 30)
	icon.add_theme_color_override("font_color", THEME_TEXT)
	pause_button.add_child(icon)


func _make_circle_shape(radius: float) -> CircleShape2D:
	var shape := CircleShape2D.new()
	shape.radius = radius
	return shape


## 触屏专用 UI（虚拟摇杆/确认/暂停按钮）显示判定（v5.2）：
## Web 下**不经过引擎**，直接问浏览器 —— 引擎 is_touchscreen_available() 在 web 实测不可靠
## （CDP 注入 ontouchstart 仍返回 false，线上真机两连例：摇杆不显示、整局不可玩）。
## 浏览器三信号任一为真即显示（ontouchstart / maxTouchPoints>0 / pointer:coarse），
## eval 受限或异常也按有触摸处理（fail-open：漏显桌面只是多个控件，误隐真机是整局不可玩）。
## 非 Web（桌面/无头）保持引擎判定。
func _touch_ui_should_show() -> bool:
	if OS.has_feature("web"):
		var touch_capable: Variant = JavaScriptBridge.eval(
			"(function(){try{return 'ontouchstart' in window || navigator.maxTouchPoints > 0"
			+ " || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)}"
			+ "catch(e){return true}})()", true)
		return touch_capable != false
	return DisplayServer.is_touchscreen_available()


## 统一面板主题（开始/结算共用：深底、绿描边、圆角）。
func _apply_panel_theme(panel: Panel) -> void:
	var style := StyleBoxFlat.new()
	style.bg_color = THEME_PANEL_BG
	style.border_color = THEME_PANEL_BORDER
	style.set_border_width_all(2)
	style.set_corner_radius_all(24)
	panel.add_theme_stylebox_override("panel", style)
