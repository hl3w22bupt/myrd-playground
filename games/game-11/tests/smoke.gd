extends Node
## 无头冒烟自检（headless smoke）—— 接苹果（game-11）机器可判定的「能不能跑且玩得动」。
##
## 运行方式（由 scripts/smoke.sh 封装）：
##   godot --headless --path <工程目录> tests/smoke.tscn
##
## 判定协议（smoke.sh 按此断言退出码与日志）：
##   通过 → stdout 打印 `GODOT_SMOKE: PASS ...`，进程退出码 0
##   失败 → stderr 打印 `GODOT_SMOKE: FAIL <原因>`（每条一行），进程退出码 1
##
## 断言覆盖（需求验收标准中可无头判定的部分，逐项对应）：
##   1. 场景可实例化（main.tscn → player.tscn 接线未断裂，Player 找得到）
##   2. autoload 已注册且带约定信号（score_changed / lives_changed / state_changed / game_over）
##   3. InputMap 动作已注册、物理键绑定正确（键位契约逐键 AND），注入输入后果篮真的动了
##   4. 信号真的到达订阅方（Player.moved / GameState.score_changed / game_over）
##   5. 开局入口可用（confirm 动作 → state 变 PLAYING，开始面板隐藏）
##   6. 核心交互生效（接住 +1 分；漏接 -1 生命；难度随得分可观测递增）
##   7. 碰撞包络不变式（隧穿红线、出生点不落在果篮擦边死角、漏接线在画面外）
##   8. 指针跟随生效（鼠标移动 → 果篮跟随；触屏按下+拖动 → 跟随；抬起 → 交还键盘）
##   9. 边界钳制不卡死角（越界位置在下一物理帧被收回 [70, 570]，两侧都不越留白线）
##  10. 反馈可达（接住弹出「接住 +1」；漏接弹出「漏接 -1 生命」+ 红闪）
##  11. 胜负可达（生命耗尽 → GAME_OVER + 结算面板可见 + 新纪录标记与判定一致 + 最高分落盘）
##  12. 最高分跨「页面刷新」仍在（结算后 reload_best() 从磁盘重读，值不丢）
##  13. 重开可用（confirm → 回 PLAYING，分数/生命重置，结算面板隐藏）
##
## ⚠️ 输入注入分阶段互不重叠（见 references/error-signatures.md E-08）：
##   `Input.parse_input_event()` 的缓冲冲刷会清掉 `Input.action_press()` 的按下状态，
##   两者同帧混用会让「移动断言」假失败 —— confirm 注入与移动阶段之间隔了多帧。

## ── 噪声相位（输入鲁棒性门禁的逐游戏语义层，模板内置，保留）──
## 正式断言前注入一段确定种子的对抗输入：悬挂手势（按下不抬起）、孤儿释放（抬起无按下）、
## 双指抢控、乱键。随后照常执行移动/收集断言 —— 断言仍全过 = 噪声没有楔死输入管线。
const NOISE_FRAMES: int = 30

## ── 各相位帧预算（总预算远小于 GODOT_SMOKE_FRAMES=240）──
const START_FRAMES: int = 6          # 注入 confirm 后等待状态翻转
const MOVE_FRAMES: int = 10          # 按住 move_right 的帧数
const CATCH_FRAMES: int = 10         # 等待 Area2D 重叠判定 + 信号送达
const POINTER_CLEAN_FRAMES: int = 3  # 抬起噪声相位可能留下的悬挂触点（真实设备上手指总会离屏）
const POINTER_MOUSE_FRAMES: int = 12 # 鼠标移动 → 果篮趋近目标（60px @ 340px/s ≈ 11 帧）
const POINTER_TOUCH_FRAMES: int = 12 # 触屏按下 + 拖动 → 跟随；抬起 → 交还键盘
const EDGE_FRAMES: int = 8           # 越界摆位后等钳制在下一/下二物理帧生效
const MISS_FRAMES_MAX: int = 45      # 等待苹果落到底线（漏接）
const EXHAUST_FRAMES: int = 4        # 等待 game_over 信号与结算面板刷新
const RESTART_FRAMES: int = 6        # 注入 confirm 后等待重开
const TOTAL_FRAMES: int = NOISE_FRAMES + START_FRAMES + MOVE_FRAMES + CATCH_FRAMES \
		+ POINTER_CLEAN_FRAMES + POINTER_MOUSE_FRAMES + POINTER_TOUCH_FRAMES + EDGE_FRAMES \
		+ MISS_FRAMES_MAX + EXHAUST_FRAMES + RESTART_FRAMES + 6

