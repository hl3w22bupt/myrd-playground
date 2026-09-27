extends Node2D
## 主场景控制器：单局流程（倒计时 / 终局两条路径 / 重开）与信号装配。
##
## 终局只有两条路径（知识 6e91a11d §一）：
##   倒计时归零 → 「时间到！」正常结算；碰到原木 → 「被原木击中！」失败结算。
## 两者都进结算界面；重开入口双通道（触摸 RestartButton + 键盘 confirm 动作）。
## 信号连接统一写在 _ready()（可被 preflight 静态核对）。

signal time_changed(time_left: float)
signal match_ended(reason: StringName)

const REASON_TIME_UP: StringName = &"time_up"
const REASON_HIT_LOG: StringName = &"hit_log"
## 飘分颜色：基础 +10 / 连击加分 / 金水果 / 坏水果惩罚 四种区分（知识 6e91a11d §三）。
const POPUP_BASE_COLOR: Color = Color(1, 1, 1)
const POPUP_COMBO_COLOR: Color = Color(1, 0.62, 0.15)
const POPUP_GOLDEN_COLOR: Color = Color(1, 0.84, 0.25)
const POPUP_BAD_COLOR: Color = Color(0.95, 0.3, 0.3)
## 倒计时告警：最后 5 秒每跨 1 秒一声 tick（用户反馈「倒计时最后 5 秒告警」）。
const TICK_LAST_SECONDS: int = 5

var time_left: float = GameState.MATCH_SECONDS
var match_over: bool = false

## 末 5 秒 tick 的去重游标（同一整秒只响一次；-1 = 本局尚未响过）。
var _tick_second: int = -1

@onready var player: Player = $Player
@onready var fruit_spawner: FruitSpawner = $FruitSpawner
@onready var log_spawner: LogSpawner = $LogSpawner
@onready var hud: Hud = $Hud
@onready var popups: Node2D = $Popups
@onready var touch_ui: CanvasLayer = $TouchUI


func _ready() -> void:
	# 订阅方（本场景）写连接代码；发布方（player/spawner/GameState）只 emit。
	fruit_spawner.fruit_collected.connect(_on_fruit_collected)
	log_spawner.log_hit_player.connect(_on_log_hit_player)
	hud.restart_requested.connect(_on_hud_restart_requested)
	GameState.score_changed.connect(hud.on_score_changed)
	GameState.fruits_changed.connect(hud.on_fruits_changed)
	time_changed.connect(hud.on_time_changed)
	# 触摸 UI 只在有触摸屏时显示（SKILL.md §3A：按触屏能力判定，不用平台特征代替）。
	if DisplayServer.is_touchscreen_available():
		touch_ui.visible = true
	# 调参工作台（SKILL.md §3C）：网页 + URL 带 ?tuning 参数才创建，其余环境零成本。
	if TuningPanel.is_enabled():
		add_child(TuningPanel.new())
	# 验收中枢页（需求 cmujot5ys0051m99i5t96onmo）：常驻入口（按钮 / H 键 / ?hub=1 直达），
	# 全代码构建、桌面与无头自动降级 —— 挂载本身零玩法影响。
	var hub := AcceptanceHub.new()
	hub.name = "AcceptanceHub"
	add_child(hub)
	start_match()


func _physics_process(delta: float) -> void:
	if match_over:
		return
	time_left -= delta
	log_spawner.time_left = time_left
	time_changed.emit(time_left)
	_tick_countdown_warning()
	if time_left <= 0.0:
		time_left = 0.0
		_end_match(REASON_TIME_UP)


## 末 5 秒告警：整秒跳变（60→59…→5→4→3→2→1）时每秒一声 tick；start_match 重置游标。
func _tick_countdown_warning() -> void:
	var second: int = int(ceilf(maxf(time_left, 0.0)))
	if second != _tick_second:
		_tick_second = second
		if second > 0 and second <= TICK_LAST_SECONDS:
			Juice.sfx(&"tick")


func _unhandled_input(event: InputEvent) -> void:
	# 结算界面键盘通道：Enter / Space（confirm 动作）重开 —— 双通道之一。
	if match_over and event.is_action_pressed("confirm"):
		start_match()
	# 静音开关键盘通道：M 键（toggle_mute 动作）—— 桌面端不用去够屏幕右上角按钮。
	if event.is_action_pressed("toggle_mute"):
		Juice.toggle_muted()


