extends Node
## 无头冒烟自检（headless smoke）——《冒烟愿晶》的「游戏能不能跑且玩得动」机判。
##
## 运行方式（由 scripts/smoke.sh 封装）：
##   godot --headless --path <工程目录> tests/smoke.tscn
##
## 判定协议（smoke.sh 按此断言退出码与日志）：
##   通过 → stdout 打印 `GODOT_SMOKE: PASS ...`，进程退出码 0
##   失败 → stderr 打印 `GODOT_SMOKE: FAIL <原因>`（每条一行），进程退出码 1
##
## 覆盖面（模板七项 + 需求验收逐条）：
##   1. 主场景可实例化（main.tscn → player.tscn / meteor.tscn 接线未断裂）
##   2. autoload 已注册且带约定信号（score_changed / game_won）
##   3. InputMap 动作已注册 + 键位契约（逐键 AND），注入输入后玩家真的动了
##   4. 信号真的到达订阅方（Player.moved / GameState.score_changed / game_won）
##   5. 结果性事件真的挂了反馈（Juice.events 非空）
##   6. 调参协议可判（TUNING_META 非空、apply_tuning 应用/拒绝/钳制、时长上界 ≤5s）
##   7. 需求验收：流星限时闪现 ≤5s 且超时无残留；点击收集 +1 且有反馈；
##      点空/超时愿晶不误判；集齐 3 颗立即胜利且不可重复触发；重开归零、流星重新生成
##
## ⚠️ 输入注入分阶段、互不重叠（error-signatures E-08）：Input.parse_input_event 的缓冲
## 冲刷会清掉 Input.action_press 的按下状态 —— 移动断言与事件注入分帧做（协程 await 分隔）。

## 噪声相位帧数：正式断言前注入确定种子的对抗输入（悬挂手势/孤儿释放/乱键）。
const NOISE_FRAMES: int = 30
## 移动断言的按住帧数。
const MOVE_FRAMES: int = 10
## 判定「真的移动了」的最小位移（像素）。
const MIN_MOVE_DISTANCE: float = 1.0
## 超时消失用例的流星寿命（秒）：远短于真实 3~5s，让冒烟在帧预算内判完「超时消失」机制。
const EXPIRY_TEST_LIFETIME: float = 0.5
## 超时用例的等待帧数（寿命 30 物理帧 + 余量）。
const EXPIRY_WAIT_FRAMES: int = 40

const REQUIRED_ACTIONS: Array[StringName] = [
	&"move_left", &"move_right", &"move_up", &"move_down", &"confirm",
]

## 键位契约：动作 → 键表承诺的物理键，逐键核对（AND 语义，见 SKILL.md §4.3）。
const KEY_CONTRACT: Dictionary = {
	&"move_left": [KEY_A, KEY_LEFT],
	&"move_right": [KEY_D, KEY_RIGHT],
	&"move_up": [KEY_W, KEY_UP],
	&"move_down": [KEY_S, KEY_DOWN],
	&"confirm": [KEY_SPACE, KEY_ENTER],
}

var _failures: PackedStringArray = []
var _main: Node2D
var _player: Player
var _origin: Vector2 = Vector2.ZERO
var _moved_seen: bool = false
var _score_seen: bool = false
var _game_won_count: int = 0
var _noise_rng := RandomNumberGenerator.new()


func _ready() -> void:
	# headless 无垂直同步：限 60 FPS 让 process:physics ≈ 1:1，--quit-after 兜底才有意义。
	Engine.max_fps = 60
	_static_checks()
	_run()


## ── 静态断言（_ready 期即可判）──

func _static_checks() -> void:
	for action in REQUIRED_ACTIONS:
		if not InputMap.has_action(action):
			_failures.append("InputMap 缺少动作 %s（project.godot [input] 未注册）" % action)
	_check_key_bindings()

	var game_state := get_tree().root.get_node_or_null("GameState")
	if game_state == null:
		_failures.append("autoload GameState 未注册（project.godot [autoload] 缺失）")
	else:
		if not game_state.has_signal("score_changed"):
			_failures.append("autoload GameState 缺少信号 score_changed")
		if not game_state.has_signal("game_won"):
			_failures.append("autoload GameState 缺少信号 game_won")
		game_state.score_changed.connect(_on_score_changed)
		game_state.game_won.connect(_on_game_won)
		_check_tuning_protocol(game_state)

	_main = get_tree().root.find_child("Main", true, false) as Node2D
	if _main == null:
		_failures.append("场景树找不到 Main（tests/smoke.tscn 未实例化 main.tscn）")
		return
	_player = get_tree().root.find_child("Player", true, false) as Player
	if _player == null:
		_failures.append("场景树找不到 Player（main.tscn 未实例化 player.tscn，或实例名不是 Player）")
	else:
		_player.moved.connect(_on_player_moved)
		_origin = _player.global_position
	# 流星计时器接线：autospawn 关闭前的生成路径断言依赖它。
	var spawn_timer: Timer = _main.get_node_or_null("SpawnTimer") as Timer
	if spawn_timer == null:
		_failures.append("main.tscn 缺少 SpawnTimer 节点（流星生成无驱动源）")
	elif not spawn_timer.timeout.is_connected(Callable(_main, "_on_spawn_timer_timeout")):
		_failures.append("SpawnTimer.timeout 未连接 main._on_spawn_timer_timeout（流星不会生成）")


