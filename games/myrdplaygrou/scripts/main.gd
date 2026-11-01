extends Node2D
## 主控制器：装配 战场 / 光标 / HUD / 波次导演 / 选关与结算浮层，
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

## 扁平明快：氛围层压成纯色底、无粒子、无暗角（风格卡禁忌：渐变堆砌）。
const AMBIENCE_FLAT: Dictionary = {
	"sky_top": Color("2ecc71"),
	"sky_bottom": Color("2ecc71"),
	"particle": "magic_01.png",
	"particle_tint": Color(1, 1, 1, 0.0),
	"particle_count": 0,
	"vignette_strength": 0.0,
}

var _move_hint: String = ""


func _ready() -> void:
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
	hud.set_hint(_move_hint)
	_show_level_select()


## ── 界面流转 ──

func _show_level_select() -> void:
	GameState.running = false
	field.clear_all()
	cursor.active = false
	hud.visible = false
	result_overlay.close()
	level_select.open()


func _on_level_selected(index: int) -> void:
	Audio.ensure_playing()
	GameState.start_level(index)


func _on_level_started(level_index: int) -> void:
	level_select.close()
	result_overlay.close()
	field.clear_all()
	director.begin_level()
	hud.visible = true
	_move_hint = "第%d关 %s · %s" % [level_index + 1, String(GameState.level().get("name", "")), _input_hint()]
	hud.set_hint(_move_hint)
	cursor.active = true
	cursor.position = field.cell_center(Vector2i(3, 2))
	field.highlight_cell = cursor.current_cell()


func _on_game_ended(won: bool) -> void:
	cursor.active = false
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


## ── 输入（键盘路径；触屏点按在 Field._unhandled_input 与 HUD 卡片按钮）──
## 说明：对局中不设独立「重开」按键动作 —— 重开入口收口在 HUD 重开按钮与结算浮层，
## 避免误触把整局进度清掉（机器人试玩实证：可乱按的重开键会让节奏指标永远起不来）。

func _unhandled_input(event: InputEvent) -> void:
	# 浏览器音频手势解锁兜底：首个按下调起 BGM（壳页面已解锁时本调用幂等）
	if event.is_pressed() and (event is InputEventKey or event is InputEventMouseButton or event is InputEventScreenTouch):
		Audio.ensure_playing()
	for i in GameState.CARDS.size():
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
	return "1/2/3 选卡 · WASD/方向键移动光标 · 空格放置"
