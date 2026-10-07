extends Node
## 无头冒烟自检（headless smoke）——《冒烟愿晶》「游戏能不能跑、玩不玩得动」的机器判定。
##
## 运行方式（由 scripts/smoke.sh 封装）：
##   godot --headless --path <工程目录> tests/smoke.tscn
##
## 判定协议（smoke.sh 按此断言退出码与日志）：
##   通过 → stdout 打印 `GODOT_SMOKE: PASS ...`，进程退出码 0
##   失败 → stderr 打印 `GODOT_SMOKE: FAIL <原因>`（每条一行），进程退出码 1
##
## 覆盖面（对应 SKILL.md §4.3 七项 + 本游戏验收标准）：
##   1. 主场景可实例化（main.tscn → player.tscn / crystal.tscn 接线未断裂）
##   2. autoload 已注册且带约定信号（score_changed / game_won）
##   3. InputMap 动作已注册、物理键绑定逐键核对，注入输入后玩家真的动了
##   4. 信号真的到达订阅方（Player.moved / GameState.score_changed / game_won）
##   5. 核心交互生效：真实触摸注入 → 愿晶收集、计数 0→1→2→3
##   6. 胜负可达且封顶：恰好 3 颗即胜；胜利后收集全部失效、倒计时冻结，计数绝不超 3
##   7. 重开可用：重开后计数清零、愿晶复位、胜利画面收起
##   8. 一闪即逝判负：愿晶时限耗尽 → game_lost 送达、失败画面可见、收集全部失效；
##      败局重开 → 败局态清除、愿晶复位、时限回满
##   9. 结果性事件挂了反馈（Juice.events 非空，SKILL.md §3B）
##   10. 调参协议可判（TUNING_META 非空、apply_tuning 钳制与未知键拒绝，SKILL.md §3C）
##
## ⚠️ 输入注入分阶段互不重叠（references/error-signatures.md E-08）：
##   headless 下 `Input.parse_input_event()` 的缓冲冲刷会清掉 `Input.action_press()`
##   设置的按下状态，两者同帧混用会让「移动断言」假失败。

## ── 噪声相位（输入鲁棒性门禁的逐游戏语义层）──
## 正式断言前注入一段确定种子的对抗输入：悬挂手势、孤儿释放、双指抢控、乱键。
## 噪声可能误收愿晶 —— 之后统一 restart 清场再断言，保证收集断言从确定状态起步。
const NOISE_FRAMES: int = 30

## 阶段一：按住 move_right 让玩家移动的帧数。
const MOVE_FRAMES: int = 10

## 关键帧时间线（物理帧）：
##   41  释放移动键 → 断言玩家位移 → 注入 restart 清场
##   45  断言干净开局（0/3、未胜、3 颗在野）→ 真实触摸收集第 1 颗
##   47  第 1 颗抬起 → 真实触摸收集第 2 颗
##   49  第 2 颗抬起 → confirm 动作抓取最近愿晶（第 3 颗，桌面路径）
##   53  断言：恰好 3/3、已胜、game_won 送达、胜利画面可见
##   57  胜利后溢出尝试：confirm + 点触已收集愿晶；同时记录愿晶剩余时限（冻结基线）
##   61  断言：计数仍 3、重复 collect() 被拒、胜利后倒计时冻结 → 注入 restart
##   65  断言：计数 0、未胜、3 颗复位、胜利画面隐藏
##   67  败局相位：把三颗愿晶剩余时限压到 0.3s（白盒注入，模拟「一闪即逝」到期）
##   91  断言：流星消散 → 判负、game_lost 送达、失败画面可见、收集全部失效 → 注入 restart
##   95  断言：败局重开 → 败局态清除、失败画面收起、愿晶复位、时限回满
##   99  终局断言：信号送达 + 反馈非空 → 报告
const FRAME_RELEASE_MOVE: int = NOISE_FRAMES + MOVE_FRAMES + 1
const FRAME_CLEAN_CHECK: int = FRAME_RELEASE_MOVE + 4
const FRAME_TAP_SECOND: int = FRAME_CLEAN_CHECK + 2
const FRAME_CONFIRM: int = FRAME_TAP_SECOND + 2
const FRAME_WIN_CHECK: int = FRAME_CONFIRM + 4
const FRAME_OVERFLOW: int = FRAME_WIN_CHECK + 4
const FRAME_OVERFLOW_CHECK: int = FRAME_OVERFLOW + 4
const FRAME_RESTART_AGAIN: int = FRAME_OVERFLOW_CHECK
const FRAME_RESTART_CHECK: int = FRAME_RESTART_AGAIN + 4
const FRAME_FAIL_SETUP: int = FRAME_RESTART_CHECK + 2
## 败局相位的注入时限（秒）：0.3s ≈ 18 物理帧；+24 帧留足到期与信号传播余量。
const FAIL_PHASE_REMAINING: float = 0.3
const FRAME_FAIL_CHECK: int = FRAME_FAIL_SETUP + 24
const FRAME_FAIL_RESTART_CHECK: int = FRAME_FAIL_CHECK + 4
const FRAME_FINAL: int = FRAME_FAIL_RESTART_CHECK + 4
## 总帧数上限（超过即出报告，防止死循环；smoke.sh 另有 --quit-after 兜底）。
const TOTAL_FRAMES: int = FRAME_FINAL + 2
## 判定「真的移动了」的最小位移（像素）。
const MIN_MOVE_DISTANCE: float = 1.0

