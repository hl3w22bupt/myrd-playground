extends Node
## 无头冒烟自检（headless smoke）—— 《星尘收集者》「游戏能不能跑且玩得动」。
##
## 运行方式（由 scripts/smoke.sh 封装）：
##   godot --headless --path <工程目录> tests/smoke.tscn
##
## 判定协议（smoke.sh 按此断言退出码与日志）：
##   通过 → stdout 打印 `GODOT_SMOKE: PASS ...`，进程退出码 0
##   失败 → stderr 打印 `GODOT_SMOKE: FAIL <原因>`（每条一行），进程退出码 1
##
## 断言覆盖（对应本游戏四项验收的机判形态）：
##   A. 玩家能移动【方向语义契约】：注入 move_right 后水平位移 ≥ +阈值且纵向偏移有上界；
##      再注入 move_left 相同帧数，水平位移 ≤ -阈值 —— 有符号轴分量断言，
##      输入映射镜像（按右往左走）会让无向 distance_to 断言照样全绿，本断言能识破。
##   B. 核心交互生效：把玩家传送到星尘上，物理碰撞触发收集
##      （分数 +score_per_crystal、晶体消失不重复计分、飘字反馈出现）
##   C. 胜负可达：物理碰撞陨石扣盾 1 点；无敌帧内不重复扣血；
##      护盾归 0 的瞬间结算面板弹出，展示本局得分与历史最高分且最高分已落盘
##   D. 重开可用：confirm 动作（结算态键盘入口）触发重开 ——
##      分数归 0、护盾恢复初始值、面板隐藏、新战场生成
##   E. 新玩法面（本节点新增，断言与交互同步升级）：
##      E1 里程碑反馈：跨过 milestone_step 整数倍弹出庆祝横幅；
##      E2 胜利结算可达：得分达到 score_target 的瞬间弹出「胜利」结算面板
##         （标题区分胜负、正文含本局得分/历史最高、最高分落盘）；
##      E3 胜利后重开：confirm 重开 —— 分数/护盾复位、面板隐藏、难度复位 0 级；
##      E4 难度梯度生效：跨过 difficulty_step 后陨石上限 +1 并补足生成。
##   F. 调参 URL 契约（试玩回填闭环的机判形态）：parse_tuning_query 只认声明键、
##      钳制量程、吸附步长、忽略未知/非法键；应用侧 float 写 int 键收敛为 int。
##
## 可复现性设计（门禁要求同一事件序 → 同一判定结果）：
## - 噪声相位结束后 Input.release_pressed_events()，清掉悬挂按键/手势；
## - 重铺战场【之前】先把玩家固定到确定点：_pick_spawn_point 的重试次数取决于
##   玩家位置，位置不定会改变 RNG 消耗次数，导致「同种子不同布局」；
## - 收集/受击采用「跟随式传送」：每物理帧把玩家贴到目标上，直到物理判定达成
##   —— body_entered 只在进入重叠时发一次，不跟随会被目标漂移/晚到的输入残留
##   造成偶发漏判（实测：墙钟脱钩 + 布局漂移组合下 1/13 偶发失败）；
## - 快进扣血等后续阶段以「受击达成帧」为锚点自适应排期，不再依赖固定帧号。
## ⚠️ 输入注入分两个阶段、互不重叠（references/error-signatures.md E-08）：
##   headless 下 Input.parse_input_event() 的缓冲冲刷会清掉 Input.action_press()
##   设置的按下状态，两者同帧混用会让「移动断言」假失败。

