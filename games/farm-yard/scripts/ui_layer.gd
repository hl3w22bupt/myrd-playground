extends CanvasLayer
## HUD 与弹层：顶部常驻信息条（金币/等级经验/静音/集市/订单/建设）+ 任务横幅 +
## 种植菜单 / 工坊加工 / 集市出售 / 订单交付 / 庭院建设 五类弹层 + 飘字反馈。
##
## 规范要点：
## - 全部 UI 代码化构建（.tscn 只保留主场景骨架，避免手写场景接线断裂）；
## - 状态展示一律订阅 GameState 信号刷新（不主动轮询）；
## - 按钮点击语义与庭院点击语义一致：点某个作物按钮 = 种下该作物（目标验收口径）；
## - 弹层是独占模态：打开一个关闭其它；点遮罩关闭。

const COL_PANEL := Color("fff7e6")
const COL_PANEL_EDGE := Color("d9b98c")
const COL_TEXT := Color("4a3628")
const COL_ACCENT := Color("5f9e54")
const COL_WARN := Color("c2564a")

var _coin_label: Label
var _level_label: Label
var _xp_bar: ProgressBar
var _quest_label: Label
var _mute_button: Button
var _helper_button: Button
var _orders_badge: Label
var _toast_label: Label
var _toast_tween: Tween

var _dim: ColorRect
var _modal: PanelContainer
var _modal_title: Label
var _modal_body: VBoxContainer
var _plant_kind := ""      # "plot" | "bed"
var _plant_index := -1


func _ready() -> void:
	layer = 20
	_build_top_bar()
	_build_quest_banner()
	_build_toast()
	_build_modal()
	GameState.coins_changed.connect(_on_coins_changed)
	GameState.xp_changed.connect(_on_xp_changed)
	GameState.inventory_changed.connect(_refresh_panels)
	GameState.yards_changed.connect(_refresh_panels)
	GameState.orders_changed.connect(_refresh_panels)
	GameState.quest_changed.connect(_on_quest_changed)
	_refresh_all()


## ── 顶部信息条 ──
func _build_top_bar() -> void:
	var bar := PanelContainer.new()
	var style := StyleBoxFlat.new()
	style.bg_color = Color(COL_PANEL, 0.94)
	style.set_corner_radius_all(18)
	style.content_margin_left = 14.0
	style.content_margin_right = 14.0
	style.content_margin_top = 8.0
	style.content_margin_bottom = 8.0
	bar.add_theme_stylebox_override("panel", style)
	bar.set_anchors_preset(Control.PRESET_TOP_WIDE)
	bar.offset_left = 10.0
	bar.offset_right = -10.0
	bar.offset_top = 8.0
	add_child(bar)

	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	bar.add_child(row)

	_coin_label = _chip_label("金币 0", 20, COL_TEXT)
	row.add_child(_coin_label)
	_level_label = _chip_label("Lv.1", 20, COL_ACCENT)
	row.add_child(_level_label)
	_xp_bar = ProgressBar.new()
	_xp_bar.min_value = 0.0
	_xp_bar.max_value = 1.0
	_xp_bar.value = 0.0
	_xp_bar.show_percentage = false
	_xp_bar.custom_minimum_size = Vector2(92.0, 16.0)
	_xp_bar.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	row.add_child(_xp_bar)

	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(spacer)

	_mute_button = _text_button("音效:开", 16)
	_mute_button.pressed.connect(_on_mute_pressed)
	row.add_child(_mute_button)
	_helper_button = _text_button("帮工:开", 16)
	_helper_button.pressed.connect(_on_helper_pressed)
	row.add_child(_helper_button)
	var build_button := _text_button("庭院", 16)
	build_button.pressed.connect(open_build)
	row.add_child(build_button)
	var market_button := _text_button("集市", 16)
	market_button.pressed.connect(open_market)
	row.add_child(market_button)
	var orders_button := _text_button("订单", 16)
	orders_button.pressed.connect(open_orders)
	row.add_child(orders_button)
	_orders_badge = _chip_label("", 13, Color("fff8ea"))
	_orders_badge.visible = false
	row.add_child(_orders_badge)


