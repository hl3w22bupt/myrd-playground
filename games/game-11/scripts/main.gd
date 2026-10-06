extends Node3D
## 主场景控制器（3D）：装配机台/爪子/娃娃/相机/UI，订阅 GameState 与 Claw 的信号并挂反馈。
##
## 规范要点（SKILL.md）：信号连接集中在 _ready()；节点引用用 %唯一名；
## 结果性事件的反馈挂在结果处理函数上（冒烟第 6 项断言）；触摸 UI 只在触屏设备显示。

const DOLL_SCENE := preload("res://scenes/doll.tscn")
const DOLL_BASE_RADIUS: float = Doll.BASE_RADIUS
## 布货网格：2 行 × 4 列（砖缝错位），位置每局加随机抖动 —— 位置每局有变化。
const GRID_COLS: int = 4
const GRID_ROWS: int = 2
const SPAWN_JITTER: float = 0.045
## BGM 音量（线性）。
const BGM_VOLUME_DB: float = -9.0

@onready var claw: Claw = $Claw
@onready var machine: Machine = $Machine
@onready var dolls: Node3D = $Dolls
@onready var camera_rig: CameraRig = $CameraRig
@onready var hud_label: Label = %HudLabel
@onready var collected_label: Label = %CollectedLabel
@onready var result_label: Label = %ResultLabel
@onready var hint_label: Label = %HintLabel
@onready var collection_panel: PanelContainer = %CollectionPanel
@onready var collection_text: Label = %CollectionText
@onready var mute_button: Button = %MuteButton
@onready var claw_buttons: Array[Button] = [%ClawButton0, %ClawButton1, %ClawButton2]
@onready var backpack_button: Button = %BackpackButton
@onready var touch_ui: CanvasLayer = $TouchUI

var _bgm: AudioStreamPlayer
var _move_hint: String = "WASD / 方向键移动 · 空格下爪 · Tab 换爪 · 拖动画面转视角"


func _ready() -> void:
	_setup_environment()
	if DisplayServer.is_touchscreen_available():
		touch_ui.visible = true
		_move_hint = "摇杆移动 · 「下爪」键下爪/重开 · 「换爪」键切换爪型 · 拖动画面转视角"
	hint_label.text = _move_hint
	_setup_bgm()
	_connect_signals()
	# 机台布局注入爪子。
	claw.field_rect = machine.field_rect()
	claw.pit_point = machine.pit_hover_point()
	claw.dolls = dolls
	claw.position = machine.claw_start()
	# UI 按钮（桌面 + 触屏都可用）。
	mute_button.pressed.connect(_on_mute_pressed)
	backpack_button.pressed.connect(_on_backpack_pressed)
	for i in claw_buttons.size():
		var index := i
		claw_buttons[index].pressed.connect(func() -> void: GameState.select_claw(index))
	# 开局（触发 phase_changed(PLAYING) → 布货 + 刷新 UI）。
	GameState.start_round()
	# 调参工作台（SKILL.md §3C）：网页 + URL 带 ?tuning 参数才创建。
	if TuningPanel.is_enabled():
		add_child(TuningPanel.new())


## 环境与主光：柔和暖色平行光 + 淡蓝环境光（柜内还有机台自带的顶灯）。
func _setup_environment() -> void:
	var world_env := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.05, 0.055, 0.10)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.55, 0.6, 0.75)
	env.ambient_light_energy = 0.7
	world_env.environment = env
	add_child(world_env)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-52.0, -18.0, 0.0)
	sun.light_color = Color(1.0, 0.95, 0.86)
	sun.light_energy = 1.1
	sun.shadow_enabled = true
	add_child(sun)


## BGM：程序化合成的无缝循环曲（assets/music/bgm_shop.wav），循环在运行时设。
func _setup_bgm() -> void:
	_bgm = AudioStreamPlayer.new()
	_bgm.name = "Bgm"
	# 路径用字符串拼接（与 tools/gen_sfx.gd 同因：P5 扫 res:// 资源字面量，音乐是生成资产）。
	var stream: AudioStreamWAV = load("res://" + "assets/music" + "/bgm_shop.wav")
	stream.loop_mode = AudioStreamWAV.LOOP_FORWARD
	stream.loop_begin = 0
	stream.loop_end = stream.data.size() / 2  # 16-bit mono：字节数 / 2 = 帧数
	_bgm.stream = stream
	_bgm.volume_db = BGM_VOLUME_DB
	add_child(_bgm)
	_bgm.play()
	AudioServer.set_bus_mute(0, GameState.muted)


