class_name GameLevel
extends Node2D
## 赛道：地面平台、深坑（平台之间的空隙）、尖刺、飞镖与终点旗。
##
## 规范要点（见 SKILL.md「场景与工程组织规范」）：
## - 赛道几何由常量数据表程序化生成 —— 场景文件保持小而稳定，避免手写大段 .tscn；
## - 本节点只 emit 信号（危险命中 / 飞镖收集 / 到达终点），不直接改 GameState、不持有 UI；
## - 重开（reset）只复位自己的子节点（飞镖），不释放主场景任何节点（fuzz 门禁要求主场景常驻）。

## 危险命中（撞尖刺；坠坑由 Player 越过坠落线自行上报 died）。
signal hazard_hit(kind: String)
## 收集到飞镖：Main 订阅后调 GameState.add_score 并让飞镖 collect()。
signal dart_collected(dart: Dart)
## 坚持跑到底（碰到终点旗）：Main 订阅后调 GameState.register_win。
signal goal_reached

## ── 赛道数据区（关卡结构 = 数据，改关卡不改逻辑）──
## 跨坑能力口径（唯一推导在 player.gd 手感常量区，改跳跃参数必须复算本表）：
##   单跳水平跨距 ≈ 178px + 压边宽容 11px → 一段跳跨坑上限 ≈ 189px；
##   二段跳水平跨距 ≈ 357px + 压边宽容 11px → 二段跳跨坑上限 ≈ 368px。
## 难度梯度承诺（坑宽严格递增，每档留出可玩余量，冒烟逐坑断言）：
##   坑1 = 110（一段跳，余量 ≈ 79px，起跳即可过）
##   坑2 = 150（一段跳，余量 ≈ 39px，需贴近边缘起跳）
##   坑3 = 200（首次要求二段跳，余量 ≈ 168px，学会二段跳）
##   坑4 = 240（二段跳，余量 ≈ 128px，时机开始收紧）
##   坑5 = 280（二段跳，余量 ≈ 88px，第二跳要贴近最高点按）
## ⚠️ 不允许出现「注释说一段跳可过、宽度却超过一段跳上限」的承诺失真
##    （旧版坑2 = 180px 正是这种缺陷：单跳极限 178px，帧完美都不一定过）。
## 地面平台段（x 起点, x 终点）；段与段之间的空隙即深坑。
const GROUND_SEGMENTS: Array[Vector2] = [
	Vector2(-240, 640),    # S1 起跑台（无坑无刺，热身）
	Vector2(750, 1400),    # 坑1 = 110：一段跳
	Vector2(1550, 2250),   # 坑2 = 150：一段跳·贴边起跳
	Vector2(2450, 3150),   # 坑3 = 200：二段跳入门
	Vector2(3390, 4050),   # 坑4 = 240：二段跳·余量收窄
	Vector2(4330, 5060),   # 坑5 = 280：二段跳·满段 → 终点台
]
## 尖刺落点（x）：必须落在实心平台内（留出尖刺半宽 + 玩家半宽的边距，冒烟逐个断言）。
const SPIKE_XS: Array[float] = [1000.0, 1750.0, 2020.0, 2650.0, 2920.0, 3580.0, 4550.0]
## 飞镖落点（x, y）：平地低空（小跳可拾）+ 深坑上空（沿跳跃弧线布置，二段跳坑的
## 飞镖挂得更高，奖励用满段二段跳去拿）。y 必须落在可达带 [GROUND_TOP_Y-190, GROUND_TOP_Y-27]。
const DART_SPOTS: Array[Vector2] = [
	Vector2(420, 150),     # S1 低空
	Vector2(715, 115),     # 坑1 弧线
	Vector2(900, 150),     # S2 低空
	Vector2(1200, 150),    # S2 低空
	Vector2(1489, 110),    # 坑2 弧线顶点（单跳弧线经过）
	Vector2(1650, 150),    # S3 低空
	Vector2(1900, 118),    # S3 满跳
	Vector2(2350, 100),    # 坑3 上空（二段跳弧线）
	Vector2(2550, 150),    # S4 低空
	Vector2(2800, 118),    # S4 满跳
	Vector2(3050, 150),    # S4 低空
	Vector2(3270, 100),    # 坑4 上空
	Vector2(3500, 150),    # S5 低空
	Vector2(3800, 118),    # S5 满跳
	Vector2(4190, 100),    # 坑5 上空
	Vector2(4420, 150),    # 终点台低空
	Vector2(4650, 150),    # 终点台低空
]
## 终点旗位置与赛道末端（相机右边界用）；终点必须落在最后一段实心平台内。
const GOAL_X: float = 4800.0
const TRACK_END_X: float = 5060.0

## ── 几何/配色常量 ──
const GROUND_TOP_Y: float = 200.0
const GROUND_HEIGHT: float = 90.0
const SPIKE_WIDTH: float = 26.0
const SPIKE_HEIGHT: float = 22.0
const DART_RADIUS: float = 14.0
const GOAL_WIDTH: float = 60.0
const COLOR_DIRT: Color = Color(0.44, 0.32, 0.23, 1)
const COLOR_GRASS: Color = Color(0.4, 0.68, 0.35, 1)
const COLOR_SPIKE: Color = Color(0.72, 0.75, 0.8, 1)
const COLOR_DART: Color = Color(0.95, 0.8, 0.2, 1)
const COLOR_POLE: Color = Color(0.25, 0.22, 0.2, 1)
const COLOR_FLAG: Color = Color(0.88, 0.26, 0.24, 1)