func _build_quest_banner() -> void:
	var banner := PanelContainer.new()
	var style := StyleBoxFlat.new()
	style.bg_color = Color(Color("5f9e54"), 0.92)
	style.set_corner_radius_all(14)
	style.content_margin_left = 14.0
	style.content_margin_right = 14.0
	style.content_margin_top = 6.0
	style.content_margin_bottom = 6.0
	banner.add_theme_stylebox_override("panel", style)
	banner.set_anchors_preset(Control.PRESET_TOP_WIDE)
	banner.offset_left = 150.0
	banner.offset_right = -150.0
	banner.offset_top = 66.0
	add_child(banner)
	_quest_label = Label.new()
	_quest_label.add_theme_font_size_override("font_size", 16)
	_quest_label.add_theme_color_override("font_color", Color("fff8ea"))
	_quest_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	banner.add_child(_quest_label)


func _build_toast() -> void:
	_toast_label = Label.new()
	_toast_label.add_theme_font_size_override("font_size", 20)
	_toast_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_toast_label.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	_toast_label.offset_top = -190.0
	_toast_label.offset_bottom = -150.0
	_toast_label.offset_left = -220.0
	_toast_label.offset_right = 220.0
	_toast_label.modulate.a = 0.0
	add_child(_toast_label)


## ── 模态弹层骨架：遮罩 + 面板（标题 + 内容 + 关闭）──
func _build_modal() -> void:
	_dim = ColorRect.new()
	_dim.color = Color(0.12, 0.09, 0.05, 0.45)
	_dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	_dim.visible = false
	_dim.gui_input.connect(_on_dim_input)
	add_child(_dim)
	_modal = PanelContainer.new()
	var style := StyleBoxFlat.new()
	style.bg_color = COL_PANEL
	style.set_corner_radius_all(20)
	style.set_border_width_all(3)
	style.border_color = COL_PANEL_EDGE
	style.content_margin_left = 16.0
	style.content_margin_right = 16.0
	style.content_margin_top = 12.0
	style.content_margin_bottom = 16.0
	_modal.add_theme_stylebox_override("panel", style)
	_modal.set_anchors_preset(Control.PRESET_CENTER)
	_modal.custom_minimum_size = Vector2(600.0, 0.0)
	_modal.visible = false
	add_child(_modal)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 8)
	_modal.add_child(column)
	var head := HBoxContainer.new()
	column.add_child(head)
	_modal_title = Label.new()
	_modal_title.add_theme_font_size_override("font_size", 22)
	_modal_title.add_theme_color_override("font_color", COL_TEXT)
	_modal_title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	head.add_child(_modal_title)
	var close_button := _text_button("关闭", 16)
	close_button.pressed.connect(close_modal)
	head.add_child(close_button)
	_modal_body = VBoxContainer.new()
	_modal_body.add_theme_constant_override("separation", 6)
	column.add_child(_modal_body)


func _on_dim_input(event: InputEvent) -> void:
	var button := event as InputEventMouseButton
	if button != null and button.pressed:
		close_modal()


## ═══════════════ 弹层实现 ═══════════════

func open_plant_menu(kind: String, index: int) -> void:
	_plant_kind = kind
	_plant_index = index
	_open_modal("种什么？")
	for id: String in (FarmData.FLOWERS if kind == "bed" else FarmData.CROPS):
		var crop: Dictionary = (FarmData.FLOWERS if kind == "bed" else FarmData.CROPS)[id]
		var affordable := GameState.coins >= int(crop["seed_cost"])
		var text := "%s　种子 %d · 售价 %d · %d 秒成熟" % [crop["name"], int(crop["seed_cost"]), int(crop["sell_price"]), int(crop["grow_sec"])]
		var button := _row_button(text, affordable)
		button.pressed.connect(_on_plant_option.bind(id))
		_modal_body.add_child(button)
	_show_modal()


func _on_plant_option(crop_id: String) -> void:
	var ok := GameState.plant(_plant_index, crop_id, _plant_kind == "bed")
	if ok:
		Juice.sfx(&"plant")
		Juice.pop(_modal)
		close_modal()
	_refresh_all()


