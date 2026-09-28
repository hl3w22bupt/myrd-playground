extends Node
## 无头冒烟自检（headless smoke）—— 机器可判定的「经营闭环能不能跑」。
##
## 运行方式（由 std-skills/godot-game-dev/scripts/smoke.sh 封装）：
##   godot --headless --path <工程目录> tests/smoke.tscn
##
## 判定协议：通过 → stdout `GODOT_SMOKE: PASS ...` 且退出码 0；
##          失败 → stderr `GODOT_SMOKE: FAIL <原因>`（每条一行）且退出码 1。
##
## 覆盖面（模板七项结构保留 + 目标验收标准逐条翻译为断言）：
##   1. 主场景可实例化（Yard / UI 接线未断裂，关键方法存在）
##   2. autoload 已注册且带约定信号（FarmData / GameState / Juice）
##   3. InputMap 动作已注册、键位契约逐键核对，且注入点击后对象真的动了（种植/收获）
##   4. 信号真的到达订阅方（coins_changed / xp_changed / quest_changed）
##   5. 每项失败给出可读原因
##   6. 结果性事件真的挂了反馈（Juice.events 非空）
##   7. 调参协议可判（TUNING_META 非空、钳制与未知键拒绝、检查后恢复原状）
##   A. 经营闭环数值：种植→生长→收获→出售 金币/经验按数值表精确结算
##   B. 边界与对抗：金币不足拒绝、重复收获只结算一次、库存永不为负、订单原料校验
##   C. 存档往返：save→mutate→load 完整恢复（含静音开关）
##   D. 建造升级生效：工坊提速、休闲售价加成、养殖舍升级、地块开垦
##   E. 五大区域各有 ≥1 可交互热区；点击语义：点空地弹菜单、点菜单项种该项
##   F. 任务链 7 阶段按事件推进；音频资产与音效注册齐备

## ── 噪声相位（输入鲁棒性）：确定种子对抗事件序先注入，断言仍全过 = 噪声没有楔死输入管线 ──
const NOISE_FRAMES: int = 30
const TOTAL_FRAMES: int = 64

const REQUIRED_ACTIONS: Array[StringName] = [&"confirm", &"toggle_mute"]
const KEY_CONTRACT: Dictionary = {
	&"confirm": [KEY_SPACE, KEY_ENTER],
	&"toggle_mute": [KEY_M],
}

var _failures: PackedStringArray = []
var _frames: int = 0
var _finished: bool = false
var _yard: Node2D
var _ui: CanvasLayer
var _coins_seen := false
var _xp_seen := false
var _quest_seen := false
var _phase := 0
var _loop_wheat_before := 0
var _tap_plot_index := -1
var _input_harvest_item := ""
var _noise_rng := RandomNumberGenerator.new()


func _ready() -> void:
	Engine.max_fps = 60
	_yard = get_tree().root.find_child("Yard", true, false) as Node2D
	_ui = get_tree().root.find_child("UI", true, false) as CanvasLayer
	GameState.coins_changed.connect(func(_c: int) -> void: _coins_seen = true)
	GameState.xp_changed.connect(func(_l: int, _x: int, _n: int) -> void: _xp_seen = true)
	GameState.quest_changed.connect(func(_q: Dictionary) -> void: _quest_seen = true)
	# 冒烟必须可复现：清掉本机存档 + 关掉周期 autosave，防止运行期落盘污染断言
	var save_path := ProjectSettings.globalize_path(FarmData.SAVE_PATH)
	if FileAccess.file_exists(FarmData.SAVE_PATH):
		DirAccess.remove_absolute(save_path)
	GameState.autosave_sec = 99999.0
	GameState.new_game()


