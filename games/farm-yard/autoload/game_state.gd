extends Node
## 经营状态机（autoload GameState）：经济、种植/养殖/加工、建造升级、订单、任务、存档。
##
## 职责边界（SKILL.md 规范）：
## - 只放「状态 + 纯逻辑」，不持有任何场景节点；表现反馈由 main.gd 订阅信号后挂 Juice；
## - 全部数值读 FarmData 配置表（spec.numeric 同步），本文件不散落经济魔数；
## - 所有计时用「剩余秒」倒计时（tick 驱动），存档保存剩余秒 —— 关页面/刷新后进度无损恢复；
## - 一切扣费走 _spend()（金币不足直接拒绝，永不为负）；一切收获先改状态再发奖励（幂等，
##   重复点击同一收获物只结算一次 —— 目标验收硬口径）。

signal coins_changed(coins: int)
signal xp_changed(level: int, xp: int, xp_to_next: int)
signal leveled_up(level: int)
signal inventory_changed
signal yards_changed
signal orders_changed
signal quest_changed(quest: Dictionary)
signal quest_completed(quest: Dictionary)
signal toast(text: String, ok: bool)

## ── 数值调参区（SKILL.md §3C）：只放「手感/节奏」键，不动经济结算口径 ──
var grow_speed: float = 1.0          # 生长/产出/加工速度倍率（调参用，1 = spec 定稿）
var day_cycle_sec: float = FarmData.DAY_CYCLE_SEC
var autosave_sec: float = 5.0

const TUNING_META: Dictionary = {
	&"grow_speed": {"min": 0.25, "max": 4.0, "step": 0.25},
	&"day_cycle_sec": {"min": 30.0, "max": 300.0, "step": 5.0},
	&"autosave_sec": {"min": 2.0, "max": 30.0, "step": 1.0},
}

## ── 核心状态 ──
var coins: int = FarmData.START_COINS
var xp: int = 0
var level: int = 1
var muted: bool = false
var play_sec: float = 0.0

## 地块/花圃：{state: "locked"|"empty"|"growing"|"mature", crop: String, remain: float, total: float}
var plots: Array[Dictionary] = []
var beds: Array[Dictionary] = []

## 果树/养殖舍/工坊/休闲设施
var trees: Dictionary = {}            # id → {built: bool, ready_in: float}
var coops: Dictionary = {}            # id → {level: int, ready_in: float, stock: int}
var workshop_built: bool = false
var workshop_level: int = 0
var crafting_recipe: String = ""
var craft_remain: float = 0.0
var fountain_level: int = 0
var swing_level: int = 0

var inventory: Dictionary = {}        # item_id → 数量
var orders: Array[Dictionary] = []
var order_seq: int = 0
var quest_index: int = 0              # 指向 FarmData.QUESTS；== size() 表示全部完成
var sold_count: int = 0

var _dirty: bool = false
var _autosave_accum: float = 0.0
var _order_rng := RandomNumberGenerator.new()


func _ready() -> void:
	if not load_game():
		new_game()
	_apply_web_tuning()


## ── 主循环推进：所有生长/产出/加工倒计时都在这里走，冒烟可直接 tick 快进 ──
func tick(delta: float) -> void:
	if delta <= 0.0:
		return
	play_sec += delta
	var speed := maxf(grow_speed, 0.05)
	for i in plots.size():
		_advance_slot(plots[i], delta * speed)
	for i in beds.size():
		_advance_slot(beds[i], delta * speed)
	for id: String in trees:
		var tree: Dictionary = trees[id]
		if tree["built"] and not tree["ready"]:
			tree["ready_in"] -= delta * speed
			if tree["ready_in"] <= 0.0:
				tree["ready_in"] = 0.0
				tree["ready"] = true
				yards_changed.emit()
	for id: String in coops:
		var coop: Dictionary = coops[id]
		if coop["level"] > 0:
			coop["ready_in"] -= delta * speed
			if coop["ready_in"] <= 0.0:
				var interval := _coop_interval(id)
				coop["ready_in"] += interval * ceilf(-coop["ready_in"] / interval)
				coop["stock"] += 1
				yards_changed.emit()
	if crafting_recipe != "":
		craft_remain -= delta * speed
		if craft_remain <= 0.0:
			craft_remain = 0.0
			_finish_craft()
	_autosave_accum += delta
	if _dirty and _autosave_accum >= autosave_sec:
		save_game()


