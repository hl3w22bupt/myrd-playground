extends Node
## 《牛牛打游戏》无头冒烟自检（headless smoke）—— 机器可判定的「游戏能不能跑、玩得动」。
##
## 运行方式（由 scripts/smoke.sh 封装）：
##   godot --headless --path <工程目录> --quit-after <FRAMES> tests/smoke.tscn
##
## 判定协议（smoke.sh 按此断言退出码与日志）：
##   通过 → stdout 打印 `GODOT_SMOKE: PASS ...`，进程退出码 0
##   失败 → stderr 打印 `GODOT_SMOKE: FAIL <原因>`（每条一行），进程退出码 1
##
## 覆盖面（模板五项断言逐项保留 + 收集玩法四项新增）：
##   1. 场景可实例化（main.tscn → player.tscn / collectible.tscn 接线未断裂）
##   2. autoload 已注册且带约定信号
##   3. InputMap 动作已注册、物理键绑定正确（键位契约），注入输入后牛牛真的动了
##   4. 信号真的到达订阅方（Player.moved / GameState.score_changed）
##   5. 收集判定：触碰后物品消失且计数 +1（需求验收基线 2）
##   6. 通关可达：计数达标 → phase=WON 且结算面板弹出（验收基线 3）
##   7. 失败可达：限时归零 → phase=LOST 且结算面板弹出（验收基线 3）
##   8. 一键重开：结算后按确认 → 计数/时限/位置/面板全部复位（验收基线 3）
##   9. 持久化：最高分与累计进度落盘后回读一致（验收基线 4）
##
## ⚠️ 输入注入分阶段互不重叠（references/error-signatures.md E-08）：
##   `Input.action_press()` 与 `Input.parse_input_event()` 同帧混用会互相冲掉，必须分帧。

## ── 噪声相位：确定种子对抗输入（悬挂手势/孤儿释放/乱键），断言仍全过 = 输入管线没被楔死 ──
const NOISE_FRAMES: int = 30
## 阶段一：按住 move_right 让牛牛移动的帧数。
const MOVE_FRAMES: int = 10
## 阶段二：传送到收集物上后等待 area_entered 的帧数。
const COLLECT_FRAMES: int = 8
## 阶段三：等待生成器补充刷新的帧数上限（SPAWN_INTERVAL=0.8s ≈ 48 物理帧，留余量）。
const RESPAWN_MAX_FRAMES: int = 90
## 注入 confirm 后等待结算/重开生效的帧数。
const SETTLE_FRAMES: int = 4
## 限时归零后等待 LOST 判定的帧数。
const LOSE_FRAMES: int = 6
## 整体帧预算兜底（超过直接判失败，防死循环；smoke.sh 另有 --quit-after 兜底）。
const TOTAL_FRAME_BUDGET: int = 600
## 判定「真的移动了」的最小位移（像素）。
const MIN_MOVE_DISTANCE: float = 1.0

const REQUIRED_ACTIONS: Array[StringName] = [
	&"move_left", &"move_right", &"move_up", &"move_down", &"confirm",
]

## 键位契约：动作 → 键表承诺的物理键，必须全部绑定（逐键 AND，见模板注释）。
const KEY_CONTRACT: Dictionary = {
	&"move_left": [KEY_A, KEY_LEFT],
	&"move_right": [KEY_D, KEY_RIGHT],
	&"move_up": [KEY_W, KEY_UP],
	&"move_down": [KEY_S, KEY_DOWN],
	&"confirm": [KEY_SPACE, KEY_ENTER],
}

## 冒烟阶段状态机。
enum SmokePhase {
	NOISE, MOVE, COLLECT, RESPAWN, WIN_CHECK, WIN_SETTLE, RESTART, LOSE, RESTART2, PERSIST, DONE,
}

var _failures: PackedStringArray = []
var _phase: SmokePhase = SmokePhase.NOISE
var _phase_frames: int = 0
var _total_frames: int = 0
var _finished: bool = false
var _player: Player
var _origin: Vector2 = Vector2.ZERO
var _collect_target: Collectible
var _moved_seen: bool = false
var _score_seen: bool = false

