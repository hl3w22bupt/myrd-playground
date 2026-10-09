extends Node2D
## 主场景：《节奏大师》—— 四轨下落式节拍玩法骨架（休闲收集）。
##
## 装配（全部代码构建，场景文件只保留根节点）：
##   Conductor（歌曲时钟/谱面） + 4×Lane（轨道） + HUD（CanvasLayer） + TouchUI（触控分区）
## 信号集中在 _ready() 连接（发布方只 emit，订阅方集中连接）；
## 结果性事件（命中/MISS/结束/重开）挂 Juice 反馈（SKILL.md §3B）。

## 四轨主色（蓝 / 青 / 橙 / 粉，判定圈与轨道底色共用）。
const LANE_COLORS: Array[Color] = [
	Color(0.35, 0.65, 1.0), Color(0.30, 0.85, 0.75),
	Color(1.0, 0.72, 0.30), Color(1.0, 0.45, 0.70),
]
const HUD_FONT_SIZE: int = 30
const TITLE_FONT_SIZE: int = 44
const LANE_KEYS: Array[String] = ["D", "F", "J", "K"]
## 移动端触控带（四轨分区）：屏幕底部整带，四轨等宽铺满。
const TOUCH_BAND_Y: float = 1150.0
const TOUCH_BAND_H: float = 130.0
## 工具按钮行（重开/校准/难度）：夹在判定圈（1018..1062）与触控带（1150+）之间，
## 与四轨分区零重叠 —— 重叠会让击打误触校准/重开（移动端可玩性缺陷）。
const UTILITY_ROW_Y: float = 1066.0
const UTILITY_ROW_H: float = 60.0

var conductor: Conductor
var lanes: Array[Lane] = []
var hud: CanvasLayer
var title_label: Label
var score_label: Label
var combo_label: Label
var judgment_label: Label
var status_label: Label
var results_panel: PanelContainer
var results_label: Label
var touch_ui: CanvasLayer
var _difficulty_buttons: Array[TouchActionButton] = []
var _move_hint: String = "D/F/J/K 击打 · R 重开"


func _ready() -> void:
	_build_stage()
	_build_hud()
	_build_touch_ui()
	_connect_signals()
	_refresh_static_hud()
	conductor.start()
	_refresh_hud()


## ── 装配 ──

func _build_stage() -> void:
	conductor = Conductor.new()
	add_child(conductor)
	for i in Conductor.LANE_COUNT:
		var lane := Lane.new()
		lane.lane_index = i
		lane.conductor = conductor
		lane.lane_color = LANE_COLORS[i]
		lane.position = Vector2(Conductor.LANE_WIDTH * (float(i) + 0.5), 0.0)
		add_child(lane)
		lanes.append(lane)
	conductor.lanes = lanes  # 轨道注册到指挥：激活/终局收口都走 conductor.lanes


func _make_label(y: float, font_size: int = HUD_FONT_SIZE) -> Label:
	var label := Label.new()
	label.position = Vector2(16.0, y)
	label.size = Vector2(Conductor.LANE_COUNT * Conductor.LANE_WIDTH - 32.0, font_size + 12)
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", Color(0.95, 0.96, 1.0, 0.92))
	hud.add_child(label)
	return label


func _build_hud() -> void:
	hud = CanvasLayer.new()
	hud.layer = 5
	add_child(hud)
	title_label = _make_label(6.0, TITLE_FONT_SIZE)
	score_label = _make_label(66.0)
	combo_label = _make_label(110.0)
	judgment_label = _make_label(154.0)
	status_label = _make_label(198.0)
	results_panel = PanelContainer.new()
	results_panel.visible = false
	results_panel.position = Vector2(60.0, 360.0)
	results_panel.custom_minimum_size = Vector2(600.0, 420.0)
	hud.add_child(results_panel)
	results_label = Label.new()
	results_label.add_theme_font_size_override("font_size", 34)
	results_label.add_theme_color_override("font_color", Color(1.0, 0.97, 0.9, 0.96))
	results_panel.add_child(results_label)