func _advance_slot(slot: Dictionary, amount: float) -> void:
	if slot["state"] == "growing":
		slot["remain"] -= amount
		if slot["remain"] <= 0.0:
			slot["remain"] = 0.0
			slot["state"] = "mature"
			yards_changed.emit()


## ── 昼夜相位（0~1，0 = 清晨；yard_view 据此插值天色，纯视觉不改数值）──
func day_phase() -> float:
	return fmod(play_sec, day_cycle_sec) / day_cycle_sec


func _coop_interval(id: String) -> float:
	var coop: Dictionary = coops[id]
	return FarmData.COOPS[id]["interval_sec"] * FarmData.level_speed(int(coop["level"]), FarmData.COOP_SPEED_PER_LEVEL)


## ── 种植（菜园/花圃共用；金币不足拒绝、非空地块拒绝）──
func plant(index: int, crop_id: String, is_bed: bool) -> bool:
	var slots := beds if is_bed else plots
	var table := FarmData.FLOWERS if is_bed else FarmData.CROPS
	if index < 0 or index >= slots.size():
		return false
	var slot := slots[index]
	if slot["state"] == "locked":
		_notify("这块地还没开垦", false)
		return false
	if slot["state"] != "empty":
		_notify("这里已经有作物了", false)
		return false
	if not table.has(crop_id):
		return false
	var crop: Dictionary = table[crop_id]
	if not _spend(int(crop["seed_cost"]), "种子"):
		return false
	slot["state"] = "growing"
	slot["crop"] = crop_id
	slot["total"] = float(crop["grow_sec"])
	slot["remain"] = float(crop["grow_sec"])
	yards_changed.emit()
	quest_progress("plant_crop")
	_mark_dirty()
	_notify("%s 播下了%s" % ["花圃" if is_bed else "菜地", crop["name"]], true)
	return true


## ── 收获：先改状态再发奖励（幂等 —— 重复点击同一成熟物只结算一次）──
func harvest(index: int, is_bed: bool) -> bool:
	var slots := beds if is_bed else plots
	var table := FarmData.FLOWERS if is_bed else FarmData.CROPS
	if index < 0 or index >= slots.size():
		return false
	var slot := slots[index]
	if slot["state"] != "mature":
		_notify("还没成熟呢", false)
		return false
	var crop_id := String(slot["crop"])
	var crop: Dictionary = table[crop_id]
	slot["state"] = "empty"
	slot["crop"] = ""
	slot["remain"] = 0.0
	slot["total"] = 0.0
	_add_item(crop_id, 1)
	_add_xp(int(crop["xp"]))
	yards_changed.emit()
	quest_progress("harvest_crop")
	_mark_dirty()
	_notify("收获了%s" % crop["name"], true)
	return true


func harvest_tree(tree_id: String) -> bool:
	if not trees.has(tree_id):
		return false
	var tree: Dictionary = trees[tree_id]
	if not tree["built"] or not tree["ready"]:
		_notify("果子还没熟", false)
		return false
	var data: Dictionary = FarmData.TREES[tree_id]
	tree["ready"] = false
	tree["ready_in"] = float(data["cycle_sec"])
	_add_item(String(data["fruit"]), 2)
	_add_xp(int(data["xp"]))
	yards_changed.emit()
	quest_progress("harvest_crop")
	_mark_dirty()
	_notify("摘了 %d 个%s" % [2, data["fruit_name"]], true)
	return true


func collect_coop(coop_id: String) -> bool:
	if not coops.has(coop_id):
		return false
	var coop: Dictionary = coops[coop_id]
	if coop["level"] <= 0 or int(coop["stock"]) <= 0:
		_notify("还没有蛋可收", false)
		return false
	var data: Dictionary = FarmData.COOPS[coop_id]
	var taken := int(coop["stock"])
	coop["stock"] = 0
	_add_item(String(data["product"]), taken)
	_add_xp(int(data["xp"]) * taken)
	yards_changed.emit()
	_mark_dirty()
	_notify("收了 %d 个%s" % [taken, data["product_name"]], true)
	return true


