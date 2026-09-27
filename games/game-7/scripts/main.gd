extends Node2D
## 主场景控制器：星云滚动背景、陨石/水晶生成节拍、碰撞接线、HUD 与结算/重开。
##
## 信号方向（SKILL.md 规范）：Player / Meteor / Crystal / GameState 只 emit，
## 本场景在 _ready() 集中订阅；节点引用用 @onready + %唯一名。
## 生成参数全部出自统一配置（config.meteor.* / config.crystal.*），改配置不改代码（验收 5）。

const METEOR_SCENE: PackedScene = preload("res://scenes/meteor.tscn")
const CRYSTAL_SCENE: PackedScene = preload("res://scenes/crystal.tscn")

## 生成间隔下限（秒）：封顶档位下防抖动出负 / 失控密集。
const MIN_INTERVAL_SEC: float = 0.15
## 结算标题配色（胜/败反馈明确，验收 4）。
const WIN_TITLE_COLOR: Color = Color(0.55, 1.0, 0.7)
const LOSE_TITLE_COLOR: Color = Color(1.0, 0.45, 0.52)

@onready var player: Player = $Player
@onready var entities: Node2D = $Entities
@onready var touch_ui: CanvasLayer = $TouchUI
@onready var stats_label: Label = %StatsLabel
@onready var time_label: Label = %TimeLabel
@onready var move_hint: Label = %MoveHint
@onready var result_panel: Panel = %ResultPanel
@onready var result_title: Label = %ResultTitle
@onready var result_stats: Label = %ResultStats
@onready var result_hint: Label = %ResultHint

var _meteor_timer: float = 0.0
var _crystal_timer: float = 0.0
var _bursts: Array[CPUParticles2D] = []
var _spawn_rng := RandomNumberGenerator.new()


func _ready() -> void:
	_spawn_rng.randomize()
	if DisplayServer.is_touchscreen_available():
		touch_ui.visible = true
		move_hint.text = "摇杆移动 · 右下按钮 / 空格 重开"
	_connect_signals()
	# 调参工作台（SKILL.md §3C）：网页 + URL 带 ?tuning 参数才创建，其余环境零成本。
	if TuningPanel.is_enabled():
		add_child(TuningPanel.new())
	GameState.start_run()


func _connect_signals() -> void:
	if not player.moved.is_connected(_on_player_moved):
		player.moved.connect(_on_player_moved)
	if not GameState.score_changed.is_connected(_on_score_changed):
		GameState.score_changed.connect(_on_score_changed)
	if not GameState.hp_changed.is_connected(_on_hp_changed):
		GameState.hp_changed.connect(_on_hp_changed)
	if not GameState.speed_changed.is_connected(_on_speed_changed):
		GameState.speed_changed.connect(_on_speed_changed)
	if not GameState.crystal_streak_changed.is_connected(_on_streak_changed):
		GameState.crystal_streak_changed.connect(_on_streak_changed)
	if not GameState.run_started.is_connected(_on_run_started):
		GameState.run_started.connect(_on_run_started)
	if not GameState.run_ended.is_connected(_on_run_ended):
		GameState.run_ended.connect(_on_run_ended)


func _physics_process(delta: float) -> void:
	GameState.tick(delta)
	if GameState.phase != GameState.Phase.PLAYING:
		return
	_update_spawners(delta)


func _process(_delta: float) -> void:
	time_label.text = "%.1f / %d s" % [
		minf(GameState.run_time_sec, float(GameState.config["run"]["timeLimitSec"])),
		int(float(GameState.config["run"]["timeLimitSec"])),
	]
	_cleanup_bursts()


## ── 生成节拍：陨石基准 0.8s±0.3s（斜率 0.06 收紧）；水晶 1.1s±0.4s（同速收紧）+ 单屏 ≥1 保底 ──
## 基准间隔出自调参区变量（config 同步，试玩可调），收紧斜率出自 config。

