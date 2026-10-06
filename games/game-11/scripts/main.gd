extends Node2D
## 主场景控制器：装配机台/爪子/娃娃/UI，订阅 GameState 与 Claw 的信号并挂反馈。
##
## 规范要点（SKILL.md）：信号连接集中在 _ready()；节点引用用 %唯一名；
## 结果性事件的反馈挂在结果处理函数上（冒烟第 6 项断言）；触摸 UI 只在触屏设备显示。

const DOLL_SCENE := preload("res://scenes/doll.tscn")
const DOLL_BASE_RADIUS: float = 40.0
## 布货槽位（2 行 x 4 列），每局加随机抖动 —— 位置每局有变化。
const SPAWN_SLOTS: Array[Vector2] = [
	Vector2(360.0, 436.0), Vector2(250.0, 392.0), Vector2(470.0, 392.0), Vector2(200.0, 560.0),
	Vector2(310.0, 600.0), Vector2(420.0, 560.0), Vector2(530.0, 600.0), Vector2(330.0, 500.0),
]
const SPAWN_JITTER: float = 24.0

@onready var claw: Claw = $Claw
@onready var machine: Machine = $Machine
@onready var dolls: Node2D = $Dolls
@onready var hud_label: Label = %HudLabel
@onready var collected_label: Label = %CollectedLabel
@onready var result_label: Label = %ResultLabel
@onready var hint_label: Label = %HintLabel
@onready var touch_ui: CanvasLayer = $TouchUI

var _move_hint: String = "WASD / 方向键移动 · 空格下爪 · Tab 换爪"


func _ready() -> void:
	if DisplayServer.is_touchscreen_available():
		touch_ui.visible = true
		_move_hint = "摇杆移动 · 「下爪」键下爪 / 重开 · 「换爪」键切换爪型"
	hint_label.text = _move_hint
	# 信号连接：订阅方（本场景）集中连接，发布方只 emit。
	if not claw.moved.is_connected(_on_claw_moved):
		claw.moved.connect(_on_claw_moved)
	if not claw.cycle_finished.is_connected(_on_cycle_finished):
		claw.cycle_finished.connect(_on_cycle_finished)
	if not claw.grab_resolved.is_connected(_on_grab_resolved):
		claw.grab_resolved.connect(_on_grab_resolved)
	if not claw.slipped.is_connected(_on_slipped):
		claw.slipped.connect(_on_slipped)
	if not GameState.score_changed.is_connected(_on_score_changed):
		GameState.score_changed.connect(_on_score_changed)
	if not GameState.coins_changed.is_connected(_on_coins_changed):
		GameState.coins_changed.connect(_on_coins_changed)
	if not GameState.phase_changed.is_connected(_on_phase_changed):
		GameState.phase_changed.connect(_on_phase_changed)
	if not GameState.claw_switched.is_connected(_on_claw_switched):
		GameState.claw_switched.connect(_on_claw_switched)
	# 机台布局注入爪子。
	claw.field_rect = machine.field_rect()
	claw.pit_point = machine.pit_hover_point()
	claw.dolls = dolls
	claw.position = machine.claw_start()
	# 开局（触发 phase_changed(PLAYING) → 布货 + 刷新 UI）。
	GameState.start_round()
	# 调参工作台（SKILL.md §3C）：网页 + URL 带 ?tuning 参数才创建。
	if TuningPanel.is_enabled():
		add_child(TuningPanel.new())


func _process(_delta: float) -> void:
	_refresh_hud()


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("switch_claw"):
		GameState.switch_claw()
		Juice.sfx(&"confirm")
	elif event.is_action_pressed("confirm"):
		if GameState.phase == GameState.Phase.RESULT:
			GameState.start_round()
			Juice.sfx(&"confirm")
		elif GameState.phase == GameState.Phase.PLAYING:
			if claw.try_drop():
				Juice.sfx(&"hit")
			else:
				Juice.sfx(&"fail")
				Juice.flash(hud_label, Color(1.0, 0.4, 0.4, 0.6))


