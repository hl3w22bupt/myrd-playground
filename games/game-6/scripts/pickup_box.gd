class_name PickupBox
extends Area2D
## 道具盒基类（spec entity: powerup-*）：碰到玩家 → 发 collected(kind)；
## 主场景订阅后调 player.apply_powerup(kind)。
##
## 迭代需求 ① 全链路可见：
## - 场上出现：三种道具各有独立剪影（磁铁 = 马蹄 U 形 / 护盾 = 盾形 / 冲刺 = 闪电），
##   描边 + 呼吸光环 + 出场弹跳，与金币（小金圆）一眼区分；
## - 拾取瞬间：FxBank 闪光 + SfxBank 音效 + HUD 图标点亮（HUD 侧在 hud.gd）三者同时发生；
## - 生成池：种类不再 build 时锁死 —— track_builder 每次铺设按 GameState.POWERUP_KIND_WEIGHTS
##   seeded 重掷（reroll_kind），磁铁/冲刺按可感知概率循环出现。
##
## 规范要点：发布方只 emit，不直接改玩家状态；对象池复用（reset_pickup，不 queue_free）。

const KIND_MAGNET := &"magnet"
const KIND_SHIELD := &"shield"
const KIND_DASH := &"dash"

## 种类 → 文案/主题色/描边色/剪影（迭代需求 ①：更亮、更饱和，与提亮后的场景同一色系）。
const KIND_STYLE: Dictionary = {
	&"magnet": {
		"glyph": "磁", "color": Color(1.0, 0.42, 0.48, 1.0),
		"outline": Color(0.48, 0.1, 0.16, 1.0),
		"sfx": &"powerup",
	},
	&"shield": {
		"glyph": "盾", "color": Color(0.38, 0.8, 1.0, 1.0),
		"outline": Color(0.1, 0.32, 0.58, 1.0),
		"sfx": &"shield",
	},
	&"dash": {
		"glyph": "冲", "color": Color(1.0, 0.82, 0.22, 1.0),
		"outline": Color(0.56, 0.36, 0.04, 1.0),
		"sfx": &"dash",
	},
}

## 拾取后发出（主场景订阅 → player.apply_powerup + 反馈）。
signal collected(kind: StringName)

## 道具种类（子类在 _init 里钉死；池化重掷经 reroll_kind 更新）。
var kind: StringName = KIND_MAGNET

## 是否已被拾取（池化复位用）。
var _collected: bool = false
var _bob_phase: float = 0.0
## 光环呼吸相位。
var _halo_phase: float = 0.0

@onready var _body: Polygon2D = $Body
@onready var _glyph: Label = $Glyph

## 运行时拼装的描边层与光环层（z_index 负值垫底，压在 Body 后面）。
var _outline: Polygon2D = null
var _halo: Line2D = null


func _ready() -> void:
	body_entered.connect(_on_body_entered)
	_bob_phase = randf() * TAU
	_build_decor_layers()
	_apply_style()


func _process(delta: float) -> void:
	if _collected:
		return
	_bob_phase += delta * 3.0
	position.y += sin(_bob_phase) * 12.0 * delta
	_body.rotation += delta * 0.8
	_halo_phase += delta * 4.0
	if _halo != null:
		# 呼吸光环：半径与透明度同相脉动（「出现瞬间即可辨识」的第二重提示）。
		var pulse: float = 0.5 + 0.5 * sin(_halo_phase)
		_halo.scale = Vector2.ONE * (1.08 + pulse * 0.22)
		var style: Dictionary = KIND_STYLE.get(kind, KIND_STYLE[&"magnet"])
		var base: Color = style["color"]
		_halo.default_color = Color(base.r, base.g, base.b, 0.28 + pulse * 0.42)


## 池化重掷种类（track_builder 每次铺设调用，权重见 GameState.POWERUP_KIND_WEIGHTS）。
func reroll_kind(new_kind: StringName) -> void:
	if _collected or new_kind == &"" or new_kind == kind:
		return
	kind = new_kind
	if _body != null:
		_apply_style()


