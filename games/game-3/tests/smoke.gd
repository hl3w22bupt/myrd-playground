extends Node
## 无头冒烟自检（headless smoke）——《疾风忍者跑》机器可判定的「游戏能不能跑且玩得动」。
##
## 运行方式（由 scripts/smoke.sh 封装）：
##   godot --headless --path <工程目录> tests/smoke.tscn
##
## 判定协议（smoke.sh 按此断言退出码与日志）：
##   通过 → stdout 打印 `GODOT_SMOKE: PASS ...`，进程退出码 0
##   失败 → stderr 打印 `GODOT_SMOKE: FAIL <原因>`（每条一行），进程退出码 1
##
## 覆盖面（玩法验收 + SKILL.md 五项基线，新增交互必有新增断言）：
##   A. 关卡几何（静态）：坑宽逐坑对「跨坑推导上限」断言（可达性）、坑宽严格递增（难度梯度）、
##      一段跳坑与二段跳坑两档都存在、尖刺都在实心平台内、飞镖都在可达带内、终点在末段平台内
##   1. 主场景可实例化（main.tscn → player.tscn / level.gd 接线未断裂）
##   2. autoload GameState 已注册且带约定信号（score_changed / game_won / game_lost）
##   3. InputMap 动作已注册、物理键绑定逐键核对（键位契约）
##   4. 玩家能移动：不注入任何输入也自动向前奔跑（跑酷核心）
##   5. 跳跃 + 二段跳（jumped 信号、跳跃计数、离地位移）
##   6. 手感容错：土狼时间（走出平台边缘后仍可地面起跳，jumps_used 停在 1）
##   7. 手感容错：跳跃缓冲（两段跳耗尽后落地前的按跳，在落地瞬间兑现为地面起跳）
##   8. 收集飞镖加分 + 收集反馈接线（飞镖弹大/淡出补间真实在播）
##   9. 负向可达：撞尖刺 → game_lost + 结算文案 + 失败震屏反馈
##  10. 重开可用：restart 动作 → 分数清零 / 状态回 PLAYING / 玩家回出生点 / 飞镖复位
##  11. 正向可达：跑进终点旗 → game_won + 结算文案 + 过关奖励 + 跨局留存（runs_finished/best_score）
##  12. 胜负已定后玩家冻结（位置不再变化，不会「赢了还在跑」）
##
## ⚠️ 输入注入全部走 InputEventAction（不与 Input.action_press 混帧，E-08）；
##    噪声相位只注入原始事件（Key/Mouse/Touch），不污染动作级断言（模板既有约定）。
## ⚠️ 阶段帧表是按 player.gd 手感常量在 60fps 物理步进下的推导排的：改跑速/跳力/重力/
##    土狼时间/缓冲帧数 → 必须复排本表（各阶段的几何推导写在使用处注释里）。

## ── 噪声相位（输入鲁棒性门禁的逐游戏语义层，模板内置，逐项保留）──
## 正式断言前注入一段确定种子的对抗输入：悬挂手势、孤儿释放、双指抢控、乱键。
const NOISE_FRAMES: int = 20

