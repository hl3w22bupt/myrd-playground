extends Node
## 无头冒烟自检（headless smoke）——《hello》的机器可判定验收。
##
## 运行方式（由 scripts/smoke.sh 封装）：
##   godot --headless --path <工程目录> tests/smoke.tscn
##
## 判定协议（smoke.sh 按此断言退出码与日志）：
##   通过 → stdout 打印 `GODOT_SMOKE: PASS ...`，进程退出码 0
##   失败 → stderr 打印 `GODOT_SMOKE: FAIL <原因>`（每条一行），进程退出码 1
##
## 覆盖面（模板五项断言逐项保留 + 本游戏玩法断言）：
##   1. 场景可实例化（main.tscn → player.tscn / collectible.tscn 接线未断裂）
##   2. autoload GameState 已注册且带约定信号（score_changed / game_won / game_over / level_started）
##   3. InputMap 动作已注册、物理键绑定正确（键位契约），注入输入后玩家真的动了
##   4. 信号真的到达订阅方（Player.moved / GameState.score_changed / game_won / game_over / level_started）
##   5. 收集交互生效：玩家碰到收集物 → 计数累加
##   6. 过关可达：第 1 关收满 4/6 → won = true、过关结算文案显示
##   7. 难度梯度：confirm 过关 → 第 2 关（目标 4→5、时限 30→26 秒）、收集物 6 件按原位复活
##   8. 失败反馈可达：时限压到 0 → over = true、失败结算文案显示（won 保持 false）
##   9. 失败后重来：confirm → 回第 1 关（level 1、时限恢复 30 秒、收集物复活、结算文案隐藏）
##
## ⚠️ 输入注入分阶段互不重叠（references/error-signatures.md E-08）：
##   headless 下 `Input.parse_input_event()` 的缓冲冲刷会清掉 `Input.action_press()`
##   设置的按下状态，同帧混用会让「移动断言」假失败 —— 移动相位结束 2 帧后才开始收集相位。

## ── 噪声相位（输入鲁棒性门禁的逐游戏语义层）──
## 正式断言前注入一段确定种子的对抗输入：悬挂手势（按下不抬起）、孤儿释放（抬起无按下）、
## 双指抢控、乱键。随后照常执行移动/收集断言 —— 断言仍全过 = 噪声没有楔死输入管线。
## 只注入原始事件（Key/Mouse/Touch），不注入 InputEventAction —— 动作级投递断言的判定不被噪声污染。
const NOISE_FRAMES: int = 30

## 阶段一：按住 move_right 让玩家移动的帧数。
const MOVE_FRAMES: int = 10
## 收集相位：每次把玩家传送到收集物位置后，等 Area2D 完成重叠检测的帧数。
const COLLECT_SETTLE_FRAMES: int = 4
## 开局相位：注入 confirm 后等待「玩家瞬移 → 收集物按原位复活」生效的帧数。
## 留足帧数也为了让「复活件被瞬间重复收集」这类时序缺陷有暴露窗口。
const RESTART_SETTLE_FRAMES: int = 8
## 场上收集物总数（与 main.tscn 摆放数同值：第 1 关目标 4 件，场上备 6 件撑梯度上限）。
const SCENE_COLLECTIBLES: int = 6
## 第 1 关收集目标（与 autoload/game_state.gd 的 BASE_TARGET 同值，改动需两边同步）。
const LEVEL1_TARGET: int = 4
## 第 2 关梯度期望值（BASE_TARGET+1 / BASE_TIME-TIME_STEP，硬编码以拦「梯度常量被悄悄改动」）。
const LEVEL2_TARGET: int = 5
const LEVEL2_TIME: float = 26.0
## 第 1 关时限（BASE_TIME，失败相位后重来断言用它核对时限已复位）。
const LEVEL1_TIME: float = 30.0
## 失败相位：把 time_left 压到该值，等它自然归零（60Hz 下约 3 帧）触发超时。
const FAIL_TIME_LEFT: float = 0.05
## 失败相位等待帧数：压值 → 归零 → 信号 → 文案，留 10 帧余量。
const FAIL_WAIT_FRAMES: int = 10
## 判定「真的移动了」的最小位移（像素）。
const MIN_MOVE_DISTANCE: float = 1.0

