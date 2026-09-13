extends Node
## 无头冒烟自检（headless smoke）——《Soccer》11 人足球。
##
## 运行方式（由 std-skills/godot-game-dev/scripts/smoke.sh 封装）：
##   godot --headless --path <工程目录> tests/smoke.tscn
##
## 判定协议（smoke.sh 按此断言退出码与日志）：
##   通过 → stdout 打印 `GODOT_SMOKE: PASS ...`，进程退出码 0
##   失败 → stderr 打印 `GODOT_SMOKE: FAIL <原因>`（每条一行），进程退出码 1
##
## 断言覆盖（对应本游戏验收标准的可无头判定项）：
##   1. 场景接线：主场景可实例化，两队各 11 人 + 足球 + HUD 齐全
##   2. autoload GameState 已注册且带约定信号（score_changed / match_finished / phase_changed）
##   3. InputMap 十一个动作已注册、物理键绑定逐键核对（键位契约 AND 语义）
##   4. 玩家能移动：注入 move_right 后受控球员真实位移，moved 信号到达订阅方
##   5. 核心交互：J 传球（球脱离脚下、kicked 信号、自由球被拿走），K 射门（球进门、比分更新并重新开球）
##   6. 规则事件：球出边线判界外球；守方最后触球出底线判角球；攻方最后触球出底线判球门球
##   7. 胜负可达：全场计时打满 → match_finished、终场结算文案 + 结算面板（比分 + 胜/平/负）
##   8. 重开可用：R 重开后比分/计时/球位/阶段复位，结算面板收起
##   9. 难度梯度：C 连切后 GameState.difficulty / HUD 设置行 / 客队 AI 移速系数同步变化
##  10. 时长可配置：L 切档后 match_real_seconds() 与 HUD 设置行同步变化
##  11. 音效门控（v2）：AudioManager 未交互时 unlocked=false；M 键解锁且静音往返生效；
##      开球哨/传球/踢球/进球+欢呼分层/确定性贴身抢断/终场哨事件音逐项触发记账；
##      HUD 解锁提示初始可见、解锁后隐藏（v2.1 移动端无声修复的指引断言）
##  12. 触摸操作（v2）：触屏层存在且无触屏环境默认隐藏；射门/切换按钮触摸与键盘同路径
##      生效（射门按钮直接驱动「射门→进球」断言）；虚拟摇杆拖动真实驱动受控球员位移；
##      双指同时按压（摇杆 + 传球按钮）无事件丢失
##  13. 结算「再来一局」按钮（v3）：终场可见且触达区域 ≥44x44、不遮挡结算面板；
##      鼠标点击按钮触发重开（比分/计时/球位复位、面板收起）；重开回到终场后触摸点击
##      同样触发重开（注入 restart 动作，与键盘 R 同路径）；比赛进行中按钮隐藏且
##      点击无效（可见性纪律）
##
## ⚠️ 帧预算纪律：v1 行为断言已用 ~223/240 帧，v2 断言必须「寄生」在既有等待窗口
##   （音频解锁塞进 OOB 冻结窗、触摸按钮合并进射门/传球流程），并把
##   kickoff_delay/restart_delay 压小（SETUP 阶段设 var，真实对局默认值不变）。
##
## ⚠️ 输入注入分阶段互不重叠（references/error-signatures.md E-08）：
##   `Input.parse_input_event()` 的缓冲冲刷会清掉 `Input.action_press()` 的按下状态，
##   两者同帧混用会让移动断言假失败 —— 移动阶段结束后才注入动作事件。

## 阶段：按住 move_right 让受控球员移动的帧数。
const MOVE_FRAMES: int = 12
## 判定「真的移动了」的最小位移（像素）。
const MIN_MOVE_DISTANCE: float = 20.0
## 等待开球进入 PLAYING 的帧数上限。
const WAIT_PLAYING_CAP: int = 90
## 等待自由球被拿走的帧数上限。
const WAIT_CAPTURE_CAP: int = 80
## 等待射门进球的帧数上限。
const GOAL_CAP: int = 90
## 短等待（事件生效 / 死球重发）帧数上限。
const RESTART_WAIT_CAP: int = 60
const SHORT_CAP: int = 8

const REQUIRED_ACTIONS: Array[StringName] = [
	&"move_left", &"move_right", &"move_up", &"move_down",
	&"pass", &"shoot", &"switch_player", &"restart", &"confirm",
	&"difficulty_next", &"match_length_next", &"toggle_mute",
]

## 键位契约：动作 → project.godot [input] 承诺的全部物理键（AND 语义，逐键核对）。
## 文档键表写「Q / Tab」就是承诺两个键都能用；「绑了其中一个就算过」拦不住单键回归。
const KEY_CONTRACT: Dictionary = {
	&"move_left": [KEY_A, KEY_LEFT],
	&"move_right": [KEY_D, KEY_RIGHT],
	&"move_up": [KEY_W, KEY_UP],
	&"move_down": [KEY_S, KEY_DOWN],
	&"pass": [KEY_J],
	&"shoot": [KEY_K],
	&"switch_player": [KEY_Q, KEY_TAB],
	&"restart": [KEY_R],
	&"confirm": [KEY_ENTER, KEY_SPACE],
	&"difficulty_next": [KEY_C],
	&"match_length_next": [KEY_L],
	&"toggle_mute": [KEY_M],
}

