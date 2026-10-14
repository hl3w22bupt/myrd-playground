extends Node
## 《牛牛打游戏》无头冒烟自检（headless smoke）—— 机器可判定的「游戏能不能跑、玩得动」。
##
## 运行方式（由 scripts/smoke.sh 封装）：
##   godot --headless --path <工程目录> --quit-after <FRAMES> tests/smoke.tscn
##
## 判定协议（smoke.sh 按此断言退出码与日志）：
##   通过 → stdout 打印 `GODOT_SMOKE: PASS ...`，进程退出码 0
##   失败 → stderr 打印 `GODOT_SMOKE: FAIL <原因>`（每条一行），进程退出码 1
##
## 覆盖面（模板五项断言逐项保留 + 收集玩法与难度梯度的机判断言 + v3 扩展）：
##   1. 场景可实例化（main.tscn → player.tscn / collectible.tscn 接线未断裂）
##   2. autoload 已注册且带约定信号
##   3. InputMap 动作已注册、物理键绑定正确（键位契约），注入输入后牛牛真的动了，
##      且移动方向符号正确：A/← 输入后 position.x 减小、D/→ 输入后 position.x 增大
##      （需求 cmuktc8jk000hm97zm6l1gp4u 基线：方向反向即 FAIL）
##   4. 信号真的到达订阅方（Player.moved / GameState.score_changed）
##   5. 收集判定：触碰后物品消失且计数 +1（需求验收基线 2）
##   6. 连续 50 次触碰判定一致性：跨 3 局累计 50 次真实触碰（只碰普通物），每次恰好 +1
##      （验收基线 2；v3 多类型下不回退 —— 高分物/道具停靠不碰，Combo 加成不污染台账）
##      含反例：清空场地静置，计数必须保持 0（无误判）
##   7. 难度梯度：刷新间隔/物品寿命随波次曲线单调收紧、有界；首收后 SpawnTimer 真的变快
##   8. 物品过期：寿命耗尽自动回收且不计分（expired → 回收接线）
##   9. 通关可达：第 20 次触碰 → phase=WON + 结算面板「通关」（验收基线 3）
##  10. 失败可达：限时归零 → phase=LOST + 结算面板「时间到」+ HUD 红色警示（验收基线 3）
##  11. 一键重开：结算后按确认 → 计数/时限/位置/面板/难度节奏全部复位（验收基线 3）
##  12. 持久化：最高分/累计进度/最高连击落盘后回读一致（验收基线 4）
##  13. v2 手感基线：体型倍率 1.3~1.5×、移速为 v1(220) 的 60~70%，且倍率真的接线到
##      根节点/碰撞体/PickupArea 判定体（需求 cmuqmej89000ym9gg6mom93o0）
##  14. 开始流程：READY + 开始面板 → 确认进入 RUNNING（v3 ④2）
##  15. 多类型计分：稀有物 +3、时钟 +2 且加时 4 秒（v3 ①1；分值口径 gain_for 唯一来源）
##  16. Combo：窗口内连击递增、高分物加成生效、连击 UI 可见、超时清零（v3 ①3）
##  17. 磁铁道具：生效期间 96px 内目标被吸到判定距离并触发收集（v3 ①2）
##  18. 加速道具：激活后实测位移 > 基线 ×1.3（BOOST_MULT=1.5，v3 ①2）
##  19. 暂停/恢复：P 键暂停冻结时限、确认恢复（v3 ④2）
##  20. 波次：波次下标按分数切分、权重表逐波合计 1 且 rare 单调不降（v3 ①4）
##  21. 音效：Sfx 库 ≥6 种、收集后 played_count 真的增长（v3 ④1 零音效闭环）
##  22. 调参协议：新增声明键可应用/钳制、未声明键拒绝（SKILL.md §3C）
##
## ⚠️ 输入注入分阶段互不重叠（references/error-signatures.md E-08）：
##   `Input.action_press()` 与 `Input.parse_input_event()` 同帧混用会互相冲掉，必须分帧。

## ── 噪声相位：确定种子对抗输入（悬挂手势/孤儿释放/乱键），断言仍全过 = 输入管线没被楔死 ──
const NOISE_FRAMES: int = 24
## 阶段一（方向符号断言）：单方向持续按住的物理帧数。
## v2 移速 145px/s ≈ 2.42px/物理帧 → 6 帧 ≈ 12~15px 位移，远超 MIN_MOVE_DISTANCE 且
## 帧开销极小（A/← 与 D/→ 背靠背共 13 帧，对照原先单向 11 帧，只多 2 帧）。
const DIR_HOLD_FRAMES: int = 6
## 方向符号断言基准点：视口正中（v3 竖屏画布 720x1280）。距左右边各 360px，双向 ~20px 位移
## 不会触 PLAY_RECT(24px 边距) 钳制 —— 钳制会吃掉位移、把方向断言打成假失败。
const DIR_CHECK_POSITION: Vector2 = Vector2(360.0, 640.0)
## 阶段二：传送到收集物上后等待 area_entered 的帧数。
const COLLECT_FRAMES: int = 4
## 注入 confirm 后等待结算/重开生效的帧数。
const SETTLE_FRAMES: int = 4
## 失败阶段帧数：先进 9 秒警示区断言 HUD 变红，再压到即刻归零判 LOST。
const LOSE_FRAMES: int = 8
## 等待生成器自动补充的帧数上限（SPAWN_INTERVAL_START=0.8s ≈ 48 物理帧，留余量）。
const RESPAWN_MAX_FRAMES: int = 90
## 清场后静置观察误判的帧数。
const NO_MISJUDGE_FRAMES: int = 4
## 过期断言用的短寿命（秒）：0.2s ≈ 12 物理帧。
const SHORT_LIFETIME: float = 0.2
## RESPAWN_EXPIRE 阶段的生成器白盒周期（秒）：0.25s ≈ 15 物理帧（SHORT_LIFETIME 同款
## 「只压节奏不改语义」——断言的仍是 timeout→_fill_collectibles 自动补货接线，出相位还原）。
const RESPAWN_TEST_INTERVAL: float = 0.25
## 大批量收集时，非目标物品的统一停放点：
## 必须在牛牛可达区（PLAY_RECT 钳制 [24..696, 24..1256]）之外，且距可达区最近点 >判定距离
## 与磁铁半径（v2 拾取判定 = 玩家判定半径 22×1.4≈30.8 + 物品半径 14 ≈44.8px；
## v3 磁铁半径默认 100px；(780,1360) 距可达角 (696,1256) ≈133.7px，两者都安全）。
## 旧竖屏前值 (700,420) 的推导同口径：距离 ≈113px 在 640x360 画布下同样成立。
## 每次只把目标物品摆到牛牛脚下、其余全部停走 → 单触单收确定性，50 连击不被双收污染。
const PARK_POSITION: Vector2 = Vector2(780.0, 1360.0)
## 整体帧预算兜底（超过直接判失败，防死循环；smoke.sh 另有 --quit-after 兜底）。
const TOTAL_FRAME_BUDGET: int = 600
## 判定「真的移动了」的最小位移（像素）。
const MIN_MOVE_DISTANCE: float = 1.0
## ── v2 手感基线机判区间（需求 cmuqmej89000ym9gg6mom93o0）──
## 体型倍率：需求要求 1.3~1.5 倍整体放大（实际落账 1.4）。
const V2_SCALE_MIN: float = 1.3
const V2_SCALE_MAX: float = 1.5
## 移速：v1 默认 220 px/s 下调至 60~70%（实际落账 145 ≈ 65.9%）。
const V1_SPEED: float = 220.0
const V2_SPEED_MIN: float = V1_SPEED * 0.6
const V2_SPEED_MAX: float = V1_SPEED * 0.7
## HUD 低时警示色（与 main.gd TIME_WARN 覆写保持一致）。
const TIME_WARN_COLOR: Color = Color(1.0, 0.35, 0.3)
## 失败阶段先落入的警示观察点（秒）：低于 main.gd 的 TIME_WARN_SECONDS(10) 即变红。
const TIME_WARN_CHECK_SECONDS: float = 9.0
## ── v3 断言常量（需求 cmv6vkith000gjotytp4v915c）──
## 磁铁断言：目标物初始离牛牛的距离（<磁铁半径 100，>判定距离 44.8 —— 只能靠磁铁吸进来）。
const MAGNET_TEST_DISTANCE: float = 85.0
## 磁铁断言等待帧数上限：85→44.8px 需 (85-44.8)/170×60 ≈14 物理帧，取 24 留余量。
const MAGNET_MAX_FRAMES: int = 24
## 加速断言：基线与加速各持续按住 → 的物理帧数（145px/s ×5帧 ≈12px，位移可测）。
const BOOST_HOLD_FRAMES: int = 5
## 加速判定倍率下限：BOOST_MULT=1.5 留工程余量（帧取整噪声 <10%）。
const BOOST_RATIO_MIN: float = 1.3
## 多类型断言：时钟加时期望值（数值区 TIME_BONUS_CLOCK 默认 4.0）。
const CLOCK_BONUS_EXPECTED: float = 4.0
## Sfx 库最小注册数（collect/rare/clock/powerup/wave/win/lose 共 7，要求 ≥6 防漏注册）。
const SFX_BANK_MIN: int = 6
## KEY_CONTRACT 补充 v3 暂停键。
const PAUSE_KEY: Key = KEY_P

