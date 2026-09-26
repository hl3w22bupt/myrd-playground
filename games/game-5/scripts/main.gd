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
## 飘分颜色：基础 +10 与连击加分区分（知识 6e91a11d §三）。
const POPUP_BASE_COLOR: Color = Color(1, 1, 1)
const POPUP_COMBO_COLOR: Color = Color(1, 0.62, 0.15)

var time_left: float = GameState.MATCH_SECONDS
var match_over: bool = false

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
	start_match()


func _physics_process(delta: float) -> void:
	if match_over:
		return
	time_left -= delta
	log_spawner.time_left = time_left
	time_changed.emit(time_left)
	if time_left <= 0.0:
		time_left = 0.0
		_end_match(REASON_TIME_UP)


func _unhandled_input(event: InputEvent) -> void:
	# 结算界面键盘通道：Enter / Space（confirm 动作）重开 —— 双通道之一。
	if match_over and event.is_action_pressed("confirm"):
		start_match()


## 开局 / 重开。种子默认随机；冒烟与试玩传固定种子保证可复现。
func start_match(fruit_seed: int = -1, log_seed: int = -1) -> void:
	GameState.reset()
	time_left = GameState.MATCH_SECONDS
	match_over = false
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
		Juice.flash(player, Color(1, 0.35, 0.3, 0.8), 0.2)
		Juice.shake(9.0, 0.3)
		Juice.hit_stop(0.08)
		Juice.sfx(&"hit")
		Juice.sfx(&"fail")
	else:
		Juice.sfx(&"confirm")
	hud.show_result(title, GameState.score, GameState.fruits_collected, GameState.best_score)
	match_ended.emit(reason)


func _on_fruit_collected(fruit: Fruit) -> void:
	var gained: int = GameState.add_score()
	Juice.sfx(&"score")
	if gained > GameState.BASE_POINTS:
		Juice.sfx(&"confirm")
	_spawn_score_popup(fruit.global_position, gained)


## 飘分：跟随水果被收集的世界坐标；连击加分用不同颜色（不用角落滚动合计替代）。
func _spawn_score_popup(world_pos: Vector2, gained: int) -> void:
	var label := Label.new()
	label.text = "+%d" % gained
	label.add_theme_font_size_override("font_size", 22)
	label.add_theme_color_override(
		"font_color",
		POPUP_COMBO_COLOR if gained > GameState.BASE_POINTS else POPUP_BASE_COLOR)
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
