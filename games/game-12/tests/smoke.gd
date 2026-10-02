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
## 覆盖面（验收标准 → 冒烟断言的映射，见 SKILL.md「冒烟场景必须断言什么」）：
##   1. 主场景可实例化（main.tscn → player.tscn 接线未断裂）
##   2. autoload GameState 已注册且带约定信号（count_changed/state_changed/click_rejected）
##   3. InputMap 动作已注册 + 键位契约（含 restart），注入移动输入后 Player 真的动了
##   4. 信号真的到达订阅方（Player.moved / GameState.count_changed / state_changed / click_rejected）
##   5. 核心交互（点击计数）真实路径生效：confirm 动作事件 + CountButton.pressed 各计一次
##   6. 连点防重：300ms 窗口内 4 连点只计一次且发 click_rejected；窗口结束后恢复正常累加
##   7. 胜负可达：达标 TARGET_COUNT 进入 WON，胜利后不再计数；重开可用：归零回 PLAYING
##   8. 移动可玩（验收 4 的机判代理）：触控目标 ≥44×44px（+1 按钮矩形 + 触摸确认钮圆形热区）、
##      拉伸契约 canvas_items+keep 且设计分辨率 720×1280（与 375×667 同宽高比 → 无横向滚动）
##   9. 待机示能脉冲：主按钮 scale 在窗口期内极差达标（静止页面也必须有非零帧差，
##      否则 mobile-web-smoke 的「画面在动」检查会把健康的极简页面误判成渲染冻结）
##  10. 反馈可见性：防重拦截提示不被指针行程覆盖（反馈线与指针线分离）
##
## ⚠️ 输入注入分阶段互不重叠（references/error-signatures.md E-08）：
##   `Input.parse_input_event()` 的缓冲冲刷会清掉 `Input.action_press()` 的按下状态。
## ⚠️ 真实点击路径走 Time.get_ticks_msec()，受防重窗口约束：
##   两次真实点击之间必须等真实时间跨过窗口（按帧等待 + 帧数上限兜底），合成时间戳的
##   防重断言则完全确定（纯函数注入时间），不依赖帧率。

## ── 噪声相位（输入鲁棒性门禁的逐游戏语义层）──
## 正式断言前注入一段确定种子的对抗输入：悬挂手势、孤儿释放、双指抢控、乱键。
## 随后照常执行移动/计数断言 —— 断言仍全过 = 噪声没有楔死输入管线。
## 只注入原始事件（Key/Mouse/Touch），不注入 InputEventAction，避免污染动作级判定。
const NOISE_FRAMES: int = 30
## 阶段一：按住 move_right 让玩家移动的帧数。
const MOVE_FRAMES: int = 10
## 真实点击路径之间要等过的真实毫秒数（防重窗口 300ms + 余量）。
const REAL_CLICK_GAP_MS: int = 340
## 等真实时间跨窗的帧数上限（60fps 下 ≈2s，足够跨越 300ms；超出即报帧率异常）。
const REAL_GAP_MAX_FRAMES: int = 120
## 注入事件后等信号送达/UI 刷新的帧数。
const SETTLE_FRAMES: int = 2
## 判定「真的移动了」的最小位移（像素）。
const MIN_MOVE_DISTANCE: float = 1.0
## 总帧数上限（超过即 FAIL，防止死循环；smoke.sh 另有 --quit-after 兜底）。
## 必须小于门禁帧预算 GODOT_SMOKE_FRAMES=240（--quit-after 会先杀进程，届时既无 PASS 也无 FAIL）。
const TOTAL_FRAMES: int = NOISE_FRAMES + MOVE_FRAMES + REAL_GAP_MAX_FRAMES + 60
## 触控目标下限（验收 4：按钮触控区域不小于 44×44px）。
const MIN_TOUCH_TARGET: float = 44.0
## 拦截反馈可见性相位里，把指针摇起来的帧数。
const REJECT_MOVE_FRAMES: int = 10
## 拉伸契约：设计分辨率（与 375×667 同 0.5625 宽高比 → 等比缩放后无横向滚动）。
const DESIGN_WIDTH: int = 720
const DESIGN_HEIGHT: int = 1280

const REQUIRED_ACTIONS: Array[StringName] = [
	&"move_left", &"move_right", &"move_up", &"move_down", &"confirm", &"restart",
]