func _update_spawners(delta: float) -> void:
	_meteor_timer -= delta
	_crystal_timer -= delta
	if _meteor_timer <= 0.0:
		spawn_meteor()
		_meteor_timer = _next_interval(
			GameState.meteor_spawn_interval,
			float(GameState.config["meteor"]["spawnJitterSec"]),
			float(GameState.config["meteor"]["tightenSlope"]),
		)
	if _crystal_timer <= 0.0 or _live_crystal_count() == 0:
		spawn_crystal()
		_crystal_timer = _next_interval(
			GameState.crystal_spawn_interval,
			float(GameState.config["crystal"]["spawnJitterSec"]),
			float(GameState.config["crystal"]["tightenSlope"]),
		)


## 收紧公式（纯函数，冒烟直接断言「生成频率随档位同步加快」，核心循环 5）：
## interval = base / (1 + slope × N)，下限 0.15s 防止高频抖动失控。
func tighten(base_sec: float, slope: float, streak: int) -> float:
	return maxf(MIN_INTERVAL_SEC, base_sec / (1.0 + slope * float(streak)))


## 实际下一间隔：收紧公式 + 随机抖动（抖动在收紧分母内，与调研口径一致）。
func _next_interval(base_sec: float, jitter_sec: float, slope: float) -> float:
	return tighten(base_sec + _spawn_rng.randf_range(-jitter_sec, jitter_sec), slope, GameState.crystal_streak)


func _live_crystal_count() -> int:
	var count := 0
	for child in entities.get_children():
		if child is Crystal:
			count += 1
	return count


## 生成陨石：默认从顶部随机 x（避开飞船 ±80px 判定带）；显式传入 at 则精确定位（冒烟用）。
func spawn_meteor(at: Vector2 = Vector2(-1.0, -1.0), type_index: int = -1) -> Meteor:
	var types: Array = GameState.config["meteor"]["types"]
	var cfg: Dictionary = types[type_index] if type_index >= 0 and type_index < types.size() else _pick_meteor_type(types)
	var meteor: Meteor = METEOR_SCENE.instantiate()
	meteor.setup(cfg)
	var size := get_viewport_rect().size
	var x: float = at.x if at.x >= 0.0 else _pick_meteor_x(size)
	meteor.position = Vector2(x, at.y if at.y >= 0.0 else -60.0)
	entities.add_child(meteor)
	meteor.hit_player.connect(_on_meteor_hit_player)
	return meteor


## 防刷脸杀：随机生成点避开飞船当前位置 ±80px 判定带（调研结论）。
func _pick_meteor_x(size: Vector2) -> float:
	var x := _spawn_rng.randf_range(40.0, size.x - 40.0)
	var clearance: float = float(GameState.config["meteor"]["shipClearancePx"])
	if absf(x - player.position.x) < clearance:
		var side := 1.0 if x >= player.position.x else -1.0
		x = clampf(player.position.x + side * (clearance + 24.0), 40.0, size.x - 40.0)
	return x


func _pick_meteor_type(types: Array) -> Dictionary:
	var total := 0.0
	for cfg: Dictionary in types:
		total += float(cfg["weight"])
	var roll := _spawn_rng.randf_range(0.0, total)
	for cfg: Dictionary in types:
		roll -= float(cfg["weight"])
		if roll <= 0.0:
			return cfg
	return types[0]


func spawn_crystal(at: Vector2 = Vector2(-1.0, -1.0)) -> Crystal:
	var crystal: Crystal = CRYSTAL_SCENE.instantiate()
	crystal.fall_factor = float(GameState.config["crystal"]["fallFactor"])
	var size := get_viewport_rect().size
	var x: float = at.x if at.x >= 0.0 else size.x * 0.5 + _spawn_rng.randf_range(-size.x * 0.4, size.x * 0.4)
	crystal.position = Vector2(clampf(x, 24.0, size.x - 24.0), at.y if at.y >= 0.0 else -40.0)
	entities.add_child(crystal)
	crystal.collected.connect(_on_crystal_collected)
	return crystal


## ── 信号处理 / HUD / 结算 / 重开 ──

func _on_player_moved(_pos: Vector2) -> void:
	_refresh_stats()


func _on_score_changed(_score: int) -> void:
	_refresh_stats()