## 触摸断言常量：摇杆拖动行程（画布像素）/ 判定「摇杆驱动了位移」的最小位移 /
## 双指触点 index（与引擎触点无冲突的任意值）。
const JOY_DRAG_OFFSET: float = 62.0
const MIN_JOY_MOVE_DISTANCE: float = 10.0
const JOY_TOUCH_INDEX: int = 5
const BTN_TOUCH_BASE: int = 6

enum Stage {
	SETUP_INJECT, SETUP_DIFF, SETUP_ASSERT, SETUP_RESTORE,
	WAIT_KICKOFF_PLAYING, MOVE_HOLD, MOVE_ASSERT, PASS_INJECT, WAIT_CAPTURE,
	GOAL_SETUP, GOAL_WAIT, OOB_WAIT_PLAYING, OOB_INJECT, OOB_ASSERT,
	CORNER_PREP, CORNER_INJECT, CORNER_ASSERT,
	GOALKICK_PREP, GOALKICK_INJECT, GOALKICK_ASSERT,
	FINISH_PREP, STEAL_WAIT, FINISH_WAIT,
	BTN_FINISH_ASSERT, BTN_MOUSE_PRESS, BTN_MOUSE_ASSERT, BTN_RECYCLE_WAIT, BTN_HIDDEN_PROBE,
	BTN_RECYCLE_FINISH, BTN_TOUCH_PRESS, RESTART_ASSERT, DONE,
}

var _failures: PackedStringArray = []
var _stage: int = Stage.WAIT_KICKOFF_PLAYING
var _stage_frames: int = 0
var _main: Node2D = null
var _ball: Ball = null
var _origin: Vector2 = Vector2.ZERO
var _kicker: Footballer = null
var _score_before: int = 0
var _moved_seen: bool = false
var _kicked_seen: bool = false
var _score_seen: bool = false
var _finish_seen: bool = false
var _audio: Node = null
var _touch: TouchControls = null
var _passer: Footballer = null
var _switch_before: Footballer = null
var _joy_origin: Vector2 = Vector2.ZERO
var _mute_seen: bool = false
var _joy_checked: bool = false
var _unmute_seen: bool = false
var _result: ResultControls = null


func _ready() -> void:
	# headless 没有垂直同步，限到 60 FPS 让 process 帧 : 物理帧 ≈ 1:1，
	# --quit-after 的兜底才有意义（模板既有做法）。
	Engine.max_fps = 60
	_static_checks()
	if _failures.is_empty():
		_report_stage_progress()