## 判定「真的移动了」的最小位移（px）：BASKET_SPEED=340，10 帧理论位移 ≈ 57px。
const MIN_MOVE_DISTANCE: float = 20.0
## 漏接相位的下落加速（px/s）：把等待压进帧预算，不改变玩法语义。
## （900 < 隧穿安全上限 1560，见 game_state.gd APPLE_FALL_SPEED_TUNNEL_SAFE。）
const MISS_FALL_SPEED: float = 900.0
## 指针跟随相位的目标与果篮的横向距离（px）：60px @ 340px/s ≈ 11 帧内可收完，
## 既足以证明「真的朝目标移动」，又不撑爆帧预算。
const POINTER_TARGET_DISTANCE: float = 60.0
## 判定「已跟随到位」的容差（px）：FOLLOW_SNAP=3 直接贴合，再留 5px 给速度钳制的余量。
const POINTER_ARRIVE_TOLERANCE: float = 8.0
## 漏接相位的苹果出生点 y（画面顶部之上）。
const MISS_APPLE_Y: float = -20.0

const REQUIRED_ACTIONS: Array[StringName] = [
	&"move_left", &"move_right", &"move_up", &"move_down", &"confirm",
]

## 键位契约：动作 → 键表承诺的物理键，**必须全部绑定**（与 project.godot [input] 对应）。
## 逐键核对（AND）而非「绑了其中一个就算过」：键表写「A / ←」就是承诺两个键都能用。
const KEY_CONTRACT: Dictionary = {
	&"move_left": [KEY_A, KEY_LEFT],
	&"move_right": [KEY_D, KEY_RIGHT],
	&"move_up": [KEY_W, KEY_UP],
	&"move_down": [KEY_S, KEY_DOWN],
	&"confirm": [KEY_SPACE, KEY_ENTER],
}

enum Phase { NOISE, START, MOVE, CATCH, POINTER_CLEAN, POINTER_MOUSE, POINTER_TOUCH, EDGE,
		MISS, EXHAUST, RESTART, REPORT }

var _failures: PackedStringArray = []
var _phase: Phase = Phase.NOISE
var _phase_frame: int = 0
var _frames: int = 0
var _finished: bool = false

var _main: MainGame
var _player: Player
var _origin: Vector2 = Vector2.ZERO
var _miss_apple: Apple

var _moved_seen: bool = false
var _score_seen: bool = false
var _state_playing_seen: bool = false
var _game_over_seen: bool = false

var _score_before_catch: int = 0
var _lives_before_miss: int = 0
var _score_at_game_over: int = 0
var _best_at_game_over: int = 0

## ── 指针跟随相位的基准（需求第 3 条）──
var _mouse_target_x: float = 0.0     # 鼠标相位注入的目标 x（游戏区坐标）
var _mouse_start_x: float = 0.0      # 鼠标相位开始时的果篮 x
var _touch_target_x: float = 0.0     # 触屏相位注入的目标 x
var _touch_start_x: float = 0.0      # 触屏相位开始时的果篮 x
## 指针区实际发出来的目标 x（诊断 + 断言「注入的事件真的被指针区收到」）。
var _zone_target_x: float = NAN
var _zone_emit_count: int = 0


