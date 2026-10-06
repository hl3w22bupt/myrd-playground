class_name Doll
extends Node2D
## 娃娃：8 种造型（造型/体积/稀有度差异化），程序化 _draw 绒布质感，落体状态机。
##
## 规范要点：对外只发信号（caught / landed），不持有 UI；入账由场景层订阅后调 GameState。

signal caught(doll: Doll)
signal landed(doll: Doll)

enum DollState { IDLE, HELD, FALLING }

## 娃娃库（需求：不少于 8 种，不同造型/体积/稀有度；weight 越大越难被抓稳）。
const KINDS: Array[Dictionary] = [
	{"id": &"bear", "name": "泰迪熊", "body": Color(0.82, 0.6, 0.36), "belly": Color(0.93, 0.8, 0.62), "ear": "round", "score": 100, "weight": 0.9, "rarity": "普通"},
	{"id": &"bunny", "name": "长耳兔", "body": Color(0.95, 0.93, 0.9), "belly": Color(1.0, 0.97, 0.95), "ear": "bunny", "score": 100, "weight": 0.8, "rarity": "普通"},
	{"id": &"cat", "name": "奶油猫", "body": Color(0.88, 0.86, 0.82), "belly": Color(0.98, 0.96, 0.92), "ear": "cat", "score": 120, "weight": 0.85, "rarity": "普通"},
	{"id": &"frog", "name": "豆豆蛙", "body": Color(0.5, 0.78, 0.42), "belly": Color(0.78, 0.92, 0.66), "ear": "none", "score": 120, "weight": 0.75, "rarity": "普通"},
	{"id": &"penguin", "name": "企鹅墩墩", "body": Color(0.28, 0.32, 0.45), "belly": Color(0.95, 0.95, 0.96), "ear": "none", "score": 150, "weight": 0.95, "rarity": "稀有"},
	{"id": &"pig", "name": "粉粉猪", "body": Color(0.96, 0.68, 0.72), "belly": Color(1.0, 0.85, 0.87), "ear": "cat", "score": 150, "weight": 0.85, "rarity": "稀有"},
	{"id": &"duck", "name": "黄鸭啾啾", "body": Color(0.98, 0.8, 0.3), "belly": Color(1.0, 0.9, 0.6), "ear": "none", "score": 200, "weight": 0.7, "rarity": "稀有"},
	{"id": &"unicorn", "name": "云朵独角兽", "body": Color(0.9, 0.82, 0.98), "belly": Color(0.98, 0.95, 1.0), "ear": "horn", "score": 300, "weight": 1.15, "rarity": "隐藏"},
]

## 下落动画参数。
const FALL_TIME: float = 0.55
const GRAVITY_TILT: float = 0.35

var kind_index: int = 0
var kind: Dictionary = KINDS[0]
var radius: float = 34.0
var state: int = DollState.IDLE
var _fall_from: Vector2 = Vector2.ZERO
var _fall_to: Vector2 = Vector2.ZERO
var _fall_t: float = 0.0
var _fall_caught: bool = false


## 布货：指定款式与半径（入场时由主场景调用），随机微转角模拟散落。
func setup(index: int, doll_radius: float) -> void:
	kind_index = index % KINDS.size()
	kind = KINDS[kind_index]
	radius = doll_radius * float(kind.get("weight", 1.0)) ** 0.15
	rotation = randf_range(-0.22, 0.22)
	queue_redraw()


func kind_name() -> String:
	return String(kind["name"])


func kind_score() -> int:
	return int(kind["score"])


## 被爪子抓住：附着到爪子（由 claw 每帧同步位置）。
func grab() -> void:
	state = DollState.HELD


## 松爪下落：caught=true 落进取物口；false 中途滑落回机台原位。
func release(to: Vector2, is_caught: bool) -> void:
	state = DollState.FALLING
	_fall_from = position
	_fall_to = to if is_caught else position + Vector2(0.0, 26.0)
	_fall_t = 0.0
	_fall_caught = is_caught
	rotation = randf_range(-0.6, 0.6)


func _physics_process(delta: float) -> void:
	if state != DollState.FALLING:
		return
	_fall_t = minf(_fall_t + delta / FALL_TIME, 1.0)
	var t := _fall_t
	# 抛物线下落 + 收缩（掉进取物口的纵深感），中途滑落只压一点点。
	position = _fall_from.lerp(_fall_to, t)
	var squash := 1.0 - 0.35 * sin(t * PI) if _fall_caught else 1.0 - 0.12 * sin(t * PI)
	scale = Vector2.ONE * squash
	if t >= 1.0:
		state = DollState.IDLE
		scale = Vector2.ONE
		if _fall_caught:
			caught.emit(self)
		else:
			landed.emit(self)


func _draw() -> void:
	var body: Color = kind["body"]
	var belly: Color = kind["belly"]
	var r := radius
	# 投影。
	draw_circle(Vector2(3.0, 5.0), r * 1.02, Color(0.0, 0.0, 0.0, 0.18))
	match String(kind["ear"]):
		"bunny":
			for side in [-1.0, 1.0]:
				var ear_pos := Vector2(side * r * 0.42, -r * 1.18)
				draw_circle(ear_pos + Vector2(0.0, r * 0.3), r * 0.2, body)
				draw_circle(ear_pos, r * 0.22, body)
				draw_circle(ear_pos, r * 0.12, belly)
		"cat":
			for side in [-1.0, 1.0]:
				var tip := Vector2(side * r * 0.72, -r * 0.82)
				draw_circle(tip, r * 0.3, body)
		"horn":
			draw_polygon(
				PackedVector2Array([
					Vector2(-r * 0.16, -r * 0.86), Vector2(0.0, -r * 1.42), Vector2(r * 0.16, -r * 0.86),
				]),
				PackedColorArray([Color(1.0, 0.92, 0.6), Color(1.0, 0.85, 0.45), Color(1.0, 0.92, 0.6)])
			)
			for side in [-1.0, 1.0]:
				draw_circle(Vector2(side * r * 0.5, -r * 0.78), r * 0.22, body)
		"round":
			for side in [-1.0, 1.0]:
				draw_circle(Vector2(side * r * 0.78, -r * 0.72), r * 0.34, body)
				draw_circle(Vector2(side * r * 0.78, -r * 0.72), r * 0.18, belly)
		_:
			pass
	# 身体（椭圆感：两个交叠圆）。
	draw_circle(Vector2(0.0, r * 0.42), r * 0.86, body)
	draw_circle(Vector2(0.0, r * 0.5), r * 0.52, belly)
	# 头。
	draw_circle(Vector2(0.0, -r * 0.24), r * 0.78, body)
	draw_circle(Vector2(0.0, -r * 0.05), r * 0.42, belly)
	# 眼睛 + 鼻 + 腮红。
	var eye := Color(0.16, 0.13, 0.12)
	draw_circle(Vector2(-r * 0.26, -r * 0.34), r * 0.09, eye)
	draw_circle(Vector2(r * 0.26, -r * 0.34), r * 0.09, eye)
	draw_circle(Vector2(0.0, -r * 0.14), r * 0.06, Color(0.55, 0.3, 0.3))
	draw_circle(Vector2(-r * 0.46, -r * 0.12), r * 0.11, Color(1.0, 0.62, 0.62, 0.55))
	draw_circle(Vector2(r * 0.46, -r * 0.12), r * 0.11, Color(1.0, 0.62, 0.62, 0.55))
