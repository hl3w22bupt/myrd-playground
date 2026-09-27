class_name Meteor
extends Area2D
## 彩色陨石：红（大宗量直线）/ 黄（正弦摆动）/ 蓝（快速直穿）三型，
## 半径、相对速度、摆动参数全部出自统一配置（config.meteor.types）。
##
## 素材轻量化：_draw 自绘「不规则多边形 + 2px 深描边 + 同色 30% 外发光」（调研结论），
## 不引入贴图，控制 Web 导出包体。

signal hit_player(meteor: Meteor)

const OUTLINE_WIDTH: float = 2.0
const GLOW_SCALE: float = 1.22
const GLOW_ALPHA: float = 0.3

var type_key: String = "red"
var body_color: Color = Color("#FF4D5E")
var radius: float = 24.0
var relative_speed: float = 0.85
var sway_amp_px: float = 0.0
var sway_freq_hz: float = 0.0

var _base_x: float = 0.0
var _age: float = 0.0
var _vertices: PackedVector2Array = PackedVector2Array()
var _rng := RandomNumberGenerator.new()


func setup(type_cfg: Dictionary) -> void:
	type_key = str(type_cfg.get("key", "red"))
	body_color = Color(str(type_cfg.get("color", "#FF4D5E")))
	radius = clampf(randf_range(float(type_cfg["radiusMin"]), float(type_cfg["radiusMax"])), 8.0, 40.0)
	relative_speed = float(type_cfg["relativeSpeed"])
	sway_amp_px = float(type_cfg["swayAmpPx"])
	sway_freq_hz = float(type_cfg["swayFreqHz"])
	_build_shape()


## 8~12 边随机凹凸不规则轮廓（与水晶的规则菱形形成形状双编码）。
func _build_shape() -> void:
	var sides := randi_range(8, 12)
	_vertices = PackedVector2Array()
	for i in sides:
		var angle := TAU * float(i) / float(sides)
		var r := radius * randf_range(0.78, 1.12)
		_vertices.append(Vector2(cos(angle), sin(angle)) * r)
	var shape := CircleShape2D.new()
	shape.radius = radius * 0.92
	var collision := $CollisionShape2D as CollisionShape2D
	collision.shape = shape


func _ready() -> void:
	_base_x = position.x
	body_entered.connect(_on_body_entered)


func _physics_process(delta: float) -> void:
	_age += delta
	position.y += GameState.speed() * relative_speed * delta
	if sway_amp_px > 0.0 and sway_freq_hz > 0.0:
		position.x = _base_x + sin(_age * sway_freq_hz * TAU) * sway_amp_px
	var bottom := get_viewport_rect().end.y
	if position.y > bottom + radius + 60.0:
		queue_free()


func _draw() -> void:
	if _vertices.size() < 3:
		return
	var outline := Color(str(GameState.config["visual"]["meteorOutline"]))
	var glow := PackedVector2Array()
	for v in _vertices:
		glow.append(v * GLOW_SCALE)
	draw_colored_polygon(glow, Color(body_color.r, body_color.g, body_color.b, GLOW_ALPHA))
	draw_colored_polygon(_vertices, body_color)
	draw_polyline(_vertices + PackedVector2Array([_vertices[0]]), outline, OUTLINE_WIDTH)


func _on_body_entered(body: Node2D) -> void:
	if body is Player and GameState.phase == GameState.Phase.PLAYING and not GameState.invincible_active():
		hit_player.emit(self)
