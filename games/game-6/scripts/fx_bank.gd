class_name FxBank
extends RefCounted
## 轻量特效银行（迭代需求 ①「拾取瞬间闪光」落点）：
## 全部特效节点在运行时用 Polygon2D / Line2D + Tween 拼装，零场景文件、零贴图 ——
## Web 导出不增文件数；节点播完自毁（tween finished 回调），不留尸体。
##
## 规范要点：纯静态工具；spawned_total / spawned_of(kind) 计数器供冒烟断言
## 「闪光真的生成过」；特效只做表现，不改任何游戏状态。

## 累计生成计数（冒烟断言用）。
static var spawned_total: int = 0
## 按 kind 计数（冒烟断言「拾取闪光触发」用）。
static var _spawned_by_kind: Dictionary = {}

## 闪光环：起始/结束半径倍率与时长。
const RING_SCALE_FROM: float = 0.35
const RING_SCALE_TO: float = 1.9
const FLASH_SECONDS: float = 0.38
## 星火粒子：数量 / 飞散距离 / 时长。
const SPARK_COUNT: int = 6
const SPARK_DISTANCE: float = 46.0
const SPARK_SECONDS: float = 0.3


## 在 world_pos 处放一圈「扩散光环 + 六向星火」闪光。
## parent = 特效挂点（调用方传自己的父容器，与被拾取物同层，随相机世界坐标渲染）。
static func flash(parent: Node, world_pos: Vector2, color: Color, kind: StringName = &"flash") -> void:
	if parent == null or not parent.is_inside_tree():
		return
	var fx := Node2D.new()
	fx.name = "Flash%s%d" % [kind.to_pascal_case(), spawned_total]
	fx.position = world_pos
	fx.z_index = 15
	parent.add_child(fx)
	_attach_ring(fx, color)
	for i: int in SPARK_COUNT:
		_attach_spark(fx, color, TAU * float(i) / float(SPARK_COUNT))
	spawned_total += 1
	_spawned_by_kind[kind] = int(_spawned_by_kind.get(kind, 0)) + 1
	var tween := fx.create_tween()
	tween.set_parallel(true)
	tween.tween_property(fx, "modulate:a", 0.0, FLASH_SECONDS).set_ease(Tween.EASE_IN)
	tween.chain().tween_callback(fx.queue_free)


## kind 的闪光生成次数（冒烟断言用）。
static func spawned_of(kind: StringName) -> int:
	return int(_spawned_by_kind.get(kind, 0))


## 扩散光环：Line2D 圆环，缩放从 RING_SCALE_FROM 撑到 RING_SCALE_TO。
static func _attach_ring(fx: Node2D, color: Color) -> void:
	var ring := Line2D.new()
	ring.name = "Ring"
	ring.width = 5.0
	ring.default_color = Color(color.r, color.g, color.b, 0.95)
	var points := PackedVector2Array()
	for i: int in 16:
		var angle: float = TAU * float(i) / 16.0
		points.append(Vector2(cos(angle), sin(angle)) * 26.0)
	ring.points = points
	fx.add_child(ring)
	var tween := ring.create_tween()
	tween.tween_property(ring, "scale", Vector2.ONE * RING_SCALE_TO, FLASH_SECONDS) \
		.from(Vector2.ONE * RING_SCALE_FROM).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_CUBIC)


## 一颗粒子：小菱形沿 direction 飞散 + 自转。
static func _attach_spark(fx: Node2D, color: Color, direction: float) -> void:
	var spark := Polygon2D.new()
	spark.name = "Spark"
	spark.color = Color(color.r, color.g, color.b, 1.0)
	spark.polygon = PackedVector2Array([
		Vector2(0, -5), Vector2(4, 0), Vector2(0, 5), Vector2(-4, 0),
	])
	spark.position = Vector2.ZERO
	fx.add_child(spark)
	var velocity := Vector2(cos(direction), sin(direction)) * SPARK_DISTANCE
	var tween := spark.create_tween()
	tween.set_parallel(true)
	tween.tween_property(spark, "position", velocity, SPARK_SECONDS).set_ease(Tween.EASE_OUT)
	tween.tween_property(spark, "rotation", direction + PI, SPARK_SECONDS)
	tween.tween_property(spark, "scale", Vector2.ONE * 0.2, SPARK_SECONDS).set_ease(Tween.EASE_IN)
