extends Node2D
## 主场景控制器：装配 UI、跑生成系统、订阅 Player / GameState / 实体信号。
##
## 规范要点（SKILL.md「场景规范」「移动端触摸规范」）：
## - 场景内信号连接统一写在 _ready()，集中可见、可被 preflight 静态核对；
## - 节点引用用 @onready + 类型标注，路径用 %唯一名；
## - 触摸 UI（摇杆/确认按钮）只在有触摸屏时显示；游戏逻辑只读 InputMap 动作名；
## - 生成约束（知识基准 2.4）：避开飞船 ±80px 判定带；实体两两间距 ≥ 大者半径 ×1.5；重掷 ≤5 次。

const CrystalScene: PackedScene = preload("res://scenes/crystal.tscn")
const MeteorScene: PackedScene = preload("res://scenes/meteor.tscn")

const PLAYFIELD_SIZE: Vector2 = Vector2(720.0, 1280.0)
const METEOR_SPAWN_Y: float = -60.0
const CRYSTAL_X_HALF_SPAN: float = 0.4 * 720.0   ## 横向 ±40% 屏宽
const CRYSTAL_Y_MIN: float = 0.1 * 1280.0        ## 纵向 10%~90%
const CRYSTAL_Y_MAX: float = 0.9 * 1280.0
const SPAWN_RETRY_MAX: int = 5
const FRAGMENT_RADIUS_DIV: float = 2.0           ## 分裂子体 r 减半
const FRAGMENT_OFFSET_MUL: float = 0.6

## 陨石类型分布锚点表（知识基准 2.3：D1/D3/D6），中间档位线性插值。
const KIND_TABLE: Dictionary = {
	1: [0.70, 0.20, 0.10],
	3: [0.55, 0.28, 0.17],
	6: [0.45, 0.33, 0.22],
}

@onready var player: Player = $Player
@onready var entities: Node2D = $Entities
@onready var starfield: Starfield = $Starfield
@onready var touch_ui: CanvasLayer = $TouchUI
@onready var hud_label: Label = %HudLabel
@onready var shield_label: Label = %ShieldLabel
@onready var boost_label: Label = %BoostLabel
@onready var result_panel: PanelContainer = %ResultPanel
@onready var final_score_label: Label = %FinalScore
@onready var final_crystals_label: Label = %FinalCrystals
@onready var final_time_label: Label = %FinalTime
@onready var final_best_label: Label = %FinalBest
@onready var flash_rect: ColorRect = %FlashRect

var spawning_enabled: bool = true  ## 冒烟测试关掉自然生成，保证断言确定性；默认开

var _meteor_timer: float = 0.0
var _crystal_timer: float = 0.0
var _crystal_dry_time: float = 0.0
var _move_hint: String = "A/D 或 ←/→ 横移 · W/S 微调"


func _ready() -> void:
	if DisplayServer.is_touchscreen_available():
		touch_ui.visible = true
		_move_hint = "左下摇杆移动 · 右下按钮确认"
	# 信号连接：订阅方（本场景）写连接代码，发布方（player / 实体 / GameState）只 emit。
	player.moved.connect(_on_player_moved)
	GameState.score_changed.connect(_on_score_changed)
	GameState.shield_changed.connect(_on_shield_changed)
	GameState.combo_changed.connect(_on_combo_changed)
	GameState.boost_changed.connect(_on_boost_changed)
	GameState.game_finished.connect(_on_game_over)
	GameState.reset()
	_meteor_timer = GameState.meteor_spawn_interval()
	_crystal_timer = GameState.CRYSTAL_INTERVAL_SEC
	result_panel.visible = false
	flash_rect.color.a = 0.0
	_refresh_hud()


func _physics_process(delta: float) -> void:
	if GameState.game_over or not spawning_enabled:
		return
	_tick_meteor_spawner(delta)
	_tick_crystal_spawner(delta)


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("confirm") and GameState.game_over:
		_restart()


## ── 生成系统 ──

func _tick_meteor_spawner(delta: float) -> void:
	_meteor_timer -= delta
	if _meteor_timer > 0.0:
		return
	if _count_meteors() < GameState.meteor_cap():
		_try_spawn_meteor()
	_meteor_timer = _jittered(GameState.meteor_spawn_interval(), GameState.METEOR_SPAWN_JITTER)