## 噪声相位：确定种子随机事件（原始事件，不含 InputEventAction）。
var _noise_rng := RandomNumberGenerator.new()


func _ready() -> void:
	# headless 无垂直同步：限 60 FPS 让 process 帧 : 物理帧 ≈ 1:1，--quit-after 兜底才有意义。
	Engine.max_fps = 60

	for action in REQUIRED_ACTIONS:
		if not InputMap.has_action(action):
			_failures.append("InputMap 缺少动作 %s（project.godot [input] 未注册）" % action)
	_check_key_bindings()

	var game_state := get_tree().root.get_node_or_null("GameState")
	if game_state == null:
		_failures.append("autoload GameState 未注册（project.godot [autoload] 缺失）")
	elif not game_state.has_signal("score_changed"):
		_failures.append("autoload GameState 缺少信号 score_changed")
	else:
		game_state.score_changed.connect(_on_score_changed)

	_player = get_tree().root.find_child("Player", true, false) as Player
	if _player == null:
		_failures.append("场景树找不到 Player（main.tscn 未实例化 player.tscn，或实例名不是 Player）")
	else:
		_player.moved.connect(_on_player_moved)
		_origin = _player.global_position


func _physics_process(_delta: float) -> void:
	if _finished:
		return
	_total_frames += 1
	_phase_frames += 1
	if _total_frames > TOTAL_FRAME_BUDGET:
		_failures.append("冒烟阶段 %s 超过 %d 帧未完成（阶段推进卡死）" % [
			SmokePhase.keys()[_phase], TOTAL_FRAME_BUDGET,
		])
		_report()
		return

	if _failures.is_empty():
		_advance_phase()

	if not _failures.is_empty():
		_finished = true
		_report()


## 阶段状态机：每个阶段「进入时布置、满足条件后迁移」，全部走真实场景与真实输入。
func _advance_phase() -> void:
	match _phase:
		SmokePhase.NOISE:
			_inject_noise_frame()
			if _phase_frames >= NOISE_FRAMES:
				_to_phase(SmokePhase.MOVE)
		SmokePhase.MOVE:
			if _phase_frames == 1:
				Input.action_press(&"move_right")
			elif _phase_frames > MOVE_FRAMES:
				Input.action_release(&"move_right")
				_assert_player_moved()
				_teleport_onto_collectible()
				_to_phase(SmokePhase.COLLECT)
		SmokePhase.COLLECT:
			if _phase_frames >= COLLECT_FRAMES:
				_assert_collected()
				_to_phase(SmokePhase.RESPAWN)
		SmokePhase.RESPAWN:
			if _collectible_count() >= GameState.MAX_COLLECTIBLES:
				_to_phase(SmokePhase.WIN_CHECK)
			elif _phase_frames >= RESPAWN_MAX_FRAMES:
				_failures.append("生成器未在 %d 帧内把可收集物补充到 %d 个（SpawnTimer 未接线或未启动）" % [
					RESPAWN_MAX_FRAMES, GameState.MAX_COLLECTIBLES,
				])
		SmokePhase.WIN_CHECK:
			# 通关可达：把计数推到目标值（真实判定路径：add_score → WON）。
			while GameState.score < GameState.TARGET_SCORE:
				GameState.add_score(1)
			_to_phase(SmokePhase.WIN_SETTLE)
		SmokePhase.WIN_SETTLE:
			if _phase_frames >= SETTLE_FRAMES:
				_assert_settled(true)
				_press_action(&"confirm")
				_to_phase(SmokePhase.RESTART)
		SmokePhase.RESTART:
			if _phase_frames >= SETTLE_FRAMES:
				_assert_restarted()
				# 失败可达：把剩余时间压到即刻归零（真实判定路径：tick_time → LOST）。
				GameState.time_left = 0.02
				_to_phase(SmokePhase.LOSE)
		SmokePhase.LOSE:
			if _phase_frames >= LOSE_FRAMES:
				_assert_settled(false)
				_press_action(&"confirm")
				_to_phase(SmokePhase.RESTART2)
		SmokePhase.RESTART2:
			if _phase_frames >= SETTLE_FRAMES:
				_assert_restarted()
				_to_phase(SmokePhase.PERSIST)
		SmokePhase.PERSIST:
			_assert_persistence_roundtrip()
			_to_phase(SmokePhase.DONE)
		SmokePhase.DONE:
			_report()