## 键位契约：动作 → 键表承诺的物理键，必须全部绑定（逐键 AND 核对，见模板说明）。
const KEY_CONTRACT: Dictionary = {
	&"move_left": [KEY_A, KEY_LEFT],
	&"move_right": [KEY_D, KEY_RIGHT],
	&"move_up": [KEY_W, KEY_UP],
	&"move_down": [KEY_S, KEY_DOWN],
	&"confirm": [KEY_SPACE, KEY_ENTER],
	&"restart": [KEY_R],
}

## 冒烟相位机：输入注入分帧进行（E-08），真实点击之间按真实时间跨窗。
enum Phase { NOISE, MOVE, CONFIRM, GAP, BUTTON, SYNTHETIC, RESTART, REJECT, DONE }

var _failures: PackedStringArray = []
var _phase: int = Phase.NOISE
var _phase_frame: int = 0
var _frames: int = 0
var _player: Player
var _main: Node2D
var _status_label: Label
var _touch_confirm: TouchScreenButton
var _count_label: Label
var _count_button: Button
var _restart_button: Button
var _origin: Vector2 = Vector2.ZERO
var _real_click_ms: int = 0
var _moved_seen: bool = false
var _count_seen: bool = false
var _rejected_count: int = 0
var _won_seen: bool = false


func _ready() -> void:
	# headless 无垂直同步：限到 60 FPS 让 process 帧 : 物理帧 ≈ 1:1，--quit-after 兜底才有意义。
	Engine.max_fps = 60

	for action in REQUIRED_ACTIONS:
		if not InputMap.has_action(action):
			_failures.append("InputMap 缺少动作 %s（project.godot [input] 未注册）" % action)
	_check_key_bindings()

	var game_state := get_tree().root.get_node_or_null("GameState")
	if game_state == null:
		_failures.append("autoload GameState 未注册（project.godot [autoload] 缺失）")
	elif not game_state.has_signal("count_changed") \
			or not game_state.has_signal("state_changed") \
			or not game_state.has_signal("click_rejected"):
		_failures.append("autoload GameState 缺少约定信号 count_changed/state_changed/click_rejected")
	else:
		game_state.count_changed.connect(_on_count_changed)
		game_state.state_changed.connect(_on_state_changed)
		game_state.click_rejected.connect(_on_click_rejected)
		if GameState.DEBOUNCE_MS != 300:
			_failures.append("防重窗口应为 300ms，实际 %d" % GameState.DEBOUNCE_MS)

	_player = get_tree().root.find_child("Player", true, false) as Player
	if _player == null:
		_failures.append("场景树找不到 Player（main.tscn 未实例化 player.tscn，或实例名不是 Player）")
	else:
		_player.moved.connect(_on_player_moved)
		_origin = _player.global_position
	_count_label = get_tree().root.find_child("CountLabel", true, false) as Label
	_count_button = get_tree().root.find_child("CountButton", true, false) as Button
	_restart_button = get_tree().root.find_child("RestartButton", true, false) as Button
	if _count_label == null or _count_button == null or _restart_button == null:
		_failures.append("主场景缺 CountLabel/CountButton/RestartButton（极简计数页 UI 未装配齐）")
	_main = get_tree().root.find_child("Main", true, false) as Node2D
	if _main == null:
		_failures.append("冒烟场景未实例化 Main（tests/smoke.tscn → scenes/main.tscn 接线断裂）")
	_status_label = get_tree().root.find_child("StatusLabel", true, false) as Label
	_touch_confirm = get_tree().root.find_child("ConfirmButton", true, false) as TouchScreenButton


func _physics_process(_delta: float) -> void:
	if _phase == Phase.DONE:
		return
	_frames += 1
	_phase_frame += 1
	# 静态几何 / 工程契约断言放在第一物理帧：Control.size 要等一帧布局才落定，
	# 在 _ready 里读恒为 0 → 触控目标断言会整段漏判（实测负例不触发）。
	if _frames == 1:
		_check_touch_targets()
		_check_stretch_contract()
	if _failures.is_empty():
		match _phase:
			Phase.NOISE:
				_tick_noise()
			Phase.MOVE:
				_tick_move()
			Phase.CONFIRM:
				_tick_confirm()
			Phase.GAP:
				_tick_gap()
			Phase.BUTTON:
				_tick_button()
			Phase.SYNTHETIC:
				_tick_synthetic()
			Phase.RESTART:
				_tick_restart()
			Phase.REJECT:
				_tick_reject()
			Phase.DONE:
				pass
	if _frames >= TOTAL_FRAMES and _phase != Phase.DONE:
		_failures.append("冒烟在 %d 帧预算内没有跑完（停在相位 %s）" % [TOTAL_FRAMES, Phase.keys()[_phase]])
	if not _failures.is_empty() or _phase == Phase.DONE:
		_phase = Phase.DONE
		_report()


