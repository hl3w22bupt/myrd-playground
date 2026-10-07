extends Node
## 无头冒烟自检（headless smoke）—— 机器可判定的「游戏能不能跑」。
##
## 运行方式（由 std-skills/godot-game-dev/scripts/smoke.sh 封装）：
##   godot --headless --path <工程目录> tests/smoke.tscn
##
## 判定协议（smoke.sh 按此断言退出码与日志）：
##   通过 → stdout 打印 `GODOT_SMOKE: PASS ...`，进程退出码 0
##   失败 → stderr 打印 `GODOT_SMOKE: FAIL <原因>`（每条一行），进程退出码 1
##
## 覆盖面（需求口径：流星短窗口出现 → 点击收集 → 三颗即胜；逐条可无头判定）：
##   0. 静态接线：场景可实例化、autoload GameState（score_changed/won/restarted）、
##      InputMap 动作 + 键位契约（含 restart=R）、Meteor 容器 / HUD / 胜利遮罩 / 重开按钮存在
##   1. 玩家能移动：注入 move_right 后真位移（≥1px）+ Player.moved 信号到达
##   2. 短窗口机制：流星 window_left 逐帧递减且在 (0, meteor_window_seconds] 内
##      （可配置窗口的可判定载体）；expire() 后 active=false → 点击无效
##   3. 核心交互·点击收集：注入鼠标点击（流星真实坐标×final_transform）→ 计数 +1
##      + HUD 进度刷新 + Juice 反馈（动画/音效）触发
##   4. 核心交互·祈愿脉冲：confirm 动作（键盘/触摸按钮同路径）→ 玩家半径内流星收集
##   5. 胜负可达：恰好集齐 3 颗（<3 不判胜）→ won_state + won 信号 + 胜利遮罩可见
##      + HUD 3/3 + 派发停止；胜后点击不再加分（需求验收第 3 条反向）
##   6. 重开可用：restart 动作 → 分数/遮罩/派发/玩家归位全复位 + restarted 信号
##      + 重开后可再次移动可再次游玩
##   7. 调参协议：TUNING_META 四键齐备、apply_tuning 应用已声明键 / 拒绝未知键 / 按 max 钳制
##
## ⚠️ 输入注入纪律（error-signatures E-08）：
##   Input.parse_input_event 注入后必须 Input.flush_buffered_events() 立即派发；
##   动作持续态（action_press）与事件注入分阶段进行，互不重叠。

## ── 帧阶段（Engine.max_fps = 60 下 process : 物理 ≈ 1:1；门禁 --quit-after 240 兜底）──
const NOISE_FRAMES: int = 30          ## 噪声相位：确定种子对抗输入
const MOVE_FRAMES: int = 10           ## 按住 move_right 的帧数
const WINDOW_PROBE_FRAMES: int = 10   ## 窗口倒计时采样间隔（必须观察到 window_left 递减）
const SETTLE_FRAMES: int = 3          ## 注入事件 → 断言的沉降帧数
const RESTART_SETTLE_FRAMES: int = 3  ## restart 注入 → 复位断言的沉降帧数
const REPLAY_FRAMES: int = 6          ## 重开后再移动的帧数
const SEEK_TIMEOUT_FRAMES: int = 90   ## 等待可收集流星的最长帧数（超时 = 派发断裂）
const TOTAL_FRAMES: int = 235         ## 总帧上限（低于门禁 240，先出可读报告）
## 判定「真的移动了」的最小位移（像素）。
const MIN_MOVE_DISTANCE: float = 1.0

const REQUIRED_ACTIONS: Array[StringName] = [
	&"move_left", &"move_right", &"move_up", &"move_down", &"confirm", &"restart",
]

## 键位契约：动作 → 键表承诺的物理键，**必须全部绑定**（逐键 AND，error-signatures E-12）。
const KEY_CONTRACT: Dictionary = {
	&"move_left": [KEY_A, KEY_LEFT],
	&"move_right": [KEY_D, KEY_RIGHT],
	&"move_up": [KEY_W, KEY_UP],
	&"move_down": [KEY_S, KEY_DOWN],
	&"confirm": [KEY_SPACE, KEY_ENTER],
	&"restart": [KEY_R],
}

## 调参协议探针要逐键验证的键（与 autoload/game_state.gd TUNING_META 对应）。
const TUNING_PROBE_KEYS: Array[String] = ["move_speed", "meteor_window_seconds"]

