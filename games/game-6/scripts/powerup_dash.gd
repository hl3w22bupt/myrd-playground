class_name PowerupDash
extends PickupBox
## 冲刺坐骑道具（spec entity: powerup-dash）：dashDurationSeconds 内
## 速度 ×dashSpeedMultiplier、全程无敌、碰撞碾毁障碍得 30 分并吸附金币。

func _init() -> void:
	kind = KIND_DASH
