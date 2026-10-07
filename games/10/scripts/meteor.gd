class_name Meteor
extends Area2D
## 流星（愿晶载体）：限时闪现的收集目标。
##
## 规则（需求固化）：
## - 单次闪现 lifetime 秒（调参区随机 3~5 秒，硬上界 5 秒），超时自动消失、愿晶计数不变；
## - 闪现期间可被收集：玩家角色触碰（body_entered）、点按热区（main.gd 派发）、许愿波（main.gd 派发）；
## - 收集结果只发信号（collected），计分与反馈由场景层订阅处理 —— 对象不持有 UI。
##
## 视觉全部代码构建（star 五角星 + 光晕圆），场景里只声明两个空 Polygon2D 容器，
## 避免手写大段 .tscn 几何数据（场景纪律：tscn 只做最小接线）。

## 收集成功（玩家触碰 / 点按 / 许愿波命中）。场景层订阅它计分 + 挂反馈。
signal collected(meteor: Meteor)

## 闪现超时自然消失（愿晶计数不变 —— 需求的「失手口径」之一）。
signal expired(meteor: Meteor)

## 单次闪现时长（秒）。由 main.gd 按调参区 [min, max] 随机赋值；冒烟测试可显式注入短时长。
var lifetime: float = 4.0

## 已存活时间（秒）。
var _age: float = 0.0
## 收集/超时后只结算一次的门闩。
var _settled: bool = false
## 视觉脉动相位。
var _pulse_t: float = 0.0

@onready var _visual: Polygon2D = $Visual
@onready var _glow: Polygon2D = $Glow


func _ready() -> void:
	_visual.polygon = _star_polygon(5, 22.0, 9.5)
	_glow.polygon = _circle_polygon(38.0, 24)
	body_entered.connect(_on_body_entered)
	# 出现瞬间淡入（闪现感由 main.gd 侧的出生缩放弹跳补足，这里只管透明度）。
	modulate.a = 0.0


func _physics_process(delta: float) -> void:
	if _settled:
		return
	_age += delta
	_pulse_t += delta
	# 脉动：光晕呼吸 + 星体轻微缩放（只动视觉子节点，不碰物理形状）。
	var pulse := 1.0 + 0.09 * sin(_pulse_t * 7.0)
	_visual.scale = Vector2.ONE * pulse
	_glow.scale = Vector2.ONE * (2.0 - pulse)
	# 生命周期透明度：前 0.25s 淡入，末 0.8s 淡出（「一闪即逝」的可读性）。
	var fade_in: float = clampf(_age / 0.25, 0.0, 1.0)
	var fade_out: float = clampf((lifetime - _age) / 0.8, 0.0, 1.0)
	modulate.a = minf(fade_in, fade_out)
	if _age >= lifetime:
		_expire()


## 收集结算：幂等（重复调用只生效一次），立即 freed 自身 —— 场景无残留元素。
func collect() -> void:
	if _settled:
		return
	_settled = true
	collected.emit(self)
	queue_free()


func _expire() -> void:
	if _settled:
		return
	_settled = true
	expired.emit(self)
	queue_free()


func _on_body_entered(body: Node2D) -> void:
	if body is Player:
		collect()


## 五角星顶点（外接半径 outer / 内接半径 inner，尖角朝上）。
func _star_polygon(points: int, outer: float, inner: float) -> PackedVector2Array:
	var vertices := PackedVector2Array()
	var total := points * 2
	for i in total:
		var angle := -PI / 2.0 + TAU * float(i) / float(total)
		var radius := outer if i % 2 == 0 else inner
		vertices.append(Vector2(cos(angle), sin(angle)) * radius)
	return vertices


## 正多边形逼近圆（光晕用）。
func _circle_polygon(radius: float, segments: int) -> PackedVector2Array:
	var vertices := PackedVector2Array()
	for i in segments:
		var angle := TAU * float(i) / float(segments)
		vertices.append(Vector2(cos(angle), sin(angle)) * radius)
	return vertices
