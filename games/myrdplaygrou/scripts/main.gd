extends Node2D
## 主控制器：装配 战场 / 光标 / HUD / 波次导演 / 选关与结算浮层 / 常驻静音开关，
## 接线全部信号，驱动「选关 → 布防 → 抵御波次 → 结算 → 重开/下一关」完整闭环。
##
## 规范要点（见 SKILL.md「场景规范」「移动端触摸规范」「反馈完备性（Juice）」）：
## - 场景内信号连接统一写在 _ready()，集中可见、可被 preflight 静态核对；
## - 节点引用用 @onready + 类型标注，跨层用 %唯一名；
## - 触屏 UI 显示判定 fail-open（Web 直接问浏览器三信号，见 _touch_ui_should_show）；
## - 胜负结算的反馈挂在这里（_on_game_ended），不挂在输入处理上。

@onready var field: Field = $Field
@onready var cursor: Player = $Player
@onready var hud: Hud = %Hud

var director: WaveDirector
var level_select: LevelSelect
var result_overlay: ResultOverlay
var tuning_panel: TuningPanel
var mute_button: MuteButton

## HUD 顶栏与战场首行的最小间隙（设计 px，spec hudLayout.rows「两行不遮挡草坪首行」）。
const FIELD_CLEARANCE: float = 8.0

## 扁平明快：氛围层压成纯色底、无粒子、无暗角（风格卡禁忌：渐变堆砌）。
## 天空底色按章节切换（晨绿/暮橙/夜蓝 —— spec world.visualStyle 三章节配色）。
const AMBIENCE_FLAT: Dictionary = {
	"sky_top": Color("d5f0dd"),
	"sky_bottom": Color("d5f0dd"),
	"particle": "magic_01.png",
	"particle_tint": Color(1, 1, 1, 0.0),
	"particle_count": 0,
	"vignette_strength": 0.0,
}

var _move_hint: String = ""


