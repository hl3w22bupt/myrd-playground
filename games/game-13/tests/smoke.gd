extends Node
## 无头冒烟自检（headless smoke）——《测试预算边界》门禁二的机器判定层。
##
## 运行方式（由 tools/gates/gate2_smoke_check.sh 封装）：
##   godot --headless --path games/game-13 tests/smoke.tscn
##
## 判定协议（gate 脚本按此断言退出码与日志）：
##   通过 → stdout 打印 `GODOT_SMOKE: PASS ...`，进程退出码 0
##   失败 → stdout 打印 `GODOT_SMOKE: FAIL <原因>`（逐条），进程退出码 1
##
## 覆盖面（对应需求验收 2/4 与 spec acceptance 的 acc-*）：
##   1. 主场景可实例化并直接进入休闲收集玩法（状态机 BOOT → PLAYING）
##   2. InputMap 动作齐全（collect_click / pause / restart）
##   3. 核心收集循环：真实注入鼠标事件 → 收集 → 计数 +1、预算 -1、HUD 实时刷新、消散动画启动
##   4. 误触计费：点空处扣 1 点预算
##   5. 边界三分支：CLEARED（集齐且剩余>0，2 星）/ PERFECT（集齐且剩余==0，3 星）/ FAILED（归零未集齐）
##   6. 暂停-继续与进度持久化（存档 → 新实例按快照还原）

const CLICK_WAIT: float = 0.16          # > CLICK_COOLDOWN_MS(120ms)
const SETTLE_WAIT: float = 1.1          # > SETTLE_DELAY_SECONDS(0.6s)

var _failures: PackedStringArray = []


func _ready() -> void:
	Engine.max_fps = 60
	SaveStore.clear_progress()
	_run()


func _run() -> void:
	await _test_boot_and_input_map()
	await _test_collect_loop_and_misclick()
	await _test_boundary_cleared()
	await _test_boundary_perfect()
	await _test_boundary_failed()
	await _test_pause_and_persistence()
	_report()


# ── 断言工具 ───────────────────────────────────────────────────────────

func _check(condition: bool, message: String) -> void:
	if not condition:
		_failures.append(message)
		print("  ✗ %s" % message)
	else:
		print("  ✓ %s" % message)


func _click(level: GameLevel, world_pos: Vector2) -> void:
	await _tap_at(level, world_pos, true)
	await _tap_at(level, world_pos, false)
	await _wait(CLICK_WAIT)


func _tap_at(level: GameLevel, world_pos: Vector2, pressed: bool) -> void:
	# headless 的窗口→视口变换不是恒等（DisplayServer 窗口尺寸为 0），
	# 事件 position 会被引擎按 get_screen_transform() 的逆变换换算 —— 所以注入前先正向变换。
	var screen_pos: Vector2 = level.get_viewport().get_screen_transform() * world_pos
	var event := InputEventMouseButton.new()
	event.button_index = MOUSE_BUTTON_LEFT
	event.pressed = pressed
	event.position = screen_pos
	event.global_position = screen_pos
	Input.parse_input_event(event)
	Input.flush_buffered_events()
	await _wait(0.02)


func _wait(seconds: float) -> void:
	await get_tree().create_timer(seconds).timeout


func _entities(level: GameLevel) -> Array[Node2D]:
	var result: Array[Node2D] = []
	for child in level.get_node("Entities").get_children():
		var node := child as Node2D
		if node != null:
			result.append(node)
	return result


func _stars_of(level: GameLevel) -> Array[CollectibleStar]:
	var result: Array[CollectibleStar] = []
	for node in _entities(level):
		if node is CollectibleStar:
			result.append(node)
	return result


func _rocks_of(level: GameLevel) -> Array[DecoyRock]:
	var result: Array[DecoyRock] = []
	for node in _entities(level):
		if node is DecoyRock:
			result.append(node)
	return result


func _spawn_level(path: String) -> GameLevel:
	var packed: PackedScene = load(path)
	var level := packed.instantiate() as GameLevel
	add_child(level)
	await _wait(0.05)
	return level


## 主场景与关卡实例都可能是 Node2D 派生（main.gd 不是 GameLevel），参数放宽到 Node。
func _drop_level(node: Node) -> void:
	remove_child(node)
	node.free()
	await _wait(0.02)


