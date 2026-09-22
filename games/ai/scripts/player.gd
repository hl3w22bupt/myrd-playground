class_name Player
extends CharacterBody2D
## 玩家（小李）：被 AI 女友包围的主角，四方向移动。
##
## 规范要点（见 SKILL.md「GDScript 规范」）：
## - class_name 全工程唯一，文件名 = 类职责（player.gd → class_name Player）；
## - 输入只读 InputMap 动作名（project.godot [input] 已注册），禁止硬编码 keycode；
## - 对外只发信号，不直接操作 UI 节点（UI 在 Main 场景里订阅）；
## - 移动手感全部来自数值表（GameState.move_speed / move_accel / move_decel /
##   turn_speed / walk_anim_fps / idle_anim_fps / walk_frame_threshold），
##   改 data/spec/numeric.json 即调手感，不改代码（第四轮需求：移动动画平滑）。
##
## 平滑三件套（需求范围三）：
## 1) 位移缓动：velocity 向目标速度 move_toward（起步加速 / 松杆减速，消除瞬移）；
## 2) 帧动画：idle/walk 两段循环，walk 的 speed_scale 跟随实际速度比 —— 禁止静止贴图滑行；
## 3) 转身朝向：facing 在 [-1, 1] 区间连续过渡（scale.x = facing），翻转不硬跳。

## 玩家位置变化时发出；参数用类型标注（Vector2），订阅方可静态核对。
signal moved(position: Vector2)

## 玩家方形碰撞体的半边长（px）：对应 player.tscn 里 RectangleShape2D 的 size = 24×24。
## 这是「场景尺寸 ↔ 代码常量」的契约值，两边改其一都要同步（信物/危机的距离复核依赖它）。
const HALF_SIZE: float = 12.0

## 出生点唯一权威：重开一局「回起点」的落点。
## main.tscn 里 Player 节点的 position 必须与本值一致（冒烟阶段 A 会核对一致性）。
const START_POSITION: Vector2 = Vector2(320.0, 180.0)

## Body（AnimatedSprite2D）的显示缩放基准：帧素材 48×64，显示高 ≈52px。
const BODY_SCALE: float = 0.82

@onready var body: AnimatedSprite2D = $Body

## 朝向（-1 左 .. +1 右，连续值）：转身时平滑插值穿过中间值，不硬跳。
var _facing: float = 1.0
## 动画帧率已按数值表初始化的标记（reset 不重复设）。
var _anim_speed_applied: bool = false


func _physics_process(delta: float) -> void:
	var direction := Input.get_vector("move_left", "move_right", "move_up", "move_down")
	var target := direction * GameState.move_speed
	var rate := GameState.move_accel if direction != Vector2.ZERO else GameState.move_decel
	velocity = velocity.move_toward(target, rate * delta)
	move_and_slide()
	_clamp_to_play_area()
	_update_motion(delta, direction)
	if direction != Vector2.ZERO or velocity.length_squared() > 1.0:
		moved.emit(global_position)


## —— 平滑运动 ——
## 速度比（0..1）：帧动画速率与转身减速都以它为基准，任何输入通道（键盘/摇杆）同源生效。
func speed_ratio() -> float:
	if GameState.move_speed <= 0.0:
		return 0.0
	return clampf(velocity.length() / GameState.move_speed, 0.0, 1.0)


## 当前朝向（-1..1 连续值）：冒烟断言「转身不硬跳」直接读它。
func facing() -> float:
	return _facing


## 当前动画段名（&"idle" / &"walk"）：冒烟断言「随速度状态正确切换」直接读它。
func animation_name() -> StringName:
	return body.animation


func _update_motion(delta: float, direction: Vector2) -> void:
	_apply_anim_speed_once()
	_update_facing(delta, direction)
	_update_animation()


## 转身：只有横向意图驱动朝向；松杆保持当前朝向（角色不会自己转回正面）。
func _update_facing(delta: float, direction: Vector2) -> void:
	var intent := 0.0
	if absf(direction.x) > 0.05:
		intent = signf(direction.x)
	if intent != 0.0 and not is_equal_approx(intent, _facing):
		var step: float = GameState.turn_speed * delta
		if step >= absf(intent - _facing):
			_facing = intent
		else:
			_facing += step * signf(intent - _facing)
	body.scale.x = BODY_SCALE * _facing


## 帧动画：速度比超过阈值 → walk（speed_scale 跟随速度比，步频=步速）；
## 低于阈值 → idle 呼吸循环。两段都不停帧，切换即所见即所得。
func _update_animation() -> void:
	var ratio := speed_ratio()
	var next: StringName = &"walk" if ratio > GameState.walk_frame_threshold else &"idle"
	if body.animation != next:
		body.play(next)
	body.speed_scale = clampf(ratio * 1.15, 0.35, 1.8) if next == &"walk" else 1.0


## SpriteFrames 的帧率来自数值表：改 numeric.json 即调帧节奏，不动场景资源。
func _apply_anim_speed_once() -> void:
	if _anim_speed_applied:
		return
	_anim_speed_applied = true
	var frames: SpriteFrames = body.sprite_frames
	if frames.has_animation(&"walk"):
		frames.set_animation_speed(&"walk", GameState.walk_anim_fps)
	if frames.has_animation(&"idle"):
		frames.set_animation_speed(&"idle", GameState.idle_anim_fps)


## 边界钳制：以视口为玩法边界，内缩玩家半边长。
## 钳制在 move_and_slide 之后做，玩家永远不会卡在画面外/死角里（越界即被推回可视区）。
func _clamp_to_play_area() -> void:
	var bounds := GameState.play_area_size()
	global_position = global_position.clamp(
		Vector2(HALF_SIZE, HALF_SIZE),
		bounds - Vector2(HALF_SIZE, HALF_SIZE),
	)


## 重开一局时由 Main 调用：玩家回出生点、清残余速度、朝向回正、动画回待机。
func reset_to_start() -> void:
	global_position = START_POSITION
	velocity = Vector2.ZERO
	_facing = 1.0
	body.scale.x = BODY_SCALE
	_apply_anim_speed_once()
	body.play(&"idle")