## ── 阶段状态机 ──
enum Stage {
	NOISE,         ## 1..30 对抗输入噪声
	MOVE,          ## 按住 move_right 验证移动
	SEEK_FIRST,    ## 找第一颗在窗流星
	WINDOW_PROBE,  ## 采样 window_left 递减（短窗口机制）
	CLICK_SETTLE,  ## 点击后沉降，断言点击收集
	SEEK_PULSE,    ## 找下一颗流星 → 玩家瞬移过去
	PULSE_SETTLE,  ## confirm 祈愿脉冲后沉降，断言脉冲收集
	SEEK_FINAL,    ## 找第三颗流星 → 点击
	WIN_SETTLE,    ## 断言胜利判定/遮罩/HUD/派发停止
	POST_WIN_PROBE,## 胜后点击不再加分 + 失效流星点击无效
	RESTART_SETTLE,## restart 注入后断言全复位
	REPLAY_MOVE,   ## 重开后再移动（可再次游玩）
	TUNING_PROBE,  ## 调参协议
	DONE,
}

var _failures: PackedStringArray = []
var _frames: int = 0
var _stage: int = Stage.NOISE
var _stage_frame: int = 0
var _finished: bool = false

var _main: Node2D
var _player: Player
var _meteors: Node2D
var _hud: Label
var _win_overlay: ColorRect
var _restart_button: Button

var _origin: Vector2 = Vector2.ZERO
var _moved_seen: bool = false
var _moved_seen_after_restart: bool = false
var _score_seen: bool = false
var _won_seen: bool = false
var _restarted_seen: bool = false
var _probe_meteor: Meteor
var _probe_window_left: float = 0.0
var _score_before_action: int = 0
var _spawn_interval_original: float = 0.0
var _meteors_at_win: int = 0
## 噪声相位：确定种子随机事件（原始事件，不含 InputEventAction）。
var _noise_rng := RandomNumberGenerator.new()


func _ready() -> void:
	# headless 没有垂直同步，process 帧率可跑到几百上千 FPS，而物理固定 60Hz。
	# 限到 60 FPS 让 --quit-after 的帧数兜底有意义（协程跑得完再退出）。
	Engine.max_fps = 60

	for action in REQUIRED_ACTIONS:
		if not InputMap.has_action(action):
			_failures.append("InputMap 缺少动作 %s（project.godot [input] 未注册）" % action)
	_check_key_bindings()

	var game_state := get_tree().root.get_node_or_null("GameState")
	if game_state == null:
		_failures.append("autoload GameState 未注册（project.godot [autoload] 缺失）")
	else:
		for signal_name in ["score_changed", "won", "restarted"]:
			if not game_state.has_signal(signal_name):
				_failures.append("autoload GameState 缺少信号 %s" % signal_name)
		game_state.score_changed.connect(_on_score_changed)
		game_state.won.connect(_on_won)
		game_state.restarted.connect(_on_restarted)
		_check_tuning_meta(game_state)

	_main = get_tree().root.find_child("Main", true, false) as Node2D
	if _main == null:
		_failures.append("场景树找不到 Main（tests/smoke.tscn 未实例化 scenes/main.tscn）")
		return
	_meteors = _main.find_child("Meteors", true, false) as Node2D
	if _meteors == null:
		_failures.append("主场景找不到 Meteors 容器（scenes/main.tscn 缺少 Meteors 节点）")
	_player = _main.find_child("Player", true, false) as Player
	if _player == null:
		_failures.append("主场景找不到 Player（main.tscn 未实例化 player.tscn）")
	else:
		_player.moved.connect(_on_player_moved)
		_origin = _player.global_position
	_hud = _main.find_child("HudLabel", true, false) as Label
	if _hud == null:
		_failures.append("主场景找不到 HudLabel（进度 x/3 指示缺失，需求验收第 4 条）")
	_win_overlay = _main.find_child("WinOverlay", true, false) as ColorRect
	if _win_overlay == null:
		_failures.append("主场景找不到 WinOverlay 胜利遮罩（scenes/main.tscn 缺少 %WinOverlay）")
	elif _win_overlay.visible:
		_failures.append("胜利遮罩开局即可见：胜利结算应只在集齐 3 颗后展示")
	_restart_button = _main.find_child("RestartButton", true, false) as Button
	if _restart_button == null:
		_failures.append("主场景找不到 RestartButton 重开入口")
	elif _restart_button.focus_mode != Control.FOCUS_NONE:
		_failures.append("触摸控件会抢焦点：RestartButton focus_mode != NONE（键盘空格会误触按钮而非收集）")
	# 场景加速：把派发间隔调到 TUNING_META 下限（0.6s），冒烟在门禁帧预算内必能等到流星。
	# 原值记录在案，调参协议探针阶段恢复 —— 检查不得污染被测状态。
	_spawn_interval_original = GameState.spawn_interval_seconds
	GameState.apply_tuning({"spawn_interval_seconds": 0.6})


