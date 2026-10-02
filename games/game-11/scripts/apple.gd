class_name Apple
extends Area2D
## 掉落苹果：从顶部随机横向位置生成，向下掉落；落入果篮 = 接住，越过底线 = 漏接。
##
## 规范要点（见 SKILL.md「GDScript 规范」）：
## - 苹果只 emit 信号（caught / missed），计分与扣生命由主场景订阅后转给 GameState；
## - 接住判定用 Area2D 的 body_entered（果篮是 CharacterBody2D，默认层/掩码可互相检测）。

## 苹果被接住时发出（参数是被吃掉的苹果自身，主场景据此更新分数）。
signal caught(apple: Apple)
## 苹果落到底部未被接住时发出（主场景据此扣生命）。
signal missed(apple: Apple)

## 下落速度（px/s）：由主场景按难度曲线赋值（GameState.apple_fall_speed()）。
## 上限受 GameState.APPLE_FALL_SPEED_TUNNEL_SAFE 约束 —— 每帧位移小于「苹果直径 + 果篮高」
## 的一半（13 × 2 + 26 = 52px 的一半 = 26px/帧），60Hz 下 460px/s ≈ 7.7px/帧，隧穿余量约 3.4 倍。
var fall_speed: float = GameState.apple_fall_speed

var _resolved: bool = false


func _ready() -> void:
	body_entered.connect(_on_body_entered)


func _physics_process(delta: float) -> void:
	if _resolved:
		return
	position.y += fall_speed * delta
	if position.y >= GameState.FLOOR_Y:
		_resolved = true
		missed.emit(self)
		queue_free()


func _on_body_entered(body: Node2D) -> void:
	if _resolved or not (body is Player):
		return
	_resolved = true
	caught.emit(self)
	queue_free()