const REQUIRED_ACTIONS: Array[StringName] = [
	&"move_left", &"move_right", &"move_up", &"move_down", &"confirm", &"pause", &"restart",
]

## 键位契约：动作 → 键表承诺的物理键，必须全部绑定（逐键 AND，见模板注释）。
## v4 ④3 补充 restart=R（结算面板一键重开的键盘入口，与触摸按钮双入口并存）。
const KEY_CONTRACT: Dictionary = {
	&"move_left": [KEY_A, KEY_LEFT],
	&"move_right": [KEY_D, KEY_RIGHT],
	&"move_up": [KEY_W, KEY_UP],
	&"move_down": [KEY_S, KEY_DOWN],
	&"confirm": [KEY_SPACE, KEY_ENTER],
	&"pause": [KEY_P],
	&"restart": [KEY_R],
}

## 冒烟阶段状态机。
## 触碰台账：COLLECT 1 次 + MASS1 至 20（本局通关触）+ MASS2 至 40（二局通关触）
## + MASS3 至 50（第三局不触发通关）＝ 验收基线 2 的「连续收集 50 次」。
## v3 新增阶段全部走真实场景/真实输入：开始面板 → 多类型计分 → Combo → 磁铁 →
## 加速 → 暂停 → 波次/调参/音效/持久化（v3 需求 cmv6vkith000gjotytp4v915c）。
enum SmokePhase {
	NOISE, START, MOVE, COLLECT, MASS1, SETTLE1, RESTART1, MASS2, SETTLE2, RESTART2,
	MASS3, LOSE, RESTART3, RESPAWN_EXPIRE, MULTITYPE, COMBO, MAGNET, BOOST, PAUSE,
	DIFFICULTY, PERSIST, DONE,
}

var _failures: PackedStringArray = []
var _phase: SmokePhase = SmokePhase.NOISE
var _phase_frames: int = 0
var _total_frames: int = 0
var _finished: bool = false
var _player: Player
var _main_node: GameMain
var _origin: Vector2 = Vector2.ZERO
## 方向符号断言的 x 基准：每次断言后滚动更新为当前 x（先 ← 后 → 各比对一次基准）。
var _dir_base_x: float = 0.0
var _collect_target: Collectible
var _expire_target: Collectible
var _moved_seen: bool = false
var _score_seen: bool = false
## 跨局累计的「真实触碰判定」次数（每次触碰断言恰好 +1 后 +1）。
var _touch_count: int = 0
## 本次传送前记录的分数（触碰后断言恰好 +1 的基准）。
var _score_before_touch: int = 0
## 奇数帧已传送、等待偶数帧结算的标志。
var _awaiting_touch: bool = false
## RESPAWN_EXPIRE 阶段内观察到的 SpawnTimer 自动补充。
var _respawn_seen: bool = false
## ── v3 阶段用状态 ──
## 多类型断言：触碰前的分数（稀有 +3 / 时钟 +2 的增量基准）。
var _multi_score_before: int = 0
## 时钟加时断言的加时前剩余时间。
var _clock_time_before: float = 0.0
## Combo 断言：连击链进入 COMBO 阶段时的基准（每触 +1 递推）。
var _combo_base: int = 0
## Combo 断言：三只稀有物的触碰台账（每次触碰后记录 delta）。
var _combo_gains: PackedInt32Array = []
## 磁铁断言：被吸目标与触碰前分数。
var _magnet_target: Collectible
var _magnet_score_before: int = 0
## 加速断言：基线位移与加速位移（px）。
var _boost_base_dx: float = 0.0
var _boost_test_x: float = 0.0
## ── v4 阶段用状态（角色多帧动画，需求 cmv7hnfx3000ojofistqwry8l ②1）──
## 牛牛的 AnimatedSprite2D（player.tscn 的 Anim 节点）。
var _anim_node: AnimatedSprite2D
## 全程是否观测到过 collect 庆祝动画（收集路径触发的一次性动画，时序不钉帧只看出现过）。
var _saw_collect_anim: bool = false

## 噪声相位：确定种子随机事件（原始事件，不含 InputEventAction）。
var _noise_rng := RandomNumberGenerator.new()
## 各相位消耗的物理帧数台账（_to_phase 记账、_report 打印，预算收敛用）。
var _phase_frames_ledger: Dictionary = {}


func _ready() -> void:
	# headless 无垂直同步：限 60 FPS 让 process 帧 : 物理帧 ≈ 1:1，--quit-after 兜底才有意义。
	Engine.max_fps = 60
	# 播种全局 RNG：生成器刷点用 randf_range，不播种则每次运行物品布局不同，
	# 冒烟帧耗会抖动（布局差时阶段拖长 → 超 --quit-after 预算被静默杀掉，无标记假失败）。
	seed(20260913)

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

	_main_node = get_tree().root.find_child("Main", true, false) as GameMain
	if _main_node == null:
		_failures.append("场景树找不到 Main（smoke.tscn 未实例化 main.tscn，或 GameMain 未挂接）")

	var spawn_timer := get_tree().root.find_child("SpawnTimer", true, false) as Timer
	if spawn_timer == null:
		_failures.append("场景树找不到 SpawnTimer（main.tscn 缺少生成器定时器）")
	else:
		spawn_timer.timeout.connect(_on_main_spawn_timer_timeout)

	_player = get_tree().root.find_child("Player", true, false) as Player
	if _player == null:
		_failures.append("场景树找不到 Player（main.tscn 未实例化 player.tscn，或实例名不是 Player）")
	else:
		_player.moved.connect(_on_player_moved)
		_origin = _player.global_position
		_assert_multiframe_anim_setup()
	# v4 ④1 震屏载体：Juice.shake 需要当前 Camera2D 才有视觉位移。
	var camera := get_tree().root.find_child("Camera", true, false) as Camera2D
	if camera == null or not camera.is_current():
		_failures.append("震屏 FAIL：场景缺少当前 Camera2D（Juice.shake 只记录不位移，关键事件震屏不生效）")