## ── 分阶段里程碑（物理帧）──
const RUN_START_FRAME: int = 21          # 记录奔跑起点
const RUN_END_FRAME: int = 41            # 断言位移，并按下跳跃（一段跳）
const JUMP2_FRAME: int = 45              # 断言一段跳，并按第二次（二段跳）
const DOUBLE_ASSERT_FRAME: int = 49      # 断言二段跳生效
const COYOTE_TELEPORT_FRAME: int = 51    # 传送到 S1 右端（坑1 唇边 20px），让他自然跑出平台
const COYOTE_PRESS_FRAME: int = 61       # 已离地 ≈2 帧（土狼窗口 6 帧内）按跳 → 应兑现为地面跳
const COYOTE_ASSERT_FRAME: int = 67      # 断言土狼跳（jumps_used == 1 且明显上升）
const TELEPORT_DART_FRAME: int = 71      # 传送到第一枚飞镖上
const COLLECT_ASSERT_FRAME: int = 78     # 断言收集 + 加分 + 收集反馈在播
const TELEPORT_SPIKE_FRAME: int = 80     # 传送到第一簇尖刺上
const LOSE_ASSERT_FRAME: int = 87        # 断言 game_lost + 失败文案 + 震屏反馈
const RESTART_FRAME: int = 89            # 注入 restart 动作
const RESTART_ASSERT_FRAME: int = 94     # 断言重开复位（含飞镖复位）
const BUFFER_TELEPORT_FRAME: int = 96    # 传送到终点台开阔段，做跳跃缓冲测试
const BUFFER_JUMP1_FRAME: int = 101      # 地面起跳（第 1 段）
const BUFFER_JUMP2_FRAME: int = 105      # 空中二段跳（第 2 段，跳数耗尽）
const BUFFER_AWAIT_FRAME: int = 107      # 进入轮询：下落且接近地面时按一次跳（只记缓冲）
const TELEPORT_GOAL_FRAME: int = 175     # 传送到终点旗前
const WIN_ASSERT_FRAME: int = 188        # 断言 game_won + 结算文案 + 跨局留存
const FREEZE_X_FRAME: int = 189          # 记录胜利后玩家 x（断言冻结停跑）
const FREEZE_ASSERT_FRAME: int = 193     # 断言 x 未变
const TOTAL_FRAMES: int = 196            # 报告兜底（smoke.sh 另有 --quit-after 240）

## ── 判定阈值 ──
const MIN_RUN_DISTANCE: float = 40.0     # 20 帧自动奔跑的理论位移 = 80px
const MIN_JUMP_RISE: float = 4.0         # 起跳后至少上升 4px（重力未拉回）
const MIN_COYOTE_RISE: float = 10.0      # 土狼跳按跳后 6 帧 ≈ 上升 44px，取 10px 宽容
const RESTART_X_TOLERANCE: float = 120.0 # 重开 5 帧内玩家仍应在出生点附近
## 跳跃缓冲轮询：下落至此高度（离地站立中心 187px 的上方 37px）即按跳 ——
## 离落地还剩 ≈4 帧，落在 JUMP_BUFFER_FRAMES(6) 窗口内且留有余量。
const BUFFER_PRESS_HEIGHT: float = 37.0
const GROUND_CENTER_Y: float = 200.0 - 13.0  # 站在地面上的玩家中心 y（碰撞盒 26 高的一半）

## InputMap 必须注册的动作。
const REQUIRED_ACTIONS: Array[StringName] = [
	&"move_left", &"move_right", &"move_up", &"move_down", &"confirm", &"jump", &"restart",
]

## 键位契约：动作 → 键表承诺的物理键，**必须全部绑定**（AND 语义，见模板 E-12 说明）。
const KEY_CONTRACT: Dictionary = {
	&"jump": [KEY_SPACE, KEY_W, KEY_UP],
	&"confirm": [KEY_ENTER, KEY_SPACE],
	&"restart": [KEY_R, KEY_ENTER],
	&"move_left": [KEY_A, KEY_LEFT],
	&"move_right": [KEY_D, KEY_RIGHT],
	&"move_up": [KEY_W, KEY_UP],
	&"move_down": [KEY_S, KEY_DOWN],
}

var _failures: PackedStringArray = []
var _frames: int = 0
var _finished: bool = false

var _main: Node2D
var _player: Player
var _level: GameLevel
var _state_label: Label

## 信号到达标记（「信号真的到达订阅方」断言层）。
var _moved_seen: bool = false
var _jumped_seen: bool = false
var _score_seen: bool = false
var _dart_seen: bool = false
var _lost_seen: bool = false
var _won_seen: bool = false
var _goal_seen: bool = false

