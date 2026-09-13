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
## 覆盖面（对应「移动端触摸 + 音效」目标的验收标准）：
##   0. 竖屏适配：portrait 设计分辨率 + expand 拉伸设置；棋盘在视口内水平居中（_layout 生效）
##   1. 开始门控：未点「开始游戏」前光标输入冻结（点开始按钮才开局，兼作 Web 音频解锁手势）
##   2. 键盘仍可用：move_right 移动光标（cell_changed 送达）；点按选中 → 相邻交换 → 三消收集
##   3. 触摸·点按-点按：ScreenTouch 按下/抬起 A 格 → 选中；再点相邻 B 格 → 交换生效（加分+扣步）
##   4. 触摸·滑动：ScreenTouch 按下 C 格 → ScreenDrag 越过阈值 → 抬起 → 交换生效
##   5. 静音开关：MuteButton 切换 → GameAudio.muted 与 AudioServer 主总线哑音同步
##   6. 音效资产：GameAudio autoload 注册、SFX 表全部流非空、首个输入后 unlocked=true（解锁链路）
##   7. 死局守卫：模 5 交错盘 → ensure_solvable 洗出可解盘（Board.shuffled 送达）
##   8. 计分规则回归：score_for_wave 纯函数锁数值；强制四连走真实结算管线；难度梯度单调
##   9. 胜负可达且可点按推进：胜利遮罩 → OverlayActionButton 过关；败遮罩按钮文案切换；
##      RestartButton（+键盘 restart 动作）重开全复位
##  10. 无效交换反馈：交错盘上发起交换必无效 → 涉事两颗糖果进入抖动回弹动画
##      （Board.invalid_fx_playing_count == 2）+ HUD 提示加大字号且文案到位；不加分不扣步
##  11. 手势中致胜回归：分数抬到目标分后按住滑动 → 拖过阈值触发交换（结算内同步判胜，
##      outcome 变 WIN）→ 抬起只做手势簿记收口、不派发任何游戏动作
##  12. 跨关首次手势回归：手势中致胜 → 过关进第 2 关 → 第一次按住滑动必须产生可见效果
##      （加分 + 扣步）—— 修复前上一关致胜手势的脏指针状态把新手势整体吞掉
##   外加：场景可实例化、autoload 注册、InputMap + 键位契约、信号到达、可读失败原因
##
## ⚠️ 输入注入全走 Input.parse_input_event 并按帧分段（error-signatures E-08）：
##   headless 下 parse_input_event 的缓冲冲刷会清掉 Input.action_press 的状态，
##   本场景从不用 action_press，所有注入间隔 ≥2 帧，互不重叠。

## 键位契约之外还需注册的动作（与 project.godot [input] 对应）。
const REQUIRED_ACTIONS: Array[StringName] = [
	&"move_left", &"move_right", &"move_up", &"move_down", &"confirm", &"restart",
]

## 键位契约：动作 → 键表承诺的物理键，**必须全部绑定**（逐键 AND，见 error-signatures E-12）。
const KEY_CONTRACT: Dictionary = {
	&"move_left": [KEY_A, KEY_LEFT],
	&"move_right": [KEY_D, KEY_RIGHT],
	&"move_up": [KEY_W, KEY_UP],
	&"move_down": [KEY_S, KEY_DOWN],
	&"confirm": [KEY_SPACE, KEY_ENTER],
	&"restart": [KEY_R],
}

## 帧阶段表（Engine.max_fps = 60 下 process : 物理 ≈ 1:1；门禁 --quit-after 240 帧兜底）。
const FRAME_FROZEN: int = 3
const FRAME_FROZEN_CHECK: int = 7
const FRAME_START: int = 9
const FRAME_START_CHECK: int = 13
const FRAME_MOVE: int = 15
const FRAME_MOVE_CHECK: int = 19
const FRAME_SELECT: int = 21
const FRAME_SELECT_CHECK: int = 25
const FRAME_SWAP: int = 27
const FRAME_SWAP_CHECK: int = 31
const FRAME_TAP_A: int = 33
const FRAME_TAP_A_CHECK: int = 37
const FRAME_TAP_B: int = 39
const FRAME_TAP_CHECK: int = 43
const FRAME_SWIPE_BEGIN: int = 45
const FRAME_SWIPE_DRAG: int = 47
const FRAME_SWIPE_END: int = 49
const FRAME_SWIPE_CHECK: int = 53
const FRAME_MUTE: int = 55
const FRAME_MUTE_CHECK: int = 59
const FRAME_UNMUTE_CHECK: int = 61
const FRAME_DEADLOCK: int = 63
const FRAME_DEADLOCK_CHECK: int = 65
const FRAME_SCORING: int = 67
const FRAME_SCORING_CHECK: int = 69
const FRAME_WIN: int = 71
const FRAME_ADVANCE: int = 73
const FRAME_ADVANCE_CHECK: int = 77
const FRAME_LOSE: int = 79
const FRAME_LOSE_CHECK: int = 81
const FRAME_RESTART: int = 83
const FRAME_RESTART_BTN: int = 85
const FRAME_RESTART_CHECK: int = 89
## 无效交换反馈阶段：91 铺交错盘+选中 → 95 移到相邻格 → 101 发起（必无效）交换并断言。
## 91→101 间隔 10 帧 ≈0.167s，让重建糖果的 0.16s 入场 tween 先播完，不与抖动动画抢 scale。
const FRAME_INVALID: int = 91
const FRAME_INVALID_MOVE: int = 95
const FRAME_INVALID_CHECK: int = 101
## 手势中致胜回归阶段：103 分数抬到目标分 + 按下 → 105 拖过阈值（交换结算内同步判胜，
## outcome 变 WIN）→ 107 抬起（release 只做簿记收口，不派发游戏动作）→ 111 断言。
const FRAME_WIN_SWIPE_PREP: int = 103
const FRAME_WIN_SWIPE_DRAG: int = 105
const FRAME_WIN_SWIPE_END: int = 107
const FRAME_WIN_SWIPE_CHECK: int = 111
## 跨关首次手势回归阶段：113 点「下一关」过关 + 按下 → 115 拖过阈值 → 117 抬起 →
## 121 断言「第 2 关第一次按住滑动产生可见效果」（修复前被脏指针状态整体吞掉）。
const FRAME_NEXT_GESTURE_PREP: int = 113
const FRAME_NEXT_GESTURE_DRAG: int = 115
const FRAME_NEXT_GESTURE_END: int = 117
const FRAME_NEXT_GESTURE_CHECK: int = 121
## 总帧数上限（超过即出报告，防止死循环；smoke.sh 另有 --quit-after 兜底）。
const TOTAL_FRAMES: int = 125
## 强制四连结算用的固定种子（重力补充由此确定，断言只取下界仍需可复现的运行环境）。
const SCORING_RNG_SEED: int = 20260912
## 滑动手势注入的位移长度（设计像素；须超过 Player.SWIPE_TRIGGER_DISTANCE = 42）。
const SWIPE_INJECT_DISTANCE: float = 96.0