func _physics_process(_delta: float) -> void:
	if _finished:
		return
	_total_frames += 1
	_phase_frames += 1
	# v4 ②1 观测：collect 庆祝动画出现过即记（不钉帧，对播放时序鲁棒）。
	if _anim_node != null and _anim_node.animation == &"collect":
		_saw_collect_anim = true
	if _total_frames > TOTAL_FRAME_BUDGET:
		_failures.append("冒烟阶段 %s 超过 %d 帧未完成（阶段推进卡死）" % [
			SmokePhase.keys()[_phase], TOTAL_FRAME_BUDGET,
		])
		_report()
		return

	if _failures.is_empty():
		_advance_phase()

	if not _failures.is_empty():
		_finished = true
		_report()


## 阶段状态机：每个阶段「进入时布置、满足条件后迁移」，全部走真实场景与真实输入。
func _advance_phase() -> void:
	match _phase:
		SmokePhase.NOISE:
			_inject_noise_frame()
			if _phase_frames >= NOISE_FRAMES:
				# 显式释放全部动作：噪声随机按键可能留下悬挂的按下态，不清会污染 MOVE 断言。
				for action in REQUIRED_ACTIONS:
					Input.action_release(action)
				_to_phase(SmokePhase.START)
		SmokePhase.START:
			# v3 开始流程（④2）：READY + 开始面板 → 确认 → RUNNING + 面板收起 + 场上铺满。
			if _phase_frames == 1:
				_assert_start_screen()
				_press_action(&"confirm")
			elif _phase_frames >= SETTLE_FRAMES:
				_assert_started()
				_to_phase(SmokePhase.MOVE)
		SmokePhase.MOVE:
			# 方向符号断言（需求 cmuktc8jk000hm97zm6l1gp4u 基线）：
			# A/← 输入后 position.x 必须减小，D/→ 输入后必须增大 —— 以输入前后 x 符号差判定。
			# 布置帧先把牛牛瞬移到视口正中（双方位移都不触边钳制）、把在场物品停走
			# （杜绝 13 帧窗口内顺路收集污染判定），再背靠背注入 ← / → 两个方向。
			if _phase_frames == 1:
				_assert_v2_tuning()
				_park_all_others(null)
				# _advance_phase 只在零失败时推进（_physics_process 已守卫），此处 _player 必非空。
				_player.global_position = DIR_CHECK_POSITION
				_dir_base_x = _player.global_position.x
				Input.action_press(&"move_left")
			elif _phase_frames == DIR_HOLD_FRAMES:
				# v4 ②1：位移保持中，动画状态机应处于 move 态（随输入实时切换）。
				_assert_anim_is(&"move")
			elif _phase_frames == DIR_HOLD_FRAMES + 1:
				Input.action_release(&"move_left")
				_assert_direction_sign(-1)
				Input.action_press(&"move_right")
			elif _phase_frames >= DIR_HOLD_FRAMES * 2 + 1:
				Input.action_release(&"move_right")
				_assert_direction_sign(1)
				_to_phase(SmokePhase.COLLECT)
		SmokePhase.COLLECT:
			if _phase_frames == 1:
				_place_target_under_player()
			elif _phase_frames >= COLLECT_FRAMES:
				_assert_collected()
				_assert_spawn_tightened()
				_touch_count = 1
				_to_phase(SmokePhase.MASS1)
		SmokePhase.MASS1:
			_mass_step(20, SmokePhase.SETTLE1)
		SmokePhase.SETTLE1:
			if _phase_frames >= SETTLE_FRAMES:
				_assert_settled(true)
				_assert_collect_anim_seen()
				_press_action(&"confirm")
				_to_phase(SmokePhase.RESTART1)
		SmokePhase.RESTART1:
			if _phase_frames >= SETTLE_FRAMES:
				_assert_restarted()
				_to_phase(SmokePhase.MASS2)
		SmokePhase.MASS2:
			_mass_step(40, SmokePhase.SETTLE2)
		SmokePhase.SETTLE2:
			if _phase_frames >= SETTLE_FRAMES:
				_assert_settled(true)
				_press_action(&"confirm")
				_to_phase(SmokePhase.RESTART2)
		SmokePhase.RESTART2:
			if _phase_frames >= SETTLE_FRAMES:
				_assert_restarted()
				_to_phase(SmokePhase.MASS3)
		SmokePhase.MASS3:
			_mass_step(50, SmokePhase.LOSE)
		SmokePhase.LOSE:
			if _phase_frames == 1:
				# 先进警示区（<10s）断言 HUD 变红，再压到即刻归零。
				GameState.time_left = TIME_WARN_CHECK_SECONDS
			elif _phase_frames == 3:
				_assert_time_warning()
				GameState.time_left = 0.02
			elif _phase_frames >= LOSE_FRAMES:
				_assert_settled(false)
				_press_action(&"confirm")
				_to_phase(SmokePhase.RESTART3)
		SmokePhase.RESTART3:
			if _phase_frames >= SETTLE_FRAMES:
				_assert_restarted()
				_to_phase(SmokePhase.RESPAWN_EXPIRE)
		SmokePhase.RESPAWN_EXPIRE:
			_respawn_expire_step()
		SmokePhase.MULTITYPE:
			_multitype_step()
		SmokePhase.COMBO:
			_combo_step()
		SmokePhase.MAGNET:
			_magnet_step()
		SmokePhase.BOOST:
			_boost_step()
		SmokePhase.PAUSE:
			_pause_step()
		SmokePhase.DIFFICULTY:
			_assert_difficulty_curve()
			_to_phase(SmokePhase.PERSIST)
		SmokePhase.PERSIST:
			_assert_touch_ledger()
			_assert_persistence_roundtrip()
			_assert_v3_tuning_protocol()
			_assert_sfx_bank()
			_to_phase(SmokePhase.DONE)
		SmokePhase.DONE:
			_report()


func _to_phase(next_phase: SmokePhase) -> void:
	# 帧耗台账（预算收敛用）：记录每个相位消耗的物理帧数，_report 时打印。
	_phase_frames_ledger[_phase] = _phase_frames
	_phase = next_phase
	_phase_frames = 0


## 大批量收集步进（流水线化）：每帧先断言上一帧摆放的触碰「恰好 +1」，再摆放下一次触碰。
## 收集信号在摆放帧的物理 flush 内落账（Area2D 监控回调在物理步末触发），次帧断言的
## 时序与原「奇帧摆放/偶帧断言」完全一致；流水线化把每触 2 帧压到 1 帧（v4 帧预算收敛，
## 套件必须完整跑进门禁 --quit-after 兜底），50 次触碰的契约口径不变。
## 补给走 main 的真实生成路径（_fill_collectibles → _spawn_collectible），
## 判定走真实 Area2D 重叠路径；摆放只决定「哪一个物品被触碰」，不为测试另开判定旁路。
func _mass_step(end_touch: int, next_phase: SmokePhase) -> void:
	if _awaiting_touch:
		_awaiting_touch = false
		if GameState.score != _score_before_touch + 1:
			_failures.append("第 %d 次触碰判定不一致：触碰前 score=%d 触碰后 %d，期望恰好 +1（验收基线 2：连续 50 次无误判/漏判）" % [
				_touch_count + 1, _score_before_touch, GameState.score,
			])
			return
		_touch_count += 1
		if _touch_count >= end_touch:
			_to_phase(next_phase)
			return
	if _main_node != null:
		_main_node._fill_collectibles()
	# 只碰普通物：+1 台账与 v1/v2 完全同口径（v3 的高分物/道具不进 50 连击样本）。
	var target := _pick_fresh_collectible("normal")
	if target == null and _main_node != null:
		target = _main_node._spawn_collectible("normal")
	if target != null:
		_park_all_others(target)
		_score_before_touch = GameState.score
		target.global_position = _player.global_position
		_awaiting_touch = true