# ── 用例 ───────────────────────────────────────────────────────────────

func _test_boot_and_input_map() -> void:
	print("· 用例 1：主场景启动 + InputMap")
	for action in [&"collect_click", &"pause", &"restart"]:
		_check(InputMap.has_action(action), "InputMap 已注册动作 %s" % action)

	var main_scene: Node = (load("res://scenes/main.tscn") as PackedScene).instantiate()
	add_child(main_scene)
	await _wait(0.1)
	var level: GameLevel = main_scene.get("current_level")
	_check(level != null, "主场景已装配关卡（main.current_level 非空）")
	if level == null:
		main_scene.free()
		return
	_check(level.machine.state == GameStateMachine.State.PLAYING,
		"启动后状态机已进入 PLAYING（实际 %s）" % GameStateMachine.State.keys()[level.machine.state])
	_check(_stars_of(level).size() == 6, "第 1 关已铺 6 枚星光结晶（实际 %d 枚）" % _stars_of(level).size())
	var budget_text: String = level.get_node("UI/BudgetMeter").text
	var counter_text: String = level.get_node("UI/CollectCounter").text
	_check(budget_text.contains("8"), "预算 HUD 已显示初始预算 8（实际「%s」）" % budget_text)
	_check(counter_text.contains("0 / 6"), "计数 HUD 已显示目标 6（实际「%s」）" % counter_text)
	_check(level.get_node("UI/Hint").text.length() > 4, "教学提示非空（休闲定位零学习成本引导）")
	_drop_level(main_scene)


func _test_collect_loop_and_misclick() -> void:
	print("· 用例 2：核心收集循环 + 误触计费")
	var level := await _spawn_level("res://scenes/levels/level_01.tscn")
	var stars := _stars_of(level)
	var hud: HudCollectCounter = level.get_node("UI/CollectCounter")
	var budget_hud: HudBudgetMeter = level.get_node("UI/BudgetMeter")

	await _click(level, stars[0].position)
	_check(level.collected == 1, "点击结晶后计数 +1（实际 %d）" % level.collected)
	_check(level.ledger.remaining == 7, "收集后预算 -1 变 7（实际 %d）" % level.ledger.remaining)
	_check(stars[0].is_consumed(), "被收集的结晶已标记消散")
	_check(hud.text.contains("1 / 6"), "计数 HUD 已实时刷新（实际「%s」）" % hud.text)
	_check(budget_hud.text.contains("7"), "预算 HUD 已实时刷新（实际「%s」）" % budget_hud.text)

	# 误触：点击远离所有实体的空处（扣 1 点预算，不计收集）
	await _click(level, Vector2(620, 20))
	_check(level.ledger.remaining == 6, "点空处误触扣 1 点预算（实际剩余 %d）" % level.ledger.remaining)
	_check(level.collected == 1, "误触不计入收集（实际 %d）" % level.collected)
	_drop_level(level)


func _test_boundary_cleared() -> void:
	print("· 用例 3：边界分支 CLEARED（集齐且剩余 > 0 → 2 星）")
	var level := await _spawn_level("res://scenes/levels/level_01.tscn")
	for star in _stars_of(level):
		if star.is_consumed():
			continue
		await _click(level, star.position)
	await _wait(SETTLE_WAIT)
	_check(level.outcome == "CLEARED", "集齐且剩余>0 结算为 CLEARED（实际 %s）" % level.outcome)
	_check(level.stars == 2, "CLEARED 给 2 星（实际 %d 星）" % level.stars)
	_check(level.machine.state == GameStateMachine.State.CLEARED, "状态机已到 CLEARED（实际 %s）"
		% GameStateMachine.State.keys()[level.machine.state])
	var panel: SettlementPanel = level.get_node("UI/SettlementPanel")
	_check(panel.visible, "结算面板已出现（完成反馈）")
	_drop_level(level)


## 等结算延迟（0.6s）结束，让状态机落到终态、结算面板出得来。
func _settlement_after() -> void:
	await _wait(SETTLE_WAIT)