func _physics_process(_delta: float) -> void:
	if _finished:
		return
	_frames += 1
	if not _failures.is_empty():
		_finish()
		return
	if _frames <= NOISE_FRAMES:
		_inject_noise_frame()
		return
	match _frames:
		NOISE_FRAMES + 1:
			_phase = 1
			_check_basics()
		NOISE_FRAMES + 2:
			_phase = 2
			_check_core_loop()      # 任务链冻结 → 纯经济数值精确断言
		NOISE_FRAMES + 3:
			_phase = 3
			_check_edges_and_save() # 任务链冻结 → 对抗输入与存档往返
		NOISE_FRAMES + 4:
			_phase = 4
			_check_quest_chain()    # 任务链从零重放 q1~q7
		NOISE_FRAMES + 5:
			_phase = 5
			_check_regions_and_audio()
			# 点击语义①：点空菜地 → 弹种植菜单。
			# 噪声相位的随机点击可能已误开弹层（遮罩会把下一次点击吞成「关闭」），
			# 注入前先关闭一切弹层，保证测试起点确定。
			_ui.call("close_modal")
			_tap_plot_index = _first_slot_index("empty", false)
			if _tap_plot_index < 0:
				_failures.append("点击语义：找不到空菜地可点击（初始应至少 3 块空地）")
			else:
				_inject_click(_yard.hotspot_center("plot", _tap_plot_index))
		NOISE_FRAMES + 7:
			_phase = 6
			_assert_plant_menu_open()
		NOISE_FRAMES + 8:
			_phase = 7
			# 点击语义②：点菜单里的「番茄」→ 种下的必须是番茄本身
			_press_plant_option("番茄")
		NOISE_FRAMES + 9:
			_phase = 8
			_assert_option_planted_right_crop()
			# 点击语义③：注入点击收成熟物 —— 种小麦并快进成熟后点击该地块
			var wheat_index := _first_slot_index("empty", false)
			if wheat_index >= 0 and GameState.plant(wheat_index, "wheat", false):
				GameState.tick(11.0)
				_input_harvest_item = "wheat"
				_input_harvest_before = int(GameState.inventory.get("wheat", 0))
				_tap_plot_index = wheat_index
				_inject_click(_yard.hotspot_center("plot", wheat_index))
			else:
				_failures.append("点击语义：无可种小麦的空地（点击收获路径无法验证）")
		NOISE_FRAMES + 11:
			_phase = 9
			_assert_click_harvested()
		NOISE_FRAMES + 12:
			_phase = 10
			# 键盘等价路径：confirm 动作一键收获 —— 先种一株并快进
			var index := _first_slot_index("empty", false)
			_confirm_index = index
			if index >= 0 and GameState.plant(index, "carrot", false):
				GameState.tick(19.0)
				var ev := InputEventAction.new()
				ev.action = &"confirm"
				ev.pressed = true
				Input.parse_input_event(ev)
			else:
				_failures.append("confirm 收获：无可种胡萝卜的空地")
		NOISE_FRAMES + 14:
			_phase = 11
			_assert_confirm_harvested(_confirm_index)
		NOISE_FRAMES + 16:
			_phase = 12
			_check_build_upgrade()  # 任务链已全部完成 → 升级收益断言不受任务奖励干扰
		NOISE_FRAMES + 17:
			_phase = 13
			_assert_feedback_and_signals()
	if _frames >= TOTAL_FRAMES or not _failures.is_empty() or _phase >= 13:
		_finish()


## 冒烟里 confirm 用例的胡萝卜地块索引（_phase 10 时记录）
var _confirm_index := -1


## ── 噪声相位：确定种子随机原始事件（不含 InputEventAction）──
func _inject_noise_frame() -> void:
	if _frames == 1:
		_noise_rng.seed = 20260928
	var roll := _noise_rng.randf()
	var pos := Vector2(_noise_rng.randf_range(0, 720), _noise_rng.randf_range(0, 1280))
	if roll < 0.30:
		var t := InputEventScreenTouch.new()
		t.index = _noise_rng.randi_range(0, 1)
		t.position = pos
		t.pressed = true
		Input.parse_input_event(t)
	elif roll < 0.45:
		var t2 := InputEventScreenTouch.new()
		t2.index = _noise_rng.randi_range(0, 1)
		t2.position = pos
		t2.pressed = false
		Input.parse_input_event(t2)
	elif roll < 0.60:
		var d := InputEventScreenDrag.new()
		d.index = _noise_rng.randi_range(0, 1)
		d.position = pos
		d.relative = Vector2(_noise_rng.randf_range(-40, 40), _noise_rng.randf_range(-40, 40))
		Input.parse_input_event(d)
	elif roll < 0.80:
		var mb := InputEventMouseButton.new()
		mb.button_index = MOUSE_BUTTON_LEFT
		mb.position = pos
		mb.pressed = _noise_rng.randf() < 0.5
		Input.parse_input_event(mb)
	else:
		var k := InputEventKey.new()
		k.physical_keycode = [KEY_A, KEY_D, KEY_M, KEY_SPACE, KEY_ENTER][_noise_rng.randi_range(0, 4)]
		k.pressed = _noise_rng.randf() < 0.5
		Input.parse_input_event(k)


