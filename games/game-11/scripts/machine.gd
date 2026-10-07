class_name Machine
extends Node3D
## 机台（3D）：柜体/玻璃罩/灯箱/取物口/取物滑道/导轨的网格搭建 + 布局常量唯一来源。
##
## 布局以米为单位（1 unit = 1 m）：娃娃半径 ~0.15，爪子龙门架高 1.45。
## 爪子/娃娃/取物口的世界坐标都从本文件常量推导，改布局只动这里。
## 网格全部代码生成（BoxMesh/SphereMesh/StandardMaterial3D），不依赖外部模型资产。

## 可玩区（爪子平移范围，XZ 平面；x=世界 X，y=世界 Z）。
const FIELD_RECT: Rect2 = Rect2(-0.55, -0.40, 1.10, 0.82)
## 取物口（地板上的洞，XZ 平面）：收进前左角，与布货区保持安全边距
## （布货最前 z=0.04+抖动 0.045=0.085 < 洞前沿 0.12，娃娃散落也不会开局自落）。
const PIT_RECT: Rect2 = Rect2(-0.55, 0.12, 0.40, 0.30)
## 取物口悬停点：爪子送娃娃回程的目标点（洞口正上方）。
const PIT_HOVER: Vector3 = Vector3(-0.35, 0.62, 0.27)
## 松爪后娃娃的物理落点（洞内，Area3D 在此接住入账）。
const PIT_DROP_TARGET: Vector3 = Vector3(-0.35, 0.02, 0.27)
## 娃娃布货区（XZ 平面，玻璃罩内、取物口以外）。
const SPAWN_RECT: Rect2 = Rect2(-0.36, -0.36, 0.80, 0.40)
## 龙门架高度（爪子挂点 Y）。
const GANTRY_Y: float = 1.45
## 爪子开局的挂点。
const CLAW_START: Vector3 = Vector3(0.0, GANTRY_Y, -0.05)
## 柜体半宽/玻璃罩高度（外观）。
const CAB_HALF_W: float = 0.78
const WALL_H: float = 1.55
const WALL_T: float = 0.05
## 取物滑道（洞下方的储物腔）。
const CHUTE_FLOOR_Y: float = -0.62

var pit_area: Area3D

var _mat_body: StandardMaterial3D
var _mat_frame: StandardMaterial3D
var _mat_inner: StandardMaterial3D
var _mat_carpet: StandardMaterial3D
var _mat_glass: StandardMaterial3D
var _mat_lamp: StandardMaterial3D
var _mat_bulb: StandardMaterial3D


func field_rect() -> Rect2:
	return FIELD_RECT


func pit_hover_point() -> Vector3:
	return PIT_HOVER


func pit_drop_target() -> Vector3:
	return PIT_DROP_TARGET


func claw_start() -> Vector3:
	return CLAW_START


func spawn_rect() -> Rect2:
	return SPAWN_RECT


func _ready() -> void:
	_build_materials()
	_build_cabinet()
	_build_glass_box()
	_build_floor_with_pit()
	_build_chute()
	_build_marquee()
	_build_lights()


## 建一个盒体：collide=true 时同时挂 StaticBody3D + BoxShape3D（娃娃要碰的地板/墙/滑道）。
func _box(size: Vector3, pos: Vector3, mat: Material, collide: bool = false) -> MeshInstance3D:
	var mesh := BoxMesh.new()
	mesh.size = size
	var inst := MeshInstance3D.new()
	inst.mesh = mesh
	inst.material_override = mat
	if collide:
		var body := StaticBody3D.new()
		body.position = pos
		var shape := CollisionShape3D.new()
		var box := BoxShape3D.new()
		box.size = size
		shape.shape = box
		body.add_child(shape)
		body.add_child(inst)
		add_child(body)
	else:
		inst.position = pos
		add_child(inst)
	return inst


