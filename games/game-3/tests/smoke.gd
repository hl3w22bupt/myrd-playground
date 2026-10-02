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
##   A2. 跨坑物理实证：用真实引擎物理 + 真实 Player 脚本，在赛道外搭建「两平台夹一坑」的
##       实证 rig，分别实测「最宽的一段跳坑」「最宽的坑（二段跳）」能否真的落到对岸 ——
##       静态几何断言用的是与关卡同源的推导公式（公式错 = 自证通过），这条断言把它升级成
##       端到端物理证明：跳跃参数与坑宽一旦失配，这里必然拦下
##   A3. 碰撞盒契约：player.tscn 实际碰撞盒宽 = PLAYER_HALF_WIDTH × 2（跨坑余量的
##       「压边宽容 11px」承诺建立在这个半宽上，碰撞盒改动必须连带复算关卡与断言）
##   A4. 调参协议（§3C）：TUNING_META 结构合法、手感键齐全；apply_tuning 把声明键映射进
##       运行期值、未知键忽略、空表回默认 —— 调参通道静默断裂（键名改动）在这里被拦下
##   A5. 调参「重开即生效」（§3C 承诺）：重开一局时 GameState.reset() 重读的调参必须被
##       应用回玩家运行期值（拖动 → R 重开一局即生效），否则调参只在整页刷新时生效
##   1. 主场景可实例化（main.tscn → player.tscn / level.gd 接线未断裂）
##   2. autoload GameState 已注册且带约定信号（score_changed / game_won / game_lost）
##   3. InputMap 动作已注册、物理键绑定逐键核对（键位契约）
##   3B. 手感契约：土狼/缓冲窗口默认 = spec v2 拍板值 12 帧（回退 6 帧 = 吞按缺陷回归）
##   4. 玩家能移动：不注入任何输入也自动向前奔跑（跑酷核心）
##   5. 跳跃 + 二段跳（jumped 信号、跳跃计数、离地位移）
##   6. 手感容错：土狼时间（走出平台边缘后仍可地面起跳，jumps_used 停在 1）
##   7. 手感容错：跳跃缓冲（两段跳耗尽后落地前的按跳，在落地瞬间兑现为地面起跳）
##   8. 收集飞镖加分 + 收集反馈接线（飞镖弹大/淡出补间真实在播）
##   9. 负向可达：撞尖刺 → game_lost + 结算文案 + 失败震屏反馈
##  10. 重开可用：restart 动作 → 分数清零 / 状态回 PLAYING / 玩家回出生点 / 飞镖复位
##  11. 正向可达：跑进终点旗 → game_won + 结算文案 + 过关奖励 + 跨局留存（runs_finished/best_score）
##  12. 胜负已定后玩家冻结（位置不再变化，不会「赢了还在跑」）
##  13. 反馈总线（§3B / playtest 协议）：autoload Juice 已注册且带 feedback_fired 信号与
##      clear_events；收集与失败两条结果事件后 Juice.events 非空（反馈接线断了 = FAIL）
##  14. 重开防误触：奔跑中（PLAYING）按 restart 不重置（进度不丢），结算后（LOST，见第 10 项）才受理
##  15. 音效资产协议：Juice.SFX_BANK 非空，调用点钉住的名全部注册且为已加载 AudioStream
##      （注册表被清空 = 真机收集/撞刺/失败/过关全程无声）
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
const RESTART_GUARD_FRAME: int = 43      # 奔跑中按 restart（应被忽略：进度不重置）
const RESTART_GUARD_ASSERT_FRAME: int = 46  # 断言玩家仍在前进（未被拽回出生点）
const JUMP2_FRAME: int = 45              # 断言一段跳，并按第二次（二段跳）
const DOUBLE_ASSERT_FRAME: int = 49      # 断言二段跳生效
const COYOTE_TELEPORT_FRAME: int = 51    # 传送到 S1 右端（坑1 唇边 20px），让他自然跑出平台
const COYOTE_PRESS_FRAME: int = 61       # 已离地 ≈2 帧（土狼窗口 12 帧内）按跳 → 应兑现为地面跳
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

