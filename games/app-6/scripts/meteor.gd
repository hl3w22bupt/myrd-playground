class_name Meteor
extends Area2D
## 流星：愿晶的载体，按随机节奏划过夜空，一闪即逝。
##
## 生命周期（需求核心规则）：
##   ALIVE（捕捉窗口期内：可点击/可触碰/捕手可撞捕）
##     → capture()  捕捉成功（状态终态，视觉绽放后释放）
##     → expire()   窗口期耗尽自动消失（不可补捕、不计入收集）
##
## 规范要点：对外只发信号（captured/expired），由 Main 订阅改状态与挂反馈；
## 移动速度与窗口时长只读 GameState 调参区，本脚本零魔数。

signal captured(meteor: Meteor)
signal expired(meteor: Meteor)

enum State { ALIVE, CAPTURED, EXPIRED }

## 捕捉绽放 / 过期淡出的表现时长（秒）。
const CONSUME_SECONDS: float = 0.4

## 窗口期外/已消耗的流星不可再捕捉 —— capture() 对它们一律返回 false。
var state: State = State.ALIVE
## 划过屏幕的方向（单位向量），由 Main 在生成时指定。
var direction: Vector2 = Vector2.RIGHT
## 捕捉窗口剩余时长（秒）；归零即一闪即逝。
var window_remaining: float = 0.0


func _ready() -> void:
	add_to_group(&"meteors")
	window_remaining = GameState.meteor_window_seconds
	body_entered.connect(_on_body_entered)


## 生成配置：出生点 + 划过方向（在 add_child 之前调用，保证首帧位置正确）。
func setup(from: Vector2, move_direction: Vector2) -> void:
	global_position = from
	var dir := move_direction.normalized() if move_direction != Vector2.ZERO else Vector2.RIGHT
	direction = dir
	rotation = dir.angle()


func _physics_process(delta: float) -> void:
	if state != State.ALIVE:
		return
	global_position += direction * GameState.meteor_speed * delta
	window_remaining -= delta
	_update_twinkle()
	if window_remaining <= 0.0:
		expire()


## 尝试捕捉：窗口期内命中才成功；返回是否真的捕捉到了。
func capture() -> bool:
	if state != State.ALIVE:
		return false
	state = State.CAPTURED
	set_deferred("monitoring", false)
	captured.emit(self)
	_consume_visual(Color(1.0, 1.0, 1.0, 0.0))
	return true


## 窗口期耗尽：流星消失且不可再捕捉（不 emit captured，不计入收集）。
func expire() -> void:
	if state != State.ALIVE:
		return
	state = State.EXPIRED
	set_deferred("monitoring", false)
	expired.emit(self)
	_consume_visual(Color(0.55, 0.55, 0.8, 0.0))


## 临近窗口末端闪烁加快、渐暗 —— 「一闪即逝」的可读性反馈。
func _update_twinkle() -> void:
	var ratio := clampf(window_remaining / GameState.meteor_window_seconds, 0.0, 1.0)
	var twinkle := 0.78 + 0.22 * sin(Time.get_ticks_msec() * 0.02)
	var alpha := clampf(twinkle - (1.0 - ratio) * 0.4, 0.35, 1.0)
	modulate = Color(1.0, 1.0, 1.0, alpha)


## 消耗表现：短暂渐变后自毁（捕捉=绽放变白，过期=淡入夜色）。
func _consume_visual(target: Color) -> void:
	var tween := create_tween()
	tween.tween_property(self, "modulate", target, CONSUME_SECONDS)
	tween.tween_callback(queue_free)


func _on_body_entered(body: Node2D) -> void:
	if body is Player:
		capture()
