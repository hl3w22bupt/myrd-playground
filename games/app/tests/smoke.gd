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
## 覆盖面（模板五项断言 + 本游戏验收映射，全部走真实接线）：
##   1. 场景可实例化（main.tscn → player.tscn 接线未断裂）
##   2. autoload 已注册且带约定信号（GameState + Juice 模板协议）
##   3. InputMap 动作注册、物理键绑定逐键核对（键位契约），注入输入后飞船真的动了
##   4. 核心交互：水晶拾取 → 计分 + 音效接线 + Juice 反馈；连击 5 → 加速态 135px/s ×2
##   5. 胜负可达：陨石撞击扣盾 → 无敌闪烁 → 归零结算（面板四项数据）
##   6. 重开可用：confirm 一键重置（分数/护盾/速度/加速/场景实体清空，最高分保留）
##   7. 加速外显：拉丝显示 + 105% 变焦（进入 0.3s），退出后复位隐藏（退出 0.5s）
##   8. 生成规则（验收 4）：难度档位表 D(t)、陨石速度系数 k(D)、同屏上限 cap(D)=3+2D
##      （加速态 +2）、生成间隔衰减、生成约束（避开飞船 ±80px / 实体间距 ≥ 大者半径 ×1.5）、
##      生成器硬截断、水晶航路漂移
##
## ⚠️ 输入注入分阶段互不重叠（references/error-signatures.md E-08）：
##   headless 下 `Input.parse_input_event()` 的缓冲冲刷会清掉 `Input.action_press()`
##   的按下状态，两者同帧混用会让「移动断言」假失败。

## ── 噪声相位（输入鲁棒性门禁的逐游戏语义层）──
## 正式断言前注入一段确定种子的对抗输入：悬挂手势、孤儿释放、双指抢控、乱键。
## 随后照常执行移动/收集断言 —— 断言仍全过 = 噪声没有楔死输入管线。
## 只注入原始事件（Key/Mouse/Touch），不注入 InputEventAction。
const NOISE_FRAMES: int = 30

## 阶段一：按住 move_right 让飞船移动的帧数。
const MOVE_FRAMES: int = 10
## 等待拾取 / 撞击物理注册的帧数。
const COLLECT_FRAMES: int = 8
const HIT_FRAMES: int = 8
## 重开 confirm 后等待场景清空的帧数。
const RESTART_FRAMES: int = 8
## 加速触发后等变焦/拉丝进入过渡（0.3s）播完再断言外显的帧数。
const BOOST_FX_WAIT_FRAMES: int = 18
## 加速态保持时长（秒）：拉长到覆盖「外显开启」断言窗口，再走真实退出链路。
const BOOST_ALIVE_SEC: float = 1.0
## 加速态触发帧（噪声 30 + 移动 10 + 拾取 8 之后第 2 帧）。
const BOOST_START_FRAME: int = NOISE_FRAMES + MOVE_FRAMES + COLLECT_FRAMES + 2
## 加速态结束帧（boost_time_left 由本相位改为 BOOST_ALIVE_SEC）。
const BOOST_END_FRAME: int = BOOST_START_FRAME + int(BOOST_ALIVE_SEC * 60.0)
## 外显开启断言帧（进 0.3s 过渡完成 + 余量）。
const FX_ON_FRAME: int = BOOST_START_FRAME + BOOST_FX_WAIT_FRAMES
## 外显关闭断言帧（退出 0.5s 过渡完成 + 余量）。
const FX_OFF_FRAME: int = BOOST_END_FRAME + 34
## 退出缓动断言帧（加速结束后 ~1.13s，cubic ease-out 已把速度压回 100±2）。
const EASED_OUT_FRAME: int = BOOST_END_FRAME + 68
## 胜负链路的陨石生成帧（缓动断言之后）。
const HIT_SPAWN_FRAME: int = EASED_OUT_FRAME + 2
## 重开断言后的「生成规则」相位锚点帧（验收 4 专属）。
const GEN_RULES_FRAME: int = HIT_SPAWN_FRAME + HIT_FRAMES + 2 + RESTART_FRAMES + 2
## 水晶漂移断言的等待帧数（20 帧 ≈ 0.33s，预期漂移 ≈11.7px）。
const DRIFT_WAIT_FRAMES: int = 20
## 水晶漂移判定的最小位移（像素）。
const MIN_DRIFT_DISTANCE: float = 4.0
## 总帧数上限（超过即出报告，防止死循环；smoke.sh 另有 --quit-after 兜底）。
const TOTAL_FRAMES: int = 226
## 判定「真的移动了」的最小位移（像素）。
const MIN_MOVE_DISTANCE: float = 10.0
## 加速态速度断言带宽：135 ± 5（知识基准 5.3：实测 ≥130 即达标 +30%）。
const BOOST_SPEED_EXPECTED: float = 135.0
const BOOST_SPEED_TOLERANCE: float = 5.0
## 加速退出回落断言带宽：100 ± 2。
const BASE_SPEED_TOLERANCE: float = 2.0

