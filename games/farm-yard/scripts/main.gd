extends Node2D
## 主场景控制器：装配庭院视图 / HUD / 音频，把「庭院点击」翻译成经营动作，
## 并把 GameState 的结果信号挂上 Juice 反馈（反馈挂在结果处理函数 —— SKILL.md §3B）。
##
## 输入语义（目标验收口径）：
## - 桌面点击 与 手机触摸 走同一条鼠标事件路径（emulate_mouse_from_touch），
##   由 yard_view 命中后发 tapped —— 点作物收该作物、点空地弹种植菜单、点菜单项种该项；
## - 键盘 confirm（空格/回车）= 一键收获全部成熟物；M = 静音开关。

@onready var yard: Node2D = $Yard
@onready var ui: CanvasLayer = $UI
@onready var bgm_player: AudioStreamPlayer = $Bgm

const COOP_SFX: Array[StringName] = [&"cluck", &"quack", &"honk"]

var _welcome_granted: bool = false        # 首奖励每局/每次进院只发一次
var _welcome_elapsed: float = 0.0         # 进院累计秒（游戏时间，与 tick 同源）
var _last_feedback_msec: int = 0          # 最近一条反馈事件的墙钟时刻（心跳兜底基准）
var _ambient_index: int = 0               # 环境鸣叫轮换（鸡/鸭/鹅）


func _ready() -> void:
	# 信号连接：订阅方（本场景）写连接代码，发布方（yard_view / GameState）只 emit。
	yard.tapped.connect(_on_yard_tapped)
	yard.swiped.connect(_on_yard_swiped)
	GameState.toast.connect(_on_game_toast)
	GameState.quest_completed.connect(_on_quest_completed)
	GameState.leveled_up.connect(_on_leveled_up)
	GameState.produce_ready.connect(_on_produce_ready)
	GameState.helper_swept.connect(_on_helper_swept)
	Juice.feedback_fired.connect(_on_feedback_fired)
	_last_feedback_msec = Time.get_ticks_msec()
	_start_bgm()
	_apply_mute()
	# 调参工作台（SKILL.md §3C）：网页 + URL 带 ?tuning 参数才创建，其余环境零成本。
	if TuningPanel.is_enabled():
		add_child(TuningPanel.new())


func _process(delta: float) -> void:
	GameState.tick(delta)
	_welcome_tick(delta)
	_ambient_heartbeat_tick()


## 任何玩家输入（点按/触摸/按键）都给 GameState 打点 —— v2 B1 帮工的「离手」判定基准。
## _input 在 GUI 消费之前触发，弹层里的按钮操作同样会计入。
func _input(event: InputEvent) -> void:
	if event is InputEventMouseButton or event is InputEventScreenTouch \
			or event is InputEventScreenDrag or event is InputEventKey:
		GameState.note_player_input()


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("confirm"):
		_harvest_all_ready()
	elif event.is_action_pressed("toggle_mute"):
		GameState.toggle_mute()
		_apply_mute()


## ── 庭院点击 → 经营动作（与触摸同一路径）──
func _on_yard_tapped(kind: String, index: int) -> void:
	Juice.sfx(&"click", -6.0)
	match kind:
		"plot":
			_tap_slot(index, false)
		"bed":
			_tap_slot(index, true)
		"tree":
			_tap_tree(index)
		"coop":
			_tap_coop(index)
		"workshop":
			_tap_workshop()
		"fountain":
			if GameState.upgrade_leisure("fountain"):
				Juice.sfx(&"upgrade")
		"swing":
			if GameState.upgrade_leisure("swing"):
				Juice.sfx(&"upgrade")