func _advance(next: int) -> void:
	_phase = next
	_phase_frame = 0


## ── 相位一：噪声（确定种子对抗输入，30 帧）──
var _noise_rng := RandomNumberGenerator.new()


func _tick_noise() -> void:
	if _phase_frame == 1:
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
		k.physical_keycode = [KEY_A, KEY_D, KEY_W, KEY_S, KEY_SPACE, KEY_ENTER][_noise_rng.randi_range(0, 5)]
		k.pressed = _noise_rng.randf() < 0.5
		Input.parse_input_event(k)
	if _phase_frame >= NOISE_FRAMES:
		_advance(Phase.MOVE)


## ── 相位二：移动断言（Input.action_press 与事件注入分帧，E-08）──
func _tick_move() -> void:
	if _phase_frame == 1:
		Input.action_press(&"move_right")
	elif _phase_frame == MOVE_FRAMES:
		Input.action_release(&"move_right")
		_assert_player_moved()
		# 噪声相位的乱键可能真实触发了计数/拦截，且最后一次乱键可能贴着 confirm 注入点
		# （不足防重窗口）→ 在进入计数断言前重置状态，保证后续计数断言确定可复现。
		GameState.reset()
		_count_seen = false
		_won_seen = false
		_rejected_count = 0
		_advance(Phase.CONFIRM)


## ── 相位三：真实计数路径 A —— confirm 动作事件（键盘空格/回车/触摸确认钮同路径）──
func _tick_confirm() -> void:
	if _phase_frame == 1:
		_press_action(&"confirm")
	elif _phase_frame == 1 + SETTLE_FRAMES:
		if GameState.count != 1:
			_failures.append("confirm 动作触发计数失败：count=%d（期望 1）—— _unhandled_input 接线断裂" % GameState.count)
		if not _count_seen:
			_failures.append("信号 GameState.count_changed 未到达订阅方（confirm 触发的 +1 没发信号）")
		if _count_label != null and _count_label.text != "1":
			_failures.append("CountLabel 未实时同步：text=%s（期望 \"1\"）" % _count_label.text)
		_real_click_ms = Time.get_ticks_msec()
		_advance(Phase.GAP)


## ── 相位四：等真实时间跨过防重窗口（真实点击受 300ms 窗口约束）──
func _tick_gap() -> void:
	if Time.get_ticks_msec() - _real_click_ms >= REAL_CLICK_GAP_MS:
		_advance(Phase.BUTTON)
	elif _phase_frame > REAL_GAP_MAX_FRAMES:
		_failures.append("%d 帧内真实时间未跨过 %dms 防重窗口（headless 帧率异常，检查 Engine.max_fps）" % [
			REAL_GAP_MAX_FRAMES, REAL_CLICK_GAP_MS,
		])


## ── 相位五：真实计数路径 B —— CountButton 按钮接线（鼠标/触摸点的就是它）──
func _tick_button() -> void:
	if _phase_frame == 1:
		if _count_button != null:
			_count_button.pressed.emit()
	elif _phase_frame == 1 + SETTLE_FRAMES:
		if GameState.count != 2:
			_failures.append("CountButton.pressed 未触发计数：count=%d（期望 2）—— 按钮 pressed 接线断裂" % GameState.count)
		if not _moved_seen:
			_failures.append("信号 Player.moved 未到达订阅方：连接断裂或从未 emit")
		if _count_label != null and _count_label.text != "2":
			_failures.append("CountLabel 未实时同步：text=%s（期望 \"2\"）" % _count_label.text)
		_advance(Phase.SYNTHETIC)


