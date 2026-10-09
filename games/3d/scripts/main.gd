extends Node3D
## 主场景控制器（对局导演）：抛出调度、计时、HUD、连击提示、结算与重开。
##
## 规范要点（见 SKILL.md「场景规范」「移动端触摸规范」「反馈完备性（Juice）」「调参工作台」）：
## - 场景内信号连接统一写在 _ready()，集中可见、可被 preflight 静态核对；
## - 节点引用用 @onready + 类型标注，路径用 %唯一名 代替长路径字符串；
## - 抛出节奏 / 炸弹占比 / 分值全部读 GameState 调参区（spec.numeric 对接面）；
## - 结果性事件的反馈挂在结果处理函数上（_on_score_changed / _on_round_ended），不挂输入；
## - 触摸 UI（摇杆/确认按钮）只在有触摸屏时显示，桌面键盘环境完全不可见。

const FRUIT_SCENE: PackedScene = preload("res://scenes/fruit.tscn")

## 抛出点与抛物线参数（世界坐标；视野范围与 blade.gd 的 PLAY_* 对齐）。
const SPAWN_Y: float = -5.9
const SPAWN_HALF_WIDTH: float = 2.3
## 未瞄准抛出的横向速度上限（世界单位/秒）：飞行 ≤2.7s 内漂移 ≤3.2，多数仍留在可达带。
const THROW_VX_MAX: float = 1.2
## 朝屏幕中带瞄准的抛出占比：瞄准抛出的抛物线顶点全程走在刀锋可达（±2.9）与
## 可见（±3.1）的核心带内 —— 跑出可达带的苹果对谁都不可切，只会变成挫败漏接。
const THROWS_TOWARD_CENTER: float = 0.8
## 瞄准抛出的顶点横坐标范围：顶点落在 ±0.8 内，整条抛物线 x ∈ [出生点, 顶点] 都可达。
const APEX_BAND: float = 0.8
## 瞄准抛出横向初速的钳制上限（顶点贴中带所需的最大 |vx| ≈ 2.3×12/13.5 ≈ 2.05，留余量）。
const THROW_VX_AIM_MAX: float = 2.6
## 节奏分段线（需求：0-20s / 20-40s / 40-60s 三档递增）。
const PHASE_MID_AT: float = 20.0
const PHASE_LATE_AT: float = 40.0
## 首个抛出物的延迟（秒）——开局立刻有东西可切。
const FIRST_SPAWN_DELAY: float = 0.25
## 每局开头的「安全投」数：必为苹果，不允许炸弹开局（重开后的正反馈不被运气打断）。
const SAFE_THROWS_PER_ROUND: int = 2
## 首投的水平偏移上限：首投必走屏幕中线（刀锋出生点正上方），开局正反馈必可达。
const FIRST_THROW_HALF_WIDTH: float = 0.6

@onready var blade: Blade = $Blade
@onready var fruits: Node3D = $Fruits
@onready var hud_score: Label = %HudScore
@onready var hud_time: Label = %HudTime
@onready var hint_label: Label = %HintLabel
@onready var combo_label: Label = %ComboLabel
@onready var end_panel: Control = %EndPanel
@onready var end_title: Label = %EndTitle
@onready var end_stats: Label = %EndStatsLabel
@onready var restart_button: Button = %RestartButton
@onready var touch_ui: CanvasLayer = $TouchUI

var _elapsed: float = 0.0
var _spawn_cooldown: float = FIRST_SPAWN_DELAY
var _round_throws: int = 0
var _spawning_enabled: bool = true
var _combo_tween: Tween
var _throw_rng := RandomNumberGenerator.new()


func _ready() -> void:
	if DisplayServer.is_touchscreen_available():
		touch_ui.visible = true
		hint_label.text = "滑动切开水果 · 连切有加成 · 切中炸弹即终局"
	else:
		hint_label.text = "按住拖动滑切（或方向键移刀 · 空格挥砍）· 切中炸弹即终局"
	# 信号连接：订阅方（本场景）写连接代码，发布方（GameState）只 emit。
	if not GameState.score_changed.is_connected(_on_score_changed):
		GameState.score_changed.connect(_on_score_changed)
	if not GameState.swing_combo.is_connected(_on_swing_combo):
		GameState.swing_combo.connect(_on_swing_combo)
	if not GameState.round_ended.is_connected(_on_round_ended):
		GameState.round_ended.connect(_on_round_ended)
	if not GameState.record_broken.is_connected(_on_record_broken):
		GameState.record_broken.connect(_on_record_broken)
	restart_button.pressed.connect(_on_restart_pressed)
	combo_label.visible = false
	end_panel.visible = false
	_throw_rng.randomize()
	_ensure_tuning_panel()
	_begin_round()