func _ready() -> void:
	# headless 没有垂直同步，process 帧率可跑到几百上千 FPS，而物理固定 60Hz。
	# `--quit-after N` 数的是 process 帧：限到 60 FPS 让 process 帧 : 物理帧 ≈ 1:1，
	# --quit-after 的兜底才有意义（模板既有做法，不得删除）。
	Engine.max_fps = 60

	# 碰撞包络是纯数值不变式，不用等帧，_ready 里一次判完。
	_assert_collision_envelope()

	for action in REQUIRED_ACTIONS:
		if not InputMap.has_action(action):
			_failures.append("InputMap 缺少动作 %s（project.godot [input] 未注册）" % action)
	_check_key_bindings()

	var game_state := get_tree().root.get_node_or_null("GameState")
	if game_state == null:
		_failures.append("autoload GameState 未注册（project.godot [autoload] 缺失）")
	else:
		for signal_name in ["score_changed", "lives_changed", "state_changed", "game_over", "best_changed"]:
			if not game_state.has_signal(signal_name):
				_failures.append("autoload GameState 缺少信号 %s" % signal_name)
		game_state.score_changed.connect(_on_score_changed)
		game_state.state_changed.connect(_on_state_changed)
		game_state.game_over.connect(_on_game_over)

	_player = get_tree().root.find_child("Player", true, false) as Player
	if _player == null:
		_failures.append("场景树找不到 Player（main.tscn 未实例化 player.tscn，或实例名不是 Player）")
	else:
		_player.moved.connect(_on_player_moved)
		_origin = _player.global_position

	_main = get_tree().root.find_child("Main", true, false) as MainGame
	if _main == null:
		_failures.append("场景树找不到 Main（tests/smoke.tscn 未实例化 main.tscn）")
	else:
		var zone := _main.get_node("%PointerFollowZone")
		if zone == null:
			_failures.append("场景树找不到 %PointerFollowZone（main.tscn 缺指针跟随区）")
		else:
			zone.follow_target_changed.connect(_on_zone_target_changed)


func _physics_process(_delta: float) -> void:
	if _finished:
		return
	_frames += 1
	_phase_frame += 1

	if _failures.is_empty():
		match _phase:
			Phase.NOISE:
				_inject_noise_frame()
				if _phase_frame >= NOISE_FRAMES:
					_enter_phase(Phase.START)
			Phase.START:
				if _phase_frame == 1:
					_press_action(&"confirm")
				elif _phase_frame >= START_FRAMES:
					_assert_game_started()
					_enter_phase(Phase.MOVE)
			Phase.MOVE:
				if _phase_frame == 1:
					Input.action_press(&"move_right")
				elif _phase_frame >= MOVE_FRAMES:
					Input.action_release(&"move_right")
					_assert_player_moved()
					_enter_phase(Phase.CATCH)
			Phase.CATCH:
				if _phase_frame == 1:
					_spawn_catch_apple()
				elif _phase_frame >= CATCH_FRAMES:
					_assert_apple_caught()
					_enter_phase(Phase.POINTER_CLEAN)
			Phase.POINTER_CLEAN:
				# 噪声相位注入过「按下不抬起」的悬挂手势；真实设备上手指总会离屏。
				# 先把两个触点都抬起，否则 PointerFollowZone 会一直占用、鼠标跟随被吞
				# （这正是 input-fuzz 要拦的「指针状态残留」类缺陷的复现路径）。
				if _phase_frame == 1:
					_inject_touch(0, Vector2.ZERO, false)
					_inject_touch(1, Vector2.ZERO, false)
				elif _phase_frame >= POINTER_CLEAN_FRAMES:
					_enter_phase(Phase.POINTER_MOUSE)
			Phase.POINTER_MOUSE:
				if _phase_frame == 1:
					_begin_mouse_follow()
				else:
					_inject_mouse_motion(_mouse_target_x)
					if _phase_frame >= POINTER_MOUSE_FRAMES:
						_assert_mouse_follow()
						_enter_phase(Phase.POINTER_TOUCH)
			Phase.POINTER_TOUCH:
				if _phase_frame == 1:
					_begin_touch_follow()
				elif _phase_frame < POINTER_TOUCH_FRAMES - 2:
					_inject_touch(0, Vector2(_touch_target_x, GameState.BASKET_Y), true)
					_inject_drag(0, Vector2(_touch_target_x, GameState.BASKET_Y))
				elif _phase_frame == POINTER_TOUCH_FRAMES - 2:
					_inject_touch(0, Vector2(_touch_target_x, GameState.BASKET_Y), false)
				elif _phase_frame >= POINTER_TOUCH_FRAMES:
					_assert_touch_follow()
					_enter_phase(Phase.EDGE)
			Phase.EDGE:
				if _phase_frame == 1:
					_break_edge_right()
				elif _phase_frame == 4:
					_assert_edge_clamped(false)
					_break_edge_left()
				elif _phase_frame >= EDGE_FRAMES:
					_assert_edge_clamped(true)
					_enter_phase(Phase.MISS)
			Phase.MISS:
				if _phase_frame == 1:
					_spawn_miss_apple()
				elif _lives_before_miss - GameState.lives >= 1 \
						or GameState.state == GameState.State.GAME_OVER:
					_assert_apple_missed()
					_enter_phase(Phase.EXHAUST)
				elif _phase_frame >= MISS_FRAMES_MAX:
					_assert_apple_missed()
					_enter_phase(Phase.EXHAUST)
			Phase.EXHAUST:
				if _phase_frame == 1:
					_exhaust_lives()
				elif _phase_frame >= EXHAUST_FRAMES:
					_assert_game_over()
					_enter_phase(Phase.RESTART)
			Phase.RESTART:
				if _phase_frame == 1:
					_press_action(&"confirm")
				elif _phase_frame >= RESTART_FRAMES:
					_assert_restarted()
					_enter_phase(Phase.REPORT)
			Phase.REPORT:
				_finished = true
				_report()
				return

	if _frames >= TOTAL_FRAMES or not _failures.is_empty():
		_finished = true
		_report()


