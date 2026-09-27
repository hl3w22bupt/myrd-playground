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
##   2. autoload GameState / Juice 已注册且带约定信号
##   3. InputMap 动作已注册 + 键位契约逐键核对 + 注入输入后飞船真的移动了
##   4. 信号真的到达订阅方（moved / score_changed / speed_changed / hp_changed / run_ended / run_started）
##   5. 每项失败给出可读原因
##   6. 结果性事件真的挂了反馈（Juice.events 非空 + 具体 sfx 记录，SKILL.md §3B）
##   7. 调参协议可判（TUNING_META 非空 / apply_tuning 钳制与未知键拒绝 / load_config 回基准，§3C）
##   本作专项：真实拾取水晶提速 110 → 公式扫描 150 / 封顶 200 / 封顶后 +50 分；
##   生成频率随档位收紧（核心循环 5）；陨石命中 HP-1 + N 清零回 V0 + 1s 无敌（无敌期免伤）；
##   到终点结算四项数据（胜）；三连命中 HP 归零结算（败，理由 destroyed）——胜/败反馈
##   （标题文案/配色 + win/fail 音效）各自断言；结算后 confirm 重开复位；
##   三色陨石（红/黄/蓝）均按配置生成且颜色互异；边界钳制不越可视区；无输入时飞船保持位置。
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
## 边界钳制后按住 move_right 的帧数（钳制每物理帧都跑，1 帧即生效，取 3 留余量）。
const BOUNDARY_FRAMES: int = 3
## 无输入保持位置观察窗帧数。
const HOLD_FRAMES: int = 8
## 总帧预算（须 < 门禁 GODOT_SMOKE_FRAMES=240 的 --quit-after 兜底）。
const TOTAL_FRAMES: int = 112
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
const JuiceScript := preload("res://autoload/juice.gd")

var _failures: PackedStringArray = []
var _frames: int = 0
var _finished: bool = false
var _player: Player
var _main: MainScript
var _game_state: GameStateScript
var _juice: JuiceScript
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

	_juice = get_tree().root.get_node_or_null("Juice") as JuiceScript
	if _juice == null:
		_failures.append("autoload Juice 未注册（project.godot [autoload] 缺失，或 juice.gd 解析失败）")
	_check_tuning_protocol()

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
	elif _frames == 75:
		# 败局路径（真实碰撞）：蓝色陨石贴脸，三连命中把 HP 打光（每次命中后清无敌加速）
		_main.spawn_meteor(_player.global_position, 2)
	elif _frames == 79:
		if int(_game_state.hp) != 2:
			_failures.append("败局路径第 1 次命中后 HP 应为 2，实测 %d" % int(_game_state.hp))
		_game_state.invincible_until_sec = _game_state.run_time_sec
		_main.spawn_meteor(_player.global_position, 2)
	elif _frames == 83:
		if int(_game_state.hp) != 1:
			_failures.append("败局路径第 2 次命中后 HP 应为 1，实测 %d" % int(_game_state.hp))
		_game_state.invincible_until_sec = _game_state.run_time_sec
		_main.spawn_meteor(_player.global_position, 2)
	elif _frames == 87:
		_assert_destroyed_result()
	elif _frames == 88:
		_press_action(&"confirm")
	elif _frames == 88 + RESTART_FRAMES:
		_assert_restart()
	elif _frames == 93:
		_assert_three_meteor_colors()
		# 边界钳制：把飞船丢出可视区外 + 注入向右输入，钳制必须在可视区内兜住（手感验收）
		_player.global_position = Vector2(-100.0, 500.0)
		Input.action_press(&"move_right")
	elif _frames == 93 + BOUNDARY_FRAMES:
		Input.action_release(&"move_right")
		_assert_boundary_clamp()
		_player.reset_to(Vector2(_main.get_viewport_rect().size.x * 0.5, _main.get_viewport_rect().size.y * 0.72))
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
	# 模板冒烟第 6 项：结果性事件必须真的挂了反馈（收集 → pop / 音效 / 粒子至少其一）
	if _juice == null or _juice.events.is_empty():
		_failures.append("反馈断言：拾取水晶后 Juice.events 仍为空（反馈接线断裂，SKILL.md §3B）")
	elif not _juice_has_event("sfx:pickup"):
		_failures.append("反馈断言：拾取水晶未触发 pickup 音效记录（Juice.sfx 未接或 SFX_BANK 未注册）")


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
	_assert_spawn_frequency_tightens()


