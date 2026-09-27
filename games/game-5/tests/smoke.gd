extends Node
## game-5 无头冒烟（tests/smoke.tscn）—— 判定协议与模板一致：
##   通过 → stdout `GODOT_SMOKE: PASS ...` 且退出码 0；失败 → stderr `GODOT_SMOKE: FAIL <原因>` 退出码 1。
##
## 断言覆盖（任务四项 + 知识 6e91a11d §七 验收映射 + 迭代反馈三项）：
##   玩家能移动        → 键盘注入位移 ≥ 阈值 + Player.moved 信号送达（验收 2 前半）
##   边界不越界        → 贴边持续右移后坐标 == clamp 边界值（验收 2 后半）
##   触屏摇杆可用      → 触摸注入按下摇杆 + 斜向拖拽 → 摇杆向量双轴非零、角色双轴位移
##                       （迭代反馈 1，知识 82e419bb E-18/E-19 修复的门禁本体）
##   核心交互生效      → 收集 +10；3s 窗口内第二笔 +15；连击计数 == 2（验收 3）
##   金水果 / 坏水果   → 金 +50（含连击叠加口径）；坏 -15 下限 0 + 减速 debuff，
##                       不进连击、不计收集数（迭代反馈 3）
##   音频门控          → 首手势解锁翻转 / 未解锁记账 / 静音降级 / 幂等解锁（迭代反馈 2，
##                       知识 82e419bb §三：headless 断言协议层，不断言声波）
##   倒计时告警与结算  → 末 5 秒逐秒 tick + 结算 settle（迭代反馈 2）
##   反馈接线成立      → 收集后 Juice.events 非空 + feedback_fired 信号送达（SKILL.md §3B）
##   原木节奏与难度    → 生成间隔 ∈ [2,4)；速度 v(60)=v0、v(30)>v(60)、v(0)=1.8·v0（验收 4）
##   负路径可达        → 碰撞原木 → 失败结算（标题含「原木」）（验收 4 后半）
##   正路径可达        → 时间归零 → 「时间到」结算（验收 1 后半）
##   倒计时逐秒递减    → 实测 1s+ 后 time_left 下降且 HUD 文本变化（验收 1 前半）
##   重开可用（双通道）→ 键盘 confirm 重开；触摸按钮信号链路重开（验收 4/知识 ed31081f）
##   最高分持久化      → 结算后 user:// 存档存在且 best ≥ 本局分（验收 5 无头代理；
##                       Web 端另有 localStorage 镜像，见 GameState）
##
## 输入注入两阶段互不重叠（模板约定，error-signatures E-08）：噪声相位只注入原始事件；
## 行为相位用 Input.action_press/release。相位切换时显式释放全部移动动作，
## 防噪声期的悬挂按键残留污染位移/clamp 断言。

const NOISE_FRAMES: int = 30
const MOVE_FRAMES: int = 10
const CLAMP_FRAMES: int = 30
const COLLECT_FRAMES: int = 7
const LOGS_MOVE_FRAMES: int = 11
const FAIL_FRAMES: int = 6
const RESTART_FRAMES: int = 4
const COUNTDOWN_FRAMES: int = 65
const TIMEUP_FRAMES: int = 8
const TOUCH_FRAMES: int = 4
const JOYSTICK_FRAMES: int = 12
const JOYSTICK_DRAG_FRAME: int = 5
## 摇杆注入用的触点序号（避开噪声相位常用的 0/1，防串扰）。
const JOY_TOUCH_INDEX: int = 5

const MIN_MOVE_DISTANCE: float = 1.0
## 固定种子（门禁要求可复现：同种子同事件序）。
const FRUIT_SEED: int = 20260913
const LOG_SEED: int = 20260914
const NOISE_SEED: int = 20260915

const REQUIRED_ACTIONS: Array[StringName] = [
	&"move_left", &"move_right", &"move_up", &"move_down", &"confirm",
]

## 键位契约（与 project.godot [input] 对齐）：方向键与 WASD 同时承诺（知识 6e91a11d §五）。
const KEY_CONTRACT: Dictionary = {
	&"move_left": [KEY_A, KEY_LEFT],
	&"move_right": [KEY_D, KEY_RIGHT],
	&"move_up": [KEY_W, KEY_UP],
	&"move_down": [KEY_S, KEY_DOWN],
	&"confirm": [KEY_SPACE, KEY_ENTER],
}

