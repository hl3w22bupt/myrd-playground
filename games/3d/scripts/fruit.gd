class_name Fruit
extends Area3D
## 抛出物：水果（≥5 种，由 FruitCatalog 定义）+ 炸弹（is_bomb 区分外观与判定结果）。
##
## 规范要点（见 SKILL.md「GDScript 规范」「反馈完备性（Juice）」）：
## - 运动为确定性重力积分（每帧 velocity.y -= GameState.gravity * delta），不依赖物理引擎抛体；
## - Area3D + SphereShape3D 是真实的碰撞体：刀痕线段经物理空间查询与它求交（blade.gd）；
## - 切割结果反馈挂在结果事件处理函数 slice() 上（不挂在输入处理上）；
## - 对局结束后 slice() 直接忽略（GameState.round_active 守卫），结算面板出现后不再误计分。
##
## 3D 视觉（需求「验收 5/6」）：
## - 程序化双层网格：peel 外层球（果皮色 + 高光 + 边缘光）包 flesh 内层球（果肉色）；
## - 切开后两半各带切面剖面（果肉圆盘 + 果心 + 籽粒），汁液粒子颜色 = 该水果果肉色。

## 碰撞体半径（与 fruit.tscn 的 SphereShape3D 一致；视觉半径按种类由 FruitCatalog 定义）。
const RADIUS: float = 0.42
## 果肉内层球相对果皮的半径比（双层网格：内层完全被皮包住，切开才可见）。
const FLESH_INNER_RATIO: float = 0.86
## 边缘光强度（rim light：轮廓受光，让水果从深色背景里「立」出来）。
const PEEL_RIM: float = 0.8
## 落出屏幕下缘（漏接）的判定线。
const MISS_Y: float = -7.0
## 两半分离的水平距离与下坠深度（表现层，非数值调参）。
const HALF_SPLIT: float = 1.2
const HALF_DROP: float = 2.8
const HALF_LIFE_SEC: float = 1.0

@export var is_bomb: bool = false
## 水果种类（FruitCatalog.KINDS 之一；炸弹忽略此值）。空值 = 苹果（老调用方兼容）。
@export var variety: StringName = &"apple"

## 抛出初速度，由投掷方（main.gd）在入树前通过 setup() 注入。
var velocity: Vector3 = Vector3.ZERO

var _sliced: bool = false

@onready var _mesh: MeshInstance3D = $Mesh
@onready var _fuse: MeshInstance3D = $Fuse


func _ready() -> void:
	add_to_group(&"fruits")
	if is_bomb:
		_apply_bomb_look()
	else:
		_apply_fruit_look()


## 水果种类定义（FruitCatalog 的运行时快照，表现层统一从这读）。
func catalog_def() -> Dictionary:
	return FruitCatalog.def(variety)


## 投掷方注入出生点与初速度（在 add_child 之前调用，避免与 _physics_process 竞争）。
func setup(spawn_pos: Vector3, spawn_velocity: Vector3) -> void:
	position = spawn_pos
	velocity = spawn_velocity


func _physics_process(delta: float) -> void:
	if _sliced:
		return
	velocity = Vector3(velocity.x, velocity.y - GameState.gravity * delta, velocity.z)
	position += velocity * delta
	_mesh.rotation = Vector3(0.0, 0.0, _mesh.rotation.z + delta * 2.2)
	if position.y < MISS_Y:
		GameState.register_miss()
		queue_free()


## 刀痕命中入口（blade.gd 的物理查询回调）：水果一分为二计分，炸弹终局。
func slice(cut_dir: Vector3) -> void:
	if _sliced or not GameState.round_active:
		return
	_sliced = true
	if is_bomb:
		GameState.register_bomb_cut()
		_explode()
	else:
		GameState.register_fruit_cut(variety)
		_spawn_halves(cut_dir)
		_spawn_juice(catalog_def()["flesh_juice"], 14)
		Juice.sfx(&"hit")
		queue_free()