var _failures: PackedStringArray = []
var _frames: int = 0
var _finished: bool = false

var _main: Node
var _board: Board
var _cursor: Player
var _overlay: ColorRect
var _start_overlay: ColorRect
var _start_button: Button
var _restart_button: Button
var _mute_button: Button
var _overlay_action_button: Button

var _origin_pos: Vector2 = Vector2.ZERO
var _origin_cell: Vector2i = Vector2i.ZERO
var _cursor_moved_seen: bool = false
var _selection_seen: bool = false
var _score_changed_seen: bool = false
var _moves_changed_seen: bool = false
var _candies_collected_seen: bool = false
var _win_seen: bool = false
var _lose_seen: bool = false
var _restarted_seen: bool = false
var _shuffled_seen: bool = false
var _level_changed_seen: bool = false

var _swap_a: Vector2i = Vector2i.ZERO
var _swap_b: Vector2i = Vector2i.ZERO
var _score_before: int = 0
var _moves_before: int = 0
var _score_before_scoring: int = 0
var _score_before_tap: int = 0
var _moves_before_tap: int = 0
var _score_before_swipe: int = 0
var _moves_before_swipe: int = 0
var _score_before_invalid: int = 0
var _moves_before_invalid: int = 0
## 手势中致胜 / 跨关首次手势两阶段注入前的基准值（断言「恰好只扣滑动那一步」用）。
var _moves_before_win_swipe: int = 0
var _score_before_next_gesture: int = 0
var _moves_before_next_gesture: int = 0
## 点按/滑动阶段注入用的格子（每段开始前重算，保证与实时棋盘一致）。
var _tap_a: Vector2i = Vector2i.ZERO
var _tap_b: Vector2i = Vector2i.ZERO


func _ready() -> void:
	# headless 没有垂直同步，process 帧率可跑到几百上千 FPS，而物理固定 60Hz。
	# 限到 60 FPS 让 --quit-after 的帧数兜底有意义（协程跑得完再退出）。
	Engine.max_fps = 60

	_check_project_settings()

	for action in REQUIRED_ACTIONS:
		if not InputMap.has_action(action):
			_failures.append("InputMap 缺少动作 %s（project.godot [input] 未注册）" % action)
	_check_key_bindings()

	var game_state_node := get_tree().root.get_node_or_null("GameState")
	if game_state_node == null:
		_failures.append("autoload GameState 未注册（project.godot [autoload] 缺失）")
	else:
		for signal_name in ["score_changed", "moves_changed", "game_ended", "game_restarted", "level_changed"]:
			if not game_state_node.has_signal(signal_name):
				_failures.append("autoload GameState 缺少信号 %s" % signal_name)
		game_state_node.score_changed.connect(_on_score_changed)
		game_state_node.moves_changed.connect(_on_moves_changed)
		game_state_node.game_ended.connect(_on_game_ended)
		game_state_node.game_restarted.connect(_on_game_restarted)
		game_state_node.level_changed.connect(_on_level_changed)

	_check_audio_autoload()

	_main = get_tree().root.find_child("Main", true, false)
	if _main == null:
		_failures.append("场景树找不到 Main（tests/smoke.tscn 未实例化 scenes/main.tscn）")
		return
	_board = _main.find_child("Board", true, false) as Board
	if _board == null:
		_failures.append("主场景找不到 Board（scenes/main.tscn 缺少 Board 节点或 board.gd 未挂载）")
	else:
		_board.candies_collected.connect(_on_candies_collected)
		_board.shuffled.connect(_on_board_shuffled)
		_check_board_layout()
	_cursor = _main.find_child("Player", true, false) as Player
	if _cursor == null:
		_failures.append("主场景找不到 Player 光标（Board 下未实例化 player.tscn，或 player.gd 未挂载）")
	else:
		_cursor.cell_changed.connect(_on_cursor_cell_changed)
		_cursor.selection_changed.connect(_on_selection_changed)
		_origin_pos = _cursor.position
		_origin_cell = _cursor.grid_pos
	_overlay = _main.find_child("Overlay", true, false) as ColorRect
	if _overlay == null:
		_failures.append("主场景找不到 Overlay 胜负遮罩（scenes/main.tscn 缺少 %Overlay）")
	_start_overlay = _main.find_child("StartOverlay", true, false) as ColorRect
	if _start_overlay == null:
		_failures.append("主场景找不到 StartOverlay 开始遮罩（scenes/main.tscn 缺少 %StartOverlay）")
	elif not _start_overlay.visible:
		_failures.append("开始遮罩初始不可见：未点开始按钮前对局应处于待开始态")
	_check_touch_buttons()


## 阶段 0 静态断言：竖屏设计分辨率 + expand 拉伸 + 手持竖屏朝向（窄屏适配的工程接线）。
func _check_project_settings() -> void:
	if String(ProjectSettings.get_setting("display/window/stretch/mode")) != "canvas_items":
		_failures.append("竖屏适配缺失：display/window/stretch/mode != canvas_items（拉伸渲染未启用）")
	if String(ProjectSettings.get_setting("display/window/stretch/aspect")) != "expand":
		_failures.append("窄屏适配缺失：display/window/stretch/aspect != expand（视口不会随窗口扩展）")
	if String(ProjectSettings.get_setting("display/window/handheld/orientation")) != "portrait":
		_failures.append("移动端适配缺失：display/window/handheld/orientation != portrait（手持设备未锁竖屏）")
	var base_width: int = int(ProjectSettings.get_setting("display/window/size/viewport_width"))
	var base_height: int = int(ProjectSettings.get_setting("display/window/size/viewport_height"))
	if base_height <= base_width:
		_failures.append("竖屏设计分辨率缺失：viewport %dx%d 不是竖屏（height 应大于 width）" % [base_width, base_height])


## 阶段 0 静态断言：棋盘在视口内水平居中（main.gd _layout 对 expand 拉伸的响应）。
func _check_board_layout() -> void:
	if _board == null:
		return
	var viewport_size: Vector2 = get_viewport().get_visible_rect().size
	var board_center_x: float = _board.position.x + Board.COLS * Board.CELL * 0.5
	if absf(board_center_x - viewport_size.x * 0.5) > 1.0:
		_failures.append("棋盘未随视口居中：board_center_x=%.1f 视口宽=%.1f（main.gd _layout 未生效）" % [
			board_center_x, viewport_size.x,
		])
	if _board.position.y < 260.0 or _board.position.y + Board.ROWS * Board.CELL > viewport_size.y:
		_failures.append("棋盘纵向越界：top=%.1f bottom=%.1f 视口高=%.1f（与 HUD/按钮区带重叠）" % [
			_board.position.y, _board.position.y + Board.ROWS * Board.CELL, viewport_size.y,
		])