## 帧里程碑（物理帧；Engine.max_fps=60 下 process 帧 ≈ 物理帧）。
const F_MOVE_START: int = NOISE_FRAMES + 1
const F_MOVE_END: int = F_MOVE_START + MOVE_FRAMES
const F_COLLECT_START: int = F_MOVE_END + 2
const F_COLLECT_END: int = F_COLLECT_START + LEVEL1_TARGET * COLLECT_SETTLE_FRAMES
const F_LEVEL1_CHECK: int = F_COLLECT_END + 2
const F_ADVANCE: int = F_LEVEL1_CHECK + 2
const F_LEVEL2_CHECK: int = F_ADVANCE + RESTART_SETTLE_FRAMES
const F_FAIL_SETUP: int = F_LEVEL2_CHECK + 2
const F_FAIL_CHECK: int = F_FAIL_SETUP + FAIL_WAIT_FRAMES
const F_RESTART: int = F_FAIL_CHECK + 2
const F_RESTART_CHECK: int = F_RESTART + RESTART_SETTLE_FRAMES
const F_TOTAL: int = F_RESTART_CHECK + 1

const REQUIRED_ACTIONS: Array[StringName] = [
	&"move_left", &"move_right", &"move_up", &"move_down", &"confirm",
]

## 键位契约：动作 → 键表承诺的物理键，**必须全部绑定**（与 project.godot [input] 的键表对应）。
## 逐键核对（_contains_all）而非「绑了其中一个就算过」：文档键表写「D / →」就是承诺两个键都能用，
## 写成「至少一个」会让「D 被误改、只剩 →」的单键回归照样全绿（探针实测漏拦，E-12）。
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
var _main: Node2D
var _player: Player
var _win_label: Label
var _game_state: Node
var _collect_index: int = 0
var _origin: Vector2 = Vector2.ZERO
var _moved_seen: bool = false
var _score_seen: bool = false
var _won_seen: bool = false
var _over_seen: bool = false
var _level_started_seen: bool = false

## 噪声相位：确定种子随机事件（原始事件，不含 InputEventAction）。
var _noise_rng := RandomNumberGenerator.new()


func _ready() -> void:
	# headless 没有垂直同步，process 帧率可跑到几百上千 FPS，而物理固定 60Hz。
	# `--quit-after N` 数的是 process 帧：限到 60 FPS 让 process : physics ≈ 1:1，兜底才有意义。
	Engine.max_fps = 60

	for action in REQUIRED_ACTIONS:
		if not InputMap.has_action(action):
			_failures.append("InputMap 缺少动作 %s（project.godot [input] 未注册）" % action)
	_check_key_bindings()

	_game_state = get_tree().root.get_node_or_null("GameState")
	if _game_state == null:
		_failures.append("autoload GameState 未注册（project.godot [autoload] 缺失）")
	else:
		for signal_name in ["score_changed", "game_won", "game_over", "level_started"]:
			if not _game_state.has_signal(signal_name):
				_failures.append("autoload GameState 缺少信号 %s" % signal_name)
		if _game_state.has_signal("score_changed"):
			_game_state.score_changed.connect(_on_score_changed)
		if _game_state.has_signal("game_won"):
			_game_state.game_won.connect(_on_game_won)
		if _game_state.has_signal("game_over"):
			_game_state.game_over.connect(_on_game_over_seen)
		if _game_state.has_signal("level_started"):
			_game_state.level_started.connect(_on_level_started_seen)

	_main = get_tree().root.find_child("Main", true, false) as Node2D
	if _main == null:
		_failures.append("场景树找不到 Main（tests/smoke.tscn 未实例化 main.tscn）")
		return
	_player = _main.get_node_or_null("Player") as Player
	if _player == null:
		_failures.append("Main 场景找不到 Player（main.tscn 未实例化 player.tscn，或实例名不是 Player）")
	else:
		_player.moved.connect(_on_player_moved)
		_origin = _player.global_position
	_win_label = _main.get_node_or_null("%WinLabel") as Label
	if _win_label == null:
		_failures.append("Main 场景找不到 %WinLabel（UI 缺少胜利/重开提示 Label，或未设 unique_name_in_owner）")
	var initial_count: int = _active_collectible_count()
	if initial_count != SCENE_COLLECTIBLES:
		_failures.append("收集物数量 %d != %d（main.tscn Collectibles 摆放不足，或 collectible.gd 未加入 collectibles 组）" % [
			initial_count, SCENE_COLLECTIBLES,
		])
	if _game_state != null and int(_game_state.target) != LEVEL1_TARGET:
		_failures.append("第 1 关收集目标 %d != %d：GameState._ready 未 start_level(1)，或 BASE_TARGET 被改动" % [
			int(_game_state.target), LEVEL1_TARGET,
		])


