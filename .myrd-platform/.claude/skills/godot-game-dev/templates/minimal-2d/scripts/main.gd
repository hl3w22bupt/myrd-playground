extends Node2D
## 主场景控制器：装配 UI、订阅 Player 与 GameState 的信号。
##
## 规范要点（见 SKILL.md「场景规范」「移动端触摸规范」「反馈完备性（Juice）」「调参工作台」）：
## - 场景内信号连接统一写在 _ready()，集中可见、可被 preflight 静态核对；
## - 节点引用用 @onready + 类型标注，路径用 %唯一名 代替长路径字符串；
## - 触摸 UI（摇杆/确认按钮）按触摸能力显示（Web 下 fail-open 判定，见 _touch_ui_should_show）；
## - 结果性事件的反馈挂在这里（_on_score_changed），不挂在输入处理上 —— 冒烟第 6 项断言；
## - 调参面板只在网页 + ?tuning 参数时创建（TuningPanel.is_enabled()），桌面/无头零成本。

@onready var player: Player = $Player
@onready var hud_label: Label = %HudLabel
@onready var touch_ui: CanvasLayer = $TouchUI

var _move_hint: String = "WASD / 方向键移动"


func _ready() -> void:
	if _touch_ui_should_show():
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


## 触屏 UI 显示判定（v5.4）：Web 一律显示；非 Web 用引擎判定。
## ⚠️ 教训链（game-8 v5→v5.1→v5.2 线上三连例）：
##   - v5 用 matchMedia('coarse') 一票否决 → 真机摇杆被藏（fail-closed 致整局不可玩）；
##   - v5.1 改 fail-open 但仍以引擎 is_touchscreen_available() 为第一道门 → 该调用在
##     web 实测不可靠（注入 ontouchstart 仍返回 false），真机照样不显示；
##   - v5.2 Web 完全绕开引擎直接问浏览器，真机/平板/触屏笔本显示，纯桌面隐藏。
func _touch_ui_should_show() -> bool:
	# v5.4 口径：Web 一律显示。教训链 v5→v5.4（线上真机）：任何触摸检测
	# （引擎/浏览器三信号/视口宽度）都出现过假阴性，隐藏摇杆 = 移动端整局不可玩；
	# 桌面多两个控件只是视觉冗余。非 Web（桌面/无头）用引擎判定。
	if OS.has_feature("web"):
		return true
	return DisplayServer.is_touchscreen_available()


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