## 挑一个还有富余寿命的可收集物（剩余 >1s）：杜绝「摆上去同帧过期被释放」的竞态。
## kind_filter 非空时只挑该类型 —— 50 连击台账只碰普通物（+1 口径不被高分物/连击加成污染）。
func _pick_fresh_collectible(kind_filter: String = "") -> Collectible:
	var container := get_tree().root.find_child("Collectibles", true, false)
	if container == null:
		return null
	for child in container.get_children():
		var collectible := child as Collectible
		if collectible != null and not collectible.is_queued_for_deletion() \
				and collectible.remaining_lifetime() > 1.0 \
				and (kind_filter.is_empty() or collectible.kind == kind_filter):
			return collectible
	return null


## 把目标以外的可收集物全部停到远角：牛牛脚下同帧只有一个判定源（单触单收）。
func _park_all_others(target: Collectible) -> void:
	var container := get_tree().root.find_child("Collectibles", true, false)
	if container == null:
		return
	for child in container.get_children():
		var collectible := child as Collectible
		if collectible != null and collectible != target \
				and not collectible.is_queued_for_deletion():
			collectible.global_position = PARK_POSITION


## 清场 + 短寿命物品 + 自动补充观察（同一等待窗口内并行断言三条路径）。
## v4 帧预算收敛：入相位把生成器 wait_time 白盒压到 0.25s（SHORT_LIFETIME 同款「只压
## 节奏不改语义」——断言的仍是 timeout→自动补货接线），出相位还原为当前难度口径。
func _respawn_expire_step() -> void:
	if _phase_frames == 1:
		_respawn_seen = false
		if _main_node != null:
			_main_node.spawn_timer.wait_time = RESPAWN_TEST_INTERVAL
			_main_node.spawn_timer.start()  # 立即以新周期重计时（中途改 wait_time 不影响本 Countdown）
			_main_node._clear_collectibles()
			_expire_target = _main_node._spawn_collectible()
			if _expire_target != null:
				_expire_target.lifetime = SHORT_LIFETIME
		return
	if _phase_frames <= 1 + NO_MISJUDGE_FRAMES:
		# 反例：清空场地 + 牛牛静置（刷点与出生点有 96px 间距），计数必须保持 0。
		if GameState.score != 0:
			_failures.append("空置场地上发生误判收集：score=%d（验收基线 2：无误判）" % GameState.score)
		return
	var expiry_done: bool = _expire_target == null or not is_instance_valid(_expire_target)
	if _respawn_seen and expiry_done:
		_assert_respawn_and_expiry()
		if _main_node != null:
			_main_node.spawn_timer.wait_time = GameState.spawn_interval_now()
		_to_phase(SmokePhase.MULTITYPE)
	elif _phase_frames >= RESPAWN_MAX_FRAMES:
		if not _respawn_seen:
			_failures.append("生成器未在 %d 帧内自动补充（SpawnTimer timeout 未触发 _fill_collectibles）" % [
				RESPAWN_MAX_FRAMES,
			])
		if not expiry_done:
			_failures.append("过期物品未被回收：寿命耗尽后仍存活（expired → 回收接线断裂）")


## ── v3 阶段：开始面板 ──
func _assert_start_screen() -> void:
	if GameState.phase != GameState.Phase.READY:
		_failures.append("启动阶段应为 READY（v3 ④2 开始面板流程），实际 %s" % _phase_label(GameState.phase))
	var panel := get_tree().root.find_child("StartPanel", true, false)
	if panel == null or not (panel as Control).visible:
		_failures.append("开始面板未在 READY 阶段显示（StartPanel 未创建或未置可见）")


func _assert_started() -> void:
	if GameState.phase != GameState.Phase.RUNNING:
		_failures.append("确认后未进入 RUNNING（开始面板 → 游戏进行路径断裂），实际 %s" % _phase_label(GameState.phase))
	var panel := get_tree().root.find_child("StartPanel", true, false) as Control
	if panel != null and panel.visible:
		_failures.append("开始游戏后开始面板仍可见（面板未随 RUNNING 收起）")
	if _collectible_count() < GameState.MAX_COLLECTIBLES:
		_failures.append("开始后场上物品未铺满：%d/%d（_start_or_restart 未执行 _fill_collectibles）" % [
			_collectible_count(), GameState.MAX_COLLECTIBLES,
		])


## ── v3 阶段：多类型计分（rare +3；clock +2 且加时 4s）──
## 全部走真实触碰：清场 → 指定类型刷到牛牛脚下 → 断言增量与类型分值一致。
func _multitype_step() -> void:
	if _phase_frames == 1:
		# 分数归零：本阶段 +6 分、COMBO 阶段 +15 分，都不得误触 20 分通关线（否则 phase
		# 进入 WON、磁铁/加速/暂停断言全部失效）。与 DIFFICULTY 阶段同款白盒口径。
		GameState.score = 0
		_main_node._clear_collectibles()
		var rare := _main_node._spawn_collectible("rare")
		_multi_score_before = GameState.score
		rare.global_position = _player.global_position
	elif _phase_frames == COLLECT_FRAMES:
		var gained: int = GameState.score - _multi_score_before
		if gained != GameState.item_score_for("rare"):
			_failures.append("多类型计分 FAIL：稀有物触碰后 +%d，期望 +%d（类型分值口径不一致）" % [
				gained, GameState.item_score_for("rare"),
			])
		# 窗口断言带容差：触碰刷新后 _process 每帧递减，检查点晚 1~3 帧 ≈0.03~0.05s 属正常。
		if GameState.combo_timer < GameState.COMBO_WINDOW - 0.2:
			_failures.append("Combo 窗口未随触碰刷新：timer=%.3f 应接近满窗 %.3f（触碰未续窗）" % [
				GameState.combo_timer, GameState.COMBO_WINDOW,
			])
		# 白盒推进 Combo 超时（窗口 0.001s → 下一物理帧过期清零），隔离时钟触碰的连击加成，
		# 让「时钟 +2」的分值口径单独可判。
		GameState.combo_timer = 0.001
	elif _phase_frames == COLLECT_FRAMES + 2:
		if GameState.combo_count != 0:
			_failures.append("Combo 超时未清零：combo_count=%d（窗口过期断链路径断裂）" % GameState.combo_count)
		GameState.time_left = 30.0
		_clock_time_before = GameState.time_left
		var clock := _main_node._spawn_collectible("clock")
		clock.global_position = _player.global_position
	elif _phase_frames >= COLLECT_FRAMES * 2 + 2:
		var gained: int = GameState.score - _multi_score_before
		if gained != GameState.item_score_for("rare") + GameState.item_score_for("clock"):
			_failures.append("多类型计分 FAIL：稀有+时钟合计 +%d，期望 +%d（时钟分值口径不一致）" % [
				gained, GameState.item_score_for("rare") + GameState.item_score_for("clock"),
			])
		var expected_time: float = minf(_clock_time_before + CLOCK_BONUS_EXPECTED, GameState.TIME_LIMIT)
		if absf(GameState.time_left - expected_time) > 0.5:
			_failures.append("时钟加时 FAIL：time_left %.2f 期望 ≈%.2f（加时 %+.1fs 未生效）" % [
				GameState.time_left, expected_time, CLOCK_BONUS_EXPECTED,
			])
		_combo_base = GameState.combo_count
		_combo_score_base = GameState.score
		_to_phase(SmokePhase.COMBO)