enum Phase { NOISE, MOVE, CLAMP, JOYSTICK, COLLECT_1, COLLECT_2, GOLDEN, BAD, AUDIO, LOGS, FAIL, RESTART, COUNTDOWN, TIMEUP, TOUCH, DONE }

var _failures: PackedStringArray = []
var _phase: int = Phase.NOISE
var _phase_frame: int = 0
var _player: Player
var _main: Node2D
var _fruit_spawner: FruitSpawner
var _log_spawner: LogSpawner
var _result_panel: PanelContainer
var _result_title: Label
var _origin: Vector2 = Vector2.ZERO
var _moved_seen: bool = false
var _feedback_seen: bool = false
var _log_a: LogRoller
var _log_b: LogRoller
var _log_a_x: float = 0.0
var _baseline_score: int = 0
var _label_text_at_start: String = ""
var _time_at_start: float = 0.0
var _expected_gain: int = 0
var _fruits_before_bad: int = 0
var _combo_before_bad: int = 0
var _noise_rng := RandomNumberGenerator.new()


func _ready() -> void:
	# headless 无垂直同步：限 60 FPS 让 --quit-after 的兜底有意义（与模板一致）。
	Engine.max_fps = 60

	for action in REQUIRED_ACTIONS:
		if not InputMap.has_action(action):
			_failures.append("InputMap 缺少动作 %s（project.godot [input] 未注册）" % action)
	_check_key_bindings()

	var game_state := get_tree().root.get_node_or_null("GameState")
	if game_state == null:
		_failures.append("autoload GameState 未注册（project.godot [autoload] 缺失）")
	else:
		for signal_name in ["score_changed", "fruits_changed", "combo_changed", "best_changed"]:
			if not game_state.has_signal(signal_name):
				_failures.append("GameState 缺少信号 %s" % signal_name)
		game_state.score_changed.connect(_on_score_changed)

	var juice := get_tree().root.get_node_or_null("Juice")
	if juice == null:
		_failures.append("autoload Juice 未注册（反馈单例缺失，SKILL.md §3B 模板协议）")
	elif not juice.has_signal("feedback_fired"):
		_failures.append("Juice 缺少信号 feedback_fired（playtest 门禁的反馈采样锚点）")
	else:
		juice.feedback_fired.connect(_on_feedback_fired)

	_main = get_tree().root.find_child("Main", true, false) as Node2D
	if _main == null:
		_failures.append("场景树找不到 Main（smoke.tscn 未实例化 main.tscn）")
	else:
		_player = _main.get_node_or_null("Player") as Player
		_fruit_spawner = _main.get_node_or_null("FruitSpawner") as FruitSpawner
		_log_spawner = _main.get_node_or_null("LogSpawner") as LogSpawner
		_result_panel = get_tree().root.find_child("ResultPanel", true, false) as PanelContainer
		_result_title = get_tree().root.find_child("ResultTitle", true, false) as Label
		if _player == null:
			_failures.append("场景树找不到 Player（main.tscn 未实例化 player.tscn）")
		else:
			_player.moved.connect(_on_player_moved)
		if _fruit_spawner == null or _log_spawner == null:
			_failures.append("场景树找不到 FruitSpawner/LogSpawner（main.tscn 装配不完整）")
		if _result_panel == null or _result_title == null:
			_failures.append("场景树找不到结算面板 ResultPanel/ResultTitle")
		# 固定种子重开一局：后续所有断言可复现。
		_main.start_match(FRUIT_SEED, LOG_SEED)
		var count: int = _fruit_spawner.fruit_count() if _fruit_spawner != null else 0
		if count < 8 or count > 12:
			_failures.append("初始铺场 %d 个水果不在 [8,12]（知识 6e91a11d §二）" % count)

	_noise_rng.seed = NOISE_SEED