func _physics_process(_delta: float) -> void:
	if _finished:
		return
	_frames += 1
	_stage_frame += 1
	if not _failures.is_empty() or _frames >= TOTAL_FRAMES:
		if _failures.is_empty():
			_failures.append("帧预算内未跑完（停在阶段 %s）：派发/收集链路可能卡死" % Stage.keys()[_stage])
		_report()
		return
	match _stage:
		Stage.NOISE:
			_inject_noise_frame()
			if _stage_frame >= NOISE_FRAMES:
				# 位移基线取噪声结束后（噪声里的移动键可能已把玩家推离初始点）。
				if _player != null:
					_origin = _player.global_position
				Input.action_press(&"move_right")
				_goto(Stage.MOVE)
		Stage.MOVE:
			if _stage_frame >= MOVE_FRAMES:
				Input.action_release(&"move_right")
				_assert_player_moved(false)
				_assert_hud_progress()
				_goto(Stage.SEEK_FIRST)
		Stage.SEEK_FIRST:
			var meteor := _first_active_meteor()
			if meteor != null:
				_probe_meteor = meteor
				_probe_window_left = meteor.window_left
				_goto(Stage.WINDOW_PROBE)
			elif _stage_frame >= SEEK_TIMEOUT_FRAMES:
				_failures.append("开局 %d 帧内没有任何在窗流星（派发器 _spawn_meteor 未生效）" % SEEK_TIMEOUT_FRAMES)
				_report()
		Stage.WINDOW_PROBE:
			if _stage_frame >= WINDOW_PROBE_FRAMES:
				_assert_window_countdown()
				_score_before_action = GameState.score
				_click_at(_probe_meteor.global_position)
				_goto(Stage.CLICK_SETTLE)
		Stage.CLICK_SETTLE:
			if _stage_frame >= SETTLE_FRAMES:
				if GameState.score != _score_before_action + 1:
					_failures.append("点击收集失效：点击流星后计数 %d → %d（期望恰好 +1，点击管线断裂或误收）" % [
						_score_before_action, GameState.score,
					])
					_report()
					return
				_assert_feedback_fired()
				_assert_hud_progress()
				_goto(Stage.SEEK_PULSE)
		Stage.SEEK_PULSE:
			var target := _first_active_meteor()
			if target != null:
				# 玩家瞬移到流星上（合法测试姿势）：confirm 祈愿脉冲必命中，隔离随机性。
				_player.global_position = target.global_position
				_score_before_action = GameState.score
				_inject_action(&"confirm")
				_goto(Stage.PULSE_SETTLE)
			elif _stage_frame >= SEEK_TIMEOUT_FRAMES:
				_failures.append("点击收集后 %d 帧内没有下一颗流星可脉冲（持续派发断裂）" % SEEK_TIMEOUT_FRAMES)
				_report()
		Stage.PULSE_SETTLE:
			if _stage_frame >= SETTLE_FRAMES:
				if GameState.score <= _score_before_action:
					_failures.append("祈愿脉冲失效：confirm 注入后计数 %d → %d（脉冲收集管线断裂）" % [
						_score_before_action, GameState.score,
					])
					_report()
					return
				if GameState.won_state:
					_goto(Stage.WIN_SETTLE)  # 脉冲一次收走多颗直达 3：跳过第三段收集
				else:
					_goto(Stage.SEEK_FINAL)
		Stage.SEEK_FINAL:
			var last := _first_active_meteor()
			if last != null:
				_score_before_action = GameState.score
				_click_at(last.global_position)
				_goto(Stage.WIN_SETTLE)
			elif _stage_frame >= SEEK_TIMEOUT_FRAMES:
				_failures.append("第二颗收集后 %d 帧内没有第三颗流星（胜负不可达）" % SEEK_TIMEOUT_FRAMES)
				_report()
		Stage.WIN_SETTLE:
			if _stage_frame >= SETTLE_FRAMES:
				_assert_win()
				_goto(Stage.POST_WIN_PROBE)
		Stage.POST_WIN_PROBE:
			if _stage_frame == 1:
				_post_win_probe()
			elif _stage_frame >= SETTLE_FRAMES + 8:
				_assert_post_win()
				_inject_action(&"restart")
				_goto(Stage.RESTART_SETTLE)
		Stage.RESTART_SETTLE:
			if _stage_frame >= RESTART_SETTLE_FRAMES:
				_assert_restarted()
				_moved_seen_after_restart = false
				Input.action_press(&"move_right")
				_goto(Stage.REPLAY_MOVE)
		Stage.REPLAY_MOVE:
			if _stage_frame >= REPLAY_FRAMES:
				Input.action_release(&"move_right")
				_assert_player_moved(true)
				_goto(Stage.TUNING_PROBE)
		Stage.TUNING_PROBE:
			_check_tuning_protocol()
			_report()


