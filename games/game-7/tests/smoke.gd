extends Node
## 无头冒烟自检（headless smoke）—— 星云穿行 game-7。
##
## 运行方式（由 std-skills/godot-game-dev/scripts/smoke.sh 封装）：
##   godot --headless --path <工程目录> --quit-after 240 tests/smoke.tscn
##
## 判定协议（与模板一致）：
##   通过 → stdout 打印 `GODOT_SMOKE: PASS ...`，进程退出码 0
##   失败 → stderr 打印 `GODOT_SMOKE: FAIL <原因>`（每条一行），进程退出码 1
##
## 断言覆盖（模板五项 + 本作验收映射，需求 cmujmowd6003bm99i5zjlwlzz）：
##   1. 主场景可实例化（main.tscn → player.tscn / meteor / crystal 接线未断）
##   2. autoload GameState 已注册且带约定信号
##   3. InputMap 动作已注册 + 键位契约逐键核对 + 注入输入后飞船真的移动了
##   4. 信号真的到达订阅方（moved / score_changed / speed_changed / hp_changed / run_ended / run_started）
##   5. 每项失败给出可读原因
##   本作专项：真实拾取水晶提速 110 → 公式扫描 150 / 封顶 200 / 封顶后 +50 分；
##   陨石命中 HP-1 + N 清零回 V0 + 1s 无敌（无敌期免伤）；到终点结算四项数据；
##   结算后 confirm 重开复位；无输入时飞船保持位置。
##
## ⚠️ 输入注入分帧（error-signatures E-08）：parse_input_event 会冲刷 action_press 状态，
##    噪声相位 / 移动断言 / confirm 注入分帧执行。

## ── 噪声相位（输入鲁棒性）：确定种子的对抗输入，随后断言照常全过 = 输入管线未被楔死 ──
const NOISE_FRAMES: int = 30
## 阶段一：按住 move_right 的帧数。
const MOVE_FRAMES: int = 10
## 移动断言后等待 score_changed 自然到达的帧数（得分增速 10/s，~6 帧内必有整数跳变）。
const SCORE_WAIT_FRAMES: int = 6
## 等待 Area2D 重叠判定的帧数（物理同步 1~2 帧，留余量）。
const OVERLAP_FRAMES: int = 4
## 结算后等待重开生效的帧数。
const RESTART_FRAMES: int = 4
const TOTAL_FRAMES: int = 84
const MIN_MOVE_DISTANCE: float = 1.0
const EPSILON: float = 0.01

const REQUIRED_ACTIONS: Array[StringName] = [
	&"move_left", &"move_right", &"move_up", &"move_down", &"confirm",
]

## 键位契约：动作 → 键表承诺的物理键，全部绑定（AND 语义，逐键核对）。
const KEY_CONTRACT: Dictionary = {
	&"move_left": [KEY_A, KEY_LEFT],
	&"move_right": [KEY_D, KEY_RIGHT],
	&"move_up": [KEY_W, KEY_UP],
	&"move_down": [KEY_S, KEY_DOWN],
	&"confirm": [KEY_SPACE, KEY_ENTER],
}

## 用 preload 常量做静态类型（避免对 Node 裸类型做动态成员访问）。
const GameStateScript := preload("res://autoload/game_state.gd")
const MainScript := preload("res://scripts/main.gd")

var _failures: PackedStringArray = []
var _frames: int = 0
var _finished: bool = false
var _player: Player
var _main: MainScript
var _game_state: GameStateScript
var _origin: Vector2 = Vector2.ZERO
var _restart_pos: Vector2 = Vector2.ZERO
var _moved_seen: bool = false
var _score_seen: bool = false
var _speed_seen: bool = false
var _hp_seen: bool = false
var _player_hit_seen: bool = false
var _run_ended_seen: bool = false
var _run_started_seen: bool = false
var _score_never_decreased: bool = true
var _last_score: int = 0
var _score_before_cap_bonus: int = 0
var _noise_rng := RandomNumberGenerator.new()


