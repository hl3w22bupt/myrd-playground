class_name Player
extends CharacterBody2D
## 跑酷玩家：自动前进的世界里做「跳跃 / 快速下落 / 水平微调」。
##
## 规范要点（见 SKILL.md「GDScript 规范」）：
## - class_name 唯一，且与文件名职责一致（player.gd → class_name Player）；
## - 输入只读 InputMap 动作名（project.godot [input] 已注册），禁止硬编码 keycode；
## - 对外只发信号，不直接操作 UI/相机节点。
##
## 运动学采用确定性积分（重力 + 位置积分 + 地面钳制），不依赖物理引擎回弹：
## 无头冒烟与真机的运动轨迹一致，门禁断言可复现。

## 位置变化时发出；订阅方（Main/HUD）据此刷新。
signal moved(position: Vector2)
## 起跳时发出（冒烟断言「玩家能移动」的信号通道）。
signal jumped

const GRAVITY_PX_S2: float = 1600.0
const JUMP_VELOCITY_PX_S: float = -480.0
## 按住下方向时的重力倍率（快速落地）。
const FAST_FALL_GRAVITY_SCALE: float = 2.4
## 水平微调速度（跑酷主体自动前进，左右只做小范围走位）。
const HORIZ_SPEED_PX_S: float = 160.0
const MIN_X: float = 70.0
const MAX_X: float = 320.0
## 地面高度（玩家中心 y 钳制值），与主场景 Ground 顶面对齐。
const FLOOR_Y: float = 288.0
## 出生点。
const START_X: float = 140.0

var _on_floor: bool = true


func _physics_process(delta: float) -> void:
	# 非 RUNNING 状态角色完全冻结：game over 后画面里不再有任何由玩家引起的运动。
	if GameState.state != GameState.State.RUNNING:
		return
	var direction := Input.get_vector("move_left", "move_right", "move_up", "move_down")
	if direction.x != 0.0:
		position.x = clampf(position.x + direction.x * HORIZ_SPEED_PX_S * delta, MIN_X, MAX_X)
		moved.emit(global_position)
	var gravity := GRAVITY_PX_S2 * (FAST_FALL_GRAVITY_SCALE if direction.y > 0.0 else 1.0)
	velocity.y += gravity * delta
	position.y += velocity.y * delta
	if position.y >= FLOOR_Y:
		position.y = FLOOR_Y
		velocity.y = 0.0
		if not _on_floor:
			_on_floor = true
			moved.emit(global_position)
	else:
		_on_floor = false
	if Input.is_action_just_pressed("jump") and _on_floor:
		velocity.y = JUMP_VELOCITY_PX_S
		_on_floor = false
		jumped.emit()
		moved.emit(global_position)


## 重开时归位（由主场景调用）。
func reset() -> void:
	position = Vector2(START_X, FLOOR_Y)
	velocity = Vector2.ZERO
	_on_floor = true