## 静态接线断言：场景树 / autoload / InputMap / 键位契约。
func _static_checks() -> void:
	for action in REQUIRED_ACTIONS:
		if not InputMap.has_action(action):
			_failures.append("InputMap 缺少动作 %s（project.godot [input] 未注册）" % action)
	_check_key_bindings()

	var game_state := get_tree().root.get_node_or_null("GameState")
	if game_state == null:
		_failures.append("autoload GameState 未注册（project.godot [autoload] 缺失）")
	else:
		for expected_signal in ["score_changed", "match_finished", "phase_changed"]:
			if not game_state.has_signal(expected_signal):
				_failures.append("autoload GameState 缺少信号 %s" % expected_signal)
		game_state.score_changed.connect(_on_score_changed)
		game_state.match_finished.connect(_on_match_finished)

	_main = get_tree().root.find_child("Main", true, false) as Node2D
	if _main == null:
		_failures.append("场景树找不到 Main（smoke.tscn 未实例化 scenes/main.tscn）")
		return
	var ball_node: Node = _main.get("ball")
	if ball_node == null:
		_failures.append("Main.ball 为空（main.tscn 未实例化 scenes/ball.tscn）")
	else:
		_ball = ball_node as Ball
		if _ball == null:
			_failures.append("Main.ball 不是 Ball 类型（scripts/ball.gd 未挂上）")
		else:
			_ball.kicked.connect(_on_ball_kicked)

	var home: Array = _main.get("home_players")
	var away: Array = _main.get("away_players")
	if home == null or away == null:
		_failures.append("Main.home_players / away_players 不存在（队伍未生成）")
	else:
		if home.size() != 11 or away.size() != 11:
			_failures.append("两队应各 11 人（含门将），实际 主 %d / 客 %d" % [home.size(), away.size()])
		for p: Footballer in home:
			p.moved.connect(_on_player_moved)
	if _main.get("controlled") == null:
		_failures.append("Main.controlled 为空（没有受控球员，玩家无法操作）")
	if _main.get("score_label") == null or _main.get("clock_label") == null or _main.get("message_label") == null:
		_failures.append("HUD Label 缺失（ScoreLabel / ClockLabel / MessageLabel 未接线）")
	if _main.get("difficulty_label") == null:
		_failures.append("设置行 Label 缺失（DifficultyLabel 未接线：难度/时长切换无可见反馈）")
	if _main.get("result_panel") == null or _main.get("result_score") == null or _main.get("result_hint") == null:
		_failures.append("终场结算面板缺失（ResultPanel / ResultScore / ResultHint 未接线）")

	# ---- v2：音频层接线 ----
	_audio = get_tree().root.get_node_or_null("AudioManager")
	if _audio == null:
		_failures.append("autoload AudioManager 未注册（project.godot [autoload] 缺失）")
	else:
		for expected_signal in ["unlocked_changed", "mute_changed"]:
			if not _audio.has_signal(expected_signal):
				_failures.append("autoload AudioManager 缺少信号 %s" % expected_signal)
		if (_audio.get("streams") as Dictionary).size() < 8:
			_failures.append("AudioManager 音效流加载不足 8 个（assets/audio/*.wav 缺失或未导入）")
		if bool(_audio.get("unlocked")):
			_failures.append("AudioManager 初始即已解锁（Web 自动播放门控失效：应等首次用户交互）")
		# v2.1 F4：解锁前 HUD 必须有「开启音效」指引（移动端无声时玩家至少知道为什么）。
		var unlock_hint := _main.get("unlock_hint") as Control
		if unlock_hint == null:
			_failures.append("HUD UnlockHint 缺失（解锁前无「开启音效」指引，%UnlockHint 未接线）")
		elif not unlock_hint.visible:
			_failures.append("AudioManager.unlocked=false 时解锁提示应可见（指引未随门控初始化）")
		_audio.mute_changed.connect(_on_audio_mute_changed_smoke)

	# ---- v2：触摸层接线（headless 无触屏 → 默认必须隐藏；按钮布局三项齐全）----
	var touch := _main.get("touch_controls") as TouchControls
	if touch == null:
		_failures.append("Main.touch_controls 缺失（main.tscn 未实例化 scenes/touch_controls.tscn）")
	else:
		_touch = touch
		for action: StringName in [&"shoot", &"pass", &"switch_player"]:
			if touch.button_radius(action) <= 0.0:
				_failures.append("TouchControls 按钮布局缺少 %s（BUTTON_LAYOUT 不完整）" % action)
		if touch.visible:
			_failures.append("无触屏环境（headless）TouchControls 默认可见（桌面键盘环境被触摸层干扰）")
	if _main.get("mute_button") == null:
		_failures.append("HUD MuteButton 缺失（静音开关没有入口）")

	# ---- v3：终场结算「再来一局」按钮接线（触摸 + 鼠标同一入口）----
	_result = _main.get("result_controls") as ResultControls
	if _result == null:
		_failures.append("Main.result_controls 缺失（main.tscn 未实例化 scenes/result_controls.tscn）")
	else:
		if _result.ACTION != &"restart" or not InputMap.has_action(&"restart"):
			_failures.append("「再来一局」按钮未对准既有重开动作 restart（应与键盘 R 走同一 InputMap 动作）")
		var btn_size := _result.button_size()
		if btn_size.x < _result.MIN_TOUCH_SIZE or btn_size.y < _result.MIN_TOUCH_SIZE:
			_failures.append("「再来一局」触达区域 %s < %.0fx%.0f（触控最小触达标准）" % [
				str(btn_size), _result.MIN_TOUCH_SIZE, _result.MIN_TOUCH_SIZE,
			])
		if _result.visible:
			_failures.append("比赛进行中「再来一局」按钮即已可见（可见性纪律：仅终场结算出现）")


## AudioManager.mute_changed 的冒烟侧记录器：断言「静音往返都真的发生了」。
func _on_audio_mute_changed_smoke(muted: bool) -> void:
	if muted:
		_mute_seen = true
	else:
		_unmute_seen = true


