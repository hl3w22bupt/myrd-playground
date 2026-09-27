class_name Fruit
extends Area2D
## 水果（迭代反馈 3：类型分化，计分仍收口 GameState.add_score / apply_penalty 唯一入口）：
##   KIND_APPLE / KIND_BERRY  普通水果，+10（需求口径），连击加成照常；
##   KIND_GOLDEN              金水果，+50 高分（掉落率低，风险收益目标）；
##   KIND_BAD                 坏水果，扣分 + 减速 debuff（不进连击、不计水果数）。
##
## 被松鼠（Player）碰到 → 发 collected 信号并自毁；计分与惩罚由 Main 依据类型分流，
## 本节点不碰分数 —— 与知识 6e91a11d §三「计分唯一入口」一致。

signal collected(fruit: Fruit)

const KIND_APPLE: int = 0
const KIND_BERRY: int = 1
const KIND_GOLDEN: int = 2
const KIND_BAD: int = 3

## 外观半径（碰撞盒 12 = 视觉的 ~86%，收集判定比视觉略宽容）。
const PICK_RADIUS: float = 12.0

const KIND_COLORS: Array[Color] = [
	Color(0.86, 0.22, 0.18),  # 苹果红
	Color(0.55, 0.25, 0.72),  # 浆果紫
	Color(1.0, 0.82, 0.15),   # 金水果（亮金）
	Color(0.42, 0.5, 0.28),   # 坏水果（腐坏灰绿）
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
	_apply_visual()
	body_entered.connect(_on_body_entered)


## 类型 → 外观：颜色 + 金水果放大（醒目）、坏水果缩小并转半圈（区别于可收目标）。
func _apply_visual() -> void:
	if _visual == null:
		return
	_visual.color = KIND_COLORS[clampi(kind, 0, KIND_COLORS.size() - 1)]
	match kind:
		KIND_GOLDEN:
			_visual.scale = Vector2(1.2, 1.2)
			_visual.rotation = 0.0
		KIND_BAD:
			_visual.scale = Vector2(0.9, 0.9)
			_visual.rotation = PI / 4.0
		_:
			_visual.scale = Vector2.ONE
			_visual.rotation = 0.0


func _on_body_entered(body: Node2D) -> void:
	if body is Player:
		# 先发信号（订阅方读取本节点世界坐标做飘分），再自毁。
		collected.emit(self)
		queue_free()