## ── v3 阶段：Combo 递增 + 高分物加成 + 连击 UI ──
func _combo_step() -> void:
	if _phase_frames % 2 == 1:
		if _phase_frames == 1:
			GameState.score = 0  # 三只稀有 +15 分，归零防误触通关线（见 _multitype_step 注释）
			_main_node._clear_collectibles()
			_combo_gains.clear()
			_combo_score_base = GameState.score
		_combo_touch_score_before = GameState.score
		var rare := _main_node._spawn_collectible("rare")
		rare.global_position = _player.global_position
		_awaiting_touch = true
	elif _awaiting_touch:
		_awaiting_touch = false
		_combo_gains.append(GameState.score - _combo_touch_score_before)
		if _combo_gains.size() >= 3:
			_assert_combo_chain()
			_to_phase(SmokePhase.MAGNET)


## 进入 COMBO 阶段时的分数基准（MULTITYPE 迁移时写死）与单次触碰前分数。
var _combo_score_base: int = 0
var _combo_touch_score_before: int = 0


func _assert_combo_chain() -> void:
	# 连击链：base(时钟触后) → 三次稀有触碰，combo 逐触 +1；加成 = combo-1（≥2 起）。
	for i: int in _combo_gains.size():
		var combo: int = _combo_base + i + 1
		var expected: int = GameState.gain_for("rare", combo)
		if _combo_gains[i] != expected:
			_failures.append("Combo 加成 FAIL：第 %d 连触碰稀有物 +%d，期望 +%d（combo=%d，加成口径不一致）" % [
				combo, _combo_gains[i], expected, combo,
			])
	if GameState.combo_count != _combo_base + 3:
		_failures.append("Combo 递增 FAIL：combo_count=%d 期望 %d（窗口内连击未逐触 +1）" % [
			GameState.combo_count, _combo_base + 3,
		])
	var combo_label := get_tree().root.find_child("ComboLabel", true, false) as Label
	if combo_label == null or not combo_label.visible:
		_failures.append("连击 UI 未显示（ComboLabel 未随 combo ≥2 置可见，视觉反馈缺失）")


## ── v3 阶段：磁铁道具（范围内目标被吸到判定距离并真实收集）──
func _magnet_step() -> void:
	if _phase_frames == 1:
		_main_node._clear_collectibles()
		_magnet_target = _main_node._spawn_collectible("normal")
		# 摆在判定距离(44.8px)外、磁铁半径(100px)内：不吸则永远收不到，吸到即收集。
		_magnet_target.global_position = _player.global_position + Vector2(MAGNET_TEST_DISTANCE, 0.0)
		_magnet_score_before = GameState.score
		_player.activate_magnet()  # 道具真实生效入口（拾取路径调用的同一函数）
	elif not is_instance_valid(_magnet_target):
		# 提前退出：目标已在本帧前被吸入判定距离并真实收集（拉速内早于 cap 完成，v4 帧预算
		# 收敛）——断言集与 cap 兜底路径完全一致，只是达成即走，不等满 cap。
		if not _player.is_magnet_active():
			_failures.append("磁铁生效状态 FAIL：吸入完成时 is_magnet_active 已变 false（MAGNET_DURATION 计时异常）")
		if GameState.score != _magnet_score_before + 1:
			_failures.append("磁铁收集计分 FAIL：score %d → %d，期望恰好 +1" % [
				_magnet_score_before, GameState.score,
			])
		_to_phase(SmokePhase.BOOST)
	elif _phase_frames >= MAGNET_MAX_FRAMES:
		if not _player.is_magnet_active():
			_failures.append("磁铁生效状态 FAIL：%d 帧（%.1fs）内 is_magnet_active 已变 false（MAGNET_DURATION 计时异常）" % [
				MAGNET_MAX_FRAMES, float(MAGNET_MAX_FRAMES) / 60.0,
			])
		var collected: bool = not is_instance_valid(_magnet_target)
		if not collected:
			_failures.append("磁铁 FAIL：范围内目标 %d 帧后未被吸入判定距离（吸附效果未生效或拉速不足）" % MAGNET_MAX_FRAMES)
		if GameState.score != _magnet_score_before + 1:
			_failures.append("磁铁收集计分 FAIL：score %d → %d，期望恰好 +1" % [
				_magnet_score_before, GameState.score,
			])
		_to_phase(SmokePhase.BOOST)


## ── v3 阶段：加速道具（同输入下实测位移 ≥ 基线 ×1.3）──
func _boost_step() -> void:
	if _phase_frames == 1:
		_main_node._clear_collectibles()
		_player.global_position = DIR_CHECK_POSITION
		Input.action_press(&"move_right")
	elif _phase_frames == BOOST_HOLD_FRAMES + 1:
		Input.action_release(&"move_right")
		_boost_base_dx = _player.global_position.x - DIR_CHECK_POSITION.x
		_player.activate_boost()
		if not _player.is_boost_active():
			_failures.append("加速道具未生效（is_boost_active=false）")
	elif _phase_frames == BOOST_HOLD_FRAMES + 2:
		_boost_test_x = _player.global_position.x
		Input.action_press(&"move_right")
	elif _phase_frames >= BOOST_HOLD_FRAMES * 2 + 2:
		Input.action_release(&"move_right")
		var boosted_dx: float = _player.global_position.x - _boost_test_x
		if _boost_base_dx > 0.0 and boosted_dx < _boost_base_dx * BOOST_RATIO_MIN:
			_failures.append("加速 FAIL：基线位移 %.1fpx，加速位移 %.1fpx（未达 ×%.1f，BOOST_MULT 未接线到移速）" % [
				_boost_base_dx, boosted_dx, BOOST_RATIO_MIN,
			])
		_player.clear_powerups()
		_to_phase(SmokePhase.PAUSE)


## ── v3 阶段：暂停 / 恢复（P 键暂停冻结时限，确认恢复）──
func _pause_step() -> void:
	if _phase_frames == 1:
		_press_action(&"pause")
	elif _phase_frames == 3:
		if GameState.phase != GameState.Phase.PAUSED:
			_failures.append("暂停 FAIL：按 P 后 phase=%s（pause 动作 → pause_game 路径断裂）" % _phase_label(GameState.phase))
		var pause_label := get_tree().root.find_child("PauseLabel", true, false) as Control
		if pause_label == null or not pause_label.visible:
			_failures.append("暂停提示未显示（PauseLabel 未随 PAUSED 置可见）")
		_press_action(&"pause")  # 再按一次 P 应恢复（对称语义）
	elif _phase_frames >= SETTLE_FRAMES + 2:
		if GameState.phase != GameState.Phase.RUNNING:
			_failures.append("恢复 FAIL：再按 P 后 phase=%s（resume_game 未被触发）" % _phase_label(GameState.phase))
		_to_phase(SmokePhase.DIFFICULTY)