## 阶段间采样。
var _run_origin_x: float = 0.0
var _pre_jump_y: float = 0.0
var _pre_jump_count: int = 0
var _coyote_press_y: float = 0.0
var _coyote_checked: bool = false
var _freeze_x: float = 0.0

## 跳跃缓冲轮询状态。
var _buffer_await: bool = false
var _buffer_pressed_frame: int = -1
var _buffer_checked: bool = false

## 最近一次被收集的飞镖（收集反馈断言用）。
var _last_dart: Dart

## 噪声相位：确定种子随机事件（同种子同事件序，门禁可复现）。
var _noise_rng := RandomNumberGenerator.new()


func _ready() -> void:
	# headless 没有垂直同步：限 60 FPS 让 process : physics ≈ 1:1，--quit-after 兜底才有意义。
	Engine.max_fps = 60

	for action in REQUIRED_ACTIONS:
		if not InputMap.has_action(action):
			_failures.append("InputMap 缺少动作 %s（project.godot [input] 未注册）" % action)
	_check_key_bindings()

	var game_state := get_tree().root.get_node_or_null("GameState")
	if game_state == null:
		_failures.append("autoload GameState 未注册（project.godot [autoload] 缺失）")
	else:
		for signal_name in ["score_changed", "game_won", "game_lost", "state_changed"]:
			if not game_state.has_signal(signal_name):
				_failures.append("autoload GameState 缺少信号 %s" % signal_name)
		game_state.score_changed.connect(_on_score_changed)
		game_state.game_won.connect(_on_game_won)
		game_state.game_lost.connect(_on_game_lost)

	_main = get_node_or_null("Main") as Node2D
	if _main == null:
		_failures.append("冒烟场景里找不到 Main 实例（tests/smoke.tscn 未实例化 scenes/main.tscn）")
		_finish_early()
		return
	_player = _main.get_node_or_null("Player") as Player
	if _player == null:
		_failures.append("Main 场景树找不到 Player（main.tscn 未实例化 player.tscn，或脚本未挂 Player）")
	else:
		_player.moved.connect(_on_player_moved)
		_player.jumped.connect(_on_player_jumped)
	_level = _main.get_node_or_null("Level") as GameLevel
	if _level == null:
		_failures.append("Main 场景树找不到 Level（main.tscn 未挂 scripts/level.gd 的 Level 节点）")
	else:
		_level.dart_collected.connect(_on_dart_collected)
		_level.goal_reached.connect(_on_goal_reached)
		_check_level_geometry()
	_state_label = _main.find_child("StateLabel", true, false) as Label
	if _state_label == null:
		_failures.append("Main 场景树找不到 StateLabel（结算文案没有落点）")

	# 噪声种子固定：门禁可复现。
	_noise_rng.seed = 20260926