func _ready() -> void:
	# 无头/桌面窗口尺寸钉回设计分辨率（headless 虚拟窗口默认 64×64，expand 拉伸会把
	# 设计画布撑成 1024×1024，HUD 度量与战场布局全数失真；Web 端窗口尺寸由壳页
	# canvas_resize_policy 接管，不在本列 —— spec hudLayout 以 CSS 视口为准）。
	if not OS.has_feature("web") and get_window() != null:
		# 调试口径：SMOKE_WINDOW_DEBUG="宽,高" 钉任意窗口几何（复现 Web 移动端画布），生产无副作用
		var pinned := OS.get_environment("SMOKE_WINDOW_DEBUG")
		if pinned.contains(","):
			var parts := pinned.split(",")
			get_window().size = Vector2i(int(parts[0]), int(parts[1]))
		else:
			get_window().size = Vector2i(int(Field.VIEW_SIZE.x), int(Field.VIEW_SIZE.y))
	# 试玩门禁上下文（playtest_driver.gd 把本场景当子场景实例化，current_scene 是驱动场景）：
	# 每局轮换到下一关，让机器人逐局真实游玩全部 3 关、逐关难度数值全程生效
	# （Bug cmvxr1f1a004fm905ua2ua9ir：试玩不再只刷第 1 关）。
	# 正常启动 current_scene == 本节点、冒烟 current_scene == Smoke，均不触发；
	# 局内重开走 GameState.reset()（不重建主场景），游标不推进、重开语义不变。
	var context_scene := get_tree().current_scene
	if context_scene != null and context_scene.name == &"PlaytestDriver":
		GameState.level_index = GameState.next_playtest_level()
		# 证据行：进 playtest 门禁日志，证明 3 局种子确实逐局对准了不同关卡
		# （GODOT_PLAYTEST 成功时包装脚本只透出 PASS/METRICS 两行，完整日志含本证据行）
		print("[main] playtest run -> level %d「%s」（波数 %d）" % [
			GameState.level_index + 1, GameState.level().get("name", ""), GameState.wave_count()])
	Ambience.setup(AMBIENCE_FLAT)
	director = WaveDirector.new()
	director.name = "WaveDirector"
	add_child(director)
	director.field = field
	level_select = LevelSelect.new()
	level_select.name = "LevelSelect"
	add_child(level_select)
	result_overlay = ResultOverlay.new()
	result_overlay.name = "ResultOverlay"
	add_child(result_overlay)
	# 常驻静音开关（spec audio.mute：右上角、全场景可见可点、即时生效）。
	# 对局中由 HUD 卡槽行的「音效」开关接管（spec hudLayout.rows 第 2 行 + 单实例守卫，
	# 避免顶栏两颗音效按钮互相重叠 —— Bug cmvyowgtj… 修复面），选关/结算态切回本开关。
	mute_button = MuteButton.new()
	mute_button.name = "MuteButton"
	add_child(mute_button)
	# 调参工作台（SKILL.md §3C）：URL 带 ?tuning= 才浮出面板（?tuning=<JSON> 也算）。
	# is_enabled() 在桌面/无头恒为 false（eval 返回 null）—— 冒烟与本地运行零成本。
	# ⚠️ 面板类必须有人实例化：tuning_panel.gd 只定义 class_name 不自建场景，
	# 缺这段接线时线上 ?tuning=1 永远不出面板（v6 部署实证的隐性缺陷）。
	if TuningPanel.is_enabled():
		tuning_panel = TuningPanel.new()
		tuning_panel.name = "TuningPanel"
		add_child(tuning_panel)
	cursor.field = field

	# 信号接线：订阅方（本场景 / HUD）写连接，发布方（GameState / 实体）只 emit。
	GameState.level_started.connect(_on_level_started)
	GameState.game_ended.connect(_on_game_ended)
	level_select.level_selected.connect(_on_level_selected)
	result_overlay.primary_pressed.connect(_on_result_primary)
	result_overlay.level_select_pressed.connect(_show_level_select)
	hud.restart_requested.connect(_restart_level)
	hud.back_requested.connect(_show_level_select)
	hud.skip_wave_requested.connect(_on_skip_wave_requested)
	field.defender_placed.connect(_on_defender_placed)
	director.wave_started.connect(_on_wave_started)
	director.waiting_changed.connect(_on_waiting_changed)
	hud.set_hint(_move_hint)
	get_viewport().size_changed.connect(_layout_field)
	_show_level_select()


## ── 界面流转 ──

func _show_level_select() -> void:
	GameState.running = false
	Audio.reset_tension()
	field.clear_all()
	cursor.active = false
	hud.visible = false
	mute_button.visible = true  # 非对局态：静音开关回到右上角常驻件
	result_overlay.close()
	level_select.open()
	_layout_field()


func _on_level_selected(index: int) -> void:
	Audio.ensure_playing()
	GameState.start_level(index)


func _on_level_started(level_index: int) -> void:
	level_select.close()
	result_overlay.close()
	field.clear_all()
	director.begin_level()
	hud.visible = true
	mute_button.visible = false  # 对局态：音效开关由 HUD 卡槽行接管（单实例）
	hud.rebuild_cards()
	Audio.reset_tension()  # 开局回基础版 BGM（spec tension「结算/回落切回基础版」）
	if GameState.endless_active:
		_move_hint = "无尽模式 · %s" % _input_hint()
	else:
		_move_hint = "第%d关 %s · %s" % [level_index + 1, String(GameState.level().get("name", "")), _input_hint()]
	# L1 教学引导（spec levelMechanics.teaching）：完成前提示常驻引导文案，完成后走常规淡出
	if not GameState.tutorial_done:
		hud.set_hint(_tutorial_hint(), true)
	else:
		hud.set_hint(_move_hint)
	cursor.active = true
	cursor.position = field.position + field.cell_center(Vector2i(3, 2))
	field.highlight_cell = cursor.current_cell()
	_apply_chapter_tint()
	_layout_field()