func _ready() -> void:
	# headless 无垂直同步：限 60 FPS 让 process : physics ≈ 1:1，--quit-after 兜底才有意义。
	Engine.max_fps = 60

	for action in REQUIRED_ACTIONS:
		if not InputMap.has_action(action):
			_failures.append("InputMap 缺少动作 %s（project.godot [input] 未注册）" % action)
	_check_key_bindings()

	_game_state = get_tree().root.get_node_or_null("GameState") as GameStateScript
	if _game_state == null:
		_failures.append("autoload GameState 未注册（project.godot [autoload] 缺失）")
	else:
		for signal_name: String in ["score_changed", "hp_changed", "speed_changed", "player_hit", "run_ended", "run_started"]:
			if not _game_state.has_signal(signal_name):
				_failures.append("autoload GameState 缺少信号 %s" % signal_name)
		_game_state.score_changed.connect(_on_score_changed)
		_game_state.hp_changed.connect(_on_hp_changed)
		_game_state.player_hit.connect(_on_player_hit)
		_game_state.speed_changed.connect(_on_speed_changed)
		_game_state.run_ended.connect(_on_run_ended)
		_game_state.run_started.connect(_on_run_started)

	_main = get_tree().root.find_child("Main", true, false) as MainScript
	if _main == null:
		_failures.append("场景树找不到 Main（smoke.tscn 未实例化 main.tscn）")
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
	if not _failures.is_empty():
		_finished = true
		_report()
		return

	if _frames <= NOISE_FRAMES:
		_inject_noise_frame()
	elif _frames == NOISE_FRAMES + 1:
		# 清掉噪声相位可能残留的按下强度，再注入确定性移动（E-08：分帧）
		for action: StringName in [&"move_left", &"move_right", &"move_up", &"move_down"]:
			Input.action_release(action)
		Input.action_press(&"move_right")
	elif _frames == NOISE_FRAMES + MOVE_FRAMES:
		Input.action_release(&"move_right")
		_assert_player_moved()
	elif _frames == NOISE_FRAMES + MOVE_FRAMES + SCORE_WAIT_FRAMES:
		_assert_score_and_base_speed()
	elif _frames == 48:
		# 真实拾取路径：把水晶生成在飞船位置，等物理重叠判定
		_main.spawn_crystal(_player.global_position)
	elif _frames == 48 + OVERLAP_FRAMES:
		_assert_real_crystal_pickup()
	elif _frames == 53:
		_assert_speed_formula_scan()
	elif _frames == 56:
		_main.spawn_meteor(_player.global_position, 0)
	elif _frames == 56 + OVERLAP_FRAMES:
		_assert_meteor_hit()
	elif _frames == 61:
		_main.spawn_meteor(_player.global_position, 1)
	elif _frames == 65:
		_assert_invincible_shield()
	elif _frames == 66:
		_game_state.run_time_sec = float(_game_state.config["run"]["timeLimitSec"]) - 0.001
	elif _frames == 68:
		_assert_arrived_result()
	elif _frames == 69:
		_press_action(&"confirm")
	elif _frames == 69 + RESTART_FRAMES:
		_assert_restart()
		_restart_pos = _player.global_position
	elif _frames == TOTAL_FRAMES:
		_assert_no_input_hold_position()
		_report()
		_finished = true
		return

	if _frames >= TOTAL_FRAMES:
		_finished = true
		_report()


## ── 噪声相位（与模板一致：只注入原始事件，不注入 InputEventAction）──

func _inject_noise_frame() -> void:
	if _frames == 1:
		_noise_rng.seed = 20260913
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


## 无显示设备时模拟「玩家按键」：注入真实 InputEvent，让 _unhandled_input 收得到。
func _press_action(action: StringName) -> void:
	var event := InputEventAction.new()
	event.action = action
	event.pressed = true
	Input.parse_input_event(event)


## ── 键位契约（逐键 AND 核对，合法例外层）──

func _check_key_bindings() -> void:
	for action: StringName in KEY_CONTRACT:
		if not InputMap.has_action(action):
			continue
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


## ── 断言 ──

func _assert_player_moved() -> void:
	if _player == null:
		return
	var travelled: float = _player.global_position.distance_to(_origin)
	if travelled < MIN_MOVE_DISTANCE:
		_failures.append("玩家 %d 帧内位移 %.2fpx < %.2fpx：InputMap 动作未生效或 _physics_process 未驱动 velocity" % [
			MOVE_FRAMES, travelled, MIN_MOVE_DISTANCE,
		])
	if not _moved_seen:
		_failures.append("信号 Player.moved 未到达订阅方：连接断裂或从未 emit")


func _assert_score_and_base_speed() -> void:
	if not _score_seen:
		_failures.append("信号 GameState.score_changed 未到达订阅方（开局计分增速未生效）")
	var base: float = float(_game_state.config["speed"]["base"])
	if absf(_game_state.speed() - base) > EPSILON:
		_failures.append("开局速度应为 V0=%.0f px/s，实测 %.2f" % [base, _game_state.speed()])
	if _game_state.speed_label() != "1.0x":
		_failures.append("开局 HUD 档位应显示 1.0x，实测 %s" % _game_state.speed_label())