## 注入一次「画布坐标」点击：headless 的虚拟窗口是 64×64，经 Window 拉伸变换会把
## 设计坐标映射到界外 —— 用 Viewport.push_input(event, true) 以本地坐标语义直投
## （桌面/真机上的窗口→画布变换由引擎正常处理，此处只影响测试注入姿势）。
func _inject_click(pos: Vector2) -> void:
	var mb := InputEventMouseButton.new()
	mb.button_index = MOUSE_BUTTON_LEFT
	mb.pressed = true
	mb.position = pos
	get_viewport().push_input(mb, true)


func _first_slot_index(state: String, is_bed: bool) -> int:
	var slots: Array[Dictionary] = GameState.beds if is_bed else GameState.plots
	for i in slots.size():
		if String(slots[i]["state"]) == state:
			return i
	return -1


## ── 第 1~3 项：场景接线 / autoload / 输入映射与键位契约 ──
func _check_basics() -> void:
	if _yard == null:
		_failures.append("主场景缺 Yard 节点（main.tscn 接线断裂）")
	elif not _yard.has_method("hit_at") or not _yard.has_method("hotspot_center"):
		_failures.append("Yard 未挂 yard_view.gd（缺 hit_at/hotspot_center 方法）")
	if _ui == null:
		_failures.append("主场景缺 UI 节点（main.tscn 接线断裂）")
	elif not _ui.has_method("open_plant_menu"):
		_failures.append("UI 未挂 ui_layer.gd（缺 open_plant_menu 方法）")
	for singleton in ["FarmData", "GameState", "Juice"]:
		if get_tree().root.get_node_or_null(singleton) == null:
			_failures.append("autoload %s 未注册（project.godot [autoload] 缺失）" % singleton)
	for signal_name in ["coins_changed", "xp_changed", "quest_changed", "orders_changed"]:
		if not GameState.has_signal(signal_name):
			_failures.append("GameState 缺少信号 %s" % signal_name)
	for action in REQUIRED_ACTIONS:
		if not InputMap.has_action(action):
			_failures.append("InputMap 缺少动作 %s（project.godot [input] 未注册）" % action)
	for action: StringName in KEY_CONTRACT:
		if not InputMap.has_action(action):
			continue
		var expected: Array = KEY_CONTRACT[action]
		var bound: Array[Key] = []
		for event in InputMap.action_get_events(action):
			var key := event as InputEventKey
			if key != null and key.physical_keycode != KEY_NONE:
				bound.append(key.physical_keycode)
		for want in expected:
			if not (want in bound):
				_failures.append("键位契约：动作 %s 未绑定承诺的物理键 %s（实际 %s）—— 该键真机按了没反应" % [
					action, OS.get_keycode_string(want as Key), str(bound),
				])
	# 音频资产与音效注册（治愈系表现的可判部分）：BGM + ≥3 类交互音效
	for sfx_name in ["plant", "harvest", "coin", "cluck", "quack", "honk", "click", "upgrade", "fail"]:
		if Juice.SFX_BANK.get(StringName(sfx_name)) == null:
			_failures.append("Juice.SFX_BANK 缺少音效 %s（跑 tools/gen_sfx.gd 生成后注册）" % sfx_name)
	if not ResourceLoader.exists("res://assets/audio/bgm_meadow.wav"):
		_failures.append("缺 BGM 资产 assets/audio/bgm_meadow.wav（跑 tools/gen_bgm.gd 生成）")