## ── 相位六：防重/恢复/胜负（合成时间戳纯函数断言，完全确定、与帧率无关）──
func _tick_synthetic() -> void:
	var before: int = GameState.count
	var t0: int = 1_000_000
	# 窗口外首击：接受
	if not GameState.try_count(t0):
		_failures.append("防重窗口外的首次点击被误拦（try_count(%d) 应为 true）" % t0)
	# 窗口内 4 连点（100~299ms）：全部拦截且只发 click_rejected，不计数
	var rapid_offsets: Array[int] = [100, 200, 250, 299]
	for offset in rapid_offsets:
		if GameState.try_count(t0 + offset):
			_failures.append("防重窗口内 +%dms 的连点被误计（窗口 %dms 内应只计一次）" % [offset, GameState.DEBOUNCE_MS])
	if _rejected_count < rapid_offsets.size():
		_failures.append("窗口内连点未发 click_rejected：收到 %d 次（期望 ≥%d）" % [_rejected_count, rapid_offsets.size()])
	if GameState.count != before + 1:
		_failures.append("窗口内连点改变了计数：count=%d（期望 %d）" % [GameState.count, before + 1])
	# 窗口结束（+400ms）：恢复正常累加，恰好 +1 无跳变
	if not GameState.try_count(t0 + 400):
		_failures.append("防重窗口结束后未恢复计数（try_count(+400ms) 应为 true）")
	if GameState.count != before + 2:
		_failures.append("恢复后计数跳变：count=%d（期望 %d）" % [GameState.count, before + 2])
	# 胜负可达：以 >窗口 的节奏点到 TARGET_COUNT，应进入 WON
	for i in range(1, GameState.TARGET_COUNT + 2):
		if GameState.state == GameState.State.WON:
			break
		GameState.try_count(t0 + 800 + i * 400)
	if GameState.state != GameState.State.WON:
		_failures.append("达标 %d 次未进入胜利态（state=%d）—— 胜负判定不可达" % [GameState.TARGET_COUNT, GameState.state])
	if not _won_seen:
		_failures.append("信号 GameState.state_changed 未到达订阅方（进入 WON 没发信号）")
	if GameState.count != GameState.TARGET_COUNT:
		_failures.append("胜利时计数=%d（期望恰好 %d，无虚高）" % [GameState.count, GameState.TARGET_COUNT])
	# 胜利后继续点：不再计数
	if GameState.try_count(t0 + 100_000):
		_failures.append("胜利后仍接受计数（应忽略）")
	_advance(Phase.RESTART)


## ── 相位七：重开可用（restart 动作事件 + RestartButton 按钮接线）──
func _tick_restart() -> void:
	if _phase_frame == 1:
		_press_action(&"restart")
	elif _phase_frame == 1 + SETTLE_FRAMES:
		if GameState.count != 0 or GameState.state != GameState.State.PLAYING:
			_failures.append("restart 动作未重置：count=%d state=%d（期望 0/PLAYING）" % [
				GameState.count, GameState.state])
		if _count_label != null and _count_label.text != "0":
			_failures.append("重开后 CountLabel 未归零：text=%s" % _count_label.text)
	elif _phase_frame == 3 + SETTLE_FRAMES:
		if _restart_button != null:
			_restart_button.pressed.emit()
	elif _phase_frame == 4 + SETTLE_FRAMES:
		if GameState.count != 0 or GameState.state != GameState.State.PLAYING:
			_failures.append("RestartButton.pressed 未重置：count=%d state=%d —— 重开按钮接线断裂" % [
				GameState.count, GameState.state])
		if _count_button != null and _count_button.disabled:
			_failures.append("重开后 +1 按钮仍不可用（disabled 应复位）")
		_advance(Phase.REJECT)


## ── 相位八：反馈可见性 + 待机示能脉冲 ──
## ① 真实触发一次防重拦截（合成时间戳纯函数，重开后防重窗口已清零），状态栏必须出现拦截提示；
## ② 再把指针摇起来 —— 拦截提示不能被指针行程冲掉（main.gd 反馈线/指针线分离的机判）；
## ③ 主按钮 scale 在整个冒烟窗口期内的极差必须达标：极简页面无输入时画面完全静止，
##    mobile-web-smoke 的「画面在动（双时点帧差 > 0）」检查会把它误判成渲染冻结。
func _tick_reject() -> void:
	if _phase_frame == 1:
		GameState.try_count(8_000_000)
		GameState.try_count(8_000_010)  # 距上次有效计数 10ms < 300ms → 拦截并 emit click_rejected
	elif _phase_frame == 1 + SETTLE_FRAMES:
		if _status_label == null:
			_failures.append("主场景缺 StatusLabel（拦截反馈无处显示）")
		elif not _status_label.text.contains("拦截"):
			_failures.append("防重拦截后状态栏未显示拦截提示：text=%s" % _status_label.text)
		Input.action_press(&"move_right")
	elif _phase_frame == 1 + SETTLE_FRAMES + REJECT_MOVE_FRAMES:
		Input.action_release(&"move_right")
		if _status_label != null and not _status_label.text.contains("拦截"):
			_failures.append("指针移动冲掉了拦截反馈（状态栏 text=%s）—— 反馈线与指针线未分离" % _status_label.text)
		if _main != null:
			var swing: float = _main._pulse_max - _main._pulse_min
			if swing < _main.PULSE_MIN_SWING:
				_failures.append("主按钮待机脉冲未生效：scale 极差 %.3f < %.3f（静止页面会让移动端门禁判「画面冻结」）" % [
					swing, _main.PULSE_MIN_SWING])
		# 归位：本相位为验证而动过状态，别把脏状态带出门禁（也验证 reset 幂等）。
		GameState.reset()
		_count_seen = false
		_won_seen = false
		_rejected_count = 0
		_advance(Phase.DONE)