## 场上全部飞镖（重开时逐个复位）。
var darts: Array[Dart] = []


func _ready() -> void:
	_build_ground()
	_build_spikes()
	_build_darts()
	_build_goal()


## 重开一局：全部飞镖回到场上（不释放/不重建节点）。
func reset() -> void:
	for dart in darts:
		dart.respawn()


func _build_ground() -> void:
	for seg in GROUND_SEGMENTS:
		var width: float = seg.y - seg.x
		var body := StaticBody2D.new()
		body.position = Vector2(seg.x + width * 0.5, GROUND_TOP_Y + GROUND_HEIGHT * 0.5)
		body.add_child(_make_rect_shape(Vector2(width, GROUND_HEIGHT)))
		var dirt := Polygon2D.new()
		dirt.color = COLOR_DIRT
		dirt.polygon = _rect_polygon(Vector2(width, GROUND_HEIGHT))
		body.add_child(dirt)
		var grass := Polygon2D.new()
		grass.color = COLOR_GRASS
		grass.polygon = _rect_polygon(Vector2(width, 8.0))
		grass.position = Vector2(0, -GROUND_HEIGHT * 0.5 + 4.0)
		body.add_child(grass)
		add_child(body)


func _build_spikes() -> void:
	for x in SPIKE_XS:
		var spike := Area2D.new()
		spike.position = Vector2(x, GROUND_TOP_Y - SPIKE_HEIGHT * 0.5)
		spike.add_child(_make_rect_shape(Vector2(SPIKE_WIDTH * 0.7, SPIKE_HEIGHT)))
		var triangle := Polygon2D.new()
		triangle.color = COLOR_SPIKE
		triangle.polygon = PackedVector2Array([
			Vector2(-SPIKE_WIDTH * 0.5, SPIKE_HEIGHT * 0.5),
			Vector2(SPIKE_WIDTH * 0.5, SPIKE_HEIGHT * 0.5),
			Vector2(0, -SPIKE_HEIGHT * 0.5),
		])
		spike.add_child(triangle)
		spike.body_entered.connect(_on_hazard_body_entered)
		add_child(spike)


func _build_darts() -> void:
	for spot in DART_SPOTS:
		var dart := Dart.new()
		dart.position = spot
		var shape := CollisionShape2D.new()
		var circle := CircleShape2D.new()
		circle.radius = DART_RADIUS
		shape.shape = circle
		dart.add_child(shape)
		var gem := Polygon2D.new()
		gem.color = COLOR_DART
		gem.polygon = PackedVector2Array([
			Vector2(0, -12), Vector2(9, 0), Vector2(0, 12), Vector2(-9, 0),
		])
		dart.add_child(gem)
		# bind 把「哪一枚飞镖」带进回调，Main 据此让它消失（见 dart_collected 订阅方）。
		dart.body_entered.connect(_on_dart_body_entered.bind(dart))
		add_child(dart)
		darts.append(dart)


func _build_goal() -> void:
	var goal := Area2D.new()
	goal.position = Vector2(GOAL_X, GROUND_TOP_Y * 0.5)
	goal.add_child(_make_rect_shape(Vector2(GOAL_WIDTH, GROUND_TOP_Y)))
	var pole := Polygon2D.new()
	pole.color = COLOR_POLE
	pole.polygon = _rect_polygon(Vector2(6.0, 96.0))
	pole.position = Vector2(0, -GROUND_TOP_Y * 0.5 + 48.0)
	goal.add_child(pole)
	var flag := Polygon2D.new()
	flag.color = COLOR_FLAG
	flag.polygon = PackedVector2Array([
		Vector2(3, -GROUND_TOP_Y + 6), Vector2(40, -GROUND_TOP_Y + 20), Vector2(3, -GROUND_TOP_Y + 34),
	])
	goal.add_child(flag)
	goal.body_entered.connect(_on_goal_body_entered)
	add_child(goal)


func _make_rect_shape(size: Vector2) -> CollisionShape2D:
	var shape := CollisionShape2D.new()
	var rect := RectangleShape2D.new()
	rect.size = size
	shape.shape = rect
	return shape


func _rect_polygon(size: Vector2) -> PackedVector2Array:
	var half := size * 0.5
	return PackedVector2Array([
		Vector2(-half.x, -half.y), Vector2(half.x, -half.y),
		Vector2(half.x, half.y), Vector2(-half.x, half.y),
	])


func _on_hazard_body_entered(body: Node2D) -> void:
	if body is Player:
		hazard_hit.emit("spike")


func _on_dart_body_entered(body: Node2D, dart: Dart) -> void:
	if body is Player and not dart.collected:
		dart_collected.emit(dart)


func _on_goal_body_entered(body: Node2D) -> void:
	if body is Player:
		goal_reached.emit()