## ── 第 A 项：核心闭环数值 —— 种→长→收→卖 全链路按数值表精确结算 ──
func _check_core_loop() -> void:
	# 冻结任务链（进度指向末尾 → quest_progress 全部空转），排除任务奖励对经济结算断言的干扰
	GameState.quest_index = FarmData.QUESTS.size()
	var coins0 := GameState.coins
	var wheat: Dictionary = FarmData.CROPS["wheat"]
	var index := _first_slot_index("empty", false)
	if index < 0:
		_failures.append("核心闭环：没有空菜地可种（初始化缺陷）")
		return
	# 种：扣种子价
	if not GameState.plant(index, "wheat", false):
		_failures.append("核心闭环：plant(wheat) 失败（初始金币 %d ≥ 种子 %d 应成功）" % [coins0, int(wheat["seed_cost"])])
		return
	if GameState.coins != coins0 - int(wheat["seed_cost"]):
		_failures.append("核心闭环：种小麦后金币 %d ≠ %d（种子价 %d 未正确扣除）" % [GameState.coins, coins0 - int(wheat["seed_cost"]), int(wheat["seed_cost"])])
	if String(GameState.plots[index]["state"]) != "growing":
		_failures.append("核心闭环：种下后地块状态应为 growing，实际 %s" % String(GameState.plots[index]["state"]))
	# 长：快进 10s → 成熟
	GameState.tick(float(wheat["grow_sec"]) + 1.0)
	if String(GameState.plots[index]["state"]) != "mature":
		_failures.append("核心闭环：快进 %.0fs 后应成熟，实际状态 %s" % [float(wheat["grow_sec"]) + 1.0, String(GameState.plots[index]["state"])])
	# 收：入库 + 经验
	var xp0 := GameState.xp
	var level0 := GameState.level
	if not GameState.harvest(index, false):
		_failures.append("核心闭环：成熟收获失败")
	if int(GameState.inventory.get("wheat", 0)) < 1:
		_failures.append("核心闭环：收获后仓库没有小麦（入库断裂）")
	if GameState.xp - xp0 != int(wheat["xp"]) and GameState.level == level0:
		_failures.append("核心闭环：收获经验增量 %d ≠ %d" % [GameState.xp - xp0, int(wheat["xp"])])
	# 幂等：重复收获同一块地只结算一次
	var wheat_count := int(GameState.inventory.get("wheat", 0))
	if GameState.harvest(index, false):
		_failures.append("对抗输入：已收获的地块再次 harvest 竟然成功（重复奖励）")
	if int(GameState.inventory.get("wheat", 0)) != wheat_count:
		_failures.append("对抗输入：重复收获多发库存（%d → %d）" % [wheat_count, int(GameState.inventory.get("wheat", 0))])
	# 卖：售价（无休闲加成时 = 基础价）
	var price := GameState.price_of("wheat")
	var coins1 := GameState.coins
	if not GameState.sell_item("wheat", 1):
		_failures.append("核心闭环：sell_item(wheat,1) 失败")
	if GameState.coins != coins1 + price:
		_failures.append("核心闭环：卖出后金币 %d ≠ %d（单价 %d 结算错误）" % [GameState.coins, coins1 + price, price])
	if int(GameState.inventory.get("wheat", 0)) != wheat_count - 1:
		_failures.append("核心闭环：卖出后库存 %d ≠ %d（扣减错误）" % [int(GameState.inventory.get("wheat", 0)), wheat_count - 1])
	if price != int(wheat["sell_price"]):
		_failures.append("核心闭环：无加成时小麦单价 %d ≠ 数值表 %d（加成泄漏）" % [price, int(wheat["sell_price"])])


