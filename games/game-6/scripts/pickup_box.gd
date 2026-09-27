class_name PickupBox
extends Area2D
## 道具盒基类（spec entity: powerup-*）：碰到玩家 → 发 collected(kind)；
## 主场景订阅后调 player.apply_powerup(kind)。盒体浮动 + 文字图标（中文走全局字体）。
##
## 规范要点：发布方只 emit，不直接改玩家状态；对象池复用（reset_pickup，不 queue_free）。

const KIND_MAGNET := &"magnet"
const KIND_SHIELD := &"shield"
const KIND_DASH := &"dash"

## 道具种类 → 文字图标与主题色（策划案 palette：coin 金 / accent 红 / 天蓝）。
const KIND_STYLE: Dictionary = {
	&"magnet": {"glyph": "磁", "color": Color(0.95, 0.42, 0.45, 1.0)},
	&"shield": {"glyph": "盾", "color": Color(0.4, 0.75, 1.0, 1.0)},
	&"dash": {"glyph": "冲", "color": Color(1.0, 0.79, 0.24, 1.0)},
}

## 拾取后发出（主场景订阅 → player.apply_powerup + 反馈）。
signal collected(kind: StringName)

## 道具种类（子类在 _init 里钉死；场景不另设属性，避免接线不一致）。
var kind: StringName = KIND_MAGNET

## 是否已被拾取（池化复位用）。
var _collected: bool = false
var _bob_phase: float = 0.0

@onready var _body: Polygon2D = $Body
@onready var _glyph: Label = $Glyph


func _ready() -> void:
	body_entered.connect(_on_body_entered)
	_bob_phase = randf() * TAU
	_apply_style()


func _process(delta: float) -> void:
	if _collected:
		return
	_bob_phase += delta * 3.0
	position.y += sin(_bob_phase) * 12.0 * delta
	_body.rotation += delta * 0.8


## 拾取（幂等）：停监测要在物理帧末（set_deferred），避免在物理回调里改物理态。
func collect() -> void:
	if _collected:
		return
	_collected = true
	set_deferred("monitoring", false)
	visible = false
	collected.emit(kind)


## 对象池复位（track_builder 循环 chunk 实例时调用）。
func reset_pickup() -> void:
	_collected = false
	visible = true
	set_deferred("monitoring", true)


func _on_body_entered(body: Node2D) -> void:
	if _collected:
		return
	if body is Player:
		(body as Player).apply_powerup(kind)
		GameState.emit_feedback(StringName("powerup_%s" % kind), global_position)
		collect()


func _apply_style() -> void:
	var style: Dictionary = KIND_STYLE.get(kind, {"glyph": "?", "color": Color(1, 1, 1, 1)})
	_body.color = style["color"]
	_glyph.text = String(style["glyph"])
