extends Node2D
## 主场景控制器：装配 UI、订阅 Player 与 GameState 的信号。
##
## 规范要点（见 SKILL.md「场景规范」）：
## - 场景内信号连接统一写在 _ready()，集中可见、可被 preflight 静态核对；
## - 节点引用用 @onready + 类型标注，路径用 %唯一名 代替长路径字符串。

@onready var player: Player = $Player
@onready var hud_label: Label = %HudLabel


func _ready() -> void:
	# 信号连接：订阅方（本场景）写连接代码，发布方（player / GameState）只 emit。
	if not player.moved.is_connected(_on_player_moved):
		player.moved.connect(_on_player_moved)
	if not GameState.score_changed.is_connected(_on_score_changed):
		GameState.score_changed.connect(_on_score_changed)
	hud_label.text = "WASD / 方向键移动 · 分数 0"


func _on_player_moved(pos: Vector2) -> void:
	hud_label.text = "WASD / 方向键移动 · 坐标 %d,%d · 分数 %d" % [int(pos.x), int(pos.y), GameState.score]


func _on_score_changed(score: int) -> void:
	hud_label.text = "WASD / 方向键移动 · 坐标 %d,%d · 分数 %d" % [int(player.global_position.x), int(player.global_position.y), score]


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("confirm"):
		GameState.add_score(1)
