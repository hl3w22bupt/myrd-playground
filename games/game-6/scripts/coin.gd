class_name Coin
extends Area2D
## 金币（spec entity: coin）：碰到玩家 → +1 金币 +10 分；被磁铁/冲刺吸附；
## 对象池复用（reset_coin，不 queue_free）。
##
## 规范要点：自包含拾取（直接走 GameState 公共 API），主场景零接线；
## 吸附半径读 GameState 调参区（magnetRadiusPx，acc-04）。

const SPIN_SPEED: float = 3.0
## 吸附移动速度（px/s）：满速跑 720px/s 下也能追上玩家。
const ATTRACT_SPEED_PX_PER_SEC: float = 900.0

## 拾取后发出（冒烟断言信号到达用；增量恒为 coinValue）。
signal collected(count: int)

var _collected: bool = false
var _player: Player = null

@onready var _body: Polygon2D = $Body


func _ready() -> void:
	body_entered.connect(_on_body_entered)
	_add_glint()


## 金币高光小块（迭代需求 ②：提亮 + 卡通体积感；旋转随 Body 自转一起走）。
func _add_glint() -> void:
	var glint := Polygon2D.new()
	glint.name = "Glint"
	glint.color = Color(1, 1, 1, 0.75)
	glint.polygon = PackedVector2Array([
		Vector2(-2.0, -7.0), Vector2(2.0, -7.0), Vector2(2.0, -1.0), Vector2(-2.0, -1.0),
	])
	glint.position = Vector2(-3.0, 0.0)
	_body.add_child(glint)


func _physics_process(delta: float) -> void:
	if _collected:
		return
	rotation += SPIN_SPEED * delta
	# 磁铁/冲刺吸附：把半径内金币拉向玩家（spec powerup-magnet/dash role）。
	if GameState.run_active:
		var player := _find_player()
		if player != null and player.is_attracting():
			var radius: float = GameState.tuning_value(&"magnetRadiusPx")
			if global_position.distance_to(player.global_position) <= radius:
				var direction: Vector2 = (player.global_position - global_position).normalized()
				global_position += direction * ATTRACT_SPEED_PX_PER_SEC * delta


func _find_player() -> Player:
	if _player != null and is_instance_valid(_player):
		return _player
	_player = get_tree().get_first_node_in_group(&"player") as Player
	return _player


## 拾取（幂等）：停监测要在物理帧末（set_deferred），避免在物理回调里改物理态。
## 拾取反馈三件套（迭代需求 ①）：闪光（FxBank）+ 音效（SfxBank）+ HUD 计数跳字。
func collect() -> void:
	if _collected:
		return
	_collected = true
	set_deferred("monitoring", false)
	visible = false
	GameState.add_coin()
	GameState.emit_feedback(&"coin", global_position)
	FxBank.flash(get_parent(), global_position, Color(1.0, 0.85, 0.3), &"pickup_coin")
	SfxBank.play(&"coin", get_parent())
	collected.emit(GameState.tuning_value(&"coinValue") as int)


## 对象池复位：恢复可见与监测。
func reset_coin() -> void:
	_collected = false
	visible = true
	set_deferred("monitoring", true)


func _on_body_entered(body: Node2D) -> void:
	if _collected or GameState.run_active == false:
		return
	if body is Player:
		collect()