func _physics_process(_delta: float) -> void:
	if _finished:
		return
	_frames += 1

	if _frames <= NOISE_FRAMES:
		_inject_noise_frame()
	elif _frames == RUN_START_FRAME:
		_run_origin_x = _player.global_position.x
	elif _frames == RUN_END_FRAME:
		_assert_auto_run()
		_pre_jump_y = _player.global_position.y
		_pre_jump_count = _player.jumps_used
		_press_action(&"jump")
	elif _frames == JUMP2_FRAME:
		_assert_first_jump()
		_press_action(&"jump")
	elif _frames == DOUBLE_ASSERT_FRAME:
		_assert_double_jump()
	elif _frames == COYOTE_TELEPORT_FRAME and _player != null:
		# 传送到坑1 左唇边 20px：以 4px/帧 前进，约第 59 物理帧走出平台边缘，
		# 第 61 帧按跳落在土狼窗口（离地 ≤6 帧）内。
		_teleport_player(Vector2(_level.GROUND_SEGMENTS[0].y - 20.0, GROUND_CENTER_Y))
	elif _frames == COYOTE_PRESS_FRAME:
		_coyote_press_y = _player.global_position.y
		_press_action(&"jump")
	elif _frames == COYOTE_ASSERT_FRAME:
		_assert_coyote_jump()
	elif _frames == TELEPORT_DART_FRAME and _level != null:
		_teleport_player(_level.DART_SPOTS[0])
	elif _frames == COLLECT_ASSERT_FRAME:
		_assert_dart_collected()
	elif _frames == TELEPORT_SPIKE_FRAME and _level != null:
		_teleport_player(Vector2(_level.SPIKE_XS[0], _level.GROUND_TOP_Y - 13.0))
	elif _frames == LOSE_ASSERT_FRAME:
		_assert_lost()
	elif _frames == RESTART_FRAME:
		_press_action(&"restart")
	elif _frames == RESTART_ASSERT_FRAME:
		_assert_restarted()
	elif _frames == BUFFER_TELEPORT_FRAME and _player != null:
		# 终点台开阔段（4330–5060）：做「跳数耗尽 → 落地前按跳 → 落地兑现」的缓冲测试。
		_teleport_player(Vector2(4480.0, GROUND_CENTER_Y))
	elif _frames == BUFFER_JUMP1_FRAME:
		_press_action(&"jump")
	elif _frames == BUFFER_JUMP2_FRAME:
		_press_action(&"jump")
		_buffer_await = true  # 两段跳已耗尽：进入「落地前按跳」轮询（独立分支，不挡后续阶段）
	elif _frames == TELEPORT_GOAL_FRAME and _level != null:
		_teleport_player(Vector2(_level.GOAL_X - 20.0, 150.0))
	elif _frames == WIN_ASSERT_FRAME:
		_assert_won()
	elif _frames == FREEZE_X_FRAME:
		_freeze_x = _player.global_position.x
	elif _frames == FREEZE_ASSERT_FRAME:
		_assert_frozen()

	# 跳跃缓冲轮询：独立于阶段 elif 链（否则会挡住 GOAL/WIN 阶段）。
	if _buffer_await and _buffer_pressed_frame < 0:
		_poll_buffer_press()
	# 跳跃缓冲断言：按跳（只记缓冲）10 帧后应已落地兑现为地面起跳。
	if _buffer_pressed_frame > 0 and not _buffer_checked \
			and _frames >= _buffer_pressed_frame + 10:
		_assert_buffered_jump()

	if _frames >= TOTAL_FRAMES or not _failures.is_empty():
		_report()


## ── 断言 ──