const REQUIRED_ACTIONS: Array[StringName] = [
	&"move_left", &"move_right", &"move_up", &"move_down", &"confirm",
]

## 键位契约：动作 → 键表承诺的物理键，**必须全部绑定**（AND 语义，逐键核对）。
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
var _origin: Vector2 = Vector2.ZERO
var _best_before: int = 0
var _moved_seen: bool = false
var _score_seen: bool = false
var _shield_seen: bool = false
var _game_over_seen: bool = false
var _score_at_game_over: int = 0
var _drift_crystal: Crystal
var _drift_origin_y: float = 0.0


func _ready() -> void:
	# headless 没有垂直同步：限到 60 FPS 让 process 帧 : 物理帧 ≈ 1:1，
	# --quit-after 的兜底才有意义（模板同款，见模板 smoke.gd 注释）。
	Engine.max_fps = 60

	for action in REQUIRED_ACTIONS:
		if not InputMap.has_action(action):
			_failures.append("InputMap 缺少动作 %s（project.godot [input] 未注册）" % action)
	_check_key_bindings()

	var game_state := get_tree().root.get_node_or_null("GameState")
	if game_state == null:
		_failures.append("autoload GameState 未注册（project.godot [autoload] 缺失）")
	else:
		for signal_name in ["score_changed", "shield_changed", "combo_changed", "boost_changed", "game_finished"]:
			if not game_state.has_signal(signal_name):
				_failures.append("autoload GameState 缺少信号 %s" % signal_name)
		game_state.score_changed.connect(_on_score_changed)
		game_state.shield_changed.connect(_on_shield_changed)
		game_state.game_finished.connect(_on_game_over)

	var juice := get_tree().root.get_node_or_null("Juice")
	if juice == null:
		_failures.append("autoload Juice 未注册（模板协议缺失，反馈断言无从采样）")
	elif not juice.has_signal("feedback_fired"):
		_failures.append("autoload Juice 缺少信号 feedback_fired")
	else:
		juice.feedback_fired.connect(_on_feedback_fired)

	_main = get_tree().root.get_node_or_null("Smoke/Main") as Node2D
	if _main == null:
		_failures.append("冒烟场景找不到 Main 实例（tests/smoke.tscn 未实例化 scenes/main.tscn）")
		_report()
		return
	_player = _main.get_node_or_null("Player") as Player
	if _player == null:
		_failures.append("main.tscn 找不到 Player（player.tscn 未实例化，或实例名不是 Player）")
		_report()
		return
	_player.moved.connect(_on_player_moved)
	_best_before = GameState.best_score
	# 关掉自然生成，让拾取/撞击断言只对测试自己生成的实体负责（确定性）。
	_main.spawning_enabled = false