## ── A2 跨坑物理实证（与主时间线并行的独立 rig，不占阶段帧）──
## 实证 rig 摆在赛道外远处（x=30000+）：同一物理空间、同一 Player 脚本、同一碰撞盒，
## 但几何独立 —— 主场景的传送/输入注入不会碰到它。两个 rig 与主时间线同时跑，
## 二段跳档滞空 ≈1.47s（≈88 帧）在 TOTAL_FRAMES(196) 内收尾，帧预算零增加。
const PROOF_BASE_X: float = 30000.0      # 实证区起点（赛道终点 5060 之外的空白物理区）
const PROOF_START_FRAME: int = 24        # 建 rig，随后让 rig 玩家在平台上稳定
const PROOF_SETTLE_FRAMES: int = 3       # 建场到第一跳的稳定帧（重力把玩家压到平台上）
const PROOF_JUMP_FRAME: int = PROOF_START_FRAME + PROOF_SETTLE_FRAMES  # 两档 rig 同时第一跳
const PROOF_ASSERT_FRAME: int = 150      # 断言两档 rig 都已落到对岸（二段跳滞空 ≈88 帧后早已落地）
## 二段跳延迟（物理帧）：第一跳后 ≈0.70s 按第二跳 = 实测最优（回落到起跳高度的瞬间）。
## ⚠️ 这是实测值不是拍脑袋：最高点按（≈22 帧）跨距只剩 ≈300px；回落过起跳点后再等
##    ≈16 帧（旧文档写的 0.26s）跨距跌回单跳 ≈176px，280px 的坑5 必撞对岸墙。
const PROOF_SECOND_JUMP_DELAY: int = 42
const PROOF_PLATFORM_WIDTH: float = 600.0   # 实证平台的长度（足够跑完落点确认）
const PROOF_FELL_Y: float = 400.0           # 越过它 = 掉进实证坑里（跨坑失败）
const PROOF_MIN_LAND_OVERLAP: float = 2.0   # 落点至少压上对岸 2px（贴唇悬停不算数）
## 实证平台高度：与真实赛道地面同厚（视觉无关，无头运行只算碰撞）。
const PROOF_GROUND_HEIGHT: float = 90.0

## ── 判定阈值 ──
const MIN_RUN_DISTANCE: float = 40.0     # 20 帧自动奔跑的理论位移 = 80px
const MIN_JUMP_RISE: float = 4.0         # 起跳后至少上升 4px（重力未拉回）
const MIN_COYOTE_RISE: float = 10.0      # 土狼跳按跳后 6 帧 ≈ 上升 44px，取 10px 宽容
const RESTART_X_TOLERANCE: float = 120.0 # 重开 5 帧内玩家仍应在出生点附近
## 跳跃缓冲轮询：下落至此高度（离地站立中心 187px 的上方 37px）即按跳 ——
## 离落地还剩 ≈4 帧，落在 JUMP_BUFFER_FRAMES(12) 窗口内且留有余量。
const BUFFER_PRESS_HEIGHT: float = 37.0
const GROUND_CENTER_Y: float = 200.0 - 13.0  # 站在地面上的玩家中心 y（碰撞盒 26 高的一半）

## InputMap 必须注册的动作。
const REQUIRED_ACTIONS: Array[StringName] = [
	&"move_left", &"move_right", &"move_up", &"move_down", &"confirm", &"jump", &"restart",
]

## 音效协议：调用点已钉住的注册名（scripts/main.gd 的 Juice.sfx(...) 调用点；
## 新增调用点必须同步这里与 Juice.SFX_BANK 各一行）。
const PINNED_SFX: Array[StringName] = [&"score", &"confirm", &"hit", &"fail", &"jump"]

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
## Juice 反馈单例（§3B / playtest 协议面：feedback_fired 信号 + events 记录 + clear_events）。
var _juice: Node

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
## 重开防误触断言采样（PLAYING 中按 restart 前的玩家 x）。
var _guard_x: float = 0.0

## 跳跃缓冲轮询状态。
var _buffer_await: bool = false
var _buffer_pressed_frame: int = -1
var _buffer_checked: bool = false

## 最近一次被收集的飞镖（收集反馈断言用）。
var _last_dart: Dart

## 噪声相位：确定种子随机事件（同种子同事件序，门禁可复现）。
var _noise_rng := RandomNumberGenerator.new()