func _on_hp_changed(_hp: int) -> void:
	_refresh_stats()


func _on_speed_changed(_speed: float) -> void:
	_refresh_stats()


func _on_streak_changed(_streak: int) -> void:
	_refresh_stats()


func _refresh_stats() -> void:
	stats_label.text = "生命 %d/%d · 档位 %s · 水晶 %d · 得分 %d" % [
		GameState.hp,
		int(float(GameState.config["hit"]["hp"])),
		GameState.speed_label(),
		GameState.total_crystals,
		GameState.score_int(),
	]


## 拾取水晶：收集提速 + 反馈三连（弹跳 / 音效 / 白色粒子，需求核心循环 4「拾取反馈」；
## 白粒子与陨石红闪形成反馈区分，调研结论）。反馈挂在结果事件处理函数上（SKILL.md §3B）。
func _on_crystal_collected(_crystal: Crystal) -> void:
	GameState.collect_crystal()
	Juice.pop(player)
	Juice.sfx(&"pickup")
	_spawn_burst(player.global_position, Color(str(GameState.config["visual"]["crystal"])))


## 被陨石命中：扣血/清零回 V0（GameState.take_hit）+ 反馈三连（音效 / 红闪 / 震屏），陨石销毁。
func _on_meteor_hit_player(meteor: Meteor) -> void:
	meteor.queue_free()
	Juice.sfx(&"hit")
	Juice.flash(player, Color(1.0, 0.35, 0.4, 0.8))
	Juice.shake(7.0)
	_spawn_burst(player.global_position, Color("#FF4D5E"))
	GameState.take_hit()


func _spawn_burst(pos: Vector2, tint: Color) -> void:
	var burst := CPUParticles2D.new()
	burst.one_shot = true
	burst.emitting = true
	burst.amount = 12
	burst.lifetime = 0.35
	burst.explosiveness = 1.0
	burst.direction = Vector2.UP
	burst.spread = 180.0
	burst.initial_velocity_min = 40.0
	burst.initial_velocity_max = 90.0
	burst.scale_amount_min = 1.5
	burst.scale_amount_max = 3.0
	burst.color = tint
	burst.position = pos
	entities.add_child(burst)
	_bursts.append(burst)


func _cleanup_bursts() -> void:
	for i in range(_bursts.size() - 1, -1, -1):
		var burst := _bursts[i]
		if not burst.emitting:
			_bursts.remove_at(i)
			burst.queue_free()


func _on_run_started() -> void:
	_clear_entities()
	player.reset_to(Vector2(get_viewport_rect().size.x * 0.5, get_viewport_rect().size.y * 0.72))
	_meteor_timer = GameState.meteor_spawn_interval
	_crystal_timer = 0.0
	result_panel.visible = false
	_refresh_stats()


func _on_run_ended(result: Dictionary) -> void:
	var win := str(result["reason"]) == "arrived"
	# 胜负反馈明确（验收 4）：标题配色区分 + 胜利/失败音效 + 面板弹跳；败局再叠顿帧定格。
	result_title.text = "到达终点！" if win else "飞船损毁…"
	result_title.add_theme_color_override("font_color", WIN_TITLE_COLOR if win else LOSE_TITLE_COLOR)
	result_stats.text = "存活 %.1f s · 水晶 %d · 最高速度 %.1fx · 总分 %d" % [
		float(result["survivedSec"]),
		int(result["crystals"]),
		float(result["maxSpeedMultiplier"]),
		int(result["score"]),
	]
	result_hint.text = "按 空格 / 回车 或点右下按钮 重新开始"
	result_panel.visible = true
	Juice.sfx(&"win" if win else &"fail")
	Juice.pop(result_panel)
	if not win:
		Juice.hit_stop(0.08)


## 结算后重开：触摸（右下按钮注入 confirm 动作）与键盘（空格/回车）双入口。
func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("confirm") and GameState.phase != GameState.Phase.PLAYING:
		Juice.sfx(&"confirm")
		GameState.start_run()


func _clear_entities() -> void:
	for child in entities.get_children():
		child.queue_free()
	_bursts.clear()