## ── 对局生命周期 ──

func _begin_round() -> void:
	GameState.begin_round()
	_elapsed = 0.0
	_spawn_cooldown = FIRST_SPAWN_DELAY
	_round_throws = 0
	end_panel.visible = false
	combo_label.visible = false
	blade.reset_to(Vector3(0, -1, 0))
	hud_score.text = "分数 0"
	_update_time_hud()


func _process(delta: float) -> void:
	GameState.tick_swing_window()
	if not GameState.round_active:
		return
	_elapsed += delta
	_update_time_hud()
	if _spawning_enabled:
		_spawn_cooldown -= delta
		if _spawn_cooldown <= 0.0:
			_spawn_fruit_random()
			_spawn_cooldown = _spawn_interval()
	if _elapsed >= GameState.round_seconds:
		GameState.register_time_up()


## 0-20s / 20-40s / 40-60s 三档递增的抛出间隔（数值在 GameState 调参区）。
func _spawn_interval() -> float:
	if _elapsed >= PHASE_LATE_AT:
		return GameState.spawn_interval_late
	if _elapsed >= PHASE_MID_AT:
		return GameState.spawn_interval_mid
	return GameState.spawn_interval_early


## 随机抛出一个水果 / 炸弹（bomb_ratio 决定炸弹占比；每局前 SAFE_THROWS 必为水果）。
## 水果种类从 FruitCatalog（6 种）均匀随机 —— 单局 60s 约 60 投，≥5 种必出现。
## 返回抛出物（冒烟投放探针采集 is_bomb / variety 用）。
func _spawn_fruit_random() -> Fruit:
	var is_bomb := _round_throws >= SAFE_THROWS_PER_ROUND \
		and _throw_rng.randf() < GameState.bomb_ratio
	var kind := FruitCatalog.random_kind(_throw_rng)
	var first_throw := _round_throws == 0
	_round_throws += 1
	var half_width := FIRST_THROW_HALF_WIDTH if first_throw else SPAWN_HALF_WIDTH
	var x := _throw_rng.randf_range(-half_width, half_width)
	var speed := _throw_rng.randf_range(GameState.throw_speed_min, GameState.throw_speed_max)
	var vx := _throw_rng.randf_range(-THROW_VX_MAX, THROW_VX_MAX)
	if _throw_rng.randf() < THROWS_TOWARD_CENTER:
		vx = _aimed_vx(x, speed)
	if first_throw:
		# 开局正中直线水果：垂直上抛、必两次穿过刀锋出生高度 —— 开局正反馈必可达。
		x = 0.0
		vx = 0.0
		speed = GameState.throw_speed_min
	return spawn_fruit(Vector3(x, SPAWN_Y, _throw_rng.randf_range(-0.15, 0.15)),
		Vector3(vx, speed, 0.0), is_bomb, kind)


## 朝屏幕中带瞄准的横向初速：取顶点横坐标 ∈ ±APEX_BAND，反解 vx = (顶点x - 出生x)/t_顶点，
## 其中 t_顶点 = v0/g（竖直方向速度归零点）。整条抛物线因此全程走在刀锋可达带内。
func _aimed_vx(x: float, speed: float) -> float:
	var apex_time: float = speed / GameState.gravity
	var target_x := _throw_rng.randf_range(-APEX_BAND, APEX_BAND)
	return clampf((target_x - x) / maxf(apex_time, 0.05), -THROW_VX_AIM_MAX, THROW_VX_AIM_MAX)


## 抛出一个指定参数的抛出物（随机抛出与冒烟确定性摆放共用这一个入口）。
## variety 传 &""（默认）时非炸弹抛出物随机选种类、炸弹忽略种类。
func spawn_fruit(at: Vector3, velocity: Vector3, bomb: bool,
		variety: StringName = &"") -> Fruit:
	var fruit: Fruit = FRUIT_SCENE.instantiate()
	fruit.is_bomb = bomb
	if not variety.is_empty():
		fruit.variety = variety
	fruit.setup(at, velocity)
	fruits.add_child(fruit)
	return fruit


## 冒烟/调参确定性辅助：关掉随机抛出（断言期间场上不再出现计划外抛出物）。
func set_spawning(enabled: bool) -> void:
	_spawning_enabled = enabled