func _tap_slot(index: int, is_bed: bool) -> void:
	var slots: Array[Dictionary] = GameState.beds if is_bed else GameState.plots
	if index < 0 or index >= slots.size():
		return
	var slot := slots[index]
	match String(slot["state"]):
		"locked":
			if GameState.unlock_bed(index) if is_bed else GameState.unlock_plot(index):
				Juice.sfx(&"upgrade")
		"empty":
			ui.call("open_plant_menu", "bed" if is_bed else "plot", index)
		"growing":
			GameState.harvest(index, is_bed)   # 未成熟 → 状态机发「还没成熟呢」toast
		"mature":
			if GameState.harvest(index, is_bed):
				Juice.sfx(&"harvest")
				Juice.shake(2.0, 0.12)


func _tap_tree(index: int) -> void:
	var tree_id := String(FarmData.TREES.keys()[index])
	var tree: Dictionary = GameState.trees[tree_id]
	if not bool(tree["built"]):
		if GameState.build_tree(tree_id):
			Juice.sfx(&"upgrade")
	else:
		if GameState.harvest_tree(tree_id):
			Juice.sfx(&"harvest")


func _tap_coop(index: int) -> void:
	var coop_id := String(FarmData.COOPS.keys()[index])
	var coop: Dictionary = GameState.coops[coop_id]
	if int(coop["level"]) <= 0:
		if GameState.build_coop(coop_id):
			Juice.sfx(&"upgrade")
	else:
		if GameState.collect_coop(coop_id):
			Juice.sfx(COOP_SFX[index] if index < COOP_SFX.size() else &"cluck")
			Juice.pop(yard)


func _tap_workshop() -> void:
	if not GameState.workshop_built:
		if GameState.build_workshop():
			Juice.sfx(&"upgrade")
	else:
		ui.call("open_craft_panel")


## confirm 动作：一键收获全部成熟物（键盘与触摸语义等价的补充路径）
func _harvest_all_ready() -> void:
	var harvested := 0
	for i in GameState.plots.size():
		if GameState.plots[i]["state"] == "mature" and GameState.harvest(i, false):
			harvested += 1
	for i in GameState.beds.size():
		if GameState.beds[i]["state"] == "mature" and GameState.harvest(i, true):
			harvested += 1
	if harvested > 0:
		Juice.sfx(&"harvest")
		Juice.pop(yard)


## ── v2 B3 划动批量：划过的对象逐个套用当前动作（与点击同语义、同一结算函数）──
## 划到成熟物=收、划到空地=按上次种过的作物补种（没记过就不乱种）、划到待收果树/禽舍=收。
## 空地菜单、建造类动作不进批量手势，避免划动误建。
func _on_yard_swiped(kind: String, index: int) -> void:
	match kind:
		"plot":
			_swipe_slot(index, false)
		"bed":
			_swipe_slot(index, true)
		"tree":
			var tree_id := String(FarmData.TREES.keys()[index])
			var tree: Dictionary = GameState.trees[tree_id]
			if bool(tree["built"]) and bool(tree["ready"]) and GameState.harvest_tree(tree_id):
				Juice.sfx(&"harvest")
		"coop":
			var coop_id := String(FarmData.COOPS.keys()[index])
			var coop: Dictionary = GameState.coops[coop_id]
			if int(coop["level"]) > 0 and int(coop["stock"]) > 0 and GameState.collect_coop(coop_id):
				Juice.sfx(COOP_SFX[index] if index < COOP_SFX.size() else &"cluck")


func _swipe_slot(index: int, is_bed: bool) -> void:
	var slots: Array[Dictionary] = GameState.beds if is_bed else GameState.plots
	if index < 0 or index >= slots.size():
		return
	match String(slots[index]["state"]):
		"mature":
			if GameState.harvest(index, is_bed):
				Juice.sfx(&"harvest")
				Juice.shake(1.5, 0.1)
		"empty":
			var crop := GameState.last_flower_planted if is_bed else GameState.last_crop_planted
			if crop != "" and GameState.plant(index, crop, is_bed):
				Juice.sfx(&"plant")


