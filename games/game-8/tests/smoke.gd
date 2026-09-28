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
## 覆盖面（模板五项断言逐项保留 + 收集玩法与难度梯度的机判断言）：
##   1. 场景可实例化（main.tscn → player.tscn / collectible.tscn 接线未断裂）
##   2. autoload 已注册且带约定信号
##   3. InputMap 动作已注册、物理键绑定正确（键位契约），注入输入后牛牛真的动了，
##      且移动方向符号正确：A/← 输入后 position.x 减小、D/→ 输入后 position.x 增大
##      （需求 cmuktc8jk000hm97zm6l1gp4u 基线：方向反向即 FAIL）
##   4. 信号真的到达订阅方（Player.moved / GameState.score_changed）
##   5. 收集判定：触碰后物品消失且计数 +1（需求验收基线 2）
##   6. 连续 50 次触碰判定一致性：跨 3 局累计 50 次真实触碰，每次恰好 +1（验收基线 2）
##      含反例：清空场地静置，计数必须保持 0（无误判）
##   7. 难度梯度：刷新间隔/物品寿命随本局收集数单调收紧、有界；首收后 SpawnTimer 真的变快
##   8. 物品过期：寿命耗尽自动回收且不计分（expired → 回收接线）
##   9. 通关可达：第 20 次触碰 → phase=WON + 结算面板「通关」（验收基线 3）
##  10. 失败可达：限时归零 → phase=LOST + 结算面板「时间到」+ HUD 红色警示（验收基线 3）
##  11. 一键重开：结算后按确认 → 计数/时限/位置/面板/难度节奏全部复位（验收基线 3）
##  12. 持久化：最高分与累计进度落盘后回读一致（验收基线 4）
##
## ⚠️ 输入注入分阶段互不重叠（references/error-signatures.md E-08）：
##   `Input.action_press()` 与 `Input.parse_input_event()` 同帧混用会互相冲掉，必须分帧。

## ── 噪声相位：确定种子对抗输入（悬挂手势/孤儿释放/乱键），断言仍全过 = 输入管线没被楔死 ──
const NOISE_FRAMES: int = 24
## 阶段一（方向符号断言）：单方向持续按住的物理帧数。
## 220px/s ≈ 3.67px/物理帧 → 6 帧 ≈ 18~22px 位移，远超 MIN_MOVE_DISTANCE 且帧开销极小
## （A/← 与 D/→ 背靠背共 13 帧，对照原先单向 11 帧，只多 2 帧，保住 240 帧预算）。
const DIR_HOLD_FRAMES: int = 6
## 方向符号断言基准点：视口正中（640x360）。距左右边各 300px，双向 ~20px 位移
## 不会触 PLAY_RECT(20px 边距) 钳制 —— 钳制会吃掉位移、把方向断言打成假失败。
const DIR_CHECK_POSITION: Vector2 = Vector2(320.0, 180.0)
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
## 大批量收集时，非目标物品的统一停放点：
## 必须在牛牛可达区（PLAY_RECT 钳制 [20..620, 20..340]）之外，且距可达区最近点 >36px
## （拾取判定 = 玩家半径 22 + 物品半径 14；(700,420) 距可达角 (620,340) ≈113px = 3 倍余量）。
## 旧值 (620,340) 恰好压在钳制角上（距离 0）：目标刷点一靠近，传送即整堆误收（实测 score 单触 +6）。
## 每次只把目标物品摆到牛牛脚下、其余全部停走 → 单触单收确定性，50 连击不被双收污染。
const PARK_POSITION: Vector2 = Vector2(700.0, 420.0)
## 整体帧预算兜底（超过直接判失败，防死循环；smoke.sh 另有 --quit-after 兜底）。
const TOTAL_FRAME_BUDGET: int = 600
## 判定「真的移动了」的最小位移（像素）。
const MIN_MOVE_DISTANCE: float = 1.0
## HUD 低时警示色（与 main.gd TIME_WARN 覆写保持一致）。
const TIME_WARN_COLOR: Color = Color(1.0, 0.35, 0.3)
## 失败阶段先落入的警示观察点（秒）：低于 main.gd 的 TIME_WARN_SECONDS(10) 即变红。
const TIME_WARN_CHECK_SECONDS: float = 9.0

const REQUIRED_ACTIONS: Array[StringName] = [
	&"move_left", &"move_right", &"move_up", &"move_down", &"confirm",
]

## 键位契约：动作 → 键表承诺的物理键，必须全部绑定（逐键 AND，见模板注释）。
const KEY_CONTRACT: Dictionary = {
	&"move_left": [KEY_A, KEY_LEFT],
	&"move_right": [KEY_D, KEY_RIGHT],
	&"move_up": [KEY_W, KEY_UP],
	&"move_down": [KEY_S, KEY_DOWN],
	&"confirm": [KEY_SPACE, KEY_ENTER],
}