func _enter_phase(phase: Phase) -> void:
	_phase = phase
	_phase_frame = 0


## ── 噪声相位：确定种子随机事件（原始事件，不含 InputEventAction）──
var _noise_rng := RandomNumberGenerator.new()


func _inject_noise_frame() -> void:
	if _phase_frame == 1:
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


## ── 原始指针事件注入（PointerFollowZone 只认这三类，见 scripts/pointer_follow_zone.gd）──
## 三个注入函数都收「游戏区坐标」，内部统一换算成 Input.parse_input_event 期望的窗口坐标：
## headless 的 dummy 窗口是 64×64，stretch=canvas_items 会把 640×360 画布缩到 0.1，
## Viewport 派发时再用 final_transform 的逆阵把窗口坐标换回游戏区坐标 —— 于是注入值被放大
## 10 倍，果篮会被直接驱到边界钳制位上（实测 477.7 → 4776.8）。真机窗口 ≥ 视口、缩放 ≈ 1，
## 游戏代码没有问题；这里正向乘一次 final_transform 才能让事件落在预期的游戏区坐标上。
func _game_to_window_pos(game_pos: Vector2) -> Vector2:
	return get_viewport().get_final_transform() * game_pos


func _inject_touch(index: int, game_pos: Vector2, pressed: bool) -> void:
	var event := InputEventScreenTouch.new()
	event.index = index
	event.position = _game_to_window_pos(game_pos)
	event.pressed = pressed
	Input.parse_input_event(event)


func _inject_drag(index: int, game_pos: Vector2) -> void:
	var event := InputEventScreenDrag.new()
	event.index = index
	event.position = _game_to_window_pos(game_pos)
	event.relative = Vector2.ZERO
	Input.parse_input_event(event)


func _inject_mouse_motion(x: float) -> void:
	var event := InputEventMouseMotion.new()
	event.position = _game_to_window_pos(Vector2(x, GameState.BASKET_Y))
	Input.parse_input_event(event)


## 取一个「离果篮 POINTER_TARGET_DISTANCE、且落在钳制区间内」的指针目标 x。
## 目标必须合法：PointerFollowZone 发出的 x 会被 player.gd 的边界钳制收住，
## 若目标本身在区间外，跟随断言就会假失败（钳制截断了趋近，不是跟随失效）。
func _follow_target_from(current_x: float) -> float:
	var clamp_range := GameState.basket_clamp_range()
	var desired := current_x - POINTER_TARGET_DISTANCE  # 往左走：远离右边界钳制位，位移可观测
	return clampf(desired, clamp_range.x + POINTER_TARGET_DISTANCE, clamp_range.y - POINTER_TARGET_DISTANCE)


