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

var _move_hint: String = "WASD / 方向键移动指针 · 空格或点「+1」计数"


func _ready() -> void:
	if DisplayServer.is_touchscreen_available():
		touch_ui.visible = true
		_move_hint = "摇杆移动指针 · 点「+1」或右下确认钮计数"
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
	count_button.disabled = false
	status_label.text = "已重开，从头计数"
	_flash(count_label, Color(0.55, 0.85, 1.0))


func _on_count_button_pressed() -> void:
	_attempt_count()


func _on_restart_button_pressed() -> void:
	_restart()


func _on_count_changed(value: int) -> void:
	count_label.text = str(value)
	_pop(count_label)


func _on_state_changed(state: int) -> void:
	if state == GameState.State.WON:
		count_button.disabled = true
		status_label.text = "胜利！连点达标 %d 次，点「重开」再来一局" % GameState.TARGET_COUNT
		_flash(count_label, Color(1.0, 0.85, 0.3))


func _on_click_rejected(remaining_ms: int) -> void:
	status_label.text = "连点已拦截（防重窗口 %dms，还需 %dms）" % [GameState.DEBOUNCE_MS, remaining_ms]
	_flash(count_button, Color(1.0, 0.45, 0.4))


func _on_player_moved(pos: Vector2) -> void:
	status_label.text = "%s · 指针 %d,%d" % [_move_hint, int(pos.x), int(pos.y)]


func _refresh() -> void:
	count_label.text = str(GameState.count)
	status_label.text = "%s · 目标 %d 次" % [_move_hint, GameState.TARGET_COUNT]


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