func _physics_process(_delta: float) -> void:
	if _finished:
		return
	_frames += 1

	if _failures.is_empty():
		if _frames <= NOISE_FRAMES:
			_inject_noise_frame()
		elif _frames == F_MOVE_START:
			Input.action_press(&"move_right")
		elif _frames == F_MOVE_END:
			Input.action_release(&"move_right")
			_assert_player_moved()
		elif _frames >= F_COLLECT_START and _frames < F_COLLECT_END:
			if (_frames - F_COLLECT_START) % COLLECT_SETTLE_FRAMES == 0:
				_teleport_to_next_collectible()
		elif _frames == F_LEVEL1_CHECK:
			_assert_level1_won()
		elif _frames == F_ADVANCE:
			_press_action(&"confirm")
		elif _frames == F_LEVEL2_CHECK:
			_assert_level2_started()
		elif _frames == F_FAIL_SETUP:
			_game_state.time_left = FAIL_TIME_LEFT
		elif _frames == F_FAIL_CHECK:
			_assert_failed()
		elif _frames == F_RESTART:
			_press_action(&"confirm")
		elif _frames == F_RESTART_CHECK:
			_assert_run_restarted()

	if _frames >= F_TOTAL or not _failures.is_empty():
		_finished = true
		_report()


## 噪声相位：确定种子随机事件（可复现：同种子同事件序）。
func _inject_noise_frame() -> void:
	if _frames == 1:
		_noise_rng.seed = 20260913
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


## 收集相位：把玩家直接放到收集物圆心上，靠引擎重叠检测触发 body_entered（真实交互路径）。
func _teleport_to_next_collectible() -> void:
	if _collect_index >= LEVEL1_TARGET or _player == null:
		return
	var target := _collectible_by_id(_collect_index)
	_collect_index += 1
	if target == null:
		_failures.append("收集物 #%d 不存在或已被提前收集：传送目标缺失（收集相位顺序被打乱）" % (_collect_index - 1))
		return
	_player.global_position = target.global_position


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
	if not _moved_seen:
		_failures.append("信号 Player.moved 未到达订阅方：连接断裂或从未 emit")


## 第 1 关过关断言：收满 LEVEL1_TARGET 件（场上另 2 件保留，第 2 关还要用）、
## 计数累加、won 翻转、过关结算文案显示。
func _assert_level1_won() -> void:
	var remaining: int = _active_collectible_count()
	var expected_remaining: int = SCENE_COLLECTIBLES - LEVEL1_TARGET
	if remaining != expected_remaining:
		_failures.append("收满 %d 件后场上剩 %d 件 != %d：收集物被误收（计分超发）或漏收（Area2D 未触发 body_entered）" % [
			LEVEL1_TARGET, remaining, expected_remaining,
		])
	if _game_state.score != LEVEL1_TARGET:
		_failures.append("收集计数 %d != %d：collected → Main → GameState.add_score 计分链路未生效" % [
			_game_state.score, LEVEL1_TARGET,
		])
	if not _game_state.won:
		_failures.append("收集满 %d 件后 GameState.won 仍为 false：过关判定未触发" % LEVEL1_TARGET)
	if _game_state.over:
		_failures.append("过关瞬间 over 仍为 true：倒计时归零早于收集完成，时限梯度失衡")
	if not _score_seen:
		_failures.append("信号 GameState.score_changed 未到达订阅方：连接断裂或从未 emit")
	if not _won_seen:
		_failures.append("信号 GameState.game_won 未到达订阅方：连接断裂或过关未达成")
	if _win_label != null and not _win_label.visible:
		_failures.append("过关结算 %WinLabel 未显示：Main._on_game_won 未生效")