## ── 第 B/C 项：边界对抗（金币不足/库存不为负/订单原料校验）+ 存档往返 ──
## 注意编排：本阶段不建造工坊、不交付订单 —— 任务链 q4/q5/q6 留给后续阶段按序完成。
func _check_edges_and_save() -> void:
	# 冻结任务链（本阶段的拒绝类动作不应推进任何任务）
	GameState.quest_index = FarmData.QUESTS.size()
	# 金币不足拒绝且不为负
	GameState.coins = 1
	var coins0 := GameState.coins
	if GameState.plant(_first_slot_index("empty", false), "corn", false):
		_failures.append("对抗输入：金币 1 竟能种下种子价 25 的玉米")
	if GameState.coins < 0:
		_failures.append("对抗输入：金币为负（%d）—— 扣费未校验" % GameState.coins)
	if GameState.coins != coins0:
		_failures.append("对抗输入：购买被拒后金币发生变化（%d → %d）" % [coins0, GameState.coins])
	# 空仓库卖货拒绝
	if GameState.sell_item("goose_egg", 1):
		_failures.append("对抗输入：空仓库能卖出鹅蛋")
	# 工坊未建造时加工拒绝
	if GameState.start_craft("bread"):
		_failures.append("对抗输入：未建工坊竟能开始加工")
	# 订单原料不足交付拒绝（不推进任务链）
	var order: Dictionary = GameState.orders[0]
	for item_id: String in order["needs"]:
		GameState.inventory[item_id] = int(order["needs"][item_id]) - 1
	if GameState.deliver_order(0):
		_failures.append("对抗输入：原料不齐仍交付成功订单")
	# 存档往返：mutate → save → 再 mutate → load 完整恢复
	GameState.inventory["cake"] = 3
	GameState.muted = true
	var quest_index0 := GameState.quest_index
	if not GameState.save_game():
		_failures.append("存档：save_game 写盘失败")
	GameState.inventory["cake"] = 99
	GameState.coins = 7
	GameState.quest_index = 0
	GameState.muted = false
	if not GameState.load_game():
		_failures.append("存档：load_game 读取失败")
	if int(GameState.inventory.get("cake", 0)) != 3:
		_failures.append("存档：往返后仓库 cake=%d ≠ 3（库存未恢复）" % int(GameState.inventory.get("cake", 0)))
	if GameState.coins == 7:
		_failures.append("存档：往返后金币仍是篡改值 7（未恢复存档值）")
	if GameState.quest_index != quest_index0:
		_failures.append("存档：往返后任务进度 %d ≠ %d" % [GameState.quest_index, quest_index0])
	if not GameState.muted:
		_failures.append("存档：往返后静音开关未保持（移动端静音偏好丢失）")
	GameState.muted = false