func _notify(text: String, ok: bool) -> void:
	toast.emit(text, ok)


## ── 经济结算：唯一扣费/入账出口，保证金币永不为负、信号必发 ──
func _spend(cost: int, what: String = "") -> bool:
	if cost > coins:
		_notify("金币不足，还差 %d（%s）" % [cost - coins, what], false)
		return false
	coins -= cost
	coins_changed.emit(coins)
	_mark_dirty()
	return true


func _add_coins(amount: int) -> void:
	if amount <= 0:
		return
	coins += amount
	coins_changed.emit(coins)


func _add_xp(amount: int) -> void:
	if amount <= 0:
		return
	xp += amount
	var to_next := xp_to_next()
	while xp >= to_next:
		xp -= to_next
		level += 1
		_add_coins(FarmData.LEVEL_UP_COIN_REWARD + level * 5)
		leveled_up.emit(level)
		_notify("升到 %d 级！奖励 %d 金币" % [level, FarmData.LEVEL_UP_COIN_REWARD + level * 5], true)
		to_next = xp_to_next()
		if level >= 3:
			quest_progress("reach_level_3")
	xp_changed.emit(level, xp, to_next)
	_mark_dirty()


func xp_to_next() -> int:
	return FarmData.XP_TO_NEXT_BASE + FarmData.XP_TO_NEXT_STEP * (level - 1)


func _add_item(item_id: String, count: int) -> void:
	inventory[item_id] = int(inventory.get(item_id, 0)) + count
	inventory_changed.emit()


## 售价 = 基础价 ×（1 + 休闲加成%），向上取整保证不因加成丢币。
func price_of(item_id: String) -> int:
	var catalog: Dictionary = FarmData.item_catalog()
	if not catalog.has(item_id):
		return 0
	var base := int(catalog[item_id]["sell_price"])
	var bonus := FarmData.price_bonus_pct(fountain_level, swing_level)
	return int(ceil(float(base) * (1.0 + float(bonus) / 100.0)))


## ── 建造与升级（金币不足一律拒绝；等级上限 FarmData.MAX_FACILITY_LEVEL）──
func unlock_plot(index: int) -> bool:
	if index < 0 or index >= plots.size():
		return false
	if plots[index]["state"] != "locked":
		return false
	if not _spend(FarmData.PLOT_UNLOCK_COSTS[index], "开垦菜地"):
		return false
	plots[index]["state"] = "empty"
	yards_changed.emit()
	_notify("开垦了一块新菜地", true)
	return true


func unlock_bed(index: int) -> bool:
	if index < 0 or index >= beds.size():
		return false
	if beds[index]["state"] != "locked":
		return false
	if not _spend(FarmData.BED_UNLOCK_COSTS[index], "开垦花圃"):
		return false
	beds[index]["state"] = "empty"
	yards_changed.emit()
	_notify("开垦了一块新花圃", true)
	return true


func build_tree(tree_id: String) -> bool:
	if not trees.has(tree_id) or trees[tree_id]["built"]:
		return false
	var data: Dictionary = FarmData.TREES[tree_id]
	if not _spend(int(data["build_cost"]), "栽种" + String(data["name"])):
		return false
	trees[tree_id] = {"built": true, "ready": false, "ready_in": float(data["cycle_sec"])}
	yards_changed.emit()
	_notify("%s栽好了，等它结果吧" % data["name"], true)
	return true


func build_coop(coop_id: String) -> bool:
	if not coops.has(coop_id) or int(coops[coop_id]["level"]) > 0:
		return false
	var data: Dictionary = FarmData.COOPS[coop_id]
	if not _spend(int(data["build_cost"]), "建造" + String(data["name"])):
		return false
	coops[coop_id] = {"level": 1, "ready_in": float(data["interval_sec"]), "stock": 0}
	yards_changed.emit()
	_notify("%s建好了，%s们住进来啦" % [data["name"], data["product_name"].substr(0, 1)], true)
	return true