## ── v3 断言：调参协议（新声明键可应用/钳制、未声明键拒绝，SKILL.md §3C）──
func _assert_v3_tuning_protocol() -> void:
	var applied: Array[String] = GameState.apply_tuning({"COMBO_WINDOW": 999.0})
	if not applied.has("COMBO_WINDOW") or not is_equal_approx(GameState.COMBO_WINDOW, 5.0):
		_failures.append("调参协议 FAIL：COMBO_WINDOW=999 未按 TUNING_META max=5 钳制（实际 %.2f）" % GameState.COMBO_WINDOW)
	applied = GameState.apply_tuning({"NOT_A_REAL_KEY": 1.0})
	if not applied.is_empty():
		_failures.append("调参协议 FAIL：未声明键 NOT_A_REAL_KEY 被应用（apply_tuning 必须拒绝未知键）")
	# 还原默认值：调参断言不得污染后续阶段（此处已是收尾阶段，恢复出厂语义）。
	GameState.apply_tuning({"COMBO_WINDOW": 2.0})


## ── v3 断言：音效库完备 + 收集后真的播过声（零音效缺陷闭环机判）──
func _assert_sfx_bank() -> void:
	var sfx := get_tree().root.get_node_or_null("Sfx")
	if sfx == null:
		_failures.append("音效 FAIL：autoload Sfx 未注册（project.godot [autoload] 缺失）")
		return
	var names: Array[StringName] = sfx.registered_names()
	if names.size() < SFX_BANK_MIN:
		_failures.append("音效 FAIL：Sfx 库仅注册 %d 种（期望 ≥%d）：%s" % [
			names.size(), SFX_BANK_MIN, ", ".join(names),
		])
	var played: int = sfx.played_count
	if played < 1:
		_failures.append("音效 FAIL：全程 50+ 次真实触碰后 played_count=%d（收集音效未接线）" % played)


## 难度梯度断言：以本局收集数为自变量，刷新间隔/物品寿命单调收紧且收敛到下限。
func _assert_difficulty_curve() -> void:
	var saved_score: int = GameState.score
	var last_interval: float = INF
	var last_lifetime: float = INF
	for k: int in [0, 5, 10, 15, GameState.TARGET_SCORE - 1]:
		GameState.score = k
		var interval: float = GameState.spawn_interval_now()
		var lifetime: float = GameState.collectible_lifetime_now()
		if interval > last_interval + 0.0001:
			_failures.append("难度梯度不单调：score=%d 时刷新间隔 %.3f 比低难度 %.3f 更宽松" % [
				k, interval, last_interval,
			])
		if lifetime > last_lifetime + 0.0001:
			_failures.append("难度梯度不单调：score=%d 时物品寿命 %.3f 比低难度 %.3f 更长" % [
				k, lifetime, last_lifetime,
			])
		last_interval = interval
		last_lifetime = lifetime
	GameState.score = 0
	if not is_equal_approx(GameState.spawn_interval_now(), GameState.SPAWN_INTERVAL_START):
		_failures.append("开局刷新间隔应等于 SPAWN_INTERVAL_START，实际 %.3f" % GameState.spawn_interval_now())
	if not is_equal_approx(GameState.collectible_lifetime_now(), GameState.LIFETIME_START):
		_failures.append("开局物品寿命应等于 LIFETIME_START，实际 %.3f" % GameState.collectible_lifetime_now())
	GameState.score = GameState.TARGET_SCORE - 1
	if not is_equal_approx(GameState.spawn_interval_now(), GameState.SPAWN_INTERVAL_MIN):
		_failures.append("满难度刷新间隔应收敛到 SPAWN_INTERVAL_MIN，实际 %.3f" % GameState.spawn_interval_now())
	if not is_equal_approx(GameState.collectible_lifetime_now(), GameState.LIFETIME_MIN):
		_failures.append("满难度物品寿命应收敛到 LIFETIME_MIN，实际 %.3f" % GameState.collectible_lifetime_now())
	# ── v3 波次口径（①4）：波次下标按分数切分、曲线全局单调已由上方采样覆盖 ──
	var third: int = maxi(GameState.TARGET_SCORE / 3, 1)
	var two_thirds: int = maxi(GameState.TARGET_SCORE * 2 / 3, third + 1)
	if GameState.wave_index_for(0) != 0:
		_failures.append("波次切分 FAIL：score=0 应为第 1 波，实际下标 %d" % GameState.wave_index_for(0))
	if GameState.wave_index_for(third) != 1:
		_failures.append("波次切分 FAIL：score=%d 应进入第 2 波，实际下标 %d" % [third, GameState.wave_index_for(third)])
	if GameState.wave_index_for(two_thirds) != 2:
		_failures.append("波次切分 FAIL：score=%d 应进入第 3 波，实际下标 %d" % [two_thirds, GameState.wave_index_for(two_thirds)])
	# 波次权重表：逐波合计 1.0、rare 权重逐波不降（高强度波高分物更多）。
	var last_rare_weight: float = -1.0
	for wave: int in 3:
		var weights := GameState.wave_weights(wave)
		var total_weight: float = 0.0
		for kind: String in weights:
			total_weight += float(weights[kind])
		if absf(total_weight - 1.0) > 0.001:
			_failures.append("波次权重 FAIL：第 %d 波权重合计 %.4f != 1.0（刷出分布不可信）" % [wave + 1, total_weight])
		var rare_weight: float = float(weights.get("rare", 0.0))
		if rare_weight < last_rare_weight - 0.0001:
			_failures.append("波次权重 FAIL：rare 权重第 %d 波 %.3f 比前一波 %.3f 更低（梯度应单调不降）" % [
				wave + 1, rare_weight, last_rare_weight,
			])
		last_rare_weight = rare_weight
	# pick_kind 纯函数：roll=0 必为表中首键（normal），roll 越界兜底 normal。
	if GameState.pick_kind(0, 0.0) != "normal":
		_failures.append("pick_kind FAIL：roll=0 应选中 normal，实际 %s" % GameState.pick_kind(0, 0.0))
	GameState.score = saved_score


func _assert_touch_ledger() -> void:
	if _touch_count != 50:
		_failures.append("连续触碰判定总数 %d != 50（验收基线 2：连续收集 50 次一致性断言未跑满）" % _touch_count)


## 方向符号断言：expected_sign=-1 断言 A/←（move_left）输入后 x 较基准**减小**；
## expected_sign=+1 断言 D/→（move_right）输入后 x 较基准**增大**。
## 判定 = 符号正确 且 |Δx| ≥ MIN_MOVE_DISTANCE（同「真的动了」口径）。
## 任一方向符号反了（如 ← 后 x 增大）→ 带方向签名的 FAIL，需求 cmuktc8jk000hm97zm6l1gp4u。
func _assert_direction_sign(expected_sign: int) -> void:
	if _player == null:
		return
	var delta: float = _player.global_position.x - _dir_base_x
	_dir_base_x = _player.global_position.x
	if expected_sign < 0 and delta > -MIN_MOVE_DISTANCE:
		_failures.append(
			"方向符号断言 FAIL：模拟 A/← 输入 %d 帧后 position.x 未减小（Δx=%+.1fpx，期望 ≤-%.0fpx）—— 方向反向或移动未生效" % [
				DIR_HOLD_FRAMES, delta, MIN_MOVE_DISTANCE,
			]
		)
	elif expected_sign > 0 and delta < MIN_MOVE_DISTANCE:
		_failures.append(
			"方向符号断言 FAIL：模拟 D/→ 输入 %d 帧后 position.x 未增大（Δx=%+.1fpx，期望 ≥+%.0fpx）—— 方向反向或移动未生效" % [
				DIR_HOLD_FRAMES, delta, MIN_MOVE_DISTANCE,
			]
		)