## 炸弹外观：深色球体 + 引信（与水果一眼可辨）。
func _apply_bomb_look() -> void:
	var bomb_material := StandardMaterial3D.new()
	bomb_material.albedo_color = Color(0.1, 0.1, 0.12, 1.0)
	bomb_material.roughness = 0.3
	bomb_material.metallic = 0.4
	_mesh.material_override = bomb_material
	_fuse.visible = true


## 水果外观（程序化双层网格 + 材质高光 + 边缘光，按 FruitCatalog 定义逐种类生成）。
func _apply_fruit_look() -> void:
	var fruit_def := catalog_def()
	var visual_radius: float = fruit_def["radius"]
	var peel := StandardMaterial3D.new()
	peel.albedo_color = fruit_def["peel_color"]
	peel.roughness = fruit_def["peel_roughness"]
	peel.metallic = 0.05
	# 边缘光：轮廓受光 + 低粗糙度高光，深色背景下水果立体可辨（需求「验收 5 体积感」）。
	peel.rim_enabled = true
	peel.rim = PEEL_RIM
	peel.rim_tint = 0.4
	_mesh.material_override = peel
	var peel_mesh := SphereMesh.new()
	peel_mesh.radius = visual_radius
	peel_mesh.height = visual_radius * 2.0
	_mesh.mesh = peel_mesh
	_mesh.scale = Vector3(fruit_def["stretch"], fruit_def["squash"], 1.0)
	# 果肉内层球：半径略小、完全包在果皮里，构成「果皮/果肉双层网格」，切开才可见。
	var flesh_inner := MeshInstance3D.new()
	var flesh_mesh := SphereMesh.new()
	flesh_mesh.radius = visual_radius * FLESH_INNER_RATIO
	flesh_mesh.height = visual_radius * FLESH_INNER_RATIO * 2.0
	flesh_inner.mesh = flesh_mesh
	flesh_inner.material_override = _make_flesh_material(fruit_def)
	_mesh.add_child(flesh_inner)


## 果肉材质（切面圆盘与内层球共用）：微发光的果肉色，切面亮度高于皮（可辨识）。
func _make_flesh_material(fruit_def: Dictionary) -> StandardMaterial3D:
	var flesh := StandardMaterial3D.new()
	flesh.albedo_color = fruit_def["flesh_color"]
	flesh.roughness = 0.7
	flesh.emission_enabled = true
	flesh.emission = fruit_def["flesh_color"]
	flesh.emission_energy_multiplier = 0.12
	return flesh


## 水果沿刀痕方向一分为二：两半分离坠落，切面剖面（果肉圆盘 + 果心 + 籽粒）朝外。
func _spawn_halves(cut_dir: Vector3) -> void:
	var normal := Vector3(-cut_dir.y, cut_dir.x, 0.0).normalized()
	if normal == Vector3.ZERO:
		normal = Vector3(1, 0, 0)
	var fruit_def := catalog_def()
	# 形状缩放（种类差异）× 切半压扁（沿切割法线 0.5）——Godot 4 中 scale 是 basis 的视图，
	# 必须把两者烘进同一个 Basis（列 x=刀痕方向、y=切割法线），后设 basis 会覆盖先设的 scale。
	var shape_scale := Vector3(fruit_def["stretch"], fruit_def["squash"] * 0.5, 1.0)
	var half_axes := Basis(cut_dir.normalized(), normal, cut_dir.normalized().cross(normal))
	for side: float in [-1.0, 1.0]:
		var half := MeshInstance3D.new()
		half.mesh = _mesh.mesh  # 复用果皮球网格（含双层子节点一并带走）
		half.material_override = _mesh.material_override
		half.basis = half_axes * Basis.from_scale(shape_scale)
		half.position = position + normal * side * 0.06
		_build_cut_face(half, fruit_def)
		get_parent().add_child(half)
		var tween := half.create_tween()
		tween.set_parallel(true)
		tween.tween_property(half, "position",
			position + normal * side * HALF_SPLIT + Vector3(0, -HALF_DROP, 0), HALF_LIFE_SEC) \
			.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
		tween.tween_property(half, "basis",
			half.basis * Basis(Vector3(0, 0, 1), side * 3.4), HALF_LIFE_SEC)
		tween.chain().tween_callback(half.queue_free)