func _physics_process(_delta: float) -> void:
	if _phase == Phase.DONE:
		return
	_phase_frame += 1
	if not _failures.is_empty():
		_report()
		return
	match _phase:
		Phase.NOISE:
			_phase_noise()
		Phase.MOVE:
			_phase_move()
		Phase.CLAMP:
			_phase_clamp()
		Phase.JOYSTICK:
			_phase_joystick()
		Phase.COLLECT_1:
			_phase_collect_1()
		Phase.COLLECT_2:
			_phase_collect_2()
		Phase.GOLDEN:
			_phase_golden()
		Phase.BAD:
			_phase_bad()
		Phase.AUDIO:
			_phase_audio()
		Phase.LOGS:
			_phase_logs()
		Phase.FAIL:
			_phase_fail()
		Phase.RESTART:
			_phase_restart()
		Phase.COUNTDOWN:
			_phase_countdown()
		Phase.TIMEUP:
			_phase_timeup()
		Phase.TOUCH:
			_phase_touch()


func _advance(next: int) -> void:
	_phase = next
	_phase_frame = 0

## ── 相位实现 ──

## 噪声相位：确定种子的对抗输入（与模板同源：悬挂手势/孤儿释放/双指抢控/乱键）。
func _phase_noise() -> void:
	# 末帧不再注入：缓冲事件会在下一帧初 flush，避免噪声按键残留进 MOVE 相位。
	if _phase_frame < NOISE_FRAMES:
		_inject_noise_frame()
	if _phase_frame == NOISE_FRAMES:
		# 显式释放全部移动动作，清掉噪声期悬挂按键的残留强度。
		for action in [&"move_left", &"move_right", &"move_up", &"move_down"]:
			Input.action_release(action)
		# 噪声触摸可能落在摇杆热区：显式清摇杆状态，不留悬挂向量进后续相位。
		_reset_joystick()
		_advance(Phase.MOVE)


## 移动断言：按住 move_right 10 帧后位移 ≥ 阈值 + moved 信号送达。
func _phase_move() -> void:
	if _phase_frame == 1:
		_origin = _player.global_position
		Input.action_press(&"move_right")
	if _phase_frame == MOVE_FRAMES:
		var travelled: float = _player.global_position.distance_to(_origin)
		if travelled < MIN_MOVE_DISTANCE:
			_failures.append("玩家 %d 帧内位移 %.2fpx < %.2fpx：动作未生效或 velocity 未驱动" % [
				MOVE_FRAMES, travelled, MIN_MOVE_DISTANCE])
		if not _moved_seen:
			_failures.append("信号 Player.moved 未到达订阅方：连接断裂或从未 emit")
		_advance(Phase.CLAMP)


## 边界断言：贴边持续右移后，坐标被 clamp 在边界（验收 2：永不越界）。
func _phase_clamp() -> void:
	if _phase_frame == 1:
		var bounds := get_viewport().get_visible_rect().size
		_player.global_position = Vector2(bounds.x - 30.0, bounds.y / 2.0)
	if _phase_frame == CLAMP_FRAMES:
		var bounds := get_viewport().get_visible_rect().size
		var limit_x: float = bounds.x - Player.EDGE_MARGIN
		if _player.global_position.x > limit_x + 0.5:
			_failures.append("持续右移 %d 帧后 x=%.1f 越界（上限 %.1f）：边界 clamp 缺失" % [
				CLAMP_FRAMES, _player.global_position.x, limit_x])
		if absf(_player.global_position.x - limit_x) > 6.0:
			_failures.append("持续右移 %d 帧后 x=%.1f 未贴住边界 %.1f：移动被阻或被提前挡停" % [
				CLAMP_FRAMES, _player.global_position.x, limit_x])
		Input.action_release(&"move_right")
		_advance(Phase.JOYSTICK)


