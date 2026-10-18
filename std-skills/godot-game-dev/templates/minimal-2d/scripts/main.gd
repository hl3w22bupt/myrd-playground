extends Node2D
## 主场景控制器：装配 UI、订阅 Player 与 GameState 的信号。
##
## 规范要点（见 SKILL.md「场景规范」「移动端触摸规范」「反馈完备性（Juice）」「调参工作台」）：
## - 场景内信号连接统一写在 _ready()，集中可见、可被 preflight 静态核对；
## - 节点引用用 @onready + 类型标注，路径用 %唯一名 代替长路径字符串；
## - 触摸 UI（摇杆/确认按钮）只在有触摸屏时显示，桌面键盘环境完全不可见；
## - 结果性事件的反馈挂在这里（_on_score_changed），不挂在输入处理上 —— 冒烟第 6 项断言；
## - 调参面板只在网页 + ?tuning 参数时创建（TuningPanel.is_enabled()），桌面/无头零成本。

@onready var player: Player = $Player
@onready var hud_label: Label = %HudLabel
@onready var touch_ui: CanvasLayer = $TouchUI

var _move_hint: String = "WASD / 方向键移动"


func _ready() -> void:
	if DisplayServer.is_touchscreen_available():
		touch_ui.visible = true
		_move_hint = "摇杆移动 · 右下按钮确认"
	# 信号连接：订阅方（本场景）写连接代码，发布方（player / GameState）只 emit。
	if not player.moved.is_connected(_on_player_moved):
		player.moved.connect(_on_player_moved)
	if not GameState.score_changed.is_connected(_on_score_changed):
		GameState.score_changed.connect(_on_score_changed)
	hud_label.text = "%s · 分数 0" % _move_hint
	# 调参工作台（SKILL.md §3C）：网页 + URL 带 ?tuning 参数才创建，其余环境零成本。
	if TuningPanel.is_enabled():
		add_child(TuningPanel.new())


func _on_player_moved(pos: Vector2) -> void:
	hud_label.text = "%s · 坐标 %d,%d · 分数 %d" % [_move_hint, int(pos.x), int(pos.y), GameState.score]


func _on_score_changed(score: int) -> void:
	hud_label.text = "%s · 坐标 %d,%d · 分数 %d" % [_move_hint, int(player.global_position.x), int(player.global_position.y), score]
	# 结果性事件（分数变化）的反馈：弹跳 + 音效（SFX_BANK 未注册时静默空转，冒烟只看 events 非空）。
	Juice.pop(hud_label)
	Juice.sfx(&"score")


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("confirm"):
		GameState.add_score(1)
		Juice.sfx(&"confirm")