## A. 关卡几何：难度梯度与跳跃可达性（对 player.gd 推导上限逐条断言）。
func _check_level_geometry() -> void:
	var segments := _level.GROUND_SEGMENTS
	var gaps: Array[float] = []
	for i in range(1, segments.size()):
		gaps.append(segments[i].x - segments[i - 1].y)
	for i in gaps.size():
		var gap := gaps[i]
		if gap <= 0.0:
			_failures.append("几何：平台段 %d 与前一段重叠（坑宽 %.0f ≤ 0）" % [i + 1, gap])
		if gap > Player.DOUBLE_JUMP_GAP_MAX - 80.0:
			_failures.append("可达性：坑%d 宽 %.0f 超出二段跳上限 %.0f（含 80px 余量），必然跳不过去" % [
				i + 1, gap, Player.DOUBLE_JUMP_GAP_MAX - 80.0])
		if i > 0 and gap <= gaps[i - 1]:
			_failures.append("难度梯度：坑%d 宽 %.0f 未比前一坑 %.0f 更宽（坑宽应严格递增）" % [
				i + 1, gap, gaps[i - 1]])
	if not gaps.is_empty():
		var min_gap: float = gaps.min()
		var max_gap: float = gaps.max()
		if min_gap > Player.SINGLE_JUMP_GAP_MAX - 30.0:
			_failures.append("难度梯度：最窄坑 %.0f 仍超过一段跳上限 %.0f（开局应有一段跳可过的坑）" % [
				min_gap, Player.SINGLE_JUMP_GAP_MAX - 30.0])
		if max_gap <= Player.SINGLE_JUMP_GAP_MAX:
			_failures.append("难度梯度：最宽坑 %.0f 未超过一段跳上限 %.0f（缺少必须二段跳的坑，梯度断档）" % [
				max_gap, Player.SINGLE_JUMP_GAP_MAX])
	for x in _level.SPIKE_XS:
		var on_solid := false
		for seg in segments:
			if x >= seg.x + _level.SPIKE_WIDTH * 0.5 + Player.PLAYER_HALF_WIDTH \
					and x <= seg.y - _level.SPIKE_WIDTH * 0.5 - Player.PLAYER_HALF_WIDTH:
				on_solid = true
		if not on_solid:
			_failures.append("几何：尖刺 x=%.0f 不在任何实心平台内（或距平台边缘不足一个身位）" % x)
	if _level.DART_SPOTS.size() < 12:
		_failures.append("收集面：飞镖仅 %d 枚（< 12），收集玩法密度不足" % _level.DART_SPOTS.size())
	for spot in _level.DART_SPOTS:
		if spot.x < segments[0].x or spot.x > _level.TRACK_END_X:
			_failures.append("几何：飞镖 (%.0f, %.0f) 在赛道范围外" % [spot.x, spot.y])
		if spot.y < _level.GROUND_TOP_Y - 190.0 or spot.y > _level.GROUND_TOP_Y - 27.0:
			_failures.append("可达性：飞镖 (%.0f, %.0f) 不在可达带 [%.0f, %.0f] 内（埋地或跳不着）" % [
				spot.x, spot.y, _level.GROUND_TOP_Y - 190.0, _level.GROUND_TOP_Y - 27.0])
	var last_seg := segments[segments.size() - 1]
	if _level.GOAL_X <= last_seg.x or _level.GOAL_X >= last_seg.y:
		_failures.append("几何：终点 x=%.0f 不在末段平台 [%.0f, %.0f] 内" % [
			_level.GOAL_X, last_seg.x, last_seg.y])


func _assert_auto_run() -> void:
	if _player == null:
		return
	var travelled: float = _player.global_position.x - _run_origin_x
	if travelled < MIN_RUN_DISTANCE:
		_failures.append(
			"玩家 %d 帧内自动奔跑位移 %.2fpx < %.2fpx：_physics_process 未驱动 velocity.x" % [
				RUN_END_FRAME - RUN_START_FRAME, travelled, MIN_RUN_DISTANCE])
	if not _moved_seen:
		_failures.append("信号 Player.moved 未到达订阅方：连接断裂或从未 emit")


func _assert_first_jump() -> void:
	if _player == null:
		return
	var rise: float = _pre_jump_y - _player.global_position.y
	if _player.jumps_used < _pre_jump_count + 1:
		_failures.append("按下 jump 后跳跃计数未增加（%d → %d）：跳跃输入未生效" % [
			_pre_jump_count, _player.jumps_used])
	if rise < MIN_JUMP_RISE:
		_failures.append("按下 jump 后 %.2f 帧内上升 %.2fpx < %.2fpx：跳跃没有让玩家离地" % [
			JUMP2_FRAME - RUN_END_FRAME, rise, MIN_JUMP_RISE])
	if not _jumped_seen:
		_failures.append("信号 Player.jumped 未到达订阅方：连接断裂或 try_jump 未 emit")


func _assert_double_jump() -> void:
	if _player == null:
		return
	if _player.jumps_used < _pre_jump_count + 2:
		_failures.append("空中再按 jump 后跳跃计数 %d，未达到二段跳（应 ≥ %d）：MAX_JUMPS 或输入路径断裂" % [
			_player.jumps_used, _pre_jump_count + 2])