## 跨坑实证 rig（A2）：左平台 + 待实证宽度的坑 + 右平台 + 一名真实 Player。
class ProofRig:
	## 被实证的玩家（实例化自 player.tscn，摘掉相机；输入处理关闭，只由本测试驱动）。
	var player: Player
	## 被实证的坑宽（来自关卡数据表，自动跟随关卡改动）。
	var gap: float
	## 对岸（右平台）左唇 x：落点必须 ≥ b_left - 半宽 + PROOF_MIN_LAND_OVERLAP。
	var b_left: float
	## 实测跨距的起点：出生时 = 左唇 - 半宽；第一跳瞬间重记录为当时的实际中心 x
	## （rig 玩家自动奔跑，稳定期会向唇沿推进几像素 —— 用实际值口径跨距才不失真）。
	var start_x: float
	## true = 二段跳档（在 PROOF_SECOND_JUMP_DELAY 帧后补第二跳）。
	var double_jump: bool
	## 失败原因里的人类可读档位名（「一段跳档」「二段跳档」）。
	var label: String
	## 计划中的第二跳帧（-1 = 单跳档）。
	var second_jump_frame: int = -1
	## 落地帧记录的玩家 x（<0 = 尚未落地）。
	var landed_x: float = -1.0

## 场上两座实证 rig（一段跳档 / 二段跳档），PROOF_START_FRAME 建场。
var _proof_rigs: Array[ProofRig] = []
## 跨坑实证断言已执行到（PASS 门槛之一，防止阶段被前置失败打断后静默漏判）。
var _proof_checked: bool = false


func _ready() -> void:
	# headless 没有垂直同步：限 60 FPS 让 process : physics ≈ 1:1，--quit-after 兜底才有意义。
	Engine.max_fps = 60

	for action in REQUIRED_ACTIONS:
		if not InputMap.has_action(action):
			_failures.append("InputMap 缺少动作 %s（project.godot [input] 未注册）" % action)
	_check_key_bindings()
	_check_feel_contract()
	_check_collider_contract()
	_check_tuning_protocol()

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

	# 13. 反馈总线协议面（playtest 门禁依赖它采样反馈事件流，缺了即 fail-closed）。
	_juice = get_tree().root.get_node_or_null("Juice")
	if _juice == null:
		_failures.append("autoload Juice 未注册（§3B 反馈协议 / playtest 门禁模板协议缺失）")
	else:
		if not _juice.has_signal("feedback_fired"):
			_failures.append("autoload Juice 缺少信号 feedback_fired（机器人试玩的反馈采样锚点）")
		if not _juice.has_method("clear_events"):
			_failures.append("autoload Juice 缺少 clear_events（试玩每局清窗 / 冒烟按时间窗断言依赖）")
		_check_sfx_bank()

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
	elif _frames == PROOF_START_FRAME:
		_build_proof_rigs()
	elif _frames == RUN_START_FRAME:
		_run_origin_x = _player.global_position.x
	elif _frames == RUN_END_FRAME:
		_assert_auto_run()
		_pre_jump_y = _player.global_position.y
		_pre_jump_count = _player.jumps_used
		_press_action(&"jump")
	elif _frames == RESTART_GUARD_FRAME:
		# 14. 重开防误触：奔跑中按 restart 必须被忽略（此时玩家在 S1 平台 ≈220px 处）。
		_guard_x = _player.global_position.x
		# A5 调参「重开即生效」前置：把运行期手感值漂移出常量默认（模拟「上一局带着调参跑」）。
		# 无头环境拿不到浏览器面板，reset() 重读恒为 {} —— 所以这里验证的是**接线本身**：
		# 重开受理时 restart_run 必须把 GameState 当前的生效调参重新应用到玩家（A4 已证
		# apply_tuning 的键值映射正确，两者合起来即「拖动 → R 重开一局即生效」的完整链路）。
		# 漂移值 300px/s 会让 43–89 帧的自动奔跑更快（5px/帧），阶段帧表各断言的几何余量仍成立。
		_player.apply_tuning({"run_speed": 300.0})
		_press_action(&"restart")
	elif _frames == JUMP2_FRAME:
		_assert_first_jump()
		_press_action(&"jump")
	elif _frames == RESTART_GUARD_ASSERT_FRAME:
		_assert_restart_guarded()
	elif _frames == DOUBLE_ASSERT_FRAME:
		_assert_double_jump()
	elif _frames == COYOTE_TELEPORT_FRAME and _player != null:
		# 传送到坑1 左唇边 20px：以 4px/帧 前进，约第 59 物理帧走出平台边缘，
		# 第 61 帧按跳落在土狼窗口（离地 ≤12 帧）内。
		_teleport_player(Vector2(_level.GROUND_SEGMENTS[0].y - 20.0, GROUND_CENTER_Y))
	elif _frames == COYOTE_PRESS_FRAME:
		_coyote_press_y = _player.global_position.y
		_press_action(&"jump")
	elif _frames == COYOTE_ASSERT_FRAME:
		_assert_coyote_jump()
	elif _frames == TELEPORT_DART_FRAME and _level != null:
		_teleport_player(_level.DART_SPOTS[0])
		_clear_juice_events()  # 反馈窗口起点：此后到收集断言之间的 Juice 事件必须非空
	elif _frames == COLLECT_ASSERT_FRAME:
		_assert_dart_collected()
	elif _frames == TELEPORT_SPIKE_FRAME and _level != null:
		_teleport_player(Vector2(_level.SPIKE_XS[0], _level.GROUND_TOP_Y - 13.0))
		_clear_juice_events()  # 反馈窗口起点：此后到失败断言之间的 Juice 事件必须非空
	elif _frames == LOSE_ASSERT_FRAME:
		_assert_lost()
	elif _frames == RESTART_FRAME:
		_press_action(&"restart")
	elif _frames == RESTART_ASSERT_FRAME:
		_assert_restarted()
		_assert_tuning_reapplied_on_restart()
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
	elif _frames == PROOF_JUMP_FRAME:
		_press_proof_jumps()
	elif _frames == PROOF_ASSERT_FRAME:
		_assert_proof_rigs()

	# 跳跃缓冲轮询：独立于阶段 elif 链（否则会挡住 GOAL/WIN 阶段）。
	if _buffer_await and _buffer_pressed_frame < 0:
		_poll_buffer_press()
	# 跳跃缓冲断言：按跳（只记缓冲）10 帧后应已落地兑现为地面起跳。
	if _buffer_pressed_frame > 0 and not _buffer_checked \
			and _frames >= _buffer_pressed_frame + 10:
		_assert_buffered_jump()
	# 跨坑实证 rig 驱动：独立轮询（与主时间线并行，不占阶段帧）。
	_step_proof_rigs()

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