## 冒烟阶段状态机。
## 触碰台账：COLLECT 1 次 + MASS1 至 20（本局通关触）+ MASS2 至 40（二局通关触）
## + MASS3 至 50（第三局不触发通关）＝ 验收基线 2 的「连续收集 50 次」。
enum SmokePhase {
	NOISE, MOVE, COLLECT, MASS1, SETTLE1, RESTART1, MASS2, SETTLE2, RESTART2,
	MASS3, LOSE, RESTART3, RESPAWN_EXPIRE, DIFFICULTY, PERSIST, DONE,
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

## 噪声相位：确定种子随机事件（原始事件，不含 InputEventAction）。
var _noise_rng := RandomNumberGenerator.new()


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


func _physics_process(_delta: float) -> void:
	if _finished:
		return
	_total_frames += 1
	_phase_frames += 1
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
				_to_phase(SmokePhase.MOVE)
		SmokePhase.MOVE:
			# 方向符号断言（需求 cmuktc8jk000hm97zm6l1gp4u 基线）：
			# A/← 输入后 position.x 必须减小，D/→ 输入后必须增大 —— 以输入前后 x 符号差判定。
			# 布置帧先把牛牛瞬移到视口正中（双方位移都不触边钳制）、把在场物品停走
			# （杜绝 13 帧窗口内顺路收集污染判定），再背靠背注入 ← / → 两个方向。
			if _phase_frames == 1:
				_park_all_others(null)
				# _advance_phase 只在零失败时推进（_physics_process 已守卫），此处 _player 必非空。
				_player.global_position = DIR_CHECK_POSITION
				_dir_base_x = _player.global_position.x
				Input.action_press(&"move_left")
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
		SmokePhase.DIFFICULTY:
			_assert_difficulty_curve()
			_to_phase(SmokePhase.PERSIST)
		SmokePhase.PERSIST:
			_assert_touch_ledger()
			_assert_persistence_roundtrip()
			_to_phase(SmokePhase.DONE)
		SmokePhase.DONE:
			_report()


func _to_phase(next_phase: SmokePhase) -> void:
	_phase = next_phase
	_phase_frames = 0


## 大批量收集步进：奇帧补给 + 把目标物品摆到牛牛脚下，偶帧断言「恰好 +1」。
## 补给走 main 的真实生成路径（_fill_collectibles → _spawn_collectible），
## 判定走真实 Area2D 重叠路径；摆放只决定「哪一个物品被触碰」，不为测试另开判定旁路。
func _mass_step(end_touch: int, next_phase: SmokePhase) -> void:
	if _phase_frames % 2 == 1:
		_awaiting_touch = false
		if _main_node != null:
			_main_node._fill_collectibles()
		var target := _pick_fresh_collectible()
		if target != null:
			_park_all_others(target)
			_score_before_touch = GameState.score
			target.global_position = _player.global_position
			_awaiting_touch = true
	elif _awaiting_touch:
		_awaiting_touch = false
		if GameState.score != _score_before_touch + 1:
			_failures.append("第 %d 次触碰判定不一致：触碰前 score=%d 触碰后 %d，期望恰好 +1（验收基线 2：连续 50 次无误判/漏判）" % [
				_touch_count + 1, _score_before_touch, GameState.score,
			])
			return
		_touch_count += 1
		if _touch_count >= end_touch:
			_to_phase(next_phase)


## 挑一个还有富余寿命的可收集物（剩余 >1s）：杜绝「摆上去同帧过期被释放」的竞态。
func _pick_fresh_collectible() -> Collectible:
	var container := get_tree().root.find_child("Collectibles", true, false)
	if container == null:
		return null
	for child in container.get_children():
		var collectible := child as Collectible
		if collectible != null and not collectible.is_queued_for_deletion() \
				and collectible.remaining_lifetime() > 1.0:
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
func _respawn_expire_step() -> void:
	if _phase_frames == 1:
		_respawn_seen = false
		if _main_node != null:
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
		_to_phase(SmokePhase.DIFFICULTY)
	elif _phase_frames >= RESPAWN_MAX_FRAMES:
		if not _respawn_seen:
			_failures.append("生成器未在 %d 帧内自动补充（SpawnTimer timeout 未触发 _fill_collectibles）" % [
				RESPAWN_MAX_FRAMES,
			])
		if not expiry_done:
			_failures.append("过期物品未被回收：寿命耗尽后仍存活（expired → 回收接线断裂）")


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


func _assert_collected() -> void:
	if not _score_seen:
		_failures.append("收集判定未生效：触碰后 GameState.score_changed 未到达订阅方（PickupArea 分组/碰撞层或 Collectible 接线断裂）")
	if GameState.score < 1:
		_failures.append("收集计数未 +1：触碰可收集物后 score=%d（验收基线 2：计数与判定必须一致）" % GameState.score)
	if _collect_target != null and is_instance_valid(_collect_target):
		_failures.append("被收集的物品没有消失：触碰后 Collectible 仍在场景树（回收逻辑未执行）")


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


func _assert_persistence_roundtrip() -> void:
	var before_best: int = GameState.best_score
	var before_total: int = GameState.total_collected
	GameState.best_score = -7
	GameState.total_collected = -7
	GameState.load_progress()
	if GameState.best_score != before_best:
		_failures.append("持久化回读不一致：best_score 落盘值 %d，回读 %d（验收基线 4：退出重进数据不得丢失）" % [
			before_best, GameState.best_score,
		])
	if GameState.total_collected != before_total:
		_failures.append("持久化回读不一致：total_collected 落盘值 %d，回读 %d（验收基线 4）" % [
			before_total, GameState.total_collected,
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
	var target := _pick_fresh_collectible()
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
	var pos := Vector2(_noise_rng.randf_range(0, 640), _noise_rng.randf_range(0, 360))
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
		print("GODOT_SMOKE: PASS 场景实例化/输入映射/移动方向符号(A/←减小,D/→增大)/收集判定/50 连击一致性/难度梯度/过期回收/胜负/一键重开/持久化 全部通过")
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