## 阶段 0 静态断言：GameAudio autoload 注册、SFX 表全量非空（音效资产接线完整）。
func _check_audio_autoload() -> void:
	if get_tree().root.get_node_or_null("GameAudio") == null:
		_failures.append("autoload GameAudio 未注册（project.godot [autoload] 缺失，音效系统不可用）")
		return
	if GameAudio.SFX.is_empty():
		_failures.append("音效表为空：GameAudio.SFX 无任何事件映射（swap/match/win/lose 等缺失）")
		return
	for event: StringName in GameAudio.SFX:
		if GameAudio.SFX[event] == null:
			_failures.append("音效流缺失：GameAudio.SFX[%s] 为空（assets/audio 资源没接上）" % event)


## 阶段 0 静态断言：四个触摸可点按控件存在且不抢键盘焦点（focus_mode = NONE），
## 同时抓取成员引用供后续帧阶段驱动（pressed 信号注入）。
func _check_touch_buttons() -> void:
	_start_button = _main.find_child("StartButton", true, false) as Button
	_restart_button = _main.find_child("RestartButton", true, false) as Button
	_mute_button = _main.find_child("MuteButton", true, false) as Button
	_overlay_action_button = _main.find_child("OverlayActionButton", true, false) as Button
	var buttons: Dictionary = {
		"StartButton": [_start_button, "开始按钮"],
		"RestartButton": [_restart_button, "重开按钮"],
		"MuteButton": [_mute_button, "静音按钮"],
		"OverlayActionButton": [_overlay_action_button, "胜负遮罩动作按钮"],
	}
	for button_name: String in buttons:
		var button: Button = buttons[button_name][0]
		if button == null:
			_failures.append("可点按控件缺失：主场景找不到 %s（%s 未创建）" % [button_name, buttons[button_name][1]])
		elif button.focus_mode != Control.FOCUS_NONE:
			_failures.append("触摸控件会抢焦点：%s focus_mode != NONE（键盘 Space 会误触按钮而非对局）" % button_name)


func _physics_process(_delta: float) -> void:
	if _finished:
		return
	_frames += 1
	# 任一断言失败立即收口（后续阶段依赖前序状态，继续跑只会产生噪声失败）。
	if not _failures.is_empty():
		_finish()
		return
	match _frames:
		FRAME_FROZEN:
			_inject_action(&"move_right")
		FRAME_FROZEN_CHECK:
			_check_frozen_before_start()
		FRAME_START:
			_tap_control(_start_button)
		FRAME_START_CHECK:
			_check_started()
		FRAME_MOVE:
			_inject_action(&"move_right")
		FRAME_MOVE_CHECK:
			_check_cursor_moved()
		FRAME_SELECT:
			_inject_action(&"confirm")
		FRAME_SELECT_CHECK:
			_check_selected_and_step_to_b()
		FRAME_SWAP:
			_inject_action(&"confirm")
		FRAME_SWAP_CHECK:
			_check_swap_resolved()
		FRAME_TAP_A:
			_prepare_tap_pair()
			_touch_at(_tap_a, true)
			_touch_at(_tap_a, false)
		FRAME_TAP_A_CHECK:
			_check_tap_selected_a()
		FRAME_TAP_B:
			_touch_at(_tap_b, true)
			_touch_at(_tap_b, false)
		FRAME_TAP_CHECK:
			_check_tap_swapped()
		FRAME_SWIPE_BEGIN:
			_prepare_swipe_pair()
			_touch_at(_tap_a, true)
		FRAME_SWIPE_DRAG:
			_drag_to(_tap_b)
		FRAME_SWIPE_END:
			_touch_at(_tap_b, false)
		FRAME_SWIPE_CHECK:
			_check_swipe_swapped()
		FRAME_MUTE:
			_tap_control(_mute_button)
		FRAME_MUTE_CHECK:
			_check_muted()
		FRAME_UNMUTE_CHECK:
			_tap_control(_mute_button)
			_check_unmuted()
		FRAME_DEADLOCK:
			_run_deadlock_scenario()
		FRAME_DEADLOCK_CHECK:
			_check_deadlock_resolved()
		FRAME_SCORING:
			_run_scoring_scenario()
		FRAME_SCORING_CHECK:
			_check_scoring()
		FRAME_WIN:
			_run_win_scenario()
		FRAME_ADVANCE:
			_overlay_action_button.pressed.emit()
		FRAME_ADVANCE_CHECK:
			_check_advanced()
		FRAME_LOSE:
			_run_lose_scenario()
		FRAME_LOSE_CHECK:
			_check_lose()
		FRAME_RESTART:
			_inject_action(&"restart")
		FRAME_RESTART_BTN:
			_restart_button.pressed.emit()
		FRAME_RESTART_CHECK:
			_check_restarted()
		FRAME_INVALID:
			_prepare_invalid_swap_scenario()
		FRAME_INVALID_MOVE:
			_inject_action(&"move_right")
		FRAME_INVALID_CHECK:
			_check_invalid_swap_feedback()
		FRAME_WIN_SWIPE_PREP:
			_prepare_win_mid_gesture_scenario()
		FRAME_WIN_SWIPE_DRAG:
			_drag_to(_tap_b)
		FRAME_WIN_SWIPE_END:
			_touch_at(_tap_b, false)
		FRAME_WIN_SWIPE_CHECK:
			_check_win_mid_gesture()
		FRAME_NEXT_GESTURE_PREP:
			_prepare_next_level_first_gesture()
		FRAME_NEXT_GESTURE_DRAG:
			_drag_to(_tap_b)
		FRAME_NEXT_GESTURE_END:
			_touch_at(_tap_b, false)
		FRAME_NEXT_GESTURE_CHECK:
			_check_next_level_first_gesture_works()
			_finish()
			return
	if _frames >= TOTAL_FRAMES:
		_finish()


## 阶段 1 断言：未点开始前对局输入必须冻结（move_right 不产生任何位移）。
func _check_frozen_before_start() -> void:
	if _cursor == null:
		return
	if GameState.started:
		_failures.append("开始门控失效：未点开始按钮 GameState.started 已为真")
	if _cursor.grid_pos != _origin_cell:
		_failures.append("开始门控失效：未点开始按钮注入 move_right 就能移动光标（is_playing 未拦住）")
	if _start_overlay != null and not _start_overlay.visible:
		_failures.append("开始遮罩提前消失：待开始态应保持 StartOverlay 可见")
	if not GameAudio.unlocked:
		_failures.append("音频解锁链路断裂：首个输入事件后 GameAudio.unlocked 仍为假（Web 自动播放限制未处理）")