## A3 碰撞盒契约：player.tscn 实际碰撞盒必须 = 22×26。
## 跨坑余量的「压边宽容 11px」建立在 PLAYER_HALF_WIDTH(=盒宽一半) 上，GROUND_CENTER_Y(=200-13)
## 建立在盒高一半上 —— 碰撞盒一旦被改，关卡坑宽与跨坑断言必须连带复算，这里钉死不让它静默漂移。
func _check_collider_contract() -> void:
	var packed: PackedScene = load("res://scenes/player.tscn") as PackedScene
	if packed == null:
		_failures.append("碰撞盒契约：res://scenes/player.tscn 无法加载（玩家场景缺失/损坏）")
		return
	var probe: Player = packed.instantiate() as Player
	if probe == null:
		_failures.append("碰撞盒契约：player.tscn 根节点不是 Player 脚本（场景与脚本接线断裂）")
		return
	var shape_node := probe.get_node_or_null("CollisionShape2D") as CollisionShape2D
	var rect: RectangleShape2D = (shape_node.shape if shape_node != null else null) as RectangleShape2D
	if rect == null:
		_failures.append("碰撞盒契约：player.tscn 缺少矩形 CollisionShape2D（碰撞几何被改动）")
	else:
		if not is_equal_approx(rect.size.x, Player.PLAYER_HALF_WIDTH * 2.0):
			_failures.append("碰撞盒契约：玩家碰撞盒宽 %.1f ≠ PLAYER_HALF_WIDTH×2=%.1f（半宽常量失真，跨坑余量承诺失效）" % [
				rect.size.x, Player.PLAYER_HALF_WIDTH * 2.0])
		if not is_equal_approx(rect.size.y, 26.0):
			_failures.append("碰撞盒契约：玩家碰撞盒高 %.1f ≠ 26（GROUND_CENTER_Y=200-13 的推导失真，地面吸附/缓冲断言会漂）" % rect.size.y)
	probe.free()