## 触屏断言（迭代反馈 1 的门禁本体，知识 82e419bb §二.4）：
##   ① 注入 ScreenTouch 按下摇杆基座 → 摇杆接管（E-18 修复：_input 阶段先于 GUI 命中）；
##   ② 斜向拖拽 → 摇杆向量双轴同时非零、角色沿斜向位移（E-19 修复：不再走 InputEventAction）；
##   ③ 抬起 → 摇杆归零，不留悬挂输入。
func _phase_joystick() -> void:
	var joy := _joystick_node()
	if joy == null:
		_failures.append("场景树找不到 VirtualJoystick（JoystickAnchor）：触屏虚拟摇杆未挂进 main.tscn")
		_advance(Phase.COLLECT_1)
		return
	if _phase_frame == 1:
		_origin = _player.global_position
		_inject_touch_at(joy, Vector2(56, 56), true)
	elif _phase_frame == JOYSTICK_DRAG_FRAME:
		# 从基座中心 (56,56) 斜向拖到 (16,16)：offset (-40,-40)，模长超死区、双轴非零。
		_inject_drag_at(joy, Vector2(16, 16))
	elif _phase_frame == JOYSTICK_FRAMES:
		if joy.vector.length() < 0.9:
			_failures.append("斜向拖拽后摇杆向量 %s 模长 < 0.9：触摸未被摇杆消费（E-18）或死区口径错误" % [
				joy.vector])
		var delta: Vector2 = _player.global_position - _origin
		if delta.x > -8.0 or delta.y > -8.0:
			_failures.append("斜向拖拽后角色位移 (%.1f, %.1f) 未双轴同动：E-19 同帧互踩或统一移动出口未接摇杆" % [
				delta.x, delta.y])
		_inject_touch_at(joy, Vector2(16, 16), false)
		_reset_joystick()
		_advance(Phase.COLLECT_1)


## 收集断言一：传送吃果 → +10、连击 == 1、水果数 +1、Juice 反馈非空（验收 3 前半）。
func _phase_collect_1() -> void:
	if _phase_frame == 1:
		_fruit_spawner.stop_match()
		GameState.reset()
		var fruit := _first_fruit()
		if fruit == null:
			_failures.append("收集断言找不到场上水果：FruitSpawner 未铺场")
			_advance(Phase.LOGS)
			return
		_player.global_position = fruit.global_position
	if _phase_frame == COLLECT_FRAMES:
		if GameState.score != GameState.BASE_POINTS:
			_failures.append("首次收集后得分 %d != %d：计分入口/碰撞接线断裂" % [
				GameState.score, GameState.BASE_POINTS])
		if GameState.fruits_collected != 1:
			_failures.append("首次收集后水果计数 %d != 1" % GameState.fruits_collected)
		if GameState.combo_count != 1:
			_failures.append("首次收集后连击数 %d != 1" % GameState.combo_count)
		if Juice.events.is_empty() or not _feedback_seen:
			_failures.append("收集后 Juice 反馈为空：反馈接线断裂（SKILL.md §3B 第 6 项）")
		_advance(Phase.COLLECT_2)


## 收集断言二：3s 窗口内第二笔 → 本笔 +15（总分为累计值）、连击 == 2（验收 3 后半）。
func _phase_collect_2() -> void:
	if _phase_frame == 1:
		_baseline_score = GameState.score
		var fruit := _first_fruit()
		if fruit == null:
			_failures.append("连击断言找不到第二个水果：补货/铺场不足")
			_advance(Phase.LOGS)
			return
		_player.global_position = fruit.global_position
	if _phase_frame == COLLECT_FRAMES:
		var expected: int = _baseline_score + GameState.BASE_POINTS + GameState.COMBO_BONUS
		if GameState.score != expected:
			_failures.append("窗口内第二笔后得分 %d != %d（连击加成未累加，窗口=%.2fs）" % [
				GameState.score, expected, GameState.COMBO_WINDOW])
		if GameState.combo_count != 2:
			_failures.append("窗口内第二笔后连击数 %d != 2" % GameState.combo_count)
		_advance(Phase.GOLDEN)


## 金水果断言（迭代反馈 3）：金类型收取 → 基础 +50，连击窗口内按同一规则叠加连击加成。
func _phase_golden() -> void:
	if _phase_frame == 1:
		var fruit := _first_fruit()
		if fruit == null:
			_failures.append("金水果断言找不到场上水果：铺场/补货不足")
			_advance(Phase.BAD)
			return
		var combo_active: bool = GameState.combo_window_left > 0.0
		_baseline_score = GameState.score
		# add_score 口径：窗口内 combo+1 后 bonus = 5 × 旧 combo；窗口外 bonus = 0。
		_expected_gain = Fruit.GOLDEN_POINTS + (
			GameState.COMBO_BONUS * GameState.combo_count if combo_active else 0)
		fruit.kind = Fruit.KIND_GOLDEN
		_player.global_position = fruit.global_position
	if _phase_frame == COLLECT_FRAMES:
		var expected: int = _baseline_score + _expected_gain
		if GameState.score != expected:
			_failures.append("金水果收取后得分 %d != %d（+50 基础分或连击叠加口径错误）" % [
				GameState.score, expected])
		_advance(Phase.BAD)