## 阶段 1 断言：点开始按钮 → 对局真正开始，开始遮罩关闭，棋盘可用。
func _check_started() -> void:
	if not GameState.started:
		_failures.append("开始交互失效：StartButton.pressed 后 GameState.started 仍为假（main.gd _on_start_pressed 未接线）")
	if not GameState.is_playing():
		_failures.append("开始交互失效：开始后 outcome 未进入对局态（is_playing=false）")
	if _start_overlay != null and _start_overlay.visible:
		_failures.append("开始交互失效：开始后 StartOverlay 仍显示")
	if GameState.moves_left != GameState.moves_for_level(1):
		_failures.append("开始交互失效：开局步数未按第 1 关初始化（moves_left=%d）" % GameState.moves_left)
	# 情景隔离（实测根因修复）：本情景会连续打出多次真实三消，随机棋盘的连锁波次
	# 可能提前把分数推过目标分 → 对局中途判胜 → is_playing 门控冻结后续输入，
	# 滑动/点按阶段的事件再也到不了 Player（探针实测：45/47/49 帧注入零到达），
	# 断言以「触摸滑动交换失效」间歇性失败。把目标分抬到情景内不可达即可隔离；
	# 胜利可达性由阶段 9（start_game 复位目标分后 score=target）专项验证，不受影响。
	GameState.target_score = GameState.TARGET_SCORE * 100
	if _board != null:
		for column in _board.types:
			for value in column:
				if value == Board.EMPTY:
					_failures.append("开始交互失效：开局棋盘存在空格（board.new_game 未生效）")
					return


## 阶段 2 断言：注入 move_right 后光标真的动了（网格坐标 + 节点位置 + 信号三重核对），
## 随后把光标瞬移到一组「必定三消」的交换对起点，为键盘交互阶段做准备。
func _check_cursor_moved() -> void:
	if _cursor == null:
		return
	if _cursor.grid_pos == _origin_cell:
		_failures.append("玩家不能移动：注入 move_right 后光标 grid_pos 仍为 %s（InputMap 动作未生效或 _unhandled_input 未接线）" % _origin_cell)
	if _cursor.position.distance_to(_origin_pos) < 1.0:
		_failures.append("光标节点位置未随网格移动（视觉同步断裂：_sync_position 未生效）")
	if not _cursor_moved_seen:
		_failures.append("信号 Player.cell_changed 未到达订阅方：连接断裂或从未 emit")
	var pair := _board.find_valid_swap()
	if pair.size() < 2:
		_failures.append("棋盘上找不到任何可行三消交换（find_valid_swap 为空）：开局填充或匹配检测有缺陷")
		return
	_swap_a = pair[0]
	_swap_b = pair[1]
	_cursor.set_cell(_swap_a)
	_score_before = GameState.score
	_moves_before = GameState.moves_left


## 阶段 2 断言：confirm 后进入选中态；再向交换对终点注入一步方向。
func _check_selected_and_step_to_b() -> void:
	if _cursor == null:
		return
	if not _cursor.has_selection:
		_failures.append("核心交互失效：注入 confirm 后光标未进入选中态（Player._handle_confirm 未生效）")
	if not _selection_seen:
		_failures.append("信号 Player.selection_changed 未到达订阅方")
	var direction: Vector2i = _swap_b - _swap_a
	var dir_action: StringName = &"move_right"
	if direction == Vector2i.DOWN:
		dir_action = &"move_down"
	elif direction == Vector2i.LEFT:
		dir_action = &"move_left"
	elif direction == Vector2i.UP:
		dir_action = &"move_up"
	_inject_action(dir_action)


## 阶段 2 断言：第二次 confirm 完成交换 → 三消收集 → 加分 + 扣步。
func _check_swap_resolved() -> void:
	if GameState.score <= _score_before:
		_failures.append("核心交互失效：交换后分数未增加（%d → %d），Board.try_swap 三消结算或 GameState.add_score 断裂" % [
			_score_before, GameState.score,
		])
	if GameState.moves_left != _moves_before - 1:
		_failures.append("有效交换未消耗步数（%d → %d，期望 %d）：GameState.use_move 未被调用" % [
			_moves_before, GameState.moves_left, _moves_before - 1,
		])
	if GameState.level != 1:
		_failures.append("输入事件重入：触发交换的同一 confirm 被传给 Main 的过关分支（期望仍为第 1 关，实际 level=%d）—— Player 消费输入后未 set_input_as_handled" % GameState.level)
	if not _candies_collected_seen:
		_failures.append("信号 Board.candies_collected 未发出：三消收集链路断裂")
	if not _score_changed_seen:
		_failures.append("信号 GameState.score_changed 未到达订阅方：加分链路断裂")
	if not _moves_changed_seen:
		_failures.append("信号 GameState.moves_changed 未到达订阅方：扣步链路断裂")


## 阶段 3（触摸·点按-点按）准备：找一组实时可行交换对 [A, B]。
func _prepare_tap_pair() -> void:
	var pair := _board.find_valid_swap()
	if pair.size() < 2:
		_failures.append("点按交互准备失败：棋盘上找不到可行三消交换（find_valid_swap 为空）")
		return
	_tap_a = pair[0]
	_tap_b = pair[1]
	_score_before_tap = GameState.score
	_moves_before_tap = GameState.moves_left


## 阶段 3 断言：点按 A（按下+抬起）后 A 格进入选中态。
func _check_tap_selected_a() -> void:
	if not _cursor.has_selection:
		_failures.append("触摸点按失效：点按糖果后未进入选中态（Player._pointer_end → _tap_at 链路断裂）")
	if _cursor.selected_cell != _tap_a:
		_failures.append("触摸点按失效：选中的是 %s，期望点按格 %s（事件坐标 → 棋盘格换算错误）" % [
			_cursor.selected_cell, _tap_a,
		])
	if _cursor.grid_pos != _tap_a:
		_failures.append("触摸点按反馈缺失：光标未随点按移动到 %s（grid_pos=%s）" % [_tap_a, _cursor.grid_pos])


## 阶段 3 断言：点按相邻 B 格 → 交换生效（加分 + 扣步）。
func _check_tap_swapped() -> void:
	if GameState.score <= _score_before_tap:
		_failures.append("触摸点按交换失效：点按 B 后分数未增加（%d → %d），Board.try_swap 未被触发" % [
			_score_before_tap, GameState.score,
		])
	if GameState.moves_left != _moves_before_tap - 1:
		_failures.append("触摸点按交换失效：未扣步（%d → %d，期望 %d）" % [
			_moves_before_tap, GameState.moves_left, _moves_before_tap - 1,
		])
	if _cursor.has_selection:
		_failures.append("触摸点按交换残留：交换后选中态未清除")


## 阶段 4（触摸·滑动）准备：再找一组可行交换对 [C, D]。
func _prepare_swipe_pair() -> void:
	var pair := _board.find_valid_swap()
	if pair.size() < 2:
		_failures.append("滑动交互准备失败：棋盘上找不到可行三消交换")
		return
	_tap_a = pair[0]
	_tap_b = pair[1]
	_score_before_swipe = GameState.score
	_moves_before_swipe = GameState.moves_left