## A4 调参协议（§3C）：TUNING_META 结构合法、手感键齐全；_apply_tuning 把声明键映射进
## 运行期值、表外键忽略、空表回常量默认。调参通道「静默断裂」（键名被改 / 映射漏键 /
## 表外键污染）在这里被拦下 —— 断言用独立 probe 实例，不碰主玩家的运行期值。
func _check_tuning_protocol() -> void:
	var meta: Dictionary = GameState.TUNING_META
	if meta.is_empty():
		_failures.append("调参协议：GameState.TUNING_META 为空（§3C 调参工作台无键可调）")
		return
	for key: String in meta:
		var bounds: Dictionary = meta[key]
		if not bounds.has("min") or not bounds.has("max"):
			_failures.append("调参协议：TUNING_META[%s] 缺少 min/max（钳制区间声明不完整，越界值将不被钳制）" % key)
		elif float(bounds["min"]) > float(bounds["max"]):
			_failures.append("调参协议：TUNING_META[%s] 的 min > max（钳制区间颠倒）" % key)
	for key: String in ["run_speed", "jump_velocity_abs", "gravity", "max_jumps", "coyote_frames", "jump_buffer_frames"]:
		if not meta.has(key):
			_failures.append("调参协议：TUNING_META 缺少手感键 %s（player.gd 将永远取常量默认，调参静默失效）" % key)
	var probe := Player.new()
	probe.apply_tuning({
		"run_speed": 300.0, "jump_velocity_abs": 600.0, "gravity": 1600.0,
		"max_jumps": 3, "coyote_frames": 16, "jump_buffer_frames": 16,
	})
	if probe.live_run_speed != 300.0 or not is_equal_approx(probe.live_jump_velocity, -600.0) \
			or probe.live_gravity != 1600.0 or probe.live_max_jumps != 3 \
			or probe.live_coyote_frames != 16 or probe.live_jump_buffer_frames != 16:
		_failures.append("调参协议：apply_tuning 未把声明键映射进运行期值（run=%.0f jump=%.0f gravity=%.0f jumps=%d coyote=%d buffer=%d）" % [
			probe.live_run_speed, probe.live_jump_velocity, probe.live_gravity,
			probe.live_max_jumps, probe.live_coyote_frames, probe.live_jump_buffer_frames])
	# 表外键必须被忽略；apply_tuning 是全量重置语义，缺省键随之回常量默认（不残留上一次的值）。
	probe.apply_tuning({"evil_key": 42, "coyote_frames": 16})
	if probe.live_coyote_frames != 16 or probe.live_max_jumps != Player.MAX_JUMPS \
			or probe.live_run_speed != Player.RUN_SPEED:
		_failures.append("调参协议：apply_tuning 表外键未忽略或缺省键未回默认（evil_key 应无效；run=%.0f jumps=%d coyote=%d）" % [
			probe.live_run_speed, probe.live_max_jumps, probe.live_coyote_frames])
	probe.apply_tuning({})
	if probe.live_run_speed != Player.RUN_SPEED or probe.live_coyote_frames != Player.COYOTE_FRAMES:
		_failures.append("调参协议：空调参表未回常量默认（run_speed=%.0f coyote=%d，应 %d/%d）" % [
			probe.live_run_speed, probe.live_coyote_frames, int(Player.RUN_SPEED), Player.COYOTE_FRAMES])
	probe.free()


## ── A2 跨坑物理实证 ──

## 建场：从关卡数据表**现场推导**两档待实证坑宽（关卡改动自动跟随，测试不抄数字）——
##   一段跳档 = 「设计承诺一段跳可过」里最宽的坑（gap ≤ SINGLE_JUMP_GAP_MAX 的最大值）；
##   二段跳档 = 全关卡最宽的坑（难度梯度的天花板，跨得它就跨得过所有更窄的坑）。
func _build_proof_rigs() -> void:
	var gaps: Array[float] = []
	var segments := _level.GROUND_SEGMENTS
	for i in range(1, segments.size()):
		gaps.append(segments[i].x - segments[i - 1].y)
	if gaps.is_empty():
		return  # 单平台关卡：几何断言（A）已会报「没有任何坑」，这里没有可实证对象
	var single_gaps: Array[float] = []
	for gap in gaps:
		if gap <= Player.SINGLE_JUMP_GAP_MAX:
			single_gaps.append(gap)
	if not single_gaps.is_empty():
		_spawn_proof_rig(single_gaps.max(), false, "一段跳档")
	_spawn_proof_rig(gaps.max(), true, "二段跳档")