func build_workshop() -> bool:
	if workshop_built:
		return false
	if not _spend(FarmData.WORKSHOP_BUILD_COST, "建造工坊"):
		return false
	workshop_built = true
	workshop_level = 1
	yards_changed.emit()
	quest_progress("build_workshop")
	_notify("工坊开张！可以把原料加工成商品了", true)
	return true


func upgrade_workshop() -> bool:
	if not workshop_built or workshop_level >= FarmData.MAX_FACILITY_LEVEL:
		_notify("工坊已满级", false)
		return false
	if not _spend(FarmData.WORKSHOP_UPGRADE_COSTS[workshop_level - 1], "升级工坊"):
		return false
	workshop_level += 1
	yards_changed.emit()
	_notify("工坊升到 %d 级，加工提速 %d%%" % [workshop_level, int((1.0 - FarmData.CRAFT_SPEED_PER_LEVEL) * 100.0)], true)
	return true


func upgrade_coop(coop_id: String) -> bool:
	if not coops.has(coop_id) or int(coops[coop_id]["level"]) <= 0:
		return false
	var coop_level := int(coops[coop_id]["level"])
	if coop_level >= FarmData.MAX_FACILITY_LEVEL:
		_notify("已满级", false)
		return false
	if not _spend(FarmData.COOP_UPGRADE_COSTS[coop_level - 1], "升级养殖舍"):
		return false
	coops[coop_id]["level"] = coop_level + 1
	yards_changed.emit()
	_notify("升到 %d 级，产出更快了" % (coop_level + 1), true)
	return true


func upgrade_leisure(kind: String) -> bool:
	var level := fountain_level if kind == "fountain" else swing_level
	if level >= FarmData.MAX_FACILITY_LEVEL:
		_notify("已满级", false)
		return false
	if level == 0:
		# 未建造：先花建造费把 1 级建出来（1 级不加成，升级才有售价加成）
		var build_cost := FarmData.FOUNTAIN_BUILD_COST if kind == "fountain" else FarmData.SWING_BUILD_COST
		if not _spend(build_cost, "建造休闲设施"):
			return false
		if kind == "fountain":
			fountain_level = 1
		else:
			swing_level = 1
		yards_changed.emit()
		_notify("建好了！庭院更漂亮了", true)
	else:
		var costs: Array[int] = FarmData.FOUNTAIN_UPGRADE_COSTS if kind == "fountain" else FarmData.SWING_UPGRADE_COSTS
		if not _spend(costs[level - 1], "升级休闲设施"):
			return false
		if kind == "fountain":
			fountain_level += 1
		else:
			swing_level += 1
		yards_changed.emit()
		var bonus := FarmData.price_bonus_pct(fountain_level, swing_level)
		_notify("售价加成提升到 +%d%%" % bonus, true)
	_mark_dirty()
	return true


## ── 工坊加工：原料校验（不扣负库存）、加工中不可重复下单 ──
func craft_available(recipe_id: String) -> bool:
	if not RECIPES_HAS(recipe_id):
		return false
	var recipe: Dictionary = FarmData.RECIPES[recipe_id]
	for item_id: String in recipe["inputs"]:
		if int(inventory.get(item_id, 0)) < int(recipe["inputs"][item_id]):
			return false
	return true


func RECIPES_HAS(recipe_id: String) -> bool:
	return FarmData.RECIPES.has(recipe_id)


func start_craft(recipe_id: String) -> bool:
	if not workshop_built:
		_notify("先建造工坊才能加工", false)
		return false
	if crafting_recipe != "":
		_notify("工坊正在加工中", false)
		return false
	if not craft_available(recipe_id):
		_notify("原料不够，先去收获一些吧", false)
		return false
	var recipe: Dictionary = FarmData.RECIPES[recipe_id]
	for item_id: String in recipe["inputs"]:
		inventory[item_id] = int(inventory.get(item_id, 0)) - int(recipe["inputs"][item_id])
	inventory_changed.emit()
	crafting_recipe = recipe_id
	craft_remain = float(recipe["craft_sec"]) * FarmData.level_speed(workshop_level, FarmData.CRAFT_SPEED_PER_LEVEL)
	yards_changed.emit()
	_mark_dirty()
	_notify("开始制作%s" % recipe["name"], true)
	return true


