class_name Collectible
extends Area2D
## 可收集物（v3 多类型）：青草垛 / 金铃铛 / 时钟 / 磁铁 / 加速，随机刷新、带寿命限时。
##
## 规范要点（见 SKILL.md「信号方向单向」）：
## - 只 emit collected / expired 信号，不直接改分数、不持有 UI
##   （计分与回收在 main.gd 订阅侧完成，过期与收集是两条不同的信号路径）；
## - 类型（kind）由生成器在 add_child 之前写好，_ready 按 kind 套造型与配色；
## - 生命周期由主场景管理（收到信号后 queue_free；补充刷新由生成器调度）。

## 被牛牛碰到时发出；参数是本体，订阅方可直接回收该节点。
signal collected(collectible: Collectible)
## 寿命耗尽未被收集时发出；订阅方回收该节点且不得计分（难度梯度的「错过惩罚」）。
signal expired(collectible: Collectible)

## 类型专属配色（v3 画面升级：每类目标物专属造型；main.gd 粒子/飘字同色呼应）。
const KIND_COLORS: Dictionary = {
	"normal": Color(0.55, 0.8, 0.3, 1),    # 青草垛：草绿
	"rare": Color(1.0, 0.82, 0.25, 1),     # 金铃铛：亮金
	"clock": Color(0.45, 0.75, 1.0, 1),    # 时钟：天蓝
	"magnet": Color(0.9, 0.4, 0.75, 1),    # 磁铁：品红
	"boost": Color(0.35, 0.9, 0.85, 1),    # 加速：青碧
}
## 类型专属造型（局部坐标多边形，半径 ~14px，与 CollisionShape2D 圆 r=14 匹配）。
## ⚠️ v5 修复（线上 A 缺陷根因）：不能用 static var 持有 PackedVector2Array 字面量——
## Godot 4.3 Web 导出（bytecode）下 static var 的 packed array 初始化数据会整体丢失
## （size 保留、坐标全 (0,0)），物品画成退化多边形 = 线上「零刷出」假象，
## 而 headless/桌面正常（门禁全绿盲区）。改为 static func 内字面量构造，运行时逐点建数组，
## Web 与桌面行为一致（2026-10 线上复验：像素检测物品可见）。
static func kind_polygon(kind: String) -> PackedVector2Array:
	# match 分支用字符串字面量比较：GDScript 的 match 标识符模式是「绑定新变量」，
	# 写常量名不会按常量值匹配（与 KIND_* 常量同值的字面量在此等价且直观）。
	match kind:
		"rare":
			return PackedVector2Array([
				Vector2(0, -14), Vector2(4, -5), Vector2(13, -4), Vector2(6, 2),
				Vector2(9, 12), Vector2(0, 6), Vector2(-9, 12), Vector2(-6, 2),
				Vector2(-13, -4), Vector2(-4, -5),
			])
		"clock":
			return PackedVector2Array([
				Vector2(-6, -12), Vector2(6, -12), Vector2(12, -6), Vector2(12, 6),
				Vector2(6, 12), Vector2(-6, 12), Vector2(-12, 6), Vector2(-12, -6),
			])
		"magnet":
			return PackedVector2Array([
				Vector2(-10, -12), Vector2(-4, -12), Vector2(-4, 2), Vector2(4, 2),
				Vector2(4, -12), Vector2(10, -12), Vector2(10, 0), Vector2(4, 10),
				Vector2(-4, 10), Vector2(-10, 0),
			])
		"boost":
			return PackedVector2Array([
				Vector2(2, -14), Vector2(10, -4), Vector2(4, -4), Vector2(8, 8),
				Vector2(-6, 14), Vector2(-2, 2), Vector2(-9, 2), Vector2(-5, -8),
			])
		_:
			return PackedVector2Array([
				Vector2(-12, 0), Vector2(0, -12), Vector2(12, 0), Vector2(0, 12),
			])

## 类型（normal / rare / clock / magnet / boost）；由生成器在实例化后、入树前写入。
var kind: String = "normal"
## 寿命（秒），由生成器在生成时按当前难度写入；<= 0 表示不限时。
## 存成成员而不是读 GameState：生成瞬间的难度快照，中途难度爬升不追溯已刷出的物品。
var lifetime: float = 0.0

## 已存活的秒数。
var _age: float = 0.0

@onready var _visual: Polygon2D = $Visual


## 剩余寿命（秒）；<= 0 表示已到期或不限时。供外部（UI/测试）判断物品是否濒临消失。
func remaining_lifetime() -> float:
	return lifetime - _age


## 呼吸动画的当前缩放（待机动效：1 ±0.08 正弦呼吸；供测试/调试观测）。
func breathing_scale() -> float:
	return 1.0 + 0.08 * sin(_age * TAU * 1.5)


func _ready() -> void:
	_apply_kind_visual()
	# Area2D 重叠回调：撞上来的是玩家拾取区（player_pickup 组）才算收集成功。
	area_entered.connect(_on_area_entered)


## 按类型套配色与造型（v3 画面升级②：专属造型；set_defer 兼容入树前调用）。
func _apply_kind_visual() -> void:
	_visual.color = KIND_COLORS.get(kind, KIND_COLORS["normal"])
	_visual.polygon = kind_polygon(kind)


func _process(delta: float) -> void:
	_age += delta
	if lifetime <= 0.0:
		return
	# 结算阶段（通关/失败）冻结寿命倒计时：重开重新铺场，不会残留过期误回收。
	if GameState.phase != GameState.Phase.RUNNING:
		return
	var remaining: float = lifetime - _age
	if remaining <= 0.0:
		expired.emit(self)
		return
	if remaining <= GameState.LIFETIME_WARN_SECONDS:
		# 临期闪烁：alpha 呼吸提醒玩家这个目标快消失了。
		_visual.modulate.a = 0.4 + 0.6 * absf(sin(_age * TAU * 3.0))
	else:
		# 待机呼吸：每类目标物都有轻微缩放脉动（v3 画面升级②的待机动效）。
		_visual.scale = Vector2.ONE * breathing_scale()


func _on_area_entered(area: Area2D) -> void:
	if GameState.phase != GameState.Phase.RUNNING:
		return
	if not area.is_in_group("player_pickup"):
		return
	collected.emit(self)
