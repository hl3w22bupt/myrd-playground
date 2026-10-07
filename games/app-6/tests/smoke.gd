extends Node
## 无头冒烟自检（headless smoke）—— 机器可判定的「游戏能不能跑」。
##
## 运行方式（由 scripts/smoke.sh 封装）：
##   godot --headless --path <工程目录> tests/smoke.tscn
##
## 判定协议（smoke.sh 按此断言退出码与日志）：
##   通过 → stdout 打印 `GODOT_SMOKE: PASS ...`，进程退出码 0
##   失败 → stderr 打印 `GODOT_SMOKE: FAIL <原因>`（每条一行），进程退出码 1
##
## 覆盖面（对应 SKILL.md「冒烟场景必须断言什么」的六项，移植新游戏时逐项保留）：
##   1. 场景可实例化（main.tscn → player.tscn 接线未断裂）
##   2. autoload 已注册且带约定信号
##   3. InputMap 动作已注册、物理键绑定正确（键位契约），且注入输入后对象真的动了
##   4. 信号真的到达订阅方（Player.moved / GameState.score_changed）
##   5. 每项失败给出可读原因（可直接查 references/error-signatures.md）
##   6. 结果性事件真的挂了反馈（Juice.events 非空 —— 反馈缺失既有断言全拦不住：
##      游戏能跑、信号能到，但玩起来是哑的；见 SKILL.md §3B）
##   7. 调参协议可判（TUNING_META 非空、apply_tuning 钳制与未知键拒绝 —— §3C）
##   8. 胜负可达：收集满 3 颗立即 victory_achieved + 结算浮层可见 + HUD 3/3（验收标准 4）
##   9. 窗口期规则：过期流星不可再捕、不计入收集（核心规则 2 / 验收标准 2）
##  10. 重开可用：重开清零、浮层收起、重开后核心交互仍可用（重开入口）
##
## ⚠️ 输入注入分两个阶段、互不重叠（见 references/error-signatures.md E-08）：
##   headless 下 `Input.parse_input_event()` 的缓冲冲刷会清掉 `Input.action_press()`
##   设置的按下状态，两者同帧混用会让「移动断言」假失败。

## ── 噪声相位（输入鲁棒性门禁的逐游戏语义层）──
## 正式断言前注入一段确定种子的对抗输入：悬挂手势（按下不抬起）、孤儿释放（抬起无按下）、
## 双指抢控、乱键。随后照常执行移动/收集断言 —— 断言仍全过 = 噪声没有楔死输入管线。
## 「输入状态残留」类缺陷（实例：手势中致胜 → release 被丢弃 → 下一关首手势被吞）在这一层拦。
## 只注入原始事件（Key/Mouse/Touch），不注入 InputEventAction —— 动作级投递断言的判定不被噪声污染。
const NOISE_FRAMES: int = 30

## 阶段一：按住 move_right 让玩家移动的帧数。
const MOVE_FRAMES: int = 10
## 阶段二：注入 confirm 事件后等待事件分发的帧数（核心交互：confirm 捕捉 + 计分）。
const CAPTURE_FRAMES: int = 4
## 阶段三：连捕 2 颗达成 3/3，给胜利信号/结算浮层一帧落地。
const VICTORY_FRAMES: int = 4
## 阶段四：重开后再捕 1 颗，验证重开入口可用（捕捉链路同步，仅留过渡帧）。
const RESTART_FRAMES: int = 4
## 总帧数上限（超过即出报告，防止死循环；smoke.sh 另有 --quit-after 兜底）。
const TOTAL_FRAMES: int = (
	NOISE_FRAMES + MOVE_FRAMES + CAPTURE_FRAMES + VICTORY_FRAMES + RESTART_FRAMES + 2
)
## 判定「真的移动了」的最小位移（像素）。
const MIN_MOVE_DISTANCE: float = 1.0

const REQUIRED_ACTIONS: Array[StringName] = [
	&"move_left", &"move_right", &"move_up", &"move_down", &"confirm",
]