## v2 手感基线断言（需求 cmuqmej89000ym9gg6mom93o0）：
## ① 体型倍率落在 1.3~1.5 区间；② 移速落在 v1(220) 的 60~70% 区间；
## ③ 倍率真的接线到节点：根缩放、碰撞体与 PickupArea 判定体的全局缩放都等于数值键
##   （「数值键写了但没接上」的集成断言，与难度梯度 SpawnTimer 断言同口径）。
func _assert_v2_tuning() -> void:
	if GameState.PLAYER_SCALE < V2_SCALE_MIN or GameState.PLAYER_SCALE > V2_SCALE_MAX:
		_failures.append("v2 手感断言 FAIL：体型倍率 %.2f 不在 %.1f~%.1f 区间（需求 cmuqmej89000ym9gg6mom93o0：整体放大约 1.3~1.5 倍）" % [
			GameState.PLAYER_SCALE, V2_SCALE_MIN, V2_SCALE_MAX,
		])
	if GameState.PLAYER_SPEED < V2_SPEED_MIN or GameState.PLAYER_SPEED > V2_SPEED_MAX:
		_failures.append("v2 手感断言 FAIL：移速 %.1fpx/s 不在 v1 默认 %.0f 的 60%%~70%% 区间 [%.1f, %.1f]" % [
			GameState.PLAYER_SPEED, V1_SPEED, V2_SPEED_MIN, V2_SPEED_MAX,
		])
	if _player == null:
		return  # Player 缺失已由 _ready 断言上报，这里不重复计失败
	_assert_node_scaled(_player, "Player 根节点")
	_assert_node_scaled(_player.get_node_or_null("CollisionShape2D") as Node2D, "碰撞体 CollisionShape2D")
	_assert_node_scaled(_player.get_node_or_null("PickupArea/PickupShape") as Node2D, "拾取判定体 PickupArea/PickupShape")


## 单节点缩放接线断言：全局缩放必须等于数值区 PLAYER_SCALE（uniform 同步放大）。
func _assert_node_scaled(node: Node2D, label: String) -> void:
	if node == null:
		_failures.append("v2 手感断言 FAIL：场景树找不到 %s（体型放大接线目标缺失）" % label)
		return
	var expected: Vector2 = Vector2.ONE * GameState.PLAYER_SCALE
	if not node.global_transform.get_scale().is_equal_approx(expected):
		_failures.append("v2 手感断言 FAIL：%s 全局缩放 %s 与数值区 PLAYER_SCALE %.2f 不同步（放大量未接线到节点）" % [
			label, node.global_transform.get_scale(), GameState.PLAYER_SCALE,
		])


func _assert_collected() -> void:
	if not _score_seen:
		_failures.append("收集判定未生效：触碰后 GameState.score_changed 未到达订阅方（PickupArea 分组/碰撞层或 Collectible 接线断裂）")
	# 首触固定普通物 + combo=1（无加成）→ 恰好 +1：钉死 v1 验收基线的计分口径。
	if GameState.score != 1:
		_failures.append("收集计数 FAIL：普通物首触后 score=%d，期望恰好 +1（验收基线 2：触碰即 +1）" % GameState.score)
	if _collect_target != null and is_instance_valid(_collect_target):
		_failures.append("被收集的物品没有消失：触碰后 Collectible 仍在场景树（回收逻辑未执行）")
	var sfx := get_tree().root.get_node_or_null("Sfx")
	if sfx != null and sfx.played_count < 1:
		_failures.append("收集音效未播放：触碰后 Sfx.played_count=%d（音效反馈未接线，零音效缺陷复现）" % sfx.played_count)


## 首次收集后的集成断言：难度梯度真的接到了 SpawnTimer（间隔比开局值更紧）。
func _assert_spawn_tightened() -> void:
	var timer := get_tree().root.find_child("SpawnTimer", true, false) as Timer
	if timer != null and timer.wait_time >= GameState.SPAWN_INTERVAL_START:
		_failures.append("收集后刷新间隔未随难度收紧：wait_time=%.3f 仍为开局值（难度梯度未接线到 SpawnTimer）" % [
			timer.wait_time,
		])


func _assert_time_warning() -> void:
	var hud := _hud_label()
	if hud == null:
		_failures.append("场景树找不到 HudLabel（main.tscn 缺少 HUD 标签）")
		return
	var color: Color = hud.get_theme_color("font_color")
	if not color.is_equal_approx(TIME_WARN_COLOR):
		_failures.append("限时尾段 HUD 未进入红色警示（实际颜色 %s，低时反馈缺失）" % color)


func _assert_settled(expect_win: bool) -> void:
	var expected_phase: int = GameState.Phase.WON if expect_win else GameState.Phase.LOST
	if GameState.phase != expected_phase:
		_failures.append("胜负判定不可达：预期 phase=%s 实际 %s（触碰计分/tick_time 判定路径断裂）" % [
			"WIN" if expect_win else "LOST", _phase_label(GameState.phase),
		])
	var panel := _result_panel()
	if panel == null or not panel.visible:
		_failures.append("%s 后结算面板未弹出（ResultPanel 未随 phase_changed 显示）" % [
			"通关" if expect_win else "限时归零",
		])
	var label := _result_label()
	if label != null and expect_win and not label.text.contains("通关"):
		_failures.append("结算面板文案缺少「通关」（ResultLabel 未随胜利刷新）")
	if label != null and not expect_win and not label.text.contains("时间到"):
		_failures.append("结算面板文案缺少「时间到」（ResultLabel 未随失败刷新）")


func _assert_restarted() -> void:
	if GameState.phase != GameState.Phase.RUNNING:
		_failures.append("一键重开未生效：确认键后 phase=%s（_restart_run 未被触发或 start_run 未复位）" % _phase_label(GameState.phase))
	if GameState.score != 0:
		_failures.append("一键重开未清零计数：score=%d（验收基线 3：重开必须复位）" % GameState.score)
	if GameState.time_left < GameState.TIME_LIMIT - 1.0:
		_failures.append("一键重开未复位时限：time_left=%.2f（start_run 未恢复 TIME_LIMIT）" % GameState.time_left)
	if _player != null and _player.global_position.distance_to(_origin) > 1.0:
		_failures.append("一键重开未把牛牛归位：偏移 %.2fpx（_restart_run 未重置位置）" % _player.global_position.distance_to(_origin))
	var panel := _result_panel()
	if panel != null and panel.visible:
		_failures.append("一键重开后结算面板仍然可见（面板未随 RUNNING 隐藏）")
	if _collectible_count() < GameState.MAX_COLLECTIBLES:
		_failures.append("一键重开后可收集物未铺满：%d/%d（_fill_collectibles 未在重开时执行）" % [
			_collectible_count(), GameState.MAX_COLLECTIBLES,
		])
	if not is_equal_approx(GameState.spawn_interval_now(), GameState.SPAWN_INTERVAL_START):
		_failures.append("一键重开后难度梯度未复位：刷新间隔 %.3f != 开局值 %.3f" % [
			GameState.spawn_interval_now(), GameState.SPAWN_INTERVAL_START,
		])
	if GameState.wave_index != 0:
		_failures.append("一键重开后波次未复位：wave_index=%d（start_run 未归零，v3 波次节奏跨局泄漏）" % GameState.wave_index)
	if GameState.combo_count != 0:
		_failures.append("一键重开后连击未清零：combo_count=%d（断链/重开清零规则失效）" % GameState.combo_count)


