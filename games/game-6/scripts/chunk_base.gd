class_name ChunkBase
extends Node2D
## chunk 预制件根（spec levels[].scene 的三个 chunk 场景共用本脚本）：
## _ready 时按 ChunkDefs 元素表构建地面分段（坑洞 = 段间空隙）、浮台、障碍、金币与道具盒。
##
## 对象池（策划案 §七.5）：chunk 实例由 track_builder 循环挪位复用，reset_chunk() 复位
## 全部子实体（金币/道具/障碍），不重建节点树 —— fpsFloor=30 的硬前提。
##
## 局部坐标：地面线 y=0、向上为正（策划案 §三）；本节点在世界中的 y = GROUND_LINE_Y。

## chunk id（场景里逐实例指定：l1/l2/l3）。
@export var chunk_id: StringName = &"l1"

## 三主题地形配色（spec world.artDirectives.palette 派生）。
const THEME_COLORS: Dictionary = {
	&"l1": {"ground": Color(0.965, 0.659, 0.129), "ground_dark": Color(0.78, 0.5, 0.1), "sky_hint": Color(0.494, 0.784, 0.961)},
	&"l2": {"ground": Color(0.62, 0.36, 0.3), "ground_dark": Color(0.45, 0.25, 0.22), "sky_hint": Color(0.9, 0.6, 0.4)},
	&"l3": {"ground": Color(0.3, 0.32, 0.48), "ground_dark": Color(0.2, 0.21, 0.34), "sky_hint": Color(0.15, 0.17, 0.3)},
}

## 地面块厚度（视觉与碰撞同厚；碰撞只需顶面，厚块防斜穿）。
const GROUND_THICKNESS: float = 160.0

## 道具盒种类（track_builder 指派；空 = build 时随机三选一，spec l1/e2 教学位）。
var powerup_kind: StringName = &""

@onready var _statics: Node2D = $Statics
@onready var _entities: Node2D = $Entities

var _built: bool = false


func _ready() -> void:
	if not _built:
		build()


## 构建 chunk 全部元素（幂等：先清空再建，供测试与重建使用）。
func build() -> void:
	for child: Node in _statics.get_children():
		child.queue_free()
	for child: Node in _entities.get_children():
		child.queue_free()
	var level: Dictionary = ChunkDefs.get_level(chunk_id)
	if level.is_empty():
		push_error("ChunkBase：未知 chunk_id %s" % chunk_id)
		return
	_build_ground_segments(level)
	for element: Dictionary in level["elements"]:
		match element["type"]:
			ChunkDefs.TYPE_PLATFORM:
				_build_platform(element)
			ChunkDefs.TYPE_OBSTACLE_GROUND:
				_build_obstacle_ground(element)
			ChunkDefs.TYPE_OBSTACLE_AIR:
				_build_obstacle_air(element)
			ChunkDefs.TYPE_POWERUP:
				_build_powerup(element)
			ChunkDefs.TYPE_COIN_ARC:
				_build_coin_arc(element)
			ChunkDefs.TYPE_COIN_LINE:
				_build_coin_line(element)
	_built = true


## 地面 = ground 元素减去全部坑洞区间后的分段（坑洞不需要实体）。
func _build_ground_segments(level: Dictionary) -> void:
	var pits: Array[Rect2] = []
	var ground_rect: Rect2 = Rect2(0, 0, GameState.tuning_value(&"chunkWidthPx"), 1)
	for element: Dictionary in level["elements"]:
		if element["type"] == ChunkDefs.TYPE_GROUND:
			ground_rect = Rect2(element["x"], 0, element["w"], 1)
		elif element["type"] == ChunkDefs.TYPE_PIT:
			pits.append(Rect2(element["x"], 0, element["w"], 1))
	pits.sort_custom(func(a: Rect2, b: Rect2) -> bool: return a.position.x < b.position.x)
	var segments: Array[Rect2] = []
	var cursor: float = ground_rect.position.x
	for pit: Rect2 in pits:
		if pit.position.x > cursor:
			segments.append(Rect2(cursor, 0, pit.position.x - cursor, 1))
		cursor = pit.end.x
	if cursor < ground_rect.end.x:
		segments.append(Rect2(cursor, 0, ground_rect.end.x - cursor, 1))
	for segment: Rect2 in segments:
		_add_ground_segment(segment)


func _add_ground_segment(segment: Rect2) -> void:
	var theme_colors: Dictionary = THEME_COLORS.get(chunk_id, THEME_COLORS[&"l1"])
	var body := StaticBody2D.new()
	body.name = "GroundSeg%d" % int(segment.position.x)
	var shape := CollisionShape2D.new()
	var rectangle := RectangleShape2D.new()
	rectangle.size = Vector2(segment.size.x, GROUND_THICKNESS)
	shape.shape = rectangle
	shape.position = Vector2(segment.position.x + segment.size.x / 2.0, GROUND_THICKNESS / 2.0)
	body.add_child(shape)
	var visual := Polygon2D.new()
	var half_w: float = segment.size.x / 2.0
	visual.polygon = PackedVector2Array([
		Vector2(-half_w, 0), Vector2(half_w, 0),
		Vector2(half_w, GROUND_THICKNESS), Vector2(-half_w, GROUND_THICKNESS),
	])
	visual.color = theme_colors["ground"]
	visual.position = shape.position
	body.add_child(visual)
	# 顶边草皮色条（Q 版描边感）。
	var top := Polygon2D.new()
	top.polygon = PackedVector2Array([
		Vector2(-half_w, 0), Vector2(half_w, 0),
		Vector2(half_w, 8), Vector2(-half_w, 8),
	])
	top.color = theme_colors["ground_dark"]
	top.position = shape.position - Vector2(0, GROUND_THICKNESS / 2.0)
	body.add_child(top)
	_statics.add_child(body)


