class_name Doll
extends RigidBody3D
## 娃娃（3D）：8 种造型（造型/体积/稀有度差异化）程序化建模的 RigidBody3D。
##
## 真实物理：落台/蹭落/落洞都是刚体碰撞翻滚（验收 3）。被爪子抓住时 freeze 成
## 运动学态由爪子每帧同步位置，松爪 unfreeze 交还物理。
## 材质按款式缓存（static），8 只娃娃共享，控 DrawCall。

signal caught(doll: Doll)

enum DollState { IDLE, HELD, CAUGHT }

## 娃娃库（需求：不少于 8 种，不同造型/体积/稀有度；weight 越大越难被抓稳，质量也越大）。
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

## 布货半径基准（米）；实际半径按体重微调（weight^0.15，同 2D 版口径）。
## 0.13 配 2×4 网格（列距 0.20/行距 0.20）：相邻轻微相触，落台散落后自然成堆。
const BASE_RADIUS: float = 0.13

var kind_index: int = 0
var kind: Dictionary = KINDS[0]
var radius: float = BASE_RADIUS
var state: int = DollState.IDLE

static var _mat_cache: Dictionary = {}


## 布货：指定款式（入场时由主场景调用），随机微转角模拟散落。
func setup(index: int, doll_radius: float) -> void:
	kind_index = index % KINDS.size()
	kind = KINDS[kind_index]
	radius = doll_radius * float(kind.get("weight", 1.0)) ** 0.15
	mass = 0.22 * float(kind.get("weight", 1.0))
	rotation = Vector3(randf_range(-0.25, 0.25), randf_range(-PI, PI), randf_range(-0.25, 0.25))
	_build_body()


func kind_name() -> String:
	return String(kind["name"])


func kind_score() -> int:
	return int(kind["score"])


func kind_rarity() -> String:
	return String(kind["rarity"])


## 被爪子抓住：冻结成运动学态（位置由 claw 每帧同步）。
func grab() -> void:
	state = DollState.HELD
	freeze_mode = RigidBody3D.FREEZE_MODE_KINEMATIC
	freeze = true
	linear_velocity = Vector3.ZERO
	angular_velocity = Vector3.ZERO


## 松爪：is_caught=true 交还物理直接落洞；false 中途滑落，给一点随机翻滚。
func release(is_caught: bool) -> void:
	freeze = false
	linear_velocity = Vector3.ZERO
	angular_velocity = Vector3.ZERO
	if not is_caught:
		apply_central_impulse(Vector3(randf_range(-0.25, 0.25), 0.0, randf_range(-0.2, 0.2)))
		apply_torque_impulse(Vector3(randf_range(-0.05, 0.05), randf_range(-0.05, 0.05), randf_range(-0.05, 0.05)))
	else:
		state = DollState.CAUGHT


## 绒布材质（画质 v2 专项三）：高粗糙哑光绒面（roughness 0.95 + 低 specular 吃光不反光）；
## 亮面件（眼睛/独角）单独传 roughness，按 色值|粗糙度 缓存共享，控 DrawCall。
func _mat(color: Color, rough: float = 0.95) -> StandardMaterial3D:
	var key := "%s|%s" % [color.to_html(), rough]
	if not _mat_cache.has(key):
		var mat := StandardMaterial3D.new()
		mat.albedo_color = color
		mat.roughness = rough
		mat.metallic_specular = 0.25 if rough >= 0.85 else 0.7
		_mat_cache[key] = mat
	return _mat_cache[key] as StandardMaterial3D


func _sphere(parent: Node, pos: Vector3, r: float, mat: Material, sy := 1.0) -> MeshInstance3D:
	var mesh := SphereMesh.new()
	mesh.radius = r
	mesh.height = r * 2.0 * sy
	# 画质 v2（专项三）：细分从 20/10 提到 22/11 —— 弧面更圆滑；顶点预算给 SwiftShader
	# 软渲染的门禁环境留余地（材质仍按款式缓存共享）。
	mesh.radial_segments = 22
	mesh.rings = 11
	var inst := MeshInstance3D.new()
	inst.mesh = mesh
	inst.position = pos
	inst.material_override = mat
	parent.add_child(inst)
	return inst


