class_name Player
extends CharacterBody2D
## 玩家（忍者）：自动向前奔跑，玩家只负责「跳跃 / 二段跳」。
##
## 规范要点（见 SKILL.md「GDScript 规范」）：
## - 输入只读 InputMap 动作名（project.godot [input] 已注册 jump / confirm），禁止硬编码 keycode；
## - 对外只发信号，不直接操作 UI 节点（Main 场景订阅 moved / jumped / died）；
## - 数值调参集中在常量区（手感参数：跑速 / 跳力 / 重力 / 二段跳上限）。

## 位置变化（每物理帧发出）：Main 订阅它刷新 HUD 的进度与坐标。
signal moved(position: Vector2)
## 起跳成功：参数为当前是第几段跳（1 = 地面起跳，2 = 二段跳）。
signal jumped(jump_count: int)
## 玩家死亡（当前只有坠入深坑一种；撞尖刺由 Level 的危险区发出）。
signal died(cause: String)

## ── 手感参数区（集中一处；2D 跑酷的手感最终要人工试玩校准，不可被冒烟判定）──
## 自动奔跑速度（像素/秒）。
const RUN_SPEED: float = 240.0
## 起跳初速度（像素/秒，向上为负）。
const JUMP_VELOCITY: float = -520.0
## 重力加速度（像素/秒²）。
const GRAVITY: float = 1400.0
## 下落速度上限（像素/秒），防止深坑里无限加速穿透。
const MAX_FALL_SPEED: float = 900.0
## 最大跳跃段数：地面起跳 + 二段跳。
const MAX_JUMPS: int = 2
## 坠落判定线：低于它视为掉进深坑。
const FALL_LIMIT_Y: float = 420.0
## 出生点（Level 赛道的起始平台上方）。
const START_POSITION: Vector2 = Vector2(60, 150)

## 当前已用跳跃段数（落地清零；走下平台视为已消耗地面起跳）。
var jumps_used: int = 0
## 结算后冻结（胜/负都停跑），由 Main 在信号回调里设置。
var frozen: bool = false

var _was_on_floor: bool = false


func _unhandled_input(event: InputEvent) -> void:
	# 触摸确认按钮注入 confirm 动作，与键盘 jump 走同一条路径（SKILL.md 移动端触摸规范）。
	if event.is_action_pressed(&"jump") or event.is_action_pressed(&"confirm"):
		try_jump()


func _physics_process(delta: float) -> void:
	if frozen:
		velocity = Vector2.ZERO
		return
	velocity.y = minf(velocity.y + GRAVITY * delta, MAX_FALL_SPEED)
	velocity.x = RUN_SPEED
	move_and_slide()

	var on_floor := is_on_floor()
	if on_floor:
		jumps_used = 0
	elif _was_on_floor and jumps_used == 0:
		# 直接走出平台边缘不算「还有地面跳可省」：只保留一次空中跳，防止三段跳。
		jumps_used = 1
	_was_on_floor = on_floor

	moved.emit(global_position)
	if global_position.y > FALL_LIMIT_Y:
		_die("pit")


## 尝试跳跃：地面起跳或空中二段跳。返回是否真的起跳了。
func try_jump() -> bool:
	if frozen or jumps_used >= MAX_JUMPS:
		return false
	velocity.y = JUMP_VELOCITY
	jumps_used += 1
	jumped.emit(jumps_used)
	return true


## 结算冻结（胜负已定，停在原地）。
func freeze() -> void:
	frozen = true
	velocity = Vector2.ZERO


## 重开一局：回到出生点，清空跳跃计数与冻结。
func respawn() -> void:
	global_position = START_POSITION
	velocity = Vector2.ZERO
	jumps_used = 0
	frozen = false
	_was_on_floor = false


func _die(cause: String) -> void:
	if frozen:
		return
	frozen = true
	velocity = Vector2.ZERO
	died.emit(cause)