## 6. 土狼时间：走出平台边缘 ≈2 帧后按跳，应兑现为「地面起跳」（jumps_used 停在 1）。
func _assert_coyote_jump() -> void:
	if _player == null:
		return
	_coyote_checked = true
	var rise: float = _coyote_press_y - _player.global_position.y
	if _player.jumps_used != 1:
		_failures.append("土狼跳失效：离地 %.0f 帧内按跳后跳跃计数 %d（期望 1 = 地面起跳；0/2 说明土狼窗口没生效或被当成空中跳）" % [
			COYOTE_PRESS_FRAME - COYOTE_TELEPORT_FRAME, _player.jumps_used])
	if rise < MIN_COYOTE_RISE:
		_failures.append("土狼跳没有让玩家上升：按跳后 %d 帧上升 %.2fpx < %.2fpx" % [
			COYOTE_ASSERT_FRAME - COYOTE_PRESS_FRAME, rise, MIN_COYOTE_RISE])
	if not _jumped_seen:
		_failures.append("信号 Player.jumped 未到达订阅方：土狼跳路径未 emit jumped")


func _assert_dart_collected() -> void:
	if GameState.score < 1:
		_failures.append("玩家压在飞镖上 %d 帧仍未加分（score=%d）：飞镖 Area2D 未检测到玩家或 dart_collected 接线断裂" % [
			COLLECT_ASSERT_FRAME - TELEPORT_DART_FRAME, GameState.score])
	if not _dart_seen:
		_failures.append("信号 Level.dart_collected 未到达订阅方：连接断裂或从未 emit")
	if not _score_seen:
		_failures.append("信号 GameState.score_changed 未到达订阅方：Main 未订阅或 add_score 未 emit")
	# 收集反馈：飞镖应正在播「弹大/淡出」补间（结果性事件必须有可感知反馈）。
	if _last_dart != null and _last_dart.modulate.a > 0.999 and _last_dart.scale.x < 1.001:
		_failures.append("收集反馈未接线：飞镖被收集后既没弹大也没淡出（Dart.collect 未启动表现补间）")


func _assert_lost() -> void:
	if GameState.state != GameState.State.LOST:
		_failures.append("撞上尖刺后状态未变为 LOST（当前 %d）：hazard_hit → register_loss 链路断裂" % GameState.state)
	if not _lost_seen:
		_failures.append("信号 GameState.game_lost 未到达订阅方：Main 未订阅 game_lost")
	if _state_label != null and (not _state_label.visible or not _state_label.text.contains("失败")):
		_failures.append("失败后结算文案未显示「失败」：StateLabel 未被 _on_game_lost 刷新")
	if _main != null and not _main.is_shaking():
		_failures.append("失败反馈未接线：撞刺后相机未震屏（Main._on_game_lost 未触发 shake）")


func _assert_restarted() -> void:
	if GameState.state != GameState.State.PLAYING:
		_failures.append("重开后状态未回到 PLAYING（当前 %d）：restart_run 未调 GameState.reset" % GameState.state)
	if GameState.score != 0:
		_failures.append("重开后分数未清零（当前 %d）：GameState.reset 未生效" % GameState.score)
	if _player != null and absf(_player.global_position.x - Player.START_POSITION.x) > RESTART_X_TOLERANCE:
		_failures.append("重开后玩家未回到出生点（x=%.1f，期望 %.1f±%.0f）：player.respawn 未生效" % [
			_player.global_position.x, Player.START_POSITION.x, RESTART_X_TOLERANCE])
	if _state_label != null and _state_label.visible:
		_failures.append("重开后结算文案仍显示：restart_run 未隐藏 StateLabel")
	# 飞镖复位：已收集并被反馈补间隐藏的飞镖要回到场上。
	if _level != null and not _level.darts.is_empty():
		var d0: Dart = _level.darts[0]
		if d0 == null or not d0.visible or d0.collected \
				or not is_equal_approx(d0.modulate.a, 1.0):
			_failures.append("重开后飞镖未复位（visible=%s collected=%s alpha=%.2f）：Level.reset/Dart.respawn 未生效" % [
				str(d0 != null and d0.visible), str(d0 != null and d0.collected),
				d0.modulate.a if d0 != null else -1.0])