## 冒烟确定性辅助：清空场上所有抛出物。
func clear_fruits() -> void:
	for fruit in get_tree().get_nodes_in_group(&"fruits"):
		fruit.queue_free()


## 冒烟确定性辅助：把投放生成器钉到固定种子并越过「安全投」期（炸弹可出现）。
## 同种子 ⇒ 同一串 (is_bomb, variety) 抛出序列，让「多水果生成 + 炸弹混入」可机判、可复现。
func seed_throws(seed_value: int) -> void:
	_throw_rng.seed = seed_value
	_round_throws = SAFE_THROWS_PER_ROUND


## ── 结算与重开 ──

func _on_round_ended(reason: StringName, stats: Dictionary) -> void:
	if reason == &"bomb":
		end_title.text = "切中炸弹！对局结束"
	else:
		end_title.text = "时间到！对局结束"
	var kinds_line := _format_kinds(stats.get("kinds", {}))
	end_stats.text = "总分 %d\n切中水果 %d 个 · 最高单刀连击 x%d\n%s\n漏接 %d 个 · 历史最高 %d%s\n\n按任意键 / 点击按钮 再来一局" % [
		stats.get("score", 0), stats.get("fruits", 0), stats.get("max_combo", 0),
		kinds_line, stats.get("missed", 0), stats.get("best", 0),
		"\n★ 新纪录！" if stats.get("record_broken", false) else "",
	]
	end_panel.visible = true
	combo_label.visible = false
	# 结果性事件（终局）的反馈：弹跳 + 音效（爆炸本体反馈在 fruit._explode）。
	Juice.pop(end_panel)
	Juice.sfx(&"confirm")


## 分种类统计 → 「西瓜×2 橙子×1 …」一行（结算面板展示多水果构成；空字典给占位）。
func _format_kinds(kinds: Dictionary) -> String:
	if kinds.is_empty():
		return "本局未切中水果"
	var parts: PackedStringArray = []
	for kind: StringName in kinds:
		parts.append("%s×%d" % [FruitCatalog.def(kind)["label"], kinds[kind]])
	return " · ".join(parts)


func _on_restart_pressed() -> void:
	if GameState.round_active:
		return
	clear_fruits()
	_begin_round()
	Juice.sfx(&"confirm")


func _unhandled_input(event: InputEvent) -> void:
	# 对局中：confirm 挥砍由 blade.gd 处理，本场景不接管。
	# 结算画面：按任意键 / 触摸即重开（街机惯例）——切中炸弹提前终局后不用干等按钮。
	if GameState.round_active:
		return
	if _is_press(event):
		_on_restart_pressed()


## 「按任意键」的按压判定：动作/鼠标/触摸/按键的按下沿（忽略长按 echo）。
func _is_press(event: InputEvent) -> bool:
	if event is InputEventAction:
		return (event as InputEventAction).pressed
	if event is InputEventMouseButton:
		return (event as InputEventMouseButton).pressed
	if event is InputEventScreenTouch:
		return (event as InputEventScreenTouch).pressed
	if event is InputEventKey:
		var key := event as InputEventKey
		return key.pressed and not key.echo
	return false


## ── HUD 与反馈 ──

func _on_score_changed(score: int) -> void:
	hud_score.text = "分数 %d" % score
	# 结果性事件（得分）的反馈：弹跳 + 音效。
	Juice.pop(hud_score)
	Juice.sfx(&"score")


func _on_swing_combo(count: int, bonus: int) -> void:
	if count >= 3:
		combo_label.text = "Combo x%d！+%d" % [count, bonus]
	elif count == 2:
		combo_label.text = "连击 x2 +%d" % bonus
	else:
		return
	combo_label.visible = true
	combo_label.scale = Vector2.ONE
	Juice.pop(combo_label)
	if _combo_tween != null and _combo_tween.is_valid():
		_combo_tween.kill()
	_combo_tween = create_tween()
	_combo_tween.tween_interval(0.9)
	_combo_tween.tween_callback(func() -> void: combo_label.visible = false)


func _on_record_broken(best: int) -> void:
	hud_score.text = "分数 %d · 新纪录！" % best


func _update_time_hud() -> void:
	var left: float = maxf(GameState.round_seconds - _elapsed, 0.0)
	hud_time.text = "剩余 %d 秒" % int(ceilf(left))


## 调参工作台（SKILL.md §3C）：网页 + URL 带 ?tuning 参数才创建，其余环境零成本。
func _ensure_tuning_panel() -> void:
	if TuningPanel.is_enabled():
		add_child(TuningPanel.new())
