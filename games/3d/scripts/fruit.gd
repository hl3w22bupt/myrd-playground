class_name Fruit
extends Area3D
## 抛出物：苹果 / 炸弹（同一场景 + is_bomb 区分外观与判定结果）。
##
## 规范要点（见 SKILL.md「GDScript 规范」「反馈完备性（Juice）」）：
## - 运动为确定性重力积分（每帧 velocity.y -= GameState.gravity * delta），不依赖物理引擎抛体；
## - Area3D + SphereShape3D 是真实的碰撞体：刀痕线段经物理空间查询与它求交（blade.gd）；
## - 切割结果反馈挂在结果事件处理函数 slice() 上（不挂在输入处理上）；
## - 对局结束后 slice() 直接忽略（GameState.round_active 守卫），结算面板出现后不再误计分。

## 碰撞体 / 外观半径（与 fruit.tscn 的 SphereShape3D / SphereMesh 一致）。
const RADIUS: float = 0.42
## 落出屏幕下缘（漏接）的判定线。
const MISS_Y: float = -7.0
## 两半分离的水平距离与下坠深度（表现层，非数值调参）。
const HALF_SPLIT: float = 1.2
const HALF_DROP: float = 2.8
const HALF_LIFE_SEC: float = 1.0

@export var is_bomb: bool = false

## 抛出初速度，由投掷方（main.gd）在入树前通过 setup() 注入。
var velocity: Vector3 = Vector3.ZERO

var _sliced: bool = false

@onready var _mesh: MeshInstance3D = $Mesh
@onready var _fuse: MeshInstance3D = $Fuse


func _ready() -> void:
	add_to_group(&"fruits")
	if is_bomb:
		_apply_bomb_look()


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


## 刀痕命中入口（blade.gd 的物理查询回调）：苹果一分为二计分，炸弹终局。
func slice(cut_dir: Vector3) -> void:
	if _sliced or not GameState.round_active:
		return
	_sliced = true
	if is_bomb:
		GameState.register_bomb_cut()
		_explode()
	else:
		GameState.register_apple_cut()
		_spawn_halves(cut_dir)
		_spawn_juice(Color(0.9, 0.25, 0.2), 14)
		Juice.sfx(&"hit")
		queue_free()


## 炸弹外观：深色球体 + 引信（与苹果一眼可辨）。
func _apply_bomb_look() -> void:
	var bomb_material := StandardMaterial3D.new()
	bomb_material.albedo_color = Color(0.1, 0.1, 0.12, 1.0)
	bomb_material.roughness = 0.3
	bomb_material.metallic = 0.4
	_mesh.material_override = bomb_material
	_fuse.visible = true


## 苹果沿刀痕方向一分为二：两半分离坠落 + 果肉截面观感（压扁半球）。
func _spawn_halves(cut_dir: Vector3) -> void:
	var normal := Vector3(-cut_dir.y, cut_dir.x, 0.0).normalized()
	if normal == Vector3.ZERO:
		normal = Vector3(1, 0, 0)
	for side: float in [-1.0, 1.0]:
		var half := MeshInstance3D.new()
		var half_mesh := SphereMesh.new()
		half_mesh.radius = RADIUS
		half_mesh.height = RADIUS * 2.0
		half_mesh.radial_segments = 16
		half_mesh.rings = 8
		half.mesh = half_mesh
		half.scale = Vector3(1.0, 0.5, 1.0)
		half.position = position + normal * side * 0.06
		half.rotation = _mesh.rotation
		var flesh := StandardMaterial3D.new()
		flesh.albedo_color = Color(0.93, 0.86, 0.45, 1.0)
		flesh.shading_mode = BaseMaterial3D.SHADING_MODE_PER_PIXEL
		half.material_override = flesh
		get_parent().add_child(half)
		var tween := half.create_tween()
		tween.set_parallel(true)
		tween.tween_property(half, "position",
			position + normal * side * HALF_SPLIT + Vector3(0, -HALF_DROP, 0), HALF_LIFE_SEC) \
			.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
		tween.tween_property(half, "rotation",
			_mesh.rotation + Vector3(0, 0, side * 3.4), HALF_LIFE_SEC)
		tween.chain().tween_callback(half.queue_free)


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