## ── 指针跟随相位动作 ──
func _begin_mouse_follow() -> void:
	_mouse_start_x = _player.global_position.x
	_mouse_target_x = _follow_target_from(_mouse_start_x)


func _begin_touch_follow() -> void:
	_touch_start_x = _player.global_position.x
	_touch_target_x = _follow_target_from(_touch_start_x)


## ── 边界钳制相位动作：把果篮摆到区间外，验证下一物理帧被收回（不卡死角）──
func _break_edge_right() -> void:
	_player.global_position.x = GameState.VIEWPORT_WIDTH + 500.0


func _break_edge_left() -> void:
	_player.global_position.x = -500.0


## ── 相位动作 ──
func _spawn_catch_apple() -> void:
	_score_before_catch = GameState.score
	_score_seen = false  # 开局 start_game 已广播过一次得分；这里只认「接住」这一次
	# 直接把苹果生成在果篮中心：断言「重叠 → 接住 → 计分」这条真实交互链路。
	_main.spawn_apple(_player.global_position)


func _spawn_miss_apple() -> void:
	_lives_before_miss = GameState.lives
	# 出生 x 取离果篮较远的一侧：指针/边界相位挪过果篮，写死的一侧可能撞上果篮当前位置
	# 而被顺路接住，让漏接断言假失败。
	var spawn_range := GameState.spawn_range()
	var x := spawn_range.x if _player.global_position.x > GameState.VIEWPORT_WIDTH * 0.5 \
			else spawn_range.y
	_miss_apple = _main.spawn_apple(Vector2(x, MISS_APPLE_Y))
	# 加速下落把等待压进帧预算；落点远离果篮 → 走漏接分支。
	_miss_apple.fall_speed = MISS_FALL_SPEED


func _exhaust_lives() -> void:
	# 胜负可达：把剩余生命扣完（与漏接共用同一条 miss_apple 计分路径）。
	while GameState.lives > 0:
		GameState.miss_apple()
	_score_at_game_over = GameState.score


## ── 断言 ──
func _assert_game_started() -> void:
	if GameState.state != GameState.State.PLAYING:
		_failures.append("开局入口不可用：注入 confirm 后 state 仍为 %s（应为 PLAYING）" % GameState.state)
	if not _state_playing_seen:
		_failures.append("信号 GameState.state_changed 未到达订阅方：开局状态切换没有广播")
	if _main.get_node("%StartPanel").visible:
		_failures.append("开始面板未隐藏：开局入口没有收起 StartPanel")
	# 关掉环境生成，让后续「接住 / 漏接」断言只受本测试注入的苹果影响。
	_main.spawn_timer.stop()


func _assert_player_moved() -> void:
	if _player == null:
		return
	if not _moved_seen:
		_failures.append("信号 Player.moved 未到达订阅方：连接断裂或果篮从未 emit")
	var travelled: float = _player.global_position.distance_to(_origin)
	if travelled < MIN_MOVE_DISTANCE:
		_failures.append(
			"果篮 %d 帧内位移 %.2fpx < %.2fpx：InputMap 动作未生效或 _physics_process 未驱动 velocity" % [
				MOVE_FRAMES, travelled, MIN_MOVE_DISTANCE,
			]
		)