func _physics_process(_delta: float) -> void:
	if _finished:
		return
	_frames += 1

	if _failures.is_empty():
		if _frames <= NOISE_FRAMES:
			_inject_noise_frame()
		elif _frames == NOISE_FRAMES + 1:
			_origin = _player.global_position
			Input.action_press(&"move_right")
		elif _frames == NOISE_FRAMES + MOVE_FRAMES:
			Input.action_release(&"move_right")
			_assert_player_moved()
			# 拾取链路：在飞船当前位置生成水晶，等物理注册 overlap。
			_main.spawn_crystal(_player.global_position + Vector2(20, 0))
		elif _frames == NOISE_FRAMES + MOVE_FRAMES + COLLECT_FRAMES:
			_assert_crystal_collected()
			# 连击链：再登记 4 颗 → combo=5 触发加速态（验收 3）。
			for i: int in range(4):
				GameState.register_crystal_collected()
		elif _frames == BOOST_START_FRAME:
			_assert_boost_started()
			# 保持加速态 1.0s：外显断言窗口结束后再走真实的退出缓动（1.5s ease-out）。
			GameState.boost_time_left = BOOST_ALIVE_SEC
		elif _frames == FX_ON_FRAME:
			_assert_boost_fx_on()
		elif _frames == FX_OFF_FRAME:
			_assert_boost_fx_off()
		elif _frames == EASED_OUT_FRAME:
			_assert_boost_eased_out()
			# 胜负链路：真实生成陨石撞飞船（验收 2 的第一格盾）。
			_main.spawn_meteor(Meteor.Kind.NORMAL, 24.0, _player.global_position + Vector2(0, -30))
		elif _frames == HIT_SPAWN_FRAME + HIT_FRAMES:
			_assert_first_hit()
			# 第 2、3 格盾走状态机直拍（无敌帧已由断言清零）。
			GameState.invincible_time = 0.0
			GameState.take_hit()
			GameState.invincible_time = 0.0
			GameState.take_hit()
		elif _frames == HIT_SPAWN_FRAME + HIT_FRAMES + 2:
			_assert_game_over()
			_press_action(&"confirm")
		elif _frames == HIT_SPAWN_FRAME + HIT_FRAMES + 2 + RESTART_FRAMES:
			_assert_restarted()
		elif _frames == GEN_RULES_FRAME:
			_assert_generation_rules()
		elif _frames == GEN_RULES_FRAME + 2:
			_assert_meteor_cap_enforced()
		elif _frames == GEN_RULES_FRAME + 4:
			_drift_crystal = _main.spawn_crystal(Vector2(360.0, 300.0))
			_drift_origin_y = _drift_crystal.position.y
		elif _frames == GEN_RULES_FRAME + 4 + DRIFT_WAIT_FRAMES:
			_assert_crystal_drift()

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
func _press_action(action: StringName) -> void:
	var event := InputEventAction.new()
	event.action = action
	event.pressed = true
	Input.parse_input_event(event)


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


func _assert_player_moved() -> void:
	if _player == null:
		return
	var travelled: float = _player.global_position.distance_to(_origin)
	if travelled < MIN_MOVE_DISTANCE:
		_failures.append(
			"飞船 %d 帧内位移 %.2fpx < %.2fpx：InputMap 动作未生效或 _physics_process 未驱动 velocity（验收 1）" % [
				MOVE_FRAMES, travelled, MIN_MOVE_DISTANCE,
			]
		)


func _assert_crystal_collected() -> void:
	if GameState.crystals != 1:
		_failures.append("水晶拾取未生效：水晶数 %d ≠ 1（area 接线断裂或 collected 信号未达 main）" % GameState.crystals)
		return
	if GameState.score != GameState.SCORE_PER_CRYSTAL:
		_failures.append("拾取计分不符：分数 %d ≠ %d（验收 3 的 10 分/颗）" % [GameState.score, GameState.SCORE_PER_CRYSTAL])
	if not _score_seen:
		_failures.append("信号 GameState.score_changed 未到达冒烟订阅方（收集反馈断了）")
	var juice := get_tree().root.get_node_or_null("Juice")
	if juice == null or not (juice.sfx_counts.has(&"score")):
		_failures.append("拾取后 Juice 无 score 反馈事件（收集反馈缺失，验收 3）")
	elif not juice.SFX_BANK.has(&"score"):
		_failures.append("音效注册表缺 score（程序化拾取音效未接线，需求 3 收集反馈=音效/特效）")


func _assert_boost_started() -> void:
	if not GameState.boost_active:
		_failures.append("连击 %d 未触发加速态（验收 3：combo=5 触发）" % GameState.combo)
		return
	if absf(GameState.speed - BOOST_SPEED_EXPECTED) > BOOST_SPEED_TOLERANCE:
		_failures.append("加速态速度 %.1f 超出 %d±%d（验收 3：提速 ≥30%%）" % [GameState.speed, int(BOOST_SPEED_EXPECTED), int(BOOST_SPEED_TOLERANCE)])
	if GameState.multiplier != GameState.BOOST_SCORE_MULTIPLIER:
		_failures.append("加速态得分倍率 %d ≠ %d（验收 3：倍率翻倍）" % [GameState.multiplier, GameState.BOOST_SCORE_MULTIPLIER])
	if GameState.combo < GameState.COMBO_TRIGGER:
		_failures.append("连击计数 %d < 触发值 %d" % [GameState.combo, GameState.COMBO_TRIGGER])


