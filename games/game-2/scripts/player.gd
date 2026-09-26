class_name Player
extends CharacterBody2D
## 玩家飞船：四方向移动 + 受击无敌帧。
##
## 规范要点（见 SKILL.md「GDScript 规范」）：
## - class_name 唯一（Player），输入只读 InputMap 动作名，禁止硬编码 keycode；
## - 对外只发信号（moved / hit_taken），不直接操作 UI 节点；
## - 受击扣盾走 GameState.apply_hit()（受击唯一入口），无敌帧在这里把关：
##   一次碰撞只扣一次，无敌帧内再次接触同一颗陨石不额外扣血（需求验收标准 2）。

## 玩家位置变化时发出；订阅方（main.gd）刷新 HUD。
signal moved(position: Vector2)
## 受击生效时发出（携带扣盾后的剩余护盾）；订阅方播放震屏反馈。
signal hit_taken(shield: int)

## 可活动范围（世界坐标）：飞船中心距视口各边 ≥16px。
## 余量推导：碰撞半径 12px（scenes/player.tscn CollisionShape2D）→ 碰撞圆距视口边
## ≥4px；视觉轮廓最远 14px（机鼻顶点）→ 贴边时机鼻距视口边 ≥2px，全程不裁切。
## clamp 双轴独立钳制：斜向顶着角落输入时沿边滑动，不会卡进死角。
const PLAY_BOUNDS: Rect2 = Rect2(16.0, 16.0, 608.0, 328.0)

var speed: float = 240.0

## 无敌帧剩余物理 tick 数（>0 期间再次受击被忽略）。
## 用物理 tick 计数而不用墙钟：headless / 掉帧场景下墙钟与物理节拍会脱钩，
## 受击窗口必须跟随游戏时间（60 tick/s）才可判定、可复现。
var _iframe_ticks_left: int = 0
var _blink_tween: Tween


func _ready() -> void:
	speed = GameConfig.player_speed


func _physics_process(_delta: float) -> void:
	if _iframe_ticks_left > 0:
		_iframe_ticks_left -= 1
	var direction := Input.get_vector("move_left", "move_right", "move_up", "move_down")
	velocity = direction * speed
	move_and_slide()
	global_position = global_position.clamp(PLAY_BOUNDS.position, PLAY_BOUNDS.end)
	if direction != Vector2.ZERO:
		moved.emit(global_position)


## 撞上陨石（陨石侧的 body_entered 调用）：无敌帧外才真正扣盾。
func take_hit() -> void:
	if GameState.is_game_over or _iframe_ticks_left > 0:
		return
	_iframe_ticks_left = _invincibility_ticks()
	GameState.apply_hit()
	hit_taken.emit(GameState.shield)
	_play_blink()


## 无敌帧时长（秒）→ 物理 tick 数（至少 1 tick）。
func _invincibility_ticks() -> int:
	var ticks := int(round(GameConfig.invincibility_seconds * float(Engine.physics_ticks_per_second)))
	return maxi(ticks, 1)


## 受击反馈：无敌帧期间飞船闪烁，给「刚才那下生效了」的视觉证据。
func _play_blink() -> void:
	if _blink_tween != null and _blink_tween.is_valid():
		_blink_tween.kill()
	modulate = Color(1.0, 1.0, 1.0, 1.0)
	_blink_tween = create_tween()
	_blink_tween.set_loops(3)
	var half: float = maxf(GameConfig.invincibility_seconds / 6.0, 0.05)
	_blink_tween.tween_property(self, "modulate:a", 0.25, half)
	_blink_tween.tween_property(self, "modulate:a", 1.0, half)
