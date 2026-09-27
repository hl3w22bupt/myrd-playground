class_name Starfield
extends Node2D
## 星云背景：低亮度低饱和深空底（L*≈20）+ 暗紫/暗蓝云带 + 两层视差星点，
## 滚动速度 = 当前实际速度（需求验收 1：场景按当前速度持续滚动）。
## 配色出自调研结论（底 #0B0B22 / 云带 #1B1040、#122A4D），星点 1~2px 低透明度白，
## 避免高亮星点被误判为水晶。

const BAND_HEIGHT: float = 150.0
const BAND_ALPHA: float = 0.45
const BAND_PARALLAX: float = 0.3

var _scroll: float = 0.0
var _stars: Array[Dictionary] = []
var _bands: Array[Dictionary] = []
var _rng := RandomNumberGenerator.new()


func _ready() -> void:
	_rng.seed = 20260927
	var size := get_viewport_rect().size
	var count := int(GameState.config["visual"]["starCount"])
	for i in count:
		_stars.append({
			"pos": Vector2(_rng.randf_range(0.0, size.x), _rng.randf_range(0.0, size.y)),
			"radius": _rng.randf_range(0.6, 1.8),
			"alpha": _rng.randf_range(0.25, 0.7),
			"depth": _rng.randf_range(0.35, 1.0),
		})
	_bands = [
		{"color": Color(str(GameState.config["visual"]["band1"])), "y": size.y * 0.18},
		{"color": Color(str(GameState.config["visual"]["band2"])), "y": size.y * 0.62},
		{"color": Color(str(GameState.config["visual"]["band1"])), "y": size.y * 1.02},
	]


func _process(delta: float) -> void:
	_scroll += GameState.speed() * delta
	queue_redraw()


func _draw() -> void:
	var size := get_viewport_rect().size
	draw_rect(Rect2(Vector2.ZERO, size), Color(str(GameState.config["visual"]["bg"])))
	var span: float = size.y + BAND_HEIGHT
	for band: Dictionary in _bands:
		var y := fposmod(float(band["y"]) + _scroll * BAND_PARALLAX, span) - BAND_HEIGHT
		var tint: Color = band["color"]
		tint.a = BAND_ALPHA
		draw_rect(Rect2(0.0, y, size.x, BAND_HEIGHT), tint)
	for star: Dictionary in _stars:
		var pos: Vector2 = star["pos"]
		var y := fposmod(pos.y + _scroll * float(star["depth"]), size.y)
		draw_circle(Vector2(pos.x, y), float(star["radius"]), Color(1, 1, 1, float(star["alpha"])))