## ── 噪声相位（输入鲁棒性门禁的逐游戏语义层，与模板同种子同事件序）──
const NOISE_FRAMES: int = 30
## 战场固定种子：冒烟要求可复现（同一事件序 → 同一判定结果）。
const SMOKE_SEED: int = 20260926
## 移动相位的固定出发点（战场重铺前把玩家固定在此，保证 RNG 消耗次数恒定）。
const MOVE_ORIGIN: Vector2 = Vector2(320, 180)
## 阶段一：按住 move_right 的帧数。
const MOVE_FRAMES: int = 10
## 阶段二（反向契约）：按住 move_left 的帧数（与阶段一等长，便于对称断言）。
const LEFT_MOVE_FRAMES: int = 10
## 传送接触后等待物理判定送达的帧数（收集相位）。
const CONTACT_FRAMES: int = 6
## 受击跟随窗口：期间逐帧贴住目标陨石，直到护盾扣减达成。
## 取 50 帧 > 默认无敌帧 48 tick：即使布局里存在更早的擦碰，窗口也覆盖到其过期。
const HIT_WINDOW_FRAMES: int = 50
## 无敌帧窗口观察帧数（0.5s < 默认无敌帧 0.8s≈48 tick，期间不允许第二次扣盾）。
const INVINCIBILITY_FRAMES: int = 30
## 快速结算：把无敌帧临时调短后的帧间隔（> 0.05s≈3 tick 的物理帧数）。
const FAST_HIT_FRAMES: int = 7
## 物理受击后其无敌帧（48 tick）确认过期所需帧数（留 4 tick 余量）。
const IFRAME_EXPIRE_FRAMES: int = 52
## 注入 confirm 后等待重开生效的帧数。
const RESTART_FRAMES: int = 8
## ── E 段锚点偏移（胜利 / 里程碑 / 难度梯度）──
## 重开断言后到里程碑注入的帧间隔。
const VICTORY_MILESTONE_OFFSET: int = 1
## 里程碑注入到胜利结算断言的帧间隔。
const VICTORY_ASSERT_OFFSET: int = 1
## 第二次重开断言到难度梯度断言的帧间隔（add_score 同帧生效，留 1 帧观察）。
const DIFFICULTY_ASSERT_OFFSET: int = 1

## ── 固定锚点帧 ──
const FRAME_MOVE_START: int = NOISE_FRAMES + 1
const FRAME_MOVE_END: int = NOISE_FRAMES + MOVE_FRAMES
const FRAME_LEFT_MOVE_END: int = FRAME_MOVE_END + LEFT_MOVE_FRAMES
const FRAME_COLLECT_ASSERT: int = FRAME_LEFT_MOVE_END + CONTACT_FRAMES
const FRAME_HIT_WINDOW_START: int = FRAME_COLLECT_ASSERT + 1
const FRAME_HIT_WINDOW_END: int = FRAME_HIT_WINDOW_START + HIT_WINDOW_FRAMES - 1

## 判定「真的移动了」的最小位移（像素）。
const MIN_MOVE_DISTANCE: float = 1.0
## 方向语义契约的横向漂移上界（像素）：只按单一水平方向时，纵向偏移不允许超过该值
## （10 帧 × 240px/s ≈ 40px 位移，64px 上界足够宽容，但足以识破「斜着乱跑/镜像输入」）。
const MAX_LATERAL_DRIFT: float = 64.0

const REQUIRED_ACTIONS: Array[StringName] = [
	&"move_left", &"move_right", &"move_up", &"move_down", &"confirm",
]

## 键位契约：动作 → 键表承诺的物理键，必须全部绑定（与 project.godot [input] 对应）。
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
var _main: MainScene
var _player: Player
var _origin: Vector2 = Vector2.ZERO
## 反向相位（move_left）的出发点：与 _origin 分开记录，避免两个方向断言互相污染。
var _left_origin: Vector2 = Vector2.ZERO
var _moved_seen: bool = false
var _score_seen: bool = false
var _score_before_collect: int = 0
var _collect_target: StarDust
var _hit_target: Asteroid
var _shield_before_hit: int = 0
var _shield_after_hit: int = -1
var _hit_landed_tick: int = -1
var _score_at_game_over: int = -1
## 受击达成后的自适应锚点（受击帧 + 偏移推导，避免与实际达成帧脱钩）。
var _t_iframe_assert: int = -1
var _t_fast_hit_1: int = -1
var _t_fast_hit_2: int = -1
var _t_game_over: int = -1
var _t_restart: int = -1
var _t_victory_milestone: int = -1
var _t_victory_assert: int = -1
var _t_victory_restart: int = -1
var _t_difficulty_assert: int = -1
var _t_report: int = -1