const REQUIRED_ACTIONS: Array[StringName] = [
	&"move_left", &"move_right", &"move_up", &"move_down", &"confirm", &"restart",
]

## 键位契约：动作 → 键表承诺的物理键，**必须全部绑定**（AND 语义，逐键核对）。
## 「D / →」写进文档就是承诺两个键都能用；OR 判定拦不住单键回归（SKILL.md §4.3）。
const KEY_CONTRACT: Dictionary = {
	&"move_left": [KEY_A, KEY_LEFT],
	&"move_right": [KEY_D, KEY_RIGHT],
	&"move_up": [KEY_W, KEY_UP],
	&"move_down": [KEY_S, KEY_DOWN],
	&"confirm": [KEY_SPACE, KEY_ENTER],
	&"restart": [KEY_R],
}

var _failures: PackedStringArray = []
var _frames: int = 0
var _finished: bool = false
var _main: GameMain
var _player: Player
var _crystals: Array[Crystal] = []
var _origin: Vector2 = Vector2.ZERO
var _moved_seen: bool = false
var _score_events: int = 0
var _game_won_seen: bool = false
var _game_lost_seen: bool = false
## 胜利瞬间的愿晶剩余时限基线：胜利后必须冻结（胜局里流星不再消散）。
var _win_lock_remaining: float = -1.0


func _ready() -> void:
	# headless 没有垂直同步，process 帧率可跑到几百上千 FPS，而物理固定 60Hz。
	# `--quit-after N` 数的是 process 帧：限到 60 FPS 让 process 帧 : 物理帧 ≈ 1:1。
	Engine.max_fps = 60

	for action in REQUIRED_ACTIONS:
		if not InputMap.has_action(action):
			_failures.append("InputMap 缺少动作 %s（project.godot [input] 未注册）" % action)
	_check_key_bindings()

	var game_state := get_tree().root.get_node_or_null("GameState")
	if game_state == null:
		_failures.append("autoload GameState 未注册（project.godot [autoload] 缺失）")
	elif not game_state.has_signal("score_changed"):
		_failures.append("autoload GameState 缺少信号 score_changed")
	elif not game_state.has_signal("game_won"):
		_failures.append("autoload GameState 缺少信号 game_won")
	elif not game_state.has_signal("game_lost"):
		_failures.append("autoload GameState 缺少信号 game_lost（一闪即逝判负协议缺失）")
	else:
		game_state.score_changed.connect(_on_score_changed)
		game_state.game_won.connect(_on_game_won)
		game_state.game_lost.connect(_on_game_lost)
		_check_tuning_protocol(game_state)

	var juice := get_tree().root.get_node_or_null("Juice")
	if juice == null:
		_failures.append("autoload Juice 未注册（反馈单例缺失，见 SKILL.md §3B）")

	_main = get_tree().root.find_child("Main", true, false) as GameMain
	if _main == null:
		_failures.append("场景树找不到 Main（smoke.tscn 未实例化 main.tscn，或脚本未挂）")
		_finished = true
		_report()
		return
	_player = _main.player
	if _player == null:
		_failures.append("Main 场景找不到 Player（main.tscn 未实例化 player.tscn）")
	else:
		_player.moved.connect(_on_player_moved)
		_origin = _player.global_position
	for child in _main.crystals.get_children():
		if child is Crystal:
			_crystals.append(child as Crystal)
	if _crystals.size() != GameState.WIN_THRESHOLD:
		_failures.append("场上愿晶数量 %d ≠ 阈值 %d（main.tscn Crystals 节点配置错误）" % [
			_crystals.size(), GameState.WIN_THRESHOLD])