## 真实拾取路径：crystal.body_entered → collected → Main → GameState.collect_crystal
func _assert_real_crystal_pickup() -> void:
	if int(_game_state.total_crystals) != 1:
		_failures.append("真实拾取未生效：累计水晶应为 1，实测 %d（collected 接线断裂或碰撞盒不重叠）" % int(_game_state.total_crystals))
		return
	if int(_game_state.crystal_streak) != 1:
		_failures.append("拾取后 N 应为 1，实测 %d" % int(_game_state.crystal_streak))
	var expected: float = float(_game_state.config["speed"]["base"]) * (1.0 + float(_game_state.config["speed"]["step"]))
	if absf(_game_state.speed() - expected) > EPSILON:
		_failures.append("N=1 实测速度应 %.1f px/s（验收 3），实测 %.2f" % [expected, _game_state.speed()])
	if not _speed_seen:
		_failures.append("信号 GameState.speed_changed 未到达订阅方")


## 公式扫描：N=5 → 150；N=10 → 封顶 200；封顶后每颗 +50 分（验收 3）
func _assert_speed_formula_scan() -> void:
	for i in 4:
		_game_state.collect_crystal()
	if int(_game_state.crystal_streak) != 5 or absf(_game_state.speed() - 150.0) > EPSILON:
		_failures.append("N=5 应为档位 1.5x / 速度 150 px/s（验收 3 采样点），实测 N=%d 速度 %.2f" % [
			int(_game_state.crystal_streak), _game_state.speed(),
		])
	for i in 5:
		_game_state.collect_crystal()
	if int(_game_state.crystal_streak) != 10 or absf(_game_state.speed() - 200.0) > EPSILON:
		_failures.append("N=10 应封顶 2.0x / 200 px/s，实测 N=%d 速度 %.2f" % [
			int(_game_state.crystal_streak), _game_state.speed(),
		])
	_score_before_cap_bonus = _game_state.score_int()
	_game_state.collect_crystal()
	var bonus: int = int(_game_state.config["speed"]["capBonusScore"])
	if _game_state.score_int() - _score_before_cap_bonus != bonus:
		_failures.append("封顶后每颗水晶应 +%d 分，实测 +%d" % [bonus, _game_state.score_int() - _score_before_cap_bonus])
	if not _game_state.cap_reached():
		_failures.append("N=10 后 cap_reached() 应为 true")
	var stats_label := _main.get_node("%StatsLabel") as Label
	if not stats_label.text.contains(_game_state.speed_label()):
		_failures.append("HUD 档位未随实测速度刷新（应含 %s，误差要求 ≤5%%）：%s" % [_game_state.speed_label(), stats_label.text])


## 真实命中路径：meteor.body_entered → hit_player → Main → GameState.take_hit
func _assert_meteor_hit() -> void:
	if int(_game_state.hp) != 2:
		_failures.append("被陨石命中后 HP 应为 2，实测 %d（hit_player → take_hit 接线断裂？）" % int(_game_state.hp))
		return
	if int(_game_state.crystal_streak) != 0:
		_failures.append("被击中后累计水晶应清零，实测 %d" % int(_game_state.crystal_streak))
	var base: float = float(_game_state.config["speed"]["base"])
	if absf(_game_state.speed() - base) > EPSILON:
		_failures.append("被击中后速度应重置为 V0=%.0f px/s，实测 %.2f（验收 2）" % [base, _game_state.speed()])
	if not _game_state.invincible_active():
		_failures.append("被击中后应进入 1s 无敌（验收 2）")
	elif _game_state.invincible_remaining_sec() > float(_game_state.config["hit"]["invincibleSec"]) + EPSILON:
		_failures.append("无敌时长超过配置值：%.2fs" % _game_state.invincible_remaining_sec())
	if not _player_hit_seen or not _hp_seen:
		_failures.append("信号 player_hit / hp_changed 未到达订阅方")


func _assert_invincible_shield() -> void:
	if int(_game_state.hp) != 2:
		_failures.append("无敌期被陨石命中不应扣血：HP 应保持 2，实测 %d" % int(_game_state.hp))
	_game_state.invincible_until_sec = _game_state.run_time_sec