func _ready() -> void:
	# headless 没有垂直同步，process 帧率可跑到几百上千 FPS，而物理固定 60Hz。
	# 限到 60 FPS 让 --quit-after 的帧数兜底与物理帧≈1:1（模板同款处理）。
	Engine.max_fps = 60

	_main = get_node("Main") as MainScene
	if _main == null:
		_failures.append("场景树找不到 Main（tests/smoke.tscn 未实例化 main.tscn）")
		_report()
		return
	_player = _main.player

	for action in REQUIRED_ACTIONS:
		if not InputMap.has_action(action):
			_failures.append("InputMap 缺少动作 %s（project.godot [input] 未注册）" % action)
	_check_key_bindings()
	_check_tuning_query_contract()

	if get_tree().root.get_node_or_null("GameConfig") == null:
		_failures.append("autoload GameConfig 未注册（project.godot [autoload] 缺失，数值配置无法生效）")
	var game_state := get_tree().root.get_node_or_null("GameState")
	if game_state == null:
		_failures.append("autoload GameState 未注册（project.godot [autoload] 缺失）")
	else:
		for signal_name in ["score_changed", "shield_changed", "game_over", "game_won", "game_restarted"]:
			if not game_state.has_signal(signal_name):
				_failures.append("autoload GameState 缺少信号 %s" % signal_name)
		game_state.score_changed.connect(_on_score_changed)

	# 清掉上一轮运行遗留的最高分存档：让「结算后已落盘」断言只认可本轮写入，
	# 否则陈旧存档会把持久化缺陷洗成假阳性。
	var save_dir := DirAccess.open("user://")
	var save_file_name: String = GameState.SAVE_PATH.get_file()
	if save_dir != null and save_dir.file_exists(save_file_name):
		save_dir.remove(save_file_name)

	if _player == null:
		_failures.append("主场景里找不到 Player（player.tscn 未实例化或未挂 player.gd）")
	else:
		_player.moved.connect(_on_player_moved)
	if _main.restart_button == null:
		_failures.append("主场景缺少 RestartButton（重开入口不存在）")
	elif not _main.restart_button.pressed.is_connected(_main._on_restart_pressed):
		_failures.append("RestartButton.pressed 未连接 _on_restart_pressed（重开入口接线断裂）")


func _physics_process(_delta: float) -> void:
	if _finished:
		return
	_frames += 1

	if _failures.is_empty():
		if _frames <= NOISE_FRAMES:
			_inject_noise_frame()
		elif _frames == FRAME_MOVE_START:
			_begin_move_phase()
		elif _frames == FRAME_MOVE_END:
			_end_move_phase_begin_left_phase()
		elif _frames == FRAME_LEFT_MOVE_END:
			_end_left_phase_begin_collect()
		elif _frames > FRAME_LEFT_MOVE_END and _frames < FRAME_COLLECT_ASSERT:
			_follow_collect()
		elif _frames == FRAME_COLLECT_ASSERT:
			_follow_collect()
			_assert_collected()
			_begin_hit_phase()
		elif _frames >= FRAME_HIT_WINDOW_START and _frames <= FRAME_HIT_WINDOW_END:
			_follow_hit()
		elif _frames == FRAME_HIT_WINDOW_END + 1 and _hit_landed_tick < 0:
			_failures.append("受击判定失败：跟随陨石 %d 帧（%d-%d）内护盾始终未从 %d 扣减（body_entered 未触发或受击链路断裂）" % [
				HIT_WINDOW_FRAMES, FRAME_HIT_WINDOW_START, FRAME_HIT_WINDOW_END, _shield_before_hit,
			])
		elif _t_iframe_assert > 0 and _frames == _t_iframe_assert:
			_assert_invincibility_window()
		elif _t_fast_hit_1 > 0 and _frames == _t_fast_hit_1:
			# 物理受击的无敌帧（48 tick）已过期；把无敌帧临时调短，快进打出剩余扣盾。
			GameConfig.invincibility_seconds = 0.05
			_player.take_hit()
		elif _t_fast_hit_2 > 0 and _frames == _t_fast_hit_2:
			_player.take_hit()
		elif _t_game_over > 0 and _frames == _t_game_over:
			_assert_game_over()
			_press_action(&"confirm")
		elif _t_restart > 0 and _frames == _t_restart:
			_assert_restarted()
		elif _t_victory_milestone > 0 and _frames == _t_victory_milestone:
			_inject_victory_milestone_step()
		elif _t_victory_assert > 0 and _frames == _t_victory_assert:
			_assert_victory()
			_press_action(&"confirm")
		elif _t_victory_restart > 0 and _frames == _t_victory_restart:
			_assert_victory_restarted()
			_begin_difficulty_phase()
		elif _t_difficulty_assert > 0 and _frames == _t_difficulty_assert:
			_assert_difficulty_level()

	if (_t_report > 0 and _frames >= _t_report) or not _failures.is_empty():
		_finished = true
		_report()