## 验收 4 机判（触控目标）：+1 按钮矩形与触摸确认钮圆形热区都不得小于 44×44px。
## 在第一物理帧判（Control.size 要等一帧布局才落定，_ready 里读恒为 0，整段会漏判）。
func _check_touch_targets() -> void:
	if _count_button != null and (_count_button.size.x < MIN_TOUCH_TARGET or _count_button.size.y < MIN_TOUCH_TARGET):
		_failures.append("+1 按钮尺寸 %.0fx%.0f 低于触控目标下限 %.0fx%.0f（验收 4：触控区域不足会误触/点不中）" % [
			_count_button.size.x, _count_button.size.y, MIN_TOUCH_TARGET, MIN_TOUCH_TARGET])
	if _touch_confirm == null:
		_failures.append("TouchUI 缺 ConfirmButton（移动端触摸确认计数路径不存在）")
	else:
		var circle := _touch_confirm.shape as CircleShape2D
		if circle == null:
			_failures.append("ConfirmButton.shape 不是 CircleShape2D，触控直径无法机判")
		elif circle.radius * 2.0 < MIN_TOUCH_TARGET:
			_failures.append("触摸确认钮热区直径 %.0f 低于 %.0f（验收 4：触控区域不足）" % [
				circle.radius * 2.0, MIN_TOUCH_TARGET])


## 验收 4 机判（375 宽视口无横向滚动）的可无头判定代理：
## 设计分辨率 720×1280 与 375×667 同为 0.5625 宽高比，且拉伸策略 canvas_items+keep
## —— 视口任意尺寸都等比缩放并留黑边，内容永不宽于视口 → 页面不会出现横向滚动。
## 改宽高比或改 stretch 策略都会让「375 无横滚」在真机上翻车，这里提前拦住。
func _check_stretch_contract() -> void:
	var width: int = int(ProjectSettings.get_setting("display/window/size/viewport_width", 0))
	var height: int = int(ProjectSettings.get_setting("display/window/size/viewport_height", 0))
	if width != DESIGN_WIDTH or height != DESIGN_HEIGHT:
		_failures.append("设计分辨率 %sx%s 与 %.4f 宽高比契约不符（期望 %dx%d，375 视口下会出横向滚动/黑边失衡）" % [
			width, height, DESIGN_WIDTH / float(DESIGN_HEIGHT), DESIGN_WIDTH, DESIGN_HEIGHT])
	if ProjectSettings.get_setting("display/window/stretch/mode", "") != "canvas_items":
		_failures.append("拉伸模式应为 canvas_items（否则 375 视口下 UI 不等比缩放，触控目标随视口变形）")
	if ProjectSettings.get_setting("display/window/stretch/aspect", "") != "keep":
		_failures.append("拉伸宽高比策略应为 keep（否则非 0.5625 视口会被拉伸变形）")


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


func _assert_player_moved() -> void:
	if _player == null:
		return
	var travelled: float = _player.global_position.distance_to(_origin)
	if travelled < MIN_MOVE_DISTANCE:
		_failures.append(
			"玩家 %d 帧内位移 %.2fpx < %.2fpx：InputMap 动作未生效或 _physics_process 未驱动 velocity" % [
				MOVE_FRAMES, travelled, MIN_MOVE_DISTANCE,
			]
		)


func _report() -> void:
	if _failures.is_empty():
		print("GODOT_SMOKE: PASS 场景实例化/autoload/键位契约/移动/计数/防重/胜负/重开 全部通过")
		get_tree().quit(0)
	else:
		for failure in _failures:
			printerr("GODOT_SMOKE: FAIL %s" % failure)
		get_tree().quit(1)


func _on_player_moved(_position: Vector2) -> void:
	_moved_seen = true


func _on_count_changed(_count: int) -> void:
	_count_seen = true


func _on_state_changed(_state: int) -> void:
	_won_seen = true


func _on_click_rejected(_remaining_ms: int) -> void:
	_rejected_count += 1