func _assert_boost_fx_off() -> void:
	## 加速外显复位（退出 0.5s 过渡播完后）：拉丝隐藏、变焦回 100%（知识基准 4.2）。
	var lines := _main.speedlines as Speedlines
	if lines == null or lines.visible:
		_failures.append("加速退出后 speedline 拉丝仍显示（退出 0.5s 过渡应已完成并隐藏）")
	var camera := _main.camera_rig as Camera2D
	if camera == null or absf(camera.zoom.x - 1.0) > 0.01:
		var actual := 1.0 if camera == null else camera.zoom.x
		_failures.append("加速退出后变焦 %.3f 未回 100%%（验收 3：恢复基础状态）" % actual)


func _assert_boost_eased_out() -> void:
	if GameState.boost_active:
		_failures.append("加速态未按时退出（8s 时长 + 续时未按剩余时间耗尽）")
	if absf(GameState.speed - GameState.SPEED_BASE) > BASE_SPEED_TOLERANCE:
		_failures.append("加速退出后速度 %.1f 未回落到 %d±%d（验收 3：恢复基础速度）" % [
			GameState.speed, int(GameState.SPEED_BASE), int(BASE_SPEED_TOLERANCE)])
	if GameState.multiplier != 1:
		_failures.append("加速退出后倍率 %d ≠ 1（倍率应同步回落）" % GameState.multiplier)


func _assert_boost_fx_on() -> void:
	## 加速外显（知识基准 4.2）：拉丝过渡完成（进 0.3s）、变焦拉到 105%。
	var lines := _main.speedlines as Speedlines
	if lines == null or not lines.visible:
		_failures.append("加速态 speedline 拉丝未显示（加速外显缺失，知识基准 4.2）")
	elif lines.intensity < 0.95:
		_failures.append("加速拉丝过渡未完成：intensity %.2f < 0.95（进入 0.3s 过渡口径）" % lines.intensity)
	var camera := _main.camera_rig as Camera2D
	if camera == null:
		_failures.append("main.tscn 找不到 Camera（加速变焦与受击震动的载体缺失）")
	elif absf(camera.zoom.x - 1.05) > 0.01:
		_failures.append("加速变焦 %.3f 未达 105%%（进入 0.3s 过渡完成后应稳定在 1.05）" % camera.zoom.x)


func _assert_generation_rules() -> void:
	## 验收 4 / 知识基准 2.1~2.4：难度档位表、陨石速度系数、同屏上限、生成间隔、生成约束。
	var saved_time := GameState.run_time
	# 档位表 D(t) = min(6, 1 + floor(t/30))：边界 30s 必进档，150s 封顶。
	var cases: Array = [[0.0, 1], [29.9, 1], [30.0, 2], [90.0, 4], [149.9, 5], [150.0, 6], [400.0, 6]]
	for case: Array in cases:
		GameState.run_time = float(case[0])
		if GameState.difficulty() != int(case[1]):
			_failures.append("难度档位 D(%.1fs)=%d ≠ %d（验收 4 的难度梯度）" % [
				float(case[0]), GameState.difficulty(), int(case[1])])
	# 陨石速度系数 k(D)：D1 0.9x → D6 1.4x。
	GameState.run_time = 0.0
	if not is_equal_approx(GameState.meteor_speed_coeff(), 0.9):
		_failures.append("D1 陨石速度系数 %.2f ≠ 0.90（知识基准 2.1 档位表）" % GameState.meteor_speed_coeff())
	GameState.run_time = 150.0
	if not is_equal_approx(GameState.meteor_speed_coeff(), 1.4):
		_failures.append("D6 陨石速度系数 %.2f ≠ 1.40（知识基准 2.1 档位表）" % GameState.meteor_speed_coeff())
	# 同屏上限 cap(D) = 3 + 2D（验收 4「当前难度档位上限」），加速态 +2。
	GameState.run_time = 0.0
	if GameState.meteor_cap() != 5:
		_failures.append("D1 同屏上限 %d ≠ 5（cap=3+2D）" % GameState.meteor_cap())
	GameState.run_time = 150.0
	if GameState.meteor_cap() != 15:
		_failures.append("D6 同屏上限 %d ≠ 15（cap=3+2D）" % GameState.meteor_cap())
	GameState.boost_active = true
	GameState.boost_time_left = GameState.BOOST_DURATION_SEC
	if GameState.meteor_cap() != 17:
		_failures.append("加速态同屏上限 %d ≠ 15+2（知识基准 2.2 密度修正）" % GameState.meteor_cap())
	if GameState.meteor_spawn_interval() > 2.0 * pow(0.88, 5.0) * 0.85:
		_failures.append("加速态生成间隔未叠加 ×0.85 修正（知识基准 2.2）")
	GameState.boost_active = false
	GameState.boost_time_left = 0.0
	# 生成间隔衰减：D1 = 2.0s，D6 = 2.0 × 0.88^5。
	GameState.run_time = 0.0
	if not is_equal_approx(GameState.meteor_spawn_interval(), 2.0):
		_failures.append("D1 生成间隔 %.4f ≠ 2.0（知识基准 2.1）" % GameState.meteor_spawn_interval())
	GameState.run_time = 150.0
	var expected_d6 := 2.0 * pow(0.88, 5.0)
	if absf(GameState.meteor_spawn_interval() - expected_d6) > 0.001:
		_failures.append("D6 生成间隔 %.4f ≠ %.4f（0.88^(D-1) 衰减）" % [
			GameState.meteor_spawn_interval(), expected_d6])
	# 生成约束（验收 4）：飞船 ±80px 判定带拒收；实体间距 < 大者半径 ×1.5 拒收；合法位置放行。
	var guard: Meteor = _main.spawn_meteor(Meteor.Kind.NORMAL, 24.0, Vector2(360.0, 200.0))
	var band_pos: Vector2 = _player.global_position + Vector2(0.0, -60.0)
	if _main._respects_constraints(band_pos, 24.0):
		_failures.append("生成约束失效：飞船 ±80px 判定带内的位置被放行（验收 4 防刷脸杀）")
	if _main._respects_constraints(Vector2(360.0, 230.0), 24.0):
		_failures.append("生成约束失效：与屏内陨石间距 30px < 24×1.5=36px 被放行（验收 4 互不重叠）")
	if not _main._respects_constraints(Vector2(100.0, 500.0), 24.0):
		_failures.append("生成约束过严：远离飞船与实体的合法位置被拒（生成器会空转）")
	GameState.run_time = saved_time  # 恢复计时，后续相位保持 D1 口径