func _physics_process(_delta: float) -> void:
	if _stage == Stage.DONE:
		return
	_stage_frames += 1
	if not _failures.is_empty():
		_report()
		return

	match _stage:
		Stage.SETUP_INJECT:
			# 开球冻结期注入设置类按键（不占等待帧预算）：难度连切两档。
			_press_action(&"difficulty_next")
			_next(Stage.SETUP_DIFF)
		Stage.SETUP_DIFF:
			_press_action(&"difficulty_next")
			_press_action(&"match_length_next")
			_next(Stage.SETUP_ASSERT)
		Stage.SETUP_ASSERT:
			# 初始 普通(1) 连切两次 → 简单(0)；时长 标准(1) 切一档 → 长场(360s)。
			if GameState.difficulty != GameState.Difficulty.EASY:
				_failures.append("难度切换未生效：连按两次 C 后应为「简单」，实际 difficulty=%d" % GameState.difficulty)
			if not is_equal_approx(GameState.match_real_seconds(), 360.0):
				_failures.append("时长切换未生效：按 L 后应为长场 360 秒，实际 %.0f 秒" % GameState.match_real_seconds())
			var setup_text := String(_main.get("difficulty_label").text)
			if not setup_text.contains("简单") or not setup_text.contains("6 分钟"):
				_failures.append("HUD 设置行未随难度/时长刷新（text='%s'）" % setup_text)
			if not is_equal_approx(GameState.ai_speed_factor(1), GameState.DIFFICULTY_AI_SPEED[GameState.Difficulty.EASY]):
				_failures.append("客队 AI 移速系数未按难度梯度变化（%.2f）" % GameState.ai_speed_factor(1))
			_press_action(&"difficulty_next")  # 切回普通档，后续行为断言按默认梯度跑
			_next(Stage.SETUP_RESTORE)
		Stage.SETUP_RESTORE:
			if GameState.difficulty != GameState.Difficulty.NORMAL:
				_failures.append("难度回切未生效：应为「普通」，实际 difficulty=%d" % GameState.difficulty)
			_next(Stage.WAIT_KICKOFF_PLAYING)
		Stage.WAIT_KICKOFF_PLAYING:
			if _stage_frames == 1:
				# v2：触摸断言需要触屏层可见（headless 默认隐藏）；同时压小后续死球等待，
				# 给 v2 新增断言腾出帧预算（var 默认值不变，真实对局节奏不受影响）。
				_touch.force_visible = true
				_touch.update_visibility()
				_main.set("kickoff_delay", 0.25)
				_main.set("restart_delay", 0.25)
			if GameState.phase == GameState.Phase.PLAYING:
				_origin = (_main.get("controlled") as Footballer).global_position
				Input.action_press(&"move_right")
				_next(Stage.MOVE_HOLD)
			elif _stage_frames > WAIT_PLAYING_CAP:
				_failures.append("开球后 %d 帧仍未进入 PLAYING（kickoff 流程断裂）" % WAIT_PLAYING_CAP)
				_report()
		Stage.MOVE_HOLD:
			if _stage_frames >= MOVE_FRAMES:
				Input.action_release(&"move_right")
				_next(Stage.MOVE_ASSERT)
		Stage.MOVE_ASSERT:
			var player := _main.get("controlled") as Footballer
			var travelled: float = player.global_position.distance_to(_origin)
			if travelled < MIN_MOVE_DISTANCE:
				_failures.append("玩家 %d 帧内位移 %.2fpx < %.2fpx：InputMap 动作未生效或移动逻辑未驱动" % [
					MOVE_FRAMES, travelled, MIN_MOVE_DISTANCE,
				])
			if not _moved_seen:
				_failures.append("信号 Footballer.moved 未到达订阅方：连接断裂或受控球员从未 emit")
			if int((_audio.get("played_counts") as Dictionary).get(&"whistle_kickoff", 0)) < 1:
				_failures.append("开球 whistle_kickoff 事件音未触发（kickoff → AudioManager 接线断裂）")
			if not _touch.visible:
				_failures.append("TouchControls.force_visible=%s 但 visible=%s（update_visibility 失效或未执行）" % [
					str(_touch.force_visible), str(_touch.visible),
				])
			_next(Stage.PASS_INJECT)
		Stage.PASS_INJECT:
			_kicker = _main.get("controlled") as Footballer
			if _ball.holder != _kicker:
				_failures.append("开球后受控球员脚下无球（kickoff 的 give_to 接线断裂），无法断言传球")
				_report()
				return
			# v2：双指同时操作 —— 第一根手指按住摇杆右拖（移动），第二根手指按传球按钮。
			# 传球经触摸按钮注入 InputEventAction，与键盘 J 走同一条 Main._unhandled_input 路径。
			_passer = _kicker
			_joy_origin = _kicker.global_position
			_joy_checked = false
			_touch_press(JOY_TOUCH_INDEX, _touch.JOY_CENTER)
			_touch_drag(JOY_TOUCH_INDEX, _touch.JOY_CENTER + Vector2(JOY_DRAG_OFFSET, 0.0))
			_next(Stage.WAIT_CAPTURE)
		Stage.WAIT_CAPTURE:
			# 传球按钮延迟 3 帧再按：保证摇杆先积累出可判定的位移量。
			if _stage_frames == 3:
				_touch_press(BTN_TOUCH_BASE + 2, _touch.button_center(&"pass"))
			# 第 8 帧断言摇杆向量并释放：传球者随即停住，避免冷却结束后追回自己的传球。
			if _stage_frames >= 8 and not _joy_checked:
				_joy_checked = true
				if _touch.joystick_vector.x < 0.5:
					_failures.append("双指场景摇杆向量未生效（joystick_vector.x=%.2f）：ScreenTouch/Drag 未被触摸层接管" % _touch.joystick_vector.x)
				_touch_release(JOY_TOUCH_INDEX)
			if _ball.holder != null and _ball.holder != _kicker:
				# 自由球被别的球员拿走 → 传球闭环完成。
				if not _kicked_seen:
					_failures.append("球已离脚但 Ball.kicked 未到达订阅方（信号接线断裂）")
					_report()
				else:
					if not _joy_checked:
						_joy_checked = true
						if _touch.joystick_vector.x < 0.5:
							_failures.append("双指场景摇杆向量未生效（joystick_vector.x=%.2f）" % _touch.joystick_vector.x)
						_touch_release(JOY_TOUCH_INDEX)
					var joy_travelled: float = _passer.global_position.distance_to(_joy_origin)
					if joy_travelled < MIN_JOY_MOVE_DISTANCE:
						_failures.append("摇杆拖动仅使球员位移 %.2fpx < %.2fpx：摇杆未驱动 InputMap 移动动作" % [
							joy_travelled, MIN_JOY_MOVE_DISTANCE,
						])
					if int((_audio.get("played_counts") as Dictionary).get(&"pass", 0)) < 1:
						_failures.append("传球 pass 事件音未触发（触摸按钮 → _do_pass → AudioManager 接线断裂）")
					_touch_release(BTN_TOUCH_BASE + 2)
					_next(Stage.GOAL_SETUP)
			elif not _kicked_seen and _stage_frames > SHORT_CAP:
				_failures.append("pass 动作 %d 帧内未触发 Ball.kicked（_unhandled_input 或 _do_pass 接线断裂）" % SHORT_CAP)
				_report()
			elif _kicked_seen and _ball.holder == null and _stage_frames > WAIT_CAPTURE_CAP:
				_failures.append("传球后 %d 帧内没有球员拿到自由球（控球判定 capture 断裂）" % WAIT_CAPTURE_CAP)
				_report()
			elif _stage_frames > WAIT_CAPTURE_CAP:
				_failures.append("传球闭环 %d 帧未完成（球被踢球者自己追回或 capture 异常）" % WAIT_CAPTURE_CAP)
				_report()
		Stage.GOAL_SETUP:
			var gk := _main.call("gk_of", 1) as Footballer
			if gk == null:
				_failures.append("Main.gk_of(1) 未返回客队门将")
				_report()
				return
			# 把客队门将调离右门（并受门将活动范围钳制在远离射门路径处），
			# 保证「射门 → 进球」在无头环境确定性发生。
			gk.global_position = Vector2(1040, 504)
			var shooter := _main.get("controlled") as Footballer
			if shooter == null:
				_failures.append("受控球员丢失，无法断言射门")
				_report()
				return
			shooter.global_position = Vector2(1030, 360)
			_ball.give_to(shooter)
			_ball.global_position = Vector2(1044, 360)
			_score_before = GameState.home_score
			_switch_before = shooter
			# v2：射门改由触摸按钮驱动（与键盘 K 同一条 InputEventAction 路径），
			# 「射门 → 进球」断言同时验证触摸按钮接线。
			_touch_press(BTN_TOUCH_BASE, _touch.button_center(&"shoot"))
			_next(Stage.GOAL_WAIT)
		Stage.GOAL_WAIT:
			# 触摸切换按钮：进球等待期内（PLAYING）按下，断言受控球员被切换。
			if _stage_frames == 2:
				_touch_press(BTN_TOUCH_BASE + 1, _touch.button_center(&"switch_player"))
			if _stage_frames == 5:
				if (_main.get("controlled") as Footballer) == _switch_before:
					_failures.append("切换按钮触摸未切换受控球员（按钮 → InputEventAction → Main 接线断裂）")
				_touch_release(BTN_TOUCH_BASE + 1)
			if GameState.home_score > _score_before:
				if not _score_seen:
					_failures.append("比分更新了但 GameState.score_changed 未到达订阅方")
				if GameState.phase != GameState.Phase.KICKOFF:
					_failures.append("进球后未重新开球（phase 应为 KICKOFF，实际 %d）" % GameState.phase)
				var goal_counts: Dictionary = _audio.get("played_counts")
				if int(goal_counts.get(&"kick", 0)) < 1:
					_failures.append("射门 kick 事件音未触发（触摸按钮 → _do_shoot → AudioManager 接线断裂）")
				if int(goal_counts.get(&"goal", 0)) < 1:
					_failures.append("进球 goal 事件音未触发（_apply_rules → AudioManager 接线断裂）")
				if int(goal_counts.get(&"crowd_cheer", 0)) < 1:
					_failures.append("进球时人群欢呼未与 goal 分层叠加（play_goal 断裂）")
				_touch_release(BTN_TOUCH_BASE)
				_next(Stage.OOB_WAIT_PLAYING)
			elif _stage_frames > GOAL_CAP:
				_failures.append("射门后 %d 帧内未进球（进球判定 is_goal_position / shoot 接线断裂）" % GOAL_CAP)
				_report()
		Stage.OOB_WAIT_PLAYING:
			# v2：借用本冻结窗（kickoff 等待 ~15 帧）做音频解锁断言 —— M 键按下属真实
			# 用户交互，应解锁 AudioManager；再按一次恢复。断言在窗内第 7 帧完成。
			if _stage_frames == 1:
				_inject_key(KEY_M)   # 解锁 + 静音
			elif _stage_frames == 3:
				_inject_key(KEY_M)   # 取消静音
			elif _stage_frames == 7:
				if not bool(_audio.get("unlocked")):
					_failures.append("M 键按下后 AudioManager 未解锁（首次用户交互解锁门控失效）")
				var hint := _main.get("unlock_hint") as Control
				if hint != null and hint.visible:
					_failures.append("M 键解锁后 HUD 解锁提示未隐藏（unlocked_changed 订阅断裂）")
				if not _mute_seen or not _unmute_seen:
					_failures.append("M 键静音往返不完整（mute_changed 未先后发出 静音/取消）")
				if bool(_audio.get("muted")):
					_failures.append("第二次 M 键后仍处于静音（静音开关不可逆）")
				# 半场哨没有自然时间点可等（要拨表穿过半场），做 API 级断言。
				_audio.call("play_whistle", 1)   # AudioManager.Whistle.HALFTIME
				if int((_audio.get("played_counts") as Dictionary).get(&"whistle_halftime", 0)) < 1:
					_failures.append("play_whistle(HALFTIME) 未触发记账（play API 断裂）")
			if GameState.phase == GameState.Phase.PLAYING:
				_next(Stage.OOB_INJECT)
			elif _stage_frames > WAIT_PLAYING_CAP:
				_failures.append("进球重新开球后 %d 帧未恢复 PLAYING" % WAIT_PLAYING_CAP)
				_report()
		Stage.OOB_INJECT:
			# 直接把自由球扔出边线：应判界外球并由对方（主队）重发。
			_ball.holder = null
			_ball.velocity = Vector2.ZERO
			_ball.capture_lock_team = -1
			_ball.last_touch_team = 1
			_ball.global_position = Vector2(640, 60)
			_next(Stage.OOB_ASSERT)
		Stage.OOB_ASSERT:
			if GameState.phase == GameState.Phase.RESTART \
					and String(_main.get("message_label").text).contains("界外球") \
					and _ball.global_position.y > 60.0:
				_next(Stage.CORNER_PREP)
			elif _stage_frames > SHORT_CAP:
				_failures.append("球出边线未判界外球（phase=%d message='%s'）—— 出界规则断裂" % [
					GameState.phase, String(_main.get("message_label").text),
				])
				_report()
		Stage.CORNER_PREP:
			if GameState.phase == GameState.Phase.PLAYING:
				# 守方（上半场主队守左门）最后触球、球出左底线非进球区 → 角球给攻方（客队）。
				_ball.holder = null
				_ball.velocity = Vector2.ZERO
				_ball.capture_lock_team = -1
				_ball.last_touch_team = 0
				_ball.global_position = Vector2(92, 110)
				_next(Stage.CORNER_ASSERT)
			elif _stage_frames > RESTART_WAIT_CAP:
				_failures.append("界外球重发后 %d 帧未恢复 PLAYING，无法断言角球" % RESTART_WAIT_CAP)
				_report()
		Stage.CORNER_ASSERT:
			if GameState.phase == GameState.Phase.RESTART \
					and String(_main.get("message_label").text).contains("角球"):
				_next(Stage.GOALKICK_PREP)
			elif _stage_frames > SHORT_CAP:
				_failures.append("守方最后触球出底线未判角球（phase=%d message='%s'）—— 角球规则断裂" % [
					GameState.phase, String(_main.get("message_label").text),
				])
				_report()
		Stage.GOALKICK_PREP:
			if GameState.phase == GameState.Phase.PLAYING:
				# 攻方（上半场客队攻左门）最后触球、球出左底线非进球区 → 球门球给守方（主队）门将。
				_ball.holder = null
				_ball.velocity = Vector2.ZERO
				_ball.capture_lock_team = -1
				_ball.last_touch_team = 1
				_ball.global_position = Vector2(92, 110)
				_next(Stage.GOALKICK_ASSERT)
			elif _stage_frames > RESTART_WAIT_CAP:
				_failures.append("角球重发后 %d 帧未恢复 PLAYING，无法断言球门球" % RESTART_WAIT_CAP)
				_report()
		Stage.GOALKICK_ASSERT:
			if GameState.phase == GameState.Phase.RESTART \
					and String(_main.get("message_label").text).contains("球门球"):
				_next(Stage.FINISH_PREP)
			elif _stage_frames > SHORT_CAP:
				_failures.append("攻方最后触球出底线未判球门球（phase=%d message='%s'）—— 球门球规则断裂" % [
					GameState.phase, String(_main.get("message_label").text),
				])
				_report()
		Stage.FINISH_PREP:
			if GameState.phase == GameState.Phase.PLAYING:
				# v2：恢复 PLAYING 的第一帧做确定性抢断 —— 球门球后门将在本方禁区持球
				# （GK_HOLD_TIME 0.7s ≫ 抢断耗时），把客队中场传送到球旁即可稳定触发。
				var holder := _ball.holder
				var thief: Footballer = (_main.get("away_players") as Array)[5]
				if holder != null and thief != null:
					thief.global_position = _ball.global_position + Vector2(12.0, 0.0)
				_next(Stage.STEAL_WAIT)
			elif _stage_frames > RESTART_WAIT_CAP:
				_failures.append("界外球重发后 %d 帧未恢复 PLAYING" % RESTART_WAIT_CAP)
				_report()
		Stage.STEAL_WAIT:
			if int((_audio.get("played_counts") as Dictionary).get(&"steal", 0)) >= 1:
				# 把时钟拨过全场终点，让自然计时流程走完最后一帧。
				GameState.elapsed = GameState.match_real_seconds() + 0.5
				_next(Stage.FINISH_WAIT)
			elif _stage_frames > 45:
				_failures.append("贴身 45 帧未产生抢断音（抢断判定或 _update_possession → play_steal 接线断裂）")
				_report()
		Stage.FINISH_WAIT:
			if GameState.phase == GameState.Phase.FINISHED and _finish_seen:
				if not String(_main.get("message_label").text).contains("全场"):
					_failures.append("终场未展示结算文案（HUD MessageLabel 未接 match_finished）")
				if int((_audio.get("played_counts") as Dictionary).get(&"whistle_fulltime", 0)) < 1:
					_failures.append("终场哨 whistle_fulltime 未触发（_on_match_finished → AudioManager 接线断裂）")
				var panel := _main.get("result_panel") as Control
				if panel == null or not panel.visible:
					_failures.append("终场结算面板未显示（胜负反馈缺失：ResultPanel 未接 match_finished）")
				else:
					var result_text := String(_main.get("result_score").text)
					if not result_text.contains(GameState.result_for_home()):
						_failures.append("结算面板未给出胜/平/负结论（text='%s'，期望含'%s'）" % [
							result_text, GameState.result_for_home(),
						])
					if not String(_main.get("result_hint").text).contains("Enter"):
						_failures.append("结算面板缺少重开入口提示（ResultHint 未接线）")
				_next(Stage.BTN_FINISH_ASSERT)
			elif _stage_frames > SHORT_CAP:
				_failures.append("计时打满后未进入 FINISHED 或 match_finished 信号未达（终场流程断裂）")
				_report()
		Stage.BTN_FINISH_ASSERT:
			# v3：终场结算画面按钮断言（可见性 / 触达面积 / 不遮挡结算面板 / 入口提示）。
			if not _result.visible:
				_failures.append("终场结算「再来一局」按钮未显示（match_finished 未置 result_controls.set_active(true)）")
			if _result.button_size().x < _result.MIN_TOUCH_SIZE or _result.button_size().y < _result.MIN_TOUCH_SIZE:
				_failures.append("「再来一局」触达区域不足 44x44（结算画面实测 %s）" % str(_result.button_size()))
			var panel := _main.get("result_panel") as Control
			if panel != null and panel.visible and panel.get_global_rect().intersects(_result.button_rect()):
				_failures.append("「再来一局」按钮遮挡结算面板（button=%s panel=%s）" % [
					str(_result.button_rect()), str(panel.get_global_rect()),
				])
			if not String(_main.get("result_hint").text).contains("再来一局"):
				_failures.append("结算面板未提示「再来一局」按钮入口（ResultHint 文案缺失）")
			_next(Stage.BTN_MOUSE_PRESS)
		Stage.BTN_MOUSE_PRESS:
			# 桌面鼠标点击同一按钮：InputEventMouseButton 与触摸走同一 _press_at 入口。
			_mouse_button(_result.button_center(), true)
			_next(Stage.BTN_MOUSE_ASSERT)
		Stage.BTN_MOUSE_ASSERT:
			if _stage_frames >= 2:
				if GameState.phase != GameState.Phase.KICKOFF:
					_failures.append("鼠标点击「再来一局」未触发重开（phase=%d，应为 KICKOFF）" % GameState.phase)
				elif GameState.home_score != 0 or GameState.away_score != 0:
					_failures.append("鼠标重开后比分未清零（主 %d : %d 客）" % [GameState.home_score, GameState.away_score])
				elif _result.visible:
					_failures.append("鼠标重开后「再来一局」按钮仍可见（set_active(false) 未随 restart_match 执行）")
				_next(Stage.BTN_RECYCLE_WAIT)
		Stage.BTN_RECYCLE_WAIT:
			if GameState.phase == GameState.Phase.PLAYING:
				# 惰性探针：按钮已随重开隐藏，点原按钮位置（鼠标 + 触摸）必须无效。
				_mouse_button(_result.button_center(), true)
				_touch_press(BTN_TOUCH_BASE + 4, _result.button_center())
				_next(Stage.BTN_HIDDEN_PROBE)
			elif _stage_frames > WAIT_PLAYING_CAP:
				_failures.append("鼠标重开后 %d 帧未恢复 PLAYING，无法断言触摸重开" % WAIT_PLAYING_CAP)
				_report()
		Stage.BTN_HIDDEN_PROBE:
			if _stage_frames >= 3:
				if GameState.phase != GameState.Phase.PLAYING:
					_failures.append("隐藏态点击原按钮位置触发了重开（可见性纪律失效，phase=%d）" % GameState.phase)
				if GameState.elapsed <= 0.0:
					_failures.append("隐藏态点击疑似触发重开（计时被清零，elapsed=%.2f）" % GameState.elapsed)
				_mouse_button(_result.button_center(), false)
				_touch_release(BTN_TOUCH_BASE + 4)
				# 再拨表打满一次全场，为「触摸点击重开」再造终场结算窗口。
				GameState.elapsed = GameState.match_real_seconds() + 0.5
				_next(Stage.BTN_RECYCLE_FINISH)
		Stage.BTN_RECYCLE_FINISH:
			if GameState.phase == GameState.Phase.FINISHED:
				if not _result.visible:
					_failures.append("第二次终场「再来一局」按钮未重新显示（可见性未随终场恢复）")
				_next(Stage.BTN_TOUCH_PRESS)
			elif _stage_frames > SHORT_CAP:
				_failures.append("拨表后未再次进入 FINISHED（phase=%d，终场流程断裂）" % GameState.phase)
				_report()
		Stage.BTN_TOUCH_PRESS:
			# 触摸点击同一按钮：ScreenTouch 与鼠标同一入口，注入 restart 动作与键盘 R 同路径。
			_touch_press(BTN_TOUCH_BASE + 3, _result.button_center())
			_next(Stage.RESTART_ASSERT)
		Stage.RESTART_ASSERT:
			if _stage_frames == 1:
				_touch_release(BTN_TOUCH_BASE + 3)
			if _stage_frames >= 3:
				if GameState.home_score != 0 or GameState.away_score != 0:
					_failures.append("重开后比分未清零（主 %d : %d 客）" % [GameState.home_score, GameState.away_score])
				if GameState.phase != GameState.Phase.KICKOFF:
					_failures.append("重开后未回到 KICKOFF（phase=%d）" % GameState.phase)
				if _ball.global_position.distance_to(Vector2(640, 360)) > 60.0:
					_failures.append("重开后球未回到中圈（位置 %s）" % str(_ball.global_position))
				if GameState.elapsed > 1.0:
					_failures.append("重开后计时未清零（elapsed=%.2f）" % GameState.elapsed)
				var panel := _main.get("result_panel") as Control
				if panel != null and panel.visible:
					_failures.append("重开后结算面板未收起（ResultPanel 仍可见）")
				if _result != null and _result.visible:
					_failures.append("触摸重开后「再来一局」按钮仍可见（可见性纪律失效）")
				_next(Stage.DONE)
		Stage.DONE:
			pass
	if _stage == Stage.DONE:
		_report()