func _to_phase(next_phase: SmokePhase) -> void:
	_phase = next_phase
	_phase_frames = 0


## 把牛牛瞬移到一个可收集物上，触发真实的 Area2D 重叠 → 收集判定。
func _teleport_onto_collectible() -> void:
	if _player == null:
		return
	var container := get_tree().root.find_child("Collectibles", true, false)
	if container == null:
		_failures.append("场景树找不到 Collectibles 容器（main.tscn 缺少生成器容器节点）")
		return
	for child in container.get_children():
		var collectible := child as Collectible
		if collectible != null:
			_collect_target = collectible
			_player.global_position = collectible.global_position
			return
	_failures.append("场上没有任何可收集物（collectible.tscn 未被生成器实例化）")


func _assert_player_moved() -> void:
	if _player == null:
		return
	var travelled: float = _player.global_position.distance_to(_origin)
	if travelled < MIN_MOVE_DISTANCE:
		_failures.append(
			"牛牛 %d 帧内位移 %.2fpx < %.2fpx：InputMap 动作未生效或 _physics_process 未驱动 velocity" % [
				MOVE_FRAMES, travelled, MIN_MOVE_DISTANCE,
			]
		)


func _assert_collected() -> void:
	if not _score_seen:
		_failures.append("收集判定未生效：触碰后 GameState.score_changed 未到达订阅方（PickupArea 分组/碰撞层或 Collectible 接线断裂）")
	if GameState.score < 1:
		_failures.append("收集计数未 +1：触碰可收集物后 score=%d（验收基线 2：计数与判定必须一致）" % GameState.score)
	if _collect_target != null and is_instance_valid(_collect_target):
		_failures.append("被收集的物品没有消失：触碰后 Collectible 仍在场景树（回收逻辑未执行）")


func _assert_settled(expect_win: bool) -> void:
	var expected_phase: int = GameState.Phase.WON if expect_win else GameState.Phase.LOST
	if GameState.phase != expected_phase:
		_failures.append("胜负判定不可达：预期 phase=%s 实际 %s（add_score/tick_time 判定路径断裂）" % [
			"WIN" if expect_win else "LOST", _phase_label(GameState.phase),
		])
	var panel := _result_panel()
	if panel == null or not panel.visible:
		_failures.append("%s 后结算面板未弹出（ResultPanel 未随 phase_changed 显示）" % [
			"通关" if expect_win else "限时归零",
		])
	var label := _result_label()
	if label != null and expect_win and not label.text.contains("通关"):
		_failures.append("结算面板文案缺少「通关」（ResultLabel 未随胜利刷新）")
	if label != null and not expect_win and not label.text.contains("时间到"):
		_failures.append("结算面板文案缺少「时间到」（ResultLabel 未随失败刷新）")


func _assert_restarted() -> void:
	if GameState.phase != GameState.Phase.RUNNING:
		_failures.append("一键重开未生效：确认键后 phase=%s（_restart_run 未被触发或 start_run 未复位）" % _phase_label(GameState.phase))
	if GameState.score != 0:
		_failures.append("一键重开未清零计数：score=%d（验收基线 3：重开必须复位）" % GameState.score)
	if GameState.time_left < GameState.TIME_LIMIT - 1.0:
		_failures.append("一键重开未复位时限：time_left=%.2f（start_run 未恢复 TIME_LIMIT）" % GameState.time_left)
	if _player != null and _player.global_position.distance_to(_origin) > 1.0:
		_failures.append("一键重开未把牛牛归位：偏移 %.2fpx（_restart_run 未重置位置）" % _player.global_position.distance_to(_origin))
	var panel := _result_panel()
	if panel != null and panel.visible:
		_failures.append("一键重开后结算面板仍然可见（面板未随 RUNNING 隐藏）")
	if _collectible_count() < GameState.MAX_COLLECTIBLES:
		_failures.append("一键重开后可收集物未铺满：%d/%d（_fill_collectibles 未在重开时执行）" % [
			_collectible_count(), GameState.MAX_COLLECTIBLES,
		])