func _finish_craft() -> void:
	var recipe: Dictionary = FarmData.RECIPES[crafting_recipe]
	crafting_recipe = ""
	_add_item(String(recipe["output"]), 1)
	_add_xp(int(recipe["xp"]))
	yards_changed.emit()
	quest_progress("craft_bread")
	_mark_dirty()
	_notify("%s出炉了！" % recipe["output_name"], true)


## ── 集市出售：库存校验 + 一次性结算（重复点击走新一次校验，不会负库存）──
func sell_item(item_id: String, count: int) -> bool:
	var have := int(inventory.get(item_id, 0))
	if count <= 0 or have <= 0:
		_notify("没有可出售的%s" % _item_name(item_id), false)
		return false
	var sold := mini(count, have)
	var unit := price_of(item_id)
	inventory[item_id] = have - sold
	inventory_changed.emit()
	var total := unit * sold
	_add_coins(total)
	_add_xp(1 + sold / 2)
	sold_count += sold
	quest_progress("sell_item")
	_mark_dirty()
	_notify("卖出 %d 个%s，+%d 金币" % [sold, _item_name(item_id), total], true)
	return true


func _item_name(item_id: String) -> String:
	var catalog: Dictionary = FarmData.item_catalog()
	return String(catalog[item_id]["name"]) if catalog.has(item_id) else item_id


## ── 订单：需求全部满足才可交付；交付即移除并补一张新订单（防重复领取）──
func deliver_order(order_index: int) -> bool:
	if order_index < 0 or order_index >= orders.size():
		return false
	var order := orders[order_index]
	for item_id: String in order["needs"]:
		if int(inventory.get(item_id, 0)) < int(order["needs"][item_id]):
			_notify("订单还缺 %s×%d" % [_item_name(item_id), int(order["needs"][item_id]) - int(inventory.get(item_id, 0))], false)
			return false
	for item_id: String in order["needs"]:
		inventory[item_id] = int(inventory.get(item_id, 0)) - int(order["needs"][item_id])
	inventory_changed.emit()
	_add_coins(int(order["reward_coins"]))
	_add_xp(int(order["reward_xp"]))
	orders.remove_at(order_index)
	orders.append(_make_order())
	orders_changed.emit()
	quest_progress("deliver_order")
	_mark_dirty()
	_notify("订单交付！+%d 金币 +%d 经验" % [int(order["reward_coins"]), int(order["reward_xp"])], true)
	return true


func order_progress(order: Dictionary) -> Dictionary:
	var progress: Dictionary = {}
	for item_id: String in order["needs"]:
		progress[item_id] = {"need": int(order["needs"][item_id]), "have": int(inventory.get(item_id, 0))}
	return progress


func _make_order() -> Dictionary:
	order_seq += 1
	_order_rng.seed = hash("order-%d" % order_seq)
	var catalog: Dictionary = FarmData.item_catalog()
	var kinds := _order_rng.randi_range(1, 2)
	var needs: Dictionary = {}
	var base := 0
	var total_qty := 0
	for i in kinds:
		var item_id: String = FarmData.ORDER_ITEM_POOL[_order_rng.randi_range(0, FarmData.ORDER_ITEM_POOL.size() - 1)]
		if needs.has(item_id):
			continue
		var qty := _order_rng.randi_range(1, 3)
		needs[item_id] = qty
		base += int(catalog[item_id]["sell_price"]) * qty
		total_qty += qty
	return {
		"id": order_seq,
		"needs": needs,
		"reward_coins": int(ceil(float(base) * FarmData.ORDER_PRICE_FACTOR)) + FarmData.ORDER_BONUS_COINS,
		"reward_xp": FarmData.ORDER_BASE_XP + 2 * total_qty,
	}


## ── 任务链：当前阶段命中事件即完成并发放奖励，推进到下一阶段 ──
func current_quest() -> Dictionary:
	if quest_index >= FarmData.QUESTS.size():
		return {}
	return FarmData.QUESTS[quest_index]