## 噪声相位：确定种子随机事件（原始事件，不含 InputEventAction）。
var _noise_rng := RandomNumberGenerator.new()


func _inject_noise_frame() -> void:
	if _frames == 1:
		_noise_rng.seed = 20260913  # 门禁要求可复现：同种子同事件序（与模板一致）
	var roll := _noise_rng.randf()
	var pos := Vector2(_noise_rng.randf_range(0, 640), _noise_rng.randf_range(0, 360))
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
			_failures.append("键位契约：动作 %s 未绑全键表承诺的物理键（期望全部 %s，实际 %s）" % [
				action, _key_labels(expected), _key_labels(bound),
			])


func _contains_all(expected: Array, bound: Array[Key]) -> bool:
	for key in expected:
		if not (key in bound):
			return false
	return true


## ── F. 调参 URL 契约断言（headless 可机判，无帧排期）──
## 回填闭环依赖「调参链接打开即复现候选数值」：此前 ?tuning=1 只开面板、
## key=value 无人消费。这里断言解析纯函数与应用侧的类型收敛。
func _check_tuning_query_contract() -> void:
	var parsed: Dictionary = TuningPanel.parse_tuning_query(
		"?tuning=1&max_crystals=9&score_target=99&invincibility_seconds=0.123&bogus=7&max_asteroids=abc")
	if parsed.size() != 3:
		_failures.append("调参 URL 解析：应识别 3 个合法键（未知键 bogus / 非数值 max_asteroids=abc 忽略），实际 %s" % [parsed])
	if float(parsed.get("max_crystals", -1.0)) != 9.0:
		_failures.append("调参 URL 解析：max_crystals=9 未还原（%s）" % [parsed])
	if float(parsed.get("score_target", -1.0)) != 60.0:
		_failures.append("调参 URL 解析：score_target=99 未钳制到量程上限 60（%s）" % [parsed])
	if not is_equal_approx(float(parsed.get("invincibility_seconds", -1.0)), 0.10):
		_failures.append("调参 URL 解析：invincibility_seconds=0.123 未吸附到步长 0.05（%s）" % [parsed])
	# 应用侧：float 值写入 int 键必须收敛为 int；应用后立即还原，不污染后续相位
	var probe: TuningPanel = TuningPanel.new()
	var snapshot: int = GameConfig.score_per_crystal
	var applied: int = probe.apply_parsed_tuning({"score_per_crystal": 5.0})
	if applied != 1:
		_failures.append("调参 URL 应用：应应用 1 项，实际 %d" % applied)
	if GameConfig.score_per_crystal != 5 or not (GameConfig.score_per_crystal is int):
		_failures.append("调参 URL 应用：score_per_crystal 应收敛为 int 5，实际 %s（%s）" % [
			GameConfig.score_per_crystal, typeof(GameConfig.score_per_crystal),
		])
	GameConfig.score_per_crystal = snapshot
	probe.free()


