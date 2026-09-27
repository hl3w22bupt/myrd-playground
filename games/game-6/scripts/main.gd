class_name RunnerMain
extends Node2D
## 主场景控制器：装配赛道物件、订阅 Player / GameState 信号、结算与重开。
##
## 规范要点（见 SKILL.md「场景规范」「移动端触摸规范」）：
## - 场景内信号连接统一写在 _ready()，集中可见、可被 preflight 静态核对；
## - 节点引用用 @onready + 类型标注；触摸 UI 只在有触摸屏时显示。

## 玩家出生点（地面顶 y=300，站立半高 32 → 中心 268）。
const PLAYER_SPAWN: Vector2 = Vector2(140, 268)

@onready var player: Player = $Player
@onready var hud_label: Label = %HudLabel
@onready var touch_ui: CanvasLayer = $TouchUI
@onready var settle_panel: CenterContainer = %SettlePanel
@onready var settle_label: Label = %SettleLabel
@onready var restart_button: Button = %RestartButton
@onready var _coins: Node2D = $World/Coins
@onready var _obstacles: Node2D = $World/Obstacles

var _move_hint: String = "W/↑/空格 跳跃（可二段跳） · S/↓ 滑铲"


func _ready() -> void:
	if DisplayServer.is_touchscreen_available():
		touch_ui.visible = true
		_move_hint = "点按/按钮跳跃 · 下滑滑铲"
	# 信号连接：订阅方（本场景）写连接代码，发布方（player / 物件 / GameState）只 emit。
	if not player.moved.is_connected(_on_player_moved):
		player.moved.connect(_on_player_moved)
	if not player.died.is_connected(_on_player_died):
		player.died.connect(_on_player_died)
	if not GameState.score_changed.is_connected(_on_score_changed):
		GameState.score_changed.connect(_on_score_changed)
	if not GameState.coins_changed.is_connected(_on_coins_changed):
		GameState.coins_changed.connect(_on_coins_changed)
	if not GameState.run_ended.is_connected(_on_run_ended):
		GameState.run_ended.connect(_on_run_ended)
	if not restart_button.pressed.is_connected(_on_restart_pressed):
		restart_button.pressed.connect(_on_restart_pressed)
	for coin: Coin in _coins.get_children():
		if not coin.body_entered.is_connected(_on_coin_body_entered):
			coin.body_entered.connect(_on_coin_body_entered.bind(coin))
	for hazard: Area2D in _obstacles.get_children():
		if not hazard.body_entered.is_connected(_on_hazard_body_entered):
			hazard.body_entered.connect(_on_hazard_body_entered)
	restart_run()


## 重开入口（结算按钮 / 确认键都走这里）：复位玩家、金币、状态与 UI。
func restart_run() -> void:
	player.global_position = PLAYER_SPAWN
	player.reset_for_run()
	for coin: Coin in _coins.get_children():
		coin.reset_coin()
	settle_panel.visible = false
	GameState.start_run()
	_update_hud()


func _unhandled_input(event: InputEvent) -> void:
	# 确认键只在结算页生效（运行中 Space 属于跳跃动作，避免误触重开）。
	if settle_panel.visible and event.is_action_pressed(&"confirm"):
		restart_run()


func _on_player_moved(pos: Vector2) -> void:
	var meters: float = maxf(0.0, (pos.x - PLAYER_SPAWN.x) / GameState.PIXELS_PER_METER)
	GameState.set_distance(meters)
	_update_hud()


func _on_player_died() -> void:
	GameState.end_run(false)


func _on_coin_body_entered(body: Node2D, coin: Coin) -> void:
	if body is Player and GameState.run_active:
		coin.collect()
		GameState.add_coin()


func _on_hazard_body_entered(body: Node2D) -> void:
	if body is Player and GameState.run_active:
		player.die()


func _on_score_changed(_score: int) -> void:
	_update_hud()


func _on_restart_pressed() -> void:
	restart_run()


func _on_coins_changed(_coins_count: int) -> void:
	_update_hud()


func _on_run_ended(win: bool, score: int, coins: int, distance_m: float) -> void:
	var title: String = "达标！" if win else "本局结束"
	settle_label.text = "%s\n距离 %d 米 · 金币 %d 枚 · 得分 %d\n历史最高分 %d\n%s" % [
		title, int(distance_m), coins, score, GameState.best_score, _move_hint,
	]
	settle_panel.visible = true


func _update_hud() -> void:
	hud_label.text = "%s · 距离 %dm · 金币 %d/%d · 分数 %d · 最高分 %d" % [
		_move_hint,
		int(GameState.distance_m),
		GameState.coins,
		GameState.WIN_COIN_GOAL,
		GameState.score,
		GameState.best_score,
	]
