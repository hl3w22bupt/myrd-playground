class_name Coin
extends Area2D
## 金币拾取区：被玩家碰到 → 隐藏并停用；重开时对象池式复位（不 queue_free，
## 保证每次重开的金币布局完全一致，也符合策划案 §七.5 的池化要求）。

const SPIN_SPEED: float = 3.0

var _collected: bool = false


func _process(delta: float) -> void:
	if not _collected:
		rotation += SPIN_SPEED * delta


## 拾取：幂等；停用监测要在物理帧末（set_deferred），避免在 area 回调里改物理态。
func collect() -> void:
	if _collected:
		return
	_collected = true
	set_deferred("monitoring", false)
	visible = false


## 重开复位：恢复可见与监测。
func reset_coin() -> void:
	_collected = false
	visible = true
	set_deferred("monitoring", true)