## 切面剖面网格（需求「验收 6 切面细节按种类可辨识」）：
## 压在切割平面上的果肉圆盘 + 果心亮点 + 籽粒（籽数/籽色按水果定义）。
## 挂载关系：half（皮球）→ face（果肉薄饼，法线方向已由 half 的 basis y 列对齐）→ 果心 + 籽粒。
func _build_cut_face(half: MeshInstance3D, fruit_def: Dictionary) -> void:
	var visual_radius: float = fruit_def["radius"]
	var face := MeshInstance3D.new()
	var face_mesh := SphereMesh.new()
	face_mesh.radius = visual_radius * FLESH_INNER_RATIO
	face_mesh.height = visual_radius * FLESH_INNER_RATIO * 2.0
	face.mesh = face_mesh
	face.material_override = _make_flesh_material(fruit_def)
	# 沿切割法线压成薄饼贴在切面上；法线在 half 局部空间是 +y。
	face.scale = Vector3(1.0, 0.12, 1.0)
	half.add_child(face)
	var core := MeshInstance3D.new()
	var core_mesh := SphereMesh.new()
	core_mesh.radius = visual_radius * 0.22
	core_mesh.height = visual_radius * 0.44
	core.mesh = core_mesh
	var core_material := StandardMaterial3D.new()
	core_material.albedo_color = Color(1.0, 0.97, 0.85)
	core_material.roughness = 0.9
	core.material_override = core_material
	face.add_child(core)
	var seed_count: int = fruit_def["seed_count"]
	for i in range(seed_count):
		var seed_node := MeshInstance3D.new()
		var seed_mesh := SphereMesh.new()
		seed_mesh.radius = visual_radius * 0.06
		seed_mesh.height = visual_radius * 0.12
		seed_node.mesh = seed_mesh
		var seed_material := StandardMaterial3D.new()
		seed_material.albedo_color = fruit_def["seed_color"]
		seed_material.roughness = 0.5
		seed_node.material_override = seed_material
		var angle := TAU * float(i) / maxf(float(seed_count), 1.0) + 0.5
		seed_node.position = Vector3(cos(angle), 0.0, sin(angle)) * visual_radius * 0.55
		face.add_child(seed_node)


## 果汁 / 爆炸粒子（CPUParticles3D：无 GPU 依赖，headless 稳定）。
func _spawn_juice(color: Color, amount: int) -> void:
	var particles := CPUParticles3D.new()
	particles.amount = amount
	particles.lifetime = 0.55
	particles.one_shot = true
	particles.explosiveness = 0.95
	particles.direction = Vector3(0, 1, 0)
	particles.spread = 75.0
	particles.initial_velocity_min = 2.0
	particles.initial_velocity_max = 5.5
	particles.gravity = Vector3(0, -10, 0)
	particles.scale_amount_min = 0.5
	particles.scale_amount_max = 1.0
	particles.color = color
	var droplet := SphereMesh.new()
	droplet.radius = 0.06
	droplet.height = 0.12
	droplet.radial_segments = 8
	droplet.rings = 4
	particles.mesh = droplet
	get_parent().add_child(particles)
	particles.position = position
	particles.emitting = true
	var tween := particles.create_tween()
	tween.tween_interval(1.2)
	tween.tween_callback(particles.queue_free)


## 切中炸弹：爆炸粒子 + 震屏/顿帧反馈（计分与终局由 GameState.register_bomb_cut 统一结算）。
func _explode() -> void:
	_spawn_juice(Color(1.0, 0.55, 0.15), 24)
	Juice.shake(9.0)
	Juice.hit_stop(0.06)
	Juice.sfx(&"fail")
	queue_free()
