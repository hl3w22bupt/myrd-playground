class_name RunnerMain
extends Node2D
## 主场景控制器（spec scene: main.tscn）：装配赛道生成器、订阅 Player / GameState 信号、
## 死亡慢动作、结算展示与一键重开。
##
## 规范要点（见 SKILL.md「场景规范」）：
## - 场景内信号连接统一写在 _ready()，集中可见、可被 preflight 静态核对；
## - 节点引用用 @onready + 类型标注；触摸 UI 只在有触摸屏时显示。

## 玩家出生点（地面顶 y=300，站立半高 32 → 中心 268）。
## x=190：与首格道具盒（chunk 局部 x=120、盒心离地 46、拾取半径 22 → 世界圆 x∈[98,142]）
## 保持不相交（玩家半宽 22 → 需 x ≥ 164）——迭代需求 ①接入真实拾取碰撞后，
## 出生点若压在道具盒上会「每局第 1 帧白捡一个随机道具」（护盾/冲刺会破坏负向局确定性）。
const PLAYER_SPAWN: Vector2 = Vector2(190, 268)

## 键盘操作提示 / 触屏操作提示（acc-01 双通道）。
const HINT_KEYBOARD: String = "W/↑/空格 跳跃（可二段跳） · S/↓ 滑铲 · R 重开"
const HINT_TOUCH: String = "点按/上滑 跳跃（可二段跳） · 下滑 滑铲"

@onready var player: Player = $Player
@onready var track_builder: TrackBuilder = $World/TrackBuilder
@onready var hud: Hud = $Hud
@onready var settle_panel: SettlePanel = $Overlay/SettlePanel
@onready var touch_ui: CanvasLayer = $TouchUI
@onready var _player_camera: Camera2D = $Player/Camera2D

## 本局抽取种子（每局换赛道，重玩钩子）。
var _run_seed: int = 0
## 死亡慢动作剩余真实时间（秒）。
var _slow_motion_left: float = 0.0

var _move_hint: String = HINT_KEYBOARD


func _ready() -> void:
	if DisplayServer.is_touchscreen_available():
		touch_ui.visible = true
		_move_hint = HINT_TOUCH
	hud.set_move_hint(_move_hint)
	hud.camera = _player_camera
	# 信号连接：订阅方（本场景）写连接代码，发布方（player / GameState / 面板）只 emit。
	if not player.moved.is_connected(_on_player_moved):
		player.moved.connect(_on_player_moved)
	if not player.died.is_connected(_on_player_died):
		player.died.connect(_on_player_died)
	if not GameState.run_ended.is_connected(_on_run_ended):
		GameState.run_ended.connect(_on_run_ended)
	if not settle_panel.restart_requested.is_connected(_on_restart_requested):
		settle_panel.restart_requested.connect(_on_restart_requested)
	# 调参工作台（SKILL.md §3C）：网页 + URL 带 ?tuning 参数才创建，其余环境零成本。
	if TuningPanel.is_enabled():
		add_child(TuningPanel.new())
	restart_run()


## 重开入口（结算按钮 / 确认键都走这里）：复位玩家、赛道、状态与 UI。
## 无头冒烟也直接调用（acc-05「点击重新开始立即开始新局，无重启加载」）。
func restart_run() -> void:
	Engine.time_scale = 1.0
	_slow_motion_left = 0.0
	_run_seed = randi()
	player.global_position = PLAYER_SPAWN
	player.reset_for_run()
	track_builder.reset_run(_run_seed)
	settle_panel.hide_panel()
	GameState.start_run()
	hud.refresh_best()
	hud.set_move_hint(_move_hint)


func _process(delta: float) -> void:
	# 死亡慢动作：真实时间计时恢复（ignore_time_scale 计时，见策划案 deathSlowMotionSeconds）。
	if _slow_motion_left > 0.0:
		_slow_motion_left = maxf(_slow_motion_left - delta, 0.0)
		if _slow_motion_left == 0.0:
			Engine.time_scale = 1.0


func _on_player_moved(pos: Vector2) -> void:
	var meters: float = maxf(0.0, (pos.x - PLAYER_SPAWN.x) / GameState.tuning_value(&"pixelsPerMeter"))
	GameState.set_distance(meters)


func _on_player_died(_cause: StringName) -> void:
	# 死亡表现：弹飞（player）+ 慢动作 0.3s（spec fx）→ 结算由 run_ended 回调展示。
	Engine.time_scale = 0.3
	_slow_motion_left = GameState.tuning_value(&"deathSlowMotionSeconds")
	GameState.end_run(false)


func _on_run_ended(win: bool, score: int, coins: int, distance_m: float) -> void:
	settle_panel.show_result(win, score, coins, distance_m)


func _on_restart_requested() -> void:
	restart_run()