func quest_progress(target: String) -> void:
	var quest := current_quest()
	if quest.is_empty() or String(quest["target"]) != target:
		return
	_add_coins(int(quest["reward_coins"]))
	if int(quest["reward_xp"]) > 0:
		_add_xp(int(quest["reward_xp"]))
	quest_index += 1
	quest_completed.emit(quest)
	quest_changed.emit(current_quest())
	_mark_dirty()


func toggle_mute() -> bool:
	muted = not muted
	_mark_dirty()
	return muted


## ── 新局初始化：苹果树与鸡舍初始就有（保证五大区域开局即有可交互对象），订单发 3 张 ──
func new_game() -> void:
	coins = FarmData.START_COINS
	xp = 0
	level = 1
	muted = false
	play_sec = 0.0
	inventory = {}
	order_seq = 0
	quest_index = 0
	sold_count = 0
	plots = []
	for i in FarmData.PLOT_COUNT:
		plots.append(_slot("locked" if FarmData.PLOT_UNLOCK_COSTS[i] > 0 else "empty"))
	beds = []
	for i in FarmData.BED_COUNT:
		beds.append(_slot("locked" if FarmData.BED_UNLOCK_COSTS[i] > 0 else "empty"))
	trees = {}
	for id: String in FarmData.TREES:
		var built := int(FarmData.TREES[id]["build_cost"]) == 0
		trees[id] = {"built": built, "ready": false, "ready_in": float(FarmData.TREES[id]["cycle_sec"])}
	coops = {}
	for id: String in FarmData.COOPS:
		var built := int(FarmData.COOPS[id]["build_cost"]) == 0
		coops[id] = {"level": 1 if built else 0, "ready_in": float(FarmData.COOPS[id]["interval_sec"]), "stock": 0}
	workshop_built = false
	workshop_level = 0
	crafting_recipe = ""
	craft_remain = 0.0
	fountain_level = 0
	swing_level = 0
	orders = []
	for i in FarmData.ACTIVE_ORDER_COUNT:
		orders.append(_make_order())
	_emit_all()


func _slot(state: String) -> Dictionary:
	return {"state": state, "crop": "", "remain": 0.0, "total": 0.0}


func _emit_all() -> void:
	coins_changed.emit(coins)
	xp_changed.emit(level, xp, xp_to_next())
	inventory_changed.emit()
	yards_changed.emit()
	orders_changed.emit()
	quest_changed.emit(current_quest())


## ── 存档：JSON 落 user://（Web 导出持久化到浏览器 IndexedDB，刷新/重开不丢）──
## 生长类字段存「剩余秒」而非时间戳，关页面多久都不影响进度正确性。
func save_game() -> bool:
	_autosave_accum = 0.0
	_dirty = false
	var data: Dictionary = {
		"version": FarmData.SAVE_VERSION,
		"coins": coins,
		"xp": xp,
		"level": level,
		"muted": muted,
		"play_sec": play_sec,
		"plots": plots,
		"beds": beds,
		"trees": trees,
		"coops": coops,
		"workshop_built": workshop_built,
		"workshop_level": workshop_level,
		"crafting_recipe": crafting_recipe,
		"craft_remain": craft_remain,
		"fountain_level": fountain_level,
		"swing_level": swing_level,
		"inventory": inventory,
		"orders": orders,
		"order_seq": order_seq,
		"quest_index": quest_index,
		"sold_count": sold_count,
	}
	var file := FileAccess.open(FarmData.SAVE_PATH, FileAccess.WRITE)
	if file == null:
		return false
	file.store_string(JSON.stringify(data))
	file.flush()
	return true


func has_save() -> bool:
	return FileAccess.file_exists(FarmData.SAVE_PATH)