func _build_materials() -> void:
	# PBR 材质体系（画质 v2 专项三）：按部件区分 metallic / roughness / emission / specular。
	# 机身 = 深紫烤漆金属（金属基底、中等粗糙 → 可见环境反光条）。
	_mat_body = StandardMaterial3D.new()
	_mat_body.albedo_color = Color(0.13, 0.105, 0.26)
	_mat_body.metallic = 0.78
	_mat_body.roughness = 0.38
	_mat_body.metallic_specular = 0.62
	# 金色包边 = 镀铬金（全金属、低粗糙 → 沿补光拉出镜面高光条）。
	_mat_frame = StandardMaterial3D.new()
	_mat_frame.albedo_color = Color(1.0, 0.83, 0.40)
	_mat_frame.metallic = 1.0
	_mat_frame.roughness = 0.18
	_mat_frame.metallic_specular = 0.75
	# 柜内壁 = 深色丝绒（高粗糙哑光，吃光不反光，衬托娃娃）。
	_mat_inner = StandardMaterial3D.new()
	_mat_inner.albedo_color = Color(0.09, 0.08, 0.17)
	_mat_inner.roughness = 0.97
	_mat_inner.metallic_specular = 0.2
	# 台面地毯 = 绒面猩红（最高粗糙 + 低 specular，哑光织物感）。
	_mat_carpet = StandardMaterial3D.new()
	_mat_carpet.albedo_color = Color(0.60, 0.155, 0.26)
	_mat_carpet.roughness = 1.0
	_mat_carpet.metallic_specular = 0.15
	# 玻璃罩 = 透明 + 高 specular + 双面（补光沿玻璃拉出斜向反光，可感知的环境反射）。
	_mat_glass = StandardMaterial3D.new()
	_mat_glass.albedo_color = Color(0.70, 0.88, 1.0, 0.13)
	_mat_glass.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_mat_glass.metallic = 0.55
	_mat_glass.roughness = 0.04
	_mat_glass.metallic_specular = 0.9
	_mat_glass.cull_mode = BaseMaterial3D.CULL_DISABLED
	# 灯罩 / 灯泡 = 自发光体（emission 能量抬到 Glow 阈值之上，主环境 glow 下出光晕）。
	_mat_lamp = StandardMaterial3D.new()
	_mat_lamp.albedo_color = Color(1.0, 0.93, 0.68)
	_mat_lamp.emission_enabled = true
	_mat_lamp.emission = Color(1.0, 0.85, 0.45)
	_mat_lamp.emission_energy_multiplier = 2.4
	_mat_bulb = StandardMaterial3D.new()
	_mat_bulb.albedo_color = Color(1.0, 0.98, 0.9)
	_mat_bulb.emission_enabled = true
	_mat_bulb.emission = Color(1.0, 0.95, 0.75)
	_mat_bulb.emission_energy_multiplier = 3.2


## 柜体外壳：底座 + 背板 + 左右侧板 + 前面板下半（滑道观察窗留洞由面板拼出）。
func _build_cabinet() -> void:
	var base_h := -CHUTE_FLOOR_Y
	# 底座（从滑道底到地板）。
	_box(Vector3(CAB_HALF_W * 2.0, base_h, 1.30), Vector3(0.0, -base_h / 2.0 - WALL_T, 0.0), _mat_body)
	# 背板 + 侧板（玻璃罩后半段实体，带碰撞：娃娃撞不出去）。
	_box(Vector3(CAB_HALF_W * 2.0, WALL_H, WALL_T), Vector3(0.0, WALL_H / 2.0, -0.50), _mat_body, true)
	_box(Vector3(WALL_T, WALL_H, 1.00), Vector3(-CAB_HALF_W, WALL_H / 2.0, 0.0), _mat_body, true)
	_box(Vector3(WALL_T, WALL_H, 1.00), Vector3(CAB_HALF_W, WALL_H / 2.0, 0.0), _mat_body, true)
	# 金色包边：背板顶沿 + 两侧立柱。
	_box(Vector3(CAB_HALF_W * 2.0, 0.05, 0.06), Vector3(0.0, WALL_H, -0.50), _mat_frame)
	_box(Vector3(0.06, WALL_H, 0.06), Vector3(-CAB_HALF_W, WALL_H / 2.0, 0.46), _mat_frame)
	_box(Vector3(0.06, WALL_H, 0.06), Vector3(CAB_HALF_W, WALL_H / 2.0, 0.46), _mat_frame)
	# 前面板下半（取物滑道段，留出圆形观察窗）。
	_box(Vector3(CAB_HALF_W * 2.0, 0.72, WALL_T), Vector3(0.0, CHUTE_FLOOR_Y + 0.26, 0.50), _mat_body)
	# 观察窗圆环装饰（出货口）。
	var ring := MeshInstance3D.new()
	var torus := TorusMesh.new()
	torus.inner_radius = 0.20
	torus.outer_radius = 0.26
	ring.mesh = torus
	ring.position = Vector3(0.0, CHUTE_FLOOR_Y + 0.30, 0.505)
	ring.material_override = _mat_frame
	add_child(ring)