## 键位契约：动作 → 键表承诺的物理键，**必须全部绑定**（与 project.godot [input] 的键表对应）。
## 逐键核对（_contains_all）而非「绑了其中一个就算过」：文档键表写「D / →」就是承诺两个键都能用，
## 写成「至少一个」会让「D 被误改、只剩 →」的单键回归照样全绿（探针实测漏拦）。
## 若项目本意就是「二选一」，键表里只写一个代表键即可，契约仍与之对齐。
## 两层既有断言都拦不住「键位错绑」：InputMap.has_action 只证明动作注册了；
## 行为断言走动作级注入（action_press / InputEventAction），绕过键码匹配。
## 所以 move_right 若被误绑到 F，冒烟依旧全绿、真机按 D 却无响应 —— 只能在这一层拦。
## （SKILL.md「输入只走动作名」的禁令只约束游戏逻辑代码；本断言层就是合法例外。）
const KEY_CONTRACT: Dictionary = {
	&"move_left": [KEY_A, KEY_LEFT],
	&"move_right": [KEY_D, KEY_RIGHT],
	&"move_up": [KEY_W, KEY_UP],
	&"move_down": [KEY_S, KEY_DOWN],
	&"confirm": [KEY_SPACE, KEY_ENTER],
}

var _failures: PackedStringArray = []
var _frames: int = 0
var _finished: bool = false
var _player: Player
var _main: Node
var _origin: Vector2 = Vector2.ZERO
var _moved_seen: bool = false
var _score_seen: bool = false
var _victory_seen: bool = false


func _ready() -> void:
	# headless 没有垂直同步，process 帧率可跑到几百上千 FPS，而物理固定 60Hz。
	# `--quit-after N` 数的是 process 帧：不限帧时 N=120 可能在第 ~7 个物理帧就退出，
	# 冒烟协程根本没跑完 → 既无 PASS 也无 FAIL，门禁退化成「弱判定假通过」（见 README 实测）。
	# 限到 60 FPS 让 process 帧 : 物理帧 ≈ 1:1，--quit-after 的兜底才有意义。
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
		if game_state.has_signal("victory_achieved"):
			game_state.victory_achieved.connect(_on_victory_achieved)
		else:
			_failures.append("autoload GameState 缺少信号 victory_achieved（胜负可达断言的锚点）")
		_check_tuning_protocol(game_state)

	_main = get_tree().root.find_child("Main", true, false)
	if _main == null:
		_failures.append("场景树找不到 Main（smoke.tscn 未实例化 main.tscn，或实例名不是 Main）")

	_player = get_tree().root.find_child("Player", true, false) as Player
	if _player == null:
		_failures.append("场景树找不到 Player（main.tscn 未实例化 player.tscn，或实例名不是 Player）")
	else:
		_player.moved.connect(_on_player_moved)
		_origin = _player.global_position


func _physics_process(_delta: float) -> void:
	if _finished:
		return
	_frames += 1

	if _failures.is_empty():
		if _frames <= NOISE_FRAMES:
			_inject_noise_frame()
		elif _frames == NOISE_FRAMES + 1:
			Input.action_press(&"move_right")
		elif _frames == NOISE_FRAMES + MOVE_FRAMES:
			Input.action_release(&"move_right")
			_assert_player_moved()
			_stage_capture_first()
		elif _frames == NOISE_FRAMES + MOVE_FRAMES + CAPTURE_FRAMES:
			_assert_core_interaction()
			_stage_victory()
		elif _frames == NOISE_FRAMES + MOVE_FRAMES + CAPTURE_FRAMES + VICTORY_FRAMES:
			_assert_victory_reached()
			_stage_restart()
		elif _frames == TOTAL_FRAMES:
			_assert_restarted()
			_assert_score_changed()
			_assert_feedback_fired()

	if _frames >= TOTAL_FRAMES or not _failures.is_empty():
		_finished = true
		_report()


## 噪声相位：确定种子随机事件（原始事件，不含 InputEventAction）。
var _noise_rng := RandomNumberGenerator.new()


func _inject_noise_frame() -> void:
	if _frames == 1:
		_noise_rng.seed = 20260913  # 门禁要求可复现：同种子同事件序
	var roll := _noise_rng.randf()
	var pos := Vector2(_noise_rng.randf_range(0, 720), _noise_rng.randf_range(0, 1280))
	if roll < 0.30:
		# 悬挂手势：按下不抬起
		var t := InputEventScreenTouch.new()
		t.index = _noise_rng.randi_range(0, 1)
		t.position = pos
		t.pressed = true
		Input.parse_input_event(t)
	elif roll < 0.45:
		# 孤儿释放：抬起无按下
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
## （Input.action_press 只改动作强度，不产生 InputEvent，触发不了 _unhandled_input。）
func _press_action(action: StringName) -> void:
	var event := InputEventAction.new()
	event.action = action
	event.pressed = true
	Input.parse_input_event(event)