## 阶段 4 断言：按住 C 拖到 D 越过阈值 → 交换生效（加分 + 扣步）。
func _check_swipe_swapped() -> void:
	if GameState.score <= _score_before_swipe:
		_failures.append("触摸滑动交换失效：拖动后分数未增加（%d → %d），InputEventScreenDrag 手势链路断裂" % [
			_score_before_swipe, GameState.score,
		])
	if GameState.moves_left != _moves_before_swipe - 1:
		_failures.append("触摸滑动交换失效：未扣步（%d → %d，期望 %d）" % [
			_moves_before_swipe, GameState.moves_left, _moves_before_swipe - 1,
		])
	if _cursor._pointer_active:
		_failures.append("触摸手势状态残留：抬起后 _pointer_active 仍为真（_pointer_reset 未生效）")


## 阶段 5 断言：点静音按钮 → GameAudio.muted 与主总线哑音同步打开；再点恢复。
func _check_muted() -> void:
	if not GameAudio.muted:
		_failures.append("静音开关失效：MuteButton 点击后 GameAudio.muted 仍为假（_on_mute_pressed 未接线）")
	if not AudioServer.is_bus_mute(AudioServer.get_bus_index("Master")):
		_failures.append("静音开关失效：muted=true 但主总线未置哑（AudioServer.set_bus_mute 未同步）")


func _check_unmuted() -> void:
	if GameAudio.muted:
		_failures.append("静音开关失效：再次点击后未解除静音（toggle_muted 往返断裂）")
	if AudioServer.is_bus_mute(AudioServer.get_bus_index("Master")):
		_failures.append("静音开关失效：muted=false 但主总线仍哑音")


## 阶段 7：死局守卫 —— 构造「模 5 交错盘」（types[x][y] = (x + 2y) mod 5，行列均无相邻同色，
## 数学上任何相邻交换都无法形成三连）强制触发死局，ensure_solvable 必须洗出一手可解棋盘。
func _run_deadlock_scenario() -> void:
	for x in Board.COLS:
		for y in Board.ROWS:
			_board.types[x][y] = (x + 2 * y) % Board.CANDY_KINDS
	if not _board.find_valid_swap().is_empty():
		_failures.append("死局构造失效：模 5 交错盘被判定存在可行交换，死局守卫断言覆盖不到真实死局")
		return
	if not _board.find_matches().is_empty():
		_failures.append("死局构造失效：交错盘存在现成三连，未构成真正的无解盘面")
		return
	_board.ensure_solvable()


## 阶段 7 断言：洗牌后必须「有可行交换 + 无现成三连」，且 shuffled 信号到达订阅方。
func _check_deadlock_resolved() -> void:
	if not _shuffled_seen:
		_failures.append("死局守卫失效：死局盘调用 ensure_solvable 后未发出 Board.shuffled 信号（洗牌链路断裂）")
	if _board.find_valid_swap().is_empty():
		_failures.append("死局守卫失效：洗牌后棋盘仍无可行交换，玩家会永久卡死（SHUFFLE_ATTEMPTS/兜底布局失效）")
	if not _board.find_matches().is_empty():
		_failures.append("死局洗牌质量缺陷：洗出了现成三连（应为无现成三连的可解盘）")


## 阶段 8：计分与难度梯度的纯函数断言（无随机，锁具体数值）+ 强制四连走真实结算管线。
func _run_scoring_scenario() -> void:
	# 计分公式：基础分、四连/五连加成、连锁波次倍率（回归锁：改规则必须改断言）。
	var cases: Array = [
		[3, 1, 3, 3 * Board.POINTS_PER_CANDY],
		[4, 1, 4, 4 * Board.POINTS_PER_CANDY + Board.FOUR_RUN_BONUS],
		[5, 1, 5, 5 * Board.POINTS_PER_CANDY + Board.FIVE_RUN_BONUS],
		[3, 2, 3, 3 * Board.POINTS_PER_CANDY * 2],
		[4, 3, 5, 4 * Board.POINTS_PER_CANDY * 3 + Board.FIVE_RUN_BONUS],
	]
	for case in cases:
		var got: int = Board.score_for_wave(case[0], case[1], case[2])
		if got != case[3]:
			_failures.append("计分公式回归：score_for_wave(%d, %d, %d) = %d，期望 %d（加成/倍率规则被破坏）" % [
				case[0], case[1], case[2], got, case[3],
			])
	# 难度阶梯：L1 数值与常量一致；L1→L6 目标分严格递增、步数非增（梯度必须存在）。
	if GameState.target_for_level(1) != GameState.TARGET_SCORE:
		_failures.append("难度梯度失效：第 1 关目标分 %d != TARGET_SCORE %d" % [
			GameState.target_for_level(1), GameState.TARGET_SCORE,
		])
	if GameState.moves_for_level(1) != GameState.START_MOVES:
		_failures.append("难度梯度失效：第 1 关步数 %d != START_MOVES %d" % [
			GameState.moves_for_level(1), GameState.START_MOVES,
		])
	for stage in range(1, 6):
		if GameState.target_for_level(stage + 1) <= GameState.target_for_level(stage):
			_failures.append("难度梯度失效：第 %d→%d 关目标分未递增（%d → %d），无难度曲线" % [
				stage, stage + 1, GameState.target_for_level(stage), GameState.target_for_level(stage + 1),
			])
		if GameState.moves_for_level(stage + 1) > GameState.moves_for_level(stage):
			_failures.append("难度梯度失效：第 %d→%d 关步数未收紧（%d → %d）" % [
				stage, stage + 1, GameState.moves_for_level(stage), GameState.moves_for_level(stage + 1),
			])
	# 强制四连结算：种子固定 → 重力补充确定；先铺交错盘隔离干扰，再改出唯一的一处四连。
	# 前置复位到对局态：若前序阶段恰好获胜（合法游戏行为），outcome 会停在 WIN，
	# add_score 的对局态守卫会把本阶段结算拦成 0 分 —— 计分断言必须与之解耦。
	GameState.start_game()
	_score_before_scoring = GameState.score
	_board.rng.seed = SCORING_RNG_SEED
	for x in Board.COLS:
		for y in Board.ROWS:
			_board.types[x][y] = (x + 2 * y) % Board.CANDY_KINDS
	for x in 4:
		_board.types[x][0] = 2
	_board._resolve_cascades()