## 坏水果断言（迭代反馈 3）：扣分（下限 0）+ 减速 debuff；不进连击、不计收集数。
func _phase_bad() -> void:
	if _phase_frame == 1:
		var fruit := _first_fruit()
		if fruit == null:
			_failures.append("坏水果断言找不到场上水果：铺场/补货不足")
			_advance(Phase.AUDIO)
			return
		_baseline_score = GameState.score
		_fruits_before_bad = GameState.fruits_collected
		_combo_before_bad = GameState.combo_count
		fruit.kind = Fruit.KIND_BAD
		_player.global_position = fruit.global_position
	if _phase_frame == COLLECT_FRAMES:
		var expected_score: int = maxi(0, _baseline_score - GameState.BAD_FRUIT_PENALTY)
		if GameState.score != expected_score:
			_failures.append("坏水果惩罚后得分 %d != %d（扣分口径错误）" % [
				GameState.score, expected_score])
		if GameState.fruits_collected != _fruits_before_bad:
			_failures.append("坏水果被计入了收集数（%d → %d）：惩罚与奖励路径未分离" % [
				_fruits_before_bad, GameState.fruits_collected])
		if GameState.combo_count != _combo_before_bad:
			_failures.append("坏水果改变了连击数（%d → %d）：不应进连击也不应清连击" % [
				_combo_before_bad, GameState.combo_count])
		if GameState.slow_left <= 0.0:
			_failures.append("坏水果未触发减速 debuff（slow_left=%.2f）" % GameState.slow_left)
		_advance(Phase.AUDIO)


## 音频门控断言（迭代反馈 2，知识 82e419bb §三）：首手势解锁翻转、门控记账层、
## 静音开关降级、幂等解锁 —— headless 断言「协议层」而非声波。
func _phase_audio() -> void:
	if _phase_frame == 1:
		if not Juice.audio_unlocked:
			_failures.append("噪声相位注入真实手势后 audio_unlocked 未翻转：首手势解锁缺失")
			_advance(Phase.LOGS)
			return
		# ① 门控记账层：未解锁 → 不发声，留 gate 记账。
		Juice.audio_unlocked = false
		if Juice.sfx(&"score"):
			_failures.append("未解锁时 sfx 返回 true：门控记账层缺失（解锁前就直连播放）")
		if not _events_contain("gate:score"):
			_failures.append("未解锁播放未留下 gate:score 记账事件")
		# ② 解锁后放行。
		Juice.unlock_audio()
		if not Juice.sfx(&"score"):
			_failures.append("解锁后 sfx 返回 false：unlock_audio 未放行播放")
		# ③ 静音开关：静音时降级记账，取消后恢复。
		Juice.set_muted(true)
		if not Juice.muted or Juice.sfx(&"score"):
			_failures.append("静音态未拦截播放（muted=%s）" % Juice.muted)
		if not _events_contain("muted:score"):
			_failures.append("静音播放未留下 muted:score 记账事件")
		Juice.set_muted(false)
		if not Juice.sfx(&"score"):
			_failures.append("取消静音后 sfx 仍被拦截：静音开关不可恢复")
		# ④ 幂等解锁：重复调用不报错、不重置状态。
		Juice.unlock_audio()
		Juice.unlock_audio()
		if not Juice.audio_unlocked:
			_failures.append("unlock_audio 非幂等：重复调用丢失解锁态")
		_advance(Phase.LOGS)


