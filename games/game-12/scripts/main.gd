extends Node2D
## 主场景控制器：装配计数页 UI、订阅 GameState 信号、承接全部输入路径。
##
## 规范要点（见 SKILL.md「场景规范」「移动端触摸规范」「反馈完备性」）：
## - 场景内信号连接统一写在 _ready()，集中可见、可被 preflight 静态核对；
## - 节点引用用 @onready + 类型标注，路径用 %唯一名 代替长路径字符串；
## - 计数有两条触发路径（+1 按钮 / confirm 动作[键盘空格·回车·触摸确认钮]），
##   只走同一个 _attempt_count() 入口 —— 防重判定只在 GameState 一处，不会被绕过；
## - 结果性事件（计数成功/被拦截/胜利/重开）各挂一条表现反馈。

@onready var player: Player = $Player
@onready var count_label: Label = %CountLabel
@onready var status_label: Label = %StatusLabel
@onready var count_button: Button = %CountButton
@onready var restart_button: Button = %RestartButton
@onready var touch_ui: CanvasLayer = $TouchUI

## ── 手感调参（集中常量，见 SKILL.md「常量提常量」）──
## 主按钮待机呼吸脉冲：峰值缩放。既是「可以点了」的示能，也让移动端门禁的
## 「画面在动」检查（双时点帧差 > 0）在无输入的静止页面上有确定性的非零帧差。
const PULSE_SCALE_MAX: float = 1.06
## 呼吸脉冲周期（秒）。smoke 以「窗口期内 scale 极差 ≥ PULSE_MIN_SWING」机判它的存在。
const PULSE_PERIOD: float = 0.9
## 冒烟判定呼吸脉冲存在的最小缩放极差（1.0 起步 → 1.06 峰值，理论极差 0.06）。
const PULSE_MIN_SWING: float = 0.02

var _move_hint: String = "WASD / 方向键移动指针 · 空格或点「+1」计数"
## 状态栏两条信息线分离：反馈线（拦截/胜利/重开）与指针线（脚手架可控行程）。
## 不分离的话，_on_player_moved 每物理帧重写 text 会把「连点已拦截」这类关键反馈立刻冲掉。
var _feedback: String = ""
var _pointer_text: String = ""
## 冒烟用：呼吸脉冲的缩放极值采样（_physics_process 里逐帧累计）。
var _pulse_min: float = 100.0
var _pulse_max: float = -100.0


func _ready() -> void:
	if DisplayServer.is_touchscreen_available():
		touch_ui.visible = true
		_move_hint = "摇杆移动指针 · 点「+1」或右下确认钮计数"
	_move_hint += " · 目标 %d 次" % GameState.TARGET_COUNT
	_setup_feedback_anchors()
	_start_idle_pulse()
	# 信号连接：订阅方（本场景）写连接代码，发布方（GameState / Player）只 emit。
	if not count_button.pressed.is_connected(_on_count_button_pressed):
		count_button.pressed.connect(_on_count_button_pressed)
	if not restart_button.pressed.is_connected(_on_restart_button_pressed):
		restart_button.pressed.connect(_on_restart_button_pressed)
	if not player.moved.is_connected(_on_player_moved):
		player.moved.connect(_on_player_moved)
	if not GameState.count_changed.is_connected(_on_count_changed):
		GameState.count_changed.connect(_on_count_changed)
	if not GameState.state_changed.is_connected(_on_state_changed):
		GameState.state_changed.connect(_on_state_changed)
	if not GameState.click_rejected.is_connected(_on_click_rejected):
		GameState.click_rejected.connect(_on_click_rejected)
	_refresh()


func _physics_process(_delta: float) -> void:
	# 呼吸脉冲采样：冒烟用「窗口期内 scale 极差」机判待机动画真的在动（防静音页面回退）。
	var s := count_button.scale.x
	_pulse_min = minf(_pulse_min, s)
	_pulse_max = maxf(_pulse_max, s)


## 反馈锚点：缩放/闪烁都绕控件中心做，不设 pivot 会从左上角缩放，视觉上「往右下飘」。
func _setup_feedback_anchors() -> void:
	count_label.pivot_offset = count_label.size / 2.0
	count_button.pivot_offset = count_button.size / 2.0


## 待机示能脉冲：主按钮 0.9s 一个呼吸周期（1.00 → 1.06 → 1.00），循环往复。
## 用 Tween 的 set_loops 而不是 _process 手写相位：无头/网页下同样生效，且不占每帧脚本。
func _start_idle_pulse() -> void:
	var tween := create_tween()
	tween.set_loops()
	tween.tween_property(count_button, "scale", Vector2.ONE * PULSE_SCALE_MAX, PULSE_PERIOD / 2.0) \
		.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	tween.tween_property(count_button, "scale", Vector2.ONE, PULSE_PERIOD / 2.0) \
		.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)


## 反馈线只由结果性事件写入；指针线由移动写入 —— 两者合成一条状态栏文本，
## 互不覆盖（否则移动指针会立刻冲掉「连点已拦截」的提示）。
func _set_feedback(text: String) -> void:
	_feedback = text
	_refresh_status()


func _refresh_status() -> void:
	var text := _feedback if _feedback != "" else _move_hint
	if _pointer_text != "":
		text += " · " + _pointer_text
	status_label.text = text


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("confirm"):
		_attempt_count()
	elif event.is_action_pressed("restart"):
		_restart()


## 计数唯一入口：真实时间戳交给 GameState 判定防重窗口。
func _attempt_count() -> void:
	GameState.try_count(Time.get_ticks_msec())


## 重开唯一入口：状态归零，入口恢复可用。
func _restart() -> void:
	GameState.reset()
	_set_feedback("已重开，从头计数")
	_flash(count_label, Color(0.55, 0.85, 1.0))


func _on_count_button_pressed() -> void:
	_attempt_count()


func _on_restart_button_pressed() -> void:
	_restart()


func _on_count_changed(value: int) -> void:
	count_label.text = str(value)
	_pop(count_label)


func _on_state_changed(state: int) -> void:
	# 入口可用性与状态绑定（而非只写在 _restart 里）：任何路径回到 PLAYING 都会复位按钮。
	count_button.disabled = state == GameState.State.WON
	if state == GameState.State.WON:
		_set_feedback("胜利！连点达标 %d 次，点「重开」再来一局" % GameState.TARGET_COUNT)
		_flash(count_label, Color(1.0, 0.85, 0.3))


func _on_click_rejected(remaining_ms: int) -> void:
	_set_feedback("连点已拦截（防重窗口 %dms，还需 %dms）" % [GameState.DEBOUNCE_MS, remaining_ms])
	_flash(count_button, Color(1.0, 0.45, 0.4))


func _on_player_moved(pos: Vector2) -> void:
	_pointer_text = "指针 %d,%d" % [int(pos.x), int(pos.y)]
	_refresh_status()


func _refresh() -> void:
	count_label.text = str(GameState.count)
	_refresh_status()


## 反馈：计数成功时的弹跳放大回弹。
func _pop(node: Control) -> void:
	node.scale = Vector2(1.18, 1.18)
	var tween := create_tween()
	tween.tween_property(node, "scale", Vector2.ONE, 0.12)


## 反馈：被拦截 / 重开 / 胜利时的闪烁提示色。
func _flash(node: CanvasItem, color: Color) -> void:
	node.modulate = color
	var tween := create_tween()
	tween.tween_property(node, "modulate", Color.WHITE, 0.25)