## 阶段 8 断言：四连盘走真实结算管线后，长连被识别、分数走计分公式（连锁只增不减，取下界）。
func _check_scoring() -> void:
	var gained: int = GameState.score - _score_before_scoring
	if _board.last_max_run < 4:
		_failures.append("长连加成失效：强制四连盘 last_max_run = %d（期望 ≥ 4），_max_run_length 检测断裂" % _board.last_max_run)
	var wave_floor: int = Board.score_for_wave(4, 1, 4)
	if gained < wave_floor:
		_failures.append("结算管线断裂：四连盘实得 %d < 公式下界 %d（_resolve_cascades 未走 score_for_wave）" % [
			gained, wave_floor,
		])
	if _board.last_wave_count < 1:
		_failures.append("结算管线断裂：last_wave_count = %d（期望 ≥ 1），波次统计未更新" % _board.last_wave_count)
	if gained % Board.POINTS_PER_CANDY != 0:
		_failures.append("计分异常：实得 %d 不是单颗分 %d 的整数倍（计分路径混入非公式来源）" % [
			gained, Board.POINTS_PER_CANDY,
		])


## 阶段 9：胜利可达 —— 复位到对局态后直接把分数推到目标（SKILL.md 第 7 节的合法姿势），
## check_end 必须判胜且遮罩显示、动作按钮切到「下一关」。
func _run_win_scenario() -> void:
	GameState.start_game()
	GameState.score = GameState.target_score
	GameState.check_end()
	if GameState.outcome != GameState.Outcome.WIN:
		_failures.append("胜负不可达：分数达标后 GameState.check_end 未判胜（outcome=%s）" % GameState.outcome)
	if not _win_seen:
		_failures.append("信号 GameState.game_ended(\"win\") 未到达订阅方：胜利判定链路断裂")
	if _overlay != null and not _overlay.visible:
		_failures.append("胜利后遮罩未显示（main.gd _on_game_ended 未生效）")
	var action_button := _main.find_child("OverlayActionButton", true, false) as Button
	if action_button != null and action_button.text != "下一关 NEXT":
		_failures.append("胜利遮罩按钮文案未切换：OverlayActionButton.text=%s（期望 下一关 NEXT）" % action_button.text)


## 阶段 9 断言：胜利遮罩上点动作按钮 → 过关推进（level/target/moves 按阶梯重算）。
func _check_advanced() -> void:
	if GameState.level != 2:
		_failures.append("过关交互失效：胜利后点动作按钮，level = %d（期望 2，main.gd _advance_level 未生效）" % GameState.level)
	if GameState.outcome != GameState.Outcome.PLAYING:
		_failures.append("过关交互失效：过关后 outcome = %s（期望 PLAYING，可直接继续对局）" % GameState.outcome)
	if GameState.score != 0:
		_failures.append("过关交互失效：过关后分数未清零（score=%d）" % GameState.score)
	if GameState.moves_left != GameState.moves_for_level(2):
		_failures.append("过关交互失效：过关后步数未按第 2 关阶梯重算（moves_left=%d，期望 %d）" % [
			GameState.moves_left, GameState.moves_for_level(2),
		])
	if GameState.target_score != GameState.target_for_level(2):
		_failures.append("难度梯度失效：过关后目标分未按第 2 关阶梯重算（target_score=%d，期望 %d）" % [
			GameState.target_score, GameState.target_for_level(2),
		])
	if not _level_changed_seen:
		_failures.append("信号 GameState.level_changed 未到达订阅方：过关链路断裂")
	if _overlay != null and _overlay.visible:
		_failures.append("过关交互失效：过关后胜负遮罩仍显示")
	var level_label := _main.find_child("LevelLabel", true, false) as Label
	if level_label != null and level_label.text != "LEVEL 2":
		_failures.append("关卡 HUD 未随过关刷新（LevelLabel.text=%s，期望 LEVEL 2）" % level_label.text)
	if _board != null:
		for column in _board.types:
			for value in column:
				if value == Board.EMPTY:
					_failures.append("过关交互失效：过关重填后棋盘存在空格（board.new_game 未生效）")
					return


## 阶段 10：失败可达 —— 切到第 3 关后把步数清零，check_end 必须判负
## （故意把 level 抬到 3，让重开断言「回第 1 关」有真实区分度）。
func _run_lose_scenario() -> void:
	GameState.start_game()
	GameState.level = 3
	GameState.target_score = GameState.target_for_level(3)
	GameState.moves_left = GameState.moves_for_level(3)
	GameState.moves_left = 0
	GameState.check_end()
	if GameState.outcome != GameState.Outcome.LOSE:
		_failures.append("胜负不可达：步数耗尽后 GameState.check_end 未判负（outcome=%s）" % GameState.outcome)
	if not _lose_seen:
		_failures.append("信号 GameState.game_ended(\"lose\") 未到达订阅方：失败判定链路断裂")


## 阶段 10 断言：失败态的遮罩文案、结算分数与动作按钮（切到 RETRY）要如实呈现。
func _check_lose() -> void:
	if _overlay != null and not _overlay.visible:
		_failures.append("失败后遮罩未显示（main.gd _on_game_ended 未覆盖 lose 分支）")
	var overlay_title := _main.find_child("OverlayTitle", true, false) as Label
	if overlay_title != null and overlay_title.text != "GAME OVER":
		_failures.append("失败文案缺失：OverlayTitle.text=%s（期望 GAME OVER，胜负反馈不明确）" % overlay_title.text)
	var overlay_score := _main.find_child("OverlayScore", true, false) as Label
	if overlay_score != null and overlay_score.text != "SCORE %d" % GameState.score:
		_failures.append("结算分数缺失：OverlayScore.text=%s（期望 SCORE %d）" % [overlay_score.text, GameState.score])
	var action_button := _main.find_child("OverlayActionButton", true, false) as Button
	if action_button != null and action_button.text != "再来一局 RETRY":
		_failures.append("失败遮罩按钮文案未切换：OverlayActionButton.text=%s（期望 再来一局 RETRY）" % action_button.text)


## 阶段 11 断言：键盘 restart 动作 + 重开按钮双通道后全部复位（状态/分数/关卡/棋盘/光标/遮罩）。
func _check_restarted() -> void:
	if GameState.outcome != GameState.Outcome.PLAYING:
		_failures.append("重开不可用：对局状态未复位（outcome=%s，期望 PLAYING）" % GameState.outcome)
	if GameState.score != 0:
		_failures.append("重开不可用：分数未清零（score=%d）" % GameState.score)
	if GameState.level != 1:
		_failures.append("重开不可用：关卡未回到第 1 关（level=%d，失败于第 3 关后重开应从零开始）" % GameState.level)
	if GameState.moves_left != GameState.moves_for_level(1):
		_failures.append("重开不可用：步数未按第 1 关复位（moves_left=%d，期望 %d）" % [
			GameState.moves_left, GameState.moves_for_level(1),
		])
	if not _restarted_seen:
		_failures.append("信号 GameState.game_restarted 未到达订阅方：重开链路断裂")
	if _cursor != null and _cursor.grid_pos != Vector2i.ZERO:
		_failures.append("重开不可用：光标未归位（grid_pos=%s）" % _cursor.grid_pos)
	if _overlay != null and _overlay.visible:
		_failures.append("重开不可用：胜负遮罩仍显示")
	if _start_overlay != null and _start_overlay.visible:
		_failures.append("重开不可用：开始遮罩不应在重开后再现")
	var level_label := _main.find_child("LevelLabel", true, false) as Label
	if level_label != null and level_label.text != "LEVEL 1":
		_failures.append("重开不可用：关卡 HUD 未复位（LevelLabel.text=%s，期望 LEVEL 1）" % level_label.text)
	if _board != null:
		var empty_cells: int = 0
		for column in _board.types:
			for value in column:
				if value == Board.EMPTY:
					empty_cells += 1
		if empty_cells > 0:
			_failures.append("重开不可用：棋盘存在 %d 个空格（Board.new_game 未重填）" % empty_cells)