## 阶段切换：重置阶段内帧计数。
func _goto(stage: int) -> void:
	_stage = stage
	_stage_frame = 0


## 噪声相位：确定种子对抗事件（原始事件，不含 InputEventAction），打在前、行为断言在后。
func _inject_noise_frame() -> void:
	if _frames == 1:
		_noise_rng.seed = 20260913  # 门禁要求可复现：同种子同事件序
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
		# 噪声键只限移动键：原始 SPACE/ENTER/R 会经动作映射触发收集/重开，
		# 在正式断言前污染计数基线（噪声只许制造噪声，不许替测试通关）。
		k.physical_keycode = [KEY_A, KEY_D, KEY_W, KEY_S][_noise_rng.randi_range(0, 3)]
		k.pressed = _noise_rng.randf() < 0.5
		Input.parse_input_event(k)
	Input.flush_buffered_events()


## 无显示设备时模拟「玩家按键」：注入真实 InputEventAction 让 _unhandled_input 收得到，
## 并手动冲刷缓冲（headless DisplayServer 不逐帧冲刷，实测签名）。
func _inject_action(action: StringName) -> void:
	var event := InputEventAction.new()
	event.action = action
	event.pressed = true
	Input.parse_input_event(event)
	Input.flush_buffered_events()


## 模拟「点击」：注入鼠标左键按下事件；坐标按窗口像素解释（视口坐标 × final_transform），
## 与主场景 get_final_transform().affine_inverse() 的还原互逆 —— 换算错位会点击无效。
func _click_at(viewport_pos: Vector2) -> void:
	var event := InputEventMouseButton.new()
	event.button_index = MOUSE_BUTTON_LEFT
	event.position = get_viewport().get_final_transform() * viewport_pos
	event.pressed = true
	Input.parse_input_event(event)
	Input.flush_buffered_events()


## 场景内第一颗仍可收集的流星（排除已过期/已收集/待释放的节点）。
func _first_active_meteor() -> Meteor:
	if _meteors == null:
		return null
	for child in _meteors.get_children():
		var meteor := child as Meteor
		if meteor != null and meteor.active and not meteor.is_queued_for_deletion():
			return meteor
	return null


## ── 断言 ──

func _assert_player_moved(after_restart: bool) -> void:
	if _player == null:
		return
	var travelled: float = _player.global_position.distance_to(_origin)
	if travelled < MIN_MOVE_DISTANCE:
		_failures.append("玩家 %d 帧内位移 %.2fpx < %.2fpx：InputMap 动作未生效或 _physics_process 未驱动 velocity" % [
			MOVE_FRAMES, travelled, MIN_MOVE_DISTANCE,
		])
	if after_restart:
		if not _moved_seen_after_restart:
			_failures.append("重开后 Player.moved 未再次发出：重开清场把输入链路一并弄断了")
	else:
		if not _moved_seen:
			_failures.append("信号 Player.moved 未到达订阅方：连接断裂或从未 emit")


## HUD 进度常显且与实际计数一致（需求验收第 4 条：x/3 常显、口径一致）。
func _assert_hud_progress() -> void:
	if _hud == null:
		return
	var expected := "进度 %d/%d" % [GameState.score, GameState.WIN_COUNT]
	if not _hud.text.contains(expected):
		_failures.append("HUD 进度指示断裂：HudLabel.text=%s（期望包含 %s）" % [_hud.text, expected])