func _assert_arrived_result() -> void:
	if _game_state.phase != _game_state.Phase.ENDED:
		_failures.append("到达时限后应进入 ENDED 结算，实测 phase=%d" % int(_game_state.phase))
		return
	if not _run_ended_seen:
		_failures.append("信号 GameState.run_ended 未到达订阅方")
	var result: Dictionary = _game_state.last_result
	if str(result.get("reason", "")) != "arrived":
		_failures.append("结算 reason 应为 arrived，实测 %s" % str(result.get("reason", "")))
	for key: String in ["survivedSec", "crystals", "maxSpeedMultiplier", "score"]:
		if not result.has(key):
			_failures.append("结算数据缺字段 %s（验收 4：四项数据）" % key)
	if int(result.get("crystals", 0)) <= 0:
		_failures.append("结算水晶数应 >0（总分随水晶数单调递增的前置）")
	if int(result.get("score", 0)) <= 0:
		_failures.append("结算总分应 >0")
	if float(result.get("maxSpeedMultiplier", 0.0)) < 2.0:
		_failures.append("结算最高速度应 ≥2.0x，实测 %.1fx" % float(result.get("maxSpeedMultiplier", 0.0)))
	var result_panel := _main.get_node("%ResultPanel") as Panel
	if not result_panel.visible:
		_failures.append("结算面板未显示")
	var stats_text := (_main.get_node("%ResultStats") as Label).text
	for token: String in ["存活", "水晶", "最高速度", "总分"]:
		if not stats_text.contains(token):
			_failures.append("结算页缺数据项「%s」：%s" % [token, stats_text])
	if not _score_never_decreased:
		_failures.append("总分出现回退（应随水晶数单调递增）")


func _assert_restart() -> void:
	if _game_state.phase != _game_state.Phase.PLAYING:
		_failures.append("结算后 confirm 应重开（PLAYING），实测 phase=%d" % int(_game_state.phase))
		return
	if not _run_started_seen:
		_failures.append("信号 GameState.run_started 未到达订阅方")
	if int(_game_state.hp) != int(_game_state.config["hit"]["hp"]):
		_failures.append("重开后 HP 未复位为 %d，实测 %d" % [int(_game_state.config["hit"]["hp"]), int(_game_state.hp)])
	if _game_state.score_int() != 0:
		_failures.append("重开后总分未清零，实测 %d" % _game_state.score_int())
	if int(_game_state.crystal_streak) != 0:
		_failures.append("重开后 N 未清零，实测 %d" % int(_game_state.crystal_streak))
	if int(_game_state.total_crystals) != 0:
		_failures.append("重开后累计水晶未清零，实测 %d" % int(_game_state.total_crystals))
	if absf(_game_state.speed() - float(_game_state.config["speed"]["base"])) > EPSILON:
		_failures.append("重开后速度未回 V0，实测 %.2f" % _game_state.speed())
	if (_main.get_node("%ResultPanel") as Panel).visible:
		_failures.append("重开后结算面板未隐藏")
	for child in _main.get_node("Entities").get_children():
		if child is Meteor:
			_failures.append("重开后上一局陨石未清理")
			break


func _assert_no_input_hold_position() -> void:
	if _player == null:
		return
	var travelled: float = _player.global_position.distance_to(_restart_pos)
	if travelled > 0.5:
		_failures.append("无输入时飞船应保持位置随场景前进（实测漂移 %.2fpx）" % travelled)


func _report() -> void:
	if _failures.is_empty():
		print("GODOT_SMOKE: PASS 场景实例化/输入映射/键位契约/信号/物理移动/收集提速(110·150·200·+50)/命中清零回V0+无敌/结算四项/重开 全部通过")
		get_tree().quit(0)
	else:
		for failure in _failures:
			printerr("GODOT_SMOKE: FAIL %s" % failure)
		get_tree().quit(1)


## ── 信号处理（订阅方在冒烟场景，验证信号真的到达）──

func _on_player_moved(_position: Vector2) -> void:
	_moved_seen = true


func _on_score_changed(score: int) -> void:
	_score_seen = true
	if score < _last_score:
		_score_never_decreased = false
	_last_score = score


func _on_hp_changed(_hp: int) -> void:
	_hp_seen = true


func _on_player_hit(_hp: int) -> void:
	_player_hit_seen = true


func _on_speed_changed(_speed: float) -> void:
	_speed_seen = true


func _on_run_ended(_result: Dictionary) -> void:
	_run_ended_seen = true


func _on_run_started() -> void:
	_run_started_seen = true