func _assert_persistence_roundtrip() -> void:
	# 先把当前内存态落盘：v3 的 MULTITYPE/COMBO/MAGNET 断言阶段发生在最后一次结算存盘之后，
	# 收集数领先磁盘值属正常游戏语义（存盘时机 = 每局结算）——这里验证「落盘 → 回读一致」。
	GameState.save_progress()
	var before_best: int = GameState.best_score
	var before_total: int = GameState.total_collected
	var before_combo: int = GameState.best_combo
	GameState.best_score = -7
	GameState.total_collected = -7
	GameState.best_combo = -7
	GameState.load_progress()
	if GameState.best_score != before_best:
		_failures.append("持久化回读不一致：best_score 落盘值 %d，回读 %d（验收基线 4：退出重进数据不得丢失）" % [
			before_best, GameState.best_score,
		])
	if GameState.total_collected != before_total:
		_failures.append("持久化回读不一致：total_collected 落盘值 %d，回读 %d（验收基线 4）" % [
			before_total, GameState.total_collected,
		])
	if GameState.best_combo != before_combo:
		_failures.append("持久化回读不一致：best_combo 落盘值 %d，回读 %d（v3 档案字段丢失）" % [
			before_combo, GameState.best_combo,
		])


func _assert_respawn_and_expiry() -> void:
	if not _respawn_seen:
		_failures.append("生成器未自动补充可收集物（SpawnTimer timeout → _fill_collectibles 路径断裂）")
	if _expire_target != null and is_instance_valid(_expire_target):
		_failures.append("过期物品未被回收：寿命耗尽后仍存活（expired → 回收接线断裂）")
	if GameState.score != 0:
		_failures.append("过期/静置期间计数发生变化：score=%d（过期不得计分，验收基线 2）" % GameState.score)
	if _collectible_count() < GameState.MAX_COLLECTIBLES - 1:
		_failures.append("自动补充后场上物品不足：%d（期望 ≥%d）" % [
			_collectible_count(), GameState.MAX_COLLECTIBLES - 1,
		])


## 首触布置：挑一个富余寿命的物品、停走其余、把目标物品摆到牛牛脚下 ——
## 与 MASS 阶段同一套确定性摆放（物品→玩家，物理重叠对称），保证首触也是单触单收。
## ⚠️ 必须移动「物品」而不是「玩家」：玩家每帧被 PLAY_RECT 钳制，传送到钳制区外的
## 停靠点会在下一物理帧被拉回，物品停在 113px 外永不重叠（实测 score 恒 0 假失败）。
func _place_target_under_player() -> void:
	if _player == null:
		return
	var container := get_tree().root.find_child("Collectibles", true, false)
	if container == null:
		_failures.append("场景树找不到 Collectibles 容器（main.tscn 缺少生成器容器节点）")
		return
	# 首触固定普通物：钉死「普通物触碰恰好 +1」的验收基线口径（combo=1 无加成）。
	var target := _pick_fresh_collectible("normal")
	if target == null and _main_node != null:
		target = _main_node._spawn_collectible("normal")
	if target == null:
		_failures.append("场上没有剩余寿命充足的可收集物（collectible.tscn 未被生成器实例化）")
		return
	_park_all_others(target)
	_collect_target = target
	target.global_position = _player.global_position


func _collectible_count() -> int:
	var container := get_tree().root.find_child("Collectibles", true, false)
	if container == null:
		return 0
	var count: int = 0
	for child in container.get_children():
		if child is Collectible:
			count += 1
	return count


func _result_panel() -> Panel:
	return get_tree().root.find_child("ResultPanel", true, false) as Panel


func _result_label() -> Label:
	return get_tree().root.find_child("ResultLabel", true, false) as Label


func _hud_label() -> Label:
	return get_tree().root.find_child("HudLabel", true, false) as Label


func _phase_label(phase: int) -> String:
	return ["RUNNING", "WON", "LOST"][clampi(phase, 0, 2)]


## 噪声相位：确定种子随机事件（同种子同事件序，门禁可复现）。
func _inject_noise_frame() -> void:
	if _total_frames == 1:
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


## 键位契约断言：目标键表 → project.godot [input] 的 physical_keycode（逐键 AND）。
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


func _report() -> void:
	if _failures.is_empty():
		# 帧耗台账：供预算收敛核对（套件必须在门禁 --quit-after 兜底内完整跑完，
		# 被截杀 = 既无 PASS 也无 FAIL 的假失败）。
		var ledger_parts: PackedStringArray = []
		for phase_name: String in SmokePhase.keys():
			var phase_key: int = SmokePhase[phase_name]
			if _phase_frames_ledger.has(phase_key):
				ledger_parts.append("%s=%d" % [phase_name, _phase_frames_ledger[phase_key]])
		print("[smoke] 帧耗台账 合计=%d %s" % [_total_frames, " ".join(ledger_parts)])
		print("GODOT_SMOKE: PASS 场景实例化/输入映射/移动方向符号(A/←减小,D/→增大)/收集判定/50 连击一致性/波次梯度/过期回收/胜负/一键重开/持久化/v2手感基线(体型1.3~1.5x·移速60~70%)/v3扩展(开始面板·多类型计分·Combo·磁铁·加速·暂停·波次切分·音效闭环)/v4多帧动画·震屏相机 全部通过")
		get_tree().quit(0)
	else:
		for failure in _failures:
			printerr("GODOT_SMOKE: FAIL %s" % failure)
		get_tree().quit(1)


func _on_player_moved(_position: Vector2) -> void:
	_moved_seen = true


func _on_score_changed(_score: int) -> void:
	_score_seen = true


func _on_main_spawn_timer_timeout() -> void:
	_respawn_seen = true


## ── v4 断言：角色多帧动画（需求 cmv7hnfx3000ojofistqwry8l ②1，替代 v3 单精灵呼吸/缩放）──

## 装配断言：Anim 节点存在、SpriteFrames 含 idle/move/collect 三组、每组 ≥2 帧（帧资源入库可核验）。
func _assert_multiframe_anim_setup() -> void:
	_anim_node = _player.get_node_or_null("Anim") as AnimatedSprite2D
	if _anim_node == null:
		_failures.append("多帧动画 FAIL：player.tscn 缺少 AnimatedSprite2D 节点 Anim（角色仍是静态贴图/多边形拼装）")
		return
	var frames: SpriteFrames = _anim_node.sprite_frames
	if frames == null:
		_failures.append("多帧动画 FAIL：Anim 节点未配置 SpriteFrames")
		return
	var names := frames.get_animation_names()
	for required: StringName in [&"idle", &"move", &"collect"]:
		if not names.has(required):
			_failures.append("多帧动画 FAIL：SpriteFrames 缺少动画组 %s（需 idle/move/collect 三组）" % required)
		elif frames.get_frame_count(required) < 2:
			_failures.append("多帧动画 FAIL：动画组 %s 仅 %d 帧（多帧序列要求 ≥2 帧）" % [
				required, frames.get_frame_count(required)])


## 运行期断言：当前动画处于期望态（位移态随输入实时切换的机判口径）。
func _assert_anim_is(expected: StringName) -> void:
	if _anim_node == null:
		return
	if _anim_node.animation != expected:
		_failures.append("多帧动画 FAIL：位移保持中当前动画=%s 期望=%s（动画状态机未随输入切换）" % [
			_anim_node.animation, expected])


## 收集庆祝动画的观测断言（SETTLE1 收口核对；只看出现过，不钉播放帧）。
func _assert_collect_anim_seen() -> void:
	if not _saw_collect_anim:
		_failures.append("多帧动画 FAIL：整段收集流程未观测到 collect 庆祝动画（play_collect 未接线到收集结果事件）")
