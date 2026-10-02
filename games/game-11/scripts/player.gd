class_name Player
extends CharacterBody2D
## 果篮：底部左右移动的玩家角色（接苹果 game-11）。
##
## 规范要点（见 SKILL.md「GDScript 规范」「移动端触摸规范」）：
## - 输入只读 InputMap 动作名（project.godot [input] 已注册），禁止硬编码 keycode；
##   键盘（←/→ 或 A/D）与触摸摇杆都汇到同一组 move_* 动作，键盘/摇杆优先级最高；
## - 鼠标/触屏「水平跟随」不走第二套输入路径：PointerFollowZone 把指针目标位置经
##   信号交给主场景，主场景调 set_follow_target()，本脚本只做「朝目标趋近」的移动；
## - 对外只发信号，不直接操作 UI 节点（UI 在 Main 场景里订阅）。

signal moved(position: Vector2)

## 跟随增益：速度与「目标距离」成正比，越近越慢（clamp 到 BASKET_SPEED 上限）。
const FOLLOW_GAIN: float = 9.0
## 距目标小于该像素值时直接贴合，避免在目标点附近抖动。
const FOLLOW_SNAP: float = 3.0

var _follow_target_x: float = 0.0
var _follow_active: bool = false


func _physics_process(_delta: float) -> void:
	var direction := Input.get_vector("move_left", "move_right", "move_up", "move_down")
	if direction.x != 0.0:
		velocity.x = direction.x * GameState.BASKET_SPEED
	elif _follow_active:
		var offset := _follow_target_x - global_position.x
		if absf(offset) <= FOLLOW_SNAP:
			global_position.x = _follow_target_x
			velocity.x = 0.0
		else:
			velocity.x = clampf(offset * FOLLOW_GAIN, -GameState.BASKET_SPEED, GameState.BASKET_SPEED)
	else:
		velocity.x = 0.0
	velocity.y = 0.0
	move_and_slide()

	# 果篮锁定在底部高度、限制在游戏区内。
	global_position.y = GameState.BASKET_Y
	var half_width := _half_width()
	global_position.x = clampf(global_position.x, GameState.PLAYFIELD_MARGIN + half_width,
			GameState.PLAYFIELD_WIDTH - GameState.PLAYFIELD_MARGIN - half_width)

	if velocity.x != 0.0:
		moved.emit(global_position)


## 指针跟随目标（鼠标位置 / 触屏触点 x）。由主场景转发，本脚本不感知输入事件。
func set_follow_target(x: float) -> void:
	_follow_target_x = x
	_follow_active = true


func clear_follow_target() -> void:
	_follow_active = false


func _half_width() -> float:
	var shape := $CollisionShape2D.shape as RectangleShape2D
	if shape == null:
		return 0.0
	return shape.size.x * 0.5