## 造一座 rig：两座平台夹一条 gap 宽的坑 + 一名真实 Player（player.tscn 实例，摘掉相机）。
func _spawn_proof_rig(gap: float, double_jump: bool, label: String) -> void:
	var packed: PackedScene = load("res://scenes/player.tscn") as PackedScene
	if packed == null:
		_failures.append("跨坑实证：player.tscn 无法加载（碰撞盒契约已上报），%s 无法搭建" % label)
		return
	var player: Player = packed.instantiate() as Player
	# 摘掉相机：rig 在赛道外远处，绝不能抢占主相机（主相机还承担震屏断言）。
	var camera_rig := player.get_node_or_null("CameraRig") as Node2D
	if camera_rig != null:
		player.remove_child(camera_rig)
		camera_rig.free()
	# 平台几何：顶面 y 对齐真实赛道 GROUND_TOP_Y；坑左唇 = 起跳台末沿，右平台 = 对岸。
	var base_x := PROOF_BASE_X + float(_proof_rigs.size()) * 3000.0
	var left_lip := base_x + PROOF_PLATFORM_WIDTH
	var b_left := left_lip + gap
	_add_proof_platform(base_x, left_lip)
	_add_proof_platform(b_left, b_left + PROOF_PLATFORM_WIDTH)
	# 出生点：中心 = 左唇 - 半宽（右半身压着唇沿、仍在平台上的最晚起跳位），悬空 1px 由重力落地。
	var start_x := left_lip - Player.PLAYER_HALF_WIDTH
	player.position = Vector2(start_x, GameLevel.GROUND_TOP_Y - 13.0 - 1.0)
	add_child(player)
	# ⚠️ 关掉该节点的 _unhandled_input 必须放在 add_child **之后**：入树前设置的
	# set_process_unhandled_input(false) 不生效（Godot 4.3 实测，探针实证：全局注入的
	# jump 动作照样送达，rig 的第二跳被主时间线的注入提前 ≈28 帧触发 → 实证全废）。
	# 关输入的目的：主时间线注入的 jump/restart 动作只许驱动主玩家，rig 的每次起跳
	# 都由本测试按计划帧显式调用 try_jump()（与真实输入同一入口），时机确定可复现。
	player.set_process_unhandled_input(false)
	var rig := ProofRig.new()
	rig.player = player
	rig.gap = gap
	rig.b_left = b_left
	rig.start_x = start_x
	rig.double_jump = double_jump
	rig.label = label
	rig.second_jump_frame = PROOF_JUMP_FRAME + PROOF_SECOND_JUMP_DELAY if double_jump else -1
	_proof_rigs.append(rig)


## 实证平台：StaticBody2D + 矩形碰撞，几何与 level.gd 的地面构建方式一致。
func _add_proof_platform(from_x: float, to_x: float) -> void:
	var width := to_x - from_x
	var body := StaticBody2D.new()
	body.position = Vector2(from_x + width * 0.5, GameLevel.GROUND_TOP_Y + PROOF_GROUND_HEIGHT * 0.5)
	var shape := CollisionShape2D.new()
	var rect := RectangleShape2D.new()
	rect.size = Vector2(width, PROOF_GROUND_HEIGHT)
	shape.shape = rect
	body.add_child(shape)
	add_child(body)


## 第一跳（PROOF_JUMP_FRAME）：两档 rig 同时从平台起跳。起跳前必须已站稳，
## 否则「从悬空起跳」会让实测跨距失真 —— 站不稳直接判 FAIL，不带病实证。
func _press_proof_jumps() -> void:
	for rig in _proof_rigs:
		if rig.player == null:
			continue
		if not rig.player.is_on_floor():
			_failures.append("跨坑实证：%s 起跳前未站在平台上（重力落地/地面吸附异常），实证无效" % rig.label)
			continue
		rig.start_x = rig.player.global_position.x
		rig.player.try_jump()


## 逐帧驱动（与主时间线并行）：到点补第二跳、落地帧记录落点。
func _step_proof_rigs() -> void:
	for rig in _proof_rigs:
		if rig.player == null or rig.landed_x >= 0.0:
			continue
		if _frames == rig.second_jump_frame:
			# 空中二段跳：jumps_used=1 < live_max_jumps=2 → _do_jump(2)。
			rig.player.try_jump()
		if _frames > PROOF_JUMP_FRAME and rig.player.is_on_floor():
			rig.landed_x = rig.player.global_position.x