func _assert_persistence_roundtrip() -> void:
	var before_best: int = GameState.best_score
	var before_total: int = GameState.total_collected
	GameState.best_score = -7
	GameState.total_collected = -7
	GameState.load_progress()
	if GameState.best_score != before_best:
		_failures.append("持久化回读不一致：best_score 落盘值 %d，回读 %d（验收基线 4：退出重进数据不得丢失）" % [
			before_best, GameState.best_score,
		])
	if GameState.total_collected != before_total:
		_failures.append("持久化回读不一致：total_collected 落盘值 %d，回读 %d（验收基线 4）" % [
			before_total, GameState.total_collected,
		])


func _collectible_count() -> int:
	var container := get_tree().root.find_child("Collectibles", true, false)
	if container == null:
		return 0
	var count: int = 0
	for child in container.get_children():
		if child is Collectible:
			count += 1
	return count


func _result_panel() -> Panel:
	return get_tree().root.find_child("ResultPanel", true, false) as Panel


func _result_label() -> Label:
	return get_tree().root.find_child("ResultLabel", true, false) as Label


func _phase_label(phase: int) -> String:
	return ["RUNNING", "WON", "LOST"][clampi(phase, 0, 2)]


## 噪声相位：确定种子随机事件（同种子同事件序，门禁可复现）。
func _inject_noise_frame() -> void:
	if _total_frames == 1:
		_noise_rng.seed = 20260913
	var roll := _noise_rng.randf()
	var pos := Vector2(_noise_rng.randf_range(0, 640), _noise_rng.randf_range(0, 360))
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
		k.physical_keycode = [KEY_A, KEY_D, KEY_W, KEY_S, KEY_SPACE, KEY_ENTER][_noise_rng.randi_range(0, 5)]
		k.pressed = _noise_rng.randf() < 0.5
		Input.parse_input_event(k)


## 无显示设备时模拟「玩家按键」：注入真实 InputEvent，让 _unhandled_input 收得到。
func _press_action(action: StringName) -> void:
	var event := InputEventAction.new()
	event.action = action
	event.pressed = true
	Input.parse_input_event(event)


## 键位契约断言：目标键表 → project.godot [input] 的 physical_keycode（逐键 AND）。
func _check_key_bindings() -> void:
	for action: StringName in KEY_CONTRACT:
		if not InputMap.has_action(action):
			continue  # 动作缺失已由 REQUIRED_ACTIONS 断言上报，这里不重复计失败
		var expected: Array = KEY_CONTRACT[action]
		var bound: Array[Key] = []
		for event in InputMap.action_get_events(action):
			var key := event as InputEventKey
			if key != null and key.physical_keycode != KEY_NONE:
				bound.append(key.physical_keycode)
		if not _contains_all(expected, bound):
			_failures.append("键位契约：动作 %s 未绑全键表承诺的物理键（期望全部 %s，实际 %s）—— 缺的那个键真机按了没反应" % [
				action, _key_labels(expected), _key_labels(bound),
			])


func _contains_all(expected: Array, bound: Array[Key]) -> bool:
	for key in expected:
		if not (key in bound):
			return false
	return true


func _key_labels(keys: Array) -> String:
	var labels: PackedStringArray = []
	for code in keys:
		labels.append("%s(%d)" % [OS.get_keycode_string(code as Key), code])
	return "[%s]" % ", ".join(labels)


func _report() -> void:
	if _failures.is_empty():
		print("GODOT_SMOKE: PASS 场景实例化/输入映射/移动/收集判定/胜负/一键重开/持久化 全部通过")
		get_tree().quit(0)
	else:
		for failure in _failures:
			printerr("GODOT_SMOKE: FAIL %s" % failure)
		get_tree().quit(1)


func _on_player_moved(_position: Vector2) -> void:
	_moved_seen = true


func _on_score_changed(_score: int) -> void:
	_score_seen = true