## 无显示设备时模拟「玩家按键」：注入真实 InputEvent，让 _unhandled_input 收得到。
func _press_action(action: StringName) -> void:
	var event := InputEventAction.new()
	event.action = action
	event.pressed = true
	Input.parse_input_event(event)


## ---- v2 触摸 / 音频注入辅助 ----

## 画布坐标 → 窗口（OS 层）坐标：引擎把系统触摸事件经拉伸变换的逆映射投递到
## _unhandled_input（headless 窗口 64x64 时缩放极明显），所以注入要模拟 OS 层事件，
## 用 final_transform 正向变换回窗口坐标，保证投递落点 == 画布目标点。
func _to_window(pos: Vector2) -> Vector2:
	return get_viewport().get_final_transform() * pos


## 模拟手指按下（headless 下 ScreenTouch 事件照常走输入管线，触摸层 _unhandled_input 收得到）。
func _touch_press(index: int, pos: Vector2) -> void:
	var event := InputEventScreenTouch.new()
	event.index = index
	event.position = _to_window(pos)
	event.pressed = true
	Input.parse_input_event(event)


func _touch_release(index: int) -> void:
	var event := InputEventScreenTouch.new()
	event.index = index
	event.pressed = false
	Input.parse_input_event(event)


func _touch_drag(index: int, pos: Vector2) -> void:
	var event := InputEventScreenDrag.new()
	event.index = index
	event.position = _to_window(pos)
	Input.parse_input_event(event)


