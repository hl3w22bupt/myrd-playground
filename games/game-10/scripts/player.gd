class_name Player
extends CharacterBody2D
## 玩家角色：四方向移动去收集流星；托管模式下由 Main 注入自动导航方向。
##
## 规范要点（见 SKILL.md「GDScript 规范」「移动端触摸规范」）：
## - 输入只读 InputMap 动作名（project.godot [input] 已注册），禁止硬编码 keycode；
## - 托管不是第二套输入：Main 每物理帧写 autopilot_direction，与键盘/摇杆同一条速度通路；
## - 对外只发信号，不直接操作 UI 节点（UI 在 Main 场景里订阅）。

## 玩家位置变化时发出；订阅方：冒烟场景（断言输入真的驱动了位移）。
signal moved(position: Vector2)

## 托管导航方向（世界坐标，已归一化）；零向量 = 无托管接管，回落到玩家输入。
var autopilot_direction: Vector2 = Vector2.ZERO

## 场地边界内边距（px）：防止玩家移出可见区域。
const EDGE_MARGIN: float = 24.0


func set_autopilot_direction(direction: Vector2) -> void:
	autopilot_direction = direction


func _physics_process(_delta: float) -> void:
	var direction := Input.get_vector("move_left", "move_right", "move_up", "move_down")
	# 速度只读 GameState 调参区（spec.numeric 对接面），禁止在这里写魔数。
	var speed: float = GameState.move_speed
	if not autopilot_direction.is_zero_approx():
		# 托管接管：方向由 Main 计算，速度用托管速度（仍是同一条 velocity 通路）。
		direction = autopilot_direction
		speed = GameState.autopilot_speed
	velocity = direction * speed
	move_and_slide()
	_clamp_to_play_rect()
	if direction != Vector2.ZERO:
		moved.emit(global_position)


## 把玩家钳回可见场地内（stretch=expand 时视口随窗口变化，逐帧取实时尺寸）。
func _clamp_to_play_rect() -> void:
	var rect := get_viewport_rect()
	global_position = global_position.clamp(
		rect.position + Vector2(EDGE_MARGIN, EDGE_MARGIN),
		rect.end - Vector2(EDGE_MARGIN, EDGE_MARGIN)
	)