func open_craft_panel() -> void:
	_open_modal("工坊加工")
	if not GameState.workshop_built:
		_hint("先在庭院里建造工坊（%d 金币）" % FarmData.WORKSHOP_BUILD_COST)
		_show_modal()
		return
	for id: String in FarmData.RECIPES:
		var recipe: Dictionary = FarmData.RECIPES[id]
		var inputs := PackedStringArray()
		for item_id: String in recipe["inputs"]:
			inputs.append("%s×%d（有 %d）" % [FarmData.item_catalog()[item_id]["name"], int(recipe["inputs"][item_id]), GameState.inventory.get(item_id, 0)])
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 8)
		_modal_body.add_child(row)
		var info := Label.new()
		info.add_theme_font_size_override("font_size", 15)
		info.add_theme_color_override("font_color", COL_TEXT)
		info.text = "%s　%s\n售价 %d · 加工 %d 秒" % [recipe["name"], " + ".join(inputs), int(recipe["sell_price"]), int(recipe["craft_sec"])]
		info.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(info)
		var craft_button := _text_button("制作", 16)
		craft_button.disabled = not GameState.craft_available(id) or GameState.crafting_recipe != ""
		craft_button.pressed.connect(_on_craft.bind(id))
		row.add_child(craft_button)
	var upgrade_row := HBoxContainer.new()
	_modal_body.add_child(upgrade_row)
	var upgrade_info := Label.new()
	upgrade_info.add_theme_font_size_override("font_size", 15)
	upgrade_info.add_theme_color_override("font_color", COL_TEXT)
	upgrade_info.text = "工坊 Lv.%d（每级加工提速 25%%）" % GameState.workshop_level
	upgrade_info.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	upgrade_row.add_child(upgrade_info)
	if GameState.workshop_level < FarmData.MAX_FACILITY_LEVEL:
		var upgrade_button := _text_button("升级 %d 金币" % FarmData.WORKSHOP_UPGRADE_COSTS[GameState.workshop_level - 1], 15)
		upgrade_button.pressed.connect(_on_upgrade_workshop)
		upgrade_row.add_child(upgrade_button)
	_show_modal()


func _on_craft(recipe_id: String) -> void:
	if GameState.start_craft(recipe_id):
		Juice.sfx(&"confirm")
		close_modal()
	_refresh_all()


func _on_upgrade_workshop() -> void:
	if GameState.upgrade_workshop():
		Juice.sfx(&"upgrade")
	_refresh_panels()


func open_market() -> void:
	_open_modal("集市出售")
	var catalog: Dictionary = FarmData.item_catalog()
	var any := false
	for item_id: String in catalog:
		var count := int(GameState.inventory.get(item_id, 0))
		if count <= 0:
			continue
		any = true
		var unit := GameState.price_of(item_id)
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 8)
		_modal_body.add_child(row)
		var info := Label.new()
		info.add_theme_font_size_override("font_size", 15)
		info.add_theme_color_override("font_color", COL_TEXT)
		info.text = "%s ×%d　单价 %d" % [catalog[item_id]["name"], count, unit]
		info.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(info)
		var sell_one := _text_button("卖 1", 15)
		sell_one.pressed.connect(_on_sell.bind(item_id, 1))
		row.add_child(sell_one)
		var sell_all := _text_button("全卖 +%d" % (unit * count), 15)
		sell_all.pressed.connect(_on_sell.bind(item_id, count))
		row.add_child(sell_all)
	if not any:
		_hint("仓库空空的，先去收获一些作物和蛋吧")
	var bonus := FarmData.price_bonus_pct(GameState.fountain_level, GameState.swing_level)
	if bonus > 0:
		_hint("休闲设施加成：全部售价 +%d%%" % bonus)
	_show_modal()


func _on_sell(item_id: String, count: int) -> void:
	if GameState.sell_item(item_id, count):
		Juice.sfx(&"coin")
	_refresh_panels()


func open_orders() -> void:
	_open_modal("订单（完成得金币与经验）")
	for order in GameState.orders:
		var needs := PackedStringArray()
		var done := true
		var progress: Dictionary = GameState.order_progress(order)
		for item_id: String in progress:
			var need: int = progress[item_id]["need"]
			var have: int = progress[item_id]["have"]
			needs.append("%s %d/%d" % [FarmData.item_catalog()[item_id]["name"], mini(have, need), need])
			if have < need:
				done = false
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 8)
		_modal_body.add_child(row)
		var info := Label.new()
		info.add_theme_font_size_override("font_size", 15)
		info.add_theme_color_override("font_color", COL_TEXT)
		info.text = "#%d　%s\n奖励 %d 金币 · %d 经验" % [int(order["id"]), " ".join(needs), int(order["reward_coins"]), int(order["reward_xp"])]
		info.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(info)
		var deliver := _text_button("交付", 15)
		deliver.disabled = not done
		deliver.pressed.connect(_on_deliver.bind(GameState.orders.find(order)))
		row.add_child(deliver)
		# v2 B2 一键订单生产链：缺什么种什么/摘什么/送加工，免逐项操作
		if FarmData.ONE_CLICK_ORDER_ENABLED:
			var auto_fill := _text_button("一键备货", 15)
			auto_fill.pressed.connect(_on_auto_fill.bind(GameState.orders.find(order)))
			row.add_child(auto_fill)
	_show_modal()