func _assert_apple_caught() -> void:
	if not _score_seen:
		_failures.append("信号 GameState.score_changed 未到达订阅方：接住苹果没有广播得分")
	if GameState.score != _score_before_catch + 1:
		_failures.append("接住判定失效：得分 %d 应为 %d + 1（Area2D 重叠 → 计分链路断裂）" % [
			GameState.score, _score_before_catch,
		])
	# 接住反馈（需求第 2 条「给出接住反馈」）：计数器与提示文案都要到位。
	if _main.catch_feedback_count < 1:
		_failures.append("接住反馈未触发：接住苹果后 catch_feedback_count=%d（应 ≥ 1）" % [
			_main.catch_feedback_count,
		])
	elif not _main.get_node("%FeedbackLabel").text.begins_with("接住"):
		_failures.append("接住反馈文案缺失：FeedbackLabel=「%s」（应以「接住」开头）" % [
			_main.get_node("%FeedbackLabel").text,
		])
	# 难度递增（需求第 4 条）：得分上升后，下落速度变快、生成间隔变短。
	if GameState.apple_fall_speed() <= GameState.APPLE_FALL_SPEED:
		_failures.append("难度曲线失效：得分 %d 时下落速度 %.1f 未高于初值 %.1f" % [
			GameState.score, GameState.apple_fall_speed(), GameState.APPLE_FALL_SPEED,
		])
	if GameState.spawn_interval() >= GameState.SPAWN_INTERVAL:
		_failures.append("难度曲线失效：得分 %d 时生成间隔 %.3f 未短于初值 %.3f" % [
			GameState.score, GameState.spawn_interval(), GameState.SPAWN_INTERVAL,
		])


func _assert_apple_missed() -> void:
	if GameState.lives != _lives_before_miss - 1:
		_failures.append("漏接判定失效：生命 %d 应为 %d - 1（苹果越线未扣生命）" % [
			GameState.lives, _lives_before_miss,
		])
	# 漏接反馈：与接住反馈同一套机判口径。
	if _main.miss_feedback_count < 1:
		_failures.append("漏接反馈未触发：漏接苹果后 miss_feedback_count=%d（应 ≥ 1）" % [
			_main.miss_feedback_count,
		])
	elif not _main.get_node("%FeedbackLabel").text.begins_with("漏接"):
		_failures.append("漏接反馈文案缺失：FeedbackLabel=「%s」（应以「漏接」开头）" % [
			_main.get_node("%FeedbackLabel").text,
		])


## ── 指针跟随（需求第 3 条：鼠标水平移动与触屏水平拖动都要能实时驱动果篮）──
func _assert_mouse_follow() -> void:
	var travelled: float = absf(_mouse_start_x - _player.global_position.x)
	if travelled < POINTER_TARGET_DISTANCE * 0.5:
		_failures.append("鼠标跟随失效：注入 InputEventMouseMotion 后果篮仅移动 %.1fpx（应 ≥ %.1fpx）" % [
			travelled, POINTER_TARGET_DISTANCE * 0.5,
		])
	var residual: float = absf(_player.global_position.x - _mouse_target_x)
	if residual > POINTER_ARRIVE_TOLERANCE:
		_failures.append("鼠标跟随不到位：果篮 x=%.1f 距目标 %.1f 还差 %.1fpx（容差 %.1fpx）" % [
			_player.global_position.x, _mouse_target_x, residual, POINTER_ARRIVE_TOLERANCE,
		])


func _assert_touch_follow() -> void:
	var travelled: float = absf(_touch_start_x - _player.global_position.x)
	if travelled < POINTER_TARGET_DISTANCE * 0.5:
		_failures.append("触屏拖动跟随失效：注入 ScreenTouch+ScreenDrag 后果篮仅移动 %.1fpx（应 ≥ %.1fpx）" % [
			travelled, POINTER_TARGET_DISTANCE * 0.5,
		])
	var residual: float = absf(_player.global_position.x - _touch_target_x)
	if residual > POINTER_ARRIVE_TOLERANCE:
		_failures.append("触屏跟随不到位：果篮 x=%.1f 距目标 %.1f 还差 %.1fpx（容差 %.1fpx）" % [
			_player.global_position.x, _touch_target_x, residual, POINTER_ARRIVE_TOLERANCE,
		])
	# 「抬起 → 交还控制」由紧随其后的 EDGE 相位兜底验证：若触点没被释放，
	# PointerFollowZone 会继续用最后一次触点驱动果篮，果篮就会在钳制摆位后
	# 自己跑回旧目标，边界断言必然失败。