## 实证结论：跨距 = 落点 - 起跳点（中心到中心），必须 ≥ 坑宽 + 最小压沿量才算「真的跨过去」。
func _assert_proof_rigs() -> void:
	_proof_checked = true
	if _proof_rigs.is_empty():
		_failures.append("跨坑实证：rig 未搭建（关卡坑宽数据为空或 player.tscn 缺失）")
		return
	for rig in _proof_rigs:
		if rig.player == null:
			continue
		var need_x: float = rig.b_left - Player.PLAYER_HALF_WIDTH + PROOF_MIN_LAND_OVERLAP
		if rig.landed_x < 0.0:
			var where := "掉进实证坑里" if rig.player.global_position.y > PROOF_FELL_Y else "在帧预算内未落地"
			_failures.append("跨坑物理实证：%s（坑宽 %.0fpx）跨坑失败 —— 玩家%s（y=%.0f），跳跃参数与关卡坑宽失配" % [
				rig.label, rig.gap, where, rig.player.global_position.y])
		elif rig.landed_x < need_x:
			_failures.append("跨坑物理实证：%s（坑宽 %.0fpx）落点 x=%.1f 未压上对岸（需 ≥%.1f）：实测跨距不足，坑宽超出真实可达范围" % [
				rig.label, rig.gap, rig.landed_x, need_x])
		else:
			var measured: float = rig.landed_x - rig.start_x
			print("跨坑物理实证：%s 坑宽 %.0fpx → 实测跨距 %.0fpx（余量 %.0fpx）—— 真实引擎物理可越过" % [
				rig.label, rig.gap, measured, measured - rig.gap])


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


## 14. 重开防误触：PLAYING 中按 restart 后玩家必须仍在前进（x 增长），没有被拽回出生点。
## 采样时玩家在 S1 平台 ≈220px 处；若重开被误受理，这里 x 会回到 ≈60px。
func _assert_restart_guarded() -> void:
	if _player == null:
		return
	var travelled: float = _player.global_position.x - _guard_x
	if travelled < 4.0:
		_failures.append("奔跑中按 restart 触发了重开（x %.1f → %.1f）：进度被静默清掉，" % [
			_guard_x, _player.global_position.x] +
			"重开必须只在结算后（WON/LOST）受理（自动跑酷防误触，playtest 机器人实证的进度丢失缺陷）")
	if GameState.state != GameState.State.PLAYING:
		_failures.append("奔跑中按 restart 后局状态被改变（当前 %d，应仍 PLAYING）" % GameState.state)


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
	# §3B 反馈总线：收集这条结果事件必须在 Juice 事件流里留痕（playtest 采样锚点）。
	_assert_juice_fired("收集飞镖")


func _assert_lost() -> void:
	if GameState.state != GameState.State.LOST:
		_failures.append("撞上尖刺后状态未变为 LOST（当前 %d）：hazard_hit → register_loss 链路断裂" % GameState.state)
	if not _lost_seen:
		_failures.append("信号 GameState.game_lost 未到达订阅方：Main 未订阅 game_lost")
	if _state_label != null and (not _state_label.visible or not _state_label.text.contains("失败")):
		_failures.append("失败后结算文案未显示「失败」：StateLabel 未被 _on_game_lost 刷新")
	if _main != null and not _main.is_shaking():
		_failures.append("失败反馈未接线：撞刺后相机未震屏（Main._on_game_lost 未触发 shake）")
	# §3B 反馈总线：失败这条结果事件必须在 Juice 事件流里留痕（结算弹层 flash + 音效调用点）。
	_assert_juice_fired("撞上尖刺失败")


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


## A5 调参「重开即生效」（§3C 承诺：拖动 → R 重开一局即生效）：
## RESTART_GUARD_FRAME 时已把运行期 run_speed 漂移到 300，重开受理那一刻 restart_run
## 必须把 GameState 当前的生效调参（无头下为常量默认）重新应用回玩家 —— 运行期值
## 若仍停在 300，说明 reset() 重读的结果没有人消费（调参只在整页刷新时生效）。
func _assert_tuning_reapplied_on_restart() -> void:
	if _player == null:
		return
	if not is_equal_approx(_player.live_run_speed, Player.RUN_SPEED):
		_failures.append("调参「重开即生效」失效：重开一局后运行期 run_speed=%.0f 未收敛回生效调参（%0.f）—— restart_run 未调用 player.apply_tuning(GameState.tuning)，GameState.reset() 重读的调参没人消费，调参工作台只在整页刷新时生效" % [
			_player.live_run_speed, Player.RUN_SPEED])
	if _player.live_coyote_frames != Player.COYOTE_FRAMES:
		_failures.append("调参「重开即生效」失效：重开后土狼窗口 %d ≠ 默认 %d（同上，重开未重新应用调参）" % [
			_player.live_coyote_frames, Player.COYOTE_FRAMES])


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


## ── §3B 反馈总线断言辅助 ──

## 反馈窗口起点：清空 Juice 事件记录（单例缺失已由 _ready 协议断言上报，这里静默跳过）。
func _clear_juice_events() -> void:
	if _juice != null and _juice.has_method("clear_events"):
		_juice.call("clear_events")