func _key_labels(keys: Array) -> String:
	var labels: PackedStringArray = []
	for code in keys:
		labels.append("%s(%d)" % [OS.get_keycode_string(code as Key), code])
	return "[%s]" % ", ".join(labels)


## ── A. 移动断言 ──
## 逐个释放方向动作：晚到的噪声按键可能重新置起动作强度，移动/传送前必须清零。
func _release_move_actions() -> void:
	for action in [&"move_left", &"move_right", &"move_up", &"move_down"]:
		Input.action_release(action)


func _begin_move_phase() -> void:
	# 先把玩家固定到确定点再重铺战场：_pick_spawn_point 的重试次数取决于玩家位置，
	# 位置不定会改变 RNG 消耗次数，导致「同种子不同布局」（偶发失败根因之一）。
	_player.global_position = MOVE_ORIGIN
	_player.velocity = Vector2.ZERO
	# 清掉噪声相位可能悬挂/晚到的方向按键，保证动作强度从零开始。
	_release_move_actions()
	_main.respawn_field(SMOKE_SEED)
	_origin = _player.global_position
	Input.action_press(&"move_right")


## ── A. 方向语义契约（有符号断言，识破「输入映射镜像」缺陷）──
## 无向位移（distance_to）分不清「按右往右走」和「按右往左走」：镜像映射下照样全绿。
## 2D 无旋转相机下 +x 即屏幕右、+y 即屏幕下，因此用带符号的轴分量断言：
##   move_right → (x - origin.x) >= +MIN_MOVE_DISTANCE，且 |y - origin.y| <= MAX_LATERAL_DRIFT；
##   move_left  → (x - origin.x) <= -MIN_MOVE_DISTANCE，且纵向同样有上界。
func _end_move_phase_begin_left_phase() -> void:
	Input.action_release(&"move_right")
	_release_move_actions()
	var dx: float = _player.global_position.x - _origin.x
	var dy: float = _player.global_position.y - _origin.y
	if dx < MIN_MOVE_DISTANCE:
		_failures.append("方向语义失败：按 move_right %d 帧后水平位移 %+.2fpx 未达到 +%.2fpx（输入映射可能镜像/反向，或 _physics_process 未驱动 velocity）" % [
			MOVE_FRAMES, dx, MIN_MOVE_DISTANCE,
		])
	if absf(dy) > MAX_LATERAL_DRIFT:
		_failures.append("方向语义失败：按 move_right %d 帧后纵向偏移 %+.2fpx 超出 ±%.0fpx 上界（移动方向跑偏）" % [
			MOVE_FRAMES, dy, MAX_LATERAL_DRIFT,
		])
	_begin_left_move_phase()


## 反向相位：先释放全部方向动作、记录新出发点，再按住 move_left 相同帧数。
func _begin_left_move_phase() -> void:
	_player.velocity = Vector2.ZERO
	_release_move_actions()
	_left_origin = _player.global_position
	Input.action_press(&"move_left")


func _end_left_phase_begin_collect() -> void:
	Input.action_release(&"move_left")
	_release_move_actions()
	var dx: float = _player.global_position.x - _left_origin.x
	var dy: float = _player.global_position.y - _left_origin.y
	if dx > -MIN_MOVE_DISTANCE:
		_failures.append("方向语义失败：按 move_left %d 帧后水平位移 %+.2fpx 未达到 -%.2fpx（输入映射可能镜像/反向，或 _physics_process 未驱动 velocity）" % [
			LEFT_MOVE_FRAMES, dx, MIN_MOVE_DISTANCE,
		])
	if absf(dy) > MAX_LATERAL_DRIFT:
		_failures.append("方向语义失败：按 move_left %d 帧后纵向偏移 %+.2fpx 超出 ±%.0fpx 上界（移动方向跑偏）" % [
			LEFT_MOVE_FRAMES, dy, MAX_LATERAL_DRIFT,
		])
	_begin_collect_phase()


