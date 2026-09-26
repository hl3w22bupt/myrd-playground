extends Node2D
## 主场景控制器：装配赛道/玩家/HUD，订阅全部信号，处理「重开一局」与结果反馈。
##
## 规范要点（见 SKILL.md「GDScript 规范」）：
## - 场景内信号连接统一写在 _ready()，集中可见、可被 preflight 静态核对；
## - 节点引用用 @onready + 类型标注，跨层级用 %唯一名；
## - 信号单向：Player/Level 只 emit，这里集中订阅并调用 GameState；UI 不反持游戏对象。
##
## 玩法闭环（谁 emit、谁订阅、谁改状态）：
##   Player.moved → HUD 进度；Player.died（坠坑）→ GameState.register_loss
##   Level.hazard_hit（撞尖刺）→ register_loss；Level.dart_collected → add_score + 飞镖消失
##   Level.goal_reached → register_win；GameState.game_won/game_lost → 结算文案 + 震屏反馈
##   输入 restart（R / 回车 / 触摸重开按钮）→ restart_run()（就地重置，不重载场景）
##   §3B：上述结果事件在各自处理函数里统一挂 Juice 反馈（pop/flash/sfx）——
##   反馈事件流（Juice.feedback_fired）同时是机器人试玩门禁的采样锚点。
##
## UI 组织（分数/提示/结算各司其职，全部挂在独立的 UI CanvasLayer）：
##   %HudLabel  = 常驻分数行（分数 · 进度 · 历史最佳）
##   %HintLabel = 常驻操作提示（按输入设备切换文案）
##   %StateLabel = 结算弹层（胜利/失败文案，重开时隐藏）

## 相机基准偏移：与 main.tscn 里 CameraRig 的 offset 保持一致（震屏结束后归位到这里）。
const CAMERA_BASE_OFFSET: Vector2 = Vector2(180, -40)
## 震屏时长（物理帧）与幅度（像素）：失败重震、过关轻震，都是结果性事件的反馈。
const SHAKE_FRAMES_LOSS: int = 18
const SHAKE_FRAMES_WIN: int = 8
const SHAKE_AMPLITUDE: float = 7.0

@onready var player: Player = $Player
@onready var level: GameLevel = $Level
@onready var camera: Camera2D = $Player/CameraRig
@onready var hud_label: Label = %HudLabel
@onready var hint_label: Label = %HintLabel
@onready var state_label: Label = %StateLabel
@onready var touch_ui: CanvasLayer = $TouchUI

## 常驻操作提示（按输入设备切换文案）。
var _move_hint: String = "空格/W 跳跃（空中再按=二段跳） · R 重开"
## 震屏剩余帧数（>0 即在震，_process 里逐帧衰减到 0 后相机归位）。
var _shake_left: int = 0
## 震屏总时长（衰减比例的分母）。
var _shake_total: int = 0


func _ready() -> void:
	if DisplayServer.is_touchscreen_available():
		touch_ui.visible = true
		_move_hint = "右下「跳」键跳跃（空中再按=二段跳）"
	# 相机边界：左不出赛道起点、右不出终点墙、下不到深坑底部之外。
	camera.limit_left = 0
	camera.limit_right = int(GameLevel.TRACK_END_X)
	camera.limit_bottom = 340
	camera.offset = CAMERA_BASE_OFFSET

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
	hint_label.text = _move_hint
	_refresh_hud()


func _process(_delta: float) -> void:
	# 震屏：确定性衰减（逐帧 -1，到 0 精确归位），只动相机偏移，不碰玩法逻辑。
	if _shake_left > 0:
		_shake_left -= 1
		var strength := SHAKE_AMPLITUDE * float(_shake_left) / float(maxi(_shake_total, 1))
		camera.offset = CAMERA_BASE_OFFSET + Vector2(randf_range(-1.0, 1.0), randf_range(-1.0, 1.0)) * strength
		if _shake_left == 0:
			camera.offset = CAMERA_BASE_OFFSET


## 冒烟断言用：反馈是否正在播（失败/过关震屏）。
func is_shaking() -> bool:
	return _shake_left > 0


func _unhandled_input(event: InputEvent) -> void:
	# 重开只在结算后（WON/LOST）受理：奔跑中忽略 —— 自动跑酷里玩家不控方向，
	# 奔跑中误触 R 会静默清掉已有进度（playtest 机器人实测：随机 R 流把角色按在
	# 起点 144px 内，核心循环 20s 收集数为 0）。结算弹层的「按 R 重开」文案与之配套。
	if event.is_action_pressed(&"restart") and GameState.state != GameState.State.PLAYING:
		restart_run()


## 重开一局：就地重置（不重载场景 —— fuzz/冒烟门禁要求主场景常驻树上）。
func restart_run() -> void:
	level.reset()
	player.respawn()
	GameState.reset()
	state_label.visible = false
	_refresh_hud()
	# §3B 确认类反馈：重开指令已被受理（音效资产后补，事件流始终有记录）。
	Juice.sfx(&"confirm")


func _refresh_hud() -> void:
	var progress := clampf(player.global_position.x / GameLevel.GOAL_X * 100.0, 0.0, 100.0)
	hud_label.text = "疾风忍者跑 · 分数 %d · 进度 %d%% · 最佳 %d" % [
		GameState.score, int(progress), GameState.best_score,
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
	# 生效分值：URL ?tuning= 可覆盖（game_state.gd TUNING_META 钳制），未调参时等于 DART_SCORE。
	GameState.add_score(GameState.dart_score_value())
	dart.collect()
	# §3B 结果反馈：HUD 分数弹跳 + 得分音效（音效资产后补，SFX_BANK 注册即出声）。
	Juice.pop(hud_label)
	Juice.sfx(&"score")


func _on_goal_reached() -> void:
	GameState.register_win()


func _on_game_won(final_score: int) -> void:
	player.freeze()
	_start_shake(SHAKE_FRAMES_WIN)
	state_label.text = "胜利！坚持跑到底 · 本局 %d 分\n按 R / 回车 重开一局" % final_score
	state_label.visible = true
	# §3B 结果反馈：结算弹层弹跳 + 确认音效（过关 = 确认类结果）。
	Juice.pop(state_label)
	Juice.sfx(&"confirm")


func _on_game_lost(final_score: int) -> void:
	player.freeze()
	_start_shake(SHAKE_FRAMES_LOSS)
	state_label.text = "失败…本局收集飞镖 %d 枚\n按 R / 回车 重开一局" % final_score
	state_label.visible = true
	# §3B 结果反馈：结算弹层闪红 + 失败音效（震屏仍由上方 _start_shake 驱动，冒烟断言依赖）。
	Juice.flash(state_label, Color(1.0, 0.35, 0.3, 0.85))
	Juice.sfx(&"fail")


func _start_shake(frames: int) -> void:
	_shake_total = frames
	_shake_left = frames