## ── 布货与复位 ──

func _spawn_dolls() -> void:
	for child in dolls.get_children():
		child.queue_free()
	var order: Array[int] = []
	for i in Doll.KINDS.size():
		order.append(i)
	order.shuffle()
	for i in order.size():
		var doll: Doll = DOLL_SCENE.instantiate()
		dolls.add_child(doll)
		doll.setup(order[i], DOLL_BASE_RADIUS)
		var slot := SPAWN_SLOTS[i % SPAWN_SLOTS.size()]
		doll.position = slot + Vector2(randf_range(-SPAWN_JITTER, SPAWN_JITTER), randf_range(-SPAWN_JITTER, SPAWN_JITTER))
		doll.caught.connect(_on_doll_caught)
		doll.landed.connect(_on_doll_landed)


func _reset_claw() -> void:
	claw.position = machine.claw_start()
	claw.reset_state()


## ── UI 刷新 ──

func _refresh_hud() -> void:
	var claw_name: String = String(GameState.current_claw()["name"])
	hud_label.text = "币 %d · 时间 %ds · 目标 %d/%d · %s · 得分 %d" % [
		GameState.coins, int(ceil(GameState.time_left)),
		GameState.dolls_collected, int(GameState.target_dolls), claw_name, GameState.score,
	]


func _refresh_collected() -> void:
	if GameState.collected_names.is_empty():
		collected_label.text = "背包：空"
	else:
		collected_label.text = "背包：" + "、".join(GameState.collected_names)


## ── 订阅回调（反馈挂在结果事件上）──

func _on_claw_moved(_pos: Vector2) -> void:
	_refresh_hud()


func _on_score_changed(_score: int) -> void:
	_refresh_hud()
	_refresh_collected()


func _on_coins_changed(_coins: int) -> void:
	_refresh_hud()


func _on_claw_switched(_id: StringName, claw_name: String) -> void:
	_refresh_hud()
	Juice.pop(hud_label)
	hud_label.text = "已切换：%s" % claw_name


func _on_grab_resolved(grabbed: bool) -> void:
	# 闭合瞬间：夹住 → 咔哒确认；空爪 → 闷响。
	Juice.sfx(&"claw_close" if grabbed else &"hit")


func _on_slipped(_pos: Vector2) -> void:
	# 中途滑落：震屏 + 失败音。
	Juice.shake(8.0)
	Juice.sfx(&"fail")
	Juice.flash(claw, Color(1.0, 0.5, 0.4, 0.5))


func _on_cycle_finished(_grabbed: bool) -> void:
	_refresh_hud()


func _on_doll_caught(doll: Doll) -> void:
	# 娃娃落入取物口：入账 + 进背包（GameState 广播 score_changed 再刷 UI）。
	GameState.collect_doll(doll.kind_name(), doll.kind_score())
	Juice.pop(collected_label)
	Juice.sfx(&"score")


func _on_doll_landed(_doll: Doll) -> void:
	Juice.sfx(&"hit")


func _on_phase_changed(phase: int, won: bool) -> void:
	if phase == GameState.Phase.PLAYING:
		result_label.text = ""
		_spawn_dolls()
		_reset_claw()
		_refresh_hud()
		_refresh_collected()
	elif phase == GameState.Phase.RESULT:
		var outcome: String
		if won:
			outcome = "达成目标！本局得分 %d" % GameState.score
		else:
			outcome = "本局结束，抓到 %d/%d 只 · 得分 %d" % [
				GameState.dolls_collected, int(GameState.target_dolls), GameState.score,
			]
		result_label.text = "%s\n%s\n按 空格 / 「下爪」键 再来一局" % [outcome, "背包：" + "、".join(GameState.collected_names)]
		Juice.pop(result_label)
		Juice.sfx(&"score" if won else &"fail")
		_refresh_hud()
