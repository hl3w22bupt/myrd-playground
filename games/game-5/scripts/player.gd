class_name Player
extends CharacterBody2D
## 玩家（松鼠）：四方向移动，永不越出场景边界（验收 2 硬性）。
##
## 规范要点（模板 + 知识 6e91a11d §五）：
## - 输入只读 InputMap 动作名（move_left/right/up/down），桌面键盘与移动端摇杆共同供动作；
## - Input.get_vector 已归一化对角线（防 √2 倍速）；
## - 每帧对场景边界 clamp —— 任何输入序（含 fuzz 对抗事件）下都不可能越界；
## - 对外只发信号（moved），不直接操作 UI。

signal moved(position: Vector2)

const SPEED: float = 240.0
## 视觉半径（贴边内边距按此计算）；碰撞盒取视觉的 ~78%（宽容度，知识 6e91a11d §四）。
const VISUAL_RADIUS: float = 14.0
## 场景边缘内边距：边界 clamp 的安全距离（≥ 半个角色）。
const EDGE_MARGIN: float = 24.0

## 局结束 / 未开局时冻结（结算面板期间不可再动）。
var frozen: bool = false


func _physics_process(_delta: float) -> void:
	if frozen:
		velocity = Vector2.ZERO
		return
	var direction := _get_move_vector()
	var speed := SPEED
	if GameState.slow_left > 0.0:
		# 坏水果减速 debuff（迭代反馈 3）：减速期移速 × SLOW_FACTOR，只读 GameState 状态。
		speed *= GameState.SLOW_FACTOR
	velocity = direction * speed
	move_and_slide()
	global_position = clamped_position(global_position)
	if direction != Vector2.ZERO:
		moved.emit(global_position)


## 统一移动向量出口（知识 82e419bb §二.3 落地点）：所有移动代码只读这一个函数。
## 键盘（InputMap 动作）与触屏摇杆（VirtualJoystick.vector）在此汇合：
##   - 键盘：Input.get_vector 已按动作 deadzone 归一；
##   - 摇杆：经 "joystick" 组取当前向量（非触屏端恒为 ZERO，摇杆只写状态不移动角色）；
##   - 合成后 limit_length(1.0)：防对角线 √2 倍速，同时保证「同非零取合成不超速」的固定口径。
func _get_move_vector() -> Vector2:
	var keyboard := Input.get_vector("move_left", "move_right", "move_up", "move_down")
	var joystick := Vector2.ZERO
	var joystick_node := get_tree().get_first_node_in_group("joystick")
	if joystick_node is VirtualJoystick:
		joystick = (joystick_node as VirtualJoystick).vector
	return (keyboard + joystick).limit_length(1.0)


## 边界 clamp：以当前视口（960x540 设计分辨率）为界，永不越界。
func clamped_position(pos: Vector2) -> Vector2:
	var bounds := get_viewport_rect().size
	return pos.clamp(
		Vector2(EDGE_MARGIN, EDGE_MARGIN),
		Vector2(bounds.x - EDGE_MARGIN, bounds.y - EDGE_MARGIN))


## 重开新局：回到场地中心并解冻。
func reset_for_new_match() -> void:
	var bounds := get_viewport_rect().size
	global_position = bounds / 2.0
	velocity = Vector2.ZERO
	frozen = false