## 玻璃罩：前玻璃（带碰撞，娃娃飞不出）+ 顶玻璃（装饰；顶板高过龙门滑车防穿模）。
## 玻璃全部 cast_shadow=OFF：透明体不该在主光下投死黑影，柜内主光软阴影才干净。
func _build_glass_box() -> void:
	var front := _box(Vector3(CAB_HALF_W * 2.0 - 0.06, WALL_H - 0.10, 0.02), Vector3(0.0, WALL_H / 2.0, 0.44), _mat_glass, true)
	front.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var top := _box(Vector3(CAB_HALF_W * 2.0 - 0.06, 0.02, 0.96), Vector3(0.0, WALL_H + 0.10, 0.0), _mat_glass)
	top.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	# 玻璃斜向高光条（装饰薄片）：微自发光模拟灯带在玻璃上的反射条。
	var glint := StandardMaterial3D.new()
	glint.albedo_color = Color(1.0, 1.0, 1.0, 0.09)
	glint.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	glint.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_box(Vector3(0.02, WALL_H - 0.2, 0.9), Vector3(-0.42, WALL_H / 2.0, 0.435), glint)
	_box(Vector3(0.02, WALL_H - 0.35, 0.7), Vector3(0.36, WALL_H / 2.0, 0.435), glint)


## 地板（地毯色）+ 取物口洞：洞四周用四条地板拼出，娃娃物理落洞。
func _build_floor_with_pit() -> void:
	var inner_w := CAB_HALF_W * 2.0 - WALL_T * 2.0 - 0.04
	var inner_d := 0.94
	var left_w := (PIT_RECT.position.x - (-inner_w / 2.0))
	if left_w > 0.01:
		_box(Vector3(left_w, 0.04, inner_d), Vector3(-inner_w / 2.0 + left_w / 2.0, -0.02, 0.0), _mat_carpet, true)
	var right_x := PIT_RECT.end.x
	var right_w := (inner_w / 2.0) - right_x
	if right_w > 0.01:
		_box(Vector3(right_w, 0.04, inner_d), Vector3(right_x + right_w / 2.0, -0.02, 0.0), _mat_carpet, true)
	var back_d := (PIT_RECT.position.y - (-inner_d / 2.0))
	if back_d > 0.01:
		_box(Vector3(PIT_RECT.size.x, 0.04, back_d), Vector3(PIT_RECT.get_center().x, -0.02, -inner_d / 2.0 + back_d / 2.0), _mat_carpet, true)
	var front_z := PIT_RECT.end.y
	var front_d := (inner_d / 2.0) - front_z
	if front_d > 0.01:
		_box(Vector3(PIT_RECT.size.x, 0.04, front_d), Vector3(PIT_RECT.get_center().x, -0.02, front_z + front_d / 2.0), _mat_carpet, true)
	# 洞口金色包边。
	_box(Vector3(PIT_RECT.size.x + 0.05, 0.02, 0.05), Vector3(PIT_RECT.get_center().x, 0.005, PIT_RECT.position.y), _mat_frame)
	_box(Vector3(PIT_RECT.size.x + 0.05, 0.02, 0.05), Vector3(PIT_RECT.get_center().x, 0.005, PIT_RECT.end.y), _mat_frame)
	_box(Vector3(0.05, 0.02, PIT_RECT.size.y), Vector3(PIT_RECT.position.x, 0.005, PIT_RECT.get_center().y), _mat_frame)
	_box(Vector3(0.05, 0.02, PIT_RECT.size.y), Vector3(PIT_RECT.end.x, 0.005, PIT_RECT.get_center().y), _mat_frame)