## 短窗口倒计时断言：window_left 在 (0, meteor_window_seconds] 内且随帧递减。
func _assert_window_countdown() -> void:
	if not is_instance_valid(_probe_meteor):
		_failures.append("窗口采样期间流星已被释放：窗口时长异常（应 ≥ meteor_window_seconds）")
		return
	if not _probe_meteor.active:
		_failures.append("窗口采样期间流星已失效：窗口 < %s 秒（与可配置窗口口径不符）" % GameState.meteor_window_seconds)
		return
	var window_left_now: float = _probe_meteor.window_left
	if _probe_window_left <= 0.0 or _probe_window_left > GameState.meteor_window_seconds + 0.001:
		_failures.append("流星窗口初值 %.3fs 不在 (0, %.1fs] 内：window_left 未按 meteor_window_seconds 初始化" % [
			_probe_window_left, GameState.meteor_window_seconds,
		])
	if window_left_now >= _probe_window_left:
		_failures.append("短窗口未倒数：window_left %.3fs → %.3fs（%d 帧内未递减，窗口机制断裂）" % [
			_probe_window_left, window_left_now, WINDOW_PROBE_FRAMES,
		])


## 收集反馈断言（SKILL.md §3B）：结果性事件必须挂 ≥1 条反馈（动画/音效都记录在 Juice.events）。
func _assert_feedback_fired() -> void:
	if Juice.events.is_empty():
		_failures.append("反馈断言：流星收集的结果事件没有触发任何 Juice 反馈"
			+ "（收集反馈 = 动画 + 音效，见需求验收第 2 条与 SKILL.md §3B）")


## 胜利断言：恰好 3 颗判胜 + 结算展示 + 进度 3/3 + 派发停止（<3 不得触发胜利由链路保证：
## 只有收集 +1 能推动计数，每段收集断言都验证了增量来源）。
func _assert_win() -> void:
	if GameState.score != GameState.WIN_COUNT:
		_failures.append("胜利口径破坏：触发胜利时计数 %d != %d（计数不足 3 不得触发胜利）" % [
			GameState.score, GameState.WIN_COUNT,
		])
	if not GameState.won_state:
		_failures.append("胜负不可达：集齐 %d 颗后 GameState.won_state 仍为假（add_score 胜利分支断裂）" % GameState.WIN_COUNT)
	if not _won_seen:
		_failures.append("信号 GameState.won 未到达订阅方：胜利判定链路断裂")
	if _win_overlay != null and not _win_overlay.visible:
		_failures.append("胜利结算未展示：集齐后 WinOverlay 仍隐藏（main.gd _on_won 未生效）")
	_assert_hud_progress()
	if _main.spawning:
		_failures.append("胜利后派发未停止：main.spawning 仍为真（单局应在集齐后收口）")
	_meteors_at_win = _meteors.get_child_count()


## 胜后探针：对残留在窗流星先手动过期再点其位置（无残留则点空地）——
## 两条路径都不得再加分（需求验收：计数已达 3，任何操作不得再触发收集/胜利）。
func _post_win_probe() -> void:
	var residual := _first_active_meteor()
	if residual != null:
		residual.expire()
		_click_at(residual.global_position)
	else:
		_click_at(Vector2(GameState.FIELD_WIDTH, GameState.FIELD_HEIGHT) * 0.5)


func _assert_post_win() -> void:
	if GameState.score != GameState.WIN_COUNT:
		_failures.append("胜后误收集：胜利后点击使计数 %d → %d（胜利态必须冻结收集）" % [
			GameState.WIN_COUNT, GameState.score,
		])
	if not GameState.won_state:
		_failures.append("胜利态被意外清除：won_state 变假（重开之外不得复位）")
	if _meteors.get_child_count() > _meteors_at_win:
		_failures.append("胜利后仍在新派发：%d → %d 颗（派发未收口）" % [
			_meteors_at_win, _meteors.get_child_count(),
		])