## 7. 跳跃缓冲：跳数耗尽后、落地前 ≈4 帧的那次按跳，应在落地瞬间兑现为地面起跳。
func _assert_buffered_jump() -> void:
	_buffer_checked = true
	if _player == null:
		return
	if _player.jumps_used != 1:
		_failures.append("跳跃缓冲失效：落地前的按跳未被兑现（当前跳跃计数 %d，期望落地自动起跳后为 1）" % [
			_player.jumps_used])
	elif _player.is_on_floor() or _player.global_position.y > GROUND_CENTER_Y - 8.0:
		_failures.append("跳跃缓冲兑现后玩家未离地（y=%.1f，地面中心 y=%.1f）：缓冲起跳没有产生位移" % [
			_player.global_position.y, GROUND_CENTER_Y])


func _assert_won() -> void:
	if GameState.state != GameState.State.WON:
		_failures.append("跑进终点旗后状态未变为 WON（当前 %d）：goal_reached → register_win 链路断裂" % GameState.state)
	if not _goal_seen:
		_failures.append("信号 Level.goal_reached 未到达订阅方：连接断裂或从未 emit")
	if not _won_seen:
		_failures.append("信号 GameState.game_won 未到达订阅方：Main 未订阅 game_won")
	if _state_label != null and (not _state_label.visible or not _state_label.text.contains("胜利")):
		_failures.append("过关后结算文案未显示「胜利」：StateLabel 未被 _on_game_won 刷新")
	if GameState.score < GameState.WIN_BONUS:
		_failures.append("过关奖励未到账（score=%d < WIN_BONUS=%d）：register_win 未加分" % [
			GameState.score, GameState.WIN_BONUS])
	if GameState.runs_finished < 1:
		_failures.append("跨局留存失效：过关后 runs_finished=%d（应 ≥ 1）" % GameState.runs_finished)
	if GameState.best_score < GameState.score:
		_failures.append("跨局留存失效：best_score=%d < 本局 %d（最高分没有记录）" % [
			GameState.best_score, GameState.score])
	if _main != null and _main.is_shaking():
		_failures.append("反馈未收敛：过关 %d 帧后仍在震屏（SHAKE_FRAMES_WIN 未衰减归位）" % [
			WIN_ASSERT_FRAME - TELEPORT_GOAL_FRAME])


## 12. 胜负已定后玩家冻结：4 帧内 x 不变（不会「赢了还在跑/输了还在滑」）。
func _assert_frozen() -> void:
	if _player == null:
		return
	if absf(_player.global_position.x - _freeze_x) > 0.5:
		_failures.append("胜负已定后玩家仍在移动（%.1f → %.1f）：freeze 未停住 velocity.x" % [
			_freeze_x, _player.global_position.x])


func _report() -> void:
	_finished = true
	if _failures.is_empty() and _coyote_checked and _buffer_checked:
		print("GODOT_SMOKE: PASS 关卡几何/场景实例化/autoload/键位契约/自动奔跑/跳跃二段跳/土狼跳/跳跃缓冲/收集飞镖+反馈/撞刺失败+震屏/重开复位/跑底过关+留存/冻结停跑 全部通过")
		get_tree().quit(0)
	else:
		if not _coyote_checked and _failures.is_empty():
			_failures.append("土狼跳断言未执行到（阶段帧表被前置失败打断）")
		if not _buffer_checked and _failures.is_empty():
			_failures.append("跳跃缓冲断言未执行到（阶段帧表被前置失败打断）")
		for failure in _failures:
			printerr("GODOT_SMOKE: FAIL %s" % failure)
		get_tree().quit(1)


