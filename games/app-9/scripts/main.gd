extends Node2D
## 主场景控制器：流星派发、收集交互（点击 / 祈愿脉冲）、胜负判定与重开入口。
##
## 玩法口径（需求：冒烟愿晶——一闪即逝的流星，收集三颗即胜）：
## - 流星以短窗口随机出现（meteor_window_seconds，默认 2s），窗口结束消失且不可再点击；
## - 窗口期内点击流星（鼠标/触摸，CLICK_RADIUS 容差）或靠近后按 confirm 发祈愿脉冲
##   （pulse_radius 半径）即收集成功：计数 +1 + 动画/音效反馈；
## - 未收集的流星消失不计失败，单局持续派发，直至集齐 WIN_COUNT(3) 颗即胜；
## - HUD 常显进度 x/3；胜利立即结算展示遮罩，重开（R 键 / 按钮 / 胜利后 confirm）复位再战。
##
## 规范要点（见 SKILL.md）：
## - 信号连接统一写在 _ready()，订阅方集中连接，发布方（Player/Meteor/GameState）只 emit；
## - 节点引用用 @onready + %唯一名；触摸 UI 只在有触摸屏时显示；
## - 结果性事件的反馈挂在结果处理函数上（_on_meteor_collected / _on_score_changed / _on_won），
##   不挂在输入处理上 —— 冒烟第 6 项断言；
## - 调参面板只在网页 + ?tuning 参数时创建（TuningPanel.is_enabled()），桌面/无头零成本。

const METEOR_SCENE: PackedScene = preload("res://scenes/meteor.tscn")
## 派发区安全边距：避开顶部 HUD 带与四边，流星不出画。
const SPAWN_MARGIN: float = 56.0
const HUD_TOP_BAND: float = 72.0

@onready var player: Player = $Player
@onready var hud_label: Label = %HudLabel
@onready var meteors: Node2D = $Meteors
@onready var win_overlay: ColorRect = %WinOverlay
@onready var win_title: Label = %WinTitle
@onready var restart_button: Button = %RestartButton
@onready var touch_ui: CanvasLayer = $TouchUI

## 派发开关：胜利即停、重开恢复（冒烟断言「胜利后不再派发 / 重开后恢复」的观测点）。
var spawning: bool = false
var _spawn_cooldown: float = 0.0
var _rng := RandomNumberGenerator.new()
var _move_hint: String = "WASD/方向键移动 · 空格祈愿脉冲 · 点击流星收集"


func _ready() -> void:
	if DisplayServer.is_touchscreen_available():
		touch_ui.visible = true
		_move_hint = "摇杆移动 · 点流星 / 右下按钮收集"
	_rng.randomize()
	# 信号连接：订阅方（本场景）写连接代码，发布方只 emit。
	if not player.moved.is_connected(_on_player_moved):
		player.moved.connect(_on_player_moved)
	if not GameState.score_changed.is_connected(_on_score_changed):
		GameState.score_changed.connect(_on_score_changed)
	if not GameState.won.is_connected(_on_won):
		GameState.won.connect(_on_won)
	if not GameState.restarted.is_connected(_on_restarted):
		GameState.restarted.connect(_on_restarted)
	if not restart_button.pressed.is_connected(_on_restart_pressed):
		restart_button.pressed.connect(_on_restart_pressed)
	hud_label.text = _hud_text()
	# 开局即有一颗流星在窗口内（首反馈不迟到），此后按 spawn_interval_seconds 持续派发。
	_spawn_cooldown = 0.0
	spawning = true
	# 调参工作台（SKILL.md §3C）：网页 + URL 带 ?tuning 参数才创建，其余环境零成本。
	if TuningPanel.is_enabled():
		add_child(TuningPanel.new())


func _process(delta: float) -> void:
	if not spawning or GameState.won_state:
		return
	_spawn_cooldown -= delta
	if _spawn_cooldown <= 0.0:
		_spawn_cooldown = GameState.spawn_interval_seconds
		_spawn_meteor()