func _physics_process(_delta: float) -> void:
	if _finished:
		return
	_frames += 1

	if _failures.is_empty():
		if _frames <= NOISE_FRAMES:
			_inject_noise_frame()
		elif _frames == FRAME_RELEASE_MOVE:
			Input.action_release(&"move_right")
			_assert_player_moved()
			_press_action(&"restart")
		elif _frames == FRAME_CLEAN_CHECK:
			_assert_clean_start()
			_tap_crystal(_crystals[0])
		elif _frames == FRAME_TAP_SECOND:
			_release_tap()
			_tap_crystal(_crystals[1])
		elif _frames == FRAME_CONFIRM:
			_release_tap()
			_press_action(&"confirm")
		elif _frames == FRAME_WIN_CHECK:
			_assert_win_reached()
		elif _frames == FRAME_OVERFLOW:
			_press_action(&"confirm")
			_tap_crystal(_crystals[0])
			# 冻结基线：胜利后愿晶倒计时必须停摆（胜局里流星不再消散）。
			_win_lock_remaining = _crystals[0].remaining
		elif _frames == FRAME_OVERFLOW_CHECK:
			_release_tap()
			_assert_win_locked()
			_press_action(&"restart")
		elif _frames == FRAME_RESTART_CHECK:
			_assert_restarted()
		elif _frames == FRAME_FAIL_SETUP:
			_setup_fail_phase()
		elif _frames == FRAME_FAIL_CHECK:
			_assert_game_lost()
			_press_action(&"restart")
		elif _frames == FRAME_FAIL_RESTART_CHECK:
			_assert_recovered_from_lost()
		elif _frames == FRAME_FINAL:
			_assert_final()

	if _frames >= TOTAL_FRAMES or not _failures.is_empty():
		_finished = true
		_report()


## ── 断言 ──

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


## 清场后必须回到确定开局：计数 0、未胜、3 颗愿晶全部在野。
func _assert_clean_start() -> void:
	if GameState.score != 0:
		_failures.append("重开后计数应为 0，实际 %d（GameState.reset 未清零或重开未生效）" % GameState.score)
	if GameState.is_won:
		_failures.append("重开后 is_won 应为 false（胜利态未清除）")
	if _active_crystal_count() != _crystals.size():
		_failures.append("重开后在野愿晶 %d/%d（reset_crystal 未复位）" % [
			_active_crystal_count(), _crystals.size()])
	if _main.win_ui.visible:
		_failures.append("重开后胜利画面应隐藏（WinUI.visible 未复位）")


## 胜负可达：三路收集（触摸×2 + confirm×1）后恰好 3/3 即胜。
func _assert_win_reached() -> void:
	if GameState.score != GameState.WIN_THRESHOLD:
		_failures.append("收集断言：三次收集后计数 %d ≠ %d（触摸/confirm 收集路径断裂）" % [
			GameState.score, GameState.WIN_THRESHOLD])
	if not GameState.is_won:
		_failures.append("胜负判定：计数达 %d 但 is_won == false（三颗即胜判定未触发）" % GameState.WIN_THRESHOLD)
	if not _game_won_seen:
		_failures.append("信号 GameState.game_won 未到达订阅方：连接断裂或从未 emit")
	if not _main.win_ui.visible:
		_failures.append("胜利画面未显示（WinUI.visible == false，胜利反馈缺失）")
	if _main.hud_label.text.is_empty() or not _main.hud_label.text.contains("3/3"):
		_failures.append("HUD 未同步进度：文本「%s」不含 3/3（score_changed 订阅未刷新 HUD）" % _main.hud_label.text)