## 模拟鼠标左键按下/抬起（桌面入口）：与触摸走 ResultControls._press_at 同一命中判定。
func _mouse_button(pos: Vector2, pressed: bool) -> void:
	var event := InputEventMouseButton.new()
	event.button_index = MOUSE_BUTTON_LEFT
	event.pressed = pressed
	event.position = _to_window(pos)
	Input.parse_input_event(event)


## 注入物理键按下（同时带 keycode 与 physical_keycode：InputMap 键位契约按物理键匹配）。
func _inject_key(keycode: Key) -> void:
	var event := InputEventKey.new()
	event.physical_keycode = keycode
	event.keycode = keycode
	event.pressed = true
	Input.parse_input_event(event)


## 键位契约断言：目标键表 → project.godot [input] 的 physical_keycode（AND 语义）。
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


func _next(stage: int) -> void:
	_stage = stage
	_stage_frames = 0


func _report_stage_progress() -> void:
	print("GODOT_SMOKE: 静态接线检查通过（场景/autoload/InputMap/键位契约），开始行为断言")


func _report() -> void:
	if _failures.is_empty():
		print("GODOT_SMOKE: PASS 场景实例化/autoload/键位契约/移动/传球/射门进球/界外球/角球/球门球/难度梯度/时长配置/终场结算面板/重开/音效门控与事件音/解锁提示指引/触摸摇杆与按钮与多点触控/结算再来一局按钮触达与触摸鼠标重开 全部通过")
		print("GODOT_SMOKE: 帧消耗 %d（预算 GODOT_SMOKE_FRAMES，余量需为正）" % Engine.get_physics_frames())
		get_tree().quit(0)
	else:
		for failure in _failures:
			printerr("GODOT_SMOKE: FAIL %s" % failure)
		get_tree().quit(1)


func _on_player_moved(_position: Vector2) -> void:
	_moved_seen = true


func _on_ball_kicked(_velocity: Vector2) -> void:
	_kicked_seen = true


func _on_score_changed(home_score: int, away_score: int) -> void:
	_score_seen = true
	print("GODOT_SMOKE: 比分变化 → 主 %d : %d 客" % [home_score, away_score])


func _on_match_finished(home_score: int, away_score: int) -> void:
	_finish_seen = true
	print("GODOT_SMOKE: 比赛结束 → 主 %d : %d 客" % [home_score, away_score])