func _test_boundary_perfect() -> void:
	print("· 用例 4：边界分支 PERFECT（集齐且剩余 == 0 → 3 星）")
	var level := await _spawn_level("res://scenes/levels/level_03.tscn")
	_check(_stars_of(level).size() == 8 and _rocks_of(level).size() == 2,
		"第 3 关布点为 8 结晶 + 2 诱饵石")
	for star in _stars_of(level):
		if star.is_consumed():
			continue
		await _click(level, star.position)
	await _settlement_after()
	_check(level.collected == 8, "PERFECT 路线收满 8（实际 %d）" % level.collected)
	_check(level.ledger.remaining == 0, "PERFECT 路线预算恰好归零（实际 %d）" % level.ledger.remaining)
	_check(level.outcome == "PERFECT", "集齐且预算归零结算为 PERFECT（实际 %s）" % level.outcome)
	_check(level.stars == 3, "PERFECT 给 3 星（实际 %d 星）" % level.stars)
	_drop_level(level)


func _test_boundary_failed() -> void:
	print("· 用例 5：边界分支 FAILED（归零未集齐 → 0 星）")
	var level := await _spawn_level("res://scenes/levels/level_03.tscn")
	var rocks := _rocks_of(level)
	_check(rocks.size() == 2, "第 3 关已铺 2 块诱饵石（实际 %d 块）" % rocks.size())
	await _click(level, rocks[0].position)   # 误触诱饵石：扣 1 不计目标 → 预算 7
	_check(level.ledger.remaining == 7, "点诱饵石扣 1 点预算（实际剩余 %d）" % level.ledger.remaining)
	_check(level.collected == 0, "诱饵石不计入收集（实际 %d）" % level.collected)
	for star in _stars_of(level):
		if star.is_consumed():
			continue
		if level.machine.is_settled() or level.machine.state == GameStateMachine.State.SETTLING:
			break
		await _click(level, star.position)
	await _settlement_after()
	_check(level.outcome == "FAILED", "预算归零仍未集齐应 FAILED（实际 %s，收集 %d/8 预算 %d）"
		% [level.outcome, level.collected, level.ledger.remaining])
	_check(level.stars == 0, "FAILED 给 0 星（实际 %d 星）" % level.stars)
	var panel: SettlementPanel = level.get_node("UI/SettlementPanel")
	_check(panel.visible, "FAILED 已给出明确结算反馈")
	_drop_level(level)


func _test_pause_and_persistence() -> void:
	print("· 用例 6：暂停/继续 + 进度持久化")
	SaveStore.clear_progress()
	var level := await _spawn_level("res://scenes/levels/level_01.tscn")
	await _click(level, _stars_of(level)[0].position)
	level.pause_game()
	await _wait(0.05)
	_check(level.machine.state == GameStateMachine.State.PAUSED, "暂停后状态机为 PAUSED")
	_check(get_tree().paused, "暂停后场景树已冻结")
	_check(level.get_node("UI/PauseOverlay").visible, "暂停层已显示")
	level.resume_from_pause()
	await _wait(0.05)
	_check(not get_tree().paused, "继续后场景树已恢复")
	_check(level.machine.state == GameStateMachine.State.PLAYING, "继续后回到 PLAYING")

	var saved: Dictionary = SaveStore.load_progress()
	_check(not saved.is_empty(), "暂停时已写入存档")
	_check(int(saved.get("collected", -1)) == 1 and int(saved.get("remaining_budget", -1)) == 7,
		"存档记录 收集1/预算7（实际 %s）" % str(saved))

	# 新实例按快照还原（「随时退出并保留本轮收集进度」）
	var again := (load("res://scenes/levels/level_01.tscn") as PackedScene).instantiate() as GameLevel
	again.restore_payload = saved
	add_child(again)
	await _wait(0.05)
	_check(again.collected == 1, "重进后收集进度还原为 1（实际 %d）" % again.collected)
	_check(again.ledger.remaining == 7, "重进后剩余预算还原为 7（实际 %d）" % again.ledger.remaining)
	_check(_stars_of(again).size() == 5, "重进后场上只剩 5 枚结晶（实际 %d 枚）" % _stars_of(again).size())
	_drop_level(again)
	_drop_level(level)
	SaveStore.clear_progress()


func _report() -> void:
	if _failures.is_empty():
		print("GODOT_SMOKE: PASS 启动/输入/收集循环/边界三分支/暂停存档 全部通过")
		get_tree().quit(0)
	else:
		print("GODOT_SMOKE: FAIL 共 %d 项未通过" % _failures.size())
		get_tree().quit(1)