func load_game() -> bool:
	if not has_save():
		return false
	var file := FileAccess.open(FarmData.SAVE_PATH, FileAccess.READ)
	if file == null:
		return false
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	if not (parsed is Dictionary):
		return false
	var data: Dictionary = parsed
	if int(data.get("version", -1)) != FarmData.SAVE_VERSION:
		return false
	coins = int(data.get("coins", FarmData.START_COINS))
	xp = int(data.get("xp", 0))
	level = maxi(int(data.get("level", 1)), 1)
	muted = bool(data.get("muted", false))
	play_sec = float(data.get("play_sec", 0.0))
	plots = _load_slots(data.get("plots"), FarmData.PLOT_COUNT)
	beds = _load_slots(data.get("beds"), FarmData.BED_COUNT)
	trees = _load_table(data.get("trees"), ["built", "ready", "ready_in"])
	coops = _load_table(data.get("coops"), ["level", "ready_in", "stock"])
	workshop_built = bool(data.get("workshop_built", false))
	workshop_level = int(data.get("workshop_level", 0))
	crafting_recipe = String(data.get("crafting_recipe", ""))
	if crafting_recipe != "" and not FarmData.RECIPES.has(crafting_recipe):
		crafting_recipe = ""
	craft_remain = float(data.get("craft_remain", 0.0))
	fountain_level = int(data.get("fountain_level", 0))
	swing_level = int(data.get("swing_level", 0))
	inventory = {}
	var saved_inventory: Variant = data.get("inventory")
	if saved_inventory is Dictionary:
		for item_id: String in saved_inventory:
			var count := int(saved_inventory[item_id])
			if count > 0:
				inventory[item_id] = count
	orders = []
	var saved_orders: Variant = data.get("orders")
	if saved_orders is Array:
		for order: Variant in saved_orders:
			if order is Dictionary and (order as Dictionary).has("needs"):
				orders.append(order)
	order_seq = int(data.get("order_seq", orders.size()))
	quest_index = clampi(int(data.get("quest_index", 0)), 0, FarmData.QUESTS.size())
	sold_count = int(data.get("sold_count", 0))
	_emit_all()
	return true


func _load_slots(raw: Variant, expected: int) -> Array[Dictionary]:
	var slots: Array[Dictionary] = []
	var raw_array: Array = raw if raw is Array else []
	for i in expected:
		var entry: Variant = raw_array[i] if i < raw_array.size() else null
		if entry is Dictionary and (entry as Dictionary).has("state"):
			var slot: Dictionary = entry
			if not FarmData.CROPS.has(slot.get("crop")) and not FarmData.FLOWERS.has(slot.get("crop")):
				slot["crop"] = ""
			slots.append(slot)
		else:
			slots.append(_slot("locked"))
	return slots


func _load_table(raw: Variant, keys: Array) -> Dictionary:
	var table: Dictionary = {}
	var raw_dict: Dictionary = raw if raw is Dictionary else {}
	for id: String in raw_dict:
		if raw_dict[id] is Dictionary:
			table[id] = raw_dict[id]
	for id: String in table:
		for key: String in keys:
			if not table[id].has(key):
				return {}
	return table


func _mark_dirty() -> void:
	_dirty = true


## 页面关闭 / 切后台时立即落盘（Web 端切后台是常态，不能只靠周期 autosave）。
func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_CLOSE_REQUEST or what == NOTIFICATION_APPLICATION_PAUSED:
		if _dirty:
			save_game()


## ── 调参工作台（SKILL.md §3C）：只认 TUNING_META 声明的键、按 min/max 钳制 ──
func apply_tuning(overrides: Dictionary) -> PackedStringArray:
	var applied := PackedStringArray()
	for key: String in overrides:
		var meta: Dictionary = TUNING_META.get(StringName(key), {})
		if meta.is_empty() or get(key) == null:
			continue
		var raw: Variant = overrides[key]
		if not (raw is float or raw is int):
			continue
		set(key, clampf(float(raw), meta["min"], meta["max"]))
		applied.append(key)
	return applied


## Web 调参桥读入：壳页面在引擎加载前把 URL ?tuning=<JSON> 解析到 window.__GAME_TUNING__。
## 桌面/无头环境桥不工作（eval 恒为 null），自动跳过 —— 冒烟不受影响。
func _apply_web_tuning() -> void:
	if not Engine.has_singleton("JavaScriptBridge"):
		return
	var bridge: Object = Engine.get_singleton("JavaScriptBridge")
	var result: Variant = bridge.call("eval", "JSON.stringify(window.__GAME_TUNING__ || null)")
	if result == null:
		return
	var raw := str(result)
	if raw.is_empty() or raw == "null":
		return
	var parsed: Variant = JSON.parse_string(raw)
	if parsed is Dictionary:
		apply_tuning(parsed)