func _tick_crystal_spawner(delta: float) -> void:
	_crystal_dry_time += delta
	_crystal_timer -= delta
	var crystal_count := _count_crystals()
	if crystal_count == 0 and _crystal_dry_time >= GameState.CRYSTAL_FORCE_SPAWN_AFTER_SEC:
		## 同屏保底 1 颗：连续 3s 无水晶强制刷新，防连击窗口空窗（知识基准 3）。
		spawn_crystal(_find_crystal_pos())
		_crystal_timer = _jittered(GameState.CRYSTAL_INTERVAL_SEC, _crystal_jitter_ratio())
		_crystal_dry_time = 0.0
		return
	if _crystal_timer > 0.0:
		return
	if crystal_count < GameState.CRYSTAL_MAX_ON_SCREEN:
		spawn_crystal(_find_crystal_pos())
		_crystal_dry_time = 0.0
	_crystal_timer = _jittered(GameState.CRYSTAL_INTERVAL_SEC, _crystal_jitter_ratio())


func _crystal_jitter_ratio() -> float:
	return GameState.CRYSTAL_JITTER_SEC / GameState.CRYSTAL_INTERVAL_SEC


func _jittered(value: float, ratio: float) -> float:
	return value * randf_range(1.0 - ratio, 1.0 + ratio)


func _try_spawn_meteor() -> void:
	var difficulty := GameState.difficulty()
	var kind := _roll_meteor_kind(difficulty)
	var radius := _meteor_radius(kind)
	for attempt: int in range(SPAWN_RETRY_MAX):
		var pos := Vector2(randf_range(48.0, PLAYFIELD_SIZE.x - 48.0), METEOR_SPAWN_Y)
		if not _respects_constraints(pos, radius):
			continue
		spawn_meteor(kind, radius, pos)
		return


func _find_crystal_pos() -> Vector2:
	var radius := Crystal.PICKUP_RADIUS
	var pos := Vector2(
		PLAYFIELD_SIZE.x * 0.5,
		randf_range(CRYSTAL_Y_MIN, CRYSTAL_Y_MAX),
	)
	for attempt: int in range(SPAWN_RETRY_MAX):
		pos = Vector2(
			PLAYFIELD_SIZE.x * 0.5 + randf_range(-CRYSTAL_X_HALF_SPAN, CRYSTAL_X_HALF_SPAN),
			randf_range(CRYSTAL_Y_MIN, CRYSTAL_Y_MAX),
		)
		if _respects_constraints(pos, radius):
			return pos
	return pos


## 知识基准 2.4：避开飞船 ±80px 判定带；与屏内实体两两间距 ≥ 大者半径 ×1.5。
func _respects_constraints(pos: Vector2, radius: float) -> bool:
	if pos.distance_to(player.global_position) < GameState.SPAWN_AVOID_SHIP_BAND:
		return false
	for child in entities.get_children():
		var other_radius := _entity_radius(child)
		if pos.distance_to((child as Node2D).position) < maxf(radius, other_radius) * GameState.SPAWN_MIN_GAP_RADIUS_MUL:
			return false
	return true


func _entity_radius(child: Node) -> float:
	if child is Meteor:
		return (child as Meteor).radius
	if child is Crystal:
		return Crystal.PICKUP_RADIUS
	return 0.0


func _meteor_radius(kind: Meteor.Kind) -> float:
	match kind:
		Meteor.Kind.NORMAL:
			return randf_range(22.0, 28.0)
		Meteor.Kind.FAST:
			return randf_range(10.0, 14.0)
		_:
			return randf_range(14.0, 18.0)


## 类型分布：按档位在锚点表（D1/D3/D6）间线性插值后掷骰。
func _roll_meteor_kind(difficulty: int) -> Meteor.Kind:
	var roll := randf()
	var weights := _kind_weights(difficulty)
	if roll < weights[0]:
		return Meteor.Kind.NORMAL
	if roll < weights[0] + weights[1]:
		return Meteor.Kind.FAST
	return Meteor.Kind.SPLITTER


func _kind_weights(difficulty: int) -> Array:
	## 低锚 = ≤difficulty 的最大档位键，高锚 = ≥difficulty 的最小档位键（命中锚点档直接返回）。
	var low_d: int = -1
	var high_d: int = -1
	for key: int in KIND_TABLE:
		if key <= difficulty and key > low_d:
			low_d = key
		if key >= difficulty and (high_d == -1 or key < high_d):
			high_d = key
	var low: Array = KIND_TABLE[low_d]
	var high: Array = KIND_TABLE[high_d]
	if low_d == high_d:
		return low
	var t := float(difficulty - low_d) / float(high_d - low_d)
	var weights: Array = []
	for i: int in range(low.size()):
		weights.append(lerp(float(low[i]), float(high[i]), t))
	return weights


## ── 实体工厂（生成器与冒烟测试共用，保证断言走真实接线）──

