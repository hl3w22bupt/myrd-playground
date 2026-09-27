class_name Starfield
extends Node2D
## 星云背景：预生成 120 颗星（3 层视差 0.15 / 0.40 / 0.75）+ 低频云带，
## 随飞船当前速度向玩家方向滚动（知识基准 4.2；纯 _draw，无贴图资产）。

const PLAYFIELD_SIZE: Vector2 = Vector2(720.0, 1280.0)
const COLOR_BASE := Color("0b0b22")
const COLOR_BAND_A := Color("1b1040")
const COLOR_BAND_B := Color("122a4d")

## 3 层视差（知识基准 4.2：星云滚动系数 0.15 / 0.40 / 0.75，星星置最远）。
const LAYER_COEFFS: Array[float] = [0.15, 0.40, 0.75]
const LAYER_COUNTS: Array[int] = [60, 40, 20]
const LAYER_ALPHAS: Array[float] = [0.45, 0.6, 0.8]
const LAYER_SIZES: Array[float] = [1.2, 1.7, 2.2]

var _stars: Array[Dictionary] = []
var _bands: Array[Dictionary] = []
var _scroll: float = 0.0


func _ready() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 20260927  # 背景确定性：同版本同星图
	for layer: int in range(LAYER_COEFFS.size()):
		for i: int in range(LAYER_COUNTS[layer]):
			_stars.append({
				"x": rng.randf_range(0.0, PLAYFIELD_SIZE.x),
				"y": rng.randf_range(0.0, PLAYFIELD_SIZE.y),
				"coeff": LAYER_COEFFS[layer],
				"alpha": rng.randf_range(0.35, 1.0) * LAYER_ALPHAS[layer],
				"size": LAYER_SIZES[layer],
			})
	for i: int in range(4):
		_bands.append({
			"x": rng.randf_range(0.0, PLAYFIELD_SIZE.x),
			"y": rng.randf_range(0.0, PLAYFIELD_SIZE.y),
			"r": rng.randf_range(180.0, 320.0),
			"coeff": 0.4,
			"color": COLOR_BAND_A if i % 2 == 0 else COLOR_BAND_B,
		})


func _process(delta: float) -> void:
	if not GameState.game_over:
		_scroll += GameState.speed * delta
	queue_redraw()


func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, PLAYFIELD_SIZE), COLOR_BASE)
	## 云带：低透明度大椭圆（低频噪声的轻量替代，帧耗预算友好）。
	for band: Dictionary in _bands:
		var y := _wrapped(band["y"] + _scroll * float(band["coeff"]), -float(band["r"]), PLAYFIELD_SIZE.y + float(band["r"]))
		draw_circle(Vector2(band["x"], y), band["r"], Color(band["color"], 0.42))
	## 星星：1~2px 低透明度白点（避免与水晶混淆）。
	for star: Dictionary in _stars:
		var y := _wrapped(star["y"] + _scroll * float(star["coeff"]), 0.0, PLAYFIELD_SIZE.y)
		draw_circle(Vector2(star["x"], y), star["size"], Color(1.0, 1.0, 1.0, star["alpha"]))


func _wrapped(value: float, low: float, high: float) -> float:
	var span := high - low
	return low + fposmod(value - low, span)
