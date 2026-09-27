class_name PlayerArt
extends Node2D
## 主角「酷跑小子」卡通美术层（迭代需求 ②：占位几何人 → 精美卡通角色）。
##
## 构成：多部件 Polygon2D 拼装（后臂/后腿 → 躯干 → 头/发带/眼/高光 → 前腿/前臂），
## 每个部件带深色描边层（同形放大 1.14 倍垫底）+ 高光块；暖橙 × 天蓝和谐配色，
## 与提亮后的场景同一色系。局部原点 = 角色碰撞盒中心，脚底 ≈ y=+32（与站立盒 64 高对齐）。
##
## 帧动画（帧表驱动，非连续插值 —— 「跑步/跳跃/滚动各 ≥3 帧」逐帧可数、冒烟可机判）：
## - 跑步 RUN_FRAME_COUNT=8 帧：前后腿/臂正弦摆动 + 身体起伏 + 前倾；
## - 跳跃 JUMP_POSE_COUNT=3 姿态：上升收腿张臂 / 顶点分腿 / 下落前伸腿；
## - 滚动（滑铲）ROLL_FRAME_COUNT=6 帧：团身缩比 + 整体翻滚一周。

## 跑步帧数（≥3，冒烟断言 PLAYER_MOVE 帧数契约）。
const RUN_FRAME_COUNT: int = 8
## 跳跃姿态数（上升/顶点/下落）。
const JUMP_POSE_COUNT: int = 3
## 滚动（滑铲）帧数（≥3）。
const ROLL_FRAME_COUNT: int = 6

## 配色（暖橙卫衣 × 天蓝短裤 × 肤色脸，描边取同色系加深档）。
const COLOR_HOODIE := Color(1.0, 0.62, 0.25, 1.0)
const COLOR_HOODIE_DARK := Color(0.95, 0.5, 0.16, 1.0)
const COLOR_SHORTS := Color(0.32, 0.55, 0.9, 1.0)
const COLOR_SKIN := Color(1.0, 0.86, 0.68, 1.0)
const COLOR_HAIR := Color(0.46, 0.29, 0.19, 1.0)
const COLOR_BAND := Color(0.94, 0.32, 0.36, 1.0)
const COLOR_SHOE := Color(0.99, 0.99, 1.0, 1.0)
const OUTLINE := Color(0.28, 0.18, 0.12, 1.0)

var _torso: Polygon2D
var _head: Polygon2D
var _hair: Polygon2D
var _band: Polygon2D
var _upper_group: Node2D
var _leg_front: Node2D
var _leg_back: Node2D
var _arm_front: Node2D
var _arm_back: Node2D


func _ready() -> void:
	_build()


## ── 帧驱动入口（player.gd 每物理帧按状态调一次）──

## 跑步帧：frame ∈ [0, RUN_FRAME_COUNT)。
func set_run_frame(frame: int) -> void:
	var phase: float = TAU * float(((frame % RUN_FRAME_COUNT) + RUN_FRAME_COUNT) % RUN_FRAME_COUNT) \
		/ float(RUN_FRAME_COUNT)
	rotation = -0.05
	_upper_group.position = Vector2(0.0, sin(phase * 2.0) * 1.6)
	_upper_group.scale = Vector2(1.0, 1.0 + sin(phase * 2.0) * 0.03)
	_leg_front.rotation = sin(phase) * 0.95
	_leg_back.rotation = sin(phase + PI) * 0.95
	_arm_front.rotation = sin(phase + PI) * 0.85
	_arm_back.rotation = sin(phase) * 0.85


## 跳跃姿态：pose ∈ {0 上升, 1 顶点, 2 下落}。
func set_jump_pose(pose: int) -> void:
	rotation = 0.0
	_upper_group.position = Vector2.ZERO
	match pose % maxi(JUMP_POSE_COUNT, 1):
		0:
			_upper_group.scale = Vector2(0.94, 1.07)
			_leg_front.rotation = -1.15
			_leg_back.rotation = 0.55
			_arm_front.rotation = -2.3
			_arm_back.rotation = -1.9
		1:
			_upper_group.scale = Vector2.ONE
			_leg_front.rotation = 0.55
			_leg_back.rotation = -0.45
			_arm_front.rotation = -1.3
			_arm_back.rotation = -1.0
		_:
			_upper_group.scale = Vector2(1.04, 0.98)
			_leg_front.rotation = 0.3
			_leg_back.rotation = -0.1
			_arm_front.rotation = 0.9
			_arm_back.rotation = 1.3