## 胜利封顶：继续收集交互必须完全失效，计数任何情况不得超过 3。
func _assert_win_locked() -> void:
	if GameState.score != GameState.WIN_THRESHOLD:
		_failures.append("胜利封顶：胜利后继续收集使计数 %d ≠ %d（收集交互未失效/计数越界）" % [
			GameState.score, GameState.WIN_THRESHOLD])
	if not GameState.is_won:
		_failures.append("胜利封顶检查期间 is_won 意外翻转为 false")
	# 已收集愿晶直接调 collect() 必须被拒（重复点击不重复计数）。
	if _crystals[0].collect():
		_failures.append("已收集愿晶再次 collect() 返回 true（重复收集未拦截）")
	# 胜利后倒计时冻结：胜局里流星绝不消散（否则胜局还会翻成败局）。
	if not is_equal_approx(_crystals[0].remaining, _win_lock_remaining):
		_failures.append("胜利封顶：愿晶剩余时限 %.3f ≠ 冻结基线 %.3f（胜局倒计时未冻结）" % [
			_crystals[0].remaining, _win_lock_remaining])


## 重开可用：计数清零、胜利态清除、愿晶复位、胜利画面收起。
func _assert_restarted() -> void:
	if GameState.score != 0:
		_failures.append("重开断言：计数应为 0，实际 %d（restart_game 未走 GameState.reset）" % GameState.score)
	if GameState.is_won:
		_failures.append("重开断言：is_won 应为 false（胜利态未清除）")
	if _active_crystal_count() != _crystals.size():
		_failures.append("重开断言：在野愿晶 %d/%d（愿晶未复位）" % [
			_active_crystal_count(), _crystals.size()])
	if _main.win_ui.visible:
		_failures.append("重开断言：胜利画面应隐藏（WinUI.visible 未复位）")


## 败局相位准备：白盒把三颗愿晶剩余时限压到 FAIL_PHASE_REMAINING（测试态注入，
## 与 crystal.collect() 直调同属白盒手段；只影响本相位，restart 后回满）。
func _setup_fail_phase() -> void:
	for crystal in _crystals:
		crystal.remaining = FAIL_PHASE_REMAINING


## 一闪即逝判负：流星消散 → game_lost 送达 → 失败画面可见 → 收集交互全部失效。
func _assert_game_lost() -> void:
	if not GameState.is_lost:
		_failures.append("败局判定：愿晶时限耗尽但 is_lost == false（一闪即逝判负未接线）")
	if not _game_lost_seen:
		_failures.append("信号 GameState.game_lost 未到达订阅方：连接断裂或从未 emit")
	if not _main.game_over_ui.visible:
		_failures.append("失败画面未显示（GameOverUI.visible == false，败局反馈缺失）")
	if GameState.is_won:
		_failures.append("胜负判定：未满 %d 颗却 is_won == true（未满三颗误判胜）" % GameState.WIN_THRESHOLD)
	if GameState.score != 0:
		_failures.append("败局相位计数应为 0，实际 %d（相位被污染）" % GameState.score)
	# 败局后收集交互必须全部失效：白盒直调与点触路径都要被拒。
	for crystal in _crystals:
		if crystal.collect():
			_failures.append("败局后 collect() 返回 true（终局收集未失效）")
			break
	if _main.try_collect_at(_crystals[0].global_position):
		_failures.append("败局后 try_collect_at 仍返回 true（终局点触未失效）")


## 败局重开：败局态清除、失败画面收起、消散愿晶复位、倒计时回满。
func _assert_recovered_from_lost() -> void:
	if GameState.is_lost:
		_failures.append("败局重开：is_lost 应为 false（reset 未清败局态）")
	if _main.game_over_ui.visible:
		_failures.append("败局重开：失败画面应隐藏（GameOverUI.visible 未复位）")
	if _active_crystal_count() != _crystals.size():
		_failures.append("败局重开：在野愿晶 %d/%d（消散愿晶未复位）" % [
			_active_crystal_count(), _crystals.size()])
	for crystal in _crystals:
		if crystal.is_expired:
			_failures.append("败局重开：愿晶仍处消散态（reset_crystal 未清 is_expired）")
			break
		# 容许重开后几帧的自然倒计时损耗，只拦「没回满」。
		if crystal.remaining < 1.0:
			_failures.append("败局重开：愿晶剩余时限 %.2fs 未回满（reset_crystal 未重读调参区）" % crystal.remaining)
			break


## 终局：信号送达 + 反馈挂了（玩起来不是哑的）。
func _assert_final() -> void:
	if not _moved_seen:
		_failures.append("信号 Player.moved 未到达订阅方：连接断裂或从未 emit")
	if _score_events == 0:
		_failures.append("信号 GameState.score_changed 未到达订阅方：连接断裂或从未 emit")
	if not _game_won_seen:
		_failures.append("信号 GameState.game_won 未到达订阅方：连接断裂或从未 emit")
	if not _game_lost_seen:
		_failures.append("信号 GameState.game_lost 未到达订阅方：败局相位未跑或连接断裂")
	if Juice.events.is_empty():
		_failures.append("反馈断言：收集/胜利的结果事件没有触发任何 Juice 反馈"
			+ "（结果性事件必须挂 ≥1 条反馈，见 SKILL.md §3B）")