## 开局 / 重开。种子默认随机；冒烟与试玩传固定种子保证可复现。
func start_match(fruit_seed: int = -1, log_seed: int = -1) -> void:
	GameState.reset()
	time_left = GameState.MATCH_SECONDS
	match_over = false
	_tick_second = -1
	player.reset_for_new_match()
	fruit_spawner.start_match(fruit_seed if fruit_seed >= 0 else randi())
	log_spawner.start_match(log_seed if log_seed >= 0 else randi())
	hud.hide_result()
	hud.on_score_changed(GameState.score)
	hud.on_fruits_changed(GameState.fruits_collected)
	hud.on_time_changed(time_left)
	time_changed.emit(time_left)


func _end_match(reason: StringName) -> void:
	if match_over:
		return
	match_over = true
	player.frozen = true
	fruit_spawner.stop_match()
	log_spawner.stop_match()
	log_spawner.freeze_logs()
	# 历史最高分先覆写、结算界面后读取 —— 三处数字自洽（知识 6e91a11d §六）。
	GameState.submit_final_score(GameState.score)
	var title: String = "被原木击中！" if reason == REASON_HIT_LOG else "时间到！"
	if reason == REASON_HIT_LOG:
		# 撞击瞬间：hit + fail（撞击声 + 失败短句）；结算界面统一再给 settle。
		Juice.flash(player, Color(1, 0.35, 0.3, 0.8), 0.2)
		Juice.shake(9.0, 0.3)
		Juice.hit_stop(0.08)
		Juice.sfx(&"hit")
		Juice.sfx(&"fail")
	# 结算音（两条终局路径共用，用户反馈「结算」音效；HUD 不再重复播）。
	Juice.sfx(&"settle")
	hud.show_result(title, GameState.score, GameState.fruits_collected, GameState.best_score)
	match_ended.emit(reason)


func _on_fruit_collected(fruit: Fruit) -> void:
	if fruit.is_golden():
		# 金水果：固定高分 + 专属音效 + 金色大字飘分（仍是成功收集，计入水果数/刷新连击）。
		var gained_golden: int = GameState.add_golden_score()
		Juice.sfx(&"golden")
		_spawn_score_popup(fruit.global_position, gained_golden, POPUP_GOLDEN_COLOR, 28)
		return
	if fruit.is_bad():
		# 坏水果：扣分 + 短暂减速（用户反馈「扣分或减速」→ 两者都给，惩罚可感知）。
		var penalty: int = GameState.apply_bad_fruit()
		player.apply_slow()
		Juice.sfx(&"bad")
		Juice.flash(player, Color(0.4, 0.3, 0.15, 0.6), 0.25)
		_spawn_score_popup(fruit.global_position, -penalty, POPUP_BAD_COLOR, 24)
		return
	# 普通水果：+10，窗口内追加 +5（连击加成唯一入口在 GameState.add_score）。
	var gained: int = GameState.add_score()
	Juice.sfx(&"score")
	if gained > GameState.BASE_POINTS:
		Juice.sfx(&"confirm")
		_spawn_score_popup(fruit.global_position, gained, POPUP_COMBO_COLOR, 22)
	else:
		_spawn_score_popup(fruit.global_position, gained, POPUP_BASE_COLOR, 22)


## 飘分：跟随水果被收集的世界坐标；普通/连击/金/坏四种颜色与字号区分（不做角落滚动合计）。
func _spawn_score_popup(world_pos: Vector2, value: int, color: Color, font_size: int) -> void:
	var label := Label.new()
	label.text = "%+d" % value
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", color)
	label.z_index = 50
	popups.add_child(label)
	label.position = world_pos + Vector2(-14, -34)
	var tween := label.create_tween()
	tween.tween_property(label, "position:y", label.position.y - 30.0, 0.5)
	tween.parallel().tween_property(label, "modulate:a", 0.0, 0.5).set_delay(0.15)
	tween.tween_callback(label.queue_free)


func _on_log_hit_player() -> void:
	_end_match(REASON_HIT_LOG)


func _on_hud_restart_requested() -> void:
	if match_over:
		start_match()