func _build_touch_ui() -> void:
	touch_ui = CanvasLayer.new()
	touch_ui.layer = 10
	# 可见性只由触屏可用性决定（SKILL.md §3A：不要用平台特征代替）。
	touch_ui.visible = DisplayServer.is_touchscreen_available()
	add_child(touch_ui)
	if touch_ui.visible:
		_move_hint = "点击下方分区击打音符"
	# 按钮无条件构建、由层可见性统一控制（TouchScreenButton 不可见即不响应）；
	# 无头冒烟因此也能机判触控分区结构（AC4 代理断言）。
	# 四轨触控分区（多点并发，各按钮独立跟踪触点）。
	for i in Conductor.LANE_COUNT:
		var rect := Rect2(Conductor.LANE_WIDTH * float(i), TOUCH_BAND_Y,
			Conductor.LANE_WIDTH, TOUCH_BAND_H)
		touch_ui.add_child(TouchActionButton.create(
			StringName("lane_%d" % (i + 1)), rect, LANE_KEYS[i], 52))
	# 工具按钮行：与四轨分区零重叠（重叠 = 击打误触，移动端可玩性缺陷）。
	var cal_down := TouchActionButton.create(&"", Rect2(16.0, UTILITY_ROW_Y, 150.0, UTILITY_ROW_H),
		"校准−10", 24)
	var cal_up := TouchActionButton.create(&"", Rect2(180.0, UTILITY_ROW_Y, 150.0, UTILITY_ROW_H),
		"校准+10", 24)
	touch_ui.add_child(cal_down)
	touch_ui.add_child(cal_up)
	cal_down.pressed.connect(_on_calibration_down)
	cal_up.pressed.connect(_on_calibration_up)
	# 难度切换按钮（结算页开放，进行中隐藏）：注入 diff_prev/diff_next，与键盘同路径。
	var diff_down := TouchActionButton.create(&"diff_prev",
		Rect2(356.0, UTILITY_ROW_Y, 100.0, UTILITY_ROW_H), "难度‹", 24)
	var diff_up := TouchActionButton.create(&"diff_next",
		Rect2(468.0, UTILITY_ROW_Y, 100.0, UTILITY_ROW_H), "难度›", 24)
	touch_ui.add_child(diff_down)
	touch_ui.add_child(diff_up)
	diff_down.visible = false
	diff_up.visible = false
	_difficulty_buttons = [diff_down, diff_up]
	# 重开按钮（注入 restart 动作，与键盘同路径；进行中按下无效果由 _restart 保护）。
	touch_ui.add_child(TouchActionButton.create(
		&"restart", Rect2(588.0, UTILITY_ROW_Y, 118.0, UTILITY_ROW_H), "重开", 30))


## 难度切换按钮只随结算面板显隐（切档只在结算页开放）。
func _set_difficulty_buttons_visible(visible_now: bool) -> void:
	for button in _difficulty_buttons:
		button.visible = visible_now


func _connect_signals() -> void:
	for lane in lanes:
		if not lane.note_judged.is_connected(_on_lane_note_judged):
			lane.note_judged.connect(_on_lane_note_judged)
	if not conductor.finished.is_connected(_on_conductor_finished):
		conductor.finished.connect(_on_conductor_finished)
	if not GameState.judgment_recorded.is_connected(_on_judgment_recorded):
		GameState.judgment_recorded.connect(_on_judgment_recorded)
	if not GameState.score_changed.is_connected(_on_score_changed):
		GameState.score_changed.connect(_on_score_changed)
	if not GameState.combo_changed.is_connected(_on_combo_changed):
		GameState.combo_changed.connect(_on_combo_changed)
	if not GameState.game_finished.is_connected(_on_game_finished):
		GameState.game_finished.connect(_on_game_finished)


## ── 输入（只读 InputMap 动作名；触摸分区经 TouchActionButton 注入同一批动作）──

func _unhandled_input(event: InputEvent) -> void:
	for i in Conductor.LANE_COUNT:
		if event.is_action_pressed("lane_%d" % (i + 1)):
			_press_lane(i)
			return
	if event.is_action_pressed("restart"):
		_restart()
		return
	if event.is_action_pressed("diff_next"):
		_switch_difficulty(1)
		return
	if event.is_action_pressed("diff_prev"):
		_switch_difficulty(-1)
		return
	if event.is_action_pressed("confirm") and results_panel.visible:
		_restart()


func _press_lane(lane_index: int) -> void:
	# 结算态保护由 playing=false 承担（paused 只冻结歌曲时钟，按键判定仍走正常路径）。
	if not conductor.playing:
		return
	lanes[lane_index].press(conductor.song_time, GameState.calibration_offset_ms)