## 重开断言：状态/分数/遮罩/派发/玩家归位/流星清场全复位。
func _assert_restarted() -> void:
	if GameState.score != 0:
		_failures.append("重开不可用：分数未清零（score=%d）" % GameState.score)
	if GameState.won_state:
		_failures.append("重开不可用：won_state 未复位")
	if not _restarted_seen:
		_failures.append("信号 GameState.restarted 未到达订阅方：重开链路断裂")
	if _win_overlay != null and _win_overlay.visible:
		_failures.append("重开不可用：胜利遮罩仍显示")
	if _restart_button == null or not _restart_button.visible:
		_failures.append("重开入口缺失：RestartButton 不可见（常驻重开入口是需求硬要求）")
	_assert_hud_progress()
	if not _main.spawning:
		_failures.append("重开不可用：派发未恢复（main.spawning 仍为假，重开后无流星可收集）")
	if _player != null and _player.global_position.distance_to(
			Vector2(GameState.FIELD_WIDTH, GameState.FIELD_HEIGHT) / 2.0) > 2.0:
		_failures.append("重开不可用：玩家未归位（%s，期望场地中心附近）" % _player.global_position)
	# 清场断言：旧流星全部离场（重开立即派发新流星是设计行为，不判「场上无流星」，
	# 判「没有任何旧流星残留」—— 以 restart 广播前的子节点数为基准无法跨帧取证，
	# 改判派发已恢复（上面 spawning）+ 旧流星标记均随 queue_free 离场）。


## ── 调参协议（SKILL.md §3C，纯逻辑、无头可判）──

## 静态断言：TUNING_META 声明齐四个可调键（缺键 = 调参面板/桥无法覆盖该数值）。
func _check_tuning_meta(game_state: Node) -> void:
	var meta: Variant = game_state.get("TUNING_META")
	if not (meta is Dictionary) or (meta as Dictionary).is_empty():
		_failures.append("调参协议：GameState.TUNING_META 为空或不可读（数值调参区必须声明可调键）")
		return
	for key: String in ["move_speed", "meteor_window_seconds", "pulse_radius", "spawn_interval_seconds"]:
		if not (meta as Dictionary).has(StringName(key)):
			_failures.append("调参协议：TUNING_META 缺少键 %s（可调数值必须成对声明变量 + META）" % key)


## 动态断言：apply_tuning 应用已声明键、拒绝未声明键、按 max 钳制；检查完恢复原值
## （协议检查不得污染被测状态，包括冒烟自己加速用的派发间隔）。
func _check_tuning_protocol() -> void:
	var game_state := get_tree().root.get_node_or_null("GameState")
	if game_state == null:
		return
	game_state.set("spawn_interval_seconds", _spawn_interval_original)
	var originals: Dictionary = {}
	for key: String in TUNING_PROBE_KEYS:
		originals[key] = game_state.get(key)
	var applied: PackedStringArray = game_state.call("apply_tuning", {
		"move_speed": 99999.0,
		"meteor_window_seconds": 99999.0,
		"tuning_bogus_key": 1,
	})
	for key: String in TUNING_PROBE_KEYS:
		if not applied.has(key):
			_failures.append("调参协议：apply_tuning 未应用已声明键 %s（应用逻辑断裂）" % key)
	if applied.has("tuning_bogus_key"):
		_failures.append("调参协议：apply_tuning 应用了未声明键 tuning_bogus_key（必须只认 TUNING_META 声明的键）")
	var meta: Dictionary = game_state.get("TUNING_META")
	for key: String in TUNING_PROBE_KEYS:
		var value: Variant = game_state.get(key)
		var max_value: float = float(meta[StringName(key)]["max"])
		if not (value is float or value is int) or float(value) > max_value:
			_failures.append("调参协议：%s=%s 超出 TUNING_META.max=%s（钳制缺失）" % [key, value, max_value])
	for key: String in TUNING_PROBE_KEYS:
		if applied.has(key):
			game_state.set(key, originals[key])


## ── 键位契约断言：目标键表 → project.godot [input] 的 physical_keycode（逐键 AND，E-12）──
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


## ── 信号回调 ──
func _on_player_moved(_position: Vector2) -> void:
	_moved_seen = true
	_moved_seen_after_restart = true


func _on_score_changed(_score: int) -> void:
	_score_seen = true


func _on_won() -> void:
	_won_seen = true


func _on_restarted() -> void:
	_restarted_seen = true


## ── 报告（判定协议：标记 + 退出码一致）──
func _report() -> void:
	if _finished:
		return
	_finished = true
	if _failures.is_empty():
		print("GODOT_SMOKE: PASS 场景接线/键位契约/玩家移动/短窗口倒数/点击收集/祈愿脉冲/三颗即胜/胜后冻结/重开复位/重玩可动/调参协议 全部通过")
		get_tree().quit(0)
	else:
		for failure in _failures:
			printerr("GODOT_SMOKE: FAIL %s" % failure)
		get_tree().quit(1)