## ── 阶段驱动与断言：核心交互 → 胜负 → 重开（走真实捕捉路径，不直改 GameState.score）──

## 阶段二驱动：关掉随机生成拿到确定节奏，在玩家身边生成一颗窗口期内流星，
## 再注入 confirm 动作事件 —— 走 main._unhandled_input → _capture_nearest_to_player
## 的完整真实路径（事件分发需要一帧，故 CAPTURE_FRAMES 后才断言）。
func _stage_capture_first() -> void:
	_main.set("auto_spawn_enabled", false)
	_main.spawn_meteor(_player.global_position, Vector2.RIGHT)
	_press_action(&"confirm")


## 阶段二断言：捕捉生效（计分/信号/HUD 进度）+「一闪即逝」窗口期规则。
func _assert_core_interaction() -> void:
	var game_state := get_tree().root.get_node_or_null("GameState")
	var score: int = game_state.get("score")
	if score != 1:
		_failures.append("核心交互：confirm 捕捉后 score=%s ≠ 1（捕捉路径未生效）" % score)
	if not _score_seen:
		_failures.append("核心交互：GameState.score_changed 未在捕捉后送达订阅方")
	var hud_text: String = _main.get_node("%HudLabel").text
	if not hud_text.contains("1/3"):
		_failures.append("HUD 进度：捕捉 1 颗后 HUD 未显示 1/3（text=%s，验收标准 3）" % hud_text)
	# 窗口期规则（核心规则 2 / 验收标准 2）：过期的流星不可再捕、不计入收集。
	var dead: Meteor = _main.spawn_meteor(_player.global_position + Vector2(180, 0), Vector2.RIGHT)
	dead.expire()
	if dead.capture():
		_failures.append("窗口期规则：已过期流星 capture() 仍返回 true（一闪即逝被破坏）")
	if game_state.get("score") != 1:
		_failures.append("窗口期规则：过期流星被计入收集（score=%s ≠ 1）" % game_state.get("score"))


## 阶段三驱动：连捕 2 颗达成 3/3。capture() 是三条捕捉路径（点击/confirm/碰撞）
## 收敛的同一入口，这里直接调用以保持确定性。
func _stage_victory() -> void:
	for offset: Vector2 in [Vector2(-36.0, 0.0), Vector2(36.0, 0.0)]:
		var meteor: Meteor = _main.spawn_meteor(_player.global_position + offset, Vector2.RIGHT)
		meteor.capture()


## 阶段三断言：收集满 3 立即胜利，且只由收集数=3 触发（验收标准 4）。
func _assert_victory_reached() -> void:
	var game_state := get_tree().root.get_node_or_null("GameState")
	if int(game_state.get("phase")) != 1:  # 1 == GameState.Phase.VICTORY
		_failures.append("胜负判定：收集满 3 颗后 phase=%s ≠ VICTORY" % game_state.get("phase"))
	if not _victory_seen:
		_failures.append("胜负判定：收集数达 3 未发出 victory_achieved 信号")
	var panel: Control = _main.get_node("%VictoryPanel")
	if not panel.visible:
		_failures.append("胜负判定：收集数达 3 后胜利结算面板未显示（验收标准 4）")
	var hud_text: String = _main.get_node("%HudLabel").text
	if not hud_text.contains("3/3"):
		_failures.append("HUD 进度：胜利后 HUD 未显示 3/3（text=%s）" % hud_text)


## 阶段四驱动：重开一局，再捕 1 颗验证「重开后核心交互仍可用」。
func _stage_restart() -> void:
	_main.restart_game()
	var meteor: Meteor = _main.spawn_meteor(_player.global_position, Vector2.RIGHT)
	meteor.capture()