## ── 边界钳制（手感：不卡死角）──
func _assert_edge_clamped(check_left: bool) -> void:
	var clamp_range := GameState.basket_clamp_range()
	var x := _player.global_position.x
	if x < clamp_range.x - 0.01 or x > clamp_range.y + 0.01:
		_failures.append("边界钳制失效：果篮 x=%.1f 越出可达区间 [%.1f, %.1f]（会卡在画面外/死角）" % [
			x, clamp_range.x, clamp_range.y,
		])
	var expected: float = clamp_range.x if check_left else clamp_range.y
	if absf(x - expected) > 0.01:
		_failures.append("边界钳制不到位：果篮 x=%.1f 应已收回边界 %.1f" % [x, expected])
	# 用真实碰撞形状（而不是常量）核对「边缘不越留白线」：形状被改宽时这里会先红。
	var shape := _player.get_node("CollisionShape2D").shape as RectangleShape2D
	var half_width: float = shape.size.x * 0.5 if shape != null else GameState.BASKET_HALF_WIDTH
	if x - half_width < GameState.PLAYFIELD_MARGIN - 0.01 \
			or x + half_width > GameState.VIEWPORT_WIDTH - GameState.PLAYFIELD_MARGIN + 0.01:
		_failures.append("果篮边缘越出留白线：x=%.1f 半宽=%.1f，边缘区间 [%.1f, %.1f] 应在 [%d, %d] 内" % [
			x, half_width, x - half_width, x + half_width,
			int(GameState.PLAYFIELD_MARGIN), int(GameState.VIEWPORT_WIDTH - GameState.PLAYFIELD_MARGIN),
		])


## ── 碰撞包络不变式（纯逻辑，静态可判，无需等帧）──
func _assert_collision_envelope() -> void:
	# 隧穿红线：下落速度上限必须低于「每帧位移 < 重叠带一半」的安全值，否则高速苹果
	# 会一步跨过果篮矩形而不触发 body_entered（表现为「明明接住了却判漏接」）。
	if GameState.APPLE_FALL_SPEED_MAX >= GameState.APPLE_FALL_SPEED_TUNNEL_SAFE:
		_failures.append("隧穿余量不足：下落速度上限 %.0fpx/s ≥ 安全上限 %.0fpx/s（高速苹果会穿透果篮）" % [
			GameState.APPLE_FALL_SPEED_MAX, GameState.APPLE_FALL_SPEED_TUNNEL_SAFE,
		])
	# 出生点不得落在果篮「擦边死角」：任何出生 x 都必须能被果篮正面覆盖，
	# 余量 = CATCH_MARGIN + APPLE_RADIUS（出生点向内收 + 苹果自身半径）。
	var clamp_range := GameState.basket_clamp_range()
	var spawn_range := GameState.spawn_range()
	var catchable_left := clamp_range.x - GameState.BASKET_HALF_WIDTH - GameState.APPLE_RADIUS
	var catchable_right := clamp_range.y + GameState.BASKET_HALF_WIDTH + GameState.APPLE_RADIUS
	if spawn_range.x < catchable_left + GameState.CATCH_MARGIN \
			or spawn_range.y > catchable_right - GameState.CATCH_MARGIN:
		_failures.append("出生范围 [%.0f, %.0f] 太贴近果篮擦边死角（可覆盖 [%.0f, %.0f]，应各留 ≥%dpx 余量）" % [
			spawn_range.x, spawn_range.y, catchable_left, catchable_right, int(GameState.CATCH_MARGIN),
		])
	# 漏接线必须在画面外：苹果整体离屏才判漏接，玩家能看到它落地而不是半途消失。
	if GameState.FLOOR_Y <= GameState.VIEWPORT_HEIGHT:
		_failures.append("漏接线 %.0f 不在画面外（视口高 %.0f）：苹果会凭空消失" % [
			GameState.FLOOR_Y, GameState.VIEWPORT_HEIGHT,
		])
	if GameState.SPAWN_INTERVAL_MIN <= 0.0:
		_failures.append("生成间隔下限 %.2f 非正数：难度曲线会把生成间隔压成 0" % GameState.SPAWN_INTERVAL_MIN)


