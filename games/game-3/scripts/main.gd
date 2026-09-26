extends Node2D
## 主场景控制器：装配赛道/玩家/HUD，订阅全部信号，处理「重开一局」。
##
## 规范要点（见 SKILL.md「GDScript 规范」）：
## - 场景内信号连接统一写在 _ready()，集中可见、可被 preflight 静态核对；
## - 节点引用用 @onready + 类型标注，跨层级用 %唯一名；
## - 信号单向：Player/Level 只 emit，这里集中订阅并调用 GameState；UI 不反持游戏对象。
##
## 玩法闭环（谁 emit、谁订阅、谁改状态）：
##   Player.moved → HUD 进度；Player.died（坠坑）→ GameState.register_loss
##   Level.hazard_hit（撞尖刺）→ register_loss；Level.dart_collected → add_score + 飞镖消失
##   Level.goal_reached → register_win；GameState.game_won/game_lost → 结算文案
##   输入 restart（R / 回车 / 触摸重开按钮）→ restart_run()（就地重置，不重载场景）

@onready var player: Player = $Player
@onready var level: GameLevel = $Level
@onready var camera: Camera2D = $Player/CameraRig
@onready var hud_label: Label = %HudLabel
@onready var state_label: Label = %StateLabel
@onready var touch_ui: CanvasLayer = $TouchUI

## HUD 常驻操作提示（按输入设备切换文案）。
var _move_hint: String = "空格/W 跳跃（空中再按=二段跳） · R 重开"


func _ready() -> void:
	if DisplayServer.is_touchscreen_available():
		touch_ui.visible = true
		_move_hint = "右下「跳」键跳跃（空中再按=二段跳）"
	# 相机边界：左不出赛道起点、右不出终点墙、下不到深坑底部之外。
	camera.limit_left = 0
	camera.limit_right = int(GameLevel.TRACK_END_X)
	camera.limit_bottom = 340

	# ── 订阅：游戏对象只 emit，这里集中接线 ──
	if not player.moved.is_connected(_on_player_moved):
		player.moved.connect(_on_player_moved)
	if not player.died.is_connected(_on_player_died):
		player.died.connect(_on_player_died)
	if not level.hazard_hit.is_connected(_on_level_hazard_hit):
		level.hazard_hit.connect(_on_level_hazard_hit)
	if not level.dart_collected.is_connected(_on_dart_collected):
		level.dart_collected.connect(_on_dart_collected)
	if not level.goal_reached.is_connected(_on_goal_reached):
		level.goal_reached.connect(_on_goal_reached)
	if not GameState.score_changed.is_connected(_on_score_changed):
		GameState.score_changed.connect(_on_score_changed)
	if not GameState.game_won.is_connected(_on_game_won):
		GameState.game_won.connect(_on_game_won)
	if not GameState.game_lost.is_connected(_on_game_lost):
		GameState.game_lost.connect(_on_game_lost)

	state_label.visible = false
	_refresh_hud()


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed(&"restart"):
		restart_run()


## 重开一局：就地重置（不重载场景 —— fuzz/冒烟门禁要求主场景常驻树上）。
func restart_run() -> void:
	level.reset()
	player.respawn()
	GameState.reset()
	state_label.visible = false
	_refresh_hud()


func _refresh_hud() -> void:
	var progress := clampf(player.global_position.x / GameLevel.GOAL_X * 100.0, 0.0, 100.0)
	hud_label.text = "疾风忍者跑 · 进度 %d%% · 飞镖 %d · %s" % [
		int(progress), GameState.score, _move_hint,
	]


func _on_player_moved(_position: Vector2) -> void:
	_refresh_hud()


func _on_score_changed(_score: int) -> void:
	_refresh_hud()


func _on_player_died(_cause: String) -> void:
	GameState.register_loss()


func _on_level_hazard_hit(_kind: String) -> void:
	GameState.register_loss()


func _on_dart_collected(dart: Dart) -> void:
	GameState.add_score(GameState.DART_SCORE)
	dart.collect()


func _on_goal_reached() -> void:
	GameState.register_win()


func _on_game_won(final_score: int) -> void:
	player.freeze()
	state_label.text = "胜利！坚持跑到底 · 本局 %d 分\n按 R / 回车 重开一局" % final_score
	state_label.visible = true


func _on_game_lost(final_score: int) -> void:
	player.freeze()
	state_label.text = "失败…本局收集飞镖 %d 枚\n按 R / 回车 重开一局" % final_score
	state_label.visible = true
