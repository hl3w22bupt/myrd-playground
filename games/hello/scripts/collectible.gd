class_name Collectible
extends Area2D
## 收集物：玩家（CharacterBody2D）碰到即被收集。
##
## 规范要点（见 SKILL.md「GDScript 规范」「信号方向单向」）：
## - 只 emit 信号（collected），不持有 UI 节点；计分与胜负由 GameState 承担；
## - 信号连接写在 _ready()，集中可见、可被 preflight 静态核对（P8/P12）；
## - 收集 = 先 emit 再 queue_free（整节点移出物理世界）。**不要**用「关 monitoring 留节点」
##   的方式做收集：重开时再把 monitoring 打开会带着旧的重叠状态，与玩家残留重叠会被
##   瞬间重复收集（冒烟实测：重开后分数变 1、收集物仍失活）。重开由 Main 重新实例化。

## 被玩家收集时发出；参数是收集物编号（Main 场景订阅它来计分）。
signal collected(id: int)

## 收集物编号（0..3）：场景摆放顺序即编号，重开时 Main 按编号在原位重新实例化。
@export var id: int = 0

var _active: bool = true


func _ready() -> void:
	add_to_group("collectibles")
	if not body_entered.is_connected(_on_body_entered):
		body_entered.connect(_on_body_entered)


## 是否仍可被收集（收集后节点随即销毁，此标记用于同帧去重）。
func is_active() -> bool:
	return _active


## 收集：广播编号（计分）并销毁自身。
func collect() -> void:
	if not _active:
		return
	_active = false
	collected.emit(id)
	queue_free()


func _on_body_entered(_body: Node2D) -> void:
	collect()
