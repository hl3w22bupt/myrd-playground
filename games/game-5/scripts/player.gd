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
	var direction := Input.get_vector("move_left", "move_right", "move_up", "move_down")
	velocity = direction * GameState.player_speed
	move_and_slide()
	global_position = clamped_position(global_position)
	if direction != Vector2.ZERO:
		moved.emit(global_position)


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