## 拾取（幂等）：闪光 + 音效与「拾取成功」同帧发生（HUD 点亮由 player.powerup_changed 驱动）。
func collect() -> void:
	if _collected:
		return
	_collected = true
	set_deferred("monitoring", false)
	visible = false
	var style: Dictionary = KIND_STYLE.get(kind, KIND_STYLE[&"magnet"])
	FxBank.flash(get_parent(), global_position, style["color"], StringName("pickup_%s" % kind))
	SfxBank.play(style["sfx"], get_parent())
	collected.emit(kind)


## 对象池复位（track_builder 循环 chunk 实例时调用）：重现 + 出场弹跳。
func reset_pickup() -> void:
	_collected = false
	visible = true
	set_deferred("monitoring", true)
	scale = Vector2.ONE * 0.2
	var tween := create_tween()
	tween.tween_property(self, "scale", Vector2.ONE, 0.28) \
		.set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_BACK)


func _on_body_entered(body: Node2D) -> void:
	if _collected:
		return
	if body is Player:
		(body as Player).apply_powerup(kind)
		GameState.emit_feedback(StringName("powerup_%s" % kind), global_position)
		collect()


## 按种类套用剪影/配色/描边/文字（reroll 与首次 build 共用这一份）。
func _apply_style() -> void:
	var style: Dictionary = KIND_STYLE.get(kind, KIND_STYLE[&"magnet"])
	_body.color = style["color"]
	_body.polygon = _silhouette_of(kind)
	_glyph.text = String(style["glyph"])
	if _outline != null:
		_outline.color = style["outline"]
		_outline.polygon = _silhouette_of(kind)
	if _halo != null:
		var base: Color = style["color"]
		_halo.default_color = Color(base.r, base.g, base.b, 0.6)


## 种类 → 独立剪影（约 40px 盒，局部原点居中；三者一眼可区分）。
func _silhouette_of(kind_name: StringName) -> PackedVector2Array:
	match kind_name:
		KIND_MAGNET:
			# 马蹄磁铁：开口向上的 U 形（外弧 + 内弧）。
			return PackedVector2Array([
				Vector2(-17, -18), Vector2(-9, -18), Vector2(-9, 2), Vector2(-6, 9),
				Vector2(0, 12), Vector2(6, 9), Vector2(9, 2), Vector2(9, -18),
				Vector2(17, -18), Vector2(17, 6), Vector2(10, 15), Vector2(0, 18),
				Vector2(-10, 15), Vector2(-17, 6),
			])
		KIND_SHIELD:
			# 盾形：上宽下尖。
			return PackedVector2Array([
				Vector2(-15, -15), Vector2(15, -15), Vector2(15, 2),
				Vector2(0, 17), Vector2(-15, 2),
			])
		KIND_DASH:
			# 闪电：经典锯齿折线。
			return PackedVector2Array([
				Vector2(-2, -19), Vector2(12, -19), Vector2(3, -3), Vector2(13, -3),
				Vector2(-9, 19), Vector2(-3, 1), Vector2(-13, 1),
			])
		_:
			return PackedVector2Array([
				Vector2(-14, -14), Vector2(14, -14), Vector2(14, 14), Vector2(-14, 14),
			])


## 运行时拼装描边层（z=-1）与光环层（z=-2）：均在 Body 后面，Glyph 保持最上。
func _build_decor_layers() -> void:
	_outline = Polygon2D.new()
	_outline.name = "Outline"
	_outline.z_index = -1
	_outline.scale = Vector2.ONE * 1.22
	add_child(_outline)
	_halo = Line2D.new()
	_halo.name = "Halo"
	_halo.z_index = -2
	_halo.width = 4.0
	var points := PackedVector2Array()
	for i: int in 18:
		var angle: float = TAU * float(i) / 18.0
		points.append(Vector2(cos(angle), sin(angle)) * 27.0)
	_halo.points = points
	add_child(_halo)