## 取物滑道：洞下方的储物腔（底板 + 四壁，全部带碰撞），娃娃落进后停在这里。
func _build_chute() -> void:
	var cx := PIT_RECT.get_center().x
	var cz := PIT_RECT.get_center().y
	var w := PIT_RECT.size.x
	var d := PIT_RECT.size.y
	var depth := 0.0 - CHUTE_FLOOR_Y
	_box(Vector3(w, 0.03, d), Vector3(cx, CHUTE_FLOOR_Y, cz), _mat_inner, true)
	_box(Vector3(w, depth, 0.02), Vector3(cx, CHUTE_FLOOR_Y + depth / 2.0, cz - d / 2.0), _mat_inner, true)
	_box(Vector3(w, depth, 0.02), Vector3(cx, CHUTE_FLOOR_Y + depth / 2.0, cz + d / 2.0), _mat_inner, true)
	_box(Vector3(0.02, depth, d), Vector3(cx - w / 2.0, CHUTE_FLOOR_Y + depth / 2.0, cz), _mat_inner, true)
	_box(Vector3(0.02, depth, d), Vector3(cx + w / 2.0, CHUTE_FLOOR_Y + depth / 2.0, cz), _mat_inner, true)


## 顶部灯箱：发光面板 + 标题 + 一排灯泡 + 爪子导轨 + 顶部皇冠金边。
func _build_marquee() -> void:
	_box(Vector3(CAB_HALF_W * 2.0, 0.26, 0.30), Vector3(0.0, WALL_H + 0.13, -0.30), _mat_body)
	var face := _box(Vector3(CAB_HALF_W * 2.0 - 0.08, 0.20, 0.02), Vector3(0.0, WALL_H + 0.13, -0.145), _mat_lamp)
	face.name = "MarqueeFace"
	face.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var title := Label3D.new()
	title.text = "★ 娃娃星球 ★"
	# 画质 v2（专项一）：3D 文字同样吃矢量中文字体（Web 沙箱没有系统字体，引擎内置
	# 字体只有拉丁字形，不挂字体就是缺字方块）；font_size 提到 256 / pixel_size 同比
	# 缩小 = 文字纹理密度翻倍多，高分屏下灯箱标题不再发糊。
	title.font = preload("res://assets/fonts/NotoSansSC-Regular.otf")
	title.font_size = 256
	title.pixel_size = 0.00082
	title.modulate = Color(0.55, 0.16, 0.28)
	title.outline_size = 40
	title.outline_modulate = Color(1.0, 0.95, 0.8)
	title.position = Vector3(0.0, WALL_H + 0.135, -0.13)
	add_child(title)
	# 顶部皇冠：金色斜边收头（体积感 + 金属反光层次）。
	_box(Vector3(CAB_HALF_W * 2.0 + 0.06, 0.06, 0.34), Vector3(0.0, WALL_H + 0.29, -0.30), _mat_frame)
	var bulb_mat := _mat_bulb
	for i in 9:
		var bulb := MeshInstance3D.new()
		var sphere := SphereMesh.new()
		sphere.radius = 0.032
		sphere.height = 0.064
		sphere.radial_segments = 24
		sphere.rings = 12
		bulb.mesh = sphere
		bulb.material_override = bulb_mat
		bulb.position = Vector3(-0.62 + float(i) * 0.155, WALL_H + 0.02, 0.40)
		bulb.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(bulb)
	# 龙门导轨（两条横梁 + 中梁）。
	var rail_mat := _mat_frame
	_box(Vector3(FIELD_RECT.size.x + 0.16, 0.05, 0.05), Vector3(0.0, GANTRY_Y + 0.06, FIELD_RECT.position.y - 0.05), rail_mat)
	_box(Vector3(FIELD_RECT.size.x + 0.16, 0.05, 0.05), Vector3(0.0, GANTRY_Y + 0.06, FIELD_RECT.end.y + 0.05), rail_mat)
	_box(Vector3(0.05, 0.05, FIELD_RECT.size.y + 0.16), Vector3(-FIELD_RECT.size.x / 2.0 - 0.05, GANTRY_Y + 0.06, 0.0), rail_mat)
	_box(Vector3(0.05, 0.05, FIELD_RECT.size.y + 0.16), Vector3(FIELD_RECT.size.x / 2.0 + 0.05, GANTRY_Y + 0.06, 0.0), rail_mat)
	_build_front_decor()