## 滚动（滑铲）帧：frame ∈ [0, ROLL_FRAME_COUNT) —— 团身 + 翻滚一周。
func set_roll_frame(frame: int) -> void:
	var step: float = TAU * float(((frame % ROLL_FRAME_COUNT) + ROLL_FRAME_COUNT) % ROLL_FRAME_COUNT) \
		/ float(ROLL_FRAME_COUNT)
	rotation = step
	_upper_group.position = Vector2(2.0, 8.0)
	_upper_group.scale = Vector2(1.16, 0.68)
	_leg_front.rotation = 0.5
	_leg_back.rotation = -0.5
	_arm_front.rotation = -2.6
	_arm_back.rotation = -2.4


## ── 部件拼装 ──
func _build() -> void:
	# 后侧肢体（z=-3，被躯干遮住一部分 → 层次感）。
	_arm_back = _build_limb("ArmBack", Vector2(-13.0, -6.0), COLOR_HOODIE_DARK, -3)
	_leg_back = _build_limb("LegBack", Vector2(-7.0, 20.0), Color(0.24, 0.42, 0.72, 1.0), -3)
	# 上身组（躯干 + 头，跑步起伏作用在这组上）。
	_upper_group = Node2D.new()
	_upper_group.name = "Upper"
	add_child(_upper_group)
	_torso = _build_block(_upper_group, "Torso", _torso_polygon(), COLOR_HOODIE, 0)
	# 短裤压在躯干下缘。
	var shorts := _build_block(_upper_group, "Shorts", _shorts_polygon(), COLOR_SHORTS, 1)
	shorts.show_behind_parent = false
	# 头（肤色圆 + 头发 + 发带 + 眼睛 + 高光）。
	_head = _build_block(_upper_group, "Head", _circle_polygon(14.5, 14), COLOR_SKIN, 2)
	_head.position = Vector2(1.0, -24.0)
	_hair = _build_block(_upper_group, "Hair", _hair_polygon(), COLOR_HAIR, 3)
	_hair.position = _head.position + Vector2(0.0, -6.0)
	_band = _build_block(_upper_group, "Band", _band_polygon(), COLOR_BAND, 4)
	_band.position = _head.position + Vector2(0.0, -5.0)
	_build_eyes()
	_build_highlight(_upper_group, _head.position + Vector2(-5.0, -29.0), Vector2(5.0, 3.4))
	_build_highlight(_upper_group, Vector2(-8.0, -8.0), Vector2(4.2, 7.0))
	# 前侧肢体（z=+2，盖在躯干前 → 摆臂/迈腿清晰可读）。
	_leg_front = _build_limb("LegFront", Vector2(7.0, 20.0), COLOR_SHORTS, 2)
	_arm_front = _build_limb("ArmFront", Vector2(13.0, -6.0), COLOR_HOODIE, 2)
	set_run_frame(0)


## 一条肢体 = 枢纽 Node2D（原点在关节）+ 描边层 + 主色层；摆动转枢纽即可。
func _build_limb(limb_name: String, joint: Vector2, color: Color, z: int) -> Node2D:
	var pivot := Node2D.new()
	pivot.name = limb_name
	pivot.position = joint
	pivot.z_index = z
	add_child(pivot)
	# 腿 = 裤管(短) + 小腿鞋(白)；臂 = 单段圆角条。
	var is_leg: bool = limb_name.begins_with("Leg")
	var polygon := _leg_polygon() if is_leg else _arm_polygon()
	_attach_outlined(pivot, polygon, color)
	if is_leg:
		var shoe := Polygon2D.new()
		shoe.name = "Shoe"
		shoe.color = COLOR_SHOE
		shoe.polygon = PackedVector2Array([
			Vector2(-6.0, 8.0), Vector2(7.0, 8.0), Vector2(9.0, 15.0), Vector2(-6.0, 15.0),
		])
		shoe.position = Vector2(0.0, 0.0)
		pivot.add_child(shoe)
	return pivot


## 给父节点挂「描边 + 主色」一对多边形（描边放大 1.14 同形垫底，先加先画）。
func _attach_outlined(parent: Node2D, polygon: PackedVector2Array, color: Color) -> void:
	var outline := Polygon2D.new()
	outline.name = "Outline"
	outline.color = OUTLINE
	outline.polygon = polygon
	outline.scale = Vector2.ONE * 1.14
	parent.add_child(outline)
	var main := Polygon2D.new()
	main.name = "Main"
	main.color = color
	main.polygon = polygon
	parent.add_child(main)