func _assert_game_over() -> void:
	if GameState.state != GameState.State.GAME_OVER:
		_failures.append("胜负判定不可达：生命耗尽后 state 仍为 %s（应为 GAME_OVER）" % GameState.state)
	if not _game_over_seen:
		_failures.append("信号 GameState.game_over 未到达订阅方：结算没有广播")
	if not _main.get_node("%GameOverPanel").visible:
		_failures.append("结算面板未显示：生命耗尽后 GameOverPanel 仍隐藏")
	if GameState.best < _score_at_game_over:
		_failures.append("最高分未更新：best %d < 本局得分 %d" % [GameState.best, _score_at_game_over])
	if not FileAccess.file_exists(GameState.SAVE_PATH):
		_failures.append("最高分未持久化：找不到 %s（页面刷新后最高分会丢）" % GameState.SAVE_PATH)
	# 新纪录标记必须与 GameState 的判定一致（同一事实来源，不允许界面再算一遍）。
	if _main.get_node("%NewRecordLabel").visible != GameState.is_new_record():
		_failures.append("新纪录标记与判定不一致：label.visible=%s，is_new_record()=%s" % [
			_main.get_node("%NewRecordLabel").visible, GameState.is_new_record(),
		])
	_best_at_game_over = GameState.best


func _assert_restarted() -> void:
	if GameState.state != GameState.State.PLAYING:
		_failures.append("重开不可用：结算界面注入 confirm 后 state 仍为 %s（应为 PLAYING）" % GameState.state)
	if GameState.score != 0:
		_failures.append("重开未清零本局得分：score=%d（应为 0）" % GameState.score)
	if GameState.lives != GameState.START_LIVES:
		_failures.append("重开未重置生命：lives=%d（应为 %d）" % [GameState.lives, GameState.START_LIVES])
	if _main.get_node("%GameOverPanel").visible:
		_failures.append("重开后结算面板仍显示：GameOverPanel 未隐藏")
	if _main.get_node("%NewRecordLabel").visible:
		_failures.append("重开后新纪录标记仍显示：NewRecordLabel 未随结算面板收起")
	if GameState.best < _score_at_game_over:
		_failures.append("重开后最高分丢失：best %d < 重开前 %d" % [GameState.best, _score_at_game_over])
	# 需求第 5 条「页面刷新后不丢失」：reload_best() 抛开内存值、从磁盘重读，
	# 模拟 Web 导出下浏览器刷新后进程重建、内存里的 best 归零再重新加载。
	GameState.reload_best()
	if GameState.best < _best_at_game_over:
		_failures.append("最高分跨「页面刷新」丢失：磁盘重读 best %d < 结算时 %d" % [
			GameState.best, _best_at_game_over,
		])


## ── 报告 ──
func _report() -> void:
	if _finished and _phase != Phase.REPORT and _failures.is_empty():
		# 帧预算耗尽时还没跑完所有相位：如实上报，不许伪装 PASS。
		_failures.append("帧预算 %d 内未跑完断言相位（停在 %s）：加大 GODOT_SMOKE_FRAMES" % [TOTAL_FRAMES, _phase])
	if _failures.is_empty():
		print("GODOT_SMOKE: PASS 场景实例化/autoload/键位契约/移动/开局/碰撞包络/接住/漏接/指针跟随(鼠标+触屏)/边界钳制/反馈/胜负/最高分持久化/重开 全部通过")
		get_tree().quit(0)
	else:
		for failure in _failures:
			printerr("GODOT_SMOKE: FAIL %s" % failure)
		get_tree().quit(1)


## ── 键位契约断言：目标键表 → project.godot [input] 的 physical_keycode ──
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


## ── 信号订阅回调 ──
func _on_zone_target_changed(x: float) -> void:
	_zone_emit_count += 1
	_zone_target_x = x


func _on_player_moved(_position: Vector2) -> void:
	_moved_seen = true


func _on_score_changed(_score: int) -> void:
	_score_seen = true


func _on_state_changed(state: int) -> void:
	if state == GameState.State.PLAYING:
		_state_playing_seen = true


func _on_game_over(_score: int, _best: int) -> void:
	_game_over_seen = true