## 窗口断言：自上次清空以来，结果事件必须至少留痕 1 条反馈（playtest 反馈流同源）。
func _assert_juice_fired(context: String) -> void:
	if _juice == null:
		return
	var events_variant: Variant = _juice.get("events")
	if not (events_variant is PackedStringArray):
		_failures.append("autoload Juice.events 类型异常（期望 PackedStringArray，实际 %s）" % [
			type_string(typeof(events_variant))])
		return
	var events: PackedStringArray = events_variant
	if events.is_empty():
		_failures.append("%s后 Juice.events 为空：结果事件未挂任何反馈（§3B 接线断裂，playtest 反馈流断供）" % context)


func _report() -> void:
	_finished = true
	if _failures.is_empty() and _coyote_checked and _buffer_checked and _proof_checked:
		print("GODOT_SMOKE: PASS 关卡几何/场景实例化/autoload/键位契约/手感契约(v2=12帧)/自动奔跑/跳跃二段跳/土狼跳/跳跃缓冲/收集飞镖+反馈/撞刺失败+震屏/重开复位/跑底过关+留存/冻结停跑/Juice反馈总线/重开防误触/跨坑物理实证/碰撞盒契约/调参协议+重开即生效/音效资产协议 全部通过")
		get_tree().quit(0)
	else:
		if not _coyote_checked and _failures.is_empty():
			_failures.append("土狼跳断言未执行到（阶段帧表被前置失败打断）")
		if not _buffer_checked and _failures.is_empty():
			_failures.append("跳跃缓冲断言未执行到（阶段帧表被前置失败打断）")
		if not _proof_checked and _failures.is_empty():
			_failures.append("跨坑物理实证未执行到（阶段帧表被前置失败打断）")
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


## A2. 手感契约（spec v2 拍板值，ac-10-feel-tuning-v2）：输入容错窗口默认必须是 12 帧。
## 两个常量是「土狼跳 / 跳跃缓冲」两组断言的窗口来源，也是真机吞按缺陷的整改值 ——
## 意外回退到 v1 的 6 帧属验收回归，必须在这里被拦下（URL ?tuning= 覆盖的是运行期值，
## 不改常量，所以本断言与调参通道互不干扰）。
func _check_feel_contract() -> void:
	var contract := [
		[Player.COYOTE_FRAMES, 12, "COYOTE_FRAMES"],
		[Player.JUMP_BUFFER_FRAMES, 12, "JUMP_BUFFER_FRAMES"],
	]
	for row: Array in contract:
		if row[0] != row[1]:
			_failures.append("手感契约：%s = %d，spec v2 拍板默认为 %d（输入容错窗口回退 = 真机「按了没反应」缺陷回归）" % [
				row[2], row[0], row[1]])


## A3. 音效资产协议（§3B「调用点先钉、资产后补」的闭环断言）：
## 调用点钉住的名必须在 Juice.SFX_BANK 注册且指向已加载的 AudioStream。
## 注册表被清空/改名 = 收集、撞刺、失败、过关在真机全程无声（headless 不断言「出声」，
## 只断言「注册表接线完整」—— 声音是否真放出来归真机口径 qa/ios-safari-checklist.md）。
func _check_sfx_bank() -> void:
	var script: Script = _juice.get_script()
	if script == null:
		_failures.append("autoload Juice 没有挂脚本：SFX_BANK 注册表无从核对")
		return
	var constants: Dictionary = script.get_script_constant_map()
	if not constants.has("SFX_BANK") or not (constants["SFX_BANK"] is Dictionary):
		_failures.append("autoload Juice 缺少 SFX_BANK 注册表（音效协议面缺失）")
		return
	var bank: Dictionary = constants["SFX_BANK"]
	if bank.is_empty():
		_failures.append("音效资产协议：Juice.SFX_BANK 为空 —— 调用点已钉但资产未注册，" +
			"收集/撞刺/失败/过关在真机全程无声（§3B「资产后补」步骤未完成，跑 tools/gen_sfx.gd 后注册）")
		return
	for key: StringName in PINNED_SFX:
		if not bank.has(key):
			_failures.append("音效资产协议：调用点 &\"%s\" 未在 Juice.SFX_BANK 注册（该结果事件真机无声）" % key)
		elif not (bank[key] is AudioStream):
			_failures.append("音效资产协议：SFX_BANK[&\"%s\"] 不是 AudioStream（实际 %s）—— assets/sfx/ 资产缺失或未导入" % [
				key, type_string(typeof(bank[key]))])


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
