class_name Player
extends CharacterBody2D
## 玩家角色「牛牛」：四方向移动的 2D 俯视骨架，限时收集玩法的主角。
##
## 规范要点（见 SKILL.md「GDScript 规范」）：
## - 输入只读 InputMap 动作名（project.godot [input] 已注册），禁止硬编码 keycode；
## - 对外只发信号，不直接操作 UI 节点（UI 在 main.tscn 里订阅）；
## - 拾取判定由子节点 PickupArea（Area2D）承担，可收集物侧感知重叠后发信号。

## 玩家位置变化时发出；订阅方（main.gd）用它刷新 HUD 坐标与验证输入生效。
signal moved(position: Vector2)

## 牛牛移动速度（px/s）。
const SPEED: float = 220.0
## 可活动场地范围（640x360 视口内留 20px 边距，防止牛牛移出画面）。
const PLAY_RECT: Rect2 = Rect2(20.0, 20.0, 600.0, 320.0)


func _physics_process(_delta: float) -> void:
	# 结算阶段（通关/失败）冻结移动，重开后由 start_run 恢复。
	if GameState.phase != GameState.Phase.RUNNING:
		velocity = Vector2.ZERO
		return
	var direction := Input.get_vector("move_left", "move_right", "move_up", "move_down")
	velocity = direction * SPEED
	move_and_slide()
	global_position = global_position.clamp(
		PLAY_RECT.position, PLAY_RECT.position + PLAY_RECT.size
	)
	if direction != Vector2.ZERO:
		moved.emit(global_position)