func spawn_crystal(pos: Vector2) -> Crystal:
	var crystal: Crystal = CrystalScene.instantiate()
	crystal.position = pos
	crystal.collected.connect(_on_crystal_collected)
	entities.add_child(crystal)
	return crystal


func spawn_meteor(kind: Meteor.Kind, radius: float, pos: Vector2, split_y: float = -1.0) -> Meteor:
	var meteor: Meteor = MeteorScene.instantiate()
	meteor.setup(kind, radius, split_y)
	meteor.position = pos
	meteor.hit_ship.connect(_on_meteor_hit_ship)
	meteor.split_requested.connect(_on_meteor_split)
	entities.add_child(meteor)
	return meteor


func _count_meteors() -> int:
	var count := 0
	for child in entities.get_children():
		if child is Meteor:
			count += 1
	return count


func _count_crystals() -> int:
	var count := 0
	for child in entities.get_children():
		if child is Crystal:
			count += 1
	return count


## ── 信号处理 ──

func _on_crystal_collected(_crystal: Crystal) -> void:
	GameState.register_crystal_collected()
	Juice.pop(player)
	Juice.sfx(&"score")
	if GameState.combo == GameState.COMBO_TRIGGER:
		## 连击触发加速：全屏 10% 白闪 0.1s + 短促上扬音（正反馈峰值标记）。
		_flash_screen()
		Juice.sfx(&"confirm")


func _on_meteor_hit_ship(meteor: Meteor) -> void:
	if not GameState.take_hit():
		return  # 无敌帧内穿过，不扣盾不销毁
	Juice.flash(player, Color(1.0, 0.3, 0.3, 0.85))
	Juice.shake(8.0)
	Juice.hit_stop()
	Juice.sfx(&"hit")
	meteor.queue_free()


func _on_meteor_split(meteor: Meteor) -> void:
	## 分裂子体：r 减半、各 0.9x、横向 ±25° 散开（知识基准 2.3）。
	var child_radius := meteor.radius / FRAGMENT_RADIUS_DIV
	for side: float in [-1.0, 1.0]:
		var fragment := spawn_meteor(Meteor.Kind.FRAGMENT, child_radius, meteor.position + Vector2(side * meteor.radius * FRAGMENT_OFFSET_MUL, 0.0))
		fragment.set_split_direction(side)


func _on_game_over(stats: Dictionary) -> void:
	result_panel.visible = true
	final_score_label.text = "本局得分：%d" % int(stats["score"])
	final_crystals_label.text = "能量水晶：%d" % int(stats["crystals"])
	final_time_label.text = "存活时长：%d 秒" % int(stats["run_time"])
	final_best_label.text = "历史最高分：%d" % int(stats["best_score"])
	Juice.sfx(&"fail")
	_refresh_hud()


func _restart() -> void:
	for child in entities.get_children():
		child.queue_free()
	result_panel.visible = false
	GameState.reset()
	_meteor_timer = GameState.meteor_spawn_interval()
	_crystal_timer = GameState.CRYSTAL_INTERVAL_SEC
	_crystal_dry_time = 0.0
	Juice.pop(result_panel)
	Juice.sfx(&"confirm")


## ── HUD ──

func _on_player_moved(pos: Vector2) -> void:
	_refresh_hud(pos)


func _on_score_changed(_score: int) -> void:
	_refresh_hud()


func _on_shield_changed(_shield: int) -> void:
	_refresh_hud()


func _on_combo_changed(_combo: int) -> void:
	_refresh_hud()


func _on_boost_changed(_active: bool, _time_left: float) -> void:
	_refresh_hud()


func _refresh_hud(pos: Vector2 = Vector2.ZERO) -> void:
	var at := pos
	if at == Vector2.ZERO:
		at = player.global_position
	hud_label.text = "%s\n坐标 %d,%d · 分数 %d · 水晶 %d · 连击 %d/%d · 速度 %d" % [
		_move_hint, int(at.x), int(at.y), GameState.score, GameState.crystals,
		GameState.combo, GameState.COMBO_TRIGGER, int(GameState.speed),
	]
	shield_label.text = "护盾 " + "◆".repeat(maxi(GameState.shield, 0)) + "◇".repeat(maxi(GameState.SHIELD_MAX - GameState.shield, 0))
	if GameState.boost_active:
		boost_label.text = "加速 ×%d · %.1fs" % [GameState.multiplier, GameState.boost_time_left]
	else:
		boost_label.text = ""


func _flash_screen() -> void:
	flash_rect.color.a = 0.1
	var tween := create_tween()
	tween.tween_property(flash_rect, "color:a", 0.0, 0.1)
