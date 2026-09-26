class_name Fruit
extends Area2D
## 水果（苹果 / 浆果）：外观不同、分值等价（同 +10，一期无稀有度 —— 知识 6e91a11d §二）。
##
## 被松鼠（Player）碰到 → 发 collected 信号并自毁；计分由 Main 经 GameState.add_score()
## 唯一入口处理，本节点不碰分数。

signal collected(fruit: Fruit)

## 0 = 苹果（红），1 = 浆果（紫）。由 FruitSpawner 随机赋值。
var kind: int = 0

## 外观半径（碰撞盒 12 = 视觉的 ~86%，收集判定比视觉略宽容）。
const PICK_RADIUS: float = 12.0

const KIND_COLORS: Array[Color] = [
	Color(0.86, 0.22, 0.18),  # 苹果红
	Color(0.55, 0.25, 0.72),  # 浆果紫
]

@onready var _visual: Polygon2D = $Visual


func _ready() -> void:
	if _visual != null:
		_visual.color = KIND_COLORS[clampi(kind, 0, KIND_COLORS.size() - 1)]
	body_entered.connect(_on_body_entered)


func _on_body_entered(body: Node2D) -> void:
	if body is Player:
		# 先发信号（订阅方读取本节点世界坐标做飘分），再自毁。
		collected.emit(self)
		queue_free()