func _check_key_bindings() -> void:
	for action: StringName in KEY_CONTRACT:
		if not InputMap.has_action(action):
			continue  # 动作缺失已由 REQUIRED_ACTIONS 上报，不重复计失败
		var expected: Array = KEY_CONTRACT[action]
		var bound: Array[Key] = []
		for event in InputMap.action_get_events(action):
			var key := event as InputEventKey
			if key != null and key.physical_keycode != KEY_NONE:
				bound.append(key.physical_keycode)
		if not _contains_all(expected, bound):
			_failures.append("键位契约：动作 %s 未绑全键表承诺的物理键（期望全部 %s，实际 %s）" % [
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


func _check_tuning_protocol(game_state: Node) -> void:
	var meta: Variant = game_state.get("TUNING_META")
	if not (meta is Dictionary) or (meta as Dictionary).is_empty():
		_failures.append("调参协议：GameState.TUNING_META 为空或不可读（必须声明至少一个可调键）")
		return
	# 时长上界规则：需求硬约束「单次闪现 ≤ 5 秒」必须落在调参区的钳制范围内。
	var lifetime_max: Variant = game_state.get("meteor_lifetime_max")
	if not (lifetime_max is float) or float(lifetime_max) > 5.0:
		_failures.append("调参协议：meteor_lifetime_max=%s 超出需求硬上界 5 秒" % [lifetime_max])
	var lifetime_min: Variant = game_state.get("meteor_lifetime_min")
	if not (lifetime_min is float) or float(lifetime_min) > float(lifetime_max):
		_failures.append("调参协议：meteor_lifetime_min=%s 不得大于 max=%s" % [lifetime_min, lifetime_max])
	# apply_tuning 行为契约：应用已声明键、拒绝未声明键、按 max 钳制；完事恢复原值防污染。
	var original_speed: Variant = game_state.get("move_speed")
	var applied: PackedStringArray = game_state.call("apply_tuning", {"move_speed": 99999.0, "tuning_bogus_key": 1})
	if not applied.has("move_speed"):
		_failures.append("调参协议：apply_tuning 未应用已声明键 move_speed（应用逻辑断裂）")
	if applied.has("tuning_bogus_key"):
		_failures.append("调参协议：apply_tuning 应用了未声明键 tuning_bogus_key（必须只认 TUNING_META 声明的键）")
	var speed: Variant = game_state.get("move_speed")
	if not (speed is float or speed is int) or float(speed) > 600.0:
		_failures.append("调参协议：move_speed=%s 超出 TUNING_META.max=600（钳制缺失）" % [speed])
	if applied.has("move_speed") and original_speed != null:
		game_state.set("move_speed", original_speed)


## ── 行为断言（协程时序，阶段间 await 分帧）──

func _run() -> void:
	if not _failures.is_empty():
		_finish()
		return
	await _noise_phase()
	await _move_phase()
	# 冒烟期关闭自动生成：后续收集/超时用例的愿晶计数全部确定可控；
	# 「流星自动生成」在重开相位单独断言（set_autospawn(true) + 计时器已武装）。
	_main.call("set_autospawn", false)
	await _pulse_collect_phase()
	await _touch_collect_phase()
	await _miss_phase()
	await _expiry_phase()
	await _win_phase()
	await _restart_phase()
	_finish()


## 噪声相位：确定种子随机事件（只注入原始事件，不注入 InputEventAction）。
func _noise_phase() -> void:
	_noise_rng.seed = 20260913  # 门禁要求可复现：同种子同事件序
	for frame: int in NOISE_FRAMES:
		_inject_noise_frame()
		await get_tree().physics_frame


func _inject_noise_frame() -> void:
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
		k.physical_keycode = [KEY_A, KEY_D, KEY_W, KEY_S, KEY_SPACE, KEY_ENTER][_noise_rng.randi_range(0, 5)]
		k.pressed = _noise_rng.randf() < 0.5
		Input.parse_input_event(k)


## 阶段一：按住 move_right 移动 → 断言物理位移 + moved 信号到达订阅方。
func _move_phase() -> void:
	Input.action_press(&"move_right")
	for frame: int in MOVE_FRAMES:
		await get_tree().physics_frame
	Input.action_release(&"move_right")
	await get_tree().physics_frame
	var travelled: float = _player.global_position.distance_to(_origin)
	if travelled < MIN_MOVE_DISTANCE:
		_failures.append("玩家 %d 帧内位移 %.2fpx < %.2fpx：InputMap 动作未生效或 _physics_process 未驱动 velocity" % [
			MOVE_FRAMES, travelled, MIN_MOVE_DISTANCE,
		])
	if not _moved_seen:
		_failures.append("信号 Player.moved 未到达订阅方：连接断裂或从未 emit")


## 阶段二：许愿波收集 —— 玩家身旁生成流星，confirm 触发范围收集 → 愿晶 +1 + 反馈非空。
func _pulse_collect_phase() -> void:
	var meteor: Meteor = _main.call("spawn_meteor", _player.global_position + Vector2(60.0, 0.0), 3.0)
	await _frames(2)
	_press_action(&"confirm")
	await _frames(3)
	if GameState.score != 1:
		_failures.append("许愿波收集：confirm 后愿晶计数 %d ≠ 1（许愿波范围收集未生效）" % GameState.score)
	if is_instance_valid(meteor):
		_failures.append("许愿波收集：命中的流星未被移除（场景残留元素）")
	if Juice.events.is_empty():
		_failures.append("反馈断言：收集这一结果事件没有触发任何 Juice 反馈（见 SKILL.md §3B）")
	if not _score_seen:
		_failures.append("信号 GameState.score_changed 未到达订阅方：连接断裂或从未 emit")


## 阶段三：点按收集（触摸路径）—— 在流星位置注入 ScreenTouch → 愿晶 +1。
func _touch_collect_phase() -> void:
	var spawn_pos := Vector2(160.0, 120.0)
	var meteor: Meteor = _main.call("spawn_meteor", spawn_pos, 3.0)
	await _frames(2)
	_tap_touch(spawn_pos)
	await _frames(1)
	_tap_touch_release(spawn_pos)
	await _frames(2)
	if GameState.score != 2:
		_failures.append("点按收集：触摸命中流星后愿晶计数 %d ≠ 2（点按热区判定未生效）" % GameState.score)
	if is_instance_valid(meteor):
		_failures.append("点按收集：命中的流星未被移除（场景残留元素）")


## 阶段四：失手口径 —— 点空（触摸 + 鼠标各一次）愿晶计数必须不变。
func _miss_phase() -> void:
	var empty_pos := Vector2(240.0, 60.0)  # 与 160,120 的流星距离 100px > tap_radius 48px
	_tap_touch(empty_pos)
	await _frames(1)
	_tap_touch_release(empty_pos)
	_tap_mouse(empty_pos)
	await _frames(2)
	if GameState.score != 2:
		_failures.append("失手口径：点空后愿晶计数 %d ≠ 2（发生了误判收集）" % GameState.score)


## 阶段五：限时闪现 —— 注入 0.5s 短寿命流星，超时自动消失且愿晶不误判、无场景残留。
func _expiry_phase() -> void:
	var meteor: Meteor = _main.call("spawn_meteor", Vector2(500.0, 280.0), EXPIRY_TEST_LIFETIME)
	await _frames(EXPIRY_WAIT_FRAMES)
	if is_instance_valid(meteor):
		_failures.append("限时闪现：流星超过寿命仍残留场景（超时消失机制失效）")
	if GameState.score != 2:
		_failures.append("失手口径：流星超时消失后愿晶计数 %d ≠ 2（发生了误判收集）" % GameState.score)


## 阶段六：胜利判定 —— 第 3 颗愿晶（鼠标点按路径）立即触发 game_won，且不可重复触发。
func _win_phase() -> void:
	var spawn_pos := Vector2(480.0, 120.0)
	_main.call("spawn_meteor", spawn_pos, 3.0)
	await _frames(2)
	_tap_mouse(spawn_pos)
	await _frames(3)
	if GameState.score != 3:
		_failures.append("胜利判定：第 3 次收集后愿晶计数 %d ≠ 3" % GameState.score)
	if _game_won_count != 1:
		_failures.append("胜利判定：game_won 触发次数 %d ≠ 1（未立即判定或被重复触发）" % _game_won_count)
	if not GameState.won:
		_failures.append("胜利判定：GameState.won 门闩未置位")
	if not _main.win_panel.visible:
		_failures.append("胜利结算：WinPanel 未展示（结算界面缺失）")
	if _main.is_spawning():
		_failures.append("胜利结算：胜利后流星仍在生成（结算后应停止生成）")
	# 胜利状态不可重复触发：直接再计一次分，计数与 game_won 都不得变化。
	GameState.add_score(1)
	if GameState.score != 3 or _game_won_count != 1:
		_failures.append("胜利判定：胜利后再计分未被忽略（score=%d, game_won=%d）—— 胜利状态被重复触发" % [
			GameState.score, _game_won_count])


## 阶段七：重开闭环 —— confirm 触发重开：计数归零、结算收起、流星重新生成（计时器武装 + 生成路径可用）。
func _restart_phase() -> void:
	_press_action(&"confirm")
	await _frames(3)
	if GameState.score != 0:
		_failures.append("重开：愿晶计数 %d ≠ 0（重开未归零）" % GameState.score)
	if GameState.won:
		_failures.append("重开：胜利门闩未复位（无法开始新一局）")
	if _main.win_panel.visible:
		_failures.append("重开：胜利结算面板未收起")
	if not _main.is_spawning():
		_failures.append("重开：流星生成未恢复（新一局没有流星）")
	# 「流星重新生成」：走与计时器相同的唯一生成路径，断言随机寿命落在调参区 [min, max] 且 ≤5s。
	var meteor: Meteor = _main.call("spawn_meteor")
	await _frames(2)
	var alive: int = _main.meteor_container.get_child_count()
	if alive < 1:
		_failures.append("重开：重新生成的流星未进入场景（Meteors 容器为空）")
	if meteor != null and (meteor.lifetime < GameState.meteor_lifetime_min
			or meteor.lifetime > GameState.meteor_lifetime_max
			or meteor.lifetime > 5.0):
		_failures.append("重开：生成流星寿命 %.2fs 超出 [%.1f, %.1f] 或需求上界 5s" % [
			meteor.lifetime, GameState.meteor_lifetime_min, GameState.meteor_lifetime_max])


## ── 注入工具 ──

## 注入坐标换算：本测试持有的是**视口坐标**，而 Input.parse_input_event 把事件位置当
## **窗口坐标**解释，送达 _unhandled_input 时才被 final_transform（stretch=canvas_items/keep
## 的视口→窗口映射；headless 窗口是 64×64，实测 (160,120) 会被逆变换成 (1600,1060)）还原。
## 因此注入前先做 final_transform 正变换，保证「点在流星上」在任意窗口尺寸下语义一致
## （实测根因：工程 stretch 管线没有错，错的是裸按视口坐标注入）。
func _to_window_pos(viewport_pos: Vector2) -> Vector2:
	return get_viewport().get_final_transform() * viewport_pos


## 无显示设备下注入真实 InputEventAction：_unhandled_input 收得到（confirm → 许愿波/重开）。
func _press_action(action: StringName) -> void:
	var event := InputEventAction.new()
	event.action = action
	event.pressed = true
	Input.parse_input_event(event)


func _tap_touch(viewport_pos: Vector2) -> void:
	var touch := InputEventScreenTouch.new()
	touch.index = 0
	touch.position = _to_window_pos(viewport_pos)
	touch.pressed = true
	Input.parse_input_event(touch)


func _tap_touch_release(viewport_pos: Vector2) -> void:
	var touch := InputEventScreenTouch.new()
	touch.index = 0
	touch.position = _to_window_pos(viewport_pos)
	touch.pressed = false
	Input.parse_input_event(touch)


func _tap_mouse(viewport_pos: Vector2) -> void:
	var click := InputEventMouseButton.new()
	click.button_index = MOUSE_BUTTON_LEFT
	click.position = _to_window_pos(viewport_pos)
	click.pressed = true
	Input.parse_input_event(click)
	var release := InputEventMouseButton.new()
	release.button_index = MOUSE_BUTTON_LEFT
	release.position = _to_window_pos(viewport_pos)
	release.pressed = false
	Input.parse_input_event(release)


func _frames(count: int) -> void:
	for frame: int in count:
		await get_tree().physics_frame


## ── 结算 ──

func _finish() -> void:
	if _failures.is_empty():
		print("GODOT_SMOKE: PASS 场景实例化/autoload/输入键位契约/物理移动/信号/收集反馈/限时闪现/胜负判定/重开闭环 全部通过")
		get_tree().quit(0)
	else:
		for failure in _failures:
			printerr("GODOT_SMOKE: FAIL %s" % failure)
		get_tree().quit(1)


func _on_player_moved(_position: Vector2) -> void:
	_moved_seen = true


func _on_score_changed(_score: int) -> void:
	_score_seen = true


func _on_game_won(_score: int) -> void:
	_game_won_count += 1