## 阶段 12 准备：铺「模 5 交错盘」（types[x][y] = (x + 2y) mod 5 —— 阶段 7 已证明其上
## 任何相邻交换都不形成三连，即任意交换必无效），重建糖果节点并驱动光标选中 (0,0)。
func _prepare_invalid_swap_scenario() -> void:
	if _board == null or _cursor == null:
		return
	for x in Board.COLS:
		for y in Board.ROWS:
			_board.types[x][y] = (x + 2 * y) % Board.CANDY_KINDS
	_board._rebuild_candy_nodes()
	_score_before_invalid = GameState.score
	_moves_before_invalid = GameState.moves_left
	_cursor.set_cell(Vector2i.ZERO)
	_inject_action(&"confirm")


## 阶段 12 断言：第二次 confirm 发起（必无效）交换后 ——
## 涉事两颗糖果都进入抖动回弹动画、HUD 提示加大字号且文案到位、不加分不扣步。
## （提示「停留 2.5 秒后清除」需要 ~150 帧，超出本场景帧预算，不在此覆盖；
##  清除由 seq 令牌守卫保证正确性，逻辑与 _set_hud_message 同源。）
func _check_invalid_swap_feedback() -> void:
	if _cursor == null or _board == null:
		return
	_inject_action(&"confirm")
	if _board.invalid_fx_playing_count() != 2:
		_failures.append("无效交换动画缺失：涉事糖果抖动动画播放数 = %d（期望 2，Board.play_invalid_swap_fx 未接线或未覆盖两颗糖果）" % _board.invalid_fx_playing_count())
	var hud := _main.find_child("HudMessage", true, false) as Label
	if hud == null:
		_failures.append("无效交换提示缺失：主场景找不到 HudMessage")
	else:
		if hud.text != _main.TEXT_INVALID_SWAP:
			_failures.append("无效交换提示缺失：HudMessage.text = %s（期望 %s，main.gd _flash_invalid_swap_message 未生效）" % [hud.text, _main.TEXT_INVALID_SWAP])
		if hud.get_theme_font_size("font_size") != _main.INVALID_MSG_FONT_SIZE:
			_failures.append("无效交换提示未加大字号：font_size = %d（期望 %d，基准 %d）" % [
				hud.get_theme_font_size("font_size"), _main.INVALID_MSG_FONT_SIZE, _main.HUD_MSG_FONT_SIZE,
			])
	if GameState.score != _score_before_invalid:
		_failures.append("无效交换误加分：score %d → %d（无效交换不得消耗玩家资源）" % [_score_before_invalid, GameState.score])
	if GameState.moves_left != _moves_before_invalid:
		_failures.append("无效交换误扣步：moves %d → %d（不形成三连的交换不耗步）" % [_moves_before_invalid, GameState.moves_left])
	if _cursor.has_selection:
		_failures.append("无效交换后选中态残留：has_selection 仍为真（_handle_confirm 未收口）")


## 阶段 11 准备：构造「手势中致胜」——分数抬到恰好等于目标分，随后任何一次有效交换
## 都会在交换结算管线（try_swap → add_score → check_end）内同步判胜：outcome 在拖动
## 事件派发中途变 WIN，同一次手势的抬起必然带着「胜负已分」到达（与真机致胜滑动同构）。
func _prepare_win_mid_gesture_scenario() -> void:
	if _board == null or _cursor == null:
		return
	GameState.start_game()
	# 情景隔离：上一阶段故意铺了「模 5 交错盘」死局盘，先恢复可解盘面再找交换对。
	_board.ensure_solvable()
	var pair := _board.find_valid_swap()
	if pair.size() < 2:
		_failures.append("手势中致胜准备失败：棋盘上找不到可行三消交换（find_valid_swap 为空）")
		return
	_tap_a = pair[0]
	_tap_b = pair[1]
	_moves_before_win_swipe = GameState.moves_left
	_win_seen = false
	GameState.score = GameState.target_score
	_touch_at(_tap_a, true)


## 阶段 11 断言：致胜滑动的抬起（release）虽在 outcome==WIN 之后到达 ——
## 手势簿记必须收口（_pointer_active 复位），且不派发任何游戏动作（无新增选中、
## 步数恰好只扣滑动那一次）。修复前 release 被 is_playing 整条丢弃，状态机带脏跨关。
func _check_win_mid_gesture() -> void:
	if _cursor == null:
		return
	if GameState.outcome != GameState.Outcome.WIN:
		_failures.append("手势中致胜失效：致胜滑动结算后 outcome=%s（期望 WIN，check_end 未在交换管线内判胜）" % GameState.outcome)
		return
	if not _win_seen:
		_failures.append("手势中致胜失效：拖动事件派发中途未收到 game_ended(\"win\")（胜负判定链路断裂）")
	if _cursor._pointer_active:
		_failures.append("手势状态残留：outcome 变 WIN 后抬起未收口（_pointer_active 仍为真）——指针簿记被输入门控提前丢弃，脏状态将吞掉下一关第一次滑动")
	if _cursor.has_selection:
		_failures.append("手势动作越权：胜负已分后抬起仍派发了点按/选中（_tap_at 未被 is_playing 门控）")
	if GameState.moves_left != _moves_before_win_swipe - 1:
		_failures.append("手势动作越权：致胜滑动后步数 %d（期望 %d）——抬起多派发了动作或滑动未扣步" % [
			GameState.moves_left, _moves_before_win_swipe - 1,
		])


## 阶段 12 准备：过关进入第 2 关（真实用户路径：胜利遮罩动作按钮 → _advance_level →
## reset_position + board.new_game），在新棋盘上找一组可行交换对并立刻按下第一根手指 ——
## 精确复现「第二关第一次按住滑动」。
func _prepare_next_level_first_gesture() -> void:
	if _board == null or _cursor == null:
		return
	_overlay_action_button.pressed.emit()
	if GameState.level != 2 or GameState.outcome != GameState.Outcome.PLAYING:
		_failures.append("过关推进失效：手势中致胜后点动作按钮 level=%d outcome=%s（期望 2 / PLAYING）" % [
			GameState.level, GameState.outcome,
		])
		return
	var pair := _board.find_valid_swap()
	if pair.size() < 2:
		_failures.append("第 2 关首次手势准备失败：新棋盘上找不到可行三消交换（find_valid_swap 为空）")
		return
	_tap_a = pair[0]
	_tap_b = pair[1]
	_score_before_next_gesture = GameState.score
	_moves_before_next_gesture = GameState.moves_left
	_touch_at(_tap_a, true)


