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

## 坏水果减速状态（剩余时长 / 速度倍率）：只在剩余时长 > 0 时生效。
const SLOW_DURATION: float = 1.5
const SLOW_FACTOR: float = 0.6

var _slow_left: float = 0.0
var _slow_factor: float = Player.SLOW_FACTOR


func _physics_process(delta: float) -> void:
	if frozen:
		velocity = Vector2.ZERO
		return
	_slow_left = maxf(_slow_left - delta, 0.0)
	var direction := Input.get_vector("move_left", "move_right", "move_up", "move_down")
	var speed: float = GameState.player_speed * (_slow_factor if _slow_left > 0.0 else 1.0)
	velocity = direction * speed
	move_and_slide()
	global_position = clamped_position(global_position)
	if direction != Vector2.ZERO:
		moved.emit(global_position)


## 坏水果命中：进入减速状态（Main 在计分后调用）。
func apply_slow(duration: float = SLOW_DURATION, factor: float = SLOW_FACTOR) -> void:
	_slow_left = duration
	_slow_factor = factor


## 减速是否生效（冒烟断言用）。
func is_slowed() -> bool:
	return _slow_left > 0.0


## 边界 clamp：以当前视口（960x540 设计分辨率）为界，永不越界。
func clamped_position(pos: Vector2) -> Vector2:
	var bounds := get_viewport_rect().size
	return pos.clamp(
		Vector2(EDGE_MARGIN, EDGE_MARGIN),
		Vector2(bounds.x - EDGE_MARGIN, bounds.y - EDGE_MARGIN))


## 重开新局：回到场地中心并解冻（减速状态一并清掉）。
func reset_for_new_match() -> void:
	var bounds := get_viewport_rect().size
	global_position = bounds / 2.0
	velocity = Vector2.ZERO
	frozen = false
	_slow_left = 0.0