## 阶段四断言：重开清零生效、结算浮层收起、重开后可继续游玩（重开入口可用）。
func _assert_restarted() -> void:
	var game_state := get_tree().root.get_node_or_null("GameState")
	var score: int = game_state.get("score")
	if score != 1:
		_failures.append("重开可用：重开后再捕 1 颗 score=%s ≠ 1（重开未清零或重开后捕捉失效）" % score)
	var panel: Control = _main.get_node("%VictoryPanel")
	if panel.visible:
		_failures.append("重开可用：重开后胜利结算面板仍然可见")
	var hud_text: String = _main.get_node("%HudLabel").text
	if not hud_text.contains("1/3"):
		_failures.append("重开可用：重开再捕后 HUD 未显示 1/3（text=%s）" % hud_text)


## 键位契约断言：目标键表 → project.godot [input] 的 physical_keycode。
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


## 逐一核对 expected 里每个键都已在 bound 中（AND 语义）。
func _contains_all(expected: Array, bound: Array[Key]) -> bool:
	for key in expected:
		if not (key in bound):
			return false
	return true


## 键码 → 可读键名（"D" / "Left" / "Space"），同时附键码数值：
## 未映射键名会被引擎打印成私有区字形（终端里是乱码），数值才能定位。
func _key_labels(keys: Array) -> String:
	var labels: PackedStringArray = []
	for code in keys:
		labels.append("%s(%d)" % [OS.get_keycode_string(code as Key), code])
	return "[%s]" % ", ".join(labels)


func _assert_player_moved() -> void:
	if _player == null:
		return
	var travelled: float = _player.global_position.distance_to(_origin)
	if travelled < MIN_MOVE_DISTANCE:
		_failures.append(
			"玩家 %d 帧内位移 %.2fpx < %.2fpx：InputMap 动作未生效或 _physics_process 未驱动 velocity" % [
				MOVE_FRAMES, travelled, MIN_MOVE_DISTANCE,
			]
		)


func _assert_score_changed() -> void:
	if not _moved_seen:
		_failures.append("信号 Player.moved 未到达订阅方：连接断裂或从未 emit")
	if not _score_seen:
		_failures.append("信号 GameState.score_changed 未到达订阅方：连接断裂或从未 emit（confirm 动作未触发加分）")


## 第 6 项断言：结果性事件挂了反馈（confirm → 加分 → _on_score_changed → Juice 反馈链路）。
## 反馈缺失是「玩起来是哑的」类缺陷：能跑、信号全通，但没有任何表现反馈 —— 只有这一层拦。
func _assert_feedback_fired() -> void:
	if Juice.events.is_empty():
		_failures.append("反馈断言：confirm→加分的结果事件没有触发任何 Juice 反馈"
			+ "（结果性事件必须挂 ≥1 条反馈，见 SKILL.md §3B；如确实移除了反馈，同步更新本断言）")


## 调参工作台协议（SKILL.md §3C，纯逻辑、无头可判）：
## TUNING_META 非空；apply_tuning 应用已声明键、拒绝未声明键、按 max 钳制 ——
## 这是「试玩调参 → URL → 回写 spec」链路的机器前提，桥断了调参结果就无法复现。
## ⚠️ 检查完必须把调过的值恢复原状 —— 协议检查不得污染被测状态（gate-selftest D5
## 实测：不恢复的话，本检查会把「速度被静默归零」的缺陷用钳制值 600 悄悄修好，让位移
## 断言全绿放行）。
func _check_tuning_protocol(game_state: Node) -> void:
	var meta: Variant = game_state.get("TUNING_META")
	if meta is Dictionary and not (meta as Dictionary).is_empty():
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
	else:
		_failures.append("调参协议：GameState.TUNING_META 为空或不可读（数值调参区必须声明至少一个可调键，见 SKILL.md §3C）")


func _report() -> void:
	if _failures.is_empty():
		print("GODOT_SMOKE: PASS 场景实例化/输入映射与键位契约/物理移动/捕捉计分/窗口期规则/胜负判定/重开入口/反馈触发/调参协议 全部通过")
		get_tree().quit(0)
	else:
		for failure in _failures:
			printerr("GODOT_SMOKE: FAIL %s" % failure)
		get_tree().quit(1)


func _on_player_moved(_position: Vector2) -> void:
	_moved_seen = true


func _on_score_changed(_score: int) -> void:
	_score_seen = true


func _on_victory_achieved(_count: int) -> void:
	_victory_seen = true