## v2 B2：一键备货 → 汇总报告一条 toast（种下/收取/送加工/确实无计可施的缺口）。
func _on_auto_fill(order_index: int) -> void:
	var report: Dictionary = GameState.auto_fill_order(order_index)
	var planted := int(report["planted"])
	var collected := int(report["collected"])
	var crafting := String(report["crafting"])
	var missing: PackedStringArray = report["missing"]
	var summary := "一键备货：种下 %d 处、收取 %d 份" % [planted, collected]
	if crafting != "":
		summary += "、送加工%s" % FarmData.RECIPES[crafting]["name"]
	if missing.size() > 0:
		var names := PackedStringArray()
		for item_id in missing:
			names.append(String(FarmData.item_catalog()[String(item_id)]["name"]))
		summary += "；还缺 %s（没空地或工坊忙，稍后再点）" % "、".join(names)
	GameState.toast.emit(summary, missing.size() == 0)
	if planted > 0:
		Juice.sfx(&"plant")
	if collected > 0 or crafting != "":
		Juice.sfx(&"confirm")
	Juice.pop(_modal, 1.04, 0.12)
	_refresh_all()


func _on_deliver(order_index: int) -> void:
	if GameState.deliver_order(order_index):
		Juice.sfx(&"coin")
	_refresh_panels()


func open_build() -> void:
	_open_modal("庭院建设")
	var rows := PackedStringArray()
	var buttons: Array[Dictionary] = []
	# 菜地 / 花圃开垦
	rows.append(_locked_summary("plot"))
	buttons.append({"kind": "plot"})
	rows.append(_locked_summary("bed"))
	buttons.append({"kind": "bed"})
	# 果树 / 养殖舍建造与升级
	for id: String in FarmData.TREES:
		var tree: Dictionary = GameState.trees[id]
		if bool(tree["built"]):
			rows.append("%s　已栽种" % FarmData.TREES[id]["name"])
		else:
			rows.append("栽种%s　%d 金币" % [FarmData.TREES[id]["name"], int(FarmData.TREES[id]["build_cost"])])
		buttons.append({"kind": "tree", "id": id})
	for id: String in FarmData.COOPS:
		var coop: Dictionary = GameState.coops[id]
		var level := int(coop["level"])
		if level <= 0:
			rows.append("建造%s　%d 金币" % [FarmData.COOPS[id]["name"], int(FarmData.COOPS[id]["build_cost"])])
		elif level >= FarmData.MAX_FACILITY_LEVEL:
			rows.append("%s Lv.%d　已满级（产出周期 %ds）" % [FarmData.COOPS[id]["name"], level, int(FarmData.COOPS[id]["interval_sec"])])
		else:
			rows.append("%s Lv.%d→%d　升级 %d 金币（产出提速）" % [FarmData.COOPS[id]["name"], level, level + 1, FarmData.COOP_UPGRADE_COSTS[level - 1]])
		buttons.append({"kind": "coop", "id": id})
	# 工坊 / 休闲设施
	if GameState.workshop_built:
		rows.append("工坊 Lv.%d" % GameState.workshop_level)
	else:
		rows.append("建造工坊　%d 金币" % FarmData.WORKSHOP_BUILD_COST)
	buttons.append({"kind": "workshop"})
	for entry: Array in [["fountain", "喷泉"], ["swing", "秋千"]]:
		var level := GameState.fountain_level if String(entry[0]) == "fountain" else GameState.swing_level
		match level:
			0:
				var build_cost := FarmData.FOUNTAIN_BUILD_COST if String(entry[0]) == "fountain" else FarmData.SWING_BUILD_COST
				rows.append("建造%s　%d 金币（满级各 +8%% 售价）" % [entry[1], build_cost])
			FarmData.MAX_FACILITY_LEVEL:
				rows.append("%s Lv.%d　已满级" % [entry[1], level])
			_:
				var costs: Array[int] = FarmData.FOUNTAIN_UPGRADE_COSTS if String(entry[0]) == "fountain" else FarmData.SWING_UPGRADE_COSTS
				rows.append("%s Lv.%d→%d　升级 %d 金币（售价 +4%%）" % [entry[1], level, level + 1, costs[level - 1]])
		buttons.append({"kind": String(entry[0])})
	for i in buttons.size():
		var button := _row_button(rows[i], true)
		var payload: Dictionary = buttons[i]
		button.pressed.connect(_on_build_row.bind(payload))
		_modal_body.add_child(button)
	var bonus := FarmData.price_bonus_pct(GameState.fountain_level, GameState.swing_level)
	_hint("当前售价加成：+%d%%" % bonus)
	_show_modal()