## ── B. 收集断言（物理碰撞 → 加分 → 晶体消失 → 反馈）──
func _begin_collect_phase() -> void:
	_score_before_collect = GameState.score
	if _main.crystals.get_child_count() == 0:
		_failures.append("战场里没有星尘晶体（respawn_field 未按 max_crystals 生成）")
		return
	_collect_target = _main.crystals.get_child(0) as StarDust
	if _collect_target == null:
		_failures.append("Crystals 容器里存在非 StarDust 子节点（场景组装错误）")
		return
	_player.global_position = _collect_target.global_position


## 跟随式收集：晶体静止，但残留输入可能让玩家漂移 —— 贴住直到判定达成。
func _follow_collect() -> void:
	if _collect_target == null or not is_instance_valid(_collect_target):
		return
	if GameState.score != _score_before_collect:
		return  # 已收集，停止跟随
	_player.global_position = _collect_target.global_position


func _assert_collected() -> void:
	_collect_target = null
	if GameState.score != _score_before_collect + GameConfig.score_per_crystal:
		_failures.append("收集判定失败：分数 %d ≠ %d + score_per_crystal(%d)（Area2D body_entered 未触发或收集门闩失效）" % [
			GameState.score, _score_before_collect, GameConfig.score_per_crystal,
		])
	if _main.effects.get_child_count() == 0:
		_failures.append("收集后没有飘字反馈（Effects 容器为空）")


## ── C. 受击 / 胜负断言 ──
func _begin_hit_phase() -> void:
	_shield_before_hit = GameState.shield
	if _main.asteroids.get_child_count() == 0:
		_failures.append("战场里没有陨石（respawn_field 未按 max_asteroids 生成）")
		return
	_hit_target = _main.asteroids.get_child(0) as Asteroid
	if _hit_target == null:
		_failures.append("Asteroids 容器里存在非 Asteroid 子节点（场景组装错误）")
		return
	_player.global_position = _hit_target.global_position


## 跟随式受击：陨石在漂移且 body_entered 只在进入重叠时发一次 ——
## 逐帧贴住目标并做「贴上-拉开」脉冲（拉开 > 25px 重叠半径制造新的进入事件），
## 直到护盾扣减达成；若布局中存在更早的擦碰（无敌帧占用），过期后的第一次
## 进入仍能受击，整个窗口内未达成才判失败。
func _follow_hit() -> void:
	if _hit_landed_tick >= 0:
		return
	if _hit_target == null or not is_instance_valid(_hit_target):
		return
	if _frames % 4 < 3:
		_player.global_position = _hit_target.global_position
	else:
		_player.global_position = _hit_target.global_position + Vector2(44, 0)
	var expected: int = maxi(_shield_before_hit - GameConfig.damage_per_hit, 0)
	if GameState.shield != _shield_before_hit:
		if GameState.shield != expected:
			_failures.append("受击判定失败：护盾 %d ≠ %d - damage_per_hit(%d)（一次碰撞的扣盾数值不对）" % [
				GameState.shield, _shield_before_hit, GameConfig.damage_per_hit,
			])
			return
		_hit_landed_tick = _frames
		_shield_after_hit = GameState.shield
		_t_iframe_assert = _hit_landed_tick + INVINCIBILITY_FRAMES
		_t_fast_hit_1 = _hit_landed_tick + IFRAME_EXPIRE_FRAMES
		_t_fast_hit_2 = _t_fast_hit_1 + FAST_HIT_FRAMES
		_t_game_over = _t_fast_hit_2 + FAST_HIT_FRAMES
		_t_restart = _t_game_over + RESTART_FRAMES
		_t_victory_milestone = _t_restart + VICTORY_MILESTONE_OFFSET
		_t_victory_assert = _t_victory_milestone + VICTORY_ASSERT_OFFSET
		_t_victory_restart = _t_victory_assert + RESTART_FRAMES
		_t_difficulty_assert = _t_victory_restart + DIFFICULTY_ASSERT_OFFSET
		_t_report = _t_difficulty_assert + 1