## 生成频率随档位同步收紧（需求核心循环 5）：同一基准间隔下 N=10 的收紧间隔应 < N=0，
## 且数值与公式 (base / (1 + slope×N)) 一致（纯函数，无抖动分量，可精确断言）。
func _assert_spawn_frequency_tightens() -> void:
	var base: float = _game_state.meteor_spawn_interval
	var slope: float = float(_game_state.config["meteor"]["tightenSlope"])
	var at_start: float = _main.tighten(base, slope, 0)
	var at_cap: float = _main.tighten(base, slope, 10)
	if at_cap >= at_start:
		_failures.append("生成频率未随档位收紧（核心循环 5）：N=10 间隔 %.3fs 应 < N=0 间隔 %.3fs" % [at_cap, at_start])
	var expected_cap: float = base / (1.0 + slope * 10.0)
	if absf(at_cap - expected_cap) > EPSILON:
		_failures.append("收紧公式不符：N=10 间隔应 %.3fs（base/(1+slope×10)），实测 %.3fs" % [expected_cap, at_cap])
	if absf(at_start - base) > EPSILON:
		_failures.append("N=0 间隔应等于基准 %.3fs，实测 %.3fs" % [base, at_start])


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
	_assert_result_feedback(true)
	if not _score_never_decreased:
		_failures.append("总分出现回退（应随水晶数单调递增）")


## 胜/败反馈断言（验收 4「失败与胜利反馈明确」）：标题文案 + 标题配色 + 对应音效记录。
func _assert_result_feedback(win: bool) -> void:
	var title := _main.get_node("%ResultTitle") as Label
	var expected_text := "到达终点！" if win else "飞船损毁…"
	if title.text != expected_text:
		_failures.append("结算标题应「%s」，实测「%s」" % [expected_text, title.text])
	var expected_color: Color = MainScript.WIN_TITLE_COLOR if win else MainScript.LOSE_TITLE_COLOR
	var actual_color: Color = title.get_theme_color("font_color")
	if actual_color != expected_color:
		_failures.append("结算标题配色未区分胜负：应 %s，实测 %s" % [expected_color, actual_color])
	var sfx_name := "sfx:win" if win else "sfx:fail"
	if not _juice_has_event(sfx_name):
		_failures.append("结算音效缺失：Juice.events 无 %s 记录（胜负反馈不明确）" % sfx_name)
	if not win and not _juice_has_event("hit_stop"):
		_failures.append("败局缺少顿帧反馈（hit_stop 未触发）")


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
	if not _juice_has_event("sfx:confirm"):
		_failures.append("重开确认无反馈：Juice.events 无 sfx:confirm 记录")
	for child in _main.get_node("Entities").get_children():
		if child is Meteor:
			_failures.append("重开后上一局陨石未清理")
			break


## 败局结算（验收 4：失败反馈明确）：HP 归零 → reason=destroyed → 面板 + 败方标题/配色/音效。
func _assert_destroyed_result() -> void:
	if int(_game_state.hp) != 0:
		_failures.append("三连命中后 HP 应为 0，实测 %d" % int(_game_state.hp))
	if _game_state.phase != _game_state.Phase.ENDED:
		_failures.append("HP 归零后应进入 ENDED 结算，实测 phase=%d" % int(_game_state.phase))
		return
	var result: Dictionary = _game_state.last_result
	if str(result.get("reason", "")) != "destroyed":
		_failures.append("败局结算 reason 应为 destroyed，实测 %s" % str(result.get("reason", "")))
	var result_panel := _main.get_node("%ResultPanel") as Panel
	if not result_panel.visible:
		_failures.append("败局结算面板未显示")
	_assert_result_feedback(false)