## 原木断言：间隔 ∈ [2,4)；速度随剩余时间递增（v0/中点单调/终局 1.8×）；确实在滚（验收 4）。
func _phase_logs() -> void:
	if _phase_frame == 1:
		if absf(_log_spawner.speed_for(GameState.MATCH_SECONDS) - LogSpawner.SPEED_START) > 0.01:
			_failures.append("v(60s) != v0：速度公式起点错误")
		if absf(_log_spawner.speed_for(0.0) - LogSpawner.SPEED_START * LogSpawner.SPEED_END_FACTOR) > 0.01:
			_failures.append("v(0s) != 1.8·v0：终局速度倍率错误")
		_log_a = _log_spawner.spawn_now(GameState.MATCH_SECONDS)
		_log_b = _log_spawner.spawn_now(GameState.MATCH_SECONDS / 2.0)
		if absf(_log_a.speed - LogSpawner.SPEED_START) > 0.01:
			_failures.append("原木实际速度 %.2f != v0 %.2f：生成时未按公式赋速" % [
				_log_a.speed, LogSpawner.SPEED_START])
		if _log_b.speed <= _log_a.speed:
			_failures.append("剩余 30s 的原木速度 %.2f 未快于 60s 的 %.2f：速度未随剩余时间递增" % [
				_log_b.speed, _log_a.speed])
		var interval: float = (_log_spawner.get_node("SpawnTimer") as Timer).wait_time
		if interval < LogSpawner.SPAWN_INTERVAL_MIN or interval >= LogSpawner.SPAWN_INTERVAL_MAX:
			_failures.append("生成间隔 %.2fs 不在 [2,4)（需求硬性口径）" % interval)
		_log_a_x = _log_a.global_position.x
	if _phase_frame == LOGS_MOVE_FRAMES:
		if not is_instance_valid(_log_a):
			_failures.append("原木在断言窗口内被释放：出界自毁阈值过紧")
		elif absf(_log_a.global_position.x - _log_a_x) < 5.0:
			_failures.append("原木 10 帧内水平位移 < 5px：滚动未生效")
		_advance(Phase.FAIL)


## 负路径：把原木瞬移到松鼠脚下 → 本局立即结束 + 失败结算（标题含「原木」）+ 最高分落盘。
## （不能反向传送松鼠：松鼠在视口外的原木上会被边界 clamp 拉回场内 —— clamp 正是受测行为。）
func _phase_fail() -> void:
	if _phase_frame == 1:
		if not is_instance_valid(_log_b):
			_failures.append("失败路径找不到可用原木")
			_advance(Phase.RESTART)
			return
		_log_b.global_position = _player.global_position
	if _phase_frame == FAIL_FRAMES:
		if not bool(_main.get("match_over")):
			_failures.append("松鼠与原木重叠 %d 帧仍未终局：碰撞判定/信号接线断裂" % FAIL_FRAMES)
		elif not _result_panel.visible:
			_failures.append("碰撞终局后结算面板未显示")
		elif _result_title.text.find("原木") < 0:
			_failures.append("失败结算标题「%s」未含「原木」：两条终局路径未区分（知识 §一）" % _result_title.text)
		if GameState.best_score < GameState.score:
			_failures.append("结算后最高分 %d < 本局分 %d：submit_final_score 未覆写" % [
				GameState.best_score, GameState.score])
		if not FileAccess.file_exists(GameState.SAVE_PATH):
			_failures.append("结算后未找到 %s：最高分未持久化（验收 5）" % GameState.SAVE_PATH)
		_advance(Phase.RESTART)


## 重开（键盘通道）：confirm 动作 → 新局（面板收起、分数清零、时间回满）。
func _phase_restart() -> void:
	if _phase_frame == 1:
		_press_action(&"confirm")
	if _phase_frame >= 2:
		# 重开把玩家放回场心；若铺场恰有水果落在场心附近，物理步会在断言前误收一果
		# （随机种子下偶发）。smoke 根节点先于 Main 跑物理 → 每帧先传送到离水果最远的点。
		_teleport_away_from_fruits()
	if _phase_frame == RESTART_FRAMES:
		if bool(_main.get("match_over")):
			_failures.append("键盘 confirm 后仍未重开：结算态输入通道断裂")
		elif _result_panel.visible:
			_failures.append("重开后结算面板仍显示")
		elif absf(float(_main.get("time_left")) - GameState.MATCH_SECONDS) > 0.5:
			# 容差 0.5s：start_match 到断言之间物理帧已在正常倒计时（59.97 属健康）。
			_failures.append("重开后 time_left=%.2f 未回 60" % float(_main.get("time_left")))
		elif GameState.score != 0:
			_failures.append("重开后分数 %d 未清零" % GameState.score)
		_time_at_start = float(_main.get("time_left"))
		_label_text_at_start = _time_label_text()
		_advance(Phase.COUNTDOWN)


