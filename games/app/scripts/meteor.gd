class_name Meteor
extends Area2D
## 彩色陨石：颜色即语义（知识基准 2.3）。
##   NORMAL   红 #FF4D5E  r 22~28  直线漂移 0.85x
##   FAST     蓝 #4DB8FF  r 10~14  快速直穿 1.3x
##   SPLITTER 黄 #FFD24A  r 14~18  屏幕远端分裂为 2 子体（各 0.9x、±25° 散开、r 减半）
##   FRAGMENT 黄（分裂子体）
## 速度 = 飞船当前速度 × k(D) × 类型系数（知识基准 2.1：加速态下陨石同步放大）。

enum Kind { NORMAL, FAST, SPLITTER, FRAGMENT }

## 撞上飞船时发出（main 订阅：扣盾 + 反馈 + 销毁陨石）。
signal hit_ship(meteor: Meteor)
## 分裂体到达分裂线时发出（main 订阅：生成 2 个子体）。
signal split_requested(meteor: Meteor)

const COLOR_NORMAL := Color("ff4d5e")
const COLOR_FAST := Color("4db8ff")
const COLOR_SPLITTER := Color("ffd24a")
const COLOR_OUTLINE := Color("0e0e20")

const SPEED_FACTOR_NORMAL: float = 0.85
const SPEED_FACTOR_FAST: float = 1.3
const SPEED_FACTOR_SPLITTER: float = 0.9
const SPEED_FACTOR_FRAGMENT: float = 0.9
const SPLIT_ANGLE_RAD: float = 0.4363  ## 25°
const SPIN_MAX: float = 1.6            ## 自转角速度上限 rad/s

const PLAYFIELD_SIZE: Vector2 = Vector2(720.0, 1280.0)

var kind: Kind = Kind.NORMAL
var radius: float = 24.0
var speed_factor: float = SPEED_FACTOR_NORMAL
var direction: Vector2 = Vector2.DOWN  ## 分裂子体带 ±25° 横向分量
var split_y: float = -1.0              ## ≥0 时到达该 y 触发分裂（只触发一次）

var _split_done: bool = false
var _hit_done: bool = false
var _spin: float = 0.6
var _poly_outline: Polygon2D
var _poly_body: Polygon2D
var _shape: CollisionShape2D


## 由 main 在 instantiate 之后、add_child 之前调用（场景内容在 _ready 构建）。
func setup(new_kind: Kind, new_radius: float, new_split_y: float = -1.0) -> void:
	kind = new_kind
	radius = new_radius
	split_y = new_split_y
	match kind:
		Kind.NORMAL:
			speed_factor = SPEED_FACTOR_NORMAL
		Kind.FAST:
			speed_factor = SPEED_FACTOR_FAST
		Kind.SPLITTER:
			speed_factor = SPEED_FACTOR_SPLITTER
		Kind.FRAGMENT:
			speed_factor = SPEED_FACTOR_FRAGMENT
			direction = Vector2.DOWN


## 分裂子体的横向散开方向（±25°），由 main 按左右两侧设置。
func set_split_direction(side: float) -> void:
	direction = Vector2(sin(SPLIT_ANGLE_RAD) * side, cos(SPLIT_ANGLE_RAD))


func _ready() -> void:
	_build_visuals()
	body_entered.connect(_on_body_entered)
	_spin = randf_range(-SPIN_MAX, SPIN_MAX)
	Juice.flash(self, Color(1, 1, 1, 0.25), 0.18)  # 入场反馈（可感知的场上事件）


func _physics_process(delta: float) -> void:
	if GameState.game_over:
		return
	var fall := GameState.speed * GameState.meteor_speed_coeff() * speed_factor
	position += direction * fall * delta
	rotation += _spin * delta
	if split_y > 0.0 and not _split_done and position.y >= split_y:
		_split_done = true
		split_requested.emit(self)
		queue_free()
		return
	if position.y > PLAYFIELD_SIZE.y + radius + 60.0:
		queue_free()


func _on_body_entered(body: Node2D) -> void:
	if _hit_done or not (body is Player):
		return
	_hit_done = true
	hit_ship.emit(self)


## 构建不规则 8~12 边多边形轮廓 + 深描边（知识基准 4.1），形状资源逐实例独立。
func _build_visuals() -> void:
	var points := PackedVector2Array()
	var corners := randi_range(8, 12)
	for i: int in range(corners):
		var angle := TAU * float(i) / float(corners)
		var r := radius * randf_range(0.82, 1.0)
		points.append(Vector2(cos(angle), sin(angle)) * r)
	var body_color := COLOR_NORMAL
	match kind:
		Kind.FAST:
			body_color = COLOR_FAST
		Kind.SPLITTER, Kind.FRAGMENT:
			body_color = COLOR_SPLITTER
		_:
			body_color = COLOR_NORMAL

	_poly_outline = Polygon2D.new()
	_poly_outline.name = "Outline"
	_poly_outline.color = COLOR_OUTLINE
	_poly_outline.polygon = _scaled(points, 1.14)
	add_child(_poly_outline)

	_poly_body = Polygon2D.new()
	_poly_body.name = "Body"
	_poly_body.color = body_color
	_poly_body.polygon = points
	add_child(_poly_body)

	_shape = CollisionShape2D.new()
	_shape.name = "CollisionShape2D"
	var circle := CircleShape2D.new()
	circle.radius = radius
	_shape.shape = circle
	add_child(_shape)


func _scaled(points: PackedVector2Array, factor: float) -> PackedVector2Array:
	var scaled := PackedVector2Array()
	for point in points:
		scaled.append(point * factor)
	return scaled
