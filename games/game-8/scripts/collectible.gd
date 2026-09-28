class_name Collectible
extends Area2D
## 可收集物「青草垛」：定时/随机刷新在场地上的收集目标，带寿命限时。
##
## 规范要点（见 SKILL.md「信号方向单向」）：
## - 只 emit collected / expired 信号，不直接改分数、不持有 UI
##   （计数与回收在 main.gd 订阅侧完成，过期与收集是两条不同的信号路径）；
## - 生命周期由主场景管理（收到信号后 queue_free；补充刷新由生成器调度）。

## 被牛牛碰到时发出；参数是本体，订阅方可直接回收该节点。
signal collected(collectible: Collectible)
## 寿命耗尽未被收集时发出；订阅方回收该节点且不得计分（难度梯度的「错过惩罚」）。
signal expired(collectible: Collectible)

## 寿命（秒），由生成器在生成时按当前难度写入；<= 0 表示不限时。
## 存成成员而不是读 GameState：生成瞬间的难度快照，中途难度爬升不追溯已刷出的物品。
var lifetime: float = 0.0


## 剩余寿命（秒）；<= 0 表示已到期或不限时。供外部（UI/测试）判断物品是否濒临消失。
func remaining_lifetime() -> float:
	return lifetime - _age

## 已存活的秒数。
var _age: float = 0.0

@onready var _visual: Polygon2D = $Visual


func _ready() -> void:
	# Area2D 重叠回调：撞上来的是玩家拾取区（player_pickup 组）才算收集成功。
	area_entered.connect(_on_area_entered)


func _process(delta: float) -> void:
	if lifetime <= 0.0:
		return
	# 结算阶段（通关/失败）冻结寿命倒计时：重开重新铺场，不会残留过期误回收。
	if GameState.phase != GameState.Phase.RUNNING:
		return
	_age += delta
	var remaining: float = lifetime - _age
	if remaining <= 0.0:
		expired.emit(self)
		return
	if remaining <= GameState.LIFETIME_WARN_SECONDS:
		# 临期闪烁：alpha 呼吸提醒玩家这垛草快消失了。
		_visual.modulate.a = 0.4 + 0.6 * absf(sin(_age * TAU * 3.0))


func _on_area_entered(area: Area2D) -> void:
	if GameState.phase != GameState.Phase.RUNNING:
		return
	if not area.is_in_group("player_pickup"):
		return
	collected.emit(self)
