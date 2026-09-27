class_name Speedlines
extends Node2D
## 加速态屏周 speedline 拉丝（知识基准 4.2：青紫 #7FF6E8/#6C5CE7，
## 进入 0.3s、退出 0.5s 过渡；随飞船实际速度向下流动，强化速度感）。
##
## 纯 _draw 极简几何实现（SKILL.md §7A 资产策略），无贴图资产；
## 拉丝布局用固定种子生成，同版本视觉稳定。

const COLOR_A := Color("7ff6e8")
const COLOR_B := Color("6c5ce7")
const PLAYFIELD_SIZE: Vector2 = Vector2(720.0, 1280.0)
const VERTICAL_COUNT: int = 16    ## 左右屏边各 8 条纵向拉丝
const HORIZONTAL_COUNT: int = 10  ## 上下屏边各 5 条横向拉丝
const FADE_IN_SEC: float = 0.3
const FADE_OUT_SEC: float = 0.5
const EDGE_BAND_RATIO: float = 0.22  ## 拉丝集中在屏周 22% 宽度带
const FLOW_MUL: float = 3.0          ## 拉丝流速 = 世界速度 × 3（速度感外显）

var intensity: float = 0.0

var _boosting: bool = false  ## 加速态目标状态：区分「渐入中 intensity=0」与「退出播完」
var _vertical: Array[Dictionary] = []
var _horizontal: Array[Dictionary] = []
var _tween: Tween


func _ready() -> void:
	visible = false
	var rng := RandomNumberGenerator.new()
	rng.seed = 20260927  # 同版本同拉丝布局
	var band: float = PLAYFIELD_SIZE.x * EDGE_BAND_RATIO
	for i: int in range(VERTICAL_COUNT):
		var on_left := i % 2 == 0
		_vertical.append({
			"x": rng.randf_range(8.0, band) if on_left else rng.randf_range(PLAYFIELD_SIZE.x - band, PLAYFIELD_SIZE.x - 8.0),
			"y": rng.randf_range(-80.0, PLAYFIELD_SIZE.y),
			"len": rng.randf_range(90.0, 220.0),
			"alpha": rng.randf_range(0.25, 0.6),
			"width": rng.randf_range(1.5, 3.0),
			"color": COLOR_A if i % 3 == 0 else COLOR_B,
		})
	for i: int in range(HORIZONTAL_COUNT):
		var on_top := i % 2 == 0
		_horizontal.append({
			"y": rng.randf_range(8.0, PLAYFIELD_SIZE.y * EDGE_BAND_RATIO) if on_top \
				else rng.randf_range(PLAYFIELD_SIZE.y * (1.0 - EDGE_BAND_RATIO), PLAYFIELD_SIZE.y - 8.0),
			"x": rng.randf_range(-80.0, PLAYFIELD_SIZE.x),
			"len": rng.randf_range(60.0, 150.0),
			"alpha": rng.randf_range(0.18, 0.45),
			"width": rng.randf_range(1.2, 2.4),
			"color": COLOR_B if i % 3 == 0 else COLOR_A,
		})


## 加速态开关（main 订阅 GameState.boost_changed 后转发）：进 0.3s / 出 0.5s 过渡。
func set_boost(active: bool) -> void:
	_boosting = active
	if _tween != null and _tween.is_valid():
		_tween.kill()
	if active:
		visible = true
	_tween = create_tween()
	_tween.tween_property(self, "intensity", 1.0 if active else 0.0,
		FADE_IN_SEC if active else FADE_OUT_SEC)


func _process(delta: float) -> void:
	if not visible:
		return
	if not _boosting and intensity <= 0.0:
		visible = false  # 退出过渡播完即隐藏（冒烟可断言 visible）；渐入首帧不算退出
		queue_redraw()
		return
	var scroll: float = GameState.speed * FLOW_MUL * delta
	for streak: Dictionary in _vertical:
		streak["y"] = fposmod(float(streak["y"]) + scroll, PLAYFIELD_SIZE.y)
	var slide: float = GameState.speed * FLOW_MUL * delta * 0.6
	for streak: Dictionary in _horizontal:
		streak["x"] = fposmod(float(streak["x"]) + slide, PLAYFIELD_SIZE.x)
	queue_redraw()


func _draw() -> void:
	if intensity <= 0.0:
		return
	var stretch: float = 0.4 + 0.6 * intensity  # 拉丝长度随强度拉伸
	for streak: Dictionary in _vertical:
		var color: Color = streak["color"]
		color.a = float(streak["alpha"]) * intensity
		var y := float(streak["y"])
		draw_line(Vector2(float(streak["x"]), y), Vector2(float(streak["x"]), y + float(streak["len"]) * stretch), color, float(streak["width"]))
	for streak: Dictionary in _horizontal:
		var color: Color = streak["color"]
		color.a = float(streak["alpha"]) * intensity
		var x := float(streak["x"])
		draw_line(Vector2(x, float(streak["y"])), Vector2(x + float(streak["len"]) * stretch, float(streak["y"])), color, float(streak["width"]))