## ── 工具 ──

func _active_crystal_count() -> int:
	var count: int = 0
	for crystal in _crystals:
		if not crystal.is_collected and not crystal.is_expired:
			count += 1
	return count


## 无显示设备时模拟「玩家按键」：注入真实 InputEvent，让 _unhandled_input 收得到。
## （Input.action_press 只改动作强度，不产生 InputEvent，触发不了 _unhandled_input。）
func _press_action(action: StringName) -> void:
	var event := InputEventAction.new()
	event.action = action
	event.pressed = true
	Input.parse_input_event(event)


## 模拟一次触摸按下（配对 _release_tap 抬起）——走真实输入路径到 try_collect_at。
## ⚠️ 坐标换算（探针实测，headless 4.3）：InputEventScreenTouch 注入的是【窗口坐标】，
## 送达 _unhandled_input 时被 final_transform 的逆变换映射回视口坐标；headless 窗口
## （64x64）与工程视口（360x640）不同，直接注画布坐标会偏到窗外。先经
## get_viewport_transform()（画布→窗口）换算，送达后恰好还原成愿晶位置。
func _tap_crystal(crystal: Crystal) -> void:
	var window_pos: Vector2 = crystal.get_viewport_transform() * crystal.global_position
	var touch := InputEventScreenTouch.new()
	touch.index = 0
	touch.position = window_pos
	touch.pressed = true
	Input.parse_input_event(touch)


func _release_tap() -> void:
	var touch := InputEventScreenTouch.new()
	touch.index = 0
	touch.position = Vector2.ZERO
	touch.pressed = false
	Input.parse_input_event(touch)


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


## 调参工作台协议（SKILL.md §3C，纯逻辑、无头可判）：
## TUNING_META 非空；apply_tuning 应用已声明键、拒绝未声明键、按 max 钳制。
## ⚠️ 检查完必须把调过的值恢复原状 —— 协议检查不得污染被测状态。
func _check_tuning_protocol(game_state: Node) -> void:
	var meta: Variant = game_state.get("TUNING_META")
	if meta is Dictionary and not (meta as Dictionary).is_empty():
		var original_speed: Variant = game_state.get("move_speed")
		var applied: PackedStringArray = game_state.call("apply_tuning", {"move_speed": 99999.0, "tuning_bogus_key": 1})
		if not applied.has("move_speed"):
			_failures.append("调参协议：apply_tuning 未应用已声明键 move_speed（应用逻辑断裂）")
		if applied.has("tuning_bogus_key"):
			_failures.append("调参协议：apply_tuning 应用了未声明键 tuning_bogus_key（必须只认 TUNING_META 声明的键）")
		var speed: Variant = game_state.get("move_speed")
		if not (speed is float or speed is int) or float(speed) > 600.0:
			_failures.append("调参协议：move_speed=%s 超出 TUNING_META.max=600（钳制缺失）" % [speed])
		if applied.has("move_speed") and original_speed != null:
			game_state.set("move_speed", original_speed)
	else:
		_failures.append("调参协议：GameState.TUNING_META 为空或不可读（数值调参区必须声明至少一个可调键，见 SKILL.md §3C）")


func _report() -> void:
	if _failures.is_empty():
		print("GODOT_SMOKE: PASS 场景实例化/autoload/输入映射/物理移动/触摸收集/三颗即胜/胜利封顶/重开复位/一闪即逝判负/败局重开/反馈触发/调参协议 全部通过")
		get_tree().quit(0)
	else:
		for failure in _failures:
			printerr("GODOT_SMOKE: FAIL %s" % failure)
		get_tree().quit(1)


func _on_player_moved(_position: Vector2) -> void:
	_moved_seen = true


func _on_score_changed(_score: int) -> void:
	_score_events += 1


func _on_game_won(_score: int) -> void:
	_game_won_seen = true


func _on_game_lost() -> void:
	_game_lost_seen = true


## ── 噪声相位：确定种子随机事件（原始事件，不含 InputEventAction）──
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