## 战场纵向布局（spec hudLayout.rows「折两行不遮挡草坪首行」的落地机制）：
## 战场整体下移让出 HUD 顶栏，画布有多余高度时垂直居中（expand 拉伸下的高画布）。
static func field_y_offset(hud_height: float, viewport_height: float) -> float:
	var d_min := maxf(0.0, hud_height + FIELD_CLEARANCE - float(Field.GRID_ORIGIN.y))
	var d_max := maxf(0.0, viewport_height - float(Field.VIEW_SIZE.y))
	var d_center := d_max * 0.5
	return clampf(maxf(d_min, d_center), 0.0, d_max)


## 依当前 HUD 高度与视口摆放战场（光标高亮格等逻辑坐标都在 Field 局部系，随节点平移）。
func _layout_field() -> void:
	if hud == null or field == null:
		return
	var viewport_height := get_viewport().get_visible_rect().size.y if get_viewport() != null \
		else float(Field.VIEW_SIZE.y)
	field.position.y = field_y_offset(hud.content_height(), viewport_height)
	# 相机对准可见画布中心（drag_center；expand 画布随窗口外扩，取景随 visible_rect 更新）：
	# 实测 anchor=FIXED_TOP_LEFT 在 4.3 下取景仍以 position 为中心，会把世界甩出画面右下角。
	var cam := get_node_or_null("GameCamera") as Camera2D
	if cam != null and get_viewport() != null:
		cam.anchor_mode = Camera2D.ANCHOR_MODE_DRAG_CENTER
		cam.position = get_viewport().get_visible_rect().size / 2.0
	_publish_view_state()


## 把渲染几何快照回写页面（window.__GAME_VIEW_STATE__）：门禁取证 / 远程诊断直读真实几何，
## 不用镜像拉伸公式（expand + HUD 让位 + 相机取景）。桌面/无头桥不工作（eval 恒 null）自动跳过。
func _publish_view_state() -> void:
	if not OS.has_feature("web") or not Engine.has_singleton("JavaScriptBridge"):
		return
	var cam: Camera2D = get_node_or_null("GameCamera")
	var window_size := get_window().size
	var visible_rect := get_viewport().get_visible_rect().size
	var cam_pos := cam.global_position if cam != null else Vector2.ZERO
	var cam_center := cam.get_screen_center_position() if cam != null else Vector2.ZERO
	var payload := JSON.stringify({
		"window_w": int(window_size.x), "window_h": int(window_size.y),
		"visible_w": visible_rect.x, "visible_h": visible_rect.y,
		"stretch_scale": get_viewport().get_final_transform().get_scale().x,
		"field_y": field.position.y,
		"camera_x": cam_pos.x, "camera_y": cam_pos.y,
		"camera_center_x": cam_center.x, "camera_center_y": cam_center.y,
		"camera_offset_x": cam.offset.x if cam != null else 0.0,
		"camera_offset_y": cam.offset.y if cam != null else 0.0,
		"camera_anchor": int(cam.anchor_mode) if cam != null else -1,
		"camera_zoom": cam.zoom.x if cam != null else 1.0,
		"hud_content_height": hud.content_height(),
	})
	# 直接对象字面量赋值（同 Audio._publish_state 口径 —— 实测 JSON.parse 包装会在页面侧抛
	# "Unexpected non-whitespace character after JSON"，对象字面量直赋最稳）
	var bridge: Object = Engine.get_singleton("JavaScriptBridge")
	bridge.call("eval", "window.__GAME_VIEW_STATE__ = %s" % payload)


## 教学引导文案（L1 首布防引导，完成前常驻 —— 完成后由 _on_defender_placed 切回常规提示淡出）。
func _tutorial_hint() -> String:
	var has_flower := _count_defenders(true) > 0
	if has_flower:
		return "引导：再放 1 座豌豆射手（首波前建成 向日葵+豌豆射手 各 1 座）"
	return "引导：先放 1 座向日葵（点第 1 张卡片，再点草坪）· %s" % _input_hint()


## 场上布防统计（is_flower=true 数向日葵，否则数射手；教学引导进度用）。
func _count_defenders(flower_only: bool) -> int:
	var n := 0
	for cell in field.get_defender_cells():
		var defender := field.defender_at(cell)
		if defender == null:
			continue
		if flower_only and defender.produces:
			n += 1
		elif not flower_only and not defender.produces:
			n += 1
	return n