## 倒计时断言：实测 1s+ 后 time_left 下降且 HUD 文本变化（验收 1：逐秒递减、实时显示）。
func _phase_countdown() -> void:
	if _phase_frame == COUNTDOWN_FRAMES:
		var now: float = float(_main.get("time_left"))
		if now >= _time_at_start - 0.9:
			_failures.append("%d 帧后 time_left %.2f 未递减（初值 %.2f）：倒计时不工作" % [
				COUNTDOWN_FRAMES, now, _time_at_start])
		if _time_label_text() == _label_text_at_start:
			_failures.append("倒计时已递减但 HUD 时间文本未变化（%s）：实时显示断裂" % _label_text_at_start)
		_advance(Phase.TIMEUP)


## 正路径：时间归零 → 自动结算（标题「时间到」）。
func _phase_timeup() -> void:
	if _phase_frame == 1:
		_main.set("time_left", 0.08)
	if _phase_frame == TIMEUP_FRAMES:
		if not bool(_main.get("match_over")):
			_failures.append("时间归零后仍未终局：倒计时归零路径断裂（验收 1）")
		elif _result_title.text.find("时间") < 0:
			_failures.append("正常结算标题「%s」未含「时间」" % _result_title.text)
		elif not _events_contain("sfx:tick"):
			_failures.append("末 5 秒倒计时未留下 tick 告警事件（迭代反馈 2）")
		elif not _events_contain("sfx:settle"):
			_failures.append("结算未播放 settle 音效（迭代反馈 2）")
		_advance(Phase.TOUCH)


## 重开（触摸通道）：RestartButton 的 pressed 信号链路 → 新局（触摸端入口，知识 ed31081f）。
func _phase_touch() -> void:
	if _phase_frame == 1:
		var button := get_tree().root.find_child("RestartButton", true, false) as TouchScreenButton
		if button == null:
			_failures.append("结算面板找不到 RestartButton：触摸重开入口缺失")
			_advance(Phase.DONE)
			_report()
			return
		if button.get_signal_connection_list(&"pressed").is_empty():
			_failures.append("RestartButton.pressed 无任何连接：触摸通道未接线")
		button.emit_signal(&"pressed")
	if _phase_frame == TOUCH_FRAMES:
		if bool(_main.get("match_over")) or _result_panel.visible:
			_failures.append("触摸重开信号触发后未进入新局：触摸通道断裂")
		_advance(Phase.DONE)
		_report()


## ── 输入注入与静态契约（与模板同源） ──

## 噪声相位：确定种子随机事件（只注入原始事件，不含 InputEventAction —— 动作级断言不被污染）。
func _inject_noise_frame() -> void:
	var roll := _noise_rng.randf()
	var pos := Vector2(_noise_rng.randf_range(0, 960), _noise_rng.randf_range(0, 540))
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


## 无显示设备时模拟「玩家按键」：注入 InputEventAction，让 _unhandled_input 收得到。
func _press_action(action: StringName) -> void:
	var event := InputEventAction.new()
	event.action = action
	event.pressed = true
	Input.parse_input_event(event)


## 键位契约断言：目标键表 → project.godot [input] 的 physical_keycode（AND 语义）。
func _check_key_bindings() -> void:
	for action: StringName in KEY_CONTRACT:
		if not InputMap.has_action(action):
			continue  # 动作缺失已由 REQUIRED_ACTIONS 上报
		var expected: Array = KEY_CONTRACT[action]
		var bound: Array[Key] = []
		for event in InputMap.action_get_events(action):
			var key := event as InputEventKey
			if key != null and key.physical_keycode != KEY_NONE:
				bound.append(key.physical_keycode)
		for key in expected:
			if not (key in bound):
				_failures.append("键位契约：动作 %s 缺物理键 %s（真机按了没反应）" % [
					action, OS.get_keycode_string(key as Key)])