func _assert_meteor_cap_enforced() -> void:
	## 生成器硬截断（验收 4）：同屏陨石数 = cap(D) 时，生成器到点也不再生成。
	var saved_time := GameState.run_time
	GameState.run_time = 0.0  # 重开相位内保证 D1（cap=5）；结束恢复
	var cap := GameState.meteor_cap()
	var existing: int = _main._count_meteors()
	# 现有场内陨石（约束断言留下的 guard）+ 补齐到 cap 的占位陨石。
	while _main._count_meteors() < cap:
		var slot: int = _main._count_meteors()
		_main.spawn_meteor(Meteor.Kind.NORMAL, 20.0, Vector2(60.0 + 100.0 * float(slot), -60.0))
	if _main._count_meteors() != cap:
		_failures.append("占位陨石补齐失败：%d ≠ %d（测试前置问题）" % [_main._count_meteors(), cap])
	_main._meteor_timer = 0.0  # 让生成器「到点」
	_main._tick_meteor_spawner(0.016)
	if _main._count_meteors() > cap:
		_failures.append("同屏陨石 %d 超过 cap(D)=%d：生成器硬截断失效（验收 4）" % [
			_main._count_meteors(), cap])
	GameState.run_time = saved_time
	if existing <= 0:
		_failures.append("cap 断言前置失败：约束相位的 guard 陨石不存在")


func _assert_crystal_drift() -> void:
	## 水晶航路漂移：随世界流动漂向玩家（静止水晶与「航路」体感脱节，收集率塌陷）。
	if _drift_crystal == null or not is_instance_valid(_drift_crystal):
		_failures.append("漂移断言用的水晶已被提前回收（生命周期异常）")
		return
	var travelled := _drift_crystal.position.y - _drift_origin_y
	if travelled < MIN_DRIFT_DISTANCE:
		_failures.append("水晶 %d 帧仅漂移 %.1fpx < %.1fpx：航路漂移未生效（水晶静止 = 与世界流动脱节）" % [
			DRIFT_WAIT_FRAMES, travelled, MIN_DRIFT_DISTANCE])