## v2 B1 帮工代收完成：音效 + 轻弹反馈 + 取证日志。
func _on_helper_swept(harvested: int, collected: int) -> void:
	Juice.sfx(&"harvest", -6.0)
	Juice.pop(yard, 1.04, 0.14)
	print("[helper] 帮工代收 %d 份作物、%d 份产出" % [harvested, collected])


## ── 结果反馈（挂在结果事件的处理函数上）──

## 首奖励：进入院落后 welcome_reward_sec（3~5s，调参区钳制）秒必发，不依赖玩家触发特定交互。
## 发放时同步 音效 + 飘字（toast）+ 高亮动效（金币标签弹跳闪金）—— 治愈系正反馈锚点。
func _welcome_tick(delta: float) -> void:
	if _welcome_granted:
		return
	_welcome_elapsed += delta
	if _welcome_elapsed < GameState.welcome_reward_sec:
		return
	_welcome_granted = true
	GameState.grant_welcome_reward()   # 经济入账 + toast（score_changed 同步发出）
	Juice.sfx(&"coin")                 # 反馈：到账音效
	Juice.pop(yard, 1.04, 0.16)        # 反馈：庭院轻微弹跳
	ui.call("pulse_coins")             # 反馈：金币标签高亮动效
	print("[welcome] 首奖励已发放（进院 %.1fs，+%d 金币）" % [
		_welcome_elapsed, FarmData.WELCOME_REWARD_COINS])


## 生长 tick 反馈：作物/花卉成熟、果树挂果、禽舍产蛋 —— 轻提示音（低音量，不打扰）。
func _on_produce_ready(what: String) -> void:
	Juice.sfx(&"confirm", -16.0)
	print("[produce] %s 已就绪" % what)


## 反馈心跳兜底（ambient_heartbeat_sec，默认 8s < 10s 窗口）：放置/等待期没有交互也有生命感 ——
## 动物走动鸣叫（鸡/鸭/鹅轮换，低音量）作为环境反馈，保证任意 10s 窗口至少 1 条反馈事件。
func _ambient_heartbeat_tick() -> void:
	var now := Time.get_ticks_msec()
	if now - _last_feedback_msec < int(GameState.ambient_heartbeat_sec * 1000.0):
		return
	_last_feedback_msec = now
	Juice.sfx(COOP_SFX[_ambient_index % COOP_SFX.size()], -14.0)
	_ambient_index += 1


func _on_feedback_fired(_kind: StringName) -> void:
	_last_feedback_msec = Time.get_ticks_msec()


func _on_game_toast(_text: String, ok: bool) -> void:
	ui.call("show_toast", _text, ok)
	if not ok:
		Juice.sfx(&"fail")


func _on_quest_completed(quest: Dictionary) -> void:
	Juice.sfx(&"coin")
	Juice.pop(yard)
	print("[quest] 完成：%s（+%d 金币）" % [quest["name"], int(quest["reward_coins"])])


func _on_leveled_up(level: int) -> void:
	Juice.sfx(&"upgrade")
	Juice.shake(3.0, 0.2)
	print("[level-up] Lv.%d" % level)


## ── 音频：BGM 循环 + 主总线静音开关（存档持久化 muted）──
func _start_bgm() -> void:
	var path := "res://assets/audio/bgm_meadow.wav"
	if not ResourceLoader.exists(path):
		printerr("[bgm] 缺少 %s（运行 tools/gen_bgm.gd 生成）" % path)
		return
	var stream: AudioStream = load(path)
	if stream is AudioStreamWAV:
		var wav := stream as AudioStreamWAV
		wav.loop_mode = AudioStreamWAV.LOOP_FORWARD
		wav.loop_begin = 0
		wav.loop_end = wav.data.size() / 2   # 16-bit mono：每帧 2 字节
	bgm_player.stream = stream
	bgm_player.volume_db = -9.0
	bgm_player.autoplay = true
	bgm_player.play()


func _apply_mute() -> void:
	AudioServer.set_bus_mute(AudioServer.get_bus_index("Master"), GameState.muted)
	ui.call("_on_mute_changed")
