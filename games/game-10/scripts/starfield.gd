extends Node2D
## 星空背景：确定性随机铺一层远景星点（极简几何，零外部资产）。
##
## 固定种子 → 同一画面可复现（门禁可复现原则）；只在 _ready 里生成一次数据，
## _draw 静态绘制，无逐帧成本。

## 远景星点数量。
const STAR_COUNT: int = 70
## 铺点种子（固定 = 画面可复现）。
const LAYOUT_SEED: int = 20261007

var _stars: Array[Dictionary] = []


func _ready() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = LAYOUT_SEED
	for i in STAR_COUNT:
		_stars.append({
			"pos": Vector2(rng.randf(), rng.randf()),
			"radius": rng.randf_range(0.8, 2.2),
			"alpha": rng.randf_range(0.25, 0.8),
		})
	queue_redraw()


func _draw() -> void:
	var size := get_viewport_rect().size
	for star in _stars:
		var pos: Vector2 = star["pos"] * size
		var color := Color(0.85, 0.9, 1.0, star["alpha"])
		draw_circle(pos, star["radius"], color)