## 难度梯度断言：confirm 过关 → 第 2 关开局（目标 4→5、时限 30→26s）、
## 收集物 6 件按原位复活（可再收集）、结算文案收起、信号送达。
func _assert_level2_started() -> void:
	if int(_game_state.level) != 2:
		_failures.append("过关后关卡 %d != 2：confirm → GameState.advance_level 未生效" % int(_game_state.level))
	if int(_game_state.target) != LEVEL2_TARGET:
		_failures.append("第 2 关目标 %d != %d：难度梯度未按关卡递增" % [int(_game_state.target), LEVEL2_TARGET])
	if absf(float(_game_state.time_limit) - LEVEL2_TIME) > 0.01:
		_failures.append("第 2 关时限 %.2f != %.2f：时限梯度未按关卡递减" % [float(_game_state.time_limit), LEVEL2_TIME])
	if _game_state.score != 0:
		_failures.append("第 2 关分数 %d != 0：start_level 未清零上一关计数" % int(_game_state.score))
	if _game_state.won:
		_failures.append("第 2 关开局 won 仍为 true：过关状态未复位，本关无法再判胜")
	var active: int = _active_collectible_count()
	if active != SCENE_COLLECTIBLES:
		_failures.append("第 2 关可收集物 %d != %d：开局未按原位重新实例化收集物（或复活件被瞬间重复收集）" % [
			active, SCENE_COLLECTIBLES,
		])
	if _win_label != null and _win_label.visible:
		_failures.append("第 2 关开局 %WinLabel 仍可见：过关结算文案未收起")
	if not _level_started_seen:
		_failures.append("信号 GameState.level_started 未到达订阅方：连接断裂或开局未广播")


## 失败反馈断言：时限压到 0 自然归零 → over 翻转、失败结算文案显示、won 保持 false。
func _assert_failed() -> void:
	if not _game_state.over:
		_failures.append("时限归零后 GameState.over 仍为 false：超时判定未触发（失败反馈缺失）")
	if _game_state.won:
		_failures.append("超时失败时 won 为 true：失败被误判成过关")
	if not _game_state.time_left <= 0.0:
		_failures.append("超时后 time_left %.3f > 0：倒计时未钳制到 0" % float(_game_state.time_left))
	if not _over_seen:
		_failures.append("信号 GameState.game_over 未到达订阅方：连接断裂或超时未广播")
	if _win_label == null:
		_failures.append("失败结算 %WinLabel 缺失：无法展示失败反馈")
	elif not _win_label.visible:
		_failures.append("失败结算 %WinLabel 未显示：Main._on_game_over 未生效")
	elif not _win_label.text.contains("时间到"):
		_failures.append("失败结算文案未说明超时（缺「时间到」）：玩家无法分辨胜/败反馈")


## 失败后重来断言：confirm → 回第 1 关（关卡/时限/分数/胜负全复位、收集物复活、结算收起）。
func _assert_run_restarted() -> void:
	if int(_game_state.level) != 1:
		_failures.append("失败重来后关卡 %d != 1：confirm → GameState.restart_run 未生效" % int(_game_state.level))
	if absf(float(_game_state.time_limit) - LEVEL1_TIME) > 0.01:
		_failures.append("重来后时限 %.2f != %.2f：时限未复位到第 1 关值" % [float(_game_state.time_limit), LEVEL1_TIME])
	if _game_state.score != 0:
		_failures.append("重来后分数 %d != 0：start_level 未清零计数" % int(_game_state.score))
	if _game_state.over or _game_state.won:
		_failures.append("重来后 over/won 仍为 true：胜负状态未复位，本局无法正常游玩")
	var active: int = _active_collectible_count()
	if active != SCENE_COLLECTIBLES:
		_failures.append("重来后可收集物 %d != %d：开局未按原位重新实例化收集物" % [active, SCENE_COLLECTIBLES])
	if _win_label != null and _win_label.visible:
		_failures.append("重来后 %WinLabel 仍可见：失败结算文案未隐藏")


## 当前仍可收集的收集物数量（collectible.gd 收集后即 queue_free，销毁即离开组）。
func _active_collectible_count() -> int:
	var count: int = 0
	for node in get_tree().get_nodes_in_group("collectibles"):
		var collectible := node as Collectible
		if collectible != null and collectible.is_active():
			count += 1
	return count


## 按编号取收集物（收集物会在收集后销毁，不缓存引用，逐帧查组）。
func _collectible_by_id(id: int) -> Collectible:
	for node in get_tree().get_nodes_in_group("collectibles"):
		var collectible := node as Collectible
		if collectible != null and collectible.id == id:
			return collectible
	return null


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


func _report() -> void:
	if _failures.is_empty():
		print("GODOT_SMOKE: PASS 场景实例化/autoload/输入映射与键位契约/物理移动/信号送达/收集计数/过关判定/难度梯度/超时失败/失败重来 全部通过")
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
	_won_seen = true


func _on_game_over_seen(_score: int) -> void:
	_over_seen = true


func _on_level_started_seen(_level: int, _target: int, _time_limit: float) -> void:
	_level_started_seen = true