## 独立色块（躯干/头/发等静态部件）：返回主色层（描边层同树序在前）。
func _build_block(parent: Node2D, block_name: String, polygon: PackedVector2Array,
		color: Color, z: int) -> Polygon2D:
	var holder := Node2D.new()
	holder.name = block_name
	holder.z_index = z
	parent.add_child(holder)
	_attach_outlined(holder, polygon, color)
	var main := holder.get_node("Main") as Polygon2D
	return main


func _build_eyes() -> void:
	var holder := Node2D.new()
	holder.name = "Eyes"
	holder.z_index = 5
	holder.position = _head.position + Vector2(4.0, -1.0)
	_upper_group.add_child(holder)
	for i: int in 2:
		var eye := Polygon2D.new()
		eye.name = "Eye%d" % i
		eye.color = Color(0.16, 0.14, 0.13, 1.0)
		eye.polygon = _circle_polygon(2.6, 8)
		eye.position = Vector2(3.5 * float(i), 0.0)
		holder.add_child(eye)
		var glint := Polygon2D.new()
		glint.name = "Glint%d" % i
		glint.color = Color(1, 1, 1, 0.95)
		glint.polygon = _circle_polygon(0.9, 6)
		glint.position = Vector2(3.5 * float(i) + 0.9, -0.9)
		holder.add_child(glint)


## 高光块（半透明白，压在色块上部 → 卡通体积感）。
func _build_highlight(parent: Node2D, at: Vector2, size: Vector2) -> void:
	var highlight := Polygon2D.new()
	highlight.name = "Highlight"
	highlight.z_index = 6
	highlight.color = Color(1, 1, 1, 0.32)
	highlight.polygon = PackedVector2Array([
		Vector2(-size.x, -size.y), Vector2(size.x, -size.y),
		Vector2(size.x * 0.6, size.y), Vector2(-size.x * 0.6, size.y),
	])
	highlight.position = at
	highlight.rotation = -0.35
	parent.add_child(highlight)


## ── 形状表（局部原点 = 部件锚点）──
func _torso_polygon() -> PackedVector2Array:
	# 圆角矩形躯干（八边形近似，微前倾的卫衣轮廓），肩部在 y=-14、下摆 y=+14。
	return PackedVector2Array([
		Vector2(-11.0, -10.0), Vector2(-7.0, -15.0), Vector2(8.0, -15.0), Vector2(12.0, -9.0),
		Vector2(13.0, 8.0), Vector2(9.0, 14.0), Vector2(-9.0, 14.0), Vector2(-12.0, 8.0),
	])


func _shorts_polygon() -> PackedVector2Array:
	return PackedVector2Array([
		Vector2(-12.0, 10.0), Vector2(12.0, 10.0), Vector2(11.0, 22.0),
		Vector2(2.0, 22.0), Vector2(0.0, 16.0), Vector2(-2.0, 22.0), Vector2(-11.0, 22.0),
	])


func _leg_polygon() -> PackedVector2Array:
	# 原点 = 髋关节，向下延伸（摆动绕髋旋转）。
	return PackedVector2Array([
		Vector2(-5.0, -3.0), Vector2(5.0, -3.0), Vector2(6.0, 8.0), Vector2(-6.0, 8.0),
	])


func _arm_polygon() -> PackedVector2Array:
	# 原点 = 肩关节，向下延伸（摆臂绕肩旋转）。
	return PackedVector2Array([
		Vector2(-4.0, -2.0), Vector2(4.0, -2.0), Vector2(5.0, 12.0), Vector2(-5.0, 12.0),
	])


func _hair_polygon() -> PackedVector2Array:
	# 盖在头顶的乱刘海 + 后脑勺发量（随头组移动）。
	return PackedVector2Array([
		Vector2(-14.0, 2.0), Vector2(-11.0, -6.0), Vector2(-5.0, -10.0), Vector2(4.0, -10.0),
		Vector2(11.0, -7.0), Vector2(14.0, 0.0), Vector2(14.0, 4.0),
		Vector2(8.0, -2.0), Vector2(-2.0, -3.0), Vector2(-9.0, 2.0), Vector2(-14.0, 5.0),
	])


func _band_polygon() -> PackedVector2Array:
	# 发带横条 + 脑后飘带（酷跑感）。
	return PackedVector2Array([
		Vector2(-15.0, -2.0), Vector2(15.0, -2.0), Vector2(15.0, 2.0), Vector2(-15.0, 2.0),
	])


## 圆形多边形近似（sides 边）。
func _circle_polygon(radius: float, sides: int) -> PackedVector2Array:
	var points := PackedVector2Array()
	for i: int in sides:
		var angle: float = TAU * float(i) / float(sides)
		points.append(Vector2(cos(angle), sin(angle)) * radius)
	return points