## 程序化建模（画质 v2 专项三）：身体 + 肚皮 + 头 + 耳朵/独角 + 手脚 + 眼睛鼻腮红 + 碰撞球。
## 多部件立体层次：手臂/脚掌/口鼻让剪影脱离「贴片球」，眼睛带高光点更像玩偶。
func _build_body() -> void:
	for child in get_children():
		child.queue_free()
	var r := radius
	var body_c: Color = kind["body"]
	var belly_c: Color = kind["belly"]
	var mat_body := _mat(body_c)
	var mat_belly := _mat(belly_c)
	# 身体（竖椭圆）与肚皮。
	_sphere(self, Vector3(0.0, 0.0, 0.0), r, mat_body, 1.05)
	_sphere(self, Vector3(0.0, -r * 0.18, r * 0.32), r * 0.52, mat_belly, 1.1)
	# 手臂（两侧斜下的小椭球）与脚掌（底部两颗），拼出玩偶剪影。
	for side in [-1.0, 1.0]:
		var arm := _sphere(self, Vector3(side * r * 0.78, -r * 0.05, r * 0.18), r * 0.24, mat_body, 1.35)
		arm.rotation.z = side * -0.5
		_sphere(self, Vector3(side * r * 0.34, -r * 0.88, r * 0.30), r * 0.20, mat_body, 0.9)
	# 头（略前倾朝向镜头 +Z）。
	_sphere(self, Vector3(0.0, r * 0.72, r * 0.06), r * 0.74, mat_body)
	_sphere(self, Vector3(0.0, r * 0.6, r * 0.5), r * 0.36, mat_belly, 0.9)
	match String(kind["ear"]):
		"round":
			for side in [-1.0, 1.0]:
				_sphere(self, Vector3(side * r * 0.66, r * 1.22, 0.02), r * 0.3, mat_body)
				_sphere(self, Vector3(side * r * 0.66, r * 1.22, 0.1), r * 0.16, mat_belly)
			# 泰迪熊口鼻。
			_sphere(self, Vector3(0.0, r * 0.58, r * 0.66), r * 0.20, mat_belly, 0.85)
		"bunny":
			for side in [-1.0, 1.0]:
				_sphere(self, Vector3(side * r * 0.34, r * 1.5, -0.02), r * 0.2, mat_body, 2.6)
				_sphere(self, Vector3(side * r * 0.36, r * 1.52, 0.1), r * 0.1, mat_belly, 2.0)
			_sphere(self, Vector3(0.0, r * 0.56, r * 0.68), r * 0.14, mat_belly, 0.85)
		"cat":
			for side in [-1.0, 1.0]:
				_sphere(self, Vector3(side * r * 0.58, r * 1.28, 0.0), r * 0.24, mat_body, 0.8)
			_sphere(self, Vector3(0.0, r * 0.56, r * 0.66), r * 0.16, mat_belly, 0.85)
		"horn":
			var horn := MeshInstance3D.new()
			var cone := CylinderMesh.new()
			cone.top_radius = 0.0
			cone.bottom_radius = r * 0.14
			cone.height = r * 0.62
			cone.radial_segments = 24
			horn.mesh = cone
			horn.position = Vector3(0.0, r * 1.62, 0.0)
			horn.rotation.x = 0.12
			# 独角 = 唯一的亮面硬质件：金属质感（与绒布 body 拉开材质对比）。
			horn.material_override = _mat(Color(1.0, 0.88, 0.55), 0.25)
			add_child(horn)
			for side in [-1.0, 1.0]:
				_sphere(self, Vector3(side * r * 0.55, r * 1.12, 0.0), r * 0.16, _mat(Color(1.0, 0.75, 0.85)))
		_:
			pass
	# 眼睛（亮面 + 高光点）+ 鼻 + 腮红。
	var eye := _mat(Color(0.14, 0.11, 0.10), 0.12)
	_sphere(self, Vector3(-r * 0.26, r * 0.78, r * 0.62), r * 0.09, eye)
	_sphere(self, Vector3(r * 0.26, r * 0.78, r * 0.62), r * 0.09, eye)
	var gleam := _mat(Color(1.0, 1.0, 1.0), 0.05)
	_sphere(self, Vector3(-r * 0.23, r * 0.81, r * 0.69), r * 0.03, gleam)
	_sphere(self, Vector3(r * 0.29, r * 0.81, r * 0.69), r * 0.03, gleam)
	_sphere(self, Vector3(0.0, r * 0.62, r * 0.68), r * 0.06, _mat(Color(0.55, 0.3, 0.3), 0.5))
	_sphere(self, Vector3(-r * 0.48, r * 0.62, r * 0.5), r * 0.11, _mat(Color(1.0, 0.62, 0.62, 0.6)))
	_sphere(self, Vector3(r * 0.48, r * 0.62, r * 0.5), r * 0.11, _mat(Color(1.0, 0.62, 0.62, 0.6)))
	# 碰撞球（略小于视觉，抓取与落洞余量更足）。
	var shape_node := CollisionShape3D.new()
	var shape := SphereShape3D.new()
	shape.radius = r * 0.92
	shape_node.shape = shape
	shape_node.position = Vector3(0.0, r * 0.25, 0.0)
	add_child(shape_node)
	# 物理材质：低弹性高摩擦，堆叠稳定、翻滚自然。
	var phys := PhysicsMaterial.new()
	phys.bounce = 0.12
	phys.friction = 0.9
	physics_material_override = phys
	angular_damp = 2.5
	linear_damp = 0.15
	collision_layer = 1
	collision_mask = 1
	can_sleep = true