func _locked_summary(kind: String) -> String:
	var slots: Array[Dictionary] = GameState.beds if kind == "bed" else GameState.plots
	var costs: Array[int] = FarmData.BED_UNLOCK_COSTS if kind == "bed" else FarmData.PLOT_UNLOCK_COSTS
	for i in slots.size():
		if slots[i]["state"] == "locked":
			return "开垦%s第 %d 块地　%d 金币" % ["花圃" if kind == "bed" else "菜地", i + 1, costs[i]]
	return "%s已全部开垦" % ("花圃" if kind == "bed" else "菜地")


func _on_build_row(payload: Dictionary) -> void:
	var ok := false
	match String(payload["kind"]):
		"plot":
			ok = _unlock_first("plot")
		"bed":
			ok = _unlock_first("bed")
		"tree":
			ok = GameState.build_tree(String(payload["id"]))
			if ok:
				Juice.sfx(&"upgrade")
		"coop":
			var coop: Dictionary = GameState.coops[String(payload["id"])]
			if int(coop["level"]) <= 0:
				ok = GameState.build_coop(String(payload["id"]))
			else:
				ok = GameState.upgrade_coop(String(payload["id"]))
			if ok:
				Juice.sfx(&"upgrade")
		"workshop":
			ok = GameState.build_workshop() if not GameState.workshop_built else GameState.upgrade_workshop()
			if ok:
				Juice.sfx(&"upgrade")
		"fountain", "swing":
			ok = GameState.upgrade_leisure(String(payload["kind"]))
			if ok:
				Juice.sfx(&"upgrade")
	if ok:
		Juice.pop(_modal)
	_refresh_panels()


func _unlock_first(kind: String) -> bool:
	var slots: Array[Dictionary] = GameState.beds if kind == "bed" else GameState.plots
	for i in slots.size():
		if slots[i]["state"] == "locked":
			var ok := GameState.unlock_bed(i) if kind == "bed" else GameState.unlock_plot(i)
			if ok:
				Juice.sfx(&"upgrade")
			return ok
	return false


func close_modal() -> void:
	_modal.visible = false
	_dim.visible = false
	_plant_kind = ""
	_plant_index = -1


func is_modal_open() -> bool:
	return _modal.visible


func plant_option_buttons() -> Array:
	var buttons: Array = []
	for child in _modal_body.get_children():
		if child is Button:
			buttons.append(child)
	return buttons


## ═══════════════ 状态刷新（全部由 GameState 信号驱动）═══════════════

func _refresh_all() -> void:
	_on_coins_changed(GameState.coins)
	_on_xp_changed(GameState.level, GameState.xp, GameState.xp_to_next())
	_on_quest_changed(GameState.current_quest())
	_refresh_panels()
	_on_mute_changed()
	_on_helper_changed()


func _refresh_panels() -> void:
	var deliverable := 0
	for order in GameState.orders:
		var done := true
		var progress: Dictionary = GameState.order_progress(order)
		for item_id: String in progress:
			if int(progress[item_id]["have"]) < int(progress[item_id]["need"]):
				done = false
		if done:
			deliverable += 1
	_orders_badge.text = str(deliverable)
	_orders_badge.visible = deliverable > 0
	if _modal.visible:
		var title := _modal_title.text
		if title == "集市出售":
			open_market()
		elif title == "订单（完成得金币与经验）":
			open_orders()
		elif title == "庭院建设":
			open_build()
		elif title == "工坊加工":
			open_craft_panel()


func _on_coins_changed(coins: int) -> void:
	_coin_label.text = "金币 %d" % coins
	if _modal.visible and _modal_title.text == "种什么？":
		open_plant_menu(_plant_kind, _plant_index)