## L1 首布防引导：每座新布防后评估完成态（向日葵 ≥1 + 射手 ≥1 且总数 ≥2），
## 完成即把提示切回常规操作说明（随 hint_show_seconds 自动淡出）。
func _on_defender_placed(_defender: Defender) -> void:
	if GameState.tutorial_done or not GameState.running:
		return
	var done := GameState.evaluate_tutorial(_count_defenders(true), _count_defenders(false),
		field.defender_count())
	if done:
		hud.set_hint(_move_hint)


## 章节氛围（晨绿/暮橙/夜蓝）：天空底色 + 场景提示条已随 GameState.chapter_tint 切换。
func _apply_chapter_tint() -> void:
	var tint: Color = GameState.level().get("chapter_tint", Color("d5f0dd"))
	Ambience.setup({
		"sky_top": tint,
		"sky_bottom": tint,
		"particle": "magic_01.png",
		"particle_tint": Color(1, 1, 1, 0.0),
		"particle_count": 0,
		"vignette_strength": 0.0,
	})


func _on_game_ended(won: bool) -> void:
	cursor.active = false
	hud.set_wave_wait_visible(false)
	Audio.reset_tension()  # 结算切回基础版 BGM（spec tension.bgmLayering）
	# 终局反馈挂结果处理函数：胜负音效 + 失败震屏（SKILL.md §3B）
	Juice.sfx(&"victory" if won else &"defeat")
	if not won:
		Juice.shake(9.0)
	result_overlay.show_result(
		won, GameState.level_index,
		String(GameState.level().get("name", "")), GameState.wave_count())


func _restart_level() -> void:
	Audio.ensure_playing()
	GameState.reset()


func _on_result_primary() -> void:
	if result_overlay.primary_action() == "next" and GameState.level_index + 1 < GameState.LEVELS.size():
		_on_level_selected(GameState.level_index + 1)
	else:
		_restart_level()


func _on_skip_wave_requested() -> void:
	director.next_wave()


func _on_wave_started(wave: int) -> void:
	# 波次来袭提示音（spec audio.sfxBindings：sfx-wave，含首波与最后一波；末波叠急促变体）
	var wave_count := GameState.wave_count()
	Juice.sfx(&"wave")
	if wave_count > 0 and wave >= wave_count - 1:
		Juice.sfx(&"wave_urgent")
	# 紧张版 BGM 分层切换（spec audio.tension.bgmLayering：出场过半或末波 → intense）
	Audio.update_wave_tension(wave, wave_count)


func _on_waiting_changed(waiting: bool) -> void:
	hud.set_wave_wait_visible(waiting)


## ── 输入（键盘路径；触屏点按在 Field._unhandled_input 与 HUD 卡片按钮）──
## 说明：对局中不设独立「重开」按键动作 —— 重开入口收口在 HUD 重开按钮与结算浮层，
## 避免误触把整局进度清掉（机器人试玩实证：可乱按的重开键会让节奏指标永远起不来）。

func _unhandled_input(event: InputEvent) -> void:
	# 浏览器音频手势解锁兜底：首个按下调起 BGM（壳页面已解锁时本调用幂等；
	# spec firstInteractionPolicy：首交互前不发声，解锁后立即起播）
	if event.is_pressed() and (event is InputEventKey or event is InputEventMouseButton or event is InputEventScreenTouch):
		Audio.ensure_playing()
	for i in GameState.roster().size():
		if event.is_action_pressed(StringName("select_card_%d" % (i + 1))):
			GameState.select_card(i)
			return
	if event.is_action_pressed("confirm"):
		if result_overlay.visible:
			result_overlay.press_primary()
		elif level_select.visible:
			level_select.press_default()
		elif GameState.running:
			field.try_place(cursor.position)


func _input_hint() -> String:
	if GameState.touch_preferred():
		return "点上方卡片选植物 · 点草坪布防 · 点阳光收集"
	return "1-5 选卡 · WASD/方向键移动光标 · 空格放置"