## 冒烟里 main 尚未就绪时也要给出结论（不能既无 PASS 也无 FAIL）。
func _finish_early() -> void:
	_finished = true
	_report()


## ── 输入注入 ──

## 冒烟专用传送：清掉残余升降速度再落位 —— 否则跳跃弧线途中被传送的玩家会带着
## ±几百 px/s 的竖直速度继续飞（本机实测：土狼跳阶段因此始终未落地、计数停在 2）。
func _teleport_player(pos: Vector2) -> void:
	_player.global_position = pos
	_player.velocity = Vector2.ZERO


## 注入真实 InputEventAction → _unhandled_input 收得到（Input.action_press 触发不了它）。
func _press_action(action: StringName) -> void:
	var event := InputEventAction.new()
	event.action = action
	event.pressed = true
	Input.parse_input_event(event)


## 键位契约断言：键表承诺的每个物理键都必须已绑定到该动作（AND 语义）。
func _check_key_bindings() -> void:
	for action: StringName in KEY_CONTRACT:
		if not InputMap.has_action(action):
			continue  # 动作缺失已由 REQUIRED_ACTIONS 上报，这里不重复计失败
		var expected: Array = KEY_CONTRACT[action]
		var bound: Array[Key] = []
		for event in InputMap.action_get_events(action):
			var key := event as InputEventKey
			if key != null and key.physical_keycode != KEY_NONE:
				bound.append(key.physical_keycode)
		if not _contains_all(expected, bound):
			_failures.append("键位契约：动作 %s 未绑全键表承诺的物理键（期望全部 %s，实际 %s）—— 缺的那个键真机按了没反应" % [
				action, _key_labels(expected), _key_labels(bound)])


func _contains_all(expected: Array, bound: Array[Key]) -> bool:
	for key in expected:
		if not (key in bound):
			return false
	return true


## 键码 → 可读键名（附数值，未映射键名会打印成私有区字形）。
func _key_labels(keys: Array) -> String:
	var labels: PackedStringArray = []
	for code in keys:
		labels.append("%s(%d)" % [OS.get_keycode_string(code as Key), code])
	return "[%s]" % ", ".join(labels)


## 噪声相位：确定种子对抗输入（只注入原始事件，不注入 InputEventAction）。
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
		k.physical_keycode = [KEY_A, KEY_D, KEY_W, KEY_S, KEY_SPACE, KEY_ENTER, KEY_R][_noise_rng.randi_range(0, 6)]
		k.pressed = _noise_rng.randf() < 0.5
		Input.parse_input_event(k)


## 跳跃缓冲轮询：跳数耗尽、下落且降到贴近地面（BUFFER_PRESS_HEIGHT）时按一次跳。
## 这次按跳没有任何可用地跳 → 只会记入缓冲；落地瞬间由 Player 消费兑现。
func _poll_buffer_press() -> void:
	if _player == null or _buffer_pressed_frame > 0:
		return
	if not _player.is_on_floor() and _player.jumps_used >= Player.MAX_JUMPS \
			and _player.velocity.y > 0.0 \
			and _player.global_position.y >= GROUND_CENTER_Y - BUFFER_PRESS_HEIGHT:
		_press_action(&"jump")
		_buffer_pressed_frame = _frames


## ── 信号到达标记 ──

func _on_player_moved(_position: Vector2) -> void:
	_moved_seen = true


func _on_player_jumped(_jump_count: int) -> void:
	_jumped_seen = true


func _on_score_changed(_score: int) -> void:
	_score_seen = true


func _on_dart_collected(dart: Dart) -> void:
	_dart_seen = true
	_last_dart = dart


func _on_goal_reached() -> void:
	_goal_seen = true


func _on_game_won(_final_score: int) -> void:
	_won_seen = true


func _on_game_lost(_final_score: int) -> void:
	_lost_seen = true