## ── 第 D 项：建造升级真实生效（工坊提速 / 休闲售价加成 / 养殖舍升级 / 开垦）──
func _check_build_upgrade() -> void:
	GameState.coins = 1200
	# 工坊升级 → 加工周期 ×0.75
	if not GameState.upgrade_workshop():
		_failures.append("升级：工坊 Lv.1→2 失败（金币充足）")
	if absf(GameState.craft_remain) > 0.001 or GameState.crafting_recipe != "":
		_failures.append("升级：升级时不应有加工中的任务")
	GameState.inventory["wheat"] = 6
	GameState.inventory["egg"] = 4
	if not GameState.start_craft("bread"):
		_failures.append("加工：Lv.2 工坊制作面包失败")
	var expected_sec := float(FarmData.RECIPES["bread"]["craft_sec"]) * FarmData.level_speed(2, FarmData.CRAFT_SPEED_PER_LEVEL)
	if absf(GameState.craft_remain - expected_sec) > 0.3:
		_failures.append("升级：工坊 Lv.2 面包加工 %0.1fs ≠ 预期 %0.1fs（提速未生效）" % [GameState.craft_remain, expected_sec])
	if int(GameState.inventory.get("wheat", 0)) != 4:
		_failures.append("加工：原料未正确扣减（小麦余 %d ≠ 4）" % int(GameState.inventory.get("wheat", 0)))
	GameState.tick(expected_sec + 0.5)
	if int(GameState.inventory.get("bread", 0)) != 1:
		_failures.append("加工：到期后面包未入库")
	# 休闲设施 → 售价加成可见且生效（建造 → Lv.2 → Lv.3，共三次调用）
	var wheat_price0 := GameState.price_of("wheat")
	if not GameState.upgrade_leisure("fountain") \
			or not GameState.upgrade_leisure("fountain") \
			or not GameState.upgrade_leisure("fountain"):
		_failures.append("升级：喷泉建造/升级失败（金币充足）")
	var expected_bonus: int = FarmData.price_bonus_pct(GameState.fountain_level, GameState.swing_level)
	if expected_bonus != 8:
		_failures.append("升级：喷泉 Lv.3 售价加成 %d%% ≠ 8%%" % expected_bonus)
	if GameState.price_of("wheat") != int(ceil(float(FarmData.CROPS["wheat"]["sell_price"]) * 1.08)):
		_failures.append("升级：加成后小麦单价 %d ≠ ceil(6×1.08)（加成未实际生效）" % GameState.price_of("wheat"))
	if wheat_price0 != int(FarmData.CROPS["wheat"]["sell_price"]):
		_failures.append("升级：加成前单价 %d ≠ 基础价" % wheat_price0)
	# 养殖舍升级 → 等级与速度系数生效
	if not GameState.upgrade_coop("chicken"):
		_failures.append("升级：鸡舍升级失败（金币充足）")
	if int(GameState.coops["chicken"]["level"]) != 2:
		_failures.append("升级：鸡舍等级 %d ≠ 2" % int(GameState.coops["chicken"]["level"]))
	if absf(FarmData.level_speed(2, FarmData.COOP_SPEED_PER_LEVEL) - 0.8) > 0.001:
		_failures.append("升级：鸡舍 Lv.2 速度系数 ≠ 0.8（产出提速未生效）")
	# 开垦locked地块
	var locked := _first_slot_index("locked", false)
	if locked < 0 or not GameState.unlock_plot(locked):
		_failures.append("扩建：开垦新菜地失败（金币充足）")
	if String(GameState.plots[locked]["state"]) != "empty":
		_failures.append("扩建：开垦后地块状态 %s ≠ empty" % String(GameState.plots[locked]["state"]))


## 点击收获用例的基线（phase 8 记录）
var _input_harvest_before := 0


## ── 第 E 项：五大区域热区（每区 ≥1 可交互对象）──
func _check_regions_and_audio() -> void:
	for region in 5:
		if _yard.hotspot_count_in_region(region) < 1:
			_failures.append("五大区域：区域 %d（%s）没有任何可交互热区" % [region, ["菜园", "果园", "鸡鸭鹅舍", "小花园", "休闲天地"][region]])


func _assert_plant_menu_open() -> void:
	if not _ui.call("is_modal_open"):
		_failures.append("点击语义：点击空菜地没有弹出种植菜单")
		return
	var buttons: Array = _ui.call("plant_option_buttons")
	if buttons.size() < FarmData.CROPS.size():
		_failures.append("点击语义：种植菜单选项 %d < 作物数 %d（菜单未列全）" % [buttons.size(), FarmData.CROPS.size()])


## 点菜单里文本含「番茄」的那一项 → 必须种下番茄本身
func _press_plant_option(option_name: String) -> void:
	var buttons: Array = _ui.call("plant_option_buttons")
	for button in buttons:
		if button is Button and (button as Button).text.contains(option_name):
			(button as Button).pressed.emit()
			return
	_failures.append("点击语义：种植菜单里找不到「%s」选项" % option_name)


func _assert_option_planted_right_crop() -> void:
	if _tap_plot_index < 0:
		return
	var slot: Dictionary = GameState.plots[_tap_plot_index]
	if String(slot["crop"]) != "tomato" or String(slot["state"]) != "growing":
		_failures.append("点击语义：点「番茄」后地块 crop=%s state=%s（点菜单项必须种下该项本身）" % [String(slot["crop"]), String(slot["state"])])


