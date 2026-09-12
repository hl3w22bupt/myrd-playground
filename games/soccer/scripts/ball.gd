class_name Ball
extends Node2D
## 足球：纯运动学小球（位置 + 速度 + 摩擦），不参与物理引擎碰撞 ——
## 俯视足球的控球/抢断/踢球全部由 Main（比赛控制器）按距离规则判定，保证无头运行确定性。
##
## 规范要点：对外只发信号，不持有 UI；状态由 Main 驱动，这里只做运动积分。

## 被踢出时发出（Main 可用于音效/特效等，当前用于冒烟断言核心交互）。
signal kicked(velocity: Vector2)

## 无人在脚下时的滚动摩擦（每秒速度保留比例的指数底）。
const FRICTION_PER_SECOND: float = 0.35
## 球的半径（像素，绘制与判定共用）。
const RADIUS: float = 7.0
## 踢球者短暂的「不能再拿球」冷却（秒），防止传球/射门瞬间又被自己吸走。
const RECAPTURE_COOLDOWN: float = 0.45

## 当前速度（像素/秒）。
var velocity: Vector2 = Vector2.ZERO
## 当前持球人（null = 自由球）。注意：不能用 `owner`（与 Node.owner 冲突）。
var holder: Footballer = null
## 踢球人冷却计时（>0 时该踢球人不能立即重新控球）。
var kicker_cooldown: Footballer = null
var kicker_cooldown_left: float = 0.0
## 最后触球队伍（0 主队 / 1 客队），出界判定（界外球/角球/球门球）的归属依据。
var last_touch_team: int = -1
## 重新发球时的归属锁（-1 无锁；否则只有该队能够抢到这个自由球）。
var capture_lock_team: int = -1


func _physics_process(delta: float) -> void:
	if kicker_cooldown_left > 0.0:
		kicker_cooldown_left = maxf(0.0, kicker_cooldown_left - delta)
		if kicker_cooldown_left == 0.0:
			kicker_cooldown = null
	if holder != null:
		# 带球：球贴在持球人身前一点的位置。
		var facing := Vector2.RIGHT
		if holder.velocity.length_squared() > 1.0:
			facing = holder.velocity.normalized()
		global_position = holder.global_position + facing * (Footballer.BODY_RADIUS + RADIUS + 2.0)
	else:
		# 自由球：积分 + 摩擦。
		global_position += velocity * delta
		var keep := pow(FRICTION_PER_SECOND, delta)
		velocity *= keep
		if velocity.length_squared() < 4.0:
			velocity = Vector2.ZERO


## 某球员此刻能否拿球（冷却 / 归属锁判定；距离判定由 Main 做）。
func can_be_captured_by(player: Footballer) -> bool:
	if holder != null:
		return false
	if kicker_cooldown == player:
		return false
	if capture_lock_team != -1 and capture_lock_team != player.team:
		return false
	return true


## 踢球：解除持球、给球速度、记录触队与冷却。
func kick_by(player: Footballer, new_velocity: Vector2) -> void:
	holder = null
	velocity = new_velocity
	last_touch_team = player.team
	kicker_cooldown = player
	kicker_cooldown_left = RECAPTURE_COOLDOWN
	capture_lock_team = -1
	kicked.emit(new_velocity)


## 直接把球给某球员（开球 / 球门球等重发场景）。
func give_to(player: Footballer) -> void:
	holder = player
	velocity = Vector2.ZERO
	last_touch_team = player.team
	capture_lock_team = -1
	kicker_cooldown = null
	kicker_cooldown_left = 0.0


## 绘制：白底黑边的球体（俯视）。
func _draw() -> void:
	draw_circle(Vector2.ZERO, RADIUS + 1.5, Color(0.08, 0.08, 0.08))
	draw_circle(Vector2.ZERO, RADIUS, Color(0.96, 0.96, 0.96))
	draw_circle(Vector2(-2.0, -2.0), 2.0, Color(0.5, 0.5, 0.5))
