class_name ParallaxBg
extends ParallaxBackground
## 三层视差背景（spec entity: parallax-bg，world.artDirectives.parallax）：
## 云 0.1x / 糖果山 0.2x / 街区 0.5x；地面前景 1.0x 由 chunk 地面承担。
## 几何程序化绘制（策划案 §五.5「程序化绘制可接受」），随 Camera2D 自动滚动。

## 视差层周期宽度（无缝镜像）。
const TILE_WIDTH: float = 2048.0

## 地面线（山脚/屋脚对齐到地面，世界 y）。
const GROUND_LINE_Y: float = 300.0

@onready var _cloud_layer: ParallaxLayer = $CloudLayer
@onready var _mountain_layer: ParallaxLayer = $MountainLayer
@onready var _town_layer: ParallaxLayer = $TownLayer


func _ready() -> void:
	_build_clouds()
	_build_mountains()
	_build_town()


func _build_clouds() -> void:
	_cloud_layer.motion_scale = Vector2(0.1, 0.02)
	_cloud_layer.motion_mirroring = Vector2(TILE_WIDTH, 0)
	# 三组云（每朵 = 八边形近似圆），底色白半透明。
	for cluster: int in 3:
		var base_x: float = 200.0 + 680.0 * float(cluster)
		var base_y: float = -20.0 + 26.0 * float(cluster % 2)
		for puff: int in 3:
			var cloud := Polygon2D.new()
			var radius: float = 26.0 - 5.0 * float(puff)
			cloud.position = Vector2(base_x + float(puff) * radius * 1.4, base_y + float(puff % 2) * 8.0)
			cloud.color = Color(1, 1, 1, 0.95)
			cloud.polygon = _circle_polygon(radius)
			_cloud_layer.add_child(cloud)


func _build_mountains() -> void:
	_mountain_layer.motion_scale = Vector2(0.2, 0.05)
	_mountain_layer.motion_mirroring = Vector2(TILE_WIDTH, 0)
	# 两个锯齿山（峰谷交替），糖果绿 + 亮顶。
	var points: PackedVector2Array = [Vector2(0, 0)]
	var peaks: Array[float] = [140.0, 210.0, 120.0, 190.0, 150.0]
	var segment: float = TILE_WIDTH / float(peaks.size())
	for i: int in peaks.size():
		points.append(Vector2(segment * (float(i) + 0.5), -peaks[i]))
		points.append(Vector2(segment * (float(i) + 1.0), -30.0))
	var mountain := Polygon2D.new()
	mountain.polygon = points
	mountain.color = Color(0.63, 0.86, 0.58, 1)
	mountain.position = Vector2(0, GROUND_LINE_Y)
	_mountain_layer.add_child(mountain)


func _build_town() -> void:
	_town_layer.motion_scale = Vector2(0.5, 0.08)
	_town_layer.motion_mirroring = Vector2(TILE_WIDTH, 0)
	# 糖果屋街区：一排矩形房体 + 三角屋顶，两色交替。
	var palette: Array[Color] = [
		Color(1.0, 0.8, 0.85, 1), Color(0.8, 0.9, 1.0, 1),
		Color(1.0, 0.92, 0.68, 1), Color(0.85, 0.95, 0.8, 1),
	]
	var houses: int = 8
	var house_w: float = TILE_WIDTH / float(houses)
	for i: int in houses:
		var body_h: float = 90.0 + 24.0 * float(i % 3)
		var body := Polygon2D.new()
		var half_w: float = house_w * 0.32
		body.polygon = PackedVector2Array([
			Vector2(-half_w, -body_h), Vector2(half_w, -body_h),
			Vector2(half_w, 0), Vector2(-half_w, 0),
		])
		body.color = palette[i % palette.size()]
		body.position = Vector2(house_w * (float(i) + 0.5), GROUND_LINE_Y - 24.0)
		_town_layer.add_child(body)
		var roof := Polygon2D.new()
		roof.polygon = PackedVector2Array([
			Vector2(-half_w - 10.0, -body_h), Vector2(half_w + 10.0, -body_h), Vector2(0, -body_h - 34.0),
		])
		roof.color = Color(0.96, 0.44, 0.46, 1)
		roof.position = body.position
		_town_layer.add_child(roof)


## 八边形近似圆（避免 Polygon2D 大顶点数）。
func _circle_polygon(radius: float) -> PackedVector2Array:
	var points: PackedVector2Array = []
	for i: int in 8:
		var angle: float = TAU * float(i) / 8.0
		points.append(Vector2(cos(angle), sin(angle)) * radius)
	return points