func _assert_invincibility_window() -> void:
	if GameState.shield != _shield_after_hit:
		_failures.append("无敌帧失效：受击后 %d 帧（< %.1fs 无敌帧）内护盾从 %d 变为 %d，同一次碰撞被重复扣血" % [
			INVINCIBILITY_FRAMES, GameConfig.invincibility_seconds, _shield_after_hit, GameState.shield,
		])


func _assert_game_over() -> void:
	_score_at_game_over = GameState.score
	if not GameState.is_game_over:
		_failures.append("胜负判定失败：护盾归 0 后 GameState.is_game_over 仍为 false")
	if not _main.game_over_panel.visible:
		_failures.append("结算面板未弹出（护盾归 0 的瞬间应展示结算）")
	var result_text: String = _main.result_label.text
	if not result_text.contains("本局得分") or not result_text.contains("历史最高"):
		_failures.append("结算文案缺少本局得分/历史最高：\"%s\"" % result_text)
	if GameState.high_score < GameState.score:
		_failures.append("历史最高分 %d 小于本局得分 %d（最高分未更新）" % [
			GameState.high_score, GameState.score,
		])
	if not GameState.has_high_score_save():
		_failures.append("历史最高分未持久化（%s 未落盘，刷新后不保留）" % GameState.SAVE_PATH)


## ── D. 重开断言 ──
func _assert_restarted() -> void:
	if GameState.is_game_over:
		_failures.append("重开失败：GameState 仍处于结算态")
	if GameState.score != 0:
		_failures.append("重开失败：分数 %d ≠ 0" % GameState.score)
	if GameState.shield != GameConfig.initial_shield:
		_failures.append("重开失败：护盾 %d ≠ 初始护盾 %d" % [GameState.shield, GameConfig.initial_shield])
	if _main.game_over_panel.visible:
		_failures.append("重开失败：结算面板仍可见")
	if _main.crystals.get_child_count() != GameConfig.max_crystals:
		_failures.append("重开失败：新战场星尘数量 %d ≠ %d" % [
			_main.crystals.get_child_count(), GameConfig.max_crystals,
		])
	if GameState.high_score < _score_at_game_over:
		_failures.append("重开后历史最高分 %d 丢失（应 ≥ 上局得分 %d）" % [
			GameState.high_score, _score_at_game_over,
		])


## ── E1. 里程碑反馈断言 ──
## 临时把目标分调到 2、里程碑步长调到 1：收集 1 分应弹横幅且不触发终局。
func _inject_victory_milestone_step() -> void:
	GameConfig.score_target = 2
	GameConfig.milestone_step = 1
	GameState.add_score(1)
	if GameState.is_game_over:
		_failures.append("里程碑阶段误触发终局：score=1 < score_target=2 时 is_game_over 不应为 true")
	if not _main.milestone_label.visible:
		_failures.append("里程碑横幅未弹出（milestone_step=1 时收集 1 分应弹庆祝反馈）")
	elif not _main.milestone_label.text.contains("已收集 1"):
		_failures.append("里程碑横幅文案不含已收集分数：\"%s\"" % _main.milestone_label.text)


## ── E2. 胜利结算断言 ──
## 再加 1 分踩线（score 1 → 2 = score_target）：胜利结算应在同一入口内立即触发。
func _assert_victory() -> void:
	GameState.add_score(1)
	_score_at_game_over = GameState.score
	if not GameState.is_game_over:
		_failures.append("胜利判定失败：得分 %d 已达 score_target(%d) 但 is_game_over 仍为 false" % [
			GameState.score, GameConfig.score_target,
		])
	if not _main.game_over_panel.visible:
		_failures.append("胜利结算面板未弹出（达到 score_target 的瞬间应展示结算）")
	var title_text: String = _main.result_title_label.text
	if not title_text.contains("胜利"):
		_failures.append("胜利结算标题未区分胜负：\"%s\"" % title_text)
	if title_text.contains("护盾耗尽"):
		_failures.append("胜利终局误用了失败文案：\"%s\"" % title_text)
	var result_text: String = _main.result_label.text
	if not result_text.contains("本局得分") or not result_text.contains("历史最高"):
		_failures.append("胜利结算文案缺少本局得分/历史最高：\"%s\"" % result_text)
	if not GameState.has_high_score_save():
		_failures.append("胜利结算后历史最高分未持久化（%s 未落盘）" % GameState.SAVE_PATH)


