class_name PowerupMagnet
extends PickupBox
## 磁铁道具（spec entity: powerup-magnet）：拾取后 magnetDurationSeconds 内
## 把 magnetRadiusPx 范围内金币吸向玩家（吸附逻辑在 coin.gd，经 Player.is_attracting()）。

func _init() -> void:
	kind = KIND_MAGNET