func _build_platform(element: Dictionary) -> void:
	var theme_colors: Dictionary = THEME_COLORS.get(chunk_id, THEME_COLORS[&"l1"])
	var body := StaticBody2D.new()
	body.name = "Platform%s" % element["id"]
	var shape := CollisionShape2D.new()
	var rectangle := RectangleShape2D.new()
	rectangle.size = Vector2(element["w"], element["h"])
	shape.shape = rectangle
	# one_way：从下方跳跃可穿过平台底落到台上（跑酷浮台惯例）。
	shape.one_way_collision = true
	var center := Vector2(element["x"] + element["w"] / 2.0, -element["y"] - element["h"] / 2.0)
	shape.position = center
	body.add_child(shape)
	var visual := Polygon2D.new()
	var half_w: float = element["w"] / 2.0
	var half_h: float = element["h"] / 2.0
	visual.polygon = PackedVector2Array([
		Vector2(-half_w, -half_h), Vector2(half_w, -half_h),
		Vector2(half_w, half_h), Vector2(-half_w, half_h),
	])
	visual.color = theme_colors["ground"]
	visual.position = center
	body.add_child(visual)
	_statics.add_child(body)


func _build_obstacle_ground(element: Dictionary) -> void:
	var obstacle: ObstacleGround = preload("res://scenes/obstacle_ground.tscn").instantiate()
	obstacle.name = "Hazard%s" % element["id"]
	obstacle.width = element["w"]
	obstacle.height = element["h"]
	obstacle.position = Vector2(element["x"], -element["h"] / 2.0)
	_entities.add_child(obstacle)


func _build_obstacle_air(element: Dictionary) -> void:
	var obstacle: ObstacleAir = preload("res://scenes/obstacle_air.tscn").instantiate()
	obstacle.name = "Hazard%s" % element["id"]
	obstacle.hover_y = element["y"]
	# 根节点放在地面线，怪体由脚本自身悬挂在 hover_y（见 obstacle_air.gd）。
	obstacle.position = Vector2(element["x"], 0)
	_entities.add_child(obstacle)


## 金币弧线（跨障碍奖励）：count 枚、起点离地 y、正弦弧顶 apex（spec e4/e5）。
func _build_coin_arc(element: Dictionary) -> void:
	var count: int = element["count"]
	var spacing: float = 60.0
	for i: int in count:
		var t: float = float(i) / float(maxi(count - 1, 1))
		var height: float = element["y"] + (element["apex"] - element["y"]) * sin(PI * t)
		_add_coin(Vector2(element["x"] + spacing * float(i), -height))


## 金币直线（坑口过桥奖励，spec l3/e6）。
func _build_coin_line(element: Dictionary) -> void:
	var count: int = element["count"]
	var spacing: float = 60.0
	for i: int in count:
		_add_coin(Vector2(element["x"] + spacing * float(i), -element["y"]))


func _add_coin(local_position: Vector2) -> void:
	var coin: Coin = preload("res://scenes/coin.tscn").instantiate()
	coin.position = local_position
	_entities.add_child(coin)


## 道具盒场景映射（P5 静态检查要求路径字面量可解析，禁止 %s 拼接）。
const POWERUP_SCENES: Dictionary = {
	&"magnet": "res://scenes/powerup_magnet.tscn",
	&"shield": "res://scenes/powerup_shield.tscn",
	&"dash": "res://scenes/powerup_dash.tscn",
}


## 道具盒：powerup_kind 已指派用指派值，否则随机三选一（spec l1/e2「随机其一」）。
func _build_powerup(element: Dictionary) -> void:
	var kind: StringName = powerup_kind
	if kind == &"":
		kind = [&"magnet", &"shield", &"dash"][randi() % 3]
	var scene_path: String = POWERUP_SCENES.get(kind, POWERUP_SCENES[&"magnet"])
	var pickup: PickupBox = (load(scene_path) as PackedScene).instantiate()
	pickup.name = "Pickup%s" % element["id"]
	pickup.position = Vector2(element["x"], -46.0)
	_entities.add_child(pickup)


## 池化复位：chunk 被循环挪位到玩家前方时调用（不重建节点树）。
func reset_chunk() -> void:
	for node in _entities.get_children():
		if node is Coin:
			(node as Coin).reset_coin()
		elif node is PickupBox:
			(node as PickupBox).reset_pickup()
		elif node is ObstacleGround:
			(node as ObstacleGround).reset_hazard()
		elif node is ObstacleAir:
			(node as ObstacleAir).reset_hazard()