## 注入点击收获成熟小麦：地块清空 + 库存 +1（点作物收该作物）
func _assert_click_harvested() -> void:
	if _tap_plot_index < 0:
		return
	var slot: Dictionary = GameState.plots[_tap_plot_index]
	if String(slot["state"]) != "empty":
		_failures.append("点击语义：点击成熟小麦后地块状态 %s ≠ empty（点击收获未生效）" % String(slot["state"]))
	if int(GameState.inventory.get("wheat", 0)) != _input_harvest_before + 1:
		_failures.append("点击语义：点击收获后小麦库存 %d ≠ %d（未入库或多发）" % [
			int(GameState.inventory.get("wheat", 0)), _input_harvest_before + 1,
		])


func _assert_confirm_harvested(index: int) -> void:
	if index < 0:
		return
	if String(GameState.plots[index]["state"]) != "empty":
		_failures.append("confirm 收获：键入 confirm 后胡萝卜地块状态 %s ≠ empty" % String(GameState.plots[index]["state"]))


## ── 第 F 项：任务链 7 阶段从零重放 —— 每个阶段的达成事件都必须推进进度并发奖励 ──
func _check_quest_chain() -> void:
	GameState.quest_index = 0
	GameState.coins = 300
	# q1 种下第一株作物
	var index := _first_slot_index("empty", false)
	if index < 0:
		index = _first_slot_index("locked", false)
		if index < 0 or not GameState.unlock_plot(index):
			_failures.append("任务链：q1 无地可种且开垦失败")
			return
	if not GameState.plant(index, "wheat", false):
		_failures.append("任务链：q1 种植失败")
		return
	if GameState.quest_index != 1:
		_failures.append("任务链：q1（种下第一株作物）未推进，进度 %d" % GameState.quest_index)
		return
	# q2 收获第一份作物
	GameState.tick(float(FarmData.CROPS["wheat"]["grow_sec"]) + 1.0)
	if not GameState.harvest(index, false):
		_failures.append("任务链：q2 收获失败")
		return
	if GameState.quest_index != 2:
		_failures.append("任务链：q2（收获第一份作物）未推进，进度 %d" % GameState.quest_index)
		return
	# q3 在集市卖出任意商品
	GameState.inventory["wheat"] = int(GameState.inventory.get("wheat", 0)) + 1
	if not GameState.sell_item("wheat", 1):
		_failures.append("任务链：q3 卖出失败")
		return
	if GameState.quest_index != 3:
		_failures.append("任务链：q3（集市卖出）未推进，进度 %d" % GameState.quest_index)
		return
	# q4 建造工坊
	if not GameState.build_workshop():
		_failures.append("任务链：q4 建造工坊失败（金币充足）")
		return
	if GameState.quest_index != 4:
		_failures.append("任务链：q4（建造工坊）未推进，进度 %d" % GameState.quest_index)
		return
	# q5 制作一份面包：小麦×2（直接备料）+ 鸡蛋×2（鸡舍 12s 周期，快进 25.5s 必有 2 枚）
	GameState.inventory["wheat"] = 2
	GameState.tick(25.5)
	if not GameState.collect_coop("chicken"):
		_failures.append("任务链：q5 备料收蛋失败")
		return
	if not GameState.start_craft("bread"):
		_failures.append("任务链：q5 开始制作面包失败（原料已备齐）")
		return
	GameState.tick(float(FarmData.RECIPES["bread"]["craft_sec"]) + 1.0)
	if GameState.quest_index != 5:
		_failures.append("任务链：q5（制作面包）未推进，进度 %d" % GameState.quest_index)
		return
	# q6 完成一张订单：补齐原料 → 交付 → 奖励结算 + 补新订单
	# 先把等级钉在 3、经验清零：隔离「订单经验触发升级」与「q6 任务奖励」两个叠加变量，
	# 使结算断言精确 = 订单奖励 + q6 任务奖励 50 金币。
	GameState.level = 3
	GameState.xp = 0
	var order: Dictionary = GameState.orders[0]
	for item_id: String in order["needs"]:
		GameState.inventory[item_id] = int(order["needs"][item_id])
	var coins0 := GameState.coins
	if not GameState.deliver_order(0):
		_failures.append("任务链：q6 订单交付失败（原料已补齐）")
		return
	var q6_quest_reward := int(FarmData.QUESTS[5]["reward_coins"])
	if GameState.coins != coins0 + int(order["reward_coins"]) + q6_quest_reward:
		_failures.append("任务链：q6 交付结算 %d ≠ 订单 %d + 任务奖励 %d" % [
			GameState.coins, coins0 + int(order["reward_coins"]), q6_quest_reward,
		])
	if GameState.orders.size() != FarmData.ACTIVE_ORDER_COUNT:
		_failures.append("任务链：订单交付后未补充新订单")
	if GameState.quest_index != 6:
		_failures.append("任务链：q6（完成订单）未推进，进度 %d" % GameState.quest_index)
		return
	# q7 等级达到 3 级：把经验推到升级线，验证 _add_xp 里的等级触发路径
	GameState.level = 2
	GameState.xp = GameState.xp_to_next() - 1
	GameState.inventory["wheat"] = 2
	if not GameState.sell_item("wheat", 1):
		_failures.append("任务链：q7 触发用的卖出动作失败")
		return
	if GameState.level < 3:
		_failures.append("任务链：卖出 +1 经验后应升到 3 级，实际 Lv.%d" % GameState.level)
	if GameState.quest_index != FarmData.QUESTS.size():
		_failures.append("任务链：7 阶段未全部完成（进度 %d / %d）" % [GameState.quest_index, FarmData.QUESTS.size()])
	if not GameState.current_quest().is_empty():
		_failures.append("任务链：全部完成后 current_quest 应为空")