func _first_fruit() -> Fruit:
	for child in _fruit_spawner.get_children():
		if child is Fruit and not child.is_queued_for_deletion():
			return child
	return null


func _joystick_node() -> VirtualJoystick:
	return get_tree().root.find_child("JoystickAnchor", true, false) as VirtualJoystick


## 相位切换时清摇杆悬挂状态（与释放移动动作同级的输入卫生）。
func _reset_joystick() -> void:
	var joy := _joystick_node()
	if joy != null:
		joy._release()


## 触摸注入：用 viewport.push_input(local_coords=true) 以「设计分辨率坐标」直达分发链。
## 不走 Input.parse_input_event —— 后者把事件坐标当窗口坐标再过一遍 stretch 变换，
## headless 窗口尺寸与设计分辨率不一致时坐标会被放大失真（实测：注入 (0..960) 收到
## (0..14000+)），而真实分发链 _input → GUI → unhandled 完整保留，E-18/E-19 语义不变。
func _inject_touch_at(joy: VirtualJoystick, local_pos: Vector2, pressed: bool) -> void:
	var ev := InputEventScreenTouch.new()
	ev.index = JOY_TOUCH_INDEX
	ev.pressed = pressed
	ev.position = joy.get_global_transform_with_canvas() * local_pos
	joy.get_viewport().push_input(ev, true)


func _inject_drag_at(joy: VirtualJoystick, local_pos: Vector2) -> void:
	var ev := InputEventScreenDrag.new()
	ev.index = JOY_TOUCH_INDEX
	ev.position = joy.get_global_transform_with_canvas() * local_pos
	ev.relative = Vector2.ZERO
	joy.get_viewport().push_input(ev, true)


## 反馈事件按前缀检索（事件形如 "sfx:tick@12345"；前缀不含时间戳）。
func _events_contain(prefix: String) -> bool:
	for entry in Juice.events:
		if String(entry).begins_with(prefix):
			return true
	return false


## 重开竞态防护：把玩家传送到「离所有现存水果最远」的粗网格点（24px 步进）。
## 只在最小净距 > 40px（水果收集半径 + 玩家半径 + 余量）时才传送，保证断言窗口内
## 不会发生计划外的碰撞计分。
func _teleport_away_from_fruits() -> void:
	var bounds := get_viewport().get_visible_rect().size
	var fruits: Array[Fruit] = []
	for child in _fruit_spawner.get_children():
		if child is Fruit and not child.is_queued_for_deletion():
			fruits.append(child)
	if fruits.is_empty():
		return
	var best_pos := Vector2.ZERO
	var best_clearance := -1.0
	var margin := int(Player.EDGE_MARGIN)
	var gx := margin
	while gx <= int(bounds.x) - margin:
		var gy := margin
		while gy <= int(bounds.y) - margin:
			var candidate := Vector2(gx, gy)
			var clearance := INF
			for fruit in fruits:
				clearance = minf(clearance, fruit.global_position.distance_to(candidate))
			if clearance > best_clearance:
				best_clearance = clearance
				best_pos = candidate
			gy += 24
		gx += 24
	if best_clearance > 40.0:
		_player.global_position = best_pos


func _time_label_text() -> String:
	var label := get_tree().root.find_child("TimeLabel", true, false) as Label
	return label.text if label != null else ""


## ── 报告与信号处理 ──

func _report() -> void:
	_phase = Phase.DONE
	if _failures.is_empty():
		print("GODOT_SMOKE: PASS 移动/边界/触屏摇杆/收集连击/金坏水果/音频门控/末5秒告警/原木节奏/双终局/重开双通道/倒计时/持久化 全部通过")
		get_tree().quit(0)
	else:
		for failure in _failures:
			printerr("GODOT_SMOKE: FAIL %s" % failure)
		get_tree().quit(1)


func _on_player_moved(_position: Vector2) -> void:
	_moved_seen = true


func _on_score_changed(_score: int) -> void:
	pass  # score_changed 连接只为断言信号存在；数值断言直读 GameState（单一事实源）


func _on_feedback_fired(_kind: StringName) -> void:
	_feedback_seen = true
