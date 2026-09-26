class_name Player
extends CharacterBody2D
## 玩家（忍者）：自动向前奔跑，玩家只负责「跳跃 / 二段跳」。
##
## 规范要点（见 SKILL.md「GDScript 规范」）：
## - 输入只读 InputMap 动作名（project.godot [input] 已注册 jump / confirm），禁止硬编码 keycode；
## - 对外只发信号，不直接操作 UI 节点（Main 场景订阅 moved / jumped / died）；
## - 数值调参集中在常量区（手感参数：跑速 / 跳力 / 重力 / 土狼时间 / 跳跃缓冲）。
##
## 手感设计（2D 平台跳跃的三个经典容错，全部确定帧数、可无头断言）：
## - 土狼时间 COYOTE_FRAMES：走出平台边缘后一小段帧内仍视为「可地面起跳」，
##   消除「明明按了却没跳」的挫败感；窗口过后的空中按跳自动降级为空中跳。
## - 跳跃缓冲 JUMP_BUFFER_FRAMES：无可用地跳时的按跳会记住一小段帧，
##   落地瞬间自动起跳，消除「落地前一点点按跳被吞」的输入丢失。
## - 两者只是「输入判定窗口」的宽容，不改变跳跃力学本身。

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
## 土狼时间（物理帧，60fps 下 ≈ 0.10s）：走出平台边缘后仍可「地面起跳」的窗口。
const COYOTE_FRAMES: int = 6
## 跳跃缓冲（物理帧，60fps 下 ≈ 0.10s）：无可用地跳时的按跳保留多久，落地即消费。
const JUMP_BUFFER_FRAMES: int = 6
## 坠落判定线：低于它视为掉进深坑（相机下缘在 340，本线在其下方，坠落全程可见）。
const FALL_LIMIT_Y: float = 420.0
## 出生点（Level 赛道的起始平台上方）。
const START_POSITION: Vector2 = Vector2(60, 150)

## ── 跨坑能力推导（level.gd 的坑宽与 tests/smoke.gd 的可达性断言都以它为唯一口径）──
## 与 player.tscn 碰撞盒 22×26 保持一致：半宽 11px = 落点压边宽容（后半身压到对岸即可着陆）。
const PLAYER_HALF_WIDTH: float = 11.0
## 单跳滞空 = 2 × |JUMP_VELOCITY| / GRAVITY = 2 × 520 / 1400 ≈ 0.743s。
const JUMP_AIR_TIME: float = -2.0 * JUMP_VELOCITY / GRAVITY
## 单跳水平跨距 = 滞空 × RUN_SPEED ≈ 178px。
const SINGLE_JUMP_RANGE: float = JUMP_AIR_TIME * RUN_SPEED
## 二段跳（第二跳在最高点按）滞空 ≈ 2 × 单跳滞空 → 水平跨距 ≈ 357px。
const DOUBLE_JUMP_RANGE: float = 2.0 * SINGLE_JUMP_RANGE
## 跨坑上限 = 水平跨距 + 落点压边宽容：单跳 ≈ 189px、二段跳 ≈ 368px。
## 关卡坑宽必须低于对应上限并留余量（余量承诺见 level.gd 赛道数据区注释）。
const SINGLE_JUMP_GAP_MAX: float = SINGLE_JUMP_RANGE + PLAYER_HALF_WIDTH
const DOUBLE_JUMP_GAP_MAX: float = DOUBLE_JUMP_RANGE + PLAYER_HALF_WIDTH

## 当前已用跳跃段数（落地清零；土狼窗口结束视为已消耗地面起跳）。
var jumps_used: int = 0
## 结算后冻结（胜/负都停跑），由 Main 在信号回调里设置。
var frozen: bool = false

## 土狼窗口剩余帧数（在地面时充满，离地后逐帧递减）。
var _coyote_left: int = 0
## 跳跃缓冲剩余帧数（按跳却无跳可用时充满，落地瞬间消费）。
var _jump_buffer_left: int = 0


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
		_coyote_left = COYOTE_FRAMES
		if _jump_buffer_left > 0:
			# 落地瞬间消费跳跃缓冲：之前「差一点」的那次按跳在这里兑现。
			_do_jump(1)
	else:
		if _coyote_left > 0:
			_coyote_left -= 1
		elif jumps_used == 0:
			# 土狼窗口结束仍未起跳：地面跳视为已消耗，之后只剩一次空中跳（防三段跳）。
			jumps_used = 1
		if _jump_buffer_left > 0:
			_jump_buffer_left -= 1

	moved.emit(global_position)
	if global_position.y > FALL_LIMIT_Y:
		_die("pit")


## 尝试跳跃：地面/土狼窗口内起跳，或空中二段跳；无跳可用则记入跳跃缓冲。
## 返回是否这一帧真的起跳了（记入缓冲返回 false，但意图会在落地时兑现）。
func try_jump() -> bool:
	if frozen:
		return false
	_jump_buffer_left = JUMP_BUFFER_FRAMES
	if is_on_floor() or _coyote_left > 0:
		_do_jump(1)
		return true
	if jumps_used < MAX_JUMPS:
		_do_jump(jumps_used + 1)
		return true
	return false


## 结算冻结（胜负已定，停在原地）。
func freeze() -> void:
	frozen = true
	velocity = Vector2.ZERO


## 重开一局：回到出生点，清空跳跃计数、两个输入宽容窗口与冻结。
func respawn() -> void:
	global_position = START_POSITION
	velocity = Vector2.ZERO
	jumps_used = 0
	_coyote_left = 0
	_jump_buffer_left = 0
	frozen = false


func _do_jump(count: int) -> void:
	velocity.y = JUMP_VELOCITY
	jumps_used = count
	_coyote_left = 0
	_jump_buffer_left = 0
	jumped.emit(count)


func _die(cause: String) -> void:
	if frozen:
		return
	frozen = true
	velocity = Vector2.ZERO
	died.emit(cause)