## ── 第 4/6 项：信号到达订阅方 + 反馈非空 ──
func _assert_feedback_and_signals() -> void:
	if not _coins_seen:
		_failures.append("信号 GameState.coins_changed 未到达订阅方")
	if not _xp_seen:
		_failures.append("信号 GameState.xp_changed 未到达订阅方")
	if not _quest_seen:
		_failures.append("信号 GameState.quest_changed 未到达订阅方")
	if Juice.events.is_empty():
		_failures.append("反馈断言：整个闭环没有触发任何 Juice 反馈（结果性事件必须挂 ≥1 条反馈）")
	for sfx_name in ["plant", "harvest", "coin"]:
		var found := false
		for event in Juice.events:
			if event.begins_with("sfx:%s" % sfx_name):
				found = true
		if not found:
			_failures.append("反馈断言：闭环里没有播放 %s 音效（结果反馈缺失）" % sfx_name)


## ── 第 7 项：调参协议（纯逻辑、无头可判；检查后必须恢复原状）──
func _check_tuning_protocol() -> void:
	var meta: Variant = GameState.get("TUNING_META")
	if not (meta is Dictionary) or (meta as Dictionary).is_empty():
		_failures.append("调参协议：GameState.TUNING_META 为空（数值调参区必须声明可调键）")
		return
	var original_speed: Variant = GameState.get("grow_speed")
	var applied: PackedStringArray = GameState.call("apply_tuning", {"grow_speed": 99999.0, "tuning_bogus_key": 1})
	if not applied.has("grow_speed"):
		_failures.append("调参协议：apply_tuning 未应用已声明键 grow_speed")
	if applied.has("tuning_bogus_key"):
		_failures.append("调参协议：apply_tuning 应用了未声明键 tuning_bogus_key（必须拒绝）")
	var speed: Variant = GameState.get("grow_speed")
	if not (speed is float or speed is int) or float(speed) > 4.0:
		_failures.append("调参协议：grow_speed=%s 超出 TUNING_META.max=4.0（钳制缺失）" % [speed])
	if applied.has("grow_speed") and original_speed != null:
		GameState.set("grow_speed", original_speed)


func _finish() -> void:
	if _finished:
		return
	_finished = true
	_check_tuning_protocol()
	if _failures.is_empty():
		print("GODOT_SMOKE: PASS 场景接线/autoload/键位契约/点击语义/经营闭环数值/对抗输入/存档往返/建造升级/五大区域/任务链7阶段/反馈与调参协议 全部通过")
		get_tree().quit(0)
	else:
		for failure in _failures:
			printerr("GODOT_SMOKE: FAIL %s" % failure)
		get_tree().quit(1)