func _assert_first_hit() -> void:
	if GameState.shield != GameState.SHIELD_MAX - 1:
		_failures.append("陨石撞击未扣盾：护盾 %d ≠ %d（碰撞接线断裂，验收 2）" % [GameState.shield, GameState.SHIELD_MAX - 1])
		return
	if not _shield_seen:
		_failures.append("信号 GameState.shield_changed 未到达冒烟订阅方（护盾 UI 数据源断了，验收 2）")
	var shield_text := String(_main.shield_label.text)
	if not shield_text.contains("◇"):
		_failures.append("护盾 HUD 未更新：文案「%s」缺空心格（UI 实时更新断言失败，验收 2）" % shield_text)
	var juice := get_tree().root.get_node_or_null("Juice")
	if juice == null or not (juice.sfx_counts.has(&"hit")):
		_failures.append("受击后 Juice 无 hit 反馈事件（受击反馈缺失）")
	elif not juice.SFX_BANK.has(&"hit"):
		_failures.append("音效注册表缺 hit（受击音效未接线）")
	if not GameState.is_invincible():
		_failures.append("受击后未进入无敌帧（知识基准 4.2：1.0s 无敌，期间无碰撞判定）")
	elif _player.modulate.a >= 1.0:
		_failures.append("受击后无敌期未闪烁：alpha %.2f 未压暗（知识基准 4.2 无敌闪烁缺失）" % _player.modulate.a)


func _assert_game_over() -> void:
	if not GameState.game_over:
		_failures.append("护盾归零后未进入结算（验收 2：护盾归零 → 游戏结束）")
		return
	if not _game_over_seen:
		_failures.append("信号 GameState.game_over 未到达冒烟订阅方")
	if not _main.result_panel.visible:
		_failures.append("结算面板未显示（验收 2：1s 内进入结算界面）")
	var stats := GameState.stats()
	if int(stats["score"]) != _score_at_game_over:
		_failures.append("结算分数 %d 与对局状态 %d 不一致（验收 2：结算数据正确）" % [int(stats["score"]), _score_at_game_over])
	if GameState.best_score != maxi(_best_before, _score_at_game_over):
		_failures.append("历史最高分 %d ≠ max(%d, %d)（验收 4 的最高分口径）" % [
			GameState.best_score, _best_before, _score_at_game_over])


func _assert_restarted() -> void:
	if GameState.score != 0:
		_failures.append("重开后分数 %d ≠ 0（验收 5：状态重置）" % GameState.score)
	if GameState.crystals != 0:
		_failures.append("重开后水晶数 %d ≠ 0（验收 5）" % GameState.crystals)
	if GameState.shield != GameState.SHIELD_MAX:
		_failures.append("重开后护盾 %d ≠ %d（验收 5）" % [GameState.shield, GameState.SHIELD_MAX])
	if GameState.combo != 0:
		_failures.append("重开后连击 %d ≠ 0（验收 5）" % GameState.combo)
	if GameState.boost_active:
		_failures.append("重开后加速态未关闭（验收 5）")
	if not is_equal_approx(GameState.speed, GameState.SPEED_BASE):
		_failures.append("重开后速度 %.1f ≠ %.1f（验收 5）" % [GameState.speed, GameState.SPEED_BASE])
	if GameState.game_over or not GameState.running:
		_failures.append("重开后对局未重新开始（game_over=%s running=%s，验收 5）" % [GameState.game_over, GameState.running])
	if _main.entities.get_child_count() != 0:
		_failures.append("重开后场景实体未清空：%d 个残留（验收 5）" % _main.entities.get_child_count())
	if _main.result_panel.visible:
		_failures.append("重开后结算面板仍显示（验收 5）")
	if GameState.best_score != maxi(_best_before, _score_at_game_over):
		_failures.append("重开后最高分被清掉：%d ≠ %d（验收 5：最高分保留）" % [
			GameState.best_score, maxi(_best_before, _score_at_game_over)])


func _report() -> void:
	if _failures.is_empty():
		print("GODOT_SMOKE: PASS 场景实例化/autoload/输入映射/信号/拾取加速/碰撞结算/重开 全部通过")
		get_tree().quit(0)
	else:
		for failure in _failures:
			printerr("GODOT_SMOKE: FAIL %s" % failure)
		get_tree().quit(1)


func _on_player_moved(_position: Vector2) -> void:
	_moved_seen = true


func _on_score_changed(score: int) -> void:
	_score_seen = true


func _on_shield_changed(_shield: int) -> void:
	_shield_seen = true


func _on_game_over(stats: Dictionary) -> void:
	_game_over_seen = true
	_score_at_game_over = int(stats.get("score", -1))


## 反馈事件采样：任何 Juice 反馈都算游戏「有反馈」（本冒烟不逐类断言，逐类在拾取/受击断言里）。
func _on_feedback_fired(_kind: StringName) -> void:
	pass
