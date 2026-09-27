class_name PowerupShield
extends PickupBox
## 护盾道具（spec entity: powerup-shield）：抵挡一次碰撞（坠坑除外），
## 触发后 hurtInvincibleSeconds 无敌帧（破盾表现由 player.hit_hazard() 裁决）。

func _init() -> void:
	kind = KIND_SHIELD