func _switch_difficulty(step: int) -> void:
	if not results_panel.visible:
		return  # 换难度只在结算页开放（进行中切换会打断本局谱面）
	GameState.set_difficulty(GameState.difficulty + step)
	_refresh_static_hud()
	Juice.sfx(&"confirm")


func _restart() -> void:
	# 重开入口只在结算态生效：进行中忽略（防误触把整局打回原点——
	# bot/fuzz 乱按 R 会把歌曲永远卡在开头，对人对机器都不可玩）。
	if conductor.playing:
		return
	results_panel.visible = false
	_set_difficulty_buttons_visible(false)
	conductor.paused = false
	GameState.reset()
	conductor.restart()
	Juice.sfx(&"confirm")
	_refresh_hud()


## ── 结果性事件处理（Juice 反馈只写在这一处，不挂在输入处理上）──

func _on_lane_note_judged(lane_index: int, judgment: int, _diff_ms: float) -> void:
	match judgment:
		BeatJudge.Judgment.PERFECT:
			GameState.register_hit(BeatJudge.Judgment.PERFECT)
			Juice.pop(lanes[lane_index])
			Juice.sfx(&"score")
		BeatJudge.Judgment.GOOD:
			GameState.register_hit(BeatJudge.Judgment.GOOD)
			Juice.flash(lanes[lane_index], Color(1.0, 1.0, 1.0, 0.4))
			Juice.sfx(&"hit")
		_:
			GameState.register_miss(BeatJudge.Judgment.MISS)
			Juice.flash(lanes[lane_index], Color(1.0, 0.25, 0.25, 0.5))
			Juice.sfx(&"fail")


func _on_conductor_finished() -> void:
	GameState.finish()


func _on_game_finished(cleared: bool) -> void:
	conductor.paused = true
	var accuracy := float(GameState.perfect_count + GameState.good_count) \
		/ float(maxi(GameState.total_notes, 1))
	var verdict := "通关！" if cleared else "未通关"
	results_label.text = "%s · %s\n\n总分 %d\n最大连击 %d\n\nPERFECT %d · GOOD %d · MISS %d\n命中率 %d%%\n\n难度 %s · ←/→ 换难度\n按 R（或点「重开」）再来一局" % [
		verdict, "♪" if cleared else "×", GameState.score, GameState.max_combo,
		GameState.perfect_count, GameState.good_count, GameState.miss_count,
		int(round(accuracy * 100.0)), GameState.difficulty_name(),
	]
	results_panel.visible = true
	_set_difficulty_buttons_visible(true)
	if cleared:
		Juice.pop(results_panel)
		Juice.sfx(&"score")
	else:
		Juice.flash(results_panel, Color(1.0, 0.3, 0.3, 0.4))
		Juice.sfx(&"fail")


## ── HUD 刷新 ──

func _refresh_static_hud() -> void:
	title_label.text = "节奏大师 · %s" % GameState.difficulty_name()


func _refresh_hud() -> void:
	score_label.text = "分数 %d" % GameState.score
	combo_label.text = "连击 %d（最大 %d）" % [GameState.combo, GameState.max_combo]
	judgment_label.text = "P %d · G %d · MISS %d" % [
		GameState.perfect_count, GameState.good_count, GameState.miss_count]
	status_label.text = "%s · 校准 %s%dms" % [_move_hint,
		"+" if GameState.calibration_offset_ms >= 0.0 else "",
		int(GameState.calibration_offset_ms)]


func _on_judgment_recorded(_judgment: int) -> void:
	_refresh_hud()


func _on_score_changed(score: int) -> void:
	score_label.text = "分数 %d" % score
	status_label.text = "%s · 校准 %s%dms" % [_move_hint,
		"+" if GameState.calibration_offset_ms >= 0.0 else "",
		int(GameState.calibration_offset_ms)]


func _on_combo_changed(combo: int, max_combo: int) -> void:
	combo_label.text = "连击 %d（最大 %d）" % [combo, max_combo]
	if combo >= 10 and combo % 10 == 0:
		Juice.shake(4.0)  # 连击里程碑反馈


func _on_calibration_down() -> void:
	GameState.add_calibration(-10.0)


func _on_calibration_up() -> void:
	GameState.add_calibration(10.0)