## 阶段 12 断言（回归核心）：第 2 关第一次按住滑动必须产生可见效果 ——
## 拖过阈值即发起交换（加分 + 恰好扣一步）、手势收口干净。
## 修复前：上一关致胜手势的 release 被丢弃 → _pointer_active/_pointer_swiped 带脏跨关，
## 本关第一次按下抢不到新手势、拖动被 _pointer_swiped 短路，分数纹丝不动。
func _check_next_level_first_gesture_works() -> void:
	if _cursor == null:
		return
	if GameState.score <= _score_before_next_gesture:
		_failures.append("跨关手势回归：第 2 关第一次按住滑动未产生可见效果（分数 %d → %d）——上一关致胜手势的脏指针状态（_pointer_active/_pointer_swiped）吞掉了新手势" % [
			_score_before_next_gesture, GameState.score,
		])
	if GameState.moves_left != _moves_before_next_gesture - 1:
		_failures.append("跨关手势回归：第 2 关第一次滑动后步数 %d（期望 %d）——手势未走滑动交换链路" % [
			GameState.moves_left, _moves_before_next_gesture - 1,
		])
	if _cursor._pointer_active:
		_failures.append("手势状态残留：第 2 关第一次滑动抬起后 _pointer_active 仍为真（_pointer_reset 未生效）")
	if _cursor.has_selection:
		_failures.append("手势状态残留：第 2 关第一次滑动后选中态未清（_swipe_swap 未收口选中）")


func _finish() -> void:
	if _finished:
		return
	_finished = true
	if _failures.is_empty():
		print("GODOT_SMOKE: PASS 竖屏适配/开始门控/音频解锁/键位契约/光标移动/点按-点按交换/滑动交换/静音开关/死局洗牌/计分加成/难度梯度/按钮过关/胜负判定/按钮重开/无效交换反馈/手势中致胜收口/跨关首次手势 全部通过")
		get_tree().quit(0)
	else:
		for failure in _failures:
			printerr("GODOT_SMOKE: FAIL %s" % failure)
		get_tree().quit(1)


## 无显示设备时模拟「玩家按键」：注入真实 InputEvent，让 _unhandled_input 收得到。
## （Input.action_press 只改动作强度，不产生 InputEvent，触发不了 _unhandled_input。）
## ⚠️ 实测坑（Godot 4.6 headless）：parse_input_event 的事件滞留在缓冲区，
## headless DisplayServer 不逐帧冲刷 → 事件永远派发不出去（4.3 无此问题）。
## 注入后必须手动 Input.flush_buffered_events() 立即派发，断言才有确定性。
func _inject_action(action: StringName) -> void:
	var event := InputEventAction.new()
	event.action = action
	event.pressed = true
	Input.parse_input_event(event)
	Input.flush_buffered_events()


## 模拟触摸屏「按下 / 抬起」：位置取目标格中心。
## ⚠️ 实测（error-signatures 新签名）：Input.parse_input_event 的坐标按「窗口像素」解释，
## 投递给场景前会乘 1/stretch_scale —— 所以必须先乘 final_transform（窗口 = 视口 × scale），
## 与真实触摸屏上报窗口坐标的行为一致；直接给视口坐标会被二次放大导致格子换算错位。
func _touch_at(cell: Vector2i, pressed: bool) -> void:
	var event := InputEventScreenTouch.new()
	event.index = 0
	event.position = _cell_event_pos(cell)
	event.pressed = pressed
	Input.parse_input_event(event)
	Input.flush_buffered_events()


## 模拟触摸屏「拖动」：把触点拖到目标格中心（位移 = CELL 级别，远超滑动阈值 42px）。
func _drag_to(cell: Vector2i) -> void:
	var event := InputEventScreenDrag.new()
	event.index = 0
	event.position = _cell_event_pos(cell)
	event.relative = Vector2(Board.CELL, 0.0)
	Input.parse_input_event(event)
	Input.flush_buffered_events()


## 格子 → 注入事件用的窗口坐标：视口坐标（棋盘全局位置 + 格子中心）× final_transform。
func _cell_event_pos(cell: Vector2i) -> Vector2:
	var viewport_pos: Vector2 = _board.global_position + _board.cell_to_position(cell)
	return get_viewport().get_final_transform() * viewport_pos


## 视口控件中心（如按钮）→ 注入事件用的窗口坐标（CanvasLayer 控件坐标即视口坐标）。
func _control_event_pos(control: Control) -> Vector2:
	return get_viewport().get_final_transform() * control.get_global_rect().get_center()


## 模拟真实触摸「点按」一个可点按控件（走完整触摸→鼠标镜像→Button 派发链路，
## 能拦住「镜像事件导致按钮触发两次」这类回归）。
func _tap_control(control: Control) -> void:
	var pos: Vector2 = _control_event_pos(control)
	var press := InputEventScreenTouch.new()
	press.index = 0
	press.position = pos
	press.pressed = true
	Input.parse_input_event(press)
	Input.flush_buffered_events()
	var release := InputEventScreenTouch.new()
	release.index = 0
	release.position = pos
	release.pressed = false
	Input.parse_input_event(release)
	Input.flush_buffered_events()


## 键位契约断言：目标键表 → project.godot [input] 的 physical_keycode（逐键 AND，E-12）。
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


## 键码 → 可读键名 + 数值（未映射键名会打私有区字形，数值才能定位）。
func _key_labels(keys: Array) -> String:
	var labels: PackedStringArray = []
	for code in keys:
		labels.append("%s(%d)" % [OS.get_keycode_string(code as Key), code])
	return "[%s]" % ", ".join(labels)


func _on_cursor_cell_changed(_cell: Vector2i) -> void:
	_cursor_moved_seen = true


func _on_selection_changed(_cell: Vector2i) -> void:
	_selection_seen = true


func _on_score_changed(_score: int) -> void:
	_score_changed_seen = true


func _on_moves_changed(_moves: int) -> void:
	_moves_changed_seen = true


func _on_candies_collected(_count: int) -> void:
	_candies_collected_seen = true


func _on_game_ended(outcome: String) -> void:
	if outcome == "win":
		_win_seen = true
	elif outcome == "lose":
		_lose_seen = true


func _on_game_restarted() -> void:
	_restarted_seen = true


func _on_board_shuffled() -> void:
	_shuffled_seen = true


func _on_level_changed(_level: int) -> void:
	_level_changed_seen = true