## 三色陨石（验收 2：≥3 种颜色且肉眼可辨 → 机判三类齐全、颜色互异、半径落在配置区间、
## 碰撞余量在验收容差内）。生成在屏外高空并立即回收，不干扰后续断言。
func _assert_three_meteor_colors() -> void:
	var types: Array = _game_state.config["meteor"]["types"]
	if types.size() < 3:
		_failures.append("验收 2：陨石类型应 ≥3 种，配置实际 %d 种" % types.size())
		return
	var expected_keys := ["red", "yellow", "blue"]
	var colors: Dictionary = {}
	for i in 3:
		var meteor: Meteor = _main.spawn_meteor(Vector2(60.0 + 60.0 * float(i), -1200.0), i)
		var cfg: Dictionary = types[i]
		if meteor.type_key != expected_keys[i]:
			_failures.append("陨石类型 %d 应为 %s，实测 %s" % [i, expected_keys[i], meteor.type_key])
		if meteor.radius < float(cfg["radiusMin"]) - EPSILON or meteor.radius > float(cfg["radiusMax"]) + EPSILON:
			_failures.append("陨石 %s 半径 %.1f 超出配置区间 [%.0f, %.0f]" % [
				meteor.type_key, meteor.radius, float(cfg["radiusMin"]), float(cfg["radiusMax"]),
			])
		colors[meteor.type_key] = meteor.body_color
		meteor.queue_free()
	if colors.size() < 3:
		_failures.append("验收 2：三色陨石颜色应互不相同，实测 %d 种（%s）" % [colors.size(), str(colors.keys())])
	var margin_ratio: float = absf(1.0 - Meteor.COLLISION_RADIUS_RATIO)
	if margin_ratio > 0.10:
		_failures.append("陨石碰撞余量 %.0f%% 超过验收 2 的 10%% 容差" % (margin_ratio * 100.0))


## 边界钳制（手感验收：推到边上不卡死角、不飞出屏）：飞船被丢出可视区外后，
## 钳制必须把它兜回 margin 内侧。
func _assert_boundary_clamp() -> void:
	if _player == null:
		return
	var rect := _main.get_viewport_rect()
	var margin: float = _game_state.player_margin()
	var pos := _player.global_position
	if pos.x < rect.position.x + margin - 0.5 or pos.x > rect.end.x - margin + 0.5 \
			or pos.y < rect.position.y + margin - 0.5 or pos.y > rect.end.y - margin + 0.5:
		_failures.append("边界钳制失效：飞船 %s 超出可视区（margin=%.0f，可视区 %s）" % [pos, margin, rect])


## Juice 事件表里是否存在某前缀的记录（如 "sfx:pickup" / "sfx:win"）。
func _juice_has_event(prefix: String) -> bool:
	if _juice == null:
		return false
	for event in _juice.events:
		if String(event).begins_with(prefix):
			return true
	return false


## 调参协议（模板冒烟第 7 项，SKILL.md §3C）：META 非空；apply_tuning 应用已声明键并按
## max 钳制；未声明键拒绝；load_config 后回到配置基准。纯逻辑，无头可判。
func _check_tuning_protocol() -> void:
	if _game_state == null:
		return
	if _game_state.TUNING_META.is_empty():
		_failures.append("调参协议：TUNING_META 为空（§3C 要求变量 + META 成对声明）")
		return
	var applied := _game_state.apply_tuning({"move_speed": 99999.0})
	if not applied.has("move_speed"):
		_failures.append("调参协议：apply_tuning 未应用已声明键 move_speed")
	var max_move_speed: float = float(_game_state.TUNING_META[&"move_speed"]["max"])
	if absf(_game_state.move_speed - max_move_speed) > 0.001:
		_failures.append("调参协议：move_speed 未按 max=%.0f 钳制，实测 %.1f" % [max_move_speed, _game_state.move_speed])
	var rejected := _game_state.apply_tuning({"not_a_tuning_key": 42.0})
	if not rejected.is_empty():
		_failures.append("调参协议：未声明键 not_a_tuning_key 不应被应用")
	_game_state.load_config()
	var base_move_speed: float = float(_game_state.config["player"]["moveSpeed"])
	if absf(_game_state.move_speed - base_move_speed) > 0.001:
		_failures.append("调参协议：load_config 后 move_speed 未回到配置基准 %.0f，实测 %.1f" % [
			base_move_speed, _game_state.move_speed,
		])


func _assert_no_input_hold_position() -> void:
	if _player == null:
		return
	var travelled: float = _player.global_position.distance_to(_restart_pos)
	if travelled > 0.5:
		_failures.append("无输入时飞船应保持位置随场景前进（实测漂移 %.2fpx）" % travelled)


func _report() -> void:
	if _failures.is_empty():
		print("GODOT_SMOKE: PASS 场景实例化/输入映射/键位契约/信号/物理移动/收集提速(110·150·200·+50)/频率收紧/命中清零回V0+无敌/胜负结算(四项+文案配色+音效)/败局destroyed/重开/三色陨石/边界钳制/Juice反馈/调参协议 全部通过")
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
