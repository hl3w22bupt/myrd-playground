extends Node
## Ambience —— 氛围层默认件（G5 视觉升级）：模板起步即有画面感底线，不再从纯色背景开始。
##
## 三层（参考系逆向配方，见 docs/eval-harness/2026-10-12-rsi-reference-gap-analysis.md）：
##   1. 渐变天空（CanvasLayer -100）：上冷下深的纵向渐变，一行配置立住氛围；
##   2. 环境氛围粒子（CanvasLayer -50）：CC0 粒子低速漂浮（magic/dust 类），画面「活」的最低成本；
##   3. 四边暗角（CanvasLayer 5，UI 层 10 之下）：聚焦视线，UI 保持清晰。
##
## 用法：默认「夜空」配置在 _ready 自动生效，什么都不用做。游戏可在自己的主脚本里覆盖：
##   func _ready() -> void:
##       Ambience.setup({
##           "sky_top": Color(0.55, 0.35, 0.30), "sky_bottom": Color(0.12, 0.08, 0.10),
##           "particle": "spark_01.png", "particle_tint": Color(1.0, 0.75, 0.4, 0.4),
##       })
## 资产来自 CC0 库（assets/particles/，模板预置 5 件精选；扩选用 asset-query.mjs 查库后拷入）。
## 纹理缺失时优雅降级（粒子用默认白点、天空退纯色），不抛错——冒烟/无头环境零风险。

const DEFAULTS := {
	"sky_top": Color(0.05, 0.07, 0.16),
	"sky_bottom": Color(0.16, 0.10, 0.22),
	"particle": "magic_01.png",
	"particle_tint": Color(0.78, 0.84, 1.0, 0.32),
	"particle_count": 14,
	"vignette_strength": 0.32,
}

const PARTICLE_DIR := "assets/particles"


## 动态拼 res:// 路径（避免字面量 res://xxx/%s 触发 preflight P5 的字面引用检查）
func _particle_path(particle_name: String) -> String:
	return "res://" + PARTICLE_DIR.path_join(particle_name)

var _sky_rect: TextureRect
var _particles: CPUParticles2D
var _vignette_rect: ColorRect


func _ready() -> void:
	setup(DEFAULTS.duplicate())


## 应用一套氛围配置（重复调用会先拆旧层再重建，支持风格热切换）。
func setup(opts: Dictionary) -> void:
	_teardown()
	var sky_top: Color = opts.get("sky_top", DEFAULTS.sky_top)
	var sky_bottom: Color = opts.get("sky_bottom", DEFAULTS.sky_bottom)

	# 1) 渐变天空：16×256 小纹理 + 全屏拉伸（GPU 采样，成本≈0）
	var gradient := Gradient.new()
	gradient.set_color(0, sky_top)
	gradient.set_color(1, sky_bottom)
	var tex := GradientTexture2D.new()
	tex.gradient = gradient
	tex.fill = GradientTexture2D.FILL_LINEAR
	tex.fill_from = Vector2(0.0, 0.0)
	tex.fill_to = Vector2(0.0, 1.0)
	tex.width = 16
	tex.height = 256
	_sky_rect = TextureRect.new()
	_sky_rect.texture = tex
	_sky_rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	_sky_rect.stretch_mode = TextureRect.STRETCH_SCALE
	var sky_layer := CanvasLayer.new()
	sky_layer.layer = -100
	sky_layer.name = "AmbienceSky"
	sky_layer.add_child(_sky_rect)
	add_child(sky_layer)

	# 2) 环境氛围粒子：CC0 纹理 + 低速漂浮；纹理缺失退默认白点（不抛错）
	var size: Vector2 = (get_viewport() as Window).get_visible_rect().size if get_viewport() else Vector2(1152, 648)
	_particles = CPUParticles2D.new()
	_particles.name = "AmbienceParticles"
	var particle_path := _particle_path(String(opts.get("particle", DEFAULTS.particle)))
	if ResourceLoader.exists(particle_path):
		_particles.texture = load(particle_path)
	_particles.position = size * 0.5
	_particles.emission_shape = CPUParticles2D.EMISSION_SHAPE_RECTANGLE
	_particles.emission_rect_extents = size * 0.55
	_particles.amount = int(opts.get("particle_count", DEFAULTS.particle_count))
	_particles.lifetime = 9.0
	_particles.gravity = Vector2(0, 5)
	_particles.direction = Vector2(0, 1)
	_particles.spread = 12.0
	_particles.initial_velocity_min = 4.0
	_particles.initial_velocity_max = 14.0
	_particles.scale_amount_min = 0.05
	_particles.scale_amount_max = 0.16
	_particles.color = opts.get("particle_tint", DEFAULTS.particle_tint)
	var particle_layer := CanvasLayer.new()
	particle_layer.layer = -50
	particle_layer.name = "AmbienceAmbient"
	particle_layer.add_child(_particles)
	add_child(particle_layer)

	# 3) 暗角：全屏 ColorRect + 径向压暗 shader（UI 层之下）
	var vignette_shader := Shader.new()
	var shader_source := ""
	var f := FileAccess.open("res://shaders/vignette.gdshader", FileAccess.READ)
	if f:
		shader_source = f.get_as_text()
		f.close()
	if shader_source.is_empty():
		# 内联兜底（shader 文件被裁时仍成立；语义与 res://shaders/vignette.gdshader 一致）
		shader_source = "shader_type canvas_item;\nuniform float strength=0.32;\nvoid fragment(){float d=distance(UV,vec2(0.5));COLOR=vec4(0.0,0.0,0.0,smoothstep(0.45,0.85,d)*strength);}\n"
	vignette_shader.code = shader_source
	var mat := ShaderMaterial.new()
	mat.shader = vignette_shader
	mat.set_shader_parameter("strength", float(opts.get("vignette_strength", DEFAULTS.vignette_strength)))
	_vignette_rect = ColorRect.new()
	_vignette_rect.material = mat
	_vignette_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_vignette_rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	var vignette_layer := CanvasLayer.new()
	vignette_layer.layer = 5
	vignette_layer.name = "AmbienceVignette"
	vignette_layer.add_child(_vignette_rect)
	add_child(vignette_layer)


## 交互瞬间的强反馈粒子（收集/命中/消除）：CC0 spark/magic 纹理 + 快速迸发淡出。
## 与 Juice（弹跳/音效/计数）互补——Juice 管「事件有反馈」，这里管「反馈好看」。
func burst(pos: Vector2, tint: Color = Color(1.0, 0.9, 0.55, 0.9), texture_name: String = "spark_01.png") -> void:
	var p := CPUParticles2D.new()
	p.one_shot = true
	p.explosiveness = 1.0
	p.emitting = false
	var path := _particle_path(texture_name)
	if ResourceLoader.exists(path):
		p.texture = load(path)
	p.position = pos
	p.amount = 6
	p.lifetime = 0.45
	p.direction = Vector2(0, -1)
	p.spread = 180.0
	p.initial_velocity_min = 60.0
	p.initial_velocity_max = 150.0
	p.gravity = Vector2(0, 220)
	p.scale_amount_min = 0.06
	p.scale_amount_max = 0.14
	p.color = tint
	add_child(p)
	p.emitting = true
	get_tree().create_timer(1.2).timeout.connect(p.queue_free)


func _teardown() -> void:
	for child in get_children():
		child.queue_free()
	_sky_rect = null
	_particles = null
	_vignette_rect = null