## 金币标签高亮动效（首奖励/大额入账的结果反馈，SKILL.md §3B）：弹跳 + 闪金光。
func pulse_coins() -> void:
	Juice.pop(_coin_label, 1.35, 0.28)
	Juice.flash(_coin_label, Color(1.0, 0.9, 0.45, 0.85), 0.4)


func _on_xp_changed(level: int, xp: int, xp_to_next: int) -> void:
	_level_label.text = "Lv.%d" % level
	_xp_bar.max_value = float(maxi(xp_to_next, 1))
	_xp_bar.value = float(xp)


func _on_quest_changed(quest: Dictionary) -> void:
	if quest.is_empty():
		_quest_label.text = "庭院建设圆满完成，继续经营你的小院吧！"
	else:
		_quest_label.text = "任务：%s（+%d 金币）" % [quest["name"], int(quest["reward_coins"])]


func _on_mute_pressed() -> void:
	GameState.toggle_mute()
	_on_mute_changed()
	Juice.sfx(&"click")


func _on_mute_changed() -> void:
	_mute_button.text = "音效:关" if GameState.muted else "音效:开"


## v2 B1：帮工开关（离手 60s 自动代收；存档持久化偏好）。
func _on_helper_pressed() -> void:
	GameState.helper_enabled = not GameState.helper_enabled
	GameState.note_player_input()
	_on_helper_changed()
	Juice.sfx(&"click")


func _on_helper_changed() -> void:
	_helper_button.text = "帮工:开" if GameState.helper_enabled else "帮工:关"


func show_toast(text: String, ok: bool) -> void:
	_toast_label.text = text
	_toast_label.add_theme_color_override("font_outline_color", COL_ACCENT if ok else COL_WARN)
	_toast_label.add_theme_constant_override("outline_size", 8)
	if _toast_tween != null and _toast_tween.is_valid():
		_toast_tween.kill()
	_toast_label.modulate.a = 1.0
	_toast_tween = create_tween()
	_toast_tween.tween_interval(1.2)
	_toast_tween.tween_property(_toast_label, "modulate:a", 0.0, 0.5)


## ═══════════════ 控件小工具 ═══════════════

func _open_modal(title: String) -> void:
	_modal_title.text = title
	for child in _modal_body.get_children():
		_modal_body.remove_child(child)
		child.queue_free()


func _show_modal() -> void:
	_modal.visible = true
	_dim.visible = true
	_modal.reset_size()


func _hint(text: String) -> void:
	var label := Label.new()
	label.add_theme_font_size_override("font_size", 14)
	label.add_theme_color_override("font_color", Color(COL_TEXT, 0.75))
	label.text = text
	_modal_body.add_child(label)


func _row_button(text: String, enabled: bool) -> Button:
	var button := Button.new()
	button.text = text
	button.disabled = not enabled
	button.add_theme_font_size_override("font_size", 15)
	button.add_theme_color_override("font_color", COL_TEXT)
	var style := StyleBoxFlat.new()
	style.bg_color = Color("f3e6c8")
	style.set_corner_radius_all(12)
	style.content_margin_left = 12.0
	style.content_margin_right = 12.0
	style.content_margin_top = 8.0
	style.content_margin_bottom = 8.0
	button.add_theme_stylebox_override("normal", style)
	var hover := style.duplicate()
	hover.bg_color = Color("efdcae")
	button.add_theme_stylebox_override("hover", hover)
	button.add_theme_stylebox_override("pressed", hover)
	var disabled := style.duplicate()
	disabled.bg_color = Color("e2dccd")
	button.add_theme_stylebox_override("disabled", disabled)
	return button


func _text_button(text: String, font_size: int) -> Button:
	var button := Button.new()
	button.text = text
	button.add_theme_font_size_override("font_size", font_size)
	button.add_theme_color_override("font_color", Color("fff8ea"))
	var style := StyleBoxFlat.new()
	style.bg_color = COL_ACCENT
	style.set_corner_radius_all(12)
	style.content_margin_left = 10.0
	style.content_margin_right = 10.0
	style.content_margin_top = 6.0
	style.content_margin_bottom = 6.0
	button.add_theme_stylebox_override("normal", style)
	var hover := style.duplicate()
	hover.bg_color = COL_ACCENT.lerp(Color.WHITE, 0.18)
	button.add_theme_stylebox_override("hover", hover)
	button.add_theme_stylebox_override("pressed", hover)
	return button


func _chip_label(text: String, font_size: int, color: Color) -> Label:
	var label := Label.new()
	label.text = text
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", color)
	return label