## ── E3. 胜利后重开断言 ──
func _assert_victory_restarted() -> void:
	if GameState.is_game_over:
		_failures.append("胜利重开失败：GameState 仍处于结算态")
	if GameState.score != 0 or GameState.shield != GameConfig.initial_shield:
		_failures.append("胜利重开失败：分数/护盾未复位（score=%d, shield=%d）" % [
			GameState.score, GameState.shield,
		])
	if _main.game_over_panel.visible:
		_failures.append("胜利重开失败：结算面板仍可见")
	if _main.difficulty_level != 0:
		_failures.append("胜利重开失败：难度未复位（difficulty_level=%d）" % _main.difficulty_level)
	if _main.asteroids.get_child_count() != GameConfig.max_asteroids:
		_failures.append("胜利重开失败：陨石数量 %d 未回到 0 级上限 %d" % [
			_main.asteroids.get_child_count(), GameConfig.max_asteroids,
		])


## ── E4. 难度梯度断言 ──
## 转无尽模式（score_target=0）并收紧梯度步长：加 2 分应升到 1 级，陨石上限 +1 且已补足。
func _begin_difficulty_phase() -> void:
	GameConfig.score_target = 0
	GameConfig.milestone_step = 0
	GameConfig.difficulty_step = 2
	GameState.add_score(2)


func _assert_difficulty_level() -> void:
	var expected_level: int = floori(float(GameState.score) / float(GameConfig.difficulty_step))
	if _main.difficulty_level != expected_level:
		_failures.append("难度梯度失败：score=%d 时难度等级 %d ≠ %d" % [
			GameState.score, _main.difficulty_level, expected_level,
		])
	var expected_cap: int = GameConfig.max_asteroids + expected_level * GameConfig.difficulty_asteroids_per_level
	if _main.asteroid_cap != expected_cap:
		_failures.append("难度梯度失败：陨石上限 %d ≠ 0 级上限 %d + 每级增量 %d" % [
			_main.asteroid_cap, GameConfig.max_asteroids, GameConfig.difficulty_asteroids_per_level,
		])
	var asteroid_count: int = _main.asteroids.get_child_count()
	if asteroid_count != expected_cap:
		_failures.append("难度梯度失败：陨石未按新上限补足（场上 %d ≠ %d）" % [
			asteroid_count, expected_cap,
		])


func _report() -> void:
	if _hit_landed_tick < 0 and _hit_target != null and _failures.is_empty():
		_failures.append("受击判定失败：跟随陨石 %d 帧（%d-%d）内护盾始终未从 %d 扣减（body_entered 未触发或受击链路断裂）" % [
			HIT_WINDOW_FRAMES, FRAME_HIT_WINDOW_START, FRAME_HIT_WINDOW_END, _shield_before_hit,
		])
	if not _moved_seen:
		_failures.append("信号 Player.moved 未到达订阅方：连接断裂或从未 emit")
	if not _score_seen:
		_failures.append("信号 GameState.score_changed 未到达订阅方：连接断裂或从未 emit")
	if _failures.is_empty():
		print("GODOT_SMOKE: PASS 方向语义(move_right/move_left)/收集/受击无敌帧/结算/重开/里程碑/胜利结算/难度梯度 全部通过")
		get_tree().quit(0)
	else:
		for failure in _failures:
			printerr("GODOT_SMOKE: FAIL %s" % failure)
		get_tree().quit(1)


func _on_player_moved(_position: Vector2) -> void:
	_moved_seen = true


func _on_score_changed(_score: int) -> void:
	_score_seen = true