## ── 派发 ──
func _spawn_meteor() -> void:
	var meteor: Meteor = METEOR_SCENE.instantiate() as Meteor
	meteor.position = Vector2(
		_rng.randf_range(SPAWN_MARGIN, GameState.FIELD_WIDTH - SPAWN_MARGIN),
		_rng.randf_range(HUD_TOP_BAND, GameState.FIELD_HEIGHT - SPAWN_MARGIN),
	)
	if not meteor.collected.is_connected(_on_meteor_collected):
		meteor.collected.connect(_on_meteor_collected)
	if not meteor.expired.is_connected(_on_meteor_expired):
		meteor.expired.connect(_on_meteor_expired)
	meteors.add_child(meteor)


## ── 收集交互（两条路径，同一条收集管线）──
func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("restart"):
		restart()
		get_viewport().set_input_as_handled()
		return
	if event.is_action_pressed("confirm"):
		if GameState.won_state:
			restart()  # 胜利结算态：confirm 即「再来一局」
		else:
			_do_wish_pulse()
		get_viewport().set_input_as_handled()
		return
	# 点击收集：鼠标左键（触摸默认镜像为鼠标事件，移动端点流星同路径）。
	# event.position 由引擎按拉伸变换逆映射过，已是画布坐标 —— 直接比对流星位置，
	# 不得再乘 get_final_transform().affine_inverse()（headless 实测会二次缩放点到天外）。
	var click := event as InputEventMouseButton
	if click != null and click.button_index == MOUSE_BUTTON_LEFT and click.pressed:
		_try_click_collect(click.position)


## 点击流星：窗口期内、命中半径内才收集（窗口外/未命中一律无效 —— 需求验收第 2 条）。
func _try_click_collect(world_pos: Vector2) -> void:
	if GameState.won_state:
		return
	for child in meteors.get_children():
		var meteor := child as Meteor
		if meteor != null and meteor.contains_point(world_pos):
			collect_meteor(meteor)
			return


## 祈愿脉冲：以玩家为圆心、pulse_radius 为半径，收走范围内全部在窗流星。
func _do_wish_pulse() -> void:
	if GameState.won_state:
		return
	for child in meteors.get_children():
		var meteor := child as Meteor
		if meteor != null and meteor.within_pulse(player.global_position, GameState.pulse_radius):
			collect_meteor(meteor)


## 收集管线：流星播离场动画 → 主场景挂反馈 + 计数（反馈挂在结果处理函数上）。
func collect_meteor(meteor: Meteor) -> void:
	meteor.collect()


func _on_meteor_collected(_meteor: Meteor) -> void:
	Juice.sfx(&"score")
	GameState.add_score(1)


func _on_meteor_expired(_meteor: Meteor) -> void:
	pass  # 未收集不计失败（需求第 3 条）：安静离场，无惩罚反馈


## ── HUD 与胜负 ──
func _hud_text() -> String:
	return "冒烟愿晶 · 进度 %d/%d · %s" % [GameState.score, GameState.WIN_COUNT, _move_hint]


func _on_player_moved(pos: Vector2) -> void:
	hud_label.text = "%s · 玩家 %d,%d" % [_hud_text(), int(pos.x), int(pos.y)]


func _on_score_changed(score: int) -> void:
	hud_label.text = _hud_text()
	# 结果性反馈：HUD 进度弹跳（收集音效在 _on_meteor_collected，一处一个职责）。
	Juice.pop(hud_label)


func _on_won() -> void:
	spawning = false
	win_title.text = "愿晶集齐！三颗流星已入怀"
	win_overlay.visible = true
	# 胜利结算反馈：闪白 + 震动 + 上行音效。
	Juice.flash(win_overlay)
	Juice.shake(6.0)
	Juice.sfx(&"score")


## ── 重开（三个入口：R 键 / RestartButton / 胜利后 confirm）──
func restart() -> void:
	GameState.reset()


func _on_restart_pressed() -> void:
	restart()


func _on_restarted() -> void:
	for child in meteors.get_children():
		child.queue_free()
	player.reset_to_center()
	win_overlay.visible = false
	spawning = true
	_spawn_cooldown = 0.0
	hud_label.text = _hud_text()
	Juice.sfx(&"confirm")