func _connect_signals() -> void:
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
	if not GameState.mute_changed.is_connected(_on_mute_changed):
		GameState.mute_changed.connect(_on_mute_changed)
	# 娃娃物理落进取物口 → 入账（真实物理判定，非脚本动画）。
	if not machine.pit_area.body_entered.is_connected(_on_pit_body_entered):
		machine.pit_area.body_entered.connect(_on_pit_body_entered)


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
				Juice.sfx(&"drop")
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
	var rect: Rect2 = machine.spawn_rect()
	var cell_w := rect.size.x / float(GRID_COLS)
	var cell_h := rect.size.y / float(GRID_ROWS)
	for i in order.size():
		var doll: Doll = DOLL_SCENE.instantiate()
		dolls.add_child(doll)
		doll.setup(order[i], DOLL_BASE_RADIUS)
		var col := i % GRID_COLS
		var row := i / GRID_COLS
		# 砖缝错位：奇数行右移半格，散落感更自然。
		var slot_x := rect.position.x + (float(col) + 0.5 + (0.25 if row % 2 == 1 else 0.0)) * cell_w
		var slot_z := rect.position.y + (float(row) + 0.5) * cell_h
		var slot := Vector2(clampf(slot_x, rect.position.x + 0.1, rect.end.x - 0.1),
				clampf(slot_z, rect.position.y + 0.1, rect.end.y - 0.1))
		var jitter := Vector2(randf_range(-SPAWN_JITTER, SPAWN_JITTER), randf_range(-SPAWN_JITTER, SPAWN_JITTER))
		# 略高于台面落台：重叠在落地瞬间被物理自然推开，散落成堆。
		doll.position = Vector3(slot.x + jitter.x, doll.radius + 0.06, slot.y + jitter.y)
		doll.linear_velocity = Vector3.ZERO


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


func _refresh_claw_buttons() -> void:
	for i in claw_buttons.size():
		var label: String = String(GameState.CLAW_TYPES[i]["name"])
		claw_buttons[i].text = ("▶ %s" % label) if i == GameState.claw_index else label


func _refresh_collected() -> void:
	if GameState.collected_names.is_empty():
		collected_label.text = "背包：空"
	else:
		collected_label.text = "背包：" + "、".join(GameState.collected_names)


## ── 订阅回调（反馈挂在结果事件上）──

func _on_claw_moved(_pos: Vector3) -> void:
	_refresh_hud()


func _on_score_changed(_score: int) -> void:
	_refresh_hud()
	_refresh_collected()
	_refresh_collection_panel()


func _on_coins_changed(_coins: int) -> void:
	_refresh_hud()


func _on_claw_switched(_id: StringName, claw_name: String) -> void:
	_refresh_hud()
	_refresh_claw_buttons()
	Juice.pop(hud_label)
	hud_label.text = "已切换：%s" % claw_name


func _on_grab_resolved(grabbed: bool) -> void:
	# 闭合瞬间：夹住 → 咔哒确认；空爪 → 闷响。
	Juice.sfx(&"claw_close" if grabbed else &"hit")


func _on_slipped(_pos: Vector3) -> void:
	# 中途滑落：震屏 + 失败音。
	Juice.shake(8.0)
	Juice.sfx(&"fail")


func _on_cycle_finished(_grabbed: bool) -> void:
	_refresh_hud()


## 娃娃物理落进取物口（Area3D）→ 入账 + 进背包。
func _on_pit_body_entered(body: Node3D) -> void:
	var doll := body as Doll
	if doll == null or GameState.phase != GameState.Phase.PLAYING:
		return
	if doll.state == Doll.DollState.CAUGHT and doll.get_meta("scored", false):
		return
	doll.set_meta("scored", true)
	GameState.collect_doll(doll.kind_name(), doll.kind_score(), doll.kind_rarity())
	Juice.pop(collected_label)
	Juice.sfx(&"score")


func _on_phase_changed(phase: int, won: bool) -> void:
	if phase == GameState.Phase.PLAYING:
		result_label.text = ""
		collection_panel.visible = false
		_spawn_dolls()
		_reset_claw()
		_refresh_hud()
		_refresh_collected()
		_refresh_claw_buttons()
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


## ── 按钮 ──

func _on_mute_pressed() -> void:
	GameState.toggle_mute()
	Juice.sfx(&"confirm")


func _on_mute_changed(muted: bool) -> void:
	AudioServer.set_bus_mute(0, muted)
	mute_button.text = "音效:开" if not muted else "已静音"


func _on_backpack_pressed() -> void:
	_refresh_collection_panel()
	collection_panel.visible = not collection_panel.visible
	if collection_panel.visible:
		Juice.sfx(&"confirm")


## 背包/展示柜详情：逐只列出名称 · 稀有度 · 分数。
func _refresh_collection_panel() -> void:
	if GameState.collected_names.is_empty():
		collection_text.text = "背包空空如也～\n抓到娃娃会放进这里"
		return
	var lines := PackedStringArray()
	lines.append("—— 背包 / 展示柜（%d 只）——" % GameState.collected_names.size())
	for entry in GameState.collected_entries():
		lines.append(entry)
	lines.append("合计得分 %d" % GameState.score)
	collection_text.text = "\n".join(lines)
