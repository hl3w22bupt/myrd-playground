class_name Fruit
extends Area2D
## 水果四类（迭代：金水果 / 坏水果 —— 用户反馈「金水果高分 / 坏水果扣分减速」）：
## - 0 苹果（红）/ 1 浆果（紫）：普通水果，+10、参与连击（知识 6e91a11d §二基线）；
## - 2 金水果（金）：稀有高分，固定 +golden_points（不吃连击加成，仍刷新连击窗口）；
## - 3 坏水果（褐）：惩罚，-bad_penalty 且让松鼠短暂减速；不计水果数、不动连击。
##
## 被松鼠（Player）碰到 → 发 collected 信号并自毁；计分由 Main 经 GameState
## 唯一入口处理（add_score / add_golden_score / apply_bad_fruit），本节点不碰分数。

signal collected(fruit: Fruit)

## 种类 id：与 FruitSpawner 的加权抽取、KIND_COLORS 下标一致。
const KIND_APPLE: int = 0
const KIND_BERRY: int = 1
const KIND_GOLDEN: int = 2
const KIND_BAD: int = 3

## 0 = 苹果（红），1 = 浆果（紫），2 = 金水果（金），3 = 坏水果（腐褐）。
var kind: int = 0

## 外观半径（碰撞盒 12 = 视觉的 ~86%，收集判定比视觉略宽容）。
const PICK_RADIUS: float = 12.0

const KIND_COLORS: Array[Color] = [
	Color(0.86, 0.22, 0.18),  # 苹果红
	Color(0.55, 0.25, 0.72),  # 浆果紫
	Color(1.0, 0.78, 0.15),   # 金水果
	Color(0.42, 0.3, 0.18),   # 坏水果（腐褐）
]

## 分值表：金水果基础分（连击加成在 GameState.add_score 里按同规则叠加）。
const GOLDEN_POINTS: int = 50

## kind 用 setter：冒烟断言可在运行期改类型（连视觉一起刷新），实现与断言同口径。
var kind: int = KIND_APPLE:
	set(value):
		kind = clampi(value, KIND_APPLE, KIND_BAD)
		if is_node_ready():
			_apply_visual()

## 本水果的基础分（坏水果返回 0 —— 惩罚路径不走这里）。
func points_value() -> int:
	return GOLDEN_POINTS if kind == KIND_GOLDEN else GameState.BASE_POINTS


func is_bad() -> bool:
	return kind == KIND_BAD


@onready var _visual: Polygon2D = $Visual


func _ready() -> void:
	if _visual != null:
		_visual.color = KIND_COLORS[clampi(kind, 0, KIND_COLORS.size() - 1)]
		# 金水果视觉放大 1.3×（远看可辨「值得冒险」）；坏水果缩小 0.85×（看着就该躲）。
		if is_golden():
			_visual.scale = Vector2(1.3, 1.3)
		elif is_bad():
			_visual.scale = Vector2(0.85, 0.85)
	body_entered.connect(_on_body_entered)


func is_golden() -> bool:
	return kind == KIND_GOLDEN


func is_bad() -> bool:
	return kind == KIND_BAD


func _on_body_entered(body: Node2D) -> void:
	if body is Player:
		# 先发信号（订阅方读取本节点世界坐标做飘分），再自毁。
		collected.emit(self)
		queue_free()
