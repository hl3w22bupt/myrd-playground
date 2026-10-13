class_name Player
extends CharacterBody2D
## 玩家角色「牛牛」：四方向移动的 2D 俯视骨架，限时收集玩法的主角。
##
## 规范要点（见 SKILL.md「GDScript 规范」）：
## - 输入只读 InputMap 动作名（project.godot [input] 已注册），禁止硬编码 keycode；
## - 对外只发信号，不直接操作 UI 节点（UI 在 main.gd 里订阅）；
## - 拾取判定由子节点 PickupArea（Area2D）承担，可收集物侧感知重叠后发信号；
## - 道具效果（磁铁/加速，v3 ②）以计时状态承载，数值只读 GameState 声明键。

## 玩家位置变化时发出；订阅方（main.gd）用它刷新 HUD 与验证输入生效。
signal moved(position: Vector2)
## 道具激活时发出（kind = magnet / boost）；订阅方（main.gd）做飘字与音效反馈。
signal powerup_activated(kind: String)

## 可活动场地范围（720x1280 竖屏画布内留 24px 边距，防止牛牛移出画面）。
const PLAY_RECT: Rect2 = Rect2(24.0, 24.0, 672.0, 1232.0)

## 已应用到本节点的体型倍率（脏检查用：与数值区一致则跳过，避免每帧重设碰撞体）。
var _applied_scale: float = 0.0
## 磁铁剩余生效时间（秒）；<=0 表示未生效。
var _magnet_left: float = 0.0
## 加速剩余生效时间（秒）；<=0 表示未生效。
var _boost_left: float = 0.0


func _ready() -> void:
	# v2 手感基线：体型倍率的唯一来源是 GameState 数值区声明键（禁止散点改场景/代码对数值）。
	_apply_tuned_scale()


## 磁铁是否生效（main.gd 据此吸附范围内计分物；冒烟机判道具效果）。
func is_magnet_active() -> bool:
	return _magnet_left > 0.0


## 加速是否生效。
func is_boost_active() -> bool:
	return _boost_left > 0.0


## 激活磁铁（时长取数值区 MAGNET_DURATION；重复拾取刷新时长）。
func activate_magnet() -> void:
	_magnet_left = GameState.MAGNET_DURATION
	powerup_activated.emit("magnet")


## 激活加速（时长取数值区 BOOST_DURATION；重复拾取刷新时长）。
func activate_boost() -> void:
	_boost_left = GameState.BOOST_DURATION
	powerup_activated.emit("boost")


## 清空道具状态（重开时复位；冒烟在敏感阶段前置空，杜绝道具串扰判定）。
func clear_powerups() -> void:
	_magnet_left = 0.0
	_boost_left = 0.0


## 当前实际移速（px/s）：加速生效时 = PLAYER_SPEED × BOOST_MULT，否则 = PLAYER_SPEED。
func current_speed() -> float:
	if _boost_left > 0.0:
		return GameState.PLAYER_SPEED * GameState.BOOST_MULT
	return GameState.PLAYER_SPEED


func _physics_process(delta: float) -> void:
	# 道具计时只在进行中消耗（暂停/结算冻结，恢复后接着走）。
	if GameState.phase == GameState.Phase.RUNNING:
		if _magnet_left > 0.0:
			_magnet_left = maxf(_magnet_left - delta, 0.0)
		if _boost_left > 0.0:
			_boost_left = maxf(_boost_left - delta, 0.0)
	# 调参面板 / URL 改倍率后，下一物理帧生效（结算阶段同样应用，保证回滚可视）。
	_apply_tuned_scale()
	# 非 RUNNING（结算/暂停/待开始）冻结移动，开始或重开后由 start_run 恢复。
	if GameState.phase != GameState.Phase.RUNNING:
		velocity = Vector2.ZERO
		return
	var direction := Input.get_vector("move_left", "move_right", "move_up", "move_down")
	# 移速为数值区调参键（v2 基线 145）；加速道具按 BOOST_MULT 倍乘（v3 ②，可机判）。
	velocity = direction * current_speed()
	move_and_slide()
	global_position = global_position.clamp(
		PLAY_RECT.position, PLAY_RECT.position + PLAY_RECT.size
	)
	if direction != Vector2.ZERO:
		moved.emit(global_position)


## 把数值区 PLAYER_SCALE 应用到根节点 uniform scale：
## 视觉精灵（Polygon2D 子节点）、碰撞体（CollisionShape2D）与 PickupArea 判定体
## 随根变换整体同步放大，与需求「体型放大」口径一致；v1 口径回滚 = 调回 1.0。
func _apply_tuned_scale() -> void:
	if is_equal_approx(GameState.PLAYER_SCALE, _applied_scale):
		return
	_applied_scale = GameState.PLAYER_SCALE
	scale = Vector2.ONE * _applied_scale
