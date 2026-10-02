extends Node2D
## 《hello》主场景控制器：装配 UI、订阅 Player / Collectible / GameState 的信号。
##
## 玩法闭环（谁接收输入、谁改状态、谁 emit、谁订阅、谁渲染）：
##   输入：InputMap 动作（键盘 WASD/方向键 + 触屏摇杆）→ player.gd 驱动 velocity；
##   收集：Collectible(Area2D) body_entered → collect() → emit collected(id)；
##   计分：Main 订阅 collected → GameState.add_score(1) → emit score_changed；
##   胜负：GameState 达到 WIN_SCORE → emit game_won → Main 显示胜利文案；
##   重开：confirm 动作（空格/回车/触屏按钮）→ Main.restart() → 分数清零、旧收集物移除，
##         下一物理帧玩家送回出生点、再隔 2 帧按原位重新实例化全部收集物。

## 收集物场景（重开时按原位重新实例化的唯一来源）。
const COLLECTIBLE_SCENE: PackedScene = preload("res://scenes/collectible.tscn")

@onready var player: Player = $Player
@onready var hud_label: Label = %HudLabel
@onready var win_label: Label = %WinLabel
@onready var touch_ui: CanvasLayer = $TouchUI
@onready var collectibles: Node2D = $Collectibles

var _move_hint: String = "WASD / 方向键移动"
## 玩家出生点（_ready 时记录，重开一局时送回，避免出生在刚复活的收集物上被瞬间收集）。
var _player_spawn: Vector2 = Vector2.ZERO
## 收集物编号 → 摆放点（_ready 时从场景记录，重开按它复位）。
var _spawn_points: Dictionary = {}
## 重开两段式（都在 _physics_process 里做，保证物理世界时序确定）：
## ① 玩家瞬移回出生点（物理步内位移，body 当帧同步）；② 再隔 2 帧实例化收集物，
##    此时旧收集物已销毁、玩家 body 已在新位置，绝无残留重叠。
var _player_teleport_pending: bool = false
var _respawn_countdown: int = 0


func _ready() -> void:
	_player_spawn = player.global_position
	if DisplayServer.is_touchscreen_available():
		touch_ui.visible = true
		_move_hint = "摇杆移动 · 收集金色方块"
	# 信号连接：订阅方（本场景）写连接代码，发布方（player / collectible / GameState）只 emit。
	for collectible in _collectible_nodes():
		_spawn_points[collectible.id] = collectible.position
		if not collectible.collected.is_connected(_on_collectible_collected):
			collectible.collected.connect(_on_collectible_collected)
	if not player.moved.is_connected(_on_player_moved):
		player.moved.connect(_on_player_moved)
	if not GameState.score_changed.is_connected(_on_score_changed):
		GameState.score_changed.connect(_on_score_changed)
	if not GameState.game_won.is_connected(_on_game_won):
		GameState.game_won.connect(_on_game_won)
	win_label.visible = false
	_refresh_hud(_player_spawn)


func _physics_process(_delta: float) -> void:
	# 重开两段式：先在物理步内把玩家送回出生点，再隔 2 帧实例化收集物。
	# 时序确定性依赖「瞬移必须在物理步内做」——物理步外改坐标会留下残影位置
	# （冒烟实测：玩家节点已回出生点，新收集物仍被残影 body 瞬间收走）。
	if _player_teleport_pending:
		_player_teleport_pending = false
		player.teleport_to(_player_spawn)
		_respawn_countdown = 2
	elif _respawn_countdown > 0:
		_respawn_countdown -= 1
		if _respawn_countdown == 0:
			_spawn_all_collectibles()


## 收集物编号 → 计分（收集反馈的唯一计分入口，其余路径不加分）。
func _on_collectible_collected(_id: int) -> void:
	GameState.add_score(1)


func _on_player_moved(pos: Vector2) -> void:
	_refresh_hud(pos)


func _on_score_changed(_score: int) -> void:
	_refresh_hud(player.global_position)


func _on_game_won(score: int) -> void:
	win_label.text = "收集完成！收集 %d/%d · 按 空格 / 回车 重开" % [score, GameState.WIN_SCORE]
	win_label.visible = true


## 重开入口：清零分数、移除旧收集物、（下一物理帧）玩家送回出生点、再隔 2 帧按原位复活。
func restart() -> void:
	GameState.reset()
	for child in collectibles.get_children():
		child.queue_free()
	win_label.visible = false
	_refresh_hud(_player_spawn)
	_player_teleport_pending = true


func _refresh_hud(pos: Vector2) -> void:
	var state_text: String = "收集 %d/%d" % [GameState.score, GameState.WIN_SCORE]
	if GameState.won:
		state_text = "已完成一局"
	hud_label.text = "《hello》 · %s · %s · 坐标 %d,%d" % [
		_move_hint, state_text, int(pos.x), int(pos.y),
	]


func _collectible_nodes() -> Array[Collectible]:
	var nodes: Array[Collectible] = []
	for child in collectibles.get_children():
		var collectible := child as Collectible
		if collectible != null:
			nodes.append(collectible)
	return nodes


func _spawn_all_collectibles() -> void:
	for id: int in _spawn_points:
		_spawn_collectible(id)


func _spawn_collectible(id: int) -> void:
	var node: Collectible = COLLECTIBLE_SCENE.instantiate()
	node.id = id
	node.position = _spawn_points[id]
	collectibles.add_child(node)
	node.collected.connect(_on_collectible_collected)


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("confirm") and GameState.won:
		restart()