## 前脸细节（画质 v2 专项三：精细化建模）：投币门 + 出货按钮面板 + 玻璃前角柱。
## 全部纯装饰（无碰撞），不改变任何布局常量与物理体。
func _build_front_decor() -> void:
	# 玻璃前缘两根金属角柱（圆角柱体，撑起玻璃罩前脸）。
	for side in [-1.0, 1.0]:
		var post := MeshInstance3D.new()
		var cyl := CylinderMesh.new()
		cyl.top_radius = 0.035
		cyl.bottom_radius = 0.045
		cyl.height = WALL_H - 0.10
		cyl.radial_segments = 24
		post.mesh = cyl
		post.position = Vector3(side * (CAB_HALF_W - 0.05), WALL_H / 2.0, 0.44)
		post.material_override = _mat_frame
		add_child(post)
	# 投币门：金色圆盘底座 + 投币缝 + 红色退币钮。
	var coin_base := MeshInstance3D.new()
	var coin_cyl := CylinderMesh.new()
	coin_cyl.top_radius = 0.085
	coin_cyl.bottom_radius = 0.085
	coin_cyl.height = 0.02
	coin_cyl.radial_segments = 28
	coin_base.mesh = coin_cyl
	coin_base.rotation.x = PI / 2.0
	coin_base.position = Vector3(0.30, CHUTE_FLOOR_Y + 0.26, 0.512)
	coin_base.material_override = _mat_frame
	add_child(coin_base)
	var slot := MeshInstance3D.new()
	var slot_box := BoxMesh.new()
	slot_box.size = Vector3(0.012, 0.09, 0.012)
	slot.mesh = slot_box
	slot.position = Vector3(0.30, CHUTE_FLOOR_Y + 0.26, 0.522)
	slot.material_override = _mat_inner
	add_child(slot)
	var refund_btn := MeshInstance3D.new()
	var btn_sphere := SphereMesh.new()
	btn_sphere.radius = 0.022
	btn_sphere.height = 0.044
	btn_sphere.radial_segments = 20
	btn_sphere.rings = 10
	refund_btn.mesh = btn_sphere
	refund_btn.position = Vector3(0.30, CHUTE_FLOOR_Y + 0.36, 0.512)
	var btn_mat := StandardMaterial3D.new()
	btn_mat.albedo_color = Color(0.85, 0.22, 0.25)
	btn_mat.metallic = 0.2
	btn_mat.roughness = 0.35
	btn_mat.metallic_specular = 0.7
	refund_btn.material_override = btn_mat
	add_child(refund_btn)
	# 出货按钮面板（观察窗左侧）：两颗糖果色圆钮。
	for i in 2:
		var knob := MeshInstance3D.new()
		var knob_sphere := SphereMesh.new()
		knob_sphere.radius = 0.030
		knob_sphere.height = 0.060
		knob_sphere.radial_segments = 20
		knob_sphere.rings = 10
		knob.mesh = knob_sphere
		knob.position = Vector3(-0.42 + float(i) * 0.11, CHUTE_FLOOR_Y + 0.30, 0.512)
		var knob_mat := StandardMaterial3D.new()
		knob_mat.albedo_color = [Color(0.95, 0.62, 0.25), Color(0.35, 0.75, 0.55)][i]
		knob_mat.metallic = 0.15
		knob_mat.roughness = 0.3
		knob_mat.metallic_specular = 0.7
		knob.material_override = knob_mat
		add_child(knob)


## 灯光：罩内暖光顶灯 + 补光；入账判定 Area3D（洞内）。
func _build_lights() -> void:
	var lamp := OmniLight3D.new()
	lamp.position = Vector3(0.0, WALL_H - 0.15, 0.0)
	lamp.light_color = Color(1.0, 0.92, 0.75)
	lamp.light_energy = 2.4
	lamp.omni_range = 3.2
	lamp.shadow_enabled = false
	add_child(lamp)
	var fill := OmniLight3D.new()
	fill.position = Vector3(0.0, 0.7, 0.8)
	fill.light_color = Color(0.75, 0.85, 1.0)
	fill.light_energy = 0.7
	fill.omni_range = 2.6
	add_child(fill)
	# 取物口判定区：洞口下方一个小盒，娃娃物理落进去就入账。
	pit_area = Area3D.new()
	pit_area.name = "PitArea"
	pit_area.monitoring = true
	pit_area.collision_layer = 0
	pit_area.collision_mask = 1
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(PIT_RECT.size.x * 0.9, 0.30, PIT_RECT.size.y * 0.9)
	shape.shape = box
	pit_area.add_child(shape)
	pit_area.position = Vector3(PIT_RECT.get_center().x, -0.22, PIT_RECT.get_center().y)
	add_child(pit_area)
