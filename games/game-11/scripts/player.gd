class_name Player
extends CharacterBody2D
## 果篮：底部左右移动的玩家角色（接苹果 game-11）。
##
## 规范要点（见 SKILL.md「GDScript 规范」「移动端触摸规范」）：
## - 输入只读 InputMap 动作名（project.godot [input] 已注册），禁止硬编码 keycode；
##   键盘（←/→ 或 A/D）与触摸摇杆都汇到同一组 move_* 动作，键盘/摇杆优先级最高；
## - 鼠标/触屏「水平跟随」不走第二套输入路径：PointerFollowZone 把指针目标位置经
##   信号交给主场景，主场景调 set_follow_target()，本脚本把果篮实时贴合到该位置；
## - 对外只发信号，不直接操作 UI 节点（UI 在 Main 场景里订阅）。

signal moved(position: Vector2)

var _follow_target_x: float = 0.0
var _follow_active: bool = false


func _physics_process(_delta: float) -> void:
	var previous_x := global_position.x
	var direction := Input.get_vector("move_left", "move_right", "move_up", "move_down")
	if direction.x != 0.0:
		velocity.x = direction.x * GameState.basket_speed
	elif _follow_active:
		# 指针跟随 = 实时贴合指针目标（果篮吸附在光标/触点正下方），不做渐近逼近：
		# 比例增益式跟随只会无限逼近，指针停住后果篮仍差一截，手感也发滞 ——
		# 需求第 3 条要的是「实时跟随」。目标越界由下方边界钳制统一收口。
		velocity.x = 0.0
		global_position.x = _follow_target_x
	else:
		velocity.x = 0.0
	velocity.y = 0.0
	move_and_slide()

	# 果篮锁定在底部高度、限制在游戏区内。
	# 不变式：果篮边缘不得越过左右留白线 → 中心 ∈ [MARGIN + 半宽, W - MARGIN - 半宽]。
	# 区间基准写在 GameState.basket_clamp_range()（40 + 30 = 70 / 640 - 40 - 30 = 570）；
	# 这里对实际碰撞半宽取 max 兜底：形状被改宽时按更宽的半宽重新内收，不重新出现贴边死角。
	global_position.y = GameState.BASKET_Y
	var half_width := maxf(_half_width(), GameState.BASKET_HALF_WIDTH)
	global_position.x = clampf(global_position.x,
			GameState.PLAYFIELD_MARGIN + half_width,
			GameState.VIEWPORT_WIDTH - GameState.PLAYFIELD_MARGIN - half_width)

	# 键盘移动、指针贴合、边界钳制三种来源的真实位移都对外广播（订阅方按需刷新）。
	if global_position.x != previous_x:
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
